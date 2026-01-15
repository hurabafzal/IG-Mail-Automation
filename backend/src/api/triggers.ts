import { Effect, pipe } from "effect";
import { Elysia, t } from "elysia";
import { type SelectQueryBuilder, sql } from "kysely";
import cache from "../cache";
import { db } from "../db";
import type { DB_WITH_VIEWS } from "../db/views_schema";
import { BitmapTrigger, isBitSet } from "../legacy-triggers/bitmap";
import {
	COUNTRY_GROUPS,
	type CountryGroup,
	type InstantlyCampaign,
	instantlyCampaigns,
} from "../utils/consts";
import { daysAgo } from "../utils/daysAgo";

const get_settings = cache.settings.get;
const set_settings = cache.settings.set;

type SequenceFolder = {
	_id: string;
	userId: string;
	name: string;
	sequenceIds: string[];
	createdAt: string;
	savedAt: string;
	shared: unknown;
};

type Sequence = {
	_id: string;
	variables: unknown[];
	name: string;
	stages: {
		_id: string;
		userId: string;
		createdAt: string;
		updatedAt: string;
		type: string;
		subject: string;
		body: string;
		scheduleBetween: {
			timezone: string;
			start: number;
			end: number;
		};
	}[];
};

// const tokenEmails = [
// 	"nils@keazapp.de",
// 	"nicolas@keazapp.de",
// 	"niels@keazapp.de",
// 	"thilo@keazapp.de",
// 	"cornelius@keazapp.de",
// ];

function addCountryConditions(
	query: SelectQueryBuilder<
		DB_WITH_VIEWS,
		"leads",
		{
			bitmap: number;
			lastSentOpener: Date | null;
			count: number;
			activeCampaignId: string | null;
		}
	>,
	group: CountryGroup,
) {
	if (group.bioLanguage) {
		query = query.where("bio_language", "=", group.bioLanguage);
	}
	return query.where("country", "in", group.countries);
}

