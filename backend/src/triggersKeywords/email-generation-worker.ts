import { Effect, Schedule } from "effect";
import type { Selectable } from "kysely";
import OpenAI from "openai";
import { db } from "../db";
import {
	EmailSequenceStage,
	type GeneratedEmailRequest,
	type GeneratedEmailType,
	OpenAIRequestStatus,
} from "../db/db_types";
import { env } from "../env";
import { sendSlackMessage } from "../utils/slack";
import { safeJsonParse, safeJsonStringify } from "../utils/string-utils";
import { fetchPromptDataForSequences } from "./prompt-manager";

class OpenAIBatchError {
	readonly _tag = "OpenAIBatchError";
	constructor(
		public readonly message: string,
		public readonly cause?: unknown,
	) {}
}

// Initialize OpenAI client
const openai = new OpenAI({
	apiKey: env.OPEN_AI_API_KEY,
});
import { db as baseDb } from "backend/src/db";
import { type Kysely, sql } from "kysely";
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
	instalnty_id?: number; // <-- Added property
};

type ExtraTables = {
	FilterCloneTask: FilterCloneTaskRow;
};
/**
 * Main worker function to process email generation
 */
export function runEmailGenerationWorkerKeywords(batchSize: number) {
	return Effect.gen(function* () {
		const db = baseDb as unknown as Kysely<ExtraTables>;
		// Make sure "FilterCloneTasks" is defined in your DB typings (src/db/db_types.ts or equivalent)
		const activeFilterCloneTasks = yield* db
			.selectFrom("FilterCloneTask")
			.selectAll()
			.where("is_active", "=", true)
			.executeE();

		for (const task of activeFilterCloneTasks) {
			console.log(`Active FilterCloneTask: ${task.id}`);
			// You can add your processing logic for each task here
			console.log("🤖 Starting Email Generation Worker");

			// Process pending sequences
			const emailRequests = yield* getGenerationRequestData(
				batchSize,
				Number(task.id),
			);

			if (emailRequests.length > 0) {
				// Submit to OpenAI
				const batchId = yield* submitBatchToOpenAI(emailRequests);
				console.log(
					`Submitted batch ${batchId} with ${emailRequests.length} requests`,
				);
			}

			// Check for completed batches
			const pendingBatches = yield* getPendingBatches();
			console.log(`Found ${pendingBatches.length} pending batches`);

			for (const batchId of pendingBatches) {
				const isComplete = yield* pollBatchCompletion(batchId).pipe(
					Effect.catchAll((e) => {
						console.error("Error polling batch completion:", e);
						return Effect.succeed(false);
					}),
				);
				if (isComplete) {
					console.log(`Batch ${batchId} completed and processed`);
				}
			}
		}

		console.log("✓ Email generation worker cycle complete");
	}).pipe(
		Effect.catchAll((e) => {
			console.error("Error processing batch refresh:", e);
			return Effect.succeed(undefined);
		}),
		Effect.catchAllDefect((e) => {
			console.error("Error processing campaign submission:", e);
			return Effect.succeed(undefined);
		}),
		Effect.repeat(Schedule.spaced("5 minutes")),
	);
}

