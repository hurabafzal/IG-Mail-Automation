import { Effect } from "effect";
import { cons } from "effect/List";
import { use } from "effect/Scope";
import parse from "node-html-parser";
import { db } from "../db";
import { pipedriveLIVE } from "../pipedrive";
import { DealPipedrive } from "../pipedrive/objects/deal";
import type { DealItemT, MailMessageT } from "../pipedrive/objects/deal.schema";
import { MailboxPipedrive } from "../pipedrive/objects/mailbox";
import type { MailThreadMessageT } from "../pipedrive/objects/mailbox.schema";
import { NotePipedrive } from "../pipedrive/objects/note";
import type { NewNoteT } from "../pipedrive/objects/note.schema";
import { PersonPipedrive } from "../pipedrive/objects/person";
import { sendSlackMessageE } from "../utils/slack";

// Custom field IDs from Pipedrive (matching person.schema.ts)
const CUSTOM_FIELDS = {
	USERNAME: "823033198a5d4385dd7f33bb129e0d919badefc3",
	FOLLOWER: "58b79b0435bb9ba90bf400c6ac0e683cff8b553c",
	NICHE: "4eb7f95dd24f1e1ac7fed031f12c892f8ea33b2b",
	COUNTRY: "f864ce01957cdaf64ca5613058d2af39f7f292b4",
	LANGUAGE: "696c621a27a918553dcb5b9e0e9531b8ef084439",
} as const;
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const STR_LIT = /^'(?:[^'\\]|\\.)*'$|^"(?:[^"\\]|\\.)*$/;
const NUM_LIT = /^[+-]?\d+(?:\.\d+)?$/;
const VAR = /\$\{([^}]+)\}/g;
// Custom error types
class FollowupDataError {
	readonly _tag = "FollowupDataError";
	constructor(
		public readonly message: string,
		public readonly cause?: unknown,
	) {}
}

/**
 * Followup stages and their trigger subjects
 */
export enum FollowupStage {
	QUALIFIZIERUNG = "qualifizierung",
	ANGEBOT = "angebot",
	FOLLOW_UP_1 = "follow_up_1",
	FOLLOW_UP_2 = "follow_up_2",
}

/**
 * Relevant task subjects that trigger AI generation
 */
export const RELEVANT_SUBJECTS = [
	// Qualifizierung Pipeline (Cold Mail) - EXACT patterns from real data
	"Qualifizierung > Start",
	"Qualifizierung > Follow Up 1 (Instagram DM)",
	"Qualifizierung > Follow Up 2 (E-Mail)",
	"Qualifizierung > Follow Up 3 (E-Mail)",
	"Qualifizierung > Follow Up 4 (E-Mail)",

	// Angebot Pipeline - EXACT patterns from real data
	"Angebot > Follow Up 1 (Anrufversuch 1)",
	"Angebot > Follow Up 1 (Anrufversuch 2)",
	"Angebot > Follow Up 2 (E-Mail)",
	"Angebot > Follow Up 2 (Mail)",
	"Angebot > Follow Up 3 (Anruf)",

	// Follow Up Pipeline - Stage 1 (after 2 months)
	"E-Mail + Loom Outreach 1 (Follow Up 1)",
	"Instagram / WhatsApp Outreach 2 (Follow Up 1)",
	"E-Mail / Anruf Outreach 3 (Follow Up 1)",

	// Follow Up Pipeline - Stage 2 (after another 2 months)
	"E-Mail Outreach 1 (Follow Up 2)",
	"Instagram / WhatsApp Outreach 2 (Follow Up 2)",
	"E-Mail / Anruf Outreach 3 (Follow Up 2)",
	"E-Mail / WhatsApp Outreach 2 (Follow Up 2)",
	"E-Mail / Anruf Outreach 3 (Follow Up 2)",
	"E-Mail Outreach 1 (Follow Up 2)",

	// Special cases
	"reset", // Appears in data
] as const;

/**
 * Enhanced deal data with mail thread information and person details
 */
export interface DealWithMailThread {
	deal: DealItemT;
	personData?: {
		followerCount?: number;
		username?: string;
		niche?: string;
		country?: string;
		language?: string;
	};
	mailMessages: Array<{
		object: string;
		timestamp: string;
		data: MailMessageT;
	}>;
	mailThreadMessages: MailThreadMessageT[];
	emailContents: Array<{
		messageId: string;
		content: string;
		timestamp: string;
		subject: string;
		from: string;
		to: string;
	}>;
	followupStage: FollowupStage;
	callNotes?: string;
}

/**
 * Context for generating followup emails
 */
interface FollowupContext {
	deal: DealItemT;
	personData?: {
		followerCount?: number;
		username?: string;
		niche?: string;
		country?: string;
		language?: string;
	};
	emailHistory: Array<{
		messageId: string;
		content: string;
		timestamp: string;
		subject: string;
		from: string;
		to: string;
	}>;
	followupStage: FollowupStage;
	taskSubject: string;
	callNotes?: string;
}

/**
 * Deal that needs processing (has changed next_activity_subject)
 */
interface DealNeedingProcessing {
	deal: DealItemT;
	previousSubject: string | null;
	isNew: boolean;
}

export async function getPromptContentByType(type: string): Promise<string> {
	const prompt = await db
		.selectFrom("Prompt")
		.selectAll()
		.where("type", "=", type)
		.where("enabled", "=", true)
		.executeTakeFirst();
	// console.log(prompt);
	// Provide fallback for known types
	switch (type) {
		case "startviralConcept":
			return prompt?.content ?? "";
		case "buildQualifizierungPrompt":
			return prompt?.content ?? "";
		case "buildAngebotPrompt":
			return prompt?.content ?? "";

		default:
			return prompt?.content ?? "";
	}
}
/**
 * Startviral concept and pricing information
 */
// const STARTVIRAL_CONCEPT = `## Startviral Concept

// - Since 2017, we've been helping creators build an active audience on Instagram
// - To win new, engaged followers for our clients, we run Instagram ads
// - For these ads, we use the creator's best-performing Reels
// - We select Reels with high engagement that represent the creator well
// - The ads include a link that leads directly to the creator's profile
// - So, anyone who clicks the ad lands right on the creator's page
// - That means the creator gets new profile visitors from day one
// - When setting up the ads, we select specific target audiences that match the creator
// - For example, if the creator is in fashion, we show the ads only to people interested in fashion
// - We also define the audience by age, country, and interests in the Meta Ad Manager
// - The key to our approach: we combine these targeting options with our "Super-Audience"
// - Our Super-Audience is what sets us apart from creators running ads themselves
// - It consists of people who have already become active followers in campaigns with other creators
// - So, the ads aren't just shown to the right demographic—they're also shown to users we know are highly active
// - We track every profile visitor who clicks on the ad and analyze who stays engaged long-term
// - These new profile visitors will often start watching the creator's Stories, leading to more Story Views from day one
// - Many of these Story Viewers turn into new, engaged followers
// - These new followers then increase engagement by liking and commenting on posts and Reels
// - We've refined this concept over the years and currently work with over 500 creators across Europe and the US
// - Our main goal: to sustainably boost the engagement rate (active followers/interactions vs. total followers)
// - Higher engagement leads to organic growth: the higher your engagement rate, the more reach Instagram gives to your new posts, stories, and Reels—so you're discovered organically via Explore and hashtags`;
// const STARTVIRAL_CONCEPT = eval(
// 	`\`${await getPromptContentByType("startviralConcept")}\``,
// );
// const rawPrompt = await getPromptContentByType("startviralConcept");
const template = await getPromptContentByType("startviralConcept");
console.log(template);
const baseContext = {
	// nowISO: new Date().toISOString(),
	// appName: "StartViral",
	// …anything else you want globally available
};

// return
const STARTVIRAL_CONCEPT = await renderTemplate(template, baseContext, {
	missing: "throw",
});
// console.log(STARTVIRAL_CONCEPT);
/**
 * Determines the followup stage based on the task subject
 */
