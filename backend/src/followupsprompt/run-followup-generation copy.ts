import { db, db_retry_effect } from "backend/src/db";
import {
	type EmailSequence,
	EmailSequenceStage,
} from "backend/src/db/db_types";
import { Effect, Schedule, pipe } from "effect";
import { Either } from "effect";
import OpenAI from "openai";
import { env } from "../env";
import { sendSlackMessageE } from "../utils/slack";
// import { db, db_retry_effect } from "../db";
import {
	buildFollowupEmailPayload,
	createOrUpdateDealNote,
	fetchDealsNeedingFollowup,
	fetchFollowupDataForDeal,
	saveGeneratedFollowupEmail,
	upsertPipedriveDeal,
} from "./followup-manager";
// import { Effect, Schedule } from "effect";
// Custom error types
class FollowupGenerationError {
	readonly _tag = "FollowupGenerationError";
	constructor(
		public readonly message: string,
		public readonly cause?: unknown,
	) {}
}

// Initialize OpenAI client
const openai = new OpenAI({
	apiKey: env.OPEN_AI_API_KEY,
});

if (import.meta.main) {
	Effect.runPromise(runFollowupGeneration())
		.then((result) => {
			console.log("Followup generation finished:", result);
			process.exit(0);
		})
		.catch((err) => {
			console.error("Followup generation failed:", err);
			process.exit(1);
		});
}
function removeFromDatabaseBlacklist(email: string) {
	return Effect.gen(function* () {
		console.log(`🗑️ Removing ${email} from database blacklist...`);

		// Remove from Email table
		const emailUpdated = yield* db_retry_effect(
			{ name: "RemoveFromEmailBlacklist" },
			() =>
				db
					.updateTable("Email")
					.set({
						code: null,
						reason: null,
						blacklisted_at: null,
					})
					.where("email", "=", email)
					.where("blacklisted_at", "is not", null)
					.execute(),
		);

		console.log(
			`✓ Updated ${emailUpdated.length} email record(s) in Email table`,
		);

		// Get instagram_id from Email table to update InstagramAccountBase
		const emailRecord = yield* Effect.either(
			db
				.selectFrom("Email")
				.select("instagram_id")
				.where("email", "=", email)
				.executeTakeFirstE(),
		);

		if (emailRecord._tag === "Right" && emailRecord.right) {
			const emailData = emailRecord.right;
			// Update InstagramAccountBase
			const accountUpdated = yield* db_retry_effect(
				{ name: "RemoveFromInstagramBlacklist" },
				() =>
					db
						.updateTable("InstagramAccountBase")
						.set({ blacklist: false })
						.where("id", "=", emailData.instagram_id)
						.execute(),
			);

			console.log(
				`✓ Updated ${accountUpdated.length} Instagram account record(s)`,
			);
		} else {
			console.log(
				`⚠️ No Email record found for ${email}, skipping InstagramAccountBase update`,
			);
		}

		return { email, removed: true };
	});
}
function removeFromInstantlyBlocklist(email: string) {
	return Effect.gen(function* () {
		console.log(`
￼
 Removing ${email} from Instantly blocklist...`);

		try {
			// Step 1: Search blocklist for the email (fast lookup using search parameter)
			const searchUrl = `https://api.instantly.ai/api/v2/block-lists-entries?search=${encodeURIComponent(email)}`;
			const searchResponse = yield* Effect.tryPromise({
				try: () =>
					fetch(searchUrl, {
						method: "GET",
						headers: {
							Authorization: `Bearer ${env.INSTANTLY_KEY}`,
							"Content-Type": "application/json",
						},
					}),
				catch: (error) =>
					new Error(`Failed to search Instantly blocklist: ${error}`),
			});

			if (!searchResponse.ok) {
				console.log(
					`
￼
 Instantly API returned ${searchResponse.status}, email may not be in blocklist`,
				);
				return { email, removed: false };
			}

			const blocklistData = (yield* Effect.tryPromise({
				try: () => searchResponse.json(),
				catch: (error) =>
					new Error(`Failed to parse Instantly blocklist response: ${error}`),
			})) as {
				items?: Array<{ id: string; bl_value: string }>;
			};

			// Find entry with exact email match (search may return partial matches)
			const foundEntry =
				blocklistData.items?.find(
					(item: { id: string; bl_value: string }) =>
						item.bl_value.toLowerCase() === email.toLowerCase(),
				) || null;

			if (!foundEntry) {
				console.log(
					`Email ${email} not found in Instantly blocklist (may not have been blacklisted)`,
				);
				return { email, removed: false };
			}

			const entryId = foundEntry.id;
			console.log(`
￼
 Found blocklist entry ID: ${entryId}`);

			// Step 2: DELETE the blocklist entry
			const deleteResponse = yield* Effect.tryPromise({
				try: () =>
					fetch(
						`https://api.instantly.ai/api/v2/block-lists-entries/${entryId}`,
						{
							method: "DELETE",
							headers: {
								Authorization: `Bearer ${env.INSTANTLY_KEY}`,
							},
						},
					),
				catch: (error) =>
					new Error(`Failed to delete from Instantly blocklist: ${error}`),
			}).pipe(
				Effect.catchAll((error) => {
					// Log error but don't fail the entire process
					console.error(
						`
￼
 Error removing ${email} from Instantly blocklist:`,
						error,
					);
					return Effect.gen(function* () {
						yield* sendSlackMessageE(
							`Warning: Failed to remove ${email} from Instantly blocklist: ${error}`,
						);
						return null;
					});
				}),
			);

			if (deleteResponse?.ok) {
				console.log(`✓ Removed ${email} from Instantly blocklist`);
				return { email, removed: true };
			}

			return { email, removed: false };
		} catch (error) {
			// Log error but don't fail the entire process
			console.error(
				`
￼
 Error removing ${email} from Instantly blocklist:`,
				error,
			);
			yield* sendSlackMessageE(
				`Warning: Failed to remove ${email} from Instantly blocklist: ${error}`,
			);
			return { email, removed: false };
		}
	});
}
export function removeFromBlacklist(email: string) {
	return Effect.gen(function* () {
		console.log(`\n🔄 Removing ${email} from blacklist...`);

		// Remove from database
		yield* removeFromDatabaseBlacklist(email);

		// Remove from Instantly (non-blocking - logs errors but continues)
		yield* removeFromInstantlyBlocklist(email);

		console.log(`✅ Completed blacklist removal for ${email}\n`);

		return { email, removed: true };
	});
}
const fetchAccountsForCountries = (username: string[], countries: string[]) =>
	db
		.selectFrom("InstagramAccountBase")
		.innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
		.leftJoin(
			"EmailSequence",
			"EmailSequence.instagram_account_id",
			"InstagramAccountBase.id",
		)
		.where("username", "in", username) // this part is fine
		.where("country", "in", countries)
		.select([
			"InstagramAccountBase.id",
			"InstagramAccountBase.username", // ← ADD THIS
			"Email.email",
		])
		.distinctOn(["InstagramAccountBase.id"])
		.execute();
