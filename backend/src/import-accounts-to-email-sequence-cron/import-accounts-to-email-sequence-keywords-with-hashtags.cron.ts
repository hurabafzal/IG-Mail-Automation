// console.log("[ImportAccountsCron] File loaded");
// import { db } from "backend/src/db";
// import { EmailSequenceStage } from "backend/src/db/db_types";
// import { HikerAPI } from "backend/src/mining/HikerAPI"; // Adjust path as needed
// import { Effect, Schedule } from "effect";

// function hasKeyword(description, keywords) {
// 	return keywords.some((keyword) =>
// 		description.toLowerCase().includes(keyword.toLowerCase()),
// 	);
// }
// const fetchAccountsForCountries = (
// 	countries: string[],
// 	min_followers: number,
// 	max_followers: number,
// ) =>
// 	db
// 		.selectFrom("InstagramAccountBase")
// 		.innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
// 		.leftJoin(
// 			"EmailSequence",
// 			"EmailSequence.instagram_account_id",
// 			"InstagramAccountBase.id",
// 		)
// 		.where("country", "in", countries)

// 		.where("first_name", "!=", "No name found")
// 		.where("Email.code", "<>", 6)
// 		.where("Email.code", "<>", 7)
// 		.where("followers_count", ">", min_followers)
// 		.where("followers_count", "<", max_followers)
// 		// .where((eb) =>
// 		// 	eb.or([
// 		// 		eb("lastSentEmail", "is", null),
// 		// 		eb(
// 		// 			"lastSentEmail",
// 		// 			"<",
// 		// 			new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
// 		// 		),
// 		// 	]),
// 		// )
// 		.where("blacklist", "=", false)
// 		.where("InstagramAccountBase.blacklisted_at", "is", null)
// 		.where("Email.blacklisted_at", "is", null)
// 		.where("EmailSequence.id", "is", null)
// 		.select(["InstagramAccountBase.id", "Email.email"])
// 		.distinctOn(["InstagramAccountBase.id"])
// 		.limit(600)
// 		.execute();

// export const importAccountsToEmailSequenceCronKeywords = Effect.gen(
// 	function* () {
// 		console.log("[ImportAccountsCron] Started at", new Date().toISOString());
// 		const usaLimit = 1000;
// 		const ukLimit = 500;
// 		const nlLimit = 500;
// 		const deLimit = 500;

// 		let pendingIds: { id: string; email: string }[] = [];

// 		// 2000 from USA
// 		// const usaRows = yield* Effect.promise(() =>
// 		// 	fetchAccountsForCountries(["United States"], usaLimit),
// 		// );
// 		// pendingIds = pendingIds.concat(usaRows);

// 		// // 1000 from UK
// 		// const ukRows = yield* Effect.promise(() =>
// 		// 	fetchAccountsForCountries(["United Kingdom"], ukLimit),
// 		// );
// 		// pendingIds = pendingIds.concat(ukRows);

// 		// 1000 combined from Netherlands and Belgium

// 		// Fetch FilterCloneTask by specific id
// 		const filterCloneTasks = yield* Effect.promise(() =>
// 			db
// 				.selectFrom("FilterCloneTask")
// 				.select([
// 					"id",
// 					"title",
// 					"target",
// 					"target_male",
// 					"target_female",
// 					"target_country",
// 					"createdAt",
// 					"keywords",
// 					"min_followers",
// 					"max_followers",
// 					"post_date",
// 					"result_limit",
// 					"found",
// 				])
// 				.execute(),
// 		);

// 		// 2. Filter tasks where found < result_limit
// 		const tasksToProcess = filterCloneTasks.filter(
// 			(task) =>
// 				typeof task.result_limit === "number" &&
// 				typeof task.found === "number" &&
// 				task.found <= task.result_limit,
// 		);

// 		console.log(
// 			`[ImportAccountsCron] Found ${tasksToProcess.length} tasks to process`,
// 		);

// 		for (const filterCloneTask of tasksToProcess) {
// 			const {
// 				id,
// 				title,
// 				target,
// 				target_male,
// 				target_female,
// 				target_country,
// 				createdAt,
// 				keywords,
// 				min_followers,
// 				max_followers,
// 				post_date,
// 				result_limit,
// 			} = filterCloneTask;

// 			console.log({
// 				id,
// 				title,
// 				target,
// 				target_male,
// 				target_female,
// 				target_country,
// 				createdAt,
// 				keywords,
// 				min_followers,
// 				max_followers,
// 				post_date,
// 				result_limit,
// 			});

// 			const nlBeRowsRaw = yield* Effect.promise(() =>
// 				fetchAccountsForCountries(
// 					[target_country],
// 					min_followers,
// 					max_followers,
// 				),
// 			);
// 			const nlBeRows = nlBeRowsRaw.slice(100); // Ignore first 100 accounts
// 			pendingIds = pendingIds.concat(nlBeRows);

// 			// 1000 from German-speaking countries
// 			// const deRows = yield* Effect.promise(() =>
// 			// 	fetchAccountsForCountries(
// 			// 		["Germany", "Switzerland", "Austria", "GERMAN_CAPTIONS"],
// 			// 		deLimit,
// 			// 	),
// 			// );
// 			// pendingIds = pendingIds.concat(deRows);

// 			console.log("Total accounts to process:", pendingIds.length);

// 			// ...existing code...

// 			for (const [index, account] of pendingIds.entries()) {
// 				const now = new Date();
// 				let matchfound = false;
// 				try {
// 					// Fetch posts after the given post_date
// 					const posts = yield* HikerAPI.user_medias_by_id(account.id, {
// 						after: post_date,
// 						limit: 50,
// 					});
// 					console.log(
// 						`Fetched ${posts?.length || 0} posts for account ${account.id}`,
// 					);
// 					if (posts && posts.length > 0) {
// 						// Normalize keyword list
// 						const keywordList =
// 							typeof keywords === "string"
// 								? keywords
// 										.split(",")
// 										.map((k) => k.trim())
// 										.filter(Boolean)
// 								: Array.isArray(keywords)
// 									? keywords
// 									: [];

// 						// const fs = yield* Effect.promise(() => import("fs/promises"));
// 						// const path = yield* Effect.promise(() => import("path"));

// 						// // ✅ Save CSV in project root (same directory where you run `bun run`)
// 						// const csvFilePath = path.resolve(
// 						// 	process.cwd(),
// 						// 	"german_leads_cooldown.csv",
// 						// );
// 						// // console.log("Writing to CSV at:", csvFilePath);

// 						// // Check if file exists
// 						// let fileExists = true;
// 						// try {
// 						// 	yield* Effect.promise(() => fs.access(csvFilePath));
// 						// } catch {
// 						// 	fileExists = false;
// 					}

// 					// If file does not exist, create with header
// 					// if (!fileExists) {
// 					// 	const header =
// 					// 		[
// 					// 			"account_id",
// 					// 			"email",
// 					// 			"instagram_id",
// 					// 			"post_id",
// 					// 			"post_url",
// 					// 			"post_caption",
// 					// 			"post_timestamp",
// 					// 			"keywords",
// 					// 			"match_status",
// 					// 		].join(",") + "\n";

// 					// 	yield* Effect.promise(() =>
// 					// 		fs.writeFile(csvFilePath, header, { flag: "w" }),
// 					// 	);
// 					// }

// 					let savedCount = 0;

// 					// let matchCount = 0;
// 					for (const post of posts) {
// 						// console.log({post});
// 						if (savedCount >= 20) break; // Limit saved posts per account

// 						const desc =
// 							(typeof post.caption === "string"
// 								? post.caption
// 								: post.caption?.text) ||
// 							post.text ||
// 							"";
// 						// console.log({desc});
// 						if (!desc) continue; // Skip if no caption

// 						const isMatch = hasKeyword(desc, keywordList);
// 						// console.log({isMatch});
// 						if (!isMatch) continue; // ✅ Save only if keyword is found

// 						// const postUrl =
// 						// 	post.permalink ||
// 						// 	post.link ||
// 						// 	`https://instagram.com/p/${post.code || post.id}`;
// 						// const csvRow = [
// 						// 	account.id,
// 						// 	account.email || "",
// 						// 	account.id,
// 						// 	post.id || "",
// 						// 	postUrl,
// 						// 	desc.replace(/\r?\n|\r/g, " ").replace(/"/g, '""'),
// 						// 	post.timestamp || post.taken_at || "",
// 						// 	keywordList.join(";"),
// 						// 	"MATCH",
// 						// ]
// 						// 	.map((field) => `"${String(field).replace(/"/g, '""')}"`)
// 						// 	.join(",");

// 						// yield* Effect.promise(() =>
// 						// 	fs.appendFile(csvFilePath, csvRow + "\n"),
// 						// );
// 						matchfound = true;
// 						console.log(matchfound);
// 						savedCount++;
// 					}

// 					console.log(
// 						`[${index + 1}/${pendingIds.length}] Saved ${savedCount} matching posts for account ${account.id}`,
// 					);
// 				} catch (err) {
// 					console.error(`Error fetching posts for ${account.id}:`, err);
// 				}

// 				console.log(
// 					"[ImportAccountsCron] Finished at",
// 					new Date().toISOString(),
// 				);
// 				if (matchfound) {
// 					console.log("Match found, adding to email sequence:", account);
// 					const highestSequence = yield* Effect.promise(() =>
// 						db
// 							.selectFrom("EmailSequence")
// 							.select("id")
// 							.orderBy("id", "desc")
// 							.executeTakeFirstOrThrow(),
// 					);
// 					const highestSequenceId = highestSequence?.id ?? 0;

// 					yield* Effect.promise(() =>
// 						db
// 							.insertInto("EmailSequence")
// 							.values({
// 								id: highestSequenceId + 1,
// 								instagram_account_id: account.id,
// 								current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
// 								current_stage_number: 3,
// 								email: account.email,
// 								stage_entered_at: now,
// 								next_action_possible_at: now,
// 								trigger_window_ends_at: null,
// 								last_instantly_campaign_completed_at: null,
// 								created_at: now,
// 								updated_at: now,
// 							})
// 							.returningAll()
// 							.executeTakeFirstOrThrow()
// 							.catch((e) => {
// 								console.error(
// 									`[${index + 1}/${pendingIds.length}] Error creating sequence for ${account.id}: ${e}`,
// 								);
// 								console.log(account);
// 							}),
// 					);

// 					// Increment the 'found' column in FilterCloneTask
// 					yield* Effect.promise(() =>
// 						db
// 							.updateTable("FilterCloneTask")
// 							.set((eb) => ({
// 								found: eb("found", "+", 1),
// 							}))
// 							.where("id", "=", id)
// 							.executeTakeFirst()
// 							.catch((e) => {
// 								console.error(
// 									`[${index + 1}/${pendingIds.length}] Error incrementing 'found' for FilterCloneTask ${id}: ${e}`,
// 								);
// 							}),
// 					);
// 					try {
// 						const highestSequence = yield* Effect.promise(() =>
// 							db
// 								.selectFrom("TriggerTask")
// 								.select("id")
// 								.orderBy("id", "desc")
// 								.executeTakeFirst(),
// 						);
// 						const highestSequenceId1 = highestSequence?.id ?? 0;

// 						console.log("checks");
// 						yield* Effect.promise(() =>
// 							db
// 								.insertInto("TriggerTask")
// 								.values({
// 									id: Number(highestSequenceId1) + 1,
// 									instagram_account_id: account.id,
// 									current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
// 									current_stage_number: 3,
// 									email: account.email,
// 									stage_entered_at: now,
// 									next_action_possible_at: now,
// 									trigger_window_ends_at: null,
// 									last_instantly_campaign_completed_at: null,
// 									triggerid: id,
// 									created_at: now,
// 									updated_at: now,
// 								})
// 								.returningAll()
// 								.executeTakeFirstOrThrow()
// 								.catch((e) => {
// 									console.error(
// 										`[${index + 1}/${pendingIds.length}] Error creating sequence for ${account.id}: ${e}`,
// 									);
// 									console.log(account);
// 								}),
// 						);
// 					} catch {
// 						console.log("Checksome");
// 					}
// 				}
// 			}
// 		}