function processBatchResults(batch: OpenAI.Batch, batchId: string) {
	return Effect.gen(function* () {
		const results = yield* Effect.tryPromise({
			try: () =>
				batch.output_file_id
					? openai.files.content(batch.output_file_id)
					: Promise.reject(),
			catch: (error) =>
				new OpenAIBatchError("Failed to download results", error),
		});

		// Process each result line
		const resultText = yield* Effect.tryPromise({
			try: () => results.text(),
			catch: (error) =>
				new OpenAIBatchError("Failed to read results text", error),
		});

		const resultLines = resultText.split("\n").filter((line) => line.trim());
		console.log(`Found ${resultLines.length} result lines in batch ${batchId}`);

		for (const line of resultLines) {
			const result = JSON.parse(line);
			const customId = result.custom_id;
			const emailRequestId = Number.parseInt(customId.replace("email_", ""));

			console.log(`Processing result for email request ${emailRequestId}`);

			if (result.response?.body?.choices?.[0]?.message?.content) {
				const content = result.response.body.choices[0].message.content;

				const body = content.trim();

				// Update email request
				yield* db
					.updateTable("GeneratedEmailRequest")
					.set({
						openai_response: safeJsonStringify(result.response),
						generated_body: body,
						status: OpenAIRequestStatus.COMPLETED,
						completed_at: new Date(),
						updated_at: new Date(),
					})
					.where("id", "=", emailRequestId)
					.executeE();
			} else {
				// Mark as failed
				yield* db
					.updateTable("GeneratedEmailRequest")
					.set({
						openai_response: safeJsonStringify(result.response),
						status: OpenAIRequestStatus.FAILED,
						failed_at: new Date(),
						updated_at: new Date(),
					})
					.where("id", "=", emailRequestId)
					.executeE();
			}
		}

		// Advance sequences to pending send
		const allRequests = yield* db
			.selectFrom("GeneratedEmailRequest")
			.selectAll()
			.where("openai_batch_id", "=", batchId)
			.executeE();

		const completedRequests = allRequests.filter(
			(r) => r.status === OpenAIRequestStatus.COMPLETED,
		);

		for (const request of completedRequests) {
			console.log(`Processing completed request ${request.id}`);

			const sequence = yield* db
				.selectFrom("EmailSequence")
				.selectAll()
				.where("id", "=", request.email_sequence_id)
				.executeTakeFirstOrThrowE();

			// Determine next stage based on current stage
			let nextStage: EmailSequenceStage;
			switch (sequence.current_stage) {
				case EmailSequenceStage.OPENER_PENDING_GENERATION:
					nextStage = EmailSequenceStage.OPENER_PENDING_SEND;
					break;
				case EmailSequenceStage.TRIGGER_EMAIL_PENDING_GENERATION:
					nextStage = EmailSequenceStage.TRIGGER_EMAIL_PENDING_SEND;
					break;
				default:
					continue;
			}

			// Update sequence stage
			yield* db
				.updateTable("EmailSequence")
				.set({
					current_stage: nextStage,
					stage_entered_at: new Date(),
					updated_at: new Date(),
				})
				.where("id", "=", sequence.id)
				.executeE();
		}

		const stuckRequests = allRequests.filter(
			(r) =>
				r.status !== OpenAIRequestStatus.COMPLETED &&
				r.status !== OpenAIRequestStatus.FAILED,
		);

		for (const request of stuckRequests) {
			console.log(`Processing stuck request ${request.id}`);
			yield* db
				.updateTable("GeneratedEmailRequest")
				.set({
					openai_response: { error: "missing from batch" },
					status: OpenAIRequestStatus.FAILED,
					failed_at: new Date(),
					updated_at: new Date(),
				})
				.where("id", "=", request.id)
				.executeE();
		}

		console.log(
			`✓ Processed ${completedRequests.length} completed email generations`,
		);
	});
}

/**
 * Processes error file from a failed batch
 */
function processErrorFile(batch: OpenAI.Batch, batchId: string) {
	return Effect.gen(function* () {
		const errorFileID = batch.error_file_id;
		if (!errorFileID) {
			return yield* Effect.fail(
				new OpenAIBatchError("No error file ID provided"),
			);
		}

		const errorFile = yield* Effect.tryPromise({
			try: () => openai.files.content(errorFileID),
			catch: (error) =>
				new OpenAIBatchError("Failed to download error file", error),
		});

		const errorText = yield* Effect.tryPromise({
			try: () => errorFile.text(),
			catch: (error) =>
				new OpenAIBatchError("Failed to read error file text", error),
		});

		const errorLines = errorText.split("\n").filter((line) => line.trim());
		console.log(`Found ${errorLines.length} error lines in batch ${batchId}`);

		for (const line of errorLines) {
			try {
				const errorResult = JSON.parse(line);
				console.error(errorResult);
				const customId = errorResult.custom_id;
				const emailRequestId = Number.parseInt(customId.replace("email_", ""));

				console.log(`Processing error for email request ${emailRequestId}`);

				// Mark request as failed with error details
				yield* db
					.updateTable("GeneratedEmailRequest")
					.set({
						openai_response: safeJsonStringify(errorResult),
						status: OpenAIRequestStatus.FAILED,
						failed_at: new Date(),
						updated_at: new Date(),
					})
					.where("id", "=", emailRequestId)
					.executeE();
			} catch (parseError) {
				console.error(`Failed to parse error line: ${line}`, parseError);
			}
		}

		console.log(
			`✓ Processed ${errorLines.length} error results for batch ${batchId}`,
		);
	});
}