function getFollowupStage(taskSubject: string): FollowupStage {
	// Qualifizierung Pipeline (Cold Mail) - Based on actual data patterns
	if (taskSubject.startsWith("Qualifizierung >")) {
		return FollowupStage.QUALIFIZIERUNG;
	}

	// Angebot Pipeline - Based on actual data patterns
	if (taskSubject.startsWith("Angebot >")) {
		return FollowupStage.ANGEBOT;
	}

	// Follow Up Pipeline - Stage 1 (after 2 months)
	if (
		taskSubject.includes("Outreach 1 (Follow Up 1)") ||
		taskSubject.includes("Outreach 2 (Follow Up 1)") ||
		taskSubject.includes("Outreach 3 (Follow Up 1)")
	) {
		return FollowupStage.FOLLOW_UP_1;
	}

	// Follow Up Pipeline - Stage 2 (after another 2 months)
	if (
		taskSubject.includes("Outreach 1 (Follow Up 2)") ||
		taskSubject.includes("Outreach 2 (Follow Up 2)") ||
		taskSubject.includes("Outreach 3 (Follow Up 2)")
	) {
		return FollowupStage.FOLLOW_UP_2;
	}

	// Special case: reset should probably not trigger email generation
	if (taskSubject === "reset") {
		throw new Error(
			`"reset" subject should not trigger email generation: ${taskSubject}`,
		);
	}

	throw new Error(`Unknown task subject: ${taskSubject}`);
}

/**
 * Checks if a deal's next_activity_subject has changed since last processing
 */
function checkDealForChanges(deal: DealItemT) {
	return Effect.gen(function* () {
		if (!deal.next_activity_subject) {
			return null; // Skip deals without activity subject
		}

		if (
			!RELEVANT_SUBJECTS.some((subject) =>
				deal.next_activity_subject?.includes(subject),
			)
		) {
			return null; // Skip deals with irrelevant subjects
		}

		// Check if we have this deal in our database
		const existingDeal = yield* Effect.either(
			db
				.selectFrom("PipedriveDeal")
				.selectAll()
				.where("deal_id", "=", deal.id)
				.executeTakeFirstE(),
		);

		if (existingDeal._tag === "Left" || !existingDeal.right) {
			// New deal - needs processing
			return {
				deal,
				previousSubject: null,
				isNew: true,
			} as DealNeedingProcessing;
		}

		// Check if the activity subject has changed
		if (
			existingDeal.right.next_activity_subject !== deal.next_activity_subject
		) {
			return {
				deal,
				previousSubject: existingDeal.right.next_activity_subject,
				isNew: false,
			} as DealNeedingProcessing;
		}

		// No change - skip processing
		return null;
	});
}

/**
 * Updates or inserts a deal in the PipedriveDeal table
 */
function upsertPipedriveDeal(deal: DealItemT) {
	return Effect.gen(function* () {
		// Check if deal exists
		const existingDeal = yield* Effect.either(
			db
				.selectFrom("PipedriveDeal")
				.selectAll()
				.where("deal_id", "=", deal.id)
				.executeTakeFirstE(),
		);

		if (existingDeal._tag === "Left" || !existingDeal.right) {
			// Insert new deal
			yield* db
				.insertInto("PipedriveDeal")
				.values({
					deal_id: deal.id,
					deal_name: deal.title,
					deal_status: "open", // Default status for deals needing followup
					deal_stage: `Stage ${deal.stage_id}`,
					next_activity_subject: deal.next_activity_subject,
					followup_note_id: null,
				})
				.executeE();
			console.log(`✓ Inserted new deal ${deal.id} into database`);
		} else {
			// Update existing deal
			yield* db
				.updateTable("PipedriveDeal")
				.set({
					deal_name: deal.title,
					deal_status: "open" as const,
					deal_stage: `Stage ${deal.stage_id}`,
					next_activity_subject: deal.next_activity_subject,
					// Don't update followup_note_id - preserve existing value
				})
				.where("deal_id", "=", deal.id)
				.executeE();
			console.log(`✓ Updated deal ${deal.id} in database`);
		}
	});
}

/**
 * Saves a generated followup email to the database
 */
function saveGeneratedFollowupEmail(
	deal: DealItemT,
	systemPrompt: string,
	response: string,
	recipientEmail: string,
) {
	return Effect.gen(function* () {
		if (!deal.next_activity_subject) {
			return yield* Effect.fail(
				new FollowupDataError(
					`Deal ${deal.id} has no activity subject for saving email`,
				),
			);
		}

		yield* db
			.insertInto("FollowupEmail")
			.values({
				next_activity_subject: deal.next_activity_subject,
				deal_id: deal.id,
				fullSystemPrompt: systemPrompt,
				fullResponse: response,
				recipientEmail: recipientEmail,
			})
			.executeE();

		console.log(`✓ Saved generated followup email for deal ${deal.id}`);
	});
}

/**
 * Creates or updates a note on the deal with the generated email content
 */
function createOrUpdateDealNote(
	deal: DealItemT,
	generatedEmail: string,
	taskSubject: string,
) {
	return Effect.gen(function* () {
		// Get the current deal record from our database
		const existingDeal = yield* Effect.either(
			db
				.selectFrom("PipedriveDeal")
				.selectAll()
				.where("deal_id", "=", deal.id)
				.executeTakeFirstE(),
		);

		if (existingDeal._tag === "Left" || !existingDeal.right) {
			// Deal not in our database - shouldn't happen, but create note anyway
			console.log(`⚠️ Deal ${deal.id} not found in database, creating new note`);
			return yield* createNewDealNote(deal, generatedEmail, taskSubject);
		}

		const dbDeal = existingDeal.right;

		if (dbDeal.followup_note_id) {
			// Update existing note
			console.log(
				`📝 Updating existing note ${dbDeal.followup_note_id} for deal ${deal.id}`,
			);
			return yield* updateExistingDealNote(
				dbDeal.followup_note_id,
				generatedEmail,
				taskSubject,
			);
		}

		// Create new note and save the ID
		console.log(`📝 Creating new note for deal ${deal.id}`);
		return yield* createNewDealNote(deal, generatedEmail, taskSubject);
	});
}

/**
 * Creates a new note on the deal
 */
function createNewDealNote(
	deal: DealItemT,
	generatedEmail: string,
	taskSubject: string,
) {
	return Effect.gen(function* () {
		const noteContent = formatNoteContent(generatedEmail, taskSubject);

		const noteParams: NewNoteT = {
			content: noteContent,
			deal_id: deal.id,
			pinned_to_deal_flag: 1,
		};

		// Create the note in Pipedrive
		const noteResponse = yield* NotePipedrive.add(noteParams).pipe(
			Effect.provide(pipedriveLIVE),
		);

		if (!noteResponse.success) {
			return yield* Effect.fail(
				new FollowupDataError(`Failed to create note for deal ${deal.id}`),
			);
		}

		const noteId = noteResponse.data.id;
		console.log(`✓ Created note ${noteId} for deal ${deal.id}`);

		// Update our database record with the note ID
		yield* db
			.updateTable("PipedriveDeal")
			.set({ followup_note_id: noteId })
			.where("deal_id", "=", deal.id)
			.executeE();

		console.log(
			`✓ Updated database with note ID ${noteId} for deal ${deal.id}`,
		);
		return noteId;
	});
}

/**
 * Updates an existing note on the deal
 */
function updateExistingDealNote(
	noteId: number,
	generatedEmail: string,
	taskSubject: string,
) {
	return Effect.gen(function* () {
		const noteContent = formatNoteContent(generatedEmail, taskSubject);

		const updateParams: Partial<NewNoteT> = {
			content: noteContent,
			pinned_to_deal_flag: 1,
		};

		// Update the note in Pipedrive
		const noteResponse = yield* NotePipedrive.update(noteId, updateParams).pipe(
			Effect.provide(pipedriveLIVE),
		);

		if (!noteResponse.success) {
			return yield* Effect.fail(
				new FollowupDataError(`Failed to update note ${noteId}`),
			);
		}

		console.log(`✓ Updated note ${noteId} with new content`);
		return noteId;
	});
}

/**
 * Formats the generated email content for the note
 */
function formatNoteContent(
	generatedEmail: string,
	taskSubject: string,
): string {
	const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

	return `Task: ${taskSubject}

${generatedEmail}`;
}

/**
 * Converts HTML email content to clean markdown-like text
 */