// 		// const highestSequence = yield* Effect.promise(() =>
// 		// 	db
// 		// 		.selectFrom("EmailSequence")
// 		// 		.select("id")
// 		// 		.orderBy("id", "desc")
// 		// 		.executeTakeFirstOrThrow(),
// 		// );
// 		// const highestSequenceId = highestSequence?.id ?? 0;

// 		// yield* Effect.promise(() =>
// 		// 	db
// 		// 		.insertInto("EmailSequence")
// 		// 		.values({
// 		// 			id: highestSequenceId + 1,
// 		// 			instagram_account_id: account.id,
// 		// 			current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
// 		// 			current_stage_number: 3,
// 		// 			email: account.email,
// 		// 			stage_entered_at: now,
// 		// 			next_action_possible_at: now,
// 		// 			trigger_window_ends_at: null,
// 		// 			last_instantly_campaign_completed_at: null,
// 		// 			created_at: now,
// 		// 			updated_at: now,
// 		// 		})
// 		// 		.returningAll()
// 		// 		.executeTakeFirstOrThrow()
// 		// 		.catch((e) => {
// 		// 			console.error(
// 		// 				`[${index + 1}/${pendingIds.length}] Error creating sequence for ${account.id}: ${e}`,
// 		// 			);
// 		// 			console.log(account);
// 		// 		}),
// 		// );
// 	},
// );
// // .pipe(
// // 	Effect.schedule(Schedule.cron("0 2 * * *")), // Runs every day at 2:00 AM
// // );
// if (import.meta.main) {
// 	Effect.runPromise(importAccountsToEmailSequenceCronKeywords)
// 		.then(() => {
// 			console.log("[ImportAccountsCron] Completed");
// 			process.exit(0);
// 		})
// 		.catch((err) => {
// 			console.error("[ImportAccountsCron] Error:", err);
// 			process.exit(1);
// 		});
// }
// backend/src/import-accounts-to-email-sequence-cron/import-accounts-to-email-sequence-keywords.cron.ts

// console.log("[ImportAccountsCron] File loaded");
// import { db } from "backend/src/db";
// import { EmailSequenceStage } from "backend/src/db/db_types";
// import { HikerAPI } from "backend/src/mining/HikerAPI";
// import { Effect } from "effect";
// import { sql } from "kysely";

// // 1) add types
// function hasKeyword(description: string, keywords: string[]): boolean {
// 	const d = description?.toLowerCase() ?? "";
// 	return keywords.some((k) => d.includes(String(k).toLowerCase()));
// }

// const fetchAccountsForCountries = (
// 	countries: string[],
// 	min_followers: number,
// 	max_followers: number,
// ) =>
// 	db
// 		.selectFrom("InstagramAccountBase")
// 		.innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
// 		.leftJoin(
// 			"EmailSequence",
// 			"EmailSequence.instagram_account_id",
// 			"InstagramAccountBase.id",
// 		)
// 		.where("country", "in", countries)
// 		.where("first_name", "!=", "No name found")
// 		.where("Email.code", "<>", 6)
// 		.where("Email.code", "<>", 7)
// 		.where("followers_count", ">", min_followers)
// 		.where("followers_count", "<", max_followers)
// 		.where("blacklist", "=", false)
// 		.where("InstagramAccountBase.blacklisted_at", "is", null)
// 		.where("Email.blacklisted_at", "is", null)
// 		.where("EmailSequence.id", "is", null)
// 		.select(["InstagramAccountBase.id", "Email.email"])
// 		.distinctOn(["InstagramAccountBase.id"])
// 		.limit(600)
// 		.execute();

// export const importAccountsToEmailSequenceCronKeywords = Effect.gen(
// 	function* () {
// 		console.log("[ImportAccountsCron] Started at", new Date().toISOString());

// 		let pendingIds: { id: string; email: string }[] = [];

// 		// 2) Kysely: FilterCloneTask not in typed DB. Use `as any` (quick fix) or add table to DB type.
// 		const filterCloneTasks = (yield* Effect.promise(() =>
// 			db
// 				.selectFrom("FilterCloneTask")
// 				.select([
// 					"id",
// 					"title",
// 					"target",
// 					"target_male",
// 					"target_female",
// 					"target_country",
// 					"createdAt",
// 					"keywords",
// 					"min_followers",
// 					"max_followers",
// 					"post_date",
// 					"result_limit",
// 					"found",
// 					"is_active",
// 				])
// 				.where("is_active", "=", true)
// 				.execute(),
// 		)) as Array<{
// 			id: number | string;
// 			title: string | null;
// 			target: number | null;
// 			target_male: number | null;
// 			target_female: number | null;
// 			target_country: string | null;
// 			createdAt: Date | string | null;
// 			keywords: string | string[] | null;
// 			min_followers: number;
// 			max_followers: number;
// 			post_date: Date | string | null;
// 			result_limit: number | null;
// 			found: number | null;
// 			is_active: boolean | null;
// 		}>;

// 		const tasksToProcess = filterCloneTasks.filter(
// 			(t) =>
// 				typeof t.result_limit === "number" &&
// 				typeof t.found === "number" &&
// 				(t.found ?? 0) <= (t.result_limit ?? 0),
// 		);

// 		console.log(
// 			`[ImportAccountsCron] Found ${tasksToProcess.length} tasks to process`,
// 		);

// 		for (const filterCloneTask of tasksToProcess) {
// 			const {
// 				id,
// 				target_country,
// 				keywords,
// 				min_followers,
// 				max_followers,
// 				post_date,
// 			} = filterCloneTask;

// 			// 3) guard null country
// 			const country = target_country ?? "";
// 			if (!country) continue;

// 			const rowsRaw = yield* Effect.promise(() =>
// 				fetchAccountsForCountries([country], min_followers, max_followers),
// 			);
// 			const rows = rowsRaw.slice(100); // keep your "ignore first 100"
// 			pendingIds = pendingIds.concat(rows);

// 			console.log("Total accounts to process:", pendingIds.length);

// 			for (const [index, account] of pendingIds.entries()) {
// 				const now = new Date();
// 				let matchfound = false;

// 				try {
// 					// 4) HikerAPI options: remove unknown `limit`
// 					const posts =
// 						(yield* HikerAPI.user_medias_by_id(account.id, {
// 							after:
// 								typeof post_date === "string"
// 									? new Date(post_date)
// 									: (post_date ?? undefined),
// 						})) || [];

// 					console.log(
// 						`Fetched ${posts.length} posts for account ${account.id}`,
// 					);

// 					// normalize keyword list
// 					const keywordList: string[] = Array.isArray(keywords)
// 						? (keywords as string[])
// 						: typeof keywords === "string"
// 							? keywords
// 									.split(",")
// 									.map((k) => k.trim())
// 									.filter(Boolean)
// 							: [];

// 					let savedCount = 0;

// 					for (const post of posts) {
// 						if (savedCount >= 20) break;

// 						// 5) caption extraction: no `post.text`
// 						const desc: string =
// 							(typeof post?.caption === "string"
// 								? post.caption
// 								: post?.caption?.text) ?? "";

// 						if (!desc) continue;

// 						const isMatch = hasKeyword(desc, keywordList);
// 						if (!isMatch) continue;

// 						matchfound = true;
// 						savedCount++;
// 					}

// 					console.log(
// 						`[${index + 1}/${pendingIds.length}] Saved ${savedCount} matching posts for account ${account.id}`,
// 					);
// 				} catch (err) {
// 					console.error(`Error fetching posts for ${account.id}:`, err);
// 				}

// 				console.log(
// 					"[ImportAccountsCron] Finished at",
// 					new Date().toISOString(),
// 				);

// 				if (matchfound) {
// 					console.log("Match found, adding to email sequence:", account);

// 					// const highestSequence = yield* Effect.promise(() =>
// 					//   db
// 					//     .selectFrom("EmailSequence")
// 					//     .select("id")
// 					//     .orderBy("id", "desc")
// 					//     .executeTakeFirstOrThrow(),
// 					// );
// 					// const highestSequenceId = (highestSequence?.id as number) ?? 0;

// 					// yield* Effect.promise(() =>
// 					//   db
// 					//     .insertInto("EmailSequence")
// 					//     .values({
// 					//       id: highestSequenceId + 1,
// 					//       instagram_account_id: account.id,
// 					//       current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
// 					//       current_stage_number: 3,
// 					//       email: account.email,
// 					//       stage_entered_at: new Date(),
// 					//       next_action_possible_at: new Date(),
// 					//       trigger_window_ends_at: null,
// 					//       last_instantly_campaign_completed_at: null,
// 					//       created_at: new Date(),
// 					//       updated_at: new Date(),
// 					//     })
// 					//     .returningAll()
// 					//     .executeTakeFirstOrThrow()
// 					//     .catch((e) => {
// 					//       console.error(
// 					//         `[${index + 1}/${pendingIds.length}] Error creating sequence for ${account.id}: ${e}`,
// 					//       );
// 					//       console.log(account);
// 					//     }),
// 					// );

// 					// 6) Kysely update increment: use sql template instead of eb("+")
// 					yield* Effect.promise(() =>
// 						db
// 							.updateTable("FilterCloneTask")
// 							.set({
// 								// coalesce for null safety
// 								found: sql<number>`coalesce(found, 0) + 1`,
// 							})
// 							.where("id", "=", id)
// 							.executeTakeFirst()
// 							.catch((e) => {
// 								console.error(
// 									`[${index + 1}/${pendingIds.length}] Error incrementing 'found' for FilterCloneTask ${id}: ${e}`,
// 								);
// 							}),
// 					);

// 					try {
// 						// TriggerTask also not in typed DB
// 						const highestTrigger = (yield* Effect.promise(() =>
// 							db
// 								.selectFrom("TriggerTask")
// 								.select("id")
// 								.orderBy("id", "desc")
// 								.executeTakeFirst(),
// 						)) as { id?: number } | undefined;
// 						const highestTriggerId =
// 							highestTrigger && typeof highestTrigger.id === "number"
// 								? highestTrigger.id
// 								: 0;

// 						yield* Effect.promise(() =>
// 							db
// 								.insertInto("TriggerTask")
// 								.values({
// 									id: Number(highestTriggerId) + 1,
// 									instagram_account_id: account.id,
// 									current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
// 									current_stage_number: 3,
// 									email: account.email,
// 									stage_entered_at: new Date(),
// 									next_action_possible_at: new Date(),
// 									trigger_window_ends_at: null,
// 									last_instantly_campaign_completed_at: null,
// 									triggerid: id as number | string,
// 									created_at: new Date(),
// 									updated_at: new Date(),
// 								})
// 								.returningAll()
// 								.executeTakeFirstOrThrow()
// 								.catch((e) => {
// 									console.error(
// 										`[${index + 1}/${pendingIds.length}] Error creating trigger for ${account.id}: ${e}`,
// 									);
// 									console.log(account);
// 								}),
// 						);
// 					} catch {
// 						console.log("TriggerTask insert check: fallback");
// 					}
// 				}
// 			}
// 		}
// 	},
// );

