import { Console, Effect, Schedule, Schema, pipe } from "effect";
import { db } from "../db";
import {
	InstantlyLeadStatus,
	InstantlyVerificationStatus,
} from "../db/db_types";
import { env } from "../env";
import { sendSlackMessageE } from "../utils/slack";
import { updateInstantlyVariables } from "./vars";

/**
 * 📧 Email status enum representing different states of email communication from Instantly API
 */
export enum EmailStatus {
	Active = 1,
	Paused = 2,
	Completed = 3,
	Bounced = -1,
	Unsubscribed = -2,
	Skipped = -3,
}

/**
 * 🔄 Mapping from Instantly's EmailStatus enum values to our InstantlyLeadStatus string constants
 */
const EMAIL_STATUS_TO_INSTANTLY_LEAD_STATUS: Record<
	EmailStatus,
	(typeof InstantlyLeadStatus)[keyof typeof InstantlyLeadStatus]
> = {
	[EmailStatus.Active]: InstantlyLeadStatus.ACTIVE,
	[EmailStatus.Paused]: InstantlyLeadStatus.PAUSED,
	[EmailStatus.Completed]: InstantlyLeadStatus.COMPLETED,
	[EmailStatus.Bounced]: InstantlyLeadStatus.BOUNCED,
	[EmailStatus.Unsubscribed]: InstantlyLeadStatus.UNSUBSCRIBED,
	[EmailStatus.Skipped]: InstantlyLeadStatus.SKIPPED,
};

/**
 * 📋 Schema definition for the leads list response from Instantly API
 */
const LeadsListResponseSchema = Schema.Struct({
	items: Schema.Struct({
		id: Schema.String,
		campaign: Schema.String,
		timestamp_created: Schema.DateFromString,
		timestamp_updated: Schema.DateFromString,
		status: Schema.Number,
		email_open_count: Schema.Number,
		email_reply_count: Schema.Number,
		email_click_count: Schema.Number,
		email: Schema.String,
		verification_status: Schema.optional(Schema.Number),
		timestamp_last_contact: Schema.optional(Schema.DateFromString),
		timestamp_last_open: Schema.optional(Schema.DateFromString),
		email_opened_step: Schema.optional(Schema.Number),
		payload: Schema.Record({ key: Schema.String, value: Schema.String }),
	}).pipe(Schema.Array, Schema.mutable),
	next_starting_after: Schema.optional(Schema.String),
});

const decodeLeadsListResponse = Schema.decodeUnknown(LeadsListResponseSchema);
type LeadsListResponse = typeof LeadsListResponseSchema.Type;
export type Lead = LeadsListResponse["items"][number];

/**
 * Mapping from Instantly verification status numbers to our enum
 */
const VERIFICATION_STATUS_MAP: Record<number, InstantlyVerificationStatus> = {
	1: InstantlyVerificationStatus.VERIFIED,
	2: InstantlyVerificationStatus.PENDING,
	3: InstantlyVerificationStatus.PENDING_VERIFICATION_JOB,
	4: InstantlyVerificationStatus.INVALID,
	5: InstantlyVerificationStatus.RISKY,
	6: InstantlyVerificationStatus.CATCH_ALL,
	7: InstantlyVerificationStatus.JOB_CHANGE,
};

/**
 * 🔍 Fetches leads from Instantly API with pagination for the specific opener campaign
 */
function fetchLeadsPage(params: { startingAfter?: string | undefined }) {
	return Effect.gen(function* () {
		const response = yield* Effect.tryPromise(() =>
			fetch("https://api.instantly.ai/api/v2/leads/list", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.INSTANTLY_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					limit: 100,
					campaign: "f5f0b5a4-8018-4a49-b909-efef161337cf", // Only the opener campaign
					...(params.startingAfter
						? { starting_after: params.startingAfter }
						: {}),
				}),
			}).then((res) => {
				if (!res.ok) {
					throw new Error(
						`Instantly API error: ${res.status} ${res.statusText}`,
					);
				}
				return res.json();
			}),
		).pipe(
			Effect.retry({
				times: 3,
				schedule: Schedule.exponential("1 minute"),
			}),
		);

		return yield* decodeLeadsListResponse(response);
	});
}

/**
 * 🗑️ Deletes a lead from Instantly API only (keeps local database record)
 */