export const triggersRouter = new Elysia({ prefix: "/api/triggers" })
	.get("/", async () => {
		const r = await db
			.selectFrom("Trigger")
			.selectAll()
			.orderBy("rank", "asc")
			.orderBy("id", "asc")
			.execute();
		return r.map((t) => ({
			...t,
		}));
	})
	.get("/data", async () => {
		const x = await cache.settings.get(["emailCoolDownDays"]);
		const globalCooldownDays = Number.parseInt(x.emailCoolDownDays);
		const coolDownAgo = new Date(
			Date.now() - globalCooldownDays * 24 * 60 * 60 * 1000,
		);

		const matching_rangeBase = db
			.selectFrom("leads")
			.groupBy("bitmap")
			.groupBy("lastSentOpener")
			.groupBy("activeCampaignId")
			.select([
				"bitmap",
				"lastSentOpener",
				"activeCampaignId",
				sql<number>`COUNT(DISTINCT id)::int`.as("count"),
			]);

		const get_country_groups_with_triggers = Effect.all(
			COUNTRY_GROUPS.map((group) =>
				pipe(
					Effect.promise(() =>
						db
							.selectFrom("Trigger")
							.select(["id", "trigger_group_id"])
							.where("lang", "=", group.id)
							.execute(),
					),
					Effect.map((xs) => ({ ...group, triggers: xs })),
				),
			),
			{ concurrency: 2 },
		);
		const country_groups_with_triggers = await Effect.runPromise(
			get_country_groups_with_triggers,
		);

		const matchingRanks = Effect.all(
			country_groups_with_triggers.map((group) =>
				pipe(
					Effect.promise(() =>
						addCountryConditions(matching_rangeBase, group).execute(),
					),
					Effect.map((x) => getTriggersCounts(x, group.triggers)),
				),
			),
			{ concurrency: 2 },
		).pipe(Effect.map((xs) => xs.flat()));

		const notOnCooldown = Effect.all(
			country_groups_with_triggers.map((group) =>
				pipe(
					Effect.all(
						{
							opener2_count:
								group.id === "DE"
									? Effect.promise<number>(() =>
											addCountryConditions(
												matching_rangeBase
													.where((qb) =>
														qb.or([
															qb("lastSentEmail", "<", coolDownAgo),
															qb("lastSentEmail", "is", null),
														]),
													)
													.where(
														sql`bitmap & ${1 << BitmapTrigger.Opener2}`,
														"=",
														0,
													)
													.where((oc) =>
														oc.or([
															oc("activeCampaignId", "is", null),
															oc(
																"activeCampaignId",
																"=",
																instantlyCampaigns["🇩🇪 Campaign 1"].id,
															),
														]),
													)
													.where("lastSentOpener", "<", daysAgo(70))
													.where("approved", "=", "APPROVED"),
												group,
											)
												.execute()
												.then((x) =>
													x.reduce((sum, item) => sum + item.count, 0),
												),
										)
									: Effect.succeed(undefined),
							opener3_count:
								group.id === "DE"
									? Effect.promise<number>(() =>
											addCountryConditions(
												matching_rangeBase
													.where((qb) =>
														qb.or([
															qb("lastSentEmail", "<", coolDownAgo),
															qb("lastSentEmail", "is", null),
														]),
													)
													.where(
														sql`bitmap & ${1 << BitmapTrigger.Opener2}`,
														"<>",
														0,
													)
													.where(
														sql`bitmap & ${1 << BitmapTrigger.Opener3}`,
														"=",
														0,
													)
													.where((oc) =>
														oc.or([
															oc("activeCampaignId", "is", null),
															oc(
																"activeCampaignId",
																"=",
																instantlyCampaigns["🇩🇪 Campaign 2"].id,
															),
														]),
													)
													.where("lastSentOpener", "<", daysAgo(70))
													.where("approved", "=", "APPROVED"),
												group,
											)
												.execute()
												.then((x) =>
													x.reduce((sum, item) => sum + item.count, 0),
												)
												.then((x) => {
													console.log(`opener3_count ${group.id} ${x}`);
													return x;
												}),
										)
									: Effect.succeed(undefined),
							other_triggers: Effect.promise(() =>
								addCountryConditions(
									matching_rangeBase
										.where((qb) =>
											qb.or([
												qb("lastSentEmail", "<", coolDownAgo),
												qb("lastSentEmail", "is", null),
											]),
										)
										.where("approved", "=", "APPROVED"),
									group,
								).execute(),
							),
						},
						{ concurrency: 2 },
					),
					Effect.map(({ other_triggers, opener2_count, opener3_count }) =>
						getTriggersCounts(
							other_triggers,
							group.triggers,
							opener2_count,
							opener3_count,
						),
					),
				),
			),
		).pipe(Effect.map((xs) => xs.flat()));

		const res = Effect.all(
			{
				recent_events: Effect.promise(() =>
					db
						.selectFrom("TriggerLog")
						.groupBy("trigger_id")
						.select(["trigger_id", sql<number>`COUNT(*)`.as("recent_events")])
						// trigger in the past 48 hours
						.where("createdAt", ">", new Date(Date.now() - 1000 * 60 * 60 * 24))
						.where("TriggerLog.sent_email_id", "is not", null)
						.execute()
						.finally(() => console.log("recent_events")),
				),

				all_events: Effect.promise(() =>
					db
						.selectFrom("TriggerLog")
						.groupBy("trigger_id")
						.select(["trigger_id", sql<number>`COUNT(*)`.as("all_events")])
						.where("TriggerLog.sent_email_id", "is not", null)
						.execute()
						.finally(() => console.log("all_events")),
				),
				matchingRanks,
				notOnCooldown,
			},
			{ concurrency: "unbounded" },
		);

		return await Effect.runPromise(res);
	})
	.get("/log", async () => {
		return await db
			.selectFrom("TriggerLog")
			.innerJoin("Trigger", "Trigger.id", "TriggerLog.trigger_id")
			.leftJoin("SentEmail", "SentEmail.id", "TriggerLog.sent_email_id")
			.select([
				"TriggerLog.id",
				"Trigger.icon",
				"Trigger.name",
				"TriggerLog.createdAt",
				"SentEmail.emailRecipient",
				"TriggerLog.instagram_id",
				"SentEmail.mixMaxEmailId",
			])
			.orderBy("createdAt", "desc")
			.limit(100)
			.execute();
	})
	.post(
		"/params",
		async ({ body: { id, params } }) => {
			await db
				.updateTable("Trigger")
				.set({ params })
				.where("id", "=", id)
				.execute();
		},
		{
			body: t.Object({
				id: t.Number(),
				params: t.Unknown(),
			}),
		},
	)
	.post(
		"/active",
		async ({ body: { id, active } }) => {
			await db
				.updateTable("Trigger")
				.set({ active })
				.where("id", "=", id)
				.execute();
		},
		{
			body: t.Object({
				id: t.Number(),
				active: t.Boolean(),
			}),
		},
	)
	.post(
		"/rank",
		async ({ body: { id, rank } }) => {
			await db
				.updateTable("Trigger")
				.set({ rank })
				.where("id", "=", id)
				.execute();
		},
		{
			body: t.Object({
				id: t.Number(),
				rank: t.Number(),
			}),
		},
	)
	.post(
		"/maxPerDay",
		async ({ body: { id, maxPerDay } }) => {
			await db
				.updateTable("Trigger")
				.set({ maxPerDay })
				.where("id", "=", id)
				.execute();
		},
		{
			body: t.Object({
				id: t.Number(),
				maxPerDay: t.Number(),
			}),
		},
	)
	.post(
		"/cooldown",
		async ({ body: { id, cooldown } }) => {
			await db
				.updateTable("Trigger")
				.set({ cooldown: cooldown })
				.where("id", "=", id)
				.execute();
		},
		{
			body: t.Object({
				id: t.Number(),
				cooldown: t.Number(),
			}),
		},
	)
	//
	.post(
		"/cooldown/global",
		async ({ body: { cooldown, scraping_frequency } }) => {
			await set_settings("emailCoolDownDays", cooldown);
			await set_settings("scraping_frequency", scraping_frequency);
		},
		{
			body: t.Object({
				cooldown: t.Number(),
				scraping_frequency: t.Number(),
			}),
		},
	)
	// get global cooldown
	.get("/cooldown/global", async () => {
		const settings = await get_settings([
			"scraping_frequency",
			"emailCoolDownDays",
		]);
		const scraping_frequency = Number.parseInt(settings.scraping_frequency);
		const emailCoolDownDays = Number.parseInt(settings.emailCoolDownDays);
		return {
			cooldown: emailCoolDownDays,
			scraping_frequency,
		};
	})
	// get sequences per token
	.get(
		"/sequences",
		() => Object.values(instantlyCampaigns) as InstantlyCampaign[],
	);

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//============================================================\\
//                       QUERY HELPERS                        \\
//============================================================\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\

