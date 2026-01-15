import { Effect, Schedule, pipe } from "effect";
import OpenAI from "openai";
import { env } from "../env";
import { sendSlackMessageE } from "../utils/slack";
import {
	buildFollowupEmailPayload,
	createOrUpdateDealNote,
	fetchDealsNeedingFollowup,
	fetchFollowupDataForDeal,
	saveGeneratedFollowupEmail,
	upsertPipedriveDeal,
} from "./followup-manager";

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

		let generatedEmails = 0;
		let errors = 0;

		// Process each deal - fetch details just-in-time
		for (const dealInfo of dealsNeedingProcessing) {
			console.log(`\n📝 Fetching data for deal ${dealInfo.deal.id}...`);

			// Fetch deal details just-in-time
			const dealDataResult = yield* Effect.either(
				fetchFollowupDataForDeal(dealInfo),
			);

			if (dealDataResult._tag === "Left") {
				// Skip this deal if we can't fetch its data
				const error = dealDataResult.left;

				console.log(`❌ Skipping deal ${dealInfo.deal.id}:`, error);

				// Send detailed Slack notification for errors
				const errorDetails =
					error._tag === "FollowupDataError"
						? error.message
						: `${error._tag}: ${error.message || "Unknown error"}`;

				const errorCause = error.cause
					? `\nCause: ${JSON.stringify(error.cause, null, 2)}`
					: "";

				yield* sendSlackMessageE(
					`🚨 Followup Generation Error\nDeal: ${dealInfo.deal.id}\nSubject: ${dealInfo.deal.next_activity_subject}\nError Type: ${error._tag}\nError: ${errorDetails}${errorCause}\nFull Error: ${JSON.stringify(error, null, 2)}`,
				);

				errors++;
				continue;
			}

			const dealData = dealDataResult.right;
			console.log(`📝 Generating email for deal ${dealData.deal.id}...`);

			// IMPORTANT: Update the database with the deal first to satisfy foreign key constraints
			yield* upsertPipedriveDeal(dealData.deal);

			// Build OpenAI payload
			const payload = yield* Effect.tryPromise({
				try: () => buildFollowupEmailPayload(dealData),
				catch: (error) =>
					new FollowupGenerationError(
						`Failed to build OpenAI payload for deal ${dealData.deal.id}`,
						error,
					),
			});
			console.log("OpenAI payload:", payload);
			// yield* Effect.sleep("5 minutes");

			console.log(
				`Sending OpenAI request for deal ${dealData.deal.id} with subject ${dealData.deal.next_activity_subject}`,
			);

			// Call OpenAI API using the client
			const response = yield* Effect.tryPromise({
				try: () =>
					openai.chat.completions.create({
						model: payload.model as string,
						messages: payload.messages as OpenAI.ChatCompletionMessageParam[],
						max_tokens: payload.max_tokens as number,
						temperature: payload.temperature as number,
					}),
				catch: (error) =>
					new FollowupGenerationError(
						`OpenAI API request failed for deal ${dealData.deal.id}`,
						error,
					),
			});

			// Extract generated email
			const generatedEmail = response.choices?.[0]?.message?.content;
			if (!generatedEmail) {
				throw new FollowupGenerationError(
					`No email content generated for deal ${dealData.deal.id}`,
				);
			}

			// Find recipient email from email history
			const recipientEmail =
				dealData.emailContents.find(
					(email) => email.from.toLowerCase() !== "joleen@startviral.de",
				)?.from || "unknown@example.com";

			// Save generated email to database (now that deal exists)
			yield* saveGeneratedFollowupEmail(
				dealData.deal,
				JSON.stringify(payload.messages),
				generatedEmail,
				recipientEmail,
			);

			// Create or update note on the deal with the generated email
			if (!dealData.deal.next_activity_subject) {
				throw new FollowupGenerationError(
					`Deal ${dealData.deal.id} has no activity subject for creating note`,
				);
			}
			yield* createOrUpdateDealNote(
				dealData.deal,
				generatedEmail,
				dealData.deal.next_activity_subject,
			);

			console.log(`✅ Generated and saved email for deal ${dealData.deal.id}`);
			console.log(`   Subject: ${dealData.deal.next_activity_subject}`);
			console.log(`   Stage: ${dealData.followupStage}`);
			console.log(`   Recipient: ${recipientEmail}`);
			console.log(`   Email preview: ${generatedEmail.substring(0, 100)}...`);

			generatedEmails++;
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
// async function main() {
// 	const result = await Effect.runPromise(runFollowupGeneration());
// 	console.log("Followup generation result:", result);
// }

// if (require.main === module) {
// 	main().catch((err) => {
// 		console.error("Error running followup generation:", err);
// 		process.exit(1);
// 	});
// }