function deleteLeadFromInstantly(leadId: string, email: string) {
	return Effect.gen(function* () {
		const res = yield* Effect.tryPromise(() =>
			fetch(`https://api.instantly.ai/api/v2/leads/${leadId}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${env.INSTANTLY_KEY}`,
				},
			}),
		).pipe(
			Effect.retry({
				times: 3,
				schedule: Schedule.exponential("1 minute"),
			}),
		);

		if (!res.ok && res.status !== 404) {
			const text = yield* Effect.tryPromise(() => res.text());
			return yield* Effect.fail(
				`Failed to delete lead ${leadId} from Instantly, status: ${res.status}, body: ${text}`,
			);
		}

		if (res.status === 404) {
			yield* Console.error(
				`[delete-lead] Lead ${leadId} not found in Instantly`,
			);
		} else {
			yield* Console.error(
				`[delete-lead] Deleted lead ${leadId} (${email}) from Instantly`,
			);
		}
	});
}

/**
 *  Advances EmailSequence stage based on lead status
 */
function advanceEmailSequenceStages(
	lead: Lead,
	existingLead: { id: number; email_sequence_id: number },
) {
	return Effect.gen(function* () {
		// Get the EmailSequence for this lead
		const emailSequence = yield* db
			.selectFrom("EmailSequence")
			.selectAll()
			.where("id", "=", existingLead.email_sequence_id)
			.executeTakeFirstE();

		if (!emailSequence) {
			yield* Console.warn(
				`[advance-sequence] No EmailSequence found for lead ${lead.id}`,
			);
			return;
		}

		// Only proceed if sequence is in OPENER_SENT_AWAITING_COMPLETION stage
		if (emailSequence.current_stage !== "OPENER_SENT_AWAITING_COMPLETION") {
			return;
		}

		// Check if sequence should advance based on lead status
		if (lead.status === EmailStatus.Completed) {
			// Successfully completed opener, move to trigger monitoring
			yield* db
				.updateTable("EmailSequence")
				.set({
					current_stage: "AWAITING_TRIGGERS",
					current_stage_number: (emailSequence.current_stage_number || 1) + 1,
					stage_entered_at: new Date(),
					trigger_window_ends_at: new Date(
						Date.now() + 30 * 24 * 60 * 60 * 1000,
					), // 30 days
				})
				.where("id", "=", emailSequence.id)
				.executeE();

			yield* Console.log(
				`[advance-sequence] Advanced EmailSequence ${emailSequence.id} to AWAITING_TRIGGERS`,
			);
		} else if (
			lead.status === EmailStatus.Bounced ||
			lead.status === EmailStatus.Unsubscribed
		) {
			// Campaign failed, mark as failed
			yield* db
				.updateTable("EmailSequence")
				.set({
					current_stage: "SEQUENCE_FAILED",
					stage_entered_at: new Date(),
				})
				.where("id", "=", emailSequence.id)
				.executeE();

			yield* Console.log(
				`[advance-sequence] Marked EmailSequence ${emailSequence.id} as SEQUENCE_FAILED due to ${
					lead.status === EmailStatus.Bounced ? "bounce" : "unsubscribe"
				}`,
			);
		}
	});
}

/**
 * 🔍 Handles EmailSequences that are stuck because their leads were deleted from Instantly
 */
function handleMissingLeads() {
	return Effect.gen(function* () {
		// Find EmailSequences waiting for completion but older than 7 days
		const stalledSequences = yield* Effect.promise(() =>
			db
				.selectFrom("EmailSequence")
				.select([
					"id",
					"current_stage",
					"current_stage_number",
					"stage_entered_at",
				])
				.where("current_stage", "=", "OPENER_SENT_AWAITING_COMPLETION")
				.where(
					"stage_entered_at",
					"<",
					new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
				) // 30 days old
				.execute(),
		);

		let advancedCount = 0;

		// Process each stalled sequence
		for (const sequence of stalledSequences) {
			// Check if we have an InstantlyLead for this sequence
			const hasLead = yield* db
				.selectFrom("InstantlyLead")
				.select("id")
				.where("email_sequence_id", "=", sequence.id)
				.executeTakeFirstE()
				.pipe(Effect.map(Boolean));

			// If no lead exists, assume the campaign completed and was deleted from Instantly
			if (!hasLead) {
				yield* db
					.updateTable("EmailSequence")
					.set({
						current_stage: "AWAITING_TRIGGERS",
						current_stage_number: (sequence.current_stage_number || 1) + 1,
						stage_entered_at: new Date(),
						trigger_window_ends_at: new Date(
							Date.now() + 30 * 24 * 60 * 60 * 1000,
						), // 30 days
					})
					.where("id", "=", sequence.id)
					.executeE();

				advancedCount++;
			}
		}

		if (advancedCount > 0) {
			yield* Console.log(
				`[sync-stats] Advanced ${advancedCount} stalled EmailSequences to AWAITING_TRIGGERS (deleted from Instantly)`,
			);
		}
	});
}
/**
 *  Inserts a missing InstantlyLead record by reconstructing the chain from email to sequence
 */
