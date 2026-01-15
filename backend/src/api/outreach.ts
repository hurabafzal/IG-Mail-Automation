import { Elysia, t } from "elysia";
import { sql } from "kysely";
import cache from "../cache";
import { db } from "../db";
import type {
	CandidateApproval,
	InstagramAccountSource,
	Lang,
} from "../db/db_types";
import { env } from "../env";
import {
	COUNTRY_GROUPS,
	type InstantlyCampaign,
	instantlyCampaigns,
} from "../utils/consts";
import { daysAgo } from "../utils/daysAgo";

export type Company = {
	id: string;
	username: string;
	lastSentEmail: number | null;
	selectedEmail: string | null;
	website: string | null;
	email: string | null;
	email_status: string | null;
	followers: number | null;
	followers_diff: number | null;
	following: number | null;
	following_diff: number | null;
	post_count: number | null;
	post_diff: number | null;
	days_diff: number | null;
	country: string | null;
	first_name: string | null;
	business_name: string | null;
	approved: CandidateApproval;
	use_for_training: boolean;
	niche: string | null;
	source: InstagramAccountSource;
	account_created_at: string | null;
	found_on: string;
	bio: string;
	full_name: string;
	approve_count: number;
};

const emailCodes = [
	"Not Verified Yet", // 0
	"Syntax", // 1
	"Spam Trap", // 2
	"Disposable", // 3
	"Accept All", // 4
	"Deliverable", // 5
	"Bounce", // 6
	"Unknown", // 7
	"Blacklisted", // 8
] as const;

export const notOnCooldownQuery = (
	coolDownAgo: Date,
	lang: Lang | "all",
	foundName: "yes" | "no" = "yes",
) => {
	const country_group =
		lang !== "all" ? COUNTRY_GROUPS.find((c) => c.id === lang) : undefined;

	return (
		db
			.selectFrom("InstagramAccountBase")
			.innerJoin("Email", "InstagramAccountBase.id", "Email.instagram_id")
			.where("Email.code", "<>", 6)
			.where("Email.code", "<>", 7)
			.where("Email.server_host_type", "<>", "RZONE")
			.where("blacklist", "=", false)
			.where("last_updated", ">", daysAgo(30)) // data should be recent
			.where("first_name", "is not", null)
			.$if(foundName === "yes", (qb) =>
				qb.where("first_name", "!=", "No name found"),
			)
			.$if(
				foundName === "no",
				(qb) => qb.where("business_name", "!=", "No name found"),
				// .where("first_name", "=", "No name found"),
			)
			.where("niche", "!=", "no niche found")
			// trigger cooldown passed
			.where((qb) =>
				qb.or([
					qb("lastSentEmail", "<", coolDownAgo),
					qb("lastSentEmail", "is", null),
				]),
			)
			.where("followers_count", ">", 7_000)
			.where("followers_count", "<", 100_000)
			.$if(lang !== "all", (qb) =>
				country_group?.bioLanguage !== undefined
					? qb
							.where("bio_language", "=", country_group.bioLanguage)
							.where(
								"InstagramAccountBase.country",
								"in",
								country_group?.countries ?? [],
							)
					: qb.where(
							"InstagramAccountBase.country",
							"in",
							country_group?.countries ?? [],
						),
			)
			.$if(lang === "all", (qb) =>
				qb.where((oc) =>
					oc.or(
						COUNTRY_GROUPS.map((c) =>
							c.bioLanguage !== undefined
								? oc.and([
										oc("bio_language", "=", c.bioLanguage),
										oc("country", "in", c.countries),
									])
								: oc("country", "in", c.countries),
						),
					),
				),
			)
	);
};