/**
 * Marks all requests in a batch as failed
 */
function markBatchRequestsAsFailed(batchId: string, reason: string) {
	return Effect.gen(function* () {
		console.log(
			`Marking all requests in batch ${batchId} as failed: ${reason}`,
		);

		yield* db
			.updateTable("GeneratedEmailRequest")
			.set({
				status: OpenAIRequestStatus.FAILED,
				failed_at: new Date(),
				updated_at: new Date(),
			})
			.where("openai_batch_id", "=", batchId)
			.executeE();

		const failedCount = yield* db
			.selectFrom("GeneratedEmailRequest")
			.select((eb) => eb.fn.count("id").as("count"))
			.where("openai_batch_id", "=", batchId)
			.where("status", "=", OpenAIRequestStatus.FAILED)
			.executeTakeFirstOrThrowE();

		console.log(
			`✓ Marked ${failedCount.count} requests as failed in batch ${batchId}`,
		);
	});
}

/**
 * Polls OpenAI for batch completion and updates email requests
 */
function pollBatchCompletion(batchId: string) {
	return Effect.gen(function* () {
		console.log(`Polling batch ${batchId} for completion`);

		// Get batch status from OpenAI
		const batch = yield* Effect.tryPromise({
			try: () => openai.batches.retrieve(batchId),
			catch: (error) => new OpenAIBatchError("Failed to retrieve batch", error),
		});

		if (batch.status === "completed") {
			console.log(`Batch ${batchId} completed, processing results`);

			// Download and process results
			if (batch.output_file_id) {
				yield* processBatchResults(batch, batchId).pipe(
					Effect.catchTag("OpenAIBatchError", (error) => {
						console.error(
							`Failed to process results for batch ${batchId}:`,
							error,
						);
						const errorMessage =
							error instanceof Error
								? error.message
								: error && typeof error === "object" && "message" in error
									? String(error.message)
									: JSON.stringify(error);
						sendSlackMessage(
							`Failed to process results for batch ${batchId} - deleting requests for retry. Error: ${errorMessage}`,
						);

						// Delete requests so they can be retried
						return db
							.deleteFrom("GeneratedEmailRequest")
							.where("openai_batch_id", "=", batchId)
							.executeE();
					}),
				);
			} else {
				console.error(`Batch ${batchId} has no output file id`, batch);

				// Handle the case where batch completed but has no output file
				// This typically happens when all requests in the batch failed
				if (batch.error_file_id) {
					console.log(`Batch ${batchId} has error file, processing errors`);
					yield* processErrorFile(batch, batchId).pipe(
						Effect.catchTag("OpenAIBatchError", (error) => {
							console.error(
								`Failed to process error file for batch ${batchId}:`,
								error,
							);
							// Fallback: mark all requests as failed
							return markBatchRequestsAsFailed(
								batchId,
								"Failed to process error file",
							);
						}),
					);
				} else {
					console.log(
						`Batch ${batchId} has no output or error file, marking all requests as failed`,
					);
					yield* markBatchRequestsAsFailed(
						batchId,
						"Batch completed with no output or error file",
					);
				}

				sendSlackMessage(
					`Batch ${batchId} completed without output file. Request counts: ${JSON.stringify(batch.request_counts)}`,
				);
			}

			return true;
		}
		if (batch.status === "failed" || batch.status === "cancelled") {
			console.error(`Batch ${batchId} ${batch.status}`);

			// Mark all requests as failed
			yield* db
				.updateTable("GeneratedEmailRequest")
				.set({
					status: OpenAIRequestStatus.FAILED,
					failed_at: new Date(),
					updated_at: new Date(),
				})
				.where("openai_batch_id", "=", batchId)
				.executeE();

			return true;
		}
		if (batch.status === "expired") {
			console.warn(`Batch ${batchId} expired - deleting requests`);

			// Delete expired requests
			yield* db
				.updateTable("GeneratedEmailRequest")
				.set({
					status: OpenAIRequestStatus.FAILED,
					openai_response: { error: "batch expired" },
					failed_at: new Date(),
					updated_at: new Date(),
				})
				.where("openai_batch_id", "=", batchId)
				.executeE();

			return true;
		}
		console.log(`Batch ${batchId} still processing (${batch.status})`);
		return false;
	});
}