function insertMissingInstantlyLead(lead: Lead) {
	return Effect.gen(function* () {
		//  Get Email record
		const email = yield* db
			.selectFrom("Email")
			.selectAll()
			.where("email", "=", lead.email)
			.executeTakeFirstE();

		if (!email) {
			yield* Console.warn(
				`[sync-stats] Email ${lead.email} not found for lead ${lead.id}`,
			);
			const verificationStatus = lead.verification_status
				? VERIFICATION_STATUS_MAP[lead.verification_status]
				: null;

			// Try to find an existing InstantlyLead for this lead
			const existingLead = yield* Effect.promise(() =>
				db
					.selectFrom("InstantlyLead")
					.selectAll()
					.where("instantly_lead_id", "=", lead.id)
					.where("instantly_campaign_id", "=", lead.campaign)
					.executeTakeFirst(),
			);

			if (existingLead) {
				yield* db
					.updateTable("InstantlyLead")
					.set({
						status:
							EMAIL_STATUS_TO_INSTANTLY_LEAD_STATUS[lead.status as EmailStatus],
						verification_status: verificationStatus,
						email_open_count: lead.email_open_count,
						email_reply_count: lead.email_reply_count,
						email_opened_step: lead.email_opened_step,
						payload: lead.payload,
						timestamp_last_contact: lead.timestamp_last_contact,
						timestamp_last_open: lead.timestamp_last_open,
						updated_at: new Date(),
					})
					.where("id", "=", existingLead.id)
					.executeE();
				yield* advanceEmailSequenceStages(lead, existingLead);
			}
			return yield* sendSlackMessageE(
				`[sync-stats] Cannot insert lead ${lead.id}: email ${lead.email} not found in Email table`,
			);
		}

		//  Get EmailSequence using Instagram ID
		const emailSequence = yield* db
			.selectFrom("EmailSequence")
			.selectAll()
			.where("instagram_account_id", "=", email.instagram_id)
			.executeTakeFirstE();

		if (!emailSequence) {
			yield* Console.warn(
				`[sync-stats] EmailSequence not found for IG ID ${email.instagram_id}`,
			);
			return yield* sendSlackMessageE(
				`[sync-stats] Cannot insert lead ${lead.id}: EmailSequence not found for Instagram account ${email.instagram_id}`,
			);
		}

		//  Get GeneratedEmailRequest - try to find opener email for this sequence
		const generatedEmailRequest = yield* db
			.selectFrom("GeneratedEmailRequest")
			.selectAll()
			.where("email_sequence_id", "=", emailSequence.id)
			.where("email_type", "=", "OPENER")
			.where("recipient_email", "=", lead.email)
			.executeTakeFirstE();

		const verificationStatus = lead.verification_status
			? VERIFICATION_STATUS_MAP[lead.verification_status]
			: null;

		// ➕ Insert new InstantlyLead record
		yield* db
			.insertInto("InstantlyLead")
			.values({
				email_sequence_id: emailSequence.id,
				email_id: email.id,
				email_address: lead.email,
				generated_email_request_id: generatedEmailRequest?.id || null,
				instantly_campaign_id: lead.campaign,
				instantly_lead_id: lead.id,
				status:
					EMAIL_STATUS_TO_INSTANTLY_LEAD_STATUS[lead.status as EmailStatus],
				verification_status: verificationStatus,
				email_open_count: lead.email_open_count,
				email_reply_count: lead.email_reply_count,
				email_opened_step: lead.email_opened_step,
				payload: lead.payload,
				timestamp_last_contact: lead.timestamp_last_contact,
				timestamp_last_open: lead.timestamp_last_open,
				added_to_instantly_at: lead.timestamp_created,
				updated_at: new Date(),
			})
			.executeE();

		//  Update Email table with verification status if it exists
		if (verificationStatus) {
			yield* db
				.updateTable("Email")
				.set({
					instantly_verification_status: verificationStatus,
				})
				.where("id", "=", email.id)
				.executeE();
		}

		yield* Console.log(
			`[sync-stats] Successfully inserted missing InstantlyLead ${lead.id} for email ${lead.email}`,
		);
	});
}

/**
 * 🔄 Updates existing InstantlyLead in the database, or inserts if not found
 */