function htmlToCleanText(htmlContent: string): string {
	try {
		// If it's not HTML, return as-is
		if (!htmlContent.includes("<") || !htmlContent.includes(">")) {
			return htmlContent;
		}

		const root = parse(htmlContent);

		// Remove unwanted elements
		for (const element of root.querySelectorAll("script")) element.remove();
		for (const element of root.querySelectorAll("style")) element.remove();
		for (const element of root.querySelectorAll("img")) element.remove();
		for (const element of root.querySelectorAll("svg")) element.remove();

		// Remove tracking/encoded links but keep text content
		for (const link of root.querySelectorAll("a")) {
			const href = link.getAttribute("href");
			const text = link.innerText.trim();

			// If it's a long encoded/tracking URL, just use the text
			if (
				href &&
				(href.length > 100 ||
					href.includes("pipedrive.email") ||
					href.includes("redirectUrl"))
			) {
				// Keep only the visible text, remove the messy URL
				link.replaceWith(text);
			}
		}

		// Get clean structured text
		let cleanText = (root.querySelector("html") ?? root).structuredText;

		// Clean up extra whitespace and line breaks
		cleanText = cleanText
			.replace(/\n\s*\n\s*\n/g, "\n\n") // Replace multiple line breaks with double
			.replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space
			.replace(/^\s+|\s+$/gm, "") // Trim each line
			.trim();

		return cleanText;
	} catch (error) {
		console.warn("Failed to parse HTML content, returning original:", error);
		return htmlContent;
	}
}

/**
 * Fetches deals from Pipedrive and filters for those needing processing
 */
function fetchDealsNeedingFollowup() {
	return Effect.gen(function* () {
		const dealsResponse = yield* DealPipedrive.getDealsNeedingFollowUp().pipe(
			Effect.provide(pipedriveLIVE),
		);

		console.log(
			`📋 Found ${dealsResponse.data.length} total open deals from Pipedrive`,
		);

		const dealsNeedingProcessing: DealNeedingProcessing[] = [];

		for (const deal of dealsResponse.data) {
			const processingInfo = yield* Effect.either(checkDealForChanges(deal));

			if (processingInfo._tag === "Right" && processingInfo.right !== null) {
				dealsNeedingProcessing.push(processingInfo.right);
			}
		}

		console.log(
			`✓ Found ${dealsNeedingProcessing.length} deals with changed activity subjects`,
		);
		return dealsNeedingProcessing;
	});
}

/**
 * Fetches mail thread messages for a deal
 */
function fetchMailThreadForDeal(dealId: number) {
	return Effect.gen(function* () {
		// Get mail messages for the deal
		const mailMessagesResponse = yield* DealPipedrive.getMailMessages(
			dealId,
		).pipe(Effect.provide(pipedriveLIVE));

		if (!mailMessagesResponse.data || mailMessagesResponse.data.length === 0) {
			console.warn(
				`No mail messages found for deal ${dealId}, proceeding with empty email history.`,
			);
			return {
				mailMessages: [],
				mailThreadMessages: [],
			};
		}

		// Get unique thread IDs
		const uniqueThreadIds = Array.from(
			new Set(mailMessagesResponse.data.map((m) => m.data.mail_thread_id)),
		).filter(Boolean);

		if (uniqueThreadIds.length === 0) {
			console.warn(
				`No mail threads found for deal ${dealId}, proceeding with empty email history.`,
			);
			return {
				mailMessages: mailMessagesResponse.data,
				mailThreadMessages: [],
			};
		}

		// For now, use the first thread ID (most common case)
		const threadId = uniqueThreadIds[0];

		// Get mail thread messages
		const mailThreadResponse = yield* MailboxPipedrive.getMailThreadMessages(
			threadId,
		).pipe(Effect.provide(pipedriveLIVE));

		console.log(
			`✓ Found ${mailThreadResponse.data.length} messages in thread ${threadId}`,
		);
		return {
			mailMessages: mailMessagesResponse.data,
			mailThreadMessages: mailThreadResponse.data,
		};
	});
}

/**
 * Fetches email content from signed URLs
 */
function fetchEmailContents(mailThreadMessages: readonly MailThreadMessageT[]) {
	return Effect.gen(function* () {
		const emailContents: Array<{
			messageId: string;
			content: string;
			timestamp: string;
			subject: string;
			from: string;
			to: string;
		}> = [];

		for (const message of mailThreadMessages) {
			try {
				const url = message.body_url;
				if (!url) {
					console.log(`⚠️ No body_url for message ${message.id}, skipping`);
					continue;
				}

				const response = yield* Effect.tryPromise({
					try: () => fetch(url),
					catch: (error) =>
						new FollowupDataError(
							`Failed to fetch email content for message ${message.id}`,
							error,
						),
				});

				const rawContent = yield* Effect.tryPromise({
					try: () => response.text(),
					catch: (error) =>
						new FollowupDataError(
							`Failed to read email content for message ${message.id}`,
							error,
						),
				});

				// Convert HTML to clean text
				const cleanContent = htmlToCleanText(rawContent);

				emailContents.push({
					messageId: message.id.toString(),
					content: cleanContent,
					timestamp: message.message_time,
					subject: message.subject || "",
					from: message.from[0]?.email_address || "",
					to: message.to[0]?.email_address || "",
				});

				console.log(
					`📧 Processed email ${message.id} - reduced from ${rawContent.length} to ${cleanContent.length} characters`,
				);
			} catch (error) {
				// Log error but continue with other messages
				console.log(
					`⚠️ Failed to fetch content for message ${message.id}:`,
					error,
				);
			}
		}

		console.log(
			`✓ Successfully fetched ${emailContents.length}/${mailThreadMessages.length} email contents`,
		);
		return emailContents;
	});
}

/**
 * Extracts call notes from deal notes
 */
function extractCallNotes(deal: DealItemT) {
	return Effect.gen(function* () {
		if (!deal.id) return undefined;

		// Get deal notes (data can be null or array)
		const dealNotesResponse = yield* NotePipedrive.getDealNotes(deal.id).pipe(
			Effect.provide(pipedriveLIVE),
		);
		let notes = dealNotesResponse || [];

		// Get person notes if person_id exists
		if (deal.person_id?.value) {
			const personNotesResponse = yield* NotePipedrive.getPersonNotes(
				deal.person_id.value,
			).pipe(Effect.provide(pipedriveLIVE));
			const personNotes = personNotesResponse || [];
			notes = [...notes, ...personNotes];
		}
		// else {
		// 	yield* sendSlackMessageE(`no person id for deal ${deal.id}`);
		// }

		// Combine all note contents into a single string, separated clearly
		const callNotes = notes
			.filter((note) => note?.content?.trim())
			.map((note) => note.content.trim())
			.join("\n\n---\n\n");

		return callNotes.length > 0 ? callNotes : undefined;
	});
}

/**
 * Fetches all deals for a contact and merges context from the lost deal (if any) with the current deal.
 */
// async function fetchFullContactContext(deal: DealItemT) {
// 	if (!deal.person_id?.value) return { mergedNotes: "", mergedEmails: [] };

// 	// Fetch all deals for this contact
// 	const allDealsResponse = await DealPipedrive.getDealsByPersonId(
// 		deal.person_id.value,
// 	)
// 		.pipe(Effect.provide(pipedriveLIVE))
// 		.runPromise();

// 	const allDeals = allDealsResponse.success ? allDealsResponse.data : [];

// 	// Find the previously lost deal (not the current one, status 'lost')
// 	const lostDeal = allDeals.find(
// 		(d) => d.status === "lost" && d.id !== deal.id,
// 	);

// 	// Fetch notes for both deals
// 	const currentDealNotes =
// 		(await NotePipedrive.getDealNotes(deal.id)
// 			.pipe(Effect.provide(pipedriveLIVE))
// 			.runPromise()) || [];
// 	const lostDealNotes = lostDeal
// 		? (await NotePipedrive.getDealNotes(lostDeal.id)
// 				.pipe(Effect.provide(pipedriveLIVE))
// 				.runPromise()) || []
// 		: [];

