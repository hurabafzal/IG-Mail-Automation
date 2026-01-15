import { Effect } from "effect";
import Elysia from "elysia";
import { t } from "elysia";
import { sql } from "kysely";
import cache from "../cache";
import { db } from "../db";
import { ACTIVE_COUNTRIES } from "../utils/consts";
import { daysAgo } from "../utils/daysAgo";
import { notOnCooldownQuery } from "./outreach";

type EmailStatus = {
	Syntax: number;
	SpamTrap: number;
	Disposable: number;
	AcceptAll: number;
	Deliverable: number;
	Bounce: number;
	Unknown: number;
	NotVerifiedYet: number;
	Blacklisted: number;
};

const emailStatusKeys = [
	"Syntax",
	"SpamTrap",
	"Disposable",
	"AcceptAll",
	"Deliverable",
	"Bounce",
	"Unknown",
	"NotVerifiedYet",
	"Blacklisted", // 8
] as const;

type Counts = {
	count: number;
	date: string;
}[];

export const dashboardRouter = new Elysia({ prefix: "/api/dashboard" })
	.get("/overview/counts", async () => {
		const x = await cache.settings.get(["emailCoolDownDays"]);
		const globalCooldownDays = Number.parseInt(x.emailCoolDownDays);
		const coolDownAgo = new Date(
			Date.now() - globalCooldownDays * 24 * 60 * 60 * 1000,
		);

		const program = Effect.all(
			{
				usernames: Effect.tryPromise(() =>
					db
						.selectFrom("total_daily_count")
						.select(sql<number>`SUM(count)::int`.as("usernames"))
						.executeTakeFirstOrThrow()
						.then((x) => x.usernames),
				),
				active_targets: Effect.tryPromise(() =>
					db
						.selectFrom("leads")
						.where("country", "in", ACTIVE_COUNTRIES)
						.select(sql<number>`COUNT(*)::int`.as("active_targets"))
						.executeTakeFirstOrThrow()
						.then((x) => x.active_targets),
				),
				targets: Effect.tryPromise(() =>
					db
						.selectFrom("target_daily_counts")
						.select(sql<number>`SUM(count)`.as("targets"))
						.executeTakeFirstOrThrow()
						.then((x) => x.targets),
				),
				not_cooldown: Effect.tryPromise(() =>
					notOnCooldownQuery(coolDownAgo, "DE")
						.select((qb) =>
							qb.fn
								.count("InstagramAccountBase.id")
								.distinct()
								.as("not_cooldown"),
						)
						.executeTakeFirstOrThrow()
						.then((x) => x.not_cooldown as number),
				),
			},
			{ concurrency: "unbounded" },
		);

		const result = await Effect.runPromise(program);
		return result;
	})
	.get("/overview/email-distribution", async () => {
		const emailCodes = await db
			.selectFrom("Email")
			.groupBy("Email.code")
			.select([sql<number>`COUNT("Email".code)::int`.as("count"), "Email.code"])
			.execute();

		const notVerifiedYet = await db
			.selectFrom("Email")
			.select(sql<number>`COUNT(*)::int`.as("count"))
			.where("code", "is", null)
			.executeTakeFirstOrThrow();

		const emailStatus = {
			Syntax: emailCodes.find((e) => e.code === 1)?.count ?? 1,
			SpamTrap: emailCodes.find((e) => e.code === 2)?.count ?? 1,
			Disposable: emailCodes.find((e) => e.code === 3)?.count ?? 1,
			AcceptAll: emailCodes.find((e) => e.code === 4)?.count ?? 1,
			Deliverable: emailCodes.find((e) => e.code === 5)?.count ?? 1,
			Bounce: emailCodes.find((e) => e.code === 6)?.count ?? 1,
			Unknown: emailCodes.find((e) => e.code === 7)?.count ?? 1,
			NotVerifiedYet: notVerifiedYet.count,
			Blacklisted: emailCodes.find((e) => e.code === 8)?.count ?? 0,
		} satisfies EmailStatus;

		const sumPie = Object.values(emailStatus).reduce((a, b) => a + b, 0);
		const otherSum =
			emailStatus.Bounce +
			emailStatus.SpamTrap +
			emailStatus.Disposable +
			emailStatus.Syntax;

		const emailPieData = [
			{
				name: "Accept-All",
				value: emailStatus.AcceptAll,
				percent: emailStatus.AcceptAll / sumPie,
			},
			{
				name: "Deliverable",
				value: emailStatus.Deliverable,
				percent: emailStatus.Deliverable / sumPie,
			},
			{
				name: "Unknown",
				value: emailStatus.Unknown,
				percent: emailStatus.Unknown / sumPie,
			},
			{
				name: "Not Verified Yet",
				value: emailStatus.NotVerifiedYet,
				percent: emailStatus.NotVerifiedYet / sumPie,
			},
			{ name: "Other", value: otherSum, percent: otherSum / sumPie },
		];
		emailPieData.sort((a, b) => b.value - a.value);

		return emailPieData;
	})
	.get(
		"/overview/daily-counts",
		async ({ query }) => {
			const year = Number(query.year);
			const month = Number(query.month);

			const countsPerDay = await db
				.selectFrom("leads")
				.where("country", "in", ACTIVE_COUNTRIES)
				.where(sql`EXTRACT(YEAR FROM created_at)`, "=", year)
				.where(sql`EXTRACT(MONTH FROM created_at)`, "=", month)
				.select([
					sql<string>`DATE(created_at)`.as("date"),
					sql<number>`COUNT(*)::int`.as("count"),
				])
				.groupBy(sql<string>`DATE(created_at)`)
				.execute();

			return countsPerDay;
		},
		{
			query: t.Object({
				year: t.Numeric(),
				month: t.Numeric(),
			}),
		},
	)
	.get(
		"/overview/country-counts",
		async ({ query }) => {
			const year = Number(query.year);
			const month = Number(query.month);

			const countryCountsPerDay = await db
				.selectFrom("InstagramAccountBase")
				.where("InstagramAccountBase.country", "in", ACTIVE_COUNTRIES)
				.where(
					sql`EXTRACT(YEAR FROM "InstagramAccountBase".created_at)`,
					"=",
					year,
				)
				.where(
					sql`EXTRACT(MONTH FROM "InstagramAccountBase".created_at)`,
					"=",
					month,
				)
				.select([
					sql<string>`DATE("InstagramAccountBase".created_at)`.as("date"),
					sql<number>`COUNT(DISTINCT "InstagramAccountBase".id)::int`.as(
						"count",
					),
				])
				.groupBy(sql<string>`DATE("InstagramAccountBase".created_at)`)
				.execute();

			return countryCountsPerDay;
		},
		{
			query: t.Object({
				year: t.Numeric(),
				month: t.Numeric(),
			}),
		},
	)
	.get(
		"/overview/all-counts",
		async ({ query }) => {
			const year = Number(query.year);
			const month = Number(query.month);

			const allCountsPerDay = await db
				.selectFrom("total_daily_count")
				.where(sql`EXTRACT(YEAR FROM bucket)`, "=", year)
				.where(sql`EXTRACT(MONTH FROM bucket)`, "=", month)
				.select([sql<string>`DATE(bucket)`.as("date"), "count"])
				.execute();

			return allCountsPerDay;
		},
		{
			query: t.Object({
				year: t.Numeric(),
				month: t.Numeric(),
			}),
		},
	)
	// Leads dashboard endpoints
	.get("/leads/counts", async () => {
		const x = await cache.settings.get(["emailCoolDownDays"]);
		const globalCooldownDays = Number.parseInt(x.emailCoolDownDays);
		const coolDownAgo = new Date(
			Date.now() - globalCooldownDays * 24 * 60 * 60 * 1000,
		);

		const program = Effect.all(
			{
				total: Effect.tryPromise(() =>
					db
						.selectFrom("EmailSequence")
						.innerJoin(
							"InstagramAccountBase",
							"EmailSequence.instagram_account_id",
							"InstagramAccountBase.id",
						)
						.where("InstagramAccountBase.first_name", "is not", null)
						.where("InstagramAccountBase.first_name", "!=", "No name found")
						.where("EmailSequence.email", "is not", null)
						.where("EmailSequence.email", "!=", "")
						.select(
							sql<number>`COUNT(DISTINCT "EmailSequence".id)::int`.as("total"),
						)
						.executeTakeFirstOrThrow()
						.then((x) => x.total),
				),
				not_cooldown: Effect.tryPromise(() =>
					notOnCooldownQuery(coolDownAgo, "all")
						.select((qb) =>
							qb.fn
								.count("InstagramAccountBase.id")
								.distinct()
								.as("not_cooldown"),
						)
						.executeTakeFirstOrThrow()
						.then((x) => x.not_cooldown as number),
				),
				blacklisted: Effect.tryPromise(() =>
					db
						.selectFrom("EmailSequence")
						.innerJoin(
							"InstagramAccountBase",
							"EmailSequence.instagram_account_id",
							"InstagramAccountBase.id",
						)
						.innerJoin("Email", "EmailSequence.email", "Email.email")
						.where("InstagramAccountBase.first_name", "is not", null)
						.where("InstagramAccountBase.first_name", "!=", "No name found")
						.where("EmailSequence.email", "is not", null)
						.where("EmailSequence.email", "!=", "")
						.where((eb) =>
							eb.or([
								eb("Email.blacklisted_at", "is not", null),
								eb("InstagramAccountBase.blacklist", "=", true),
							]),
						)
						.select(
							sql<number>`COUNT(DISTINCT "EmailSequence".id)::int`.as(
								"blacklisted",
							),
						)
						.executeTakeFirstOrThrow()
						.then((x) => x.blacklisted),
				),
				avg_contacts: Effect.tryPromise(() =>
					db
						.selectFrom((qb) =>
							qb
								.selectFrom("EmailSequence")
								.innerJoin(
									"InstagramAccountBase",
									"EmailSequence.instagram_account_id",
									"InstagramAccountBase.id",
								)
								.where("InstagramAccountBase.first_name", "is not", null)
								.where("InstagramAccountBase.first_name", "!=", "No name found")
								.where("EmailSequence.email", "is not", null)
								.where("EmailSequence.email", "!=", "")
								.leftJoin(
									"InstantlyLead",
									"EmailSequence.id",
									"InstantlyLead.email_sequence_id",
								)
								.select([
									"EmailSequence.id",
									sql<number>`COUNT("InstantlyLead".id)::int`.as(
										"contact_count",
									),
								])
								.groupBy("EmailSequence.id")
								.as("subquery"),
						)
						.select(
							sql<number>`COALESCE(AVG(contact_count), 0)::numeric`.as(
								"avg_contacts",
							),
						)
						.executeTakeFirstOrThrow()
						.then((x) => Number.parseFloat(x.avg_contacts.toString())),
				),
			},
			{ concurrency: "unbounded" },
		);

		const result = await Effect.runPromise(program);
		return result;
	})
	.get("/leads/by-country", async () => {
		const x = await cache.settings.get(["emailCoolDownDays"]);
		const globalCooldownDays = Number.parseInt(x.emailCoolDownDays);
		const coolDownAgo = new Date(
			Date.now() - globalCooldownDays * 24 * 60 * 60 * 1000,
		);

		// Get total leads per country
		const totalLeads = await db
			.selectFrom("EmailSequence")
			.innerJoin(
				"InstagramAccountBase",
				"EmailSequence.instagram_account_id",
				"InstagramAccountBase.id",
			)
			.where("InstagramAccountBase.first_name", "is not", null)
			.where("InstagramAccountBase.first_name", "!=", "No name found")
			.where("EmailSequence.email", "is not", null)
			.where("EmailSequence.email", "!=", "")
			.select([
				sql<string>`COALESCE("InstagramAccountBase".country, 'Unknown')`.as(
					"country",
				),
				sql<number>`COUNT(DISTINCT "EmailSequence".id)::int`.as("total"),
			])
			.groupBy("InstagramAccountBase.country")
			.execute();

		// Get not cooldown per country
		const notCooldownByCountry = await db
			.selectFrom("InstagramAccountBase")
			.innerJoin("Email", "InstagramAccountBase.id", "Email.instagram_id")
			.where("Email.code", "<>", 6)
			.where("Email.code", "<>", 7)
			.where("Email.server_host_type", "<>", "RZONE")
			.where("blacklist", "=", false)
			.where("last_updated", ">", daysAgo(30))
			.where("first_name", "is not", null)
			.where("first_name", "!=", "No name found")
			.where("niche", "!=", "no niche found")
			.where((qb) =>
				qb.or([
					qb("lastSentEmail", "<", coolDownAgo),
					qb("lastSentEmail", "is", null),
				]),
			)
			.where("followers_count", ">", 7_000)
			.where("followers_count", "<", 100_000)
			.select([
				sql<string>`COALESCE("InstagramAccountBase".country, 'Unknown')`.as(
					"country",
				),
				sql<number>`COUNT(DISTINCT "InstagramAccountBase".id)::int`.as(
					"not_cooldown",
				),
			])
			.groupBy("InstagramAccountBase.country")
			.execute();

		// Get blacklisted per country
		const blacklistedByCountry = await db
			.selectFrom("EmailSequence")
			.innerJoin(
				"InstagramAccountBase",
				"EmailSequence.instagram_account_id",
				"InstagramAccountBase.id",
			)
			.innerJoin("Email", "EmailSequence.email", "Email.email")
			.where("InstagramAccountBase.first_name", "is not", null)
			.where("InstagramAccountBase.first_name", "!=", "No name found")
			.where("EmailSequence.email", "is not", null)
			.where("EmailSequence.email", "!=", "")
			.where((eb) =>
				eb.or([
					eb("Email.blacklisted_at", "is not", null),
					eb("InstagramAccountBase.blacklist", "=", true),
				]),
			)
			.select([
				sql<string>`COALESCE("InstagramAccountBase".country, 'Unknown')`.as(
					"country",
				),
				sql<number>`COUNT(DISTINCT "EmailSequence".id)::int`.as("blacklisted"),
			])
			.groupBy("InstagramAccountBase.country")
			.execute();

		// Get avg contacts per country
		const avgContactsByCountry = await db
			.selectFrom((qb) =>
				qb
					.selectFrom("EmailSequence")
					.innerJoin(
						"InstagramAccountBase",
						"EmailSequence.instagram_account_id",
						"InstagramAccountBase.id",
					)
					.where("InstagramAccountBase.first_name", "is not", null)
					.where("InstagramAccountBase.first_name", "!=", "No name found")
					.where("EmailSequence.email", "is not", null)
					.where("EmailSequence.email", "!=", "")
					.leftJoin(
						"InstantlyLead",
						"EmailSequence.id",
						"InstantlyLead.email_sequence_id",
					)
					.select([
						sql<string>`COALESCE("InstagramAccountBase".country, 'Unknown')`.as(
							"country",
						),
						"EmailSequence.id",
						sql<number>`COUNT("InstantlyLead".id)::int`.as("contact_count"),
					])
					.groupBy(["InstagramAccountBase.country", "EmailSequence.id"])
					.as("subquery"),
			)
			.select([
				"country",
				sql<number>`COALESCE(AVG(contact_count), 0)::numeric`.as(
					"avg_contacts",
				),
			])
			.groupBy("country")
			.execute();

		// Combine all data
		const countries = new Set<string>();
		for (const r of totalLeads) {
			countries.add(r.country);
		}
		for (const r of notCooldownByCountry) {
			countries.add(r.country);
		}
		for (const r of blacklistedByCountry) {
			countries.add(r.country);
		}
		for (const r of avgContactsByCountry) {
			countries.add(r.country);
		}

		const result = Array.from(countries).map((country) => {
			const total = totalLeads.find((r) => r.country === country)?.total ?? 0;
			const notCooldown =
				notCooldownByCountry.find((r) => r.country === country)?.not_cooldown ??
				0;
			const blacklisted =
				blacklistedByCountry.find((r) => r.country === country)?.blacklisted ??
				0;
			const avgContacts =
				avgContactsByCountry.find((r) => r.country === country)?.avg_contacts ??
				"0";
			return {
				country,
				total,
				not_cooldown: notCooldown,
				blacklisted,
				avg_contacts: Number.parseFloat(avgContacts.toString()),
			};
		});

		return result.sort((a, b) => b.total - a.total);
	})
	.get("/leads/by-campaign", async () => {
		const campaignMapping: Record<string, string> = {
			OPENER_PENDING_GENERATION: "Opener",
			OPENER_PENDING_SEND: "Opener",
			TRIGGER_EMAIL_PENDING_GENERATION: "Campaign 1",
			TRIGGER_EMAIL_PENDING_SEND: "Campaign 1",
			TRIGGER_EMAIL_SENT_AWAITING_COMPLETION: "Campaign 1",
			TRIGGER_EMAIL_COMPLETED: "Campaign 2",
		};

		const campaignData = await db
			.selectFrom("EmailSequence")
			.innerJoin(
				"InstagramAccountBase",
				"EmailSequence.instagram_account_id",
				"InstagramAccountBase.id",
			)
			.where("InstagramAccountBase.first_name", "is not", null)
			.where("InstagramAccountBase.first_name", "!=", "No name found")
			.where("EmailSequence.email", "is not", null)
			.where("EmailSequence.email", "!=", "")
			.select([
				sql<string>`COALESCE("InstagramAccountBase".country, 'Unknown')`.as(
					"country",
				),
				"EmailSequence.current_stage",
				sql<number>`COUNT(DISTINCT "EmailSequence".id)::int`.as("count"),
			])
			.groupBy(["InstagramAccountBase.country", "EmailSequence.current_stage"])
			.execute();

		const result = campaignData.map((row) => {
			const campaign =
				campaignMapping[row.current_stage] || `Other (${row.current_stage})`;
			return {
				country: row.country,
				campaign,
				count: row.count,
			};
		});

		return result;
	})
	.get(
		"/leads/daily",
		async ({ query }) => {
			const days = Number(query.days) || 30;
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - days);

			const dailyLeads = await db
				.selectFrom("EmailSequence")
				.innerJoin(
					"InstagramAccountBase",
					"EmailSequence.instagram_account_id",
					"InstagramAccountBase.id",
				)
				.where("EmailSequence.created_at", ">=", cutoffDate)
				.where("InstagramAccountBase.first_name", "is not", null)
				.where("InstagramAccountBase.first_name", "!=", "No name found")
				.where("EmailSequence.email", "is not", null)
				.where("EmailSequence.email", "!=", "")
				.select([
					sql<string>`DATE("EmailSequence".created_at)`.as("date"),
					sql<string>`COALESCE("InstagramAccountBase".country, 'Unknown')`.as(
						"country",
					),
					sql<number>`COUNT(DISTINCT "EmailSequence".id)::int`.as("count"),
				])
				.groupBy([
					sql<string>`DATE("EmailSequence".created_at)`,
					"InstagramAccountBase.country",
				])
				.orderBy("date", "asc")
				.execute();

			return dailyLeads;
		},
		{
			query: t.Object({
				days: t.Optional(t.Numeric()),
			}),
		},
	);
