import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Schedule, Schema, pipe } from "effect";
import { db } from "../db";
import { LeadStatus } from "../db/db_types";
import { env } from "../env";
import { sendSlackMessageE } from "../utils/slack";
import { updateInstantlyVariables } from "./vars";

/**
 * 📧 Email status enum representing different states of email communication
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
 * 🔄 Mapping from Instantly's EmailStatus enum values to our LeadStatus string constants
 * This mapping ensures consistent status representation across systems
 */
const EMAIL_STATUS_TO_LEAD_STATUS: Record<
	EmailStatus,
	(typeof LeadStatus)[keyof typeof LeadStatus]
> = {
	[EmailStatus.Active]: LeadStatus.ACTIVE,
	[EmailStatus.Paused]: LeadStatus.PAUSED,
	[EmailStatus.Completed]: LeadStatus.COMPLETED,
	[EmailStatus.Bounced]: LeadStatus.BOUNCED,
	[EmailStatus.Unsubscribed]: LeadStatus.UNSUBSCRIBED,
	[EmailStatus.Skipped]: LeadStatus.SKIPPED,
};

/**
 * 📋 Schema definition for the leads list response from Instantly API
 * Defines the structure and types of lead data received from the API
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
 * 🔍 Fetches leads from Instantly API with pagination
 * @param campaignId - ID of campaign to fetch leads from
 * @param startingAfter - Pagination cursor for fetching next page
 * @returns Effect containing all leads from campaign
 */
function fetchLeadsPage(params: {
	campaignId?: string;
	startingAfter?: string | undefined;
}) {
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
					...(params.campaignId ? { campaign: params.campaignId } : {}),
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
 * 🗑️ Deletes a lead from both Instantly API and local database
 * @param leadId - ID of the lead to delete
 * @param index - Current index in the deletion process
 * @param total - Total number of leads to delete
 * @returns Effect representing the deletion operation
 */
function deleteLead(leadId: string, index: number, total: number) {
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
				`Failed to delete lead ${leadId}, status: ${res.status}, body: ${text}`,
			);
		}

		if (res.status === 404) {
			console.error(`[delete-completed-leads] Lead ${leadId} not found`);
		}

		// yield* db.deleteFrom("Lead").where("id", "=", leadId).executeE();

		console.log(`[delete-completed-leads] ${index + 1}/${total} leads deleted`);
	});
}

/**
 * 📥 Inserts a new lead into the database
 * @param lead - Lead data from Instantly API
 * @returns Effect representing the insertion operation
 */
function insertLead(lead: LeadsListResponse["items"][number]) {
	return Effect.gen(function* () {
		const email = yield* db
			.selectFrom("Email")
			.selectAll()
			.where("email", "=", lead.email.replace("dm/", ""))
			.executeTakeFirstE();

		if (!email) {
			yield* Console.error(`[sync-stats] Email ${lead.email} not found in db`);
			return yield* Effect.fail("Email not found");
		}

		// ➕ Insert new lead into database
		yield* db
			.insertInto("Lead")
			.values({
				id: lead.id,
				campaign: lead.campaign,
				email: lead.email,
				igid: email.instagram_id,
				email_open_count: lead.email_open_count,
				email_reply_count: lead.email_reply_count,
				email_opened_step: lead.email_opened_step,
				payload: lead.payload,
				status: EMAIL_STATUS_TO_LEAD_STATUS[lead.status as EmailStatus],
				createdAt: lead.timestamp_created,
				timestamp_last_contact: lead.timestamp_last_contact,
				timestamp_last_open: lead.timestamp_last_open,
			})
			.executeE();

		// 🔄 update instantly variables.
		yield* updateInstantlyVariables(lead, email.instagram_id);
	});
}

/**
 * 🔄 Updates lead information in the database
 * @param lead - Lead data from Instantly API
 * @param index - Current index in the update process
 * @param total - Total number of leads to update
 * @returns Effect representing the update operation
 */
function updateLead(lead: Lead, index: number, total: number) {
	return Effect.gen(function* () {
		// 🚫 Delete leads with emails containing "youcefs" or "youcefx"
		if (
			lead.email.toLowerCase().includes("youcefs") ||
			lead.email.toLowerCase().includes("youcefx")
		) {
			yield* deleteLead(lead.id, index, total);
			return;
		}

		// 🔍 Check if lead exists in the database
		const db_lead = yield* db
			.selectFrom("Lead")
			.selectAll()
			.where("id", "=", lead.id)
			.executeTakeFirstE();

		// 💽 If lead is not found in the database, insert it
		if (!db_lead) {
			yield* Console.warn(
				`[sync-stats ${index + 1}/${total}] Lead ${lead.id} not found in db`,
			);
			return yield* insertLead(lead);
		}

		// 🔄 update instantly variables.
		yield* updateInstantlyVariables(lead, db_lead.igid);

		// 🔄 Update existing lead in database
		yield* db
			.updateTable("Lead")
			.set({
				campaign: lead.campaign,
				email_open_count: lead.email_open_count,
				email_reply_count: lead.email_reply_count,
				timestamp_last_contact: lead.timestamp_last_contact,
				timestamp_last_open: lead.timestamp_last_open,
				email_opened_step: lead.email_opened_step,
				payload: lead.payload,
				status: EMAIL_STATUS_TO_LEAD_STATUS[lead.status as EmailStatus],
			})
			.where("id", "=", lead.id)
			.executeE();

		// 🗑️ Delete leads that have 0 opens, 0 replies, completed status, and no recent contact
		if (
			lead.email_open_count < 2 &&
			lead.email_reply_count === 0 &&
			lead.status === EmailStatus.Completed &&
			(!lead.timestamp_last_contact ||
				Date.now() - new Date(lead.timestamp_last_contact).getTime() >
					20 * 24 * 60 * 60 * 1000)
		) {
			yield* deleteLead(lead.id, index, total);
			return;
		}
	});
}

/**
 * 📥 Pulls all campaign leads from Instantly API and syncs them with local database
 * @returns Effect representing the entire sync operation
 */
export const instantlyLeadStatsSync = Effect.gen(function* () {
	let nextCursor: string | undefined = undefined;
	let pageCount = 0;
	let prevPageCount = 0;
	let totalCount = 0;

	console.log("Starting email verification status check...");

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
			(lead, i) => updateLead(lead, i, page.items.length),
			{ concurrency: 3 },
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
}).pipe(
	Effect.catchTag("ParseError", (e) =>
		Console.error(e.message).pipe(
			Effect.andThen(() =>
				sendSlackMessageE(
					`[igdb] Parse Error syncing lead stats: ${e.message}`,
				),
			),
		),
	),
	Effect.catchTag("UnknownException", (e) =>
		Console.error(e.message).pipe(
			Effect.andThen(() =>
				sendSlackMessageE(
					`[igdb] Unknown Exception Error syncing lead stats: ${e.message} ${JSON.stringify(e.cause)} ${e.stack}`,
				),
			),
		),
	),
	Effect.catchAll((e) =>
		sendSlackMessageE(`[igdb] Extra Error syncing lead stats: ${e}`),
	),
);

/**
 * ⏰ Sets up a cron job to run the lead stats sync every 12 hours
 */
export const instantlyLeadStatsSyncCron = pipe(
	instantlyLeadStatsSync,
	Effect.schedule(Schedule.cron("0 */12 * * *")),
	Effect.catchAllDefect((e) =>
		sendSlackMessageE(`[igdb] defect in instantlyLeadStatsSync ${e}`),
	),
);