// 	// Fetch email history for both deals
// 	const currentDealEmails = await fetchMailThreadForDeal(deal.id).runPromise();
// 	const lostDealEmails = lostDeal
// 		? await fetchMailThreadForDeal(lostDeal.id).runPromise()
// 		: { mailMessages: [], mailThreadMessages: [] };

// 	const currentEmailContents = await fetchEmailContents(
// 		currentDealEmails.mailThreadMessages,
// 	).runPromise();
// 	const lostEmailContents = lostDeal
// 		? await fetchEmailContents(lostDealEmails.mailThreadMessages).runPromise()
// 		: [];

// 	// Merge notes and emails
// 	const mergedNotes = [
// 		...currentDealNotes.map((n) => n.content).filter(Boolean),
// 		...lostDealNotes.map((n) => n.content).filter(Boolean),
// 	].join("\n\n---\n\n");

// 	const mergedEmails = [...currentEmailContents, ...lostEmailContents];

// 	return { mergedNotes, mergedEmails, lostDeal };
// }
/**
 * Fetches person details for a deal to get follower count and other creator info
 */

function fetchPersonDataForDeal(deal: DealItemT) {
	return Effect.gen(function* () {
		if (!deal.person_id?.value) {
			console.log(`⚠️ No person_id for deal ${deal.id}, skipping person data`);
			return undefined;
		}

		const personId = deal.person_id.value;

		// Use PersonPipedrive.getById instead of direct API call
		const personResponse = yield* PersonPipedrive.getById(personId).pipe(
			Effect.provide(pipedriveLIVE),
		);

		if (!personResponse.success || !personResponse.data) {
			console.log(`⚠️ No person data found for person ${personId}`);
			return undefined;
		}

		const person = personResponse.data;

		// Extract custom fields (follower count, username, etc.) and convert null to undefined
		const followerCount = person?.[CUSTOM_FIELDS.FOLLOWER] ?? undefined;
		const username = person?.[CUSTOM_FIELDS.USERNAME] ?? undefined;
		const niche = person?.[CUSTOM_FIELDS.NICHE] ?? undefined;
		const country = person?.[CUSTOM_FIELDS.COUNTRY] ?? undefined;
		const language = person?.[CUSTOM_FIELDS.LANGUAGE] ?? undefined;

		console.log(
			`✓ Found person data for ${deal.id}: @${username} with ${followerCount || "unknown"} followers`,
		);

		return {
			followerCount,
			username,
			niche,
			country,
			language,
		};
	});
}

/**
 * Fetches complete followup data for a deal that needs processing
 */
// function fetchFollowupDataForDeal(dealInfo: DealNeedingProcessing) {
// 	return Effect.gen(function* () {
// 		const { deal } = dealInfo;

// 		if (!deal.next_activity_subject) {
// 			return yield* Effect.fail(
// 				new FollowupDataError(`Deal ${deal.id} has no activity subject`),
// 			);
// 		}

// 		const followupStage = getFollowupStage(deal.next_activity_subject);

// 		// Fetch person data and mail data in parallel
// 		const [personData, mailData] = yield* Effect.all([
// 			Effect.either(fetchPersonDataForDeal(deal)),
// 			fetchMailThreadForDeal(deal.id),
// 		]);

// 		const { mailMessages, mailThreadMessages } = mailData;
// 		const emailContents = yield* fetchEmailContents(mailThreadMessages);
// 		const callNotes = yield* extractCallNotes(deal);

// 		const dealWithMailThread: DealWithMailThread = {
// 			deal,
// 			personData: personData._tag === "Right" ? personData.right : undefined,
// 			mailMessages: mailMessages as Array<{
// 				object: string;
// 				timestamp: string;
// 				data: MailMessageT;
// 			}>,
// 			mailThreadMessages: mailThreadMessages as MailThreadMessageT[],
// 			emailContents,
// 			followupStage,
// 			callNotes,
// 		};

// 		console.log(
// 			`✓ Prepared followup data for deal ${deal.id} (${followupStage})`,
// 		);
// 		console.log(
// 			`  Previous subject: ${dealInfo.previousSubject || "N/A (new deal)"}`,
// 		);
// 		console.log(`  Current subject: ${deal.next_activity_subject}`);
// 		if (dealWithMailThread.personData?.followerCount) {
// 			console.log(
// 				`  Creator: @${dealWithMailThread.personData.username} (${dealWithMailThread.personData.followerCount} followers)`,
// 			);
// 		}

// 		return dealWithMailThread;
// 	});
// }

async function findPreviousLostDeal(currentDealId: number) {
	return await db
		.selectFrom("PipedriveDeal")
		.selectAll()
		.where("deal_id", "=", currentDealId)
		.where("deal_status", "=", "lost")
		.orderBy("deal_id", "desc")
		.limit(1)
		.executeTakeFirst();
}
// function fetchFollowupDataForDeal(dealInfo: DealNeedingProcessing) {
// 	return Effect.gen(function* () {
// 		const { deal } = dealInfo;

// 		if (!deal.next_activity_subject) {
// 			return yield* Effect.fail(
// 				new FollowupDataError(`Deal ${deal.id} has no activity subject`),
// 			);
// 		}

// 		let previousDeal = null;
// 		let previousEmailContents: Array<{
// 			messageId: string;
// 			content: string;
// 			timestamp: string;
// 			subject: string;
// 			from: string;
// 			to: string;
// 		}> = [];

// 		previousDeal = yield* Effect.promise(() => findPreviousLostDeal(deal.id));
// 		if (previousDeal) {
// 			const previousMailData = yield* fetchMailThreadForDeal(
// 				previousDeal.deal_id,
// 			);
// 			previousEmailContents = yield* fetchEmailContents(
// 				previousMailData.mailThreadMessages,
// 			);
// 		}

// 		const followupStage = getFollowupStage(deal.next_activity_subject);

// 		// Fetch person data and mail data in parallel
// 		const [personData, mailData] = yield* Effect.all([
// 			Effect.either(fetchPersonDataForDeal(deal)),
// 			fetchMailThreadForDeal(deal.id),
// 		]);

// 		const { mailMessages, mailThreadMessages } = mailData;
// 		// const emailContents = yield* fetchEmailContents(mailThreadMessages);
// 		const emailContents = [
// 			...previousEmailContents,
// 			...(yield* fetchEmailContents(mailThreadMessages)),
// 		];

// 		const callNotes = yield* extractCallNotes(deal);

// 		const dealWithMailThread: DealWithMailThread = {
// 			deal,
// 			personData: personData._tag === "Right" ? personData.right : undefined,
// 			mailMessages: mailMessages as Array<{
// 				object: string;
// 				timestamp: string;
// 				data: MailMessageT;
// 			}>,
// 			mailThreadMessages: mailThreadMessages as MailThreadMessageT[],
// 			emailContents,
// 			followupStage,
// 			callNotes,
// 		};

// 		console.log(
// 			`✓ Prepared followup data for deal ${deal.id} (${followupStage})`,
// 		);
// 		console.log(
// 			`  Previous subject: ${dealInfo.previousSubject || "N/A (new deal)"}`,
// 		);
// 		console.log(`  Current subject: ${deal.next_activity_subject}`);
// 		if (dealWithMailThread.personData?.followerCount) {
// 			console.log(
// 				`  Creator: @${dealWithMailThread.personData.username} (${dealWithMailThread.personData.followerCount} followers)`,
// 			);
// 		}