function getTriggersCounts(
	x: {
		lastSentOpener: Date | null;
		bitmap: number;
		count: number;
		activeCampaignId: string | null;
	}[],
	triggers: {
		trigger_group_id: number;
		id: number;
	}[],
	opener2Count?: number,
	opener3Count?: number,
) {
	const result = {
		[BitmapTrigger.Opener]: 0,
		[BitmapTrigger.HiddenLikes]: 0,
		[BitmapTrigger.FollowingIncrease]: 0,
		[BitmapTrigger.FollowerLoss]: 0,
		[BitmapTrigger.Opener2]: 0,
		[BitmapTrigger.Opener3]: 0,
		[BitmapTrigger.HiddenLikes2]: 0,
		[BitmapTrigger.FollowerLoss2]: 0,
		[BitmapTrigger.FollowingChange2]: 0,
		[BitmapTrigger.HiddenLikes3]: 0,
		[BitmapTrigger.FollowingChange3]: 0,
		[BitmapTrigger.FollowerDrop3]: 0,
	} satisfies Record<BitmapTrigger, number>;

	for (const { bitmap, count, lastSentOpener, activeCampaignId } of x) {
		// Opener
		if (!isBitSet(bitmap, BitmapTrigger.Opener)) {
			result[BitmapTrigger.Opener] += count;
		}

		// triggers
		if (
			lastSentOpener &&
			activeCampaignId === instantlyCampaigns["🇩🇪 Campaign 1"].id
		) {
			if (!isBitSet(bitmap, BitmapTrigger.HiddenLikes)) {
				result[BitmapTrigger.HiddenLikes] += count;
			}
			if (!isBitSet(bitmap, BitmapTrigger.FollowingIncrease)) {
				result[BitmapTrigger.FollowingIncrease] += count;
			}
			if (!isBitSet(bitmap, BitmapTrigger.FollowerLoss)) {
				result[BitmapTrigger.FollowerLoss] += count;
			}
		}

		// Opener2
		if (!isBitSet(bitmap, BitmapTrigger.Opener2) && lastSentOpener) {
			result[BitmapTrigger.Opener2] += count;
		}

		// Only count these if Opener2 is set
		if (
			isBitSet(bitmap, BitmapTrigger.Opener2) &&
			activeCampaignId === instantlyCampaigns["🇩🇪 Campaign 2"].id
		) {
			if (!isBitSet(bitmap, BitmapTrigger.HiddenLikes2)) {
				result[BitmapTrigger.HiddenLikes2] += count;
			}
			if (!isBitSet(bitmap, BitmapTrigger.FollowerLoss2)) {
				result[BitmapTrigger.FollowerLoss2] += count;
			}
			if (!isBitSet(bitmap, BitmapTrigger.FollowingChange2)) {
				result[BitmapTrigger.FollowingChange2] += count;
			}
		}

		// Opener3
		if (isBitSet(bitmap, BitmapTrigger.Opener2)) {
			result[BitmapTrigger.Opener3] += count;
		}

		// Only count these if Opener3 is set
		if (
			isBitSet(bitmap, BitmapTrigger.Opener3) &&
			activeCampaignId === instantlyCampaigns["🇩🇪 Campaign 3"].id
		) {
			if (!isBitSet(bitmap, BitmapTrigger.HiddenLikes3)) {
				result[BitmapTrigger.HiddenLikes3] += count;
			}
			if (!isBitSet(bitmap, BitmapTrigger.FollowingChange3)) {
				result[BitmapTrigger.FollowingChange3] += count;
			}
			if (!isBitSet(bitmap, BitmapTrigger.FollowerDrop3)) {
				result[BitmapTrigger.FollowerDrop3] += count;
			}
			if (!isBitSet(bitmap, BitmapTrigger.FollowerDrop3)) {
				result[BitmapTrigger.FollowerDrop3] += count;
			}
		}
	}

	if (opener2Count !== undefined) {
		result[BitmapTrigger.Opener2] = opener2Count;
	}

	if (opener3Count !== undefined) {
		result[BitmapTrigger.Opener3] = opener3Count;
	}

	return triggers.map((trigger) => {
		const count = result[trigger.trigger_group_id as BitmapTrigger];
		return {
			id: trigger.id,
			active_targets: count,
		};
	});
}