const getApproveCounter = (tabPage: "pending" | "approved" | "rejected") => {
	switch (tabPage) {
		case "approved":
			return 1;
		default:
			return 0;
	}
};
export const outreachRouter = new Elysia({ prefix: "/api/outreach" })
	// .get("/tasks", () => runPromise(q))
	.post(
		"/edit",
		async ({ body: { id, isBusiness, name, useForTraining } }) => {
			if (env.NODE_ENV === "development") return;
			const prev = await db
				.selectFrom("InstagramAccountBase")
				.select(["first_name", "business_name"])
				.where("id", "=", id)
				.executeTakeFirst();

			await db
				.updateTable("InstagramAccountBase")
				.set({
					first_name: !isBusiness ? name : "No name found",
					business_name: isBusiness ? name : null,
					use_for_training: useForTraining,
					approved: "APPROVED",
					approved_at: new Date(),
					edited_at: new Date(),
					previous_name: `{"first_name": "${prev?.first_name}", "business_name": "${prev?.business_name}"}`,
				})
				.where("id", "=", id)
				.execute();
		},
		{
			body: t.Object({
				id: t.String(),
				name: t.String(),
				isBusiness: t.Boolean(),
				useForTraining: t.Boolean(),
			}),
		},
	)
	.post(
		"/approve",
		async ({ body: { id } }) => {
			// if (env.NODE_ENV === "development") return;
			await db
				.updateTable("InstagramAccountBase")
				.set((eb) => ({
					approved: "APPROVED",
					approve_counter: eb("approve_counter", "+", 1),
					approved_at: new Date(),
				}))
				.where("id", "=", id)
				.execute();
		},
		{
			body: t.Object({
				id: t.String(),
			}),
		},
	)
	.post(
		"/approve/many",
		async ({ body: { ids } }) => {
			if (env.NODE_ENV === "development") return;
			await db
				.updateTable("InstagramAccountBase")
				.set((oc) => ({
					approved: "APPROVED",
					approve_counter: oc("approve_counter", "+", 1),
					approved_at: new Date(),
				}))
				.where("id", "in", ids)
				.execute();
		},
		{
			body: t.Object({
				ids: t.Array(t.String()),
			}),
		},
	)
	.post(
		"/reject",
		async ({ body: { id } }) => {
			if (env.NODE_ENV === "development") return;
			await db
				.updateTable("InstagramAccountBase")
				.set({
					approved: "REJECTED",
					approved_at: new Date(),
				})
				.where("id", "=", id)
				.execute();
		},
		{
			body: t.Object({
				id: t.String(),
			}),
		},
	)
	.post(
		"/leads",
		async ({ body: { tabPage, lang, foundName } }) => {
			try {
				console.log("Getting leads");
				const start = Date.now();

				const x = await cache.settings.get(["emailCoolDownDays"]);
				const globalCooldownDays = Number.parseInt(x.emailCoolDownDays);
				const coolDownAgo = new Date(
					Date.now() - globalCooldownDays * 24 * 60 * 60 * 1000,
				);

				const approve_count = getApproveCounter(tabPage);

				const ids = await notOnCooldownQuery(coolDownAgo, lang, foundName)
					.where(
						"InstagramAccountBase.approved",
						"=",
						tabPage === "pending"
							? "PENDING"
							: tabPage === "approved"
								? "APPROVED"
								: "REJECTED",
					)
					.where("InstagramAccountBase.approve_counter", "=", approve_count)
					.select([
						sql<string>`distinct "InstagramAccountBase".id`.as("user_id"),
						"InstagramAccountBase.created_at",
						// "InstagramAccountBase.approved_at",
					])
					// .$if(tabPage === "approved", (qb) =>
					// 	qb.orderBy("InstagramAccountBase.approved_at", "desc"),
					// )
					.orderBy("InstagramAccountBase.created_at", "desc")
					.limit(2000)
					.execute();

				const countsQ = await notOnCooldownQuery(coolDownAgo, lang, foundName)
					.where(
						"InstagramAccountBase.approved",
						"=",
						tabPage === "pending"
							? "PENDING"
							: tabPage === "approved"
								? "APPROVED"
								: "REJECTED",
					)
					.where("InstagramAccountBase.approve_counter", "=", approve_count)
					.select((qb) =>
						qb.fn.count("InstagramAccountBase.id").distinct().as("count"),
					)
					.executeTakeFirstOrThrow();

				const dQ = db
					.with("latest_history", (db) =>
						db
							.selectFrom("IGHistoryTable")
							.distinctOn("IGHistoryTable.user_id")
							.select([
								"IGHistoryTable.user_id",

								"IGHistoryTable.followers",
								"IGHistoryTable.postsCount",
								"IGHistoryTable.following",
								"IGHistoryTable.day",

								sql<
									number | null
								>`("followers" - LAG("followers") OVER (PARTITION BY "IGHistoryTable".user_id ORDER BY "day"))`.as(
									"followers_diff",
								),

								sql<
									number | null
								>`("postsCount" - LAG("postsCount") OVER (PARTITION BY "IGHistoryTable".user_id ORDER BY "day"))`.as(
									"posts_diff",
								),

								sql<
									number | null
								>`("following" - LAG("following") OVER (PARTITION BY "IGHistoryTable".user_id ORDER BY "day"))`.as(
									"following_diff",
								),

								sql<
									number | null
								>`("day" - LAG("day") OVER (PARTITION BY "IGHistoryTable".user_id ORDER BY "day"))`.as(
									"day_diff",
								),
							])
							.where(
								"user_id",
								"in",
								ids.map((x) => x.user_id),
							)
							.orderBy("IGHistoryTable.user_id")
							.orderBy("IGHistoryTable.day", "desc"),
					)
					.with("thing", (db) =>
						db
							.selectFrom("InstagramAccountBase")
							.leftJoin(
								"InitialInstagramAccount",
								"InitialInstagramAccount.username",
								"InstagramAccountBase.username",
							)
							.innerJoin(
								"latest_history",
								"InstagramAccountBase.id",
								"latest_history.user_id",
							)
							.innerJoin(
								"Email",
								"Email.instagram_id",
								"InstagramAccountBase.id",
							)
							.distinctOn("latest_history.user_id")
							.select([
								"InstagramAccountBase.id",
								"InitialInstagramAccount.source_type",
								"InstagramAccountBase.lastSentEmail",
								"InstagramAccountBase.first_name",
								"InstagramAccountBase.business_name",
								"InstagramAccountBase.approved",
								"InstagramAccountBase.use_for_training",
								"InstagramAccountBase.niche",
								"InstagramAccountBase.country",
								"InstagramAccountBase.real_country",
								"Email.code",
								"Email.email",
								"InstagramAccountBase.account_created_at",
								"InstagramAccountBase.username",
								"InstagramAccountBase.ig_category_enum",
								"InstagramAccountBase.external_link",
								"InstagramAccountBase.bio",
								"InstagramAccountBase.ig_full_name",
								"InstagramAccountBase.created_at",
								"InstagramAccountBase.approve_counter",

								"latest_history.user_id",
								"latest_history.followers",
								"latest_history.postsCount",
								"latest_history.following",
								"latest_history.day",
								"latest_history.day_diff",
								"latest_history.followers_diff",
								"latest_history.posts_diff",
								"latest_history.following_diff",
							]),
					)
					.selectFrom("thing");

				const [d, counts] = await Promise.all([
					dQ.selectAll().limit(100).execute(),
					countsQ,
				]);
				const end = Date.now();
				console.log(`Took ${end - start}ms`);
				console.log("Counts", counts, d.length);

				return {
					candidates: d.map(
						(c) =>
							({
								id: c.id,
								email: c.email,
								email_status: emailCodes[c.code ?? 0],
								followers: Math.ceil(c.followers / 1000),
								followers_diff: c.followers_diff,
								following: c.following,
								following_diff: c.following_diff,
								// should be days since last email
								lastSentEmail: !c.lastSentEmail
									? null
									: Math.floor(
											(Date.now() - c.lastSentEmail.getTime()) /
												(1000 * 60 * 60 * 24),
										),
								post_count: c.postsCount,
								post_diff: c.posts_diff,
								days_diff: c.day_diff,
								source: c.source_type ?? "COMMENTS",
								username: c.username,
								website: c.external_link,
								selectedEmail: null,
								country:
									c.country === "GERMAN_CAPTIONS" && c.real_country
										? c.real_country
										: c.country,
								first_name: c.first_name,
								business_name: c.business_name,
								approved: c.approved,
								use_for_training: c.use_for_training,
								niche: c.niche,
								account_created_at: c.account_created_at?.split(" ")[1] ?? "",
								found_on: c.created_at.toISOString().split("T")[0],
								bio: c.bio,
								full_name: c.ig_full_name,
								approve_count: c.approve_counter,
							}) satisfies Company,
					),
					count: counts.count as number,
				};
			} catch (e) {
				console.error(e);
				throw e;
			}
		},
		{
			body: t.Object({
				show_diffs: t.Boolean(),
				tabPage: t.Union([
					t.Literal("pending"),
					t.Literal("approved"),
					t.Literal("rejected"),
				]),
				lang: t.Union(COUNTRY_GROUPS.map((c) => t.Literal(c.id))),
				foundName: t.Union([t.Literal("yes"), t.Literal("no")]),
			}),
		},
	)
	.get(
		"/sequences",
		() => Object.values(instantlyCampaigns) as InstantlyCampaign[],
	)
	.get("/email/vars", async () => {
		const varsRaw = await db
			.selectFrom("EmailVariables")
			.selectAll()
			.orderBy("id")
			.execute();
		// need to group them by minFollowerCount
		type FollowerRanges = {
			minFollowerCount: number;
			settings: {
				name: string;
				value: string;
			}[];
		}[];
		return varsRaw.reduce((acc, cur) => {
			const index = acc.findIndex(
				(e) => e.minFollowerCount === cur.minFollowerCount,
			);
			if (index !== -1) {
				acc[index].settings.push({
					name: cur.name,
					value: cur.value,
				});
			} else {
				acc.push({
					minFollowerCount: cur.minFollowerCount,
					settings: [{ name: cur.name, value: cur.value }],
				});
			}
			return acc;
		}, [] as FollowerRanges);
	})
	.post(
		"/email/vars",
		async (req) => {
			await db
				.insertInto("EmailVariables")
				.values(
					req.body.followerRanges.flatMap((e) =>
						e.settings.map((s) => ({
							...s,
							minFollowerCount: e.minFollowerCount,
						})),
					),
				)
				.onConflict((eb) =>
					eb.columns(["minFollowerCount", "name"]).doUpdateSet((oc) => ({
						value: oc.ref("excluded.value"),
					})),
				)
				.execute();
		},
		{
			body: t.Object({
				followerRanges: t.Array(
					t.Object({
						minFollowerCount: t.Number(),
						settings: t.Array(
							t.Object({
								name: t.String(),
								value: t.String(),
							}),
						),
					}),
				),
			}),
		},
	);

//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
//============================================================\\
//                       QUERY HELPERS                        \\
//============================================================\\
//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