// 		return dealWithMailThread;
// 	});
// }
// ...existing code...
// ...existing code...
function fetchFollowupDataForDeal(dealInfo: DealNeedingProcessing) {
	return Effect.gen(function* () {
		const { deal } = dealInfo;

		if (!deal.next_activity_subject) {
			return yield* Effect.fail(
				new FollowupDataError(`Deal ${deal.id} has no activity subject`),
			);
		}

		let allEmailContents: Array<{
			messageId: string;
			content: string;
			timestamp: string;
			subject: string;
			from: string;
			to: string;
		}> = [];

		// 1. Fetch all deals for this contact (person)
		if (deal.person_id?.value) {
			const allDealsResponse = yield* DealPipedrive.getAllByPersonId(
				deal.person_id.value,
			).pipe(Effect.provide(pipedriveLIVE));
			const allDeals = allDealsResponse.success ? allDealsResponse.data : [];

			// 2. For each deal, fetch mail threads and contents
			for (const d of allDeals) {
				const mailData = yield* fetchMailThreadForDeal(d.id);
				const emailContents = yield* fetchEmailContents(
					mailData.mailThreadMessages,
				);
				allEmailContents = allEmailContents.concat(emailContents);
			}
		}

		const followupStage = getFollowupStage(deal.next_activity_subject);

		// Fetch person data for the deal
		const [personData] = yield* Effect.all([
			Effect.either(fetchPersonDataForDeal(deal)),
		]);

		const callNotes = yield* extractCallNotes(deal);

		const dealWithMailThread: DealWithMailThread = {
			deal,
			personData: personData._tag === "Right" ? personData.right : undefined,
			mailMessages: [],
			mailThreadMessages: [],
			emailContents: allEmailContents,
			followupStage,
			callNotes,
		};

		console.log(
			`✓ Prepared followup data for deal ${deal.id} (${followupStage}) with ${allEmailContents.length} emails`,
		);

		return dealWithMailThread;
	});
}
// ...existing code...
// ...existing code...

/**
 * Fetches followup data for deals that have changed, updating database accordingly
 */
export function fetchFollowupDataForDeals() {
	return Effect.gen(function* () {
		const dealsNeedingProcessing = yield* fetchDealsNeedingFollowup();
		const followupDataList: DealWithMailThread[] = [];

		for (const dealInfo of dealsNeedingProcessing) {
			const result = yield* Effect.either(fetchFollowupDataForDeal(dealInfo));

			if (result._tag === "Right") {
				followupDataList.push(result.right);
			} else {
				// Log the error but continue with other deals
				const errorMessage =
					result.left._tag === "FollowupDataError"
						? result.left.message
						: `Unknown error for deal ${dealInfo.deal.id}`;
				console.log(`Skipping deal ${dealInfo.deal.id}: ${errorMessage}`);
			}
		}

		console.log(
			`✓ Prepared followup data for ${followupDataList.length}/${dealsNeedingProcessing.length} deals with changes`,
		);
		return followupDataList;
	});
}

/**
 * Determines the appropriate pricing bracket based on follower count
 */
function getPricingBracket(followerCount?: number): string {
	if (!followerCount || followerCount < 0) {
		return "Contact us for custom pricing based on your current follower count.";
	}

	if (followerCount <= 9999) {
		return "**Your pricing**: 500–750 new followers/month, 250–875 extra story views per story, €4/day (€130/month)";
	}
	if (followerCount <= 19999) {
		return "**Your pricing**: 500–750 new followers/month, 250–875 extra story views per story, €4/day (€130/month)";
	}
	if (followerCount <= 29999) {
		return "**Your pricing**: 500–750 new followers/month, 500–1,000 extra story views per story, €4/day (€130/month)";
	}
	if (followerCount <= 39999) {
		return "**Your pricing**: 750–1,000 new followers/month, 750–1,250 extra story views per story, €4.50/day (€140/month)";
	}
	if (followerCount <= 49999) {
		return "**Your pricing**: 750–1,000 new followers/month, 1,000–1,500 extra story views per story, €4.50/day (€140/month)";
	}
	if (followerCount <= 59999) {
		return "**Your pricing**: 1,250–1,500 new followers/month, 1,250–1,750 extra story views per story, €5/day (€150/month)";
	}
	if (followerCount <= 69999) {
		return "**Your pricing**: 1,250–1,500 new followers/month, 1,500–2,000 extra story views per story, €5/day (€150/month)";
	}
	if (followerCount <= 79999) {
		return "**Your pricing**: 1,500–1,750 new followers/month, 1,500–2,000 extra story views per story, €5.50/day (€150/month)";
	}
	if (followerCount <= 89999) {
		return "**Your pricing**: 1,500–1,750 new followers/month, 1,500–2,000 extra story views per story, €6/day (€170/month)";
	}
	if (followerCount <= 99999) {
		return "**Your pricing**: 1,750–2,000 new followers/month, 1,750–2,250 extra story views per story, €6.50/day (€170/month)";
	}

	return "**Your pricing**: 2,000–2,500 new followers/month, 2,500–3,000 extra story views per story, €7/day (€190/month)";
}

/**
 * Builds OpenAI request payload for followup email generation
 */
export async function buildFollowupEmailPayload(
	dealData: DealWithMailThread,
): Promise<Record<string, unknown>> {
	const { deal, personData, emailContents, followupStage, callNotes } =
		dealData;

	if (!deal.next_activity_subject) {
		throw new Error(
			`Deal ${deal.id} has no activity subject for building payload`,
		);
	}

	// Build context for the AI
	const context: FollowupContext = {
		deal,
		personData,
		emailHistory: emailContents,
		followupStage,
		taskSubject: deal.next_activity_subject,
		callNotes,
	};
	// console.log("context check");
	// Generate system prompt based on stage
	let systemPrompt: string;
	if (followupStage === FollowupStage.QUALIFIZIERUNG) {
		systemPrompt = await buildQualifizierungPrompt(context);
	}
	if (followupStage === FollowupStage.ANGEBOT) {
		systemPrompt = await buildAngebotPrompt(context);
	}
	if (followupStage === FollowupStage.FOLLOW_UP_1) {
		systemPrompt = await buildFollowUp1Prompt(context);
	}
	if (followupStage === FollowupStage.FOLLOW_UP_2) {
		systemPrompt = await buildFollowUp2Prompt(context);
	} else {
		// Fallback - should not happen with corrected stage logic
		throw new Error(`Unknown followup stage: ${followupStage}`);
	}

	console.log(systemPrompt, "check33");
	// Build user message
	const userMessage = buildUserMessage(context);
	// console.log("User message for AI generation:");
	console.log(userMessage);
	return {
		model: "gpt-4.1",
		messages: [
			{
				role: "system",
				content: systemPrompt,
			},
			{
				role: "user",
				content: userMessage,
			},
		],
		max_tokens: 2000,
		temperature: 0.4,
	};
}

/**
 * Builds qualification stage system prompt
 */

// const rawPromptbuildQualifizierungPrompt = await getPromptContentByType(
// 	"buildQualifizierungPrompt",
// );

// const buildQualifizierungPromptfinal=
// const buildQualifizierungPromptfinal = await new Function(
// 	`return \`${rawPromptbuildQualifizierungPrompt}\`;`,
// )();
// console.log(buildQualifizierungPromptfinal);
function buildQualifizierungPrompt(context: FollowupContext): string {
	// Determine which template to use based on task subject
	if (context.taskSubject === "Qualifizierung > Start") {
		return buildQualifizierungStartPrompt(context);
	}
	if (context.taskSubject === "Qualifizierung > Follow Up 1 (Instagram DM)") {
		return buildQualifizierungFollowUp1Prompt(context);
	}
	if (context.taskSubject === "Qualifizierung > Follow Up 2 (E-Mail)") {
		return buildQualifizierungFollowUp2Prompt(context);
	}
	if (context.taskSubject === "Qualifizierung > Follow Up 3 (E-Mail)") {
		return buildQualifizierungFollowUp3Prompt(context);
	}
	if (context.taskSubject === "Qualifizierung > Follow Up 4 (E-Mail)") {
		return buildQualifizierungFollowUp4Prompt(context);
	}

	// Fallback to original prompt for any other Qualifizierung subjects
	return buildQualifizierungGenericPrompt(context);
}

/**
 * Builds prompt for Qualifizierung > Start
 */
function buildQualifizierungStartPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but friendly and personal
- Brief and concise (max. 100-150 words)
- **YES - Reference and answer questions from previous emails**
- Show understanding of creator challenges
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.
${context.personData?.followerCount ? "- Mention their specific pricing bracket naturally in the conversation" : ""}

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Answers questions from the previous email** - Review email history and respond to any questions they asked
2. **Uses the provided template structure** - Follow this template: "Hey {{first name}}, ich freue mich total, von dir zu hören! [ANSWER QUESTIONS] Lustigerweise habe ich vorgestern kurz vor Feierabend noch mit meinem Kollegen gesprochen..."
3. **Explains Startviral's concept** - Focus on engagement (not just follower count), Creator Ads using their Reels, targeting specific audiences
4. **Mentions specific results** - Reference "mindestens 2000 Profilbesucher pro Monat" and expected followers, story views, reel views
5. **Invites to a phone call** - "Lass uns vorher kurz telefonieren" and ask for "zwei Terminvorschläge"
6. **Sounds professional and enthusiastic** - Use emojis naturally (😄) and show genuine interest in their content
7. **Uses the same language** as the email conversation`;
}

/**
 * Builds prompt for Qualifizierung > Follow Up 1 (Instagram DM)
 */
function buildQualifizierungFollowUp1Prompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but friendly and casual
- **SUPER SHORT for Instagram DM (max. 30-50 words, 1-2 sentences)**
- **NO - Do NOT reference or answer questions from previous emails**
- Keep it simple and direct
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the provided template exactly** - "Hey {{first name}}, ich wollte dir kurz hier Schreiben, weil du meine Mail wahrscheinlich übersehen hast..."
2. **Mentions checking their profile** - "Ich war gerade nochmal kurz auf deinem Profil"
3. **Asks for availability** - "Hast du in den nächsten Tagen Zeit für ein Telefonat?"
4. **Explains importance of personal connection** - "Uns ist es wichtig alle Creator mit denen wir arbeiten kennenzulernen"
5. **Keeps it SUPER SHORT** - Max 30-50 words, 1-2 sentences total
6. **Uses the same language** as the previous conversation`;
}

/**
 * Builds prompt for Qualifizierung > Follow Up 2 (E-Mail)
 */
function buildQualifizierungFollowUp2Prompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but direct and assertive
- Brief and concise (max. 100-150 words)
- **NO - Do NOT reference previous emails**
- Create urgency and value scarcity
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the provided template exactly** - "Hey {{first name}}, sei bitte so gut und sag mir kurz Bescheid, wenn es zeitlich gerade nicht passt..."
2. **Explains preparation effort** - "Wir nehmen uns nämlich immer viel Zeit und bereiten unsere Gespräche sehr lange vor"
3. **Mentions prepared notes** - "Ich hatte mir jetzt schon viele Notizen für unser Telefonat gemacht"
4. **Creates urgency through scarcity** - "kann ich immer nur ein paar offene Konversationen in meinem System haben"
5. **Requests clear response** - "Deshalb sag kurz Bescheid, ansonsten würde ich an dieser Stelle jetzt erst nochmal unsere Vorab-Analyse abbrechen"
6. **Uses the same language** as the previous conversation`;
}

/**
 * Builds prompt for Qualifizierung > Follow Up 3 (E-Mail)
 */
function buildQualifizierungFollowUp3Prompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but empathetic and value-focused
- Brief and concise (max. 150-200 words)
- **NO - Do NOT reference previous emails**
- Focus on value proposition and testimonials
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the provided template exactly** - "Hey {{first name}}, schade, dass du dich nicht mehr gemeldet hast..."
2. **Mentions testimonials** - "Ich sende dir nochmal ein paar Testimonials anderer Creators im Anhang"
3. **Qualifies intent** - "vorausgesetzt du machst Instagram nicht nur als Hobby"
4. **Explains ROI focus** - "wir nur mit Creators arbeiten, die auch Kooperationen mit Brands planen"
5. **Shows concrete value** - "Im Schnitt kannst du mit 2000-3000 Story Views mehr auch mal schnell das Doppelte für eine Kooperation verlangen"
6. **Suggests phone call** - "Am besten ist da meistens einfach ein kurzes Telefonat" and asks for "Zwei Terminvorschläge"
7. **Uses the same language** as the previous conversation`;
}

/**
 * Builds prompt for Qualifizierung > Follow Up 4 (E-Mail)
 */
function buildQualifizierungFollowUp4Prompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but slightly disappointed and direct
- Brief and concise (max. 80-100 words)
- **NO - Do NOT reference previous emails**
- Create final urgency with challenge
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the provided template exactly** - "Hey {{first name}}, hast du meine Mails echt übersehen?..."
2. **Challenges their intent** - "Ich dachte, dass du Instagram nicht nur als Hobby machst"
3. **States value proposition clearly** - "um 2000-3000 Profilbesucher und Story-Views im Monat zu erhalten"
4. **Makes final call-to-action** - "Wie gesagt, lass uns gerne mal telefonieren"
5. **Requests time slots** - "Sende mir einfach 2 Terminvorschläge für diese oder kommende Woche"
6. **Uses the same language** as the previous conversation`;
}

/**
 * Fallback prompt for other Qualifizierung stages
 */
function buildQualifizierungGenericPrompt(context: FollowupContext): string {
	return `You are a creator marketing expert working for Startviral. Write a personalized qualification email.

Use the same language as previous conversations. Include specific pricing information and calendar links.`;
}

/**
 * Builds prompt for Angebot stage - handles actual patterns from real data
 */
function buildAngebotPrompt(context: FollowupContext): string {
	// Determine which template to use based on task subject
	if (context.taskSubject === "Angebot > Follow Up 1 (Anrufversuch 1)") {
		return buildAngebotFollowUp1AnrufPrompt(context);
	}
	if (context.taskSubject === "Angebot > Follow Up 1 (Anrufversuch 2)") {
		return buildAngebotFollowUp1AnrufPrompt(context);
	}
	if (
		context.taskSubject === "Angebot > Follow Up 2 (E-Mail)" ||
		context.taskSubject === "Angebot > Follow Up 2 (Mail)"
	) {
		return buildAngebotFollowUp2EmailPrompt(context);
	}
	if (context.taskSubject === "Angebot > Follow Up 3 (Anruf)") {
		return buildAngebotFollowUp3AnrufPrompt(context);
	}

	// Fallback for other outreach patterns
	return buildAngebotGenericPrompt(context);
}

/**
 * Builds prompt for Angebot > Follow Up 1 (Anrufversuch 1 & 2)
 */
function buildAngebotFollowUp1AnrufPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but friendly and warm
- Brief and concise (max. 120-180 words)
- **YES - Reference and address questions from previous emails**
- Focus on moving toward collaboration
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.
${context.personData?.followerCount ? "- Reference their specific pricing and expected results" : ""}

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the opener template** - "Hey {{first name}}, ich hoffe dir geht es gut. Ich hatte für heute eine Erinnerung im Kalender mich noch einmal bei dir zu melden. 😊"
2. **References email history** - "Ich bin vorhin nochmal kurz unseren E-Mail Verlauf durchgegangen..."
3. **Addresses their questions** - Identify and answer questions from previous conversations naturally
4. **Explains how Creator Ads work** - Integrate explanation of the concept smoothly
5. **Moves toward collaboration** - Focus on next steps and working together
6. **Shows concrete next steps** - Offer specific pricing and expected results based on their follower count
7. **Uses the same language** as the email conversation`;
}

/**
 * Builds prompt for Angebot > Follow Up 2 (E-Mail/Mail)
 */
function buildAngebotFollowUp2EmailPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional and solution-oriented
- Brief and concise (max. 120-180 words)
- **YES - Reference previous emails and interest shown**
- Focus on concrete next steps and pricing
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.
${context.personData?.followerCount ? "- Reference their specific pricing and expected results" : ""}

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the template** - "Hey {{first name}}, ich hoffe dir geht es gut! Ich hatte für heute eine Erinnerung im Kalender..."
2. **References email history** - "Ich bin vorhin nochmal kurz unseren E-Mail Verlauf durchgegangen und sehe, dass du bereits Interesse gezeigt hast"
3. **Proposes next step** - "Deshalb möchte ich dir heute direkt unseren nächsten Schritt vorschlagen"
4. **Mentions their current status** - Reference their follower count and why Creator Ads would work well now
5. **Provides specific pricing** - Include concrete pricing information based on their follower count
6. **Shows concrete next steps** - Discuss pricing structure and expected results
7. **Uses the same language** as the email conversation`;
}

/**
 * Builds prompt for Angebot > Follow Up 3 (Anruf)
 */
function buildAngebotFollowUp3AnrufPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional and confident
- Brief and concise (max. 120-180 words)
- **YES - Reference previous conversations and build on them**
- Include social proof through testimonials
- Focus on closing the collaboration
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.
${context.personData?.followerCount ? "- Reference their specific pricing and expected results" : ""}

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the template** - "Hey {{first name}}, ich hoffe dir geht es gut! Ich wollte mich nochmal bei dir melden..."
2. **Expresses confidence in fit** - "weil wir wirklich das Gefühl haben, dass wir mit unseren Creator Ads sehr viel für deinen Account bewirken können"
3. **Highlights perfect timing** - Reference their current follower count as ideal for Creator Ads
4. **Includes testimonials** - "Ich sende dir im Anhang auch nochmal ein paar Testimonials anderer Creators, die ähnlich aufgebaut sind wie du"
5. **Shows concrete results** - Mention specific results other similar creators achieved
6. **Focuses on closing** - Move toward getting them to respond positively to collaboration
7. **Uses the same language** as the email conversation`;
}