// if (import.meta.main) {
// 	Effect.runPromise(importAccountsToEmailSequenceCronKeywords)
// 		.then(() => {
// 			console.log("[ImportAccountsCron] Completed");
// 			process.exit(0);
// 		})
// 		.catch((err) => {
// 			console.error("[ImportAccountsCron] Error:", err);
// 			process.exit(1);
// 		});
// }
// console.log("[ImportAccountsCron] File loaded");
// import { db as baseDb } from "backend/src/db";
// import { EmailSequenceStage } from "backend/src/db/db_types";
// import { HikerAPI } from "backend/src/mining/HikerAPI";
// import { Effect, Schedule, pipe } from "effect";
// import { type Kysely, sql } from "kysely";

// // import { Effect, Schedule } from "effect";
// /** ─────────────────────────────────────────────────────────────
//  *  1) Strong table types (only fields we actually read/write)
//  *  ────────────────────────────────────────────────────────────*/
// type FilterCloneTaskRow = {
// 	id: number | string;
// 	title: string | null;
// 	target: number | null;
// 	target_male: number | null;
// 	target_female: number | null;
// 	target_country: string | null;
// 	createdAt: Date | string | null;
// 	keywords: string | null; // stored as CSV in DB; we'll split in code
// 	min_followers: number;
// 	max_followers: number;
// 	post_date: Date | string | null;
// 	result_limit: number | null;
// 	found: number | null;
// 	is_active: boolean | null;
// };

// type TriggerTaskRow = {
// 	id: number;
// 	instagram_account_id: string;
// 	current_stage: EmailSequenceStage;
// 	current_stage_number: number;
// 	email: string;
// 	stage_entered_at: Date;
// 	next_action_possible_at: Date;
// 	trigger_window_ends_at: Date | null;
// 	last_instantly_campaign_completed_at: Date | null;
// 	triggerid: number | string;
// 	created_at: Date;
// 	updated_at: Date;
// };

// /** Your existing DB type (DB_WITH_VIEWS) is already baked into baseDb.
//  *  We extend it locally with our two missing tables.
//  */
// type ExtraTables = {
// 	FilterCloneTask: FilterCloneTaskRow;
// 	TriggerTask: TriggerTaskRow;
// };

// // no `any` — use `unknown` in the middle and end with a fully-typed Kysely<...>
// const db = baseDb as unknown as Kysely<ExtraTables>;

// /** ─────────────────────────────────────────────────────────────
//  *  2) Helpers
//  *  ────────────────────────────────────────────────────────────*/
// function hasKeyword(description: string, keywords: string[]): boolean {
// 	const d = description?.toLowerCase() ?? "";
// 	return keywords.some((k) => d.includes(String(k).toLowerCase()));
// }

// const fetchAccountsForCountries = (
// 	countries: string[],
// 	min_followers: number,
// 	max_followers: number,
// ) =>
// 	baseDb
// 		.selectFrom("InstagramAccountBase")
// 		.innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
// 		.leftJoin(
// 			"EmailSequence",
// 			"EmailSequence.instagram_account_id",
// 			"InstagramAccountBase.id",
// 		)
// 		.where("country", "in", countries)
// 		.where("first_name", "!=", "No name found")
// 		.where("Email.code", "<>", 6)
// 		.where("Email.code", "<>", 7)
// 		.where("followers_count", ">", min_followers)
// 		.where("followers_count", "<", max_followers)
// 		.where("blacklist", "=", false)
// 		.where("InstagramAccountBase.blacklisted_at", "is", null)
// 		.where("Email.blacklisted_at", "is", null)
// 		.where("EmailSequence.id", "is", null)
// 		.select(["InstagramAccountBase.id as id", "Email.email as email"])
// 		.distinctOn(["InstagramAccountBase.id"])
// 		.limit(600)
// 		.execute();

// /** ─────────────────────────────────────────────────────────────
//  *  3) Main effect
//  *  ────────────────────────────────────────────────────────────*/
// export const importAccountsToEmailSequenceCronKeywords = Effect.gen(
// 	function* () {
// 		console.log("[ImportAccountsCron] Started at", new Date().toISOString());

// 		let pendingIds: { id: string; email: string }[] = [];

// 		// Fully typed select with alias = no overload errors
// 		const filterCloneTasks = yield* Effect.promise(() =>
// 			db
// 				.selectFrom("FilterCloneTask as fct")
// 				.select((eb) => [
// 					eb.ref("fct.id").as("id"),
// 					eb.ref("fct.title").as("title"),
// 					eb.ref("fct.target").as("target"),
// 					eb.ref("fct.target_male").as("target_male"),
// 					eb.ref("fct.target_female").as("target_female"),
// 					eb.ref("fct.target_country").as("target_country"),
// 					eb.ref("fct.createdAt").as("createdAt"),
// 					eb.ref("fct.keywords").as("keywords"),
// 					eb.ref("fct.min_followers").as("min_followers"),
// 					eb.ref("fct.max_followers").as("max_followers"),
// 					eb.ref("fct.post_date").as("post_date"),
// 					eb.ref("fct.result_limit").as("result_limit"),
// 					eb.ref("fct.found").as("found"),
// 					eb.ref("fct.is_active").as("is_active"),
// 				])
// 				.where("fct.is_active", "=", true)
// 				.execute(),
// 		);

// 		const tasksToProcess = filterCloneTasks.filter(
// 			(t) =>
// 				typeof t.result_limit === "number" &&
// 				typeof t.found === "number" &&
// 				(t.found ?? 0) < (t.result_limit ?? 0),
// 		);

// 		console.log(
// 			`[ImportAccountsCron] Found ${tasksToProcess.length} tasks to process`,
// 		);

// 		for (const filterCloneTask of tasksToProcess) {
// 			const {
// 				id,
// 				target_country,
// 				keywords,
// 				min_followers,
// 				max_followers,
// 				post_date,
// 			} = filterCloneTask;

// 			const country = target_country ?? "";
// 			if (!country) continue;

// 			const rowsRaw = yield* Effect.promise(() =>
// 				fetchAccountsForCountries([country], min_followers, max_followers),
// 			);
// 			// const rows = rowsRaw.slice(100); // keep your "ignore first 100"
// 			pendingIds = pendingIds.concat(rowsRaw);

// 			console.log("Total accounts to process:", pendingIds.length);
// 			let countfinding = 0;
// 			for (const [index, account] of pendingIds.entries()) {
// 				countfinding = filterCloneTask.found ?? 0;
// 				if (countfinding >= (filterCloneTask.result_limit ?? 0)) break;
// 				let matchfound = false;

// 				try {
// 					const posts =
// 						(yield* HikerAPI.user_medias_by_id(account.id, {
// 							after:
// 								typeof post_date === "string"
// 									? new Date(post_date)
// 									: (post_date ?? undefined),
// 						})) || [];

// 					console.log(
// 						`Fetched ${posts.length} posts for account ${account.id}`,
// 					);

// 					const keywordList: string[] = Array.isArray(keywords)
// 						? keywords.filter((k): k is string => typeof k === "string")
// 						: typeof keywords === "string"
// 							? keywords
// 									.split(",")
// 									.map((k) => k.trim())
// 									.filter(Boolean)
// 							: [];

// 					for (const post of posts) {
// 						// tolerate either `string` or `{ text?: string }`
// 						const desc: string =
// 							(typeof post?.caption === "string"
// 								? post.caption
// 								: post?.caption?.text) ?? "";

// 						if (!desc) continue;

// 						const isMatch = hasKeyword(desc, keywordList);
// 						if (!isMatch) continue;

// 						matchfound = true;
// 						countfinding++;
// 						break; // break the loop after the first match
// 					}

// 					console.log(
// 						`[${index + 1}/${pendingIds.length}] Checked posts for account ${account.id}`,
// 					);
// 				} catch (err) {
// 					console.error(`Error fetching posts for ${account.id}:`, err);
// 				}

// 				console.log(
// 					"[ImportAccountsCron] Finished at",
// 					new Date().toISOString(),
// 				);

// 				// Only update found and insert if matchfound AND account.email is valid
// 				if (matchfound) {
// 					console.log("Match found, adding to email sequence:", account);

// 					try {
// 						const highestTrigger = (yield* Effect.promise(() =>
// 							db
// 								.selectFrom("TriggerTask as tt")
// 								.select("tt.id")
// 								.orderBy("tt.id", "desc")
// 								.executeTakeFirst(),
// 						)) as { id?: number } | undefined;

// 						const highestTriggerId =
// 							highestTrigger && typeof highestTrigger.id === "number"
// 								? highestTrigger.id
// 								: 0;

// 						const inserted = yield* pipe(
// 							Effect.promise(() =>
// 								db
// 									.insertInto("TriggerTask")
// 									.values({
// 										id: Number(highestTriggerId) + 1,
// 										instagram_account_id: account.id,
// 										current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
// 										current_stage_number: 3,
// 										email: account.email,
// 										stage_entered_at: new Date(),
// 										next_action_possible_at: new Date(),
// 										trigger_window_ends_at: null,
// 										last_instantly_campaign_completed_at: null,
// 										triggerid: id as number | string,
// 										created_at: new Date(),
// 										updated_at: new Date(),
// 									})
// 									.returningAll()
// 									.executeTakeFirstOrThrow(),
// 							),
// 							Effect.catchAll((e: unknown) =>
// 								Effect.sync(() => {
// 									console.error(
// 										`[${index + 1}/${pendingIds.length}] Error creating trigger for ${account.id}: ${String(e)}`,
// 									);
// 									console.log(account);
// 									return null;
// 								}),
// 							),
// 						);

// 						if (inserted) {
// 							// increment found; again: handle failure via catchAll
// 							yield* pipe(
// 								Effect.promise(() =>
// 									db
// 										.updateTable("FilterCloneTask")
// 										.set({
// 											found: sql<number>`coalesce(found, 0) + 1`,
// 										})
// 										.where("id", "=", id)
// 										.executeTakeFirst(),
// 								),
// 								Effect.catchAll((e: unknown) =>
// 									Effect.sync(() => {
// 										console.error(
// 											`[${index + 1}/${pendingIds.length}] Error incrementing 'found' for FilterCloneTask ${id}: ${String(e)}`,
// 										);
// 									}),
// 								),
// 								// If you don't care about the result, ignore it so error type becomes never:
// 								Effect.ignore,
// 							);
// 						}
// 					} catch (e) {
// 						console.log("TriggerTask insert check: fallback", e);
// 					}
// 				}
// 			}
// 		}
// 	},
// ).pipe(
// 	Effect.schedule(Schedule.cron("*/10 * * * *")), // Runs every 10 minutes
// );

// // if (import.meta.main) {
// // 	Effect.runPromise(importAccountsToEmailSequenceCronKeywords)
// // 		.then(() => {
// // 			console.log("[ImportAccountsCron] Completed");
// // 			process.exit(0);
// // 		})
// // 		.catch((err) => {
// // 			console.error("[ImportAccountsCron] Error:", err);
// // 			process.exit(1);
// // 		});
// // }

console.log("[ImportAccountsCron] File loaded");
import { HttpClient } from "@effect/platform";
import { db as baseDb } from "backend/src/db";
import { EmailSequenceStage } from "backend/src/db/db_types";
import { HikerAPI } from "backend/src/mining/HikerAPI";
import { BrowserLayer } from "backend/src/mining/browser/browserLayer";
import { Context, Effect, Schedule, pipe } from "effect";
import { type Kysely, sql } from "kysely";
import { z } from "zod";

/** ─────────────────────────────────────────────────────────────
 *  Media item types (from HikerAPI schemas)
 *  ────────────────────────────────────────────────────────────*/
const captionSchema = z.object({
	pk: z.string(),
	user_id: z.number(),
	text: z.string(),
	created_at_utc: z.number(),
	media_id: z.number(),
});

