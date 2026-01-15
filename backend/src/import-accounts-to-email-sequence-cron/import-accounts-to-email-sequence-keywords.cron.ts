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
// 	keywords: string | null; // stored as CSV in DB; we’ll split in code
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
import { db as baseDb } from "backend/src/db";
import { EmailSequenceStage } from "backend/src/db/db_types";
import { HikerAPI } from "backend/src/mining/HikerAPI";
import { Effect, Schedule, pipe } from "effect";
import { type Kysely, sql } from "kysely";

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
function hasKeyword(description: string, keywords: string[]): boolean {
	const d = description?.toLowerCase() ?? "";
	return keywords.some((k) => d.includes(String(k).toLowerCase()));
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
		.select(["InstagramAccountBase.id as id", "Email.email as email"])
		.distinctOn(["InstagramAccountBase.id"])
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

export const importAccountsToEmailSequenceCronKeywords = Effect.gen(
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

			const pageSize = 600;
			let page = 0;
			let currentFound = found ?? 0;

			// Loop until task is inactive or done
			while (
				(yield* Effect.promise(() => isTaskActive(id))) &&
				currentFound < (result_limit ?? 0) + (maxPerDay ?? 0)
			) {
				const offset = page * pageSize;
				const rowsRaw = yield* Effect.promise(() =>
					fetchAccountsForCountries(
						[country],
						min_followers,
						max_followers,
						pageSize,
						offset,
					),
				);

				if (!rowsRaw.length) break;

				for (const [index, account] of rowsRaw.entries()) {
					if (currentFound >= (result_limit ?? 0) + (maxPerDay ?? 0)) break;

					let matchfound = false;
					let postUrl = "";
					let post_caption = "";
					try {
						const posts =
							(yield* HikerAPI.user_medias_by_id(account.id, {
								after:
									typeof post_date === "string"
										? new Date(post_date)
										: (post_date ?? undefined),
							})) || [];

						const keywordList: string[] = Array.isArray(keywords)
							? keywords.filter((k): k is string => typeof k === "string")
							: typeof keywords === "string"
								? keywords
										.split(",")
										.map((k) => k.trim())
										.filter(Boolean)
								: [];

						for (const post of posts) {
							const desc: string =
								(typeof post?.caption === "string"
									? post.caption
									: post?.caption?.text) ?? "";
							if (!desc) continue;

							if (hasKeyword(desc, keywordList)) {
								matchfound = true;
								postUrl = `https://instagram.com/p/${post.code || post.id}`;
								post_caption = desc;
								break;
							}
						}
					} catch (err) {
						console.error(`Error fetching posts for ${account.id}:`, err);
					}

					if (!matchfound) continue;

					try {
						const existing = yield* Effect.promise(() =>
							db
								.selectFrom("TriggerTask")
								.select("id")
								.where("email", "=", account.email)
								.where("triggerid", "=", id)
								.executeTakeFirst(),
						);

						if (existing) continue;

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
										post_url: postUrl,
										post_text: post_caption,
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
				}

				page += 1;
			}
		}

		console.log("[ImportAccountsCron] Finished at", new Date().toISOString());
	},
).pipe(Effect.schedule(Schedule.cron("*/5 * * * *"))); // Run every 5 minutes (or as needed)
// ...existing code...