/**
 * Fallback prompt for other Angebot stages
 */
function buildAngebotGenericPrompt(context: FollowupContext): string {
	return `You are a creator marketing expert working for Startviral. Write an Angebot (Offer) email.

This is the offer phase, not qualification. Use ALL context from previous emails and conversations with this contact.
Focus on moving toward collaboration with specific pricing and next steps.`;
}

/**
 * Builds prompt for Follow Up 1 stage
 */
function buildFollowUp1Prompt(context: FollowupContext): string {
	// Determine which template to use based on task subject
	if (context.taskSubject === "E-Mail + Loom Outreach 1 (Follow Up 1)") {
		return buildFollowUp1LoomPrompt(context);
	}
	if (context.taskSubject === "Instagram / WhatsApp Outreach 2 (Follow Up 1)") {
		return buildFollowUp1InstagramPrompt(context);
	}
	if (context.taskSubject === "E-Mail / Anruf Outreach 3 (Follow Up 1)") {
		return buildFollowUp1CallPrompt(context);
	}

	// Fallback
	return buildFollowUp1GenericPrompt(context);
}

/**
 * Builds prompt for E-Mail + Loom Outreach 1 (Follow Up 1)
 */
function buildFollowUp1LoomPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but friendly and warm
- Brief and concise (max. 120-180 words)
- **YES - Reference and answer questions from previous emails**
- Focus on re-engagement after 2 months
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.
${context.personData?.followerCount ? "- Mention their specific pricing bracket naturally" : ""}

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the opener template** - "Hey {{first name}}, ich hoffe dir geht es gut. Ich hatte für heute eine Erinnerung im Kalender mich noch einmal bei dir zu melden. 😊"
2. **References email history** - "Ich bin vorhin nochmal kurz unseren E-Mail Verlauf durchgegangen..."
3. **Addresses their questions** - Identify and answer questions from previous conversations (2 months ago)
4. **Re-introduces Creator Ads concept** - Explain how it works since it's been 2 months
5. **Includes Loom video mention** - Reference sending a personalized Loom video to explain better
6. **Invites to conversation** - Suggest a call to discuss their specific situation
7. **Uses the same language** as the email conversation`;
}

/**
 * Builds prompt for Instagram / WhatsApp Outreach 2 (Follow Up 1)
 */
function buildFollowUp1InstagramPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but friendly and casual
- **SUPER SHORT for Instagram DM (max. 30-50 words, 1-2 sentences)**
- **NO - Do NOT reference previous emails**
- Keep it simple and direct for social media
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the provided template exactly** - "Hey {{first name}}, ich wollte dir kurz hier Schreiben, weil du meine Mail wahrscheinlich übersehen hast..."
2. **Mentions checking their profile** - "Ich war gerade nochmal kurz auf deinem Profil"
3. **Asks for availability** - "Hast du in den nächsten Tagen Zeit für ein Telefonat?"
4. **Explains importance of connection** - "Uns ist es wichtig alle Creator mit denen wir arbeiten kennenzulernen"
5. **Keeps it SUPER SHORT** - Max 30-50 words, 1-2 sentences total for Instagram/WhatsApp
6. **Uses the same language** as the previous conversation`;
}

/**
 * Builds prompt for E-Mail / Anruf Outreach 3 (Follow Up 1)
 */
function buildFollowUp1CallPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but empathetic and value-focused
- Brief and concise (max. 150-200 words)
- **NO - Do NOT reference previous emails directly**
- Focus on value proposition and testimonials
- Include ROI and monetization angle
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the provided template exactly** - "Hey {{first name}}, schade, dass du dich nicht mehr gemeldet hast..."
2. **Mentions testimonials** - "Ich sende dir nochmal ein paar Testimonials anderer Creators im Anhang"
3. **Qualifies intent** - "vorausgesetzt du machst Instagram nicht nur als Hobby"
4. **Explains ROI focus** - "wir nur mit Creators arbeiten, die auch Kooperationen mit Brands planen"
5. **Shows concrete value** - "Im Schnitt kannst du mit 2000-3000 Story Views mehr auch mal schnell das Doppelte für eine Kooperation verlangen"
6. **Suggests phone call** - "Am besten ist da meistens einfach ein kurzes Telefonat" and asks for "Zwei Terminvorschläge"
7. **Uses the same language** as the email conversation`;
}

/**
 * Builds prompt for Follow Up 2 stage
 */
function buildFollowUp2Prompt(context: FollowupContext): string {
	// Determine which template to use based on task subject
	if (context.taskSubject === "E-Mail Outreach 1 (Follow Up 2)") {
		return buildFollowUp2EmailPrompt(context);
	}
	if (context.taskSubject === "Instagram / WhatsApp Outreach 2 (Follow Up 2)") {
		return buildFollowUp2InstagramPrompt(context);
	}
	if (context.taskSubject === "E-Mail / Anruf Outreach 3 (Follow Up 2)") {
		return buildFollowUp2CallPrompt(context);
	}

	// Fallback
	return buildFollowUp2GenericPrompt(context);
}

/**
 * Builds prompt for E-Mail Outreach 1 (Follow Up 2)
 */
function buildFollowUp2EmailPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but friendly and warm
- Brief and concise (max. 120-180 words)
- **YES - Reference and answer questions from previous emails**
- Focus on long-term re-engagement (4 months total)
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.
${context.personData?.followerCount ? "- Mention their specific pricing bracket naturally" : ""}

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the opener template** - "Hey {{first name}}, ich hoffe dir geht es gut. Ich hatte für heute eine Erinnerung im Kalender mich noch einmal bei dir zu melden. 😊"
2. **References long email history** - "Ich bin vorhin nochmal kurz unserem E-Mail Verlauf durchgegangen..." (note: 4 months of history)
3. **Addresses their questions** - Identify and answer questions from previous conversations (including 2-4 months ago)
4. **Re-explains Creator Ads** - Provide fresh explanation since significant time has passed
5. **Shows value proposition** - Emphasize growth and engagement benefits
6. **Invites to conversation** - Suggest a call to discuss current situation
7. **Uses the same language** as the email conversation`;
}

/**
 * Builds prompt for Instagram / WhatsApp Outreach 2 (Follow Up 2)
 */
function buildFollowUp2InstagramPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but friendly and casual
- **SUPER SHORT for Instagram DM (max. 30-50 words, 1-2 sentences)**
- **NO - Do NOT reference previous emails**
- Keep it simple and direct for social media
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the provided template exactly** - "Hey {{first name}}, ich wollte dir kurz hier Schreiben, weil du meine Mail wahrscheinlich übersehen hast..."
2. **Mentions checking their profile** - "Ich war gerade nochmal kurz auf deinem Profil"
3. **Asks for availability** - "Hast du in den nächsten Tagen Zeit für ein Telefonat?"
4. **Explains importance of connection** - "Uns ist es wichtig alle Creator mit denen wir arbeiten kennenzulernen"
5. **Keeps it SUPER SHORT** - Max 30-50 words, 1-2 sentences total for Instagram/WhatsApp
6. **Uses the same language** as the previous conversation`;
}

/**
 * Builds prompt for E-Mail / Anruf Outreach 3 (Follow Up 2)
 */
function buildFollowUp2CallPrompt(context: FollowupContext): string {
	const specificPricing = context.personData?.followerCount
		? getPricingBracket(context.personData.followerCount)
		: "We'll determine your exact pricing based on your current follower count during our call.";

	return `You are a creator marketing expert working for Startviral, a Berlin-based agency that has been helping creators grow their Instagram accounts since 2017.