/**
 * Gets all pending OpenAI batches that need polling
 */
function getPendingBatches() {
	return Effect.gen(function* () {
		const requests = yield* db
			.selectFrom("GeneratedEmailRequest")
			.select("openai_batch_id")
			.where("status", "in", [
				OpenAIRequestStatus.SUBMITTED,
				OpenAIRequestStatus.PROCESSING,
			])
			.where("openai_batch_id", "is not", null)
			.groupBy("openai_batch_id")
			.executeE();

		return requests
			.map((r) => r.openai_batch_id)
			.filter((id): id is string => id !== null);
	});
}

/**
 * Submits email requests to OpenAI Batch API
 */
function submitBatchToOpenAI(
	emailRequests: Selectable<GeneratedEmailRequest>[],
) {
	return Effect.gen(function* () {
		if (emailRequests.length === 0) {
			return yield* Effect.fail(
				new OpenAIBatchError("No email requests to submit"),
			);
		}

		console.log(
			`Submitting batch of ${emailRequests.length} requests to OpenAI`,
		);

		// Prepare batch requests
		const batchRequests: Array<{
			custom_id: string;
			method: "POST";
			url: string;
			body: Record<string, unknown>;
		}> = [];

		for (const request of emailRequests) {
			const payload = request.openai_request_payload;

			if (!payload) {
				return yield* Effect.fail(
					new OpenAIBatchError(`Request ${request.id} has null/empty payload`),
				);
			}

			// If payload is already an object, use it directly; otherwise parse it
			const parsedPayload =
				typeof payload === "string" ? safeJsonParse(payload) : payload;

			batchRequests.push({
				custom_id: `email_${request.id}`,
				method: "POST" as const,
				url: "/v1/chat/completions",
				body: parsedPayload as Record<string, unknown>,
			});
		}

		// Create JSONL content for batch requests
		const jsonlContent = batchRequests
			.map((request) => safeJsonStringify(request))
			.join("\n");

		// Upload the batch file to OpenAI
		const file = yield* Effect.tryPromise({
			try: () =>
				openai.files.create({
					file: new File([jsonlContent], "batch_requests.jsonl", {
						type: "application/jsonl",
					}),
					purpose: "batch",
				}),
			catch: (error) =>
				new OpenAIBatchError("Failed to upload batch file", error),
		});

		// Submit to OpenAI Batch API
		const batch = yield* Effect.tryPromise({
			try: () =>
				openai.batches.create({
					input_file_id: file.id,
					endpoint: "/v1/chat/completions",
					completion_window: "24h",
				}),
			catch: (error) => new OpenAIBatchError("Failed to create batch", error),
		});

		// Update email requests with batch ID
		for (const request of emailRequests) {
			yield* db
				.updateTable("GeneratedEmailRequest")
				.set({
					openai_batch_id: batch.id,
					status: OpenAIRequestStatus.SUBMITTED,
					submitted_to_openai_at: new Date(),
					updated_at: new Date(),
				})
				.where("id", "=", request.id)
				.executeE();
		}

		console.log(`✓ Submitted batch ${batch.id} to OpenAI`);
		return batch.id;
	});
}

/**
 * Processes sequences ready for email generation using the prompt manager
 */
function getGenerationRequestData(batchSize: number, stage?: number) {
	return Effect.gen(function* () {
		// Get sequences pending generation
		const sequencesToProcess = yield* getSequencesPendingGeneration(
			batchSize,
			stage,
		);
		if (sequencesToProcess.length === 0) {
			console.log("No sequences pending generation");
			return [];
		}

		console.log(
			`Processing ${sequencesToProcess.length} sequences for email generation`,
		);

		// Use prompt manager to fetch data and build prompts
		const promptDataList = yield* fetchPromptDataForSequences(
			sequencesToProcess,
			stage,
		);
		console.log(`Fetched prompt data for ${promptDataList.length} sequences`);

		const emailRequests: Selectable<GeneratedEmailRequest>[] = [];

		// Process each prompt data
		for (const promptData of promptDataList) {
			// Create email request record
			const emailRequest = yield* createEmailRequest(
				promptData.sequence.id,
				promptData.emailType,
				promptData.stageNumber,
				promptData.email?.email,
			);

			// Update with request payload
			const updatedRequest = yield* db
				.updateTable("GeneratedEmailRequest")
				.set({
					openai_request_payload: safeJsonStringify(promptData.requestPayload),
					updated_at: new Date(),
				})
				.where("id", "=", emailRequest.id)
				.returningAll()
				.executeTakeFirstOrThrowE();

			emailRequests.push(updatedRequest);

			console.log(
				`✓ Created email request for ${promptData.account.username} (${promptData.emailType} #${promptData.stageNumber})`,
			);
		}

		console.log(`Created ${emailRequests.length} email requests`);
		return emailRequests;
	});
}