const mediaItemSchema = z.object({
	taken_at: z.number(),
	pk: z.string(),
	id: z.string(),
	code: z.string(),
	like_and_view_counts_disabled: z.boolean(),
	device_timestamp: z.number(),
	caption: captionSchema.nullish(),
	like_count: z.number(),
	play_count: z.number().optional(),
	reshare_count: z.number().nullish(),
	comment_count: z.number(),
	product_type: z.string().nullish(),
	user: z
		.object({
			username: z.string(),
			pk_id: z.string(),
			pk: z.string(),
			id: z.string(),
			is_private: z.boolean(),
		})
		.optional(),
});

type MediaItem = z.infer<typeof mediaItemSchema>;

/** ─────────────────────────────────────────────────────────────
 *  Strong table types
 *  ────────────────────────────────────────────────────────────*/
type FilterCloneTaskRow = {
	id: number | string;
	title: string | null;
	target: number | null;
	target_male: number | null;
	target_female: number | null;
	target_country: string | null;
	createdAt: Date | string | null;
	keywords: string | null;
	min_followers: number;
	max_followers: number;
	post_date: Date | string | null;
	result_limit: number | null;
	found: number | null;
	is_active: boolean | null;
	maxPerDay: number | null;
	enable_mentions_scraping: boolean | null;
	enable_hashtag_scraping: boolean | null;
	last_processed_offset: number | null;
};

type TriggerTaskRow = {
	id: number;
	instagram_account_id: string;
	current_stage: EmailSequenceStage;
	current_stage_number: number;
	email: string;
	stage_entered_at: Date;
	next_action_possible_at: Date;
	trigger_window_ends_at: Date | null;
	last_instantly_campaign_completed_at: Date | null;
	triggerid: number | string;
	created_at: Date;
	updated_at: Date;
	post_url?: string | null;
	post_text?: string | null;
};
type BlockUserRow = {
	ig_id: string;
};
import type { EmailSequence } from "backend/src/db/db_types";

type ExtraTables = {
	FilterCloneTask: FilterCloneTaskRow;
	TriggerTask: TriggerTaskRow;
	EmailSequence: EmailSequence;
	blockusers: BlockUserRow; // <-- Add this line
};

const db = baseDb as unknown as Kysely<ExtraTables>;

/** Helpers */
function hasKeyword(
	description: string,
	keywords: string[],
): { match: boolean; matchedKeyword?: string } {
	const d = description?.toLowerCase() ?? "";
	const matchedKeyword = keywords.find((k) =>
		d.includes(String(k).toLowerCase()),
	);
	return {
		match: !!matchedKeyword,
		matchedKeyword: matchedKeyword,
	};
}

/**
 * Extracts all @ mentions from a post caption
 * @param caption - The post caption text
 * @returns Array of usernames (without @ symbol)
 */