${STARTVIRAL_CONCEPT}

## Pricing Information
${specificPricing}

## Context
- Task Subject: ${context.taskSubject}
- Deal ID: ${context.deal.id}
- Creator: ${context.deal.title}
${context.personData?.username ? `- Instagram: @${context.personData.username}` : ""}
${context.personData?.followerCount ? `- Current Followers: ${context.personData.followerCount.toLocaleString()}` : ""}
${context.personData?.niche ? `- Niche: ${context.personData.niche}` : ""}
${context.callNotes ? `- Call Notes: ${context.callNotes}` : ""}

## Style & Tone
- Professional but empathetic and value-focused
- Brief and concise (max. 150-200 words)
- **NO - Do NOT reference previous emails directly**
- Focus on value proposition and testimonials
- Include ROI and monetization angle
- Final attempt after 4 months total
- **IMPORTANT**: Respond in the same language as the previous email conversation. If the conversation is in German, respond in German. If it's in English, respond in English.

## Calendar Links - **CRITICAL: USE THESE EXACT LINKS ONLY**
**WARNING: Do NOT create or modify these links. Use EXACTLY as written:**
- German speakers: https://calendly.com/joleen-startviral/informationsgespraech
- English speakers: https://calendly.com/joleen-startviral/discoverycall

**MANDATORY**: Copy the appropriate link EXACTLY. Do not personalize, modify, or create variations.
(Use the German link if the conversation is in German, English link if in English)

## Write a follow-up email that:
1. **Uses the provided template exactly** - "Hey {{first name}}, schade, dass du dich nicht mehr gemeldet hast..."
2. **Mentions testimonials** - "Ich sende dir nochmal ein paar Testimonials anderer Creators im Anhang"
3. **Qualifies intent** - "vorausgesetzt du machst Instagram nicht nur als Hobby"
4. **Explains ROI focus** - "wir nur mit Creators arbeiten, die auch Kooperationen mit Brands planen"
5. **Shows concrete value** - "Im Schnitt kannst du mit 2000-3000 Story Views mehr auch mal schnell das Doppelte für eine Kooperation verlangen"
6. **Suggests phone call** - "Am besten ist da meistens einfach ein kurzes Telefonat" and asks for "Zwei Terminvorschläge"
7. **Uses the same language** as the email conversation`;
}

/**
 * Fallback prompts for Follow Up stages
 */
function buildFollowUp1GenericPrompt(context: FollowupContext): string {
	return `You are a creator marketing expert working for Startviral. Write a Follow Up 1 email (after 2 months).

Use ALL context from previous emails and previous conversations with this contact.`;
}

function buildFollowUp2GenericPrompt(context: FollowupContext): string {
	return `You are a creator marketing expert working for Startviral. Write a Follow Up 2 email (after another 2 months).

Use ALL context from previous emails and previous conversations with this contact.`;
}

/**
 * Builds user message with email history context
 */
function buildUserMessage(context: FollowupContext): string {
	const { deal, personData, emailHistory, taskSubject } = context;

	let message = `Please write a follow-up email for this creator deal:

Deal: ${deal.title}
Task: ${taskSubject}
${personData?.username ? `Creator: @${personData.username}` : ""}
${personData?.followerCount ? `Current Followers: ${personData.followerCount.toLocaleString()}` : ""}
${personData?.niche ? `Niche: ${personData.niche}` : ""}

Previous email conversation:
`;

	// Add email history (last 5 emails for context)
	const recentEmails = emailHistory.slice(-5);
	for (const email of recentEmails) {
		message += `
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Date: ${email.timestamp}
Content: ${email.content}
---`;
	}

	message += `

Based on this conversation history, write an appropriate follow-up email that:
1. Responds in the same language as the conversation above
2. Moves the conversation forward toward the goal of this stage
3. Uses the appropriate calendar link (German or English) based on the conversation language
${personData?.followerCount ? "4. Naturally mentions their specific pricing bracket and expected results" : "4. Discusses pricing structure appropriately"}`;

	return message;
}

function getFrom(ctx: Record<string, unknown>, path: string) {
	const parts = path.split(".");
	let cur: unknown = ctx;
	for (const key of parts) {
		if (
			cur === null ||
			typeof cur !== "object" ||
			!Object.prototype.hasOwnProperty.call(cur as object, key)
		) {
			return undefined;
		}
		cur = (cur as Record<string, unknown>)[key];
	}
	return cur;
}

function parseStringLiteral(raw: string) {
	// support both 'single' and "double" quoted strings
	if (!STR_LIT.test(raw)) return undefined;
	const quote = raw[0];
	const inner = raw.slice(1, -1);
	// very small unescape for \" and \'
	return inner
		.replace(new RegExp(`\\\\${quote}`, "g"), quote)
		.replace(/\\n/g, "\n");
}

function evalTerm(term: string, ctx: Record<string, unknown>) {
	if (IDENT.test(term)) return getFrom(ctx, term);
	if (STR_LIT.test(term)) return parseStringLiteral(term);
	if (NUM_LIT.test(term)) return Number(term);
	if (term === "true") return true;
	if (term === "false") return false;
	if (term === "null") return null;
	if (term === "undefined") return undefined;
	throw new Error(`Illegal expression in template: ${term}`);
}

// Allowed grammar: <term> ( ( "||" | "??" ) <term> )*
function evaluateExpr(expr: string, ctx: Record<string, unknown>) {
	const tokens = expr
		.split(/(\|\||\?\?)/)
		.map((t) => t.trim())
		.filter(Boolean);
	if (tokens.length === 0) return "";
	let value = evalTerm(tokens[0], ctx);
	for (let i = 1; i < tokens.length; i += 2) {
		const op = tokens[i];
		const rhs = evalTerm(tokens[i + 1], ctx);
		if (op === "??") {
			value = value ?? rhs; // only null/undefined fallback
		} else if (op === "||") {
			// JS truthiness fallback (empty string/0/false will fallback)
			value = value || rhs;
		} else {
			throw new Error(`Illegal operator in template: ${op}`);
		}
	}
	return value;
}

async function renderTemplate(
	template: string,
	context: Record<string, unknown>,
	opts: { missing?: "throw" | "empty" | "leave" } = { missing: "throw" },
): Promise<string> {
	return template.replace(VAR, (_m, raw) => {
		const expr = String(raw).trim();

		// Quick guard: only allow identifiers, dots, quotes, numbers, spaces, and the operators
		if (
			!/^[\w.$\s'"+-?|\u0600-\u06FF-]+$/.test(expr) ||
			/[^\s](?:[=;`]|>>|<<)/.test(expr)
		) {
			if (opts.missing === "leave") return `\${${raw}}`;
			if (opts.missing === "empty") return "";
			throw new Error(`Illegal expression in template: ${expr}`);
		}

		const val = evaluateExpr(expr, context);
		if (val === undefined || val === null) {
			if (opts.missing === "leave") return `\${${raw}}`;
			if (opts.missing === "empty") return "";
			throw new Error(`Missing value for ${expr}`);
		}
		return String(val);
	});
}
/**
 * Export functions for use in run-followup-generation
 */
/**
 * Export functions for use in run-followup-generation
 */
export {
	saveGeneratedFollowupEmail,
	createOrUpdateDealNote,
	upsertPipedriveDeal,
	fetchDealsNeedingFollowup,
	fetchFollowupDataForDeal,
	extractCallNotes,
	type FollowupContext,
};
// export async function main() {
// 	// Example: fetch and log followup data for deals
// 	// const result = await fetchFollowupDataForDeals().runPromise();
// 	// console.log("Followup data:", result);
// 	// console.log(STARTVIRAL_CONCEPT);
// }

// // Only run if executed directly (not imported)
// if (import.meta.main) {
// 	main().catch((err) => {
// 		console.error("Error in main:", err);
// 		process.exit(1);
// 	});
// }