function updateInstantlyLead(lead: Lead, index: number, total: number) {
	return Effect.gen(function* () {
		// 🔍 Check if InstantlyLead exists in the database
		const existingLead = yield* db
			.selectFrom("InstantlyLead")
			.selectAll()
			.where("instantly_lead_id", "=", lead.id)
			.where("instantly_campaign_id", "=", lead.campaign)
			.executeTakeFirstE();

		// 📥 If lead is not found in the database, try to insert it
		if (!existingLead) {
			yield* Console.warn(
				`[sync-stats ${index + 1}/${total}] InstantlyLead ${lead.id} not found in db, attempting to insert`,
			);
			return yield* insertMissingInstantlyLead(lead);
		}

		const verificationStatus = lead.verification_status
			? VERIFICATION_STATUS_MAP[lead.verification_status]
			: null;

		// 🔄 Update existing InstantlyLead in database
		yield* db
			.updateTable("InstantlyLead")
			.set({
				status:
					EMAIL_STATUS_TO_INSTANTLY_LEAD_STATUS[lead.status as EmailStatus],
				verification_status: verificationStatus,
				email_open_count: lead.email_open_count,
				email_reply_count: lead.email_reply_count,
				email_opened_step: lead.email_opened_step,
				payload: lead.payload,
				timestamp_last_contact: lead.timestamp_last_contact,
				timestamp_last_open: lead.timestamp_last_open,
				updated_at: new Date(),
			})
			.where("id", "=", existingLead.id)
			.executeE();

		const verification_status =
			VERIFICATION_STATUS_MAP[lead.verification_status ?? 1];

		// 📧 Update Email table with verification status if it exists
		if (verificationStatus) {
			yield* db
				.updateTable("Email")
				.set({
					code:
						verification_status === InstantlyVerificationStatus.INVALID
							? 6
							: undefined,
					reason:
						verification_status === InstantlyVerificationStatus.INVALID
							? "Instantly: Invalid email"
							: undefined,
					instantly_verification_status: verificationStatus,
				})
				.where("email", "=", existingLead.email_address)
				.executeE();
		}

		// 🔄 Update Instantly variables with latest Instagram account data
		yield* updateInstantlyVariables(lead, existingLead.email_address);

		// 🗑️ Delete from Instantly if invalid
		if (verification_status === InstantlyVerificationStatus.INVALID) {
			yield* deleteLeadFromInstantly(lead.id, lead.email);
		}

		yield* Console.log(`[sync-stats ${index + 1}/${total}] Updated ${lead.id}`);
	});
}

/**
 * 📥 Syncs opener campaign leads from Instantly API with local InstantlyLead table
 */
export const instantlyLeadStatsSync = Effect.gen(function* () {
	let nextCursor: string | undefined = undefined;
	let pageCount = 0;
	let prevPageCount = 0;
	let totalCount = 0;

	console.log("Starting InstantlyLead sync for opener campaign...");

	// 🔁 Fetch all pages with pagination
	do {
		console.log(`[${totalCount} leads so far] Fetching page ${pageCount + 1}`);

		// 📥 Fetch current page and wait for result
		const page: LeadsListResponse = yield* fetchLeadsPage({
			startingAfter: nextCursor,
		});

		// 🏭 Process results
		yield* Effect.forEach(
			page.items,
			(lead, i) =>
				updateInstantlyLead(
					lead,
					i + totalCount,
					totalCount + page.items.length,
				),
			{ concurrency: 5 },
		);

		nextCursor = page.next_starting_after || undefined;
		pageCount++;
		prevPageCount = page.items.length;
		totalCount += page.items.length;

		// ⏰ Add small delay to avoid rate limiting
		if (prevPageCount > 0) {
			yield* Effect.sleep("500 millis");
		}
	} while (prevPageCount > 0);

	yield* handleMissingLeads();

	yield* Console.log(
		`[sync-stats] Completed sync of ${totalCount} InstantlyLeads`,
	);
}).pipe(
	Effect.catchTag("ParseError", (e) =>
		Console.error(e.message).pipe(
			Effect.andThen(() =>
				sendSlackMessageE(
					`[igdb] Error syncing InstantlyLead stats: ${e.message}`,
				),
			),
		),
	),
	Effect.catchAll((e) =>
		sendSlackMessageE(`[igdb] Error syncing InstantlyLead stats: ${e}`),
	),
);

/**
 * ⏰ Sets up a cron job to run the InstantlyLead stats sync every 12 hours
 */
export const instantlyLeadStatsSyncCron = pipe(
	instantlyLeadStatsSync,
	Effect.schedule(Schedule.cron("0 */12 * * *")),
	Effect.catchAllDefect((e) =>
		sendSlackMessageE(`[igdb] defect in instantlyLeadStatsSync ${e}`),
	),
);
