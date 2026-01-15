console.log("[ImportAccountsCron] File loaded");
import { db } from "backend/src/db";
import { EmailSequenceStage } from "backend/src/db/db_types";
import { Effect, Schedule } from "effect";

const fetchAccountsForCountries = (countries: string[], limit: number) =>
	db
		.selectFrom("InstagramAccountBase")
		.innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
		.leftJoin(
			"EmailSequence",
			"EmailSequence.instagram_account_id",
			"InstagramAccountBase.id",
		)
		.where("country", "in", countries)
		.where("first_name", "!=", "No name found")
		.where("Email.code", "<>", 6)
		.where("Email.code", "<>", 7)
		.where("followers_count", ">", 7000)
		.where("followers_count", "<", 100000)
		.where((eb) =>
			eb.or([
				eb("lastSentEmail", "is", null),
				eb(
					"lastSentEmail",
					"<",
					new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
				),
			]),
		)
		.where("blacklist", "=", false)
		.where("InstagramAccountBase.blacklisted_at", "is", null)
		.where("Email.blacklisted_at", "is", null)
		.where("EmailSequence.id", "is", null)
		.select(["InstagramAccountBase.id", "Email.email"])
		.distinctOn(["InstagramAccountBase.id"])
		.limit(limit)
		.execute();

export const importAccountsToEmailSequenceCron = Effect.gen(function* () {
	console.log("[ImportAccountsCron] Started at", new Date().toISOString());
	const usaLimit = 1000;
	const ukLimit = 2000;
	const nlLimit = 500;
	const deLimit = 2000;

	let pendingIds: { id: string; email: string }[] = [];

	// 2000 from USA
	const usaRows = yield* Effect.promise(() =>
		fetchAccountsForCountries(["United States"], usaLimit),
	);
	pendingIds = pendingIds.concat(usaRows);

	// 1000 from UK
	const ukRows = yield* Effect.promise(() =>
		fetchAccountsForCountries(["United Kingdom"], ukLimit),
	);
	pendingIds = pendingIds.concat(ukRows);

	// 1000 combined from Netherlands and Belgium
	const nlBeRows = yield* Effect.promise(() =>
		fetchAccountsForCountries(["Netherlands", "Belgium"], nlLimit),
	);
	pendingIds = pendingIds.concat(nlBeRows);

	// 1000 from German-speaking countries
	const deRows = yield* Effect.promise(() =>
		fetchAccountsForCountries(
			["Germany", "Switzerland", "Austria", "GERMAN_CAPTIONS"],
			deLimit,
		),
	);
	pendingIds = pendingIds.concat(deRows);

	console.log("Total accounts to process:", pendingIds.length);

	for (const [index, account] of pendingIds.entries()) {
		const now = new Date();
		console.log(
			`[${index + 1}/${pendingIds.length}] Creating sequence for ${account.id}`,
		);
		console.log("Account:", account);

		console.log("[ImportAccountsCron] Finished at", new Date().toISOString());
		const highestSequence = yield* Effect.promise(() =>
			db
				.selectFrom("EmailSequence")
				.select("id")
				.orderBy("id", "desc")
				.executeTakeFirstOrThrow(),
		);
		const highestSequenceId = highestSequence?.id ?? 0;

		yield* Effect.promise(() =>
			db
				.insertInto("EmailSequence")
				.values({
					id: highestSequenceId + 1,
					instagram_account_id: account.id,
					current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
					current_stage_number: 1,
					email: account.email,
					stage_entered_at: now,
					next_action_possible_at: now,
					trigger_window_ends_at: null,
					last_instantly_campaign_completed_at: null,
					created_at: now,
					updated_at: now,
				})
				.returningAll()
				.executeTakeFirstOrThrow()
				.catch((e) => {
					console.error(
						`[${index + 1}/${pendingIds.length}] Error creating sequence for ${account.id}: ${e}`,
					);
					console.log(account);
				}),
		);
	}
}).pipe(
	Effect.schedule(Schedule.cron("0 2 * * *")), // Runs every day at 2:00 AM
);
// Effect.runPromise(importAccountsToEmailSequenceCron).then(() => {
//     console.log("[ImportAccountsCron] All done!");
//     process.exit(0);
// }).catch((err) => {
//     console.error("[ImportAccountsCron] Error:", err);
//     process.exit(1);
// });