/**
 * Gets sequences that are in *_PENDING_GENERATION stages and ready for email generation
 */
// function getSequencesPendingGeneration(batchSize: number) {
// 	const pendingGenerationStages = [
// 		EmailSequenceStage.OPENER_PENDING_GENERATION,
// 		EmailSequenceStage.TRIGGER_EMAIL_PENDING_GENERATION,
// 	];

// 	return db
// 		.selectFrom("EmailSequence")
// 		.innerJoin(
// 			"InstagramAccountBase",
// 			"EmailSequence.instagram_account_id",
// 			"InstagramAccountBase.id",
// 		)
// 		.leftJoin(
// 			"GeneratedEmailRequest",
// 			"EmailSequence.id",
// 			"GeneratedEmailRequest.email_sequence_id",
// 		)
// 		.where("GeneratedEmailRequest.id", "is", null)
// 		.selectAll("EmailSequence")
// 		.where("current_stage", "in", pendingGenerationStages)
// 		.where("next_action_possible_at", "<=", new Date())
// 		.where("last_data_refreshed_at", "is not", null)
// 		.where(
// 			"last_data_refreshed_at",
// 			">=",
// 			new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
// 		)
// 		.orderBy("InstagramAccountBase.last_data_refreshed_at", "desc")
// 		.limit(batchSize)
// 		.executeE();
// }
function getSequencesPendingGeneration(batchSize: number, stage?: number) {
	const pendingGenerationStages = [
		EmailSequenceStage.OPENER_PENDING_GENERATION,
		EmailSequenceStage.TRIGGER_EMAIL_PENDING_GENERATION,
	];

	return (
		db
			.selectFrom("EmailSequence")
			.innerJoin(
				"InstagramAccountBase",
				"EmailSequence.instagram_account_id",
				"InstagramAccountBase.id",
			)
			.leftJoin(
				"GeneratedEmailRequest",
				"EmailSequence.id",
				"GeneratedEmailRequest.email_sequence_id",
			)
			// .where("GeneratedEmailRequest.id", "is", null)
			// .where("GeneratedEmailRequest.email_type_number", "!=", 1)
			.selectAll("EmailSequence")
			.where("current_stage", "in", pendingGenerationStages)
			.where("current_stage_number", "=", Number(stage)) // <-- Only stage 2
			.where("next_action_possible_at", "<=", new Date())
			// .where("last_data_refreshed_at", "is not", null)
			// .where(
			// 	"last_data_refreshed_at",
			// 	">=",
			// 	new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
			// )
			// .orderBy("InstagramAccountBase.last_data_refreshed_at", "desc")
			.limit(batchSize)
			.executeE()
	);
}
/**
 * Creates a GeneratedEmailRequest record for a sequence
 */
function createEmailRequest(
	sequenceId: number,
	emailType: GeneratedEmailType,
	emailTypeNumber: number,
	email?: string,
) {
	return Effect.gen(function* () {
		const now = new Date();

		return yield* db
			.insertInto("GeneratedEmailRequest")
			.values({
				email_sequence_id: sequenceId,
				// email_id: emailId || null,
				recipient_email: email,
				email_type: emailType,
				email_type_number: emailTypeNumber,
				openai_batch_id: null,
				openai_request_payload: null,
				openai_response: null,
				generated_subject: null,
				generated_body: null,
				status: OpenAIRequestStatus.PENDING_SUBMISSION,
				requested_at: now,
				submitted_to_openai_at: null,
				completed_at: null,
				failed_at: null,
				updated_at: now,
			})
			.returningAll()
			.executeTakeFirstOrThrowE()
			.pipe(
				Effect.tapError((e) => Effect.logError(e.cause)),
				Effect.retry(Schedule.fixed(100)),
			);
	});
}