/**
 * Runs followup email generation for deals with changed activity subjects
 */
export function runFollowupGeneration() {
	return Effect.gen(function* () {
		// Environment check
		if (!env.OPEN_AI_API_KEY) {
			return yield* Effect.fail(
				new FollowupGenerationError("OPEN_AI_API_KEY not found in environment"),
			);
		}

		console.log("🚀 Starting followup email generation...");

		// Fetch list of deals that need followup processing (only those with changed subjects)
		const dealsNeedingProcessing = yield* fetchDealsNeedingFollowup();

		console.log(
			`📧 Processing ${dealsNeedingProcessing.length} deals with changed subjects...`,
		);

		const generatedEmails = 0;
		const errors = 0;

		// Process each deal - fetch details just-in-time
		for (const dealInfo of dealsNeedingProcessing) {
			console.log(`\n📝 Fetching data for deal ${dealInfo.deal.id}...`);

			// Fetch deal details just-in-time
			const dealDataResult = yield* Effect.either(
				fetchFollowupDataForDeal(dealInfo),
			);
			if (Either.isRight(dealDataResult)) {
				const data = dealDataResult.right;

				// console.log(data.deal.user_id);
				// console.log(data.deal.person_id);
				// console.log(data.deal.creator_user_id);

				if (
					data.followupStage === "follow_up_1" ||
					data.followupStage === "follow_up_2"
				) {
					console.log("follow_up_1 or follow_up_2 stage found");

					// Step 1: Check if EITHER follow-up attempt 1 OR attempt 2 date matches today (Germany timezone)
					const FOLLOW_UP_ATTEMPT_1_FIELD =
						"2cf2de55bed72e990a9638be86097ef76a9fe1ec";
					const FOLLOW_UP_ATTEMPT_2_FIELD =
						"0d82b55fc175394c9326c51910375e1827f2d592";

					const attempt1Date = (data.deal as Record<string, unknown>)[
						FOLLOW_UP_ATTEMPT_1_FIELD
					] as string | undefined;
					const attempt2Date = (data.deal as Record<string, unknown>)[
						FOLLOW_UP_ATTEMPT_2_FIELD
					] as string | undefined;

					// Get today's date in Germany timezone (Europe/Berlin)
					// Use Intl.DateTimeFormat to get the date components in Germany timezone
					const germanyFormatter = new Intl.DateTimeFormat("en-CA", {
						timeZone: "Europe/Berlin",
						year: "numeric",
						month: "2-digit",
						day: "2-digit",
					});
					const todayInGermanyStr = germanyFormatter.format(new Date()); // Format: YYYY-MM-DD
					const [todayYear, todayMonth, todayDay] = todayInGermanyStr
						.split("-")
						.map(Number);
					const todayInGermany = new Date(todayYear, todayMonth - 1, todayDay);

					// Helper function to parse and compare dates
					// Pipedrive date fields typically return YYYY-MM-DD format (string)
					const isDateToday = (dateStr: string | undefined): boolean => {
						if (!dateStr) return false;
						try {
							// Handle YYYY-MM-DD format (most common from Pipedrive)
							let dateOnly: Date;
							if (
								typeof dateStr === "string" &&
								/^\d{4}-\d{2}-\d{2}$/.test(dateStr)
							) {
								const [year, month, day] = dateStr.split("-").map(Number);
								dateOnly = new Date(year, month - 1, day);
							} else {
								// Try parsing as ISO string or other formats
								const dateObj = new Date(dateStr);
								// Check if date is valid
								if (Number.isNaN(dateObj.getTime())) {
									console.warn(`Invalid date format: ${dateStr}`);
									return false;
								}
								dateOnly = new Date(
									dateObj.getFullYear(),
									dateObj.getMonth(),
									dateObj.getDate(),
								);
							}
							// Compare dates (year, month, day only)
							return (
								dateOnly.getFullYear() === todayInGermany.getFullYear() &&
								dateOnly.getMonth() === todayInGermany.getMonth() &&
								dateOnly.getDate() === todayInGermany.getDate()
							);
						} catch (error) {
							console.warn(`Error parsing date "${dateStr}":`, error);
							return false;
						}
					};

					const attempt1IsToday = isDateToday(attempt1Date);
					const attempt2IsToday = isDateToday(attempt2Date);

					// Log date comparison for debugging
					console.log(
						`📅 Date check for deal ${data.deal.id}: Attempt 1: ${attempt1Date || "not set"} ${attempt1IsToday ? "✅" : "❌"}, Attempt 2: ${attempt2Date || "not set"} ${attempt2IsToday ? "✅" : "❌"}, Today (Germany): ${todayInGermanyStr}`,
					);

					// Only proceed if at least one date matches today
					if (!attempt1IsToday || !attempt2IsToday) {
						console.log(
							`⚠️ Neither follow-up attempt date is today - skipping deal ${data.deal.id}`,
						);
						continue;
					}

					// Determine which stage to process based on which date matches
					let activeStage: "follow_up_1" | "follow_up_2";
					if (attempt1IsToday && attempt2IsToday) {
						// If both match today, prioritize attempt 1
						activeStage = "follow_up_1";
						console.log(
							`✅ Both dates match today - processing as follow_up_1 (prioritized) for deal ${data.deal.id}`,
						);
					} else if (attempt1IsToday) {
						activeStage = "follow_up_1";
						console.log(
							`✅ Follow-up attempt 1 date matches today (${attempt1Date}) - proceeding with deal ${data.deal.id}`,
						);
					} else {
						activeStage = "follow_up_2";
						console.log(
							`✅ Follow-up attempt 2 date matches today (${attempt2Date}) - proceeding with deal ${data.deal.id}`,
						);
					}

					// If processing follow-up attempt 2, check if deal is in Trial stage (stage_id = 24)
					if (activeStage === "follow_up_2") {
						const isTrialStage = data.deal.stage_id === 24;
						if (isTrialStage) {
							console.log(
								`⚠️ Deal ${data.deal.id} is in Trial stage (stage_id: 24) - skipping follow-up attempt 2 processing (deal is already a customer)`,
							);
							continue;
						}
						console.log(
							`✓ Deal ${data.deal.id} is not in Trial stage (stage_id: ${data.deal.stage_id}) - proceeding with follow-up attempt 2`,
						);
					}

					const pendingIds: { id: string; email: string }[] = [];
					const username = data.personData?.username ?? "";
					const country = data.personData?.country ?? "";

					const usaRows = yield* Effect.promise(() =>
						fetchAccountsForCountries([username], [country]),
					);

					if (usaRows.length === 0) {
						console.log(
							`⚠️ No accounts found for ${username} in ${country} - skipping`,
						);
						continue;
					}

					yield* removeFromBlacklist(usaRows[0].email);

					// pendingIds = pendingIds.concat(usaRows);

					// console.log(usaRows);
					for (const [index, account] of usaRows.entries()) {
						const now = new Date();
						console.log(
							`[${index + 1}/${pendingIds.length}] Creating sequence for ${account.id}`,
						);
						// console.log("Account:", account);

						console.log(
							"[ImportAccountsCron] Finished at",
							new Date().toISOString(),
						);
						let idsequencecountry = 100;
						if (data.personData?.country === "Germany") {
							idsequencecountry = 200;
						}
						if (data.personData?.country === "Netherlands") {
							idsequencecountry = 300;
						}
						if (data.personData?.country === "United Kingdom") {
							idsequencecountry = 400;
						}
						if (data.personData?.country === "United States") {
							idsequencecountry = 500;
						}
						console.log(
							`idsequencecountry: ${idsequencecountry} (${activeStage})`,
						);
						const highestSequence = yield* Effect.promise(() =>
							db
								.selectFrom("EmailSequence")
								.select("id")
								.orderBy("id", "desc")
								.executeTakeFirstOrThrow(),
						);
						const highestSequenceId = highestSequence?.id ?? 0;
						yield* Effect.tryPromise({
							try: async () => {
								let inserted = false;
								let attempts = 0;
								let result = null;

								while (!inserted && attempts < 5) {
									attempts++;

									// Get latest ID every attempt (in case another insert happened)
									const latest = await db
										.selectFrom("EmailSequence")
										.select("id")
										.orderBy("id", "desc")
										.executeTakeFirst();

									const nextId = (latest?.id ?? 0) + 1;

									try {
										console.log(
											`🔥 Attempt ${attempts}: inserting record with ID ${nextId}`,
										);

										result = await db
											.insertInto("EmailSequence")
											.values({
												id: nextId,
												instagram_account_id: account.id,
												current_stage:
													EmailSequenceStage.OPENER_PENDING_GENERATION,
												current_stage_number: idsequencecountry,
												email: account.email,
												stage_entered_at: now,
												next_action_possible_at: now,
												trigger_window_ends_at: null,
												last_instantly_campaign_completed_at: null,
												created_at: now,
												updated_at: now,
											})
											.returningAll()
											.execute();

										console.log("✅ Insert succeeded:", result);
										inserted = true;
									} catch (error: unknown) {
										if (
											(typeof error === "object" &&
												error !== null &&
												"code" in error &&
												(error as { code?: string }).code === "23505") ||
											(typeof error === "object" &&
												error !== null &&
												"message" in error &&
												typeof (error as { message?: string }).message ===
													"string" &&
												(error as { message: string }).message.includes(
													"duplicate key value",
												))
										) {
											console.warn("⚠️ Duplicate ID conflict, retrying...");
											await new Promise((r) => setTimeout(r, 200)); // short delay before retry
										} else {
											console.error(
												"❌ Insert failed with unexpected error:",
												error,
											);
											throw error;
										}
									}
								}

								if (!inserted) {
									throw new Error(
										"Failed to insert after 5 attempts due to repeated conflicts.",
									);
								}

								return result;
							},
							catch: (error) => {
								console.error("❌ Insert failed after retries:", error);
								throw error;
							},
						});
					}
				}
			}
		}

		const summary = {
			totalDeals: dealsNeedingProcessing.length,
			generatedEmails,
			errors,
		};

		console.log("\n📊 Followup Generation Summary:");
		console.log(`   Total deals processed: ${summary.totalDeals}`);
		console.log(`   Emails generated: ${summary.generatedEmails}`);
		console.log(`   Errors: ${summary.errors}`);

		return summary;
	});
}

export const followupGenerationNewCron = pipe(
	runFollowupGeneration(),
	Effect.repeat(Schedule.spaced("15 minutes")),
	Effect.catchAllDefect((e) =>
		sendSlackMessageE(`defect in followup generation ${e}`),
	),
	Effect.catchAll((e) =>
		sendSlackMessageE(`error in followup generation ${JSON.stringify(e)}`),
	),
);
// Main entry point for manual testing
async function main() {
	const result = await Effect.runPromise(runFollowupGeneration());
	console.log("Followup generation result:", result);
}

if (require.main === module) {
	main().catch((err) => {
		console.error("Error running followup generation:", err);
		process.exit(1);
	});
}