function extractMentions(caption: string): string[] {
	if (!caption) return [];

	// Regex to match @mentions - handles usernames with dots, underscores, numbers
	// Examples: @username, @company.com, @brand_name, @user123
	const mentionRegex = /@([a-zA-Z0-9._]+)/g;
	const matches = caption.match(mentionRegex);

	if (!matches) return [];

	// Remove @ symbol and return unique mentions
	const mentions = matches.map((match) => match.substring(1));
	return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Processes @ mentions to scrape followings and add them to batch for processing
 * @param mentions - Array of @ mentions from the giveaway post
 * @param originalPostUrl - URL of the original giveaway post
 * @returns Array of discovered creators (all followings, no keyword filtering)
 */
function* processMentionsForCreatorDiscovery(
	mentions: string[],
	originalPostUrl: string,
) {
	const discoveredCreators = [];

	console.log(
		`🔍 Starting following scraping for ${mentions.length} mentions...`,
	);

	// Process mentions sequentially
	for (const mention of mentions) {
		try {
			console.log(`  - Processing mention: @${mention}`);
			console.log(`    📡 API Call: Getting user details for @${mention}`);

			// Get user details from username
			const userResult = yield* HikerAPI.user_by_username_req(mention);

			if (!userResult || !userResult.user || userResult.user.is_private) {
				console.log(`    ⚠️ User @${mention} not found or private, skipping`);
				continue;
			}

			console.log(`    ✓ Found user @${mention} (ID: ${userResult.user.id})`);

			// Add delay before following request
			yield* Effect.sleep(1000); // 1 second delay

			console.log(
				`    📡 API Call: Getting following list for @${mention} (${userResult.user.id})`,
			);
			// Get following list
			const followingResult = yield* HikerAPI.following_req(userResult.user.id);

			if (!followingResult || !followingResult.response.users) {
				console.log(`    ⚠️ No followings found for @${mention}, continuing`);
				continue;
			}

			console.log(
				`    ✓ Found ${followingResult.response.users.length} followings for @${mention}`,
			);

			// Process each following - add ALL to batch (no keyword filtering)
			for (const following of followingResult.response.users) {
				try {
					console.log(`    📝 Adding @${following.username} to batch`);

					// Use miner logic to get complete profile data and save to database
					const savedAccount = yield* processDiscoveredCreatorWithMiner(
						following,
						mention,
						originalPostUrl,
					);

					if (savedAccount) {
						discoveredCreators.push({
							account: following,
							postUrl: originalPostUrl, // Use original post URL
							postCaption: "", // Will be filled when main loop processes
							sourceMention: mention,
							originalPost: originalPostUrl,
							savedAccount: savedAccount,
						});
					}
				} catch (followingError) {
					console.error(
						`    ❌ Error processing following @${following.username}:`,
						followingError,
					);
					// Continue with next following
				}
			}
		} catch (mentionError) {
			console.error(`  ❌ Error processing mention @${mention}:`, mentionError);

			// If we found some creators before the error, process them
			if (discoveredCreators.length > 0) {
				console.log(
					`  ✓ Processing ${discoveredCreators.length} creators found before error`,
				);
				break;
			}

			// Continue to next mention
		}
	}

	return discoveredCreators;
}

/**
 * Processes a discovered creator using the same miner logic
 * Gets complete profile data and saves to InstagramAccountBase
 * @param following - The following account data
 * @param sourceMention - The @ mention that led to discovery
 * @param originalPostUrl - URL of the original giveaway post
 * @returns Saved account data or null if not saved
 */
function* processDiscoveredCreatorWithMiner(
	following: { username: string; id: string },
	sourceMention: string,
	originalPostUrl: string,
) {
	try {
		console.log(`    🔧 Processing @${following.username} with miner logic...`);

		// Import required modules (same as miners)
		const { extractEmail } = require("extract-email-address");
		const {
			browser_mine_web_profiles,
		} = require("backend/src/mining/instagramMiner/mineWebProfiles");
		const {
			InstagramDB,
			getDaysSince2020,
		} = require("backend/src/mining/InstagramDB");

		// Get complete web profile data (same as miners)
		const webProfiles: Awaited<ReturnType<typeof browser_mine_web_profiles>> =
			yield* Effect.scoped(browser_mine_web_profiles([following.username]));

		if (!webProfiles[0]?.success) {
			console.log(`    ⚠️ Could not get web profile for @${following.username}`);
			return null;
		}

		const webProfile = webProfiles[0].data;

		// Extract email from bio (same as miners)
		const email = extractEmail(webProfile.biography)[0]?.email;

		// Check if meets criteria (same as miners)
		const is_target =
			webProfile.edge_followed_by.count >= 7_000 &&
			webProfile.edge_followed_by.count <= 100_000 &&
			!webProfile.is_private;

		if (!is_target) {
			console.log(
				`    ⚠️ Account @${following.username} doesn't meet criteria (followers: ${webProfile.edge_followed_by.count})`,
			);
			return null;
		}

		// Get country data (same as findMissingCountires.ts)
		let countryData = null;
		try {
			console.log(
				`    📡 API Call: Getting country data for @${following.username} (${webProfile.id})`,
			);
			countryData = yield* HikerAPI.about_req(webProfile.id);
		} catch (countryError) {
			console.log(
				`    ⚠️ Could not get country data for @${following.username}`,
			);
		}

		// Prepare account data (same as miners)
		const accountData = {
			id: webProfile.id,
			username: following.username,
			last_searched: new Date(),
			is_verified: webProfile.is_verified,
			bio: webProfile.biography,
			external_link: webProfile.external_url || "",
			followers_count: webProfile.edge_followed_by.count,
			following_count: webProfile.edge_follow.count,
			ig_email: email ?? undefined,
			ig_category_enum: webProfile.category_name,
			ig_full_name: webProfile.full_name,
			posts_count: webProfile.edge_owner_to_timeline_media.count,
			pfpUrl: webProfile.profile_pic_url_hd,
			// Country data (if available)
			country: countryData?.country || null,
			account_created_at: countryData?.date || null,
			// Use existing columns to track mention discovery
			// Store source mention in business_name field
			business_name: `MENTION_DISCOVERED:${sourceMention}`,
		};

		// Prepare history data (same as miners)
		const historyData = {
			followers: webProfile.edge_followed_by.count,
			following: webProfile.edge_follow.count,
			postsCount: webProfile.edge_owner_to_timeline_media.count,
			user_id: webProfile.id,
			day: getDaysSince2020(),
		};

		// Prepare posts data (same as miners)
		const postsData = webProfile.edge_owner_to_timeline_media.edges.map(
			(e: {
				node: {
					id: string;
					edge_media_to_caption: {
						edges: Array<{ node: { text: string } }>;
					};
					edge_media_to_comment: { count: number };
					edge_liked_by: { count: number };
					taken_at_timestamp: number;
					shortcode: string;
					video_view_count?: number;
					product_type?: string;
					edge_media_preview_like?: { count: number };
				};
			}) => ({
				id: e.node.id,
				user_id: webProfile.id,
				caption: e.node.edge_media_to_caption.edges[0]?.node.text ?? "",
				comment_count: e.node.edge_media_to_comment.count,
				like_count: e.node.edge_liked_by.count,
				shortcode: e.node.shortcode,
				taken_at: new Date(e.node.taken_at_timestamp * 1000),
				play_count: e.node.video_view_count ?? 0,
				product_type: e.node.product_type ?? "",
				likes_disabled: (e.node.edge_media_preview_like?.count ?? 0) === -1,
			}),
		);

		// Save to database using same logic as miners
		yield* InstagramDB.insertAccount(
			following.username,
			undefined, // No batch_id for mention-discovered accounts
			accountData,
			historyData,
			postsData,
		);

		console.log(
			`    ✅ Successfully saved @${following.username} to InstagramAccountBase`,
		);

		return {
			...accountData,
			email: email,
			country: countryData?.country || null,
		};
	} catch (error) {
		console.error(
			`    ❌ Error processing @${following.username} with miner logic:`,
			error,
		);
		return null;
	}
}

/** ACTIVE GUARD: re-check task.is_active on demand */
const isTaskActive = (taskId: number | string) =>
	db
		.selectFrom("FilterCloneTask")
		.select("is_active")
		.where("id", "=", taskId)
		.executeTakeFirst()
		.then((row) => !!row?.is_active);

/** Paged fetch */
const fetchAccountsForCountries = (
	countries: string[],
	min_followers: number,
	max_followers: number,
	limit = 600,
	offset = 0,
) =>
	baseDb
		.selectFrom("InstagramAccountBase")
		.innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
		.leftJoin(
			"EmailSequence",
			"EmailSequence.instagram_account_id",
			"InstagramAccountBase.id",
		)
		.where((eb) =>
			eb.not(
				eb(
					"InstagramAccountBase.id",
					"in",
					db.selectFrom("blockusers").select("ig_id"),
				),
			),
		)
		.where("InstagramAccountBase.country", "in", countries)
		.where("InstagramAccountBase.first_name", "!=", "No name found")
		.where("Email.code", "<>", 6)
		.where("Email.code", "<>", 7)
		.where("InstagramAccountBase.followers_count", ">", min_followers)
		.where("InstagramAccountBase.followers_count", "<", max_followers)
		.where("InstagramAccountBase.blacklist", "=", false)
		.where("InstagramAccountBase.blacklisted_at", "is", null)
		.where("Email.blacklisted_at", "is", null)
		.where("EmailSequence.id", "is", null)
		.select([
			"InstagramAccountBase.id as id",
			"Email.email as email",
			"InstagramAccountBase.username",
		])
		.distinctOn(["InstagramAccountBase.id"])
		.orderBy("InstagramAccountBase.id", "asc") // Stable ordering for consistent pagination
		.limit(limit)
		.offset(offset)
		.execute();

/** Main effect */
// export const importAccountsToEmailSequenceCronKeywords = Effect.gen(
// 	function* () {
// 		console.log("[ImportAccountsCron] Started at", new Date().toISOString());

// 		const filterCloneTasks = yield* Effect.promise(() =>
// 			db
// 				.selectFrom("FilterCloneTask as fct")
// 				.select((eb) => [
// 					eb.ref("fct.id").as("id"),
// 					eb.ref("fct.title").as("title"),
// 					eb.ref("fct.target").as("target"),
// 					eb.ref("fct.target_male").as("target_male"),
// 					eb.ref("fct.target_female").as("target_female"),
// 					eb.ref("fct.target_country").as("target_country"),
// 					eb.ref("fct.createdAt").as("createdAt"),
// 					eb.ref("fct.keywords").as("keywords"),
// 					eb.ref("fct.min_followers").as("min_followers"),
// 					eb.ref("fct.max_followers").as("max_followers"),
// 					eb.ref("fct.post_date").as("post_date"),
// 					eb.ref("fct.result_limit").as("result_limit"),
// 					eb.ref("fct.found").as("found"),
// 					eb.ref("fct.is_active").as("is_active"),
// 					eb.ref("fct.maxPerDay").as("maxPerDay"),
// 				])
// 				.where("fct.is_active", "=", true)
// 				.execute(),
// 		);

// 		const tasksToProcess = filterCloneTasks.filter(
// 			(t) =>
// 				typeof t.result_limit === "number" &&
// 				typeof t.found === "number" &&
// 				(t.found ?? 0) < t.result_limit + (t.maxPerDay ?? 0),
// 		);

// 		console.log(
// 			`[ImportAccountsCron] Found ${tasksToProcess.length} tasks to process`,
// 		);

// 		for (const filterCloneTask of tasksToProcess) {
// 			const {
// 				id,
// 				target_country,
// 				keywords,
// 				min_followers,
// 				max_followers,
// 				post_date,
// 				result_limit,
// 				found,
// 				maxPerDay,
// 			} = filterCloneTask;

// 			const country = target_country ?? "";
// 			if (!country) continue;

// 			const pageSize = 600;
// 			let page = 0;
// 			let currentFound = found ?? 0;

// 			/** ACTIVE GUARD: quick check before starting this task */
// 			if (!(yield* Effect.promise(() => isTaskActive(id)))) {
// 				console.log(
// 					`[ImportAccountsCron] Task ${id} turned inactive before start; skipping.`,
// 				);
// 				continue;
// 			}

// 			while (true) {
// 				// ACTIVE GUARD: check before fetching each page
// 				const stillActive = yield* Effect.promise(() => isTaskActive(id));
// 				if (!stillActive) {
// 					console.log(
// 						`[ImportAccountsCron] Task ${id} became inactive; stopping pagination at page ${page + 1}.`,
// 					);
// 					break;
// 				}

// 				if (currentFound >= (result_limit ?? 0) + (maxPerDay ?? 0)) break;

// 				const offset = page * pageSize;
// 				const rowsRaw = yield* Effect.promise(() =>
// 					fetchAccountsForCountries(
// 						[country],
// 						min_followers,
// 						max_followers,
// 						pageSize,
// 						offset,
// 					),
// 				);
// 				console.log(rowsRaw.length);

// 				if (!rowsRaw.length) break;

// 				console.log(
// 					`[ImportAccountsCron] Page ${page + 1} fetched ${rowsRaw.length} accounts (offset=${offset})`,
// 				);

// 				for (const [index, account] of rowsRaw.entries()) {
// 					if (currentFound >= (result_limit ?? 0) + (maxPerDay ?? 0)) break;

// 					/** ACTIVE GUARD: light periodic re-check during the page (every ~50) */
// 					if (index % 50 === 0) {
// 						const activeMidPage = yield* Effect.promise(() => isTaskActive(id));
// 						if (!activeMidPage) {
// 							console.log(
// 								`[ImportAccountsCron] Task ${id} became inactive mid-page; halting immediately.`,
// 							);
// 							// break out of both loops
// 							page = Number.MAX_SAFE_INTEGER; // sentinel to ensure outer loop stops
// 							break;
// 						}
// 					}

// 					let matchfound = false;
// 					let postUrl = "";
// 					let post_caption = "";
// 					try {
// 						const posts =
// 							(yield* HikerAPI.user_medias_by_id(account.id, {
// 								after:
// 									typeof post_date === "string"
// 										? new Date(post_date)
// 										: (post_date ?? undefined),
// 							})) || [];

// 						const keywordList: string[] = Array.isArray(keywords)
// 							? keywords.filter((k): k is string => typeof k === "string")
// 							: typeof keywords === "string"
// 								? keywords
// 										.split(",")
// 										.map((k) => k.trim())
// 										.filter(Boolean)
// 								: [];

// 						for (const post of posts) {
// 							const desc: string =
// 								(typeof post?.caption === "string"
// 									? post.caption
// 									: post?.caption?.text) ?? "";
// 							if (!desc) continue;

// 							if (hasKeyword(desc, keywordList)) {
// 								matchfound = true;
// 								postUrl = `https://instagram.com/p/${post.code || post.id}`;
// 								post_caption = desc;

// 								break;
// 							}
// 						}

// 						console.log(
// 							`[p${page + 1}:${index + 1}/${rowsRaw.length}] Checked ${account.id} – match=${matchfound}`,
// 						);
// 					} catch (err) {
// 						console.error(`Error fetching posts for ${account.id}:`, err);
// 					}

// 					if (!matchfound) continue;

// 					try {
// 						const existing = yield* Effect.promise(() =>
// 							db
// 								.selectFrom("TriggerTask")
// 								.select("id")
// 								.where("email", "=", account.email)
// 								.where("triggerid", "=", id)
// 								.executeTakeFirst(),
// 						);

// 						if (existing) {
// 							console.log(
// 								`[p${page + 1}:${index + 1}/${rowsRaw.length}] Skipping duplicate email for account ${account.id}`,
// 							);
// 							continue;
// 						}
// 						const highestTrigger = (yield* Effect.promise(() =>
// 							db
// 								.selectFrom("TriggerTask as tt")
// 								.select("tt.id")
// 								.orderBy("tt.id", "desc")
// 								.executeTakeFirst(),
// 						)) as { id?: number } | undefined;

// 						const highestTriggerId =
// 							highestTrigger && typeof highestTrigger.id === "number"
// 								? highestTrigger.id
// 								: 0;
// 						try {
// 							const highestSequence = yield* Effect.promise(() =>
// 								db
// 									.selectFrom("EmailSequence")
// 									.select("id")
// 									.orderBy("id", "desc")
// 									.executeTakeFirstOrThrow(),
// 							);
// 							const highestSequenceId = highestSequence?.id ?? 0;
// 							const now = new Date();
// 							yield* Effect.promise(() =>
// 								db
// 									.insertInto("EmailSequence")
// 									.values({
// 										id: highestSequenceId + 1,
// 										instagram_account_id: account.id,
// 										current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
// 										current_stage_number: Number(id),
// 										email: account.email,
// 										stage_entered_at: now,
// 										next_action_possible_at: now,
// 										trigger_window_ends_at: null,
// 										last_instantly_campaign_completed_at: null,
// 										created_at: now,
// 										updated_at: now,
// 									})
// 									.returningAll()
// 									.executeTakeFirstOrThrow()
// 									.catch((e) => {
// 										console.log(account);
// 									}),
// 							);
// 						} catch {
// 							console.log("EmailSequence insert check: fallback");
// 						}
// 						const inserted = yield* pipe(
// 							Effect.promise(() =>
// 								db
// 									.insertInto("TriggerTask")
// 									.values({
// 										id: Number(highestTriggerId) + 1,
// 										instagram_account_id: account.id,
// 										current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
// 										current_stage_number: 3,
// 										email: account.email,
// 										stage_entered_at: new Date(),
// 										next_action_possible_at: new Date(),
// 										trigger_window_ends_at: null,
// 										last_instantly_campaign_completed_at: null,
// 										triggerid: id as number | string,
// 										created_at: new Date(),
// 										updated_at: new Date(),
// 										post_url: postUrl,
// 										post_text: post_caption,
// 									})
// 									.returningAll()
// 									.executeTakeFirstOrThrow(),
// 							),
// 							Effect.catchAll((e: unknown) =>
// 								Effect.sync(() => {
// 									console.error(
// 										`[p${page + 1}:${index + 1}/${rowsRaw.length}] Error creating trigger for ${account.id}: ${String(e)}`,
// 									);
// 									console.log(account);
// 									return null;
// 								}),
// 							),
// 						);

// 						if (inserted) {
// 							yield* pipe(
// 								Effect.promise(() =>
// 									db
// 										.updateTable("FilterCloneTask")
// 										.set({ found: sql<number>`coalesce(found, 0) + 1` })
// 										.where("id", "=", id)
// 										.executeTakeFirst(),
// 								),
// 								Effect.catchAll((e: unknown) =>
// 									Effect.sync(() => {
// 										console.error(
// 											`[p${page + 1}:${index + 1}/${rowsRaw.length}] Error incrementing 'found' for FilterCloneTask ${id}: ${String(e)}`,
// 										);
// 									}),
// 								),
// 								Effect.ignore,
// 							);

// 							currentFound += 1;
// 						}
// 					} catch (e) {
// 						console.log("TriggerTask insert check: fallback", e);
// 					}
// 				} // end per-row loop

// 				// If we used the sentinel to break outer loop, stop now
// 				if (page === Number.MAX_SAFE_INTEGER) break;

// 				page += 1;
// 			} // end paging loop
// 		}

// 		console.log("[ImportAccountsCron] Finished at", new Date().toISOString());
// 	},
// ).pipe(Effect.schedule(Schedule.cron("*/30 * * * *")));

// if (import.meta.main) {
// 	Effect.runPromise(importAccountsToEmailSequenceCronKeywords)
// 		.then(() => {
// 			console.log("[ImportAccountsCron] Completed");
// 			process.exit(0);
// 		})
// 		.catch((err) => {
// 			console.error("[ImportAccountsCron] Error:", err);
// 			process.exit(1);
// 		});
// }

// ...existing code...

/**
 * Database Search Flow (Flow 1 + Flow 3)
 * Searches existing accounts in database for keyword matches
 * EXACT COPY of the original implementation
 */
function databaseSearchFlow(filterCloneTask: {
	id: string | number;
	keywords: string | null;
	min_followers: number | null;
	max_followers: number | null;
	target_country: string | null;
	post_date: string | Date | null;
	result_limit: number | null;
	found: number | null;
	maxPerDay: number | null;
	enable_mentions_scraping: boolean | null;
	enable_hashtag_scraping: boolean | null;
	last_processed_offset: number | null;
}) {
	return Effect.gen(function* () {
		const {
			id,
			target_country,
			keywords,
			min_followers,
			max_followers,
			post_date,
			result_limit,
			found,
			maxPerDay,
			last_processed_offset,
		} = filterCloneTask;

		const country = target_country ?? "";
		if (!country) return;

		console.log(`🗄️ Starting Database Search Flow for task ${id}`);
		console.log(
			`🔍 Search criteria: country=${target_country}, keywords="${keywords}", followers=${min_followers}-${max_followers}`,
		);
		console.log(
			`📈 Progress: found=${found}/${result_limit}, maxPerDay=${maxPerDay}`,
		);

		const pageSize = 600;
		// Resume from last processed offset if task was stopped and restarted
		const lastOffset = last_processed_offset ?? 0;
		// Calculate starting page from saved offset
		let page = Math.floor(lastOffset / pageSize);
		let currentFound = found ?? 0;

		// Use lastOffset directly for first iteration to ensure exact resume point
		const currentOffset = lastOffset;
		let isFirstIteration = true;

		console.log(
			`📊 Resuming from batch ${page + 1} (offset=${lastOffset}) - will continue from where we left off`,
		);

		while (
			(yield* Effect.promise(() => isTaskActive(id))) &&
			currentFound < (result_limit ?? 0) + (maxPerDay ?? 0)
		) {
			// ACTIVE GUARD: check before fetching each page

			// On first iteration, use lastOffset directly; after that, calculate from page
			const offset = isFirstIteration ? currentOffset : page * pageSize;
			console.log(
				`📥 Fetching accounts: page=${page + 1}, offset=${offset}, limit=${pageSize} ${isFirstIteration ? "(resuming from saved offset)" : ""}`,
			);

			const rowsRaw = yield* Effect.promise(() =>
				fetchAccountsForCountries(
					[country],
					min_followers ?? 0,
					max_followers ?? 0,
					pageSize,
					offset,
				),
			);

			// After first iteration, switch to page-based calculation
			isFirstIteration = false;

			if (!rowsRaw.length) {
				// No more accounts found - reset offset for next run
				console.log(
					`[ImportAccountsCron] No more accounts found at offset ${offset}. Resetting offset for next cycle.`,
				);
				yield* Effect.promise(() =>
					db
						.updateTable("FilterCloneTask")
						.set({ last_processed_offset: 0 })
						.where("id", "=", id)
						.executeTakeFirst(),
				);
				break;
			}

			console.log(
				`[ImportAccountsCron] Page ${page + 1} fetched ${rowsRaw.length} accounts (offset=${offset})`,
			);

			for (const [index, account] of rowsRaw.entries()) {
				if (currentFound >= (result_limit ?? 0) + (maxPerDay ?? 0)) break;

				let matchfound = false;
				let postUrl = "";
				let post_caption = "";

				try {
					console.log(
						`📡 [Browser Proxy] Starting to fetch posts for account ${account.id}...`,
					);
					console.log(
						`📡 [Browser Proxy] Using browser_mine_web_profiles for @${account.username}`,
					);
					console.log(
						`📡 [Browser Proxy] Calling browser_mine_web_profiles() at ${new Date().toISOString()}`,
					);

					// Fetch posts using browser_mine_web_profiles through proxy with retry
					const {
						browser_mine_web_profiles,
					} = require("backend/src/mining/instagramMiner/mineWebProfiles");

					console.log(
						`📡 [Browser Proxy] Executing browser_mine_web_profiles([${account.username}])...`,
					);

					// Retry with different proxy if this fails
					let webProfileResults:
						| Awaited<ReturnType<typeof browser_mine_web_profiles>>
						| undefined;
					let retryCount = 0;
					const maxRetries = 3;

					while (retryCount < maxRetries) {
						try {
							webProfileResults = yield* browser_mine_web_profiles([
								account.username,
							]);

							// Check if results are actually valid (not empty due to proxy failure)
							if (!webProfileResults || webProfileResults.length === 0) {
								console.log(
									`❌ [Browser Proxy] No results returned for @${account.username}, treating as proxy failure`,
								);
								throw new Error("Empty results - likely proxy failure");
							}

							console.log(
								`✅ [Browser Proxy] Success on attempt ${retryCount + 1}`,
							);
							break;
						} catch (proxyError) {
							retryCount++;
							console.log(
								`⚠️ [Browser Proxy] Attempt ${retryCount} failed: ${proxyError}`,
							);

							if (retryCount >= maxRetries) {
								console.log(
									`❌ [Browser Proxy] All ${maxRetries} attempts failed, skipping account`,
								);
								throw proxyError;
							}

							console.log(
								`🔄 [Browser Proxy] Retrying with different proxy (attempt ${retryCount + 1}/${maxRetries})...`,
							);
							yield* Effect.sleep(2000); // Wait 2 seconds before retry
						}
					}

					console.log(
						`📡 [Browser Proxy] browser_mine_web_profiles completed at ${new Date().toISOString()}`,
					);

					if (!webProfileResults || webProfileResults.length === 0) {
						console.log(
							`❌ [Browser Proxy] No results returned for @${account.username}`,
						);
						continue;
					}

					if (!webProfileResults[0].success) {
						console.log(
							`❌ [Browser Proxy] Failed to fetch posts for @${account.username}, error: ${webProfileResults[0].error}`,
						);
						continue;
					}

					console.log(
						`✅ [Browser Proxy] Successfully fetched web profile for @${account.username}`,
					);

					const webProfile = webProfileResults[0].data;
					console.log(
						"📸 [Browser Proxy] Extracting posts from web profile...",
					);
					console.log(
						`📊 [Browser Proxy] Web profile stats: followers=${webProfile.edge_followed_by.count}, following=${webProfile.edge_follow.count}, posts=${webProfile.edge_owner_to_timeline_media.count}`,
					);

					const allPosts = webProfile.edge_owner_to_timeline_media.edges.map(
						(e: { node: Record<string, unknown> }) => e.node,
					);
					console.log(
						`📸 [Browser Proxy] Found ${allPosts.length} posts in web profile`,
					);

					// Filter posts by date if post_date is provided
					let posts = allPosts;
					if (post_date) {
						const afterTimestamp =
							(typeof post_date === "string"
								? new Date(post_date).getTime()
								: post_date.getTime()) / 1000;

						console.log(
							`📅 [Browser Proxy] Filtering posts after date: ${new Date(afterTimestamp * 1000).toISOString()}`,
						);
						posts = allPosts.filter(
							(post: Record<string, unknown>) =>
								(post.taken_at_timestamp as number) >= afterTimestamp,
						);
						console.log(
							`📅 [Browser Proxy] Filtered ${allPosts.length} posts to ${posts.length} posts after ${new Date(afterTimestamp * 1000).toISOString()}`,
						);
					}

					// Map to the expected format (similar to HikerAPI response)
					console.log("🔄 [Browser Proxy] Mapping posts to expected format...");
					const mappedPosts = posts.map((post: Record<string, unknown>) => {
						const edge_media_to_caption =
							(post.edge_media_to_caption as Record<string, unknown>) || {};
						const edges =
							(edge_media_to_caption.edges as Array<Record<string, unknown>>) ||
							[];
						const edge_media_to_caption_text = edges[0]?.node as Record<
							string,
							unknown
						>;
						const caption_text =
							(edge_media_to_caption_text?.text as string) || "";

						const edge_media_preview_like =
							(post.edge_media_preview_like as Record<string, unknown>) || {};
						const edge_media_to_comment =
							(post.edge_media_to_comment as Record<string, unknown>) || {};

						return {
							id: post.id,
							code: post.shortcode,
							caption: caption_text,
							taken_at: post.taken_at_timestamp,
							like_count: edge_media_preview_like.count,
							comment_count: edge_media_to_comment.count,
							is_video: post.is_video,
							product_type: post.product_type,
						};
					});

					console.log(
						`✅ [Browser Proxy] Successfully retrieved and mapped ${mappedPosts.length} posts for @${account.username}`,
					);

					const keywordList: string[] = Array.isArray(keywords)
						? keywords.filter((k): k is string => typeof k === "string")
						: typeof keywords === "string"
							? keywords
									.split(",")
									.map((k) => k.trim())
									.filter(Boolean)
							: [];

					for (const post of mappedPosts) {
						const desc: string =
							(typeof post?.caption === "string"
								? post.caption
								: post?.caption?.text) ?? "";

						if (!desc) {
							console.log(
								`📝 Post ${post.code || post.id} has no caption - skipping`,
							);
							continue;
						}

						console.log(
							`🔍 Checking post ${post.code || post.id} for keywords:`,
						);
						console.log(
							`   📝 Post caption: "${desc.substring(0, 100)}${desc.length > 100 ? "..." : ""}"`,
						);
						console.log(
							`   🎯 Looking for keywords: [${keywordList.join(", ")}]`,
						);

						const keywordResult = hasKeyword(desc, keywordList);
						console.log(
							`   ✅ Match result: ${keywordResult.match ? `MATCH FOUND! Keyword: "${keywordResult.matchedKeyword}"` : "No match"}`,
						);

						if (keywordResult.match) {
							console.log(
								`🎯 DATABASE FLOW: KEYWORD MATCH FOUND! Post: ${post.code || post.id}`,
							);
							matchfound = true;
							postUrl = `https://instagram.com/p/${post.code || post.id}`;
							post_caption = desc;

							// Extract @ mentions from the giveaway post
							const mentions = extractMentions(desc);
							console.log(
								`[${index + 1}/${rowsRaw.length}] Found giveaway post with ${mentions.length} mentions:`,
								mentions,
							);

							// Process @ mentions and their followings (only if enabled)
							console.log(
								`🔍 DATABASE FLOW: Checking mentions scraping - ${filterCloneTask.enable_mentions_scraping === true ? "ENABLED" : "DISABLED"}, found ${mentions.length} mentions`,
							);
							if (
								filterCloneTask.enable_mentions_scraping === true &&
								mentions.length > 0
							) {
								console.log(
									`[${index + 1}/${rowsRaw.length}] Processing ${mentions.length} mentions for following scraping...`,
								);

								// Use the helper function for creator discovery
								const discoveredCreators =
									yield* processMentionsForCreatorDiscovery(mentions, postUrl);

								// Add discovered creators to the same batch for processing
								if (discoveredCreators.length > 0) {
									console.log(
										`  🎉 Discovered ${discoveredCreators.length} additional creators from @ mentions:`,
									);
									for (const creator of discoveredCreators) {
										console.log(
											`    - @${creator.account.username} (from @${creator.sourceMention})`,
										);
									}

									// Convert discovered creators to the same format as fetchAccountsForCountries
									const discoveredAccounts = discoveredCreators
										.filter((creator) => creator.savedAccount?.ig_email) // Must have email
										.map((creator) => ({
											id: creator.savedAccount.id,
											email: creator.savedAccount.ig_email,
											postUrl: creator.postUrl,
											postCaption: creator.postCaption,
											sourceMention: creator.sourceMention,
											originalPost: creator.originalPost,
										}));

									// Add discovered accounts to the current batch
									// Map discovered accounts to match the expected format { id, email, username }
									const mappedDiscoveredAccounts = discoveredAccounts.map(
										(acc) => ({
											id: acc.id,
											email: acc.email,
											username: acc.email.split("@")[0] || "unknown", // Extract username from email or use placeholder
										}),
									);
									rowsRaw.push(...mappedDiscoveredAccounts);
									console.log(
										`  📝 Added ${discoveredAccounts.length} discovered creators to batch (total: ${rowsRaw.length})`,
									);
								} else {
									console.log(
										"  ℹ️ No additional creators discovered from @ mentions",
									);
								}
							} else if (mentions.length > 0) {
								console.log(
									`[${index + 1}/${rowsRaw.length}] Mentions scraping disabled, skipping ${mentions.length} mentions`,
								);
							}

							break;
						}
					}
				} catch (err) {
					console.error(`❌ Error fetching posts for ${account.id}:`, err);
				}

				console.log(
					`[p${page + 1}:${index + 1}/${rowsRaw.length}] Checked ${account.id} – match=${matchfound}`,
				);

				if (!matchfound) {
					console.log(
						`❌ No match for ${account.id} - continuing to next account`,
					);
					continue;
				}

				console.log(`✅ MATCH FOUND for ${account.id}! Processing account...`);

				// Log account type for debugging
				const isDiscoveredCreator = (account as { sourceMention?: string })
					.sourceMention;
				if (isDiscoveredCreator) {
					console.log(
						`[${index + 1}/${rowsRaw.length}] Processing discovered creator @${account.id} (from @${isDiscoveredCreator})`,
					);
				}

				try {
					console.log(
						`🔍 Checking if TriggerTask already exists for email: ${account.email}`,
					);
					const existing = yield* Effect.promise(() =>
						db
							.selectFrom("TriggerTask")
							.select("id")
							.where("email", "=", account.email)
							.where("triggerid", "=", id)
							.executeTakeFirst(),
					);

					if (existing) {
						console.log(
							`⏭️ TriggerTask already exists for ${account.email}, skipping`,
						);
						continue;
					}

					console.log(`✅ Creating new TriggerTask for ${account.email}`);

					// Create TriggerTask (same as original)
					const highestTrigger = (yield* Effect.promise(() =>
						db
							.selectFrom("TriggerTask as tt")
							.select("tt.id")
							.orderBy("tt.id", "desc")
							.executeTakeFirst(),
					)) as { id?: number } | undefined;

					const highestTriggerId =
						highestTrigger && typeof highestTrigger.id === "number"
							? highestTrigger.id
							: 0;

					const inserted = yield* pipe(
						Effect.promise(() =>
							db
								.insertInto("TriggerTask")
								.values({
									id: Number(highestTriggerId) + 1,
									instagram_account_id: account.id,
									current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
									current_stage_number: 3,
									email: account.email,
									stage_entered_at: new Date(),
									next_action_possible_at: new Date(),
									trigger_window_ends_at: null,
									last_instantly_campaign_completed_at: null,
									triggerid: id as number | string,
									created_at: new Date(),
									updated_at: new Date(),
									// Use discovered creator data if available, otherwise use original post data
									post_url:
										(account as { postUrl?: string }).postUrl || postUrl,
									post_text:
										(account as { postCaption?: string }).postCaption ||
										post_caption,
								})
								.returningAll()
								.executeTakeFirstOrThrow(),
						),
						Effect.catchAll((e: unknown) =>
							Effect.sync(() => {
								console.error(
									`[p${page + 1}:${index + 1}/${rowsRaw.length}] Error creating trigger for ${account.id}: ${String(e)}`,
								);
								console.log(account);
								return null;
							}),
						),
					);

					if (inserted) {
						console.log(
							`🎉 SUCCESS! Created TriggerTask for ${account.email} (ID: ${inserted.id})`,
						);

						console.log(
							`📊 Updating task counter: found=${currentFound} -> ${currentFound + 1}`,
						);
						// Update FilterCloneTask found count (same as original)
						yield* pipe(
							Effect.promise(() =>
								db
									.updateTable("FilterCloneTask")
									.set({ found: sql<number>`coalesce(found, 0) + 1` })
									.where("id", "=", id)
									.executeTakeFirst(),
							),
							Effect.catchAll((e: unknown) =>
								Effect.sync(() => {
									console.error(
										`[p${page + 1}:${index + 1}/${rowsRaw.length}] Error incrementing 'found' for FilterCloneTask ${id}: ${String(e)}`,
									);
								}),
							),
							Effect.ignore,
						);

						currentFound += 1;
					}
				} catch (e) {
					console.log("TriggerTask insert check: fallback", e);
				}
			} // end per-row loop

			// Update last_processed_offset after processing each batch
			// Save the offset for the NEXT batch (current offset + batch size)
			const nextOffset = offset + pageSize;
			yield* Effect.promise(() =>
				db
					.updateTable("FilterCloneTask")
					.set({ last_processed_offset: nextOffset })
					.where("id", "=", id)
					.executeTakeFirst()
					.catch((e) => {
						console.error(
							`Error updating last_processed_offset for task ${id}:`,
							e,
						);
					}),
			);
			console.log(
				`✅ Batch ${page + 1} completed (processed offset ${offset}-${offset + rowsRaw.length - 1}). Updated last_processed_offset to ${nextOffset}`,
			);

			page += 1;
		} // end paging loop

		console.log(`✅ Database Search Flow completed for task ${id}`);
	});
}

/**
 * Hashtag Search Flow (Flow 2)
 * Searches Instagram hashtags for posts containing keywords
 */
function hashtagSearchFlow(filterCloneTask: {
	id: string | number;
	keywords: string | null;
	min_followers: number | null;
	max_followers: number | null;
	target_country: string | null;
	enable_mentions_scraping: boolean | null;
	enable_hashtag_scraping: boolean | null;
	post_date: string | Date | null;
}) {
	return Effect.gen(function* () {
		const { id, keywords, min_followers, max_followers, target_country } =
			filterCloneTask;

		const keywordList: string[] = keywords
			? keywords
					.split(",")
					.map((k) => k.trim())
					.filter(Boolean)
			: [];

		console.log(`🏷️ Starting Hashtag Search Flow for task ${id}`);
		console.log(
			`🔍 Hashtag search criteria: keywords="${keywords}", followers=${min_followers}-${max_followers}, country=${target_country}`,
		);
		console.log(`📝 Keywords to search: [${keywordList.join(", ")}]`);

		// Collect all discovered accounts from hashtag posts
		const discoveredAccounts: Array<{
			id: string;
			email: string;
			postUrl: string;
			postCaption: string;
			sourceMention?: string;
			originalPost?: string;
		}> = [];

		// Search each keyword as a hashtag
		for (const keyword of keywordList) {
			if (!(yield* Effect.promise(() => isTaskActive(id)))) break;

			console.log(`🔍 Searching hashtag #${keyword}`);

			try {
				// Pagination variables
				let pageId: string | undefined = undefined;
				const allPosts: MediaItem[] = [];
				let hasMorePages = true;
				const taskPostDate = filterCloneTask.post_date
					? typeof filterCloneTask.post_date === "string"
						? new Date(filterCloneTask.post_date)
						: filterCloneTask.post_date
					: new Date(0); // Default to epoch if no date specified

				console.log(`📅 Filtering posts after: ${taskPostDate.toISOString()}`);

				// Paginate through all hashtag posts
				while (hasMorePages) {
					console.log(
						`📄 Fetching page for hashtag #${keyword}${pageId ? ` (page_id: ${pageId})` : ""}`,
					);

					const hashtagPostsRaw = yield* HikerAPI.hashtag_medias_recent_v2(
						keyword,
						pageId,
					);
					const hashtagPosts: MediaItem[] = hashtagPostsRaw as MediaItem[];

					if (!hashtagPosts || hashtagPosts.length === 0) {
						console.log(`📄 No more posts found for hashtag #${keyword}`);
						hasMorePages = false;
						break;
					}

					console.log(
						`📸 Found ${hashtagPosts.length} posts in this page for hashtag #${keyword}`,
					);

					// Filter posts by date
					const filteredPosts = hashtagPosts.filter((post: MediaItem) => {
						const postDate = new Date(post.taken_at * 1000); // Convert timestamp to Date
						const isAfterTaskDate = postDate >= taskPostDate;

						if (!isAfterTaskDate) {
							console.log(
								`📅 Post ${post.code} is from ${postDate.toISOString()}, before task date ${taskPostDate.toISOString()}, stopping pagination`,
							);
						}

						return isAfterTaskDate;
					});

					// Add filtered posts to our collection
					allPosts.push(...filteredPosts);

					// If we got fewer posts than expected, or if any post was before our date, we've reached the end
					if (filteredPosts.length < hashtagPosts.length) {
						console.log(
							`📅 Reached posts before task date, stopping pagination for hashtag #${keyword}`,
						);
						hasMorePages = false;
						break;
					}

					// Get the page_id for next page (if available)
					// Note: This depends on the API response structure - you may need to adjust this
					const lastPost: MediaItem | undefined =
						hashtagPosts[hashtagPosts.length - 1];
					if (lastPost?.id) {
						pageId = lastPost.id;
					} else {
						console.log(
							`📄 No page_id found in last post, stopping pagination for hashtag #${keyword}`,
						);
						hasMorePages = false;
					}

					// Add a small delay between requests to be respectful to the API
					yield* Effect.sleep(1000); // 1 second delay
				}

				console.log(
					`📸 Total posts found for hashtag #${keyword}: ${allPosts.length} (after date filtering)`,
				);

				for (const post of allPosts) {
					if (!(yield* Effect.promise(() => isTaskActive(id)))) break;

					// For hashtag posts, we need to get user info differently
					// The post doesn't have user_id directly, so we'll skip user validation for now
					// and focus on processing @ mentions from the post caption

					console.log(`🔍 Processing hashtag post: ${post.code}`);

					// Require keyword match in caption, just like database flow
					const desc: string =
						(typeof post?.caption === "string"
							? post.caption
							: post?.caption?.text) ?? "";
					if (!desc) {
						continue;
					}
					const keywordResult = hasKeyword(desc, [keyword]);
					if (!keywordResult.match) {
						console.log(
							`🏷️ HASHTAG FLOW: No keyword match for "${keyword}" in post ${post.code} - skipping`,
						);
						continue;
					}
					console.log(
						`🏷️ HASHTAG FLOW: Keyword "${keywordResult.matchedKeyword}" found in post ${post.code}`,
					);

					const postUrl = `https://instagram.com/p/${post.code}`;
					const enableMentionScraping =
						filterCloneTask?.enable_mentions_scraping === true;

					// 1) Extract owner info directly from hashtag API response
					const postUser = (
						post as {
							user?: {
								username?: string;
								pk_id?: string;
								pk?: string;
								id?: string;
								is_private?: boolean;
							};
						}
					)?.user;
					if (!postUser) {
						console.log(
							`⚠️ HASHTAG FLOW: Post ${post.code} has no user info, skipping`,
						);
						continue;
					}

					const ownerUsername = postUser.username;
					const ownerId = postUser.pk_id || postUser.pk || postUser.id;
					const ownerIsPrivate = postUser.is_private === true;

					if (!ownerUsername || !ownerId) {
						console.log(
							`⚠️ HASHTAG FLOW: Post ${post.code} missing username/id, skipping`,
						);
						continue;
					}

					// 2) Check if user already exists in database
					const existingUser = yield* Effect.promise(() =>
						baseDb
							.selectFrom("InstagramAccountBase")
							.selectAll()
							.where("username", "=", ownerUsername)
							.executeTakeFirst(),
					);

					let savedAccount = existingUser;

					// 3) If user doesn't exist, process with miner to get full details
					if (!existingUser) {
						try {
							const minerResult = yield* processDiscoveredCreatorWithMiner(
								{ username: ownerUsername, id: ownerId },
								"POST_OWNER",
								postUrl,
							);
							if (minerResult) {
								savedAccount = minerResult as unknown as typeof existingUser;
							}
						} catch (e) {
							console.error(
								"HASHTAG FLOW: Failed to process owner with miner",
								e,
							);
							continue;
						}
					} else {
						console.log(
							`ℹ️ HASHTAG FLOW: Owner @${ownerUsername} already exists in database`,
						);
					}

					if (savedAccount) {
						// 4) Apply creator filters: followers, country, public
						const followersCount =
							"followers_count" in savedAccount
								? savedAccount.followers_count
								: 0;
						const country =
							"country" in savedAccount ? savedAccount.country : null;
						const isPrivate =
							"is_private" in savedAccount ? savedAccount.is_private : false;
						const email =
							"ig_email" in savedAccount
								? savedAccount.ig_email
								: "email" in savedAccount
									? (savedAccount as { email: string }).email
									: null;

						const followersOk =
							(followersCount ?? 0) >= (min_followers ?? 0) &&
							(followersCount ?? 0) <= (max_followers ?? 0);
						const countryOk = target_country
							? (country ?? null) === target_country
							: true;
						const publicOk = isPrivate === false;
						const emailOk = !!email;

						if (!followersOk || !countryOk || !publicOk) {
							// Blacklist owner if they do not match creator criteria
							try {
								yield* Effect.promise(() =>
									baseDb
										.updateTable("InstagramAccountBase")
										.set({ blacklist: true, blacklisted_at: new Date() })
										.where("id", "=", savedAccount.id)
										.execute(),
								);
								console.log(
									`🚫 HASHTAG FLOW: Blacklisted @${ownerUsername} (followersOk=${followersOk}, countryOk=${countryOk}, publicOk=${publicOk})`,
								);
							} catch (blErr) {
								console.error("HASHTAG FLOW: Failed to blacklist owner", blErr);
							}
							// Skip mentions if owner not a creator
							continue;
						}

						// 5) Owner matches criteria → create TriggerTask for owner
						if (emailOk && email) {
							try {
								const existingTrigger = yield* Effect.promise(() =>
									db
										.selectFrom("TriggerTask")
										.select("id")
										.where("email", "=", email)
										.where("triggerid", "=", id)
										.where("post_url", "=", postUrl)
										.executeTakeFirst(),
								);
								if (!existingTrigger) {
									const highestTrigger = (yield* Effect.promise(() =>
										db
											.selectFrom("TriggerTask as tt")
											.select("tt.id")
											.orderBy("tt.id", "desc")
											.executeTakeFirst(),
									)) as { id?: number } | undefined;

									const highestTriggerId = highestTrigger?.id ?? 0;
									const inserted = yield* pipe(
										Effect.promise(() =>
											db
												.insertInto("TriggerTask")
												.values({
													id: Number(highestTriggerId) + 1,
													instagram_account_id: savedAccount.id,
													current_stage:
														EmailSequenceStage.OPENER_PENDING_GENERATION,
													current_stage_number: 3,
													email: email,
													stage_entered_at: new Date(),
													next_action_possible_at: new Date(),
													trigger_window_ends_at: null,
													last_instantly_campaign_completed_at: null,
													triggerid: id as number | string,
													created_at: new Date(),
													updated_at: new Date(),
													post_url: postUrl,
													post_text: desc,
												})
												.returningAll()
												.executeTakeFirstOrThrow(),
										),
										Effect.catchAll((e: unknown) =>
											Effect.sync(() => {
												console.error(
													`HASHTAG FLOW: Error creating trigger for owner ${savedAccount.id}: ${String(e)}`,
												);
												console.log(savedAccount);
												return null;
											}),
										),
									);

									if (inserted) {
										console.log(
											`🎉 HASHTAG FLOW: SUCCESS! Created TriggerTask for owner ${email} (ID: ${inserted.id})`,
										);
										yield* pipe(
											Effect.promise(() =>
												db
													.updateTable("FilterCloneTask")
													.set({ found: sql<number>`coalesce(found, 0) + 1` })
													.where("id", "=", id)
													.executeTakeFirst(),
											),
											Effect.catchAll((e: unknown) =>
												Effect.sync(() => {
													console.error(
														`HASHTAG FLOW: Error incrementing 'found' for FilterCloneTask ${id}: ${String(e)}`,
													);
												}),
											),
											Effect.ignore,
										);
									}
								} else {
									console.log(
										`⏭️ HASHTAG FLOW: TriggerTask already exists for owner ${email}, skipping`,
									);
								}
							} catch (e) {
								console.error(
									"HASHTAG FLOW: Owner TriggerTask creation failed",
									e,
								);
							}
						}
					}

					// 4) Mentions scraping (only if enabled)
					const postCaption = desc;
					const mentions = extractMentions(postCaption);
					if (enableMentionScraping && mentions.length > 0) {
						console.log(
							`🏷️ HASHTAG FLOW: Found post with ${mentions.length} mentions:`,
							mentions,
						);
						const discoveredCreators =
							yield* processMentionsForCreatorDiscovery(mentions, postUrl);

						// Add discovered creators to the batch for processing
						const localDiscoveredAccounts = discoveredCreators
							.filter((creator) => creator.savedAccount?.ig_email) // Must have email
							.map((creator) => ({
								id: creator.savedAccount.id,
								email: creator.savedAccount.ig_email,
								postUrl: creator.postUrl,
								postCaption: creator.postCaption,
								sourceMention: creator.sourceMention,
								originalPost: creator.originalPost,
							}));

						for (const account of localDiscoveredAccounts) {
							console.log(
								`🏷️ HASHTAG FLOW: Adding discovered account @${account.id} (from @${account.sourceMention}) to batch`,
							);
						}

						discoveredAccounts.push(...localDiscoveredAccounts);
					}
				}
			} catch (err) {
				console.error(`❌ Error searching hashtag #${keyword}:`, err);
			}
		}

		// Process all discovered accounts through the same pipeline as database flow
		if (discoveredAccounts.length > 0) {
			console.log(
				`🏷️ HASHTAG FLOW: Processing ${discoveredAccounts.length} discovered accounts through pipeline`,
			);

			for (const account of discoveredAccounts) {
				if (!(yield* Effect.promise(() => isTaskActive(id)))) break;

				try {
					console.log(
						`🔍 Checking if TriggerTask already exists for email: ${account.email}`,
					);
					const existing = yield* Effect.promise(() =>
						db
							.selectFrom("TriggerTask")
							.select("id")
							.where("email", "=", account.email)
							.where("triggerid", "=", id)
							.executeTakeFirst(),
					);

					if (existing) {
						console.log(
							`⏭️ TriggerTask already exists for ${account.email}, skipping`,
						);
						continue;
					}

					console.log(`✅ Creating new TriggerTask for ${account.email}`);

					// Create TriggerTask (same as database flow)
					const highestTrigger = (yield* Effect.promise(() =>
						db
							.selectFrom("TriggerTask as tt")
							.select("tt.id")
							.orderBy("tt.id", "desc")
							.executeTakeFirst(),
					)) as { id?: number } | undefined;

					const highestTriggerId =
						highestTrigger && typeof highestTrigger.id === "number"
							? highestTrigger.id
							: 0;

					const inserted = yield* pipe(
						Effect.promise(() =>
							db
								.insertInto("TriggerTask")
								.values({
									id: Number(highestTriggerId) + 1,
									instagram_account_id: account.id,
									current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
									current_stage_number: 3,
									email: account.email,
									stage_entered_at: new Date(),
									next_action_possible_at: new Date(),
									trigger_window_ends_at: null,
									last_instantly_campaign_completed_at: null,
									triggerid: id as number | string,
									created_at: new Date(),
									updated_at: new Date(),
									post_url: account.postUrl,
									post_text: account.postCaption,
								})
								.returningAll()
								.executeTakeFirstOrThrow(),
						),
						Effect.catchAll((e: unknown) =>
							Effect.sync(() => {
								console.error(
									`HASHTAG FLOW: Error creating trigger for ${account.id}: ${String(e)}`,
								);
								console.log(account);
								return null;
							}),
						),
					);

					if (inserted) {
						yield* pipe(
							Effect.promise(() =>
								db
									.updateTable("FilterCloneTask")
									.set({ found: sql<number>`coalesce(found, 0) + 1` })
									.where("id", "=", id)
									.executeTakeFirst(),
							),
							Effect.catchAll((e: unknown) =>
								Effect.sync(() => {
									console.error(
										`HASHTAG FLOW: Error updating found count: ${String(e)}`,
									);
									return null;
								}),
							),
						);

						console.log(
							`✅ HASHTAG FLOW: Successfully created TriggerTask for ${account.email} (from @${account.sourceMention})`,
						);
					}
				} catch (error) {
					console.error(
						`❌ HASHTAG FLOW: Error processing discovered account ${account.email}:`,
						error,
					);
				}
			}
		} else {
			console.log("🏷️ HASHTAG FLOW: No accounts discovered for processing");
		}

		console.log(`✅ Hashtag Search Flow completed for task ${id}`);
	});
}

export const importAccountsToEmailSequenceCronKeywordsWithHashtags = Effect.gen(
	function* () {
		console.log("[ImportAccountsCron] Started at", new Date().toISOString());

		const filterCloneTasks = yield* Effect.promise(() =>
			db
				.selectFrom("FilterCloneTask as fct")
				.select((eb) => [
					eb.ref("fct.id").as("id"),
					eb.ref("fct.title").as("title"),
					eb.ref("fct.target").as("target"),
					eb.ref("fct.target_male").as("target_male"),
					eb.ref("fct.target_female").as("target_female"),
					eb.ref("fct.target_country").as("target_country"),
					eb.ref("fct.createdAt").as("createdAt"),
					eb.ref("fct.keywords").as("keywords"),
					eb.ref("fct.min_followers").as("min_followers"),
					eb.ref("fct.max_followers").as("max_followers"),
					eb.ref("fct.post_date").as("post_date"),
					eb.ref("fct.result_limit").as("result_limit"),
					eb.ref("fct.found").as("found"),
					eb.ref("fct.is_active").as("is_active"),
					eb.ref("fct.maxPerDay").as("maxPerDay"),
					eb.ref("fct.enable_mentions_scraping").as("enable_mentions_scraping"),
					eb.ref("fct.enable_hashtag_scraping").as("enable_hashtag_scraping"),
					eb.ref("fct.last_processed_offset").as("last_processed_offset"),
				])
				.where("fct.is_active", "=", true)
				.execute(),
		);

		const tasksToProcess = filterCloneTasks.filter(
			(t) =>
				typeof t.result_limit === "number" &&
				typeof t.found === "number" &&
				(t.found ?? 0) < t.result_limit + (t.maxPerDay ?? 0),
		);

		console.log(
			`[ImportAccountsCron] Found ${tasksToProcess.length} tasks to process`,
		);

		for (const filterCloneTask of tasksToProcess) {
			const {
				id,
				target_country,
				keywords,
				min_followers,
				max_followers,
				post_date,
				result_limit,
				found,
				maxPerDay,
			} = filterCloneTask;

			const country = target_country ?? "";
			if (!country) continue;

			console.log(`Processing task ${id} for country: ${country}`);
			console.log(
				` Task details: target=${filterCloneTask.target}, found=${filterCloneTask.found}, limit=${filterCloneTask.result_limit}`,
			);
			console.log(`Keywords: ${filterCloneTask.keywords}`);
			console.log(
				`Followers range: ${filterCloneTask.min_followers} - ${filterCloneTask.max_followers}`,
			);
			console.log(
				`Scraping toggles: mentions=${filterCloneTask.enable_mentions_scraping}, hashtag=${filterCloneTask.enable_hashtag_scraping}`,
			);

			// Always run database flow first
			console.log(`Running DATABASE flow for task ${id}`);
			console.log(
				`Mentions scraping check: ${filterCloneTask.enable_mentions_scraping === true ? "ENABLED" : "DISABLED"}`,
			);
			yield* databaseSearchFlow(filterCloneTask);

			// Conditionally run hashtag flow if enabled
			console.log(
				`🏷️ Hashtag scraping check: ${filterCloneTask.enable_hashtag_scraping === true ? "ENABLED" : "DISABLED"}`,
			);
			if (filterCloneTask.enable_hashtag_scraping === true) {
				// console.log(`🏷️ Running HASHTAG flow for task ${id}`);
				yield* hashtagSearchFlow(filterCloneTask);
			} else {
				console.log(`⏭️ Hashtag scraping disabled for task ${id}`);
			}
		}

		console.log("[ImportAccountsCron] Finished at", new Date().toISOString());
	},
).pipe(Effect.schedule(Schedule.cron("*/5 * * * *"))) as Effect.Effect<
	[number, number],
	unknown,
	never
>; // Run every 5 minutes (or as needed)
