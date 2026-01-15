// // in gmail we can create the tag Pipedrive that should trigger the import along with
// // all the data that we have in the ig database and create a deal with it
// // we basically need the deal to be created in the first column “interesse”
// // you can set the fields here: https://startviral.pipedrive.com/settings/fields

// import { BunRuntime } from "@effect/platform-bun";
// import { db, db_retry_effect } from "backend/src/db";
// import { GmailLabel } from "backend/src/db/db_types";
// import { pipedriveLIVE } from "backend/src/pipedrive";
// import { CandidatePipedrive } from "backend/src/pipedrive/objects/candidate";
// import { COUNTRY_GROUPS } from "backend/src/utils/consts";
// import { sendSlackMessageE } from "backend/src/utils/slack";
// import { Console, Effect, Schedule, pipe } from "effect";
// // import { BunRuntime } from "@effect/platform-bun";
// import {
// 	GmailClient,
// 	GoogleAuthClient,
// 	GoogleAuthTokenStore,
// } from "../auth/services";
// import { blacklistEmails } from "./blacklist";
// import {
// 	type Label,
// 	filterEmails,
// 	findLabel,
// 	getAllThreadIds,
// 	getThreadIds,
// } from "./findEmails";
// import { getCandidatesFromMsgs } from "./getCandidate";
// import { type Message, getThreadMessages } from "./getMessage";

// export const aggregatorEmail = "joleen@startviral.de";

// export const getEmailContent = (ids: string[]) =>
// 	Effect.all(
// 		ids.map((threadId) =>
// 			pipe(
// 				Effect.flatMap(GmailClient, (gmail) =>
// 					Effect.tryPromise(() =>
// 						gmail.users.threads.get({
// 							userId: "me",
// 							id: threadId,
// 						}),
// 					),
// 				),
// 				Effect.flatMap((thread) => getThreadMessages(threadId, thread.data)),
// 			),
// 		),
// 	).pipe(Effect.map((x) => x.flat()));

// export const saveMessages = (
// 	messages: Message[],
// 	gmail: string,
// 	label: Label,
// ) => {
// 	const visitedEmailIds = new Set<string>();
// 	const uniqueMessages = messages.filter((m) => {
// 		if (visitedEmailIds.has(m.id)) {
// 			return false;
// 		}
// 		visitedEmailIds.add(m.id);
// 		return true;
// 	});
// 	return db_retry_effect({ name: "saveGmails" }, () =>
// 		db
// 			.insertInto("GmailAccountEmails")
// 			.values(
// 				uniqueMessages.map((m) => ({
// 					emailId: m.id,
// 					threadId: m.threadId,
// 					body: m.message,
// 					from: m.from,
// 					gmail,
// 					replyTo: m.reply_to,
// 					subject: m.subject,
// 					to: m.to,
// 					label:
// 						label === "Blacklist" ? GmailLabel.BLACKLIST : GmailLabel.PIPEDRIVE,
// 				})),
// 			)
// 			.onConflict((oc) =>
// 				oc.column("emailId").doUpdateSet((eb) => ({
// 					label: eb.ref("excluded.label"),
// 					threadId: eb.ref("excluded.threadId"),
// 				})),
// 			)
// 			.execute(),
// 	);
// };

// export class NoNewEmailsError {
// 	readonly _tag = "NoNewEmailsError";
// }

// const getNewEmails = (label: Label) =>
// 	pipe(
// 		findLabel(label),
// 		Effect.tap((labelId) => Console.log("Label ID: ", labelId)),

// 		// get email ids with pipedrive label
// 		Effect.flatMap((labelId) => getThreadIds(labelId)),

// 		// filter for emails not in the database
// 		Effect.flatMap(filterEmails),
// 		Effect.tap((ids) => Console.log(`New email ids: ${ids}`)),

// 		// get email content
// 		Effect.flatMap((ids) => getEmailContent(ids)),

// 		// short circuit if no new emails
// 		Effect.flatMap((messages) =>
// 			messages.length < 1
// 				? Effect.fail(new NoNewEmailsError())
// 				: Effect.succeed(messages),
// 		),
// 	);

// const langs = COUNTRY_GROUPS.map((c) => c.id);

// const mainFlow = (email: string, label: Label) =>
// 	pipe(
// 		// get pipedrive label id
// 		getNewEmails(label),

// 		Effect.tap((messages) =>
// 			pipe(
// 				getCandidatesFromMsgs(messages),
// 				Effect.tap((candidates) =>
// 					Console.log(`got ${candidates.length} candidates`),
// 				),

// 				// push candidates to pipedrive
// 				Effect.tap((candidates) =>
// 					label !== "Blacklist"
// 						? Effect.all(
// 								candidates.map((c) =>
// 									CandidatePipedrive.add({
// 										person: {
// 											...c.person,
// 											language:
// 												langs.find((l) => `Pipedrive ${l}` === label) ?? "DE",
// 										},
// 										deal: {
// 											...c.deal,
// 											language:
// 												langs.find((l) => `Pipedrive ${l}` === label) ?? "DE",
// 										},
// 									}),
// 								),
// 							)
// 						: null,
// 				),

// 				// blacklist username
// 				Effect.tap((candidates) =>
// 					candidates.length > 0
// 						? db_retry_effect({ name: "blacklistUsername" }, () =>
// 								db
// 									.updateTable("InstagramAccountBase")
// 									.set({
// 										blacklist: true,
// 										blacklisted_at:
// 											label === "Blacklist" ? new Date() : undefined,
// 									})
// 									.where(
// 										"username",
// 										"in",
// 										candidates.map((x) => x.person.username),
// 									)
// 									.execute(),
// 							)
// 						: null,
// 				),

// 				// get all emails that belong to the users, combine with candidate emails
// 				Effect.andThen((candidates) =>
// 					pipe(
// 						// get all emails
// 						candidates.length > 0
// 							? db_retry_effect({ name: "getEmails" }, () =>
// 									db
// 										.selectFrom("Email")
// 										.innerJoin(
// 											"InstagramAccountBase",
// 											"Email.instagram_id",
// 											"InstagramAccountBase.id",
// 										)
// 										.select("Email.email")
// 										.where(
// 											"InstagramAccountBase.username",
// 											"in",
// 											candidates.map((c) => c.person.username),
// 										)
// 										.execute()
// 										.then((x) => x.map((y) => y.email)),
// 								)
// 							: Effect.succeed([]),

// 						// combine db emails with candidate emails
// 						Effect.map((emails) => [
// 							...candidates.flatMap((x) => x.person.email.map((y) => y.value)),
// 							...emails,
// 						]),

// 						// dedupe emails
// 						Effect.map((emails) => Array.from(new Set(emails))),

// 						// blacklist all of them
// 						Effect.tap((emails) => blacklistEmails(emails)),
// 					),
// 				),

// 				Effect.tap(Console.log("Done pipedrive + blacklist workflow!")),
// 			),
// 		),

// 		// mark as read
// 		Effect.tap((m) => saveMessages(m, email, label)),
// 	);

// const program = (email: string, label: Label) =>
// 	pipe(
// 		GoogleAuthTokenStore,
// 		Effect.flatMap((store) => store.get(email)),
// 		Effect.flatMap((refreshToken) =>
// 			pipe(
// 				mainFlow(email, label),
// 				Effect.provide(GmailClient.Live(refreshToken)),
// 				Effect.provide(GoogleAuthClient.Live),
// 				Effect.catchTags({
// 					NoNewEmailsError: () =>
// 						pipe(
// 							Effect.succeed([] as Message[]),
// 							Effect.tap(() => Console.log("No new emails")),
// 						),
// 					LabelNotFoundError: () =>
// 						pipe(
// 							Effect.succeed([] as Message[]),
// 							Effect.tap(() => Console.error("Label not found")),
// 						),
// 					InvalidLoginError: () =>
// 						pipe(
// 							Effect.succeed([] as Message[]),
// 							Effect.tap(() =>
// 								sendSlackMessageE(`invalid login error for ${email}`),
// 							),
// 						),
// 				}),
// 			),
// 		),
// 		Effect.provide(GoogleAuthTokenStore.Live),
// 		Effect.provide(pipedriveLIVE),
// 		Effect.catchAll((e) => {
// 			Console.error(e);
// 			return Effect.void;
// 		}),
// 	);

// export const gmailLabelCron = Effect.repeat(
// 	Effect.all([
// 		...langs.map((l) =>
// 			program(
// 				"joleen@startviral.de",
// 				l === "DE" ? "Pipedrive" : `Pipedrive ${l}`,
// 			),
// 		),
// 		program("joleen@startviral.de", "Blacklist"),
// 	]),
// 	Schedule.spaced("200 seconds"),
// );

// // BunRuntime.runMain(program("joleen@startviral.de", "Blacklist"));

// // const test = getCandidatesFromMsgs([
// // 	{
// // 		id: "1",
// // 		from: "estella.scheinecker@gmail.com",
// // 		to: "estella.scheinecker@gmail.com",
// // 		date: "2021-09-01",
// // 		message: "test",
// // 		reply_to: "",
// // 		subject: "test",
// // 	},
// // ]).pipe(Effect.tap((x) => Console.log(x)));

// // BunRuntime.runMain(programBlacklist);
// in gmail we can create the tag Pipedrive that should trigger the import along with
// all the data that we have in the ig database and create a deal with it
// we basically need the deal to be created in the first column "interesse"
// you can set the fields here: https://startviral.pipedrive.com/settings/fields

// in gmail we can create the tag Pipedrive that should trigger the import along with
// all the data that we have in the ig database and create a deal with it
// we basically need the deal to be created in the first column "interesse"
// you can set the fields here: https://startviral.pipedrive.com/settings/fields

import { BunRuntime } from "@effect/platform-bun";
import { db, db_retry_effect } from "backend/src/db";
import { GmailLabel } from "backend/src/db/db_types";
import { pipedriveLIVE } from "backend/src/pipedrive";
import { CandidatePipedrive } from "backend/src/pipedrive/objects/candidate";
import { DealPipedrive } from "backend/src/pipedrive/objects/deal";
import { NotePipedrive } from "backend/src/pipedrive/objects/note";
import { PersonPipedrive } from "backend/src/pipedrive/objects/person";
import { COUNTRY_GROUPS } from "backend/src/utils/consts";
import { sendSlackMessageE } from "backend/src/utils/slack";
import { Console, Effect, Schedule, pipe } from "effect";
import { parse } from "node-html-parser";
import OpenAI from "openai";
import { env } from "../../env";
// import { BunRuntime } from "@effect/platform-bun";
import {
	GmailClient,
	GoogleAuthClient,
	GoogleAuthTokenStore,
} from "../auth/services";
import { blacklistEmails } from "./blacklist";
import {
	type Label,
	filterEmails,
	findLabel,
	getAllThreadIds,
	getThreadIds,
} from "./findEmails";
import { INBOX_TO_USER_ID_MAP, getCandidatesFromMsgs } from "./getCandidate";
import { type Message, getThreadMessages } from "./getMessage";

const openai = new OpenAI({ apiKey: env.OPEN_AI_API_KEY });

export const aggregatorEmail = "joleen@startviral.de";

export const getEmailContent = (ids: string[]) =>
	Effect.all(
		ids.map((threadId) =>
			pipe(
				Effect.flatMap(GmailClient, (gmail) =>
					Effect.tryPromise(() =>
						gmail.users.threads.get({
							userId: "me",
							id: threadId,
						}),
					),
				),
				Effect.flatMap((thread) => getThreadMessages(threadId, thread.data)),
			),
		),
	).pipe(Effect.map((x) => x.flat()));

export const saveMessages = (
	messages: Message[],
	gmail: string,
	label: Label,
) => {
	const visitedEmailIds = new Set<string>();
	const uniqueMessages = messages.filter((m) => {
		if (visitedEmailIds.has(m.id)) {
			return false;
		}
		visitedEmailIds.add(m.id);
		return true;
	});
	return db_retry_effect({ name: "saveGmails" }, () =>
		db
			.insertInto("GmailAccountEmails")
			.values(
				uniqueMessages.map((m) => ({
					emailId: m.id,
					threadId: m.threadId,
					body: m.message,
					from: m.from,
					gmail,
					replyTo: m.reply_to,
					subject: m.subject,
					to: m.to,
					label:
						label === "Blacklist" ? GmailLabel.BLACKLIST : GmailLabel.PIPEDRIVE,
				})),
			)
			.onConflict((oc) =>
				oc.column("emailId").doUpdateSet((eb) => ({
					label: eb.ref("excluded.label"),
					threadId: eb.ref("excluded.threadId"),
				})),
			)
			.execute(),
	);
};

export class NoNewEmailsError {
	readonly _tag = "NoNewEmailsError";
}

const getNewEmails = (label: Label) =>
	pipe(
		findLabel(label),
		Effect.tap((labelId) => Console.log("Label ID: ", labelId)),

		// get email ids with pipedrive label
		Effect.flatMap((labelId) => getThreadIds(labelId)),

		// filter for emails not in the database
		Effect.flatMap(filterEmails),
		Effect.tap((ids) => Console.log(`New email ids: ${ids}`)),

		// get email content
		Effect.flatMap((ids) => getEmailContent(ids)),

		// short circuit if no new emails
		Effect.flatMap((messages) =>
			messages.length < 1
				? Effect.fail(new NoNewEmailsError())
				: Effect.succeed(messages),
		),
	);

const langs = COUNTRY_GROUPS.map((c) => c.id);

const mainFlow = (email: string, label: Label) =>
	pipe(
		// get pipedrive label id
		getNewEmails(label),

		Effect.tap((messages: unknown[]) => {
			const user_id = INBOX_TO_USER_ID_MAP[email];
			const owner_id = INBOX_TO_USER_ID_MAP[email];

			if (user_id === undefined || owner_id === undefined) {
				Console.error(
					`❌ ERROR: No user_id mapping found for inbox "${email}". Add it to INBOX_TO_USER_ID_MAP in getCandidate.ts. Skipping processing.`,
				);
				return Effect.succeed([]);
			}

			Console.log(
				`Using user_id ${user_id} and owner_id ${owner_id} for inbox ${email}`,
			);

			return pipe(
				// biome-ignore lint/suspicious/noExplicitAny: Type mismatch between Message[] and unknown[] requires any
				getCandidatesFromMsgs(messages as any, user_id, owner_id),
				Effect.tap((candidates: unknown[]) =>
					Console.log(`got ${candidates.length} candidates`),
				),

				// push candidates to pipedrive
				Effect.tap((candidates) =>
					label !== "Blacklist"
						? Effect.all(
								candidates.map((c) =>
									CandidatePipedrive.add({
										person: {
											...c.person,
											language:
												langs.find((l) => `Pipedrive ${l}` === label) ?? "DE",
										},
										deal: {
											...c.deal,
											language:
												langs.find((l) => `Pipedrive ${l}` === label) ?? "DE",
										},
									}),
								),
							)
						: null,
				),

				// blacklist username
				Effect.tap((candidates: Record<string, unknown>[]) =>
					candidates.length > 0
						? db_retry_effect({ name: "blacklistUsername" }, () =>
								db
									.updateTable("InstagramAccountBase")
									.set({
										blacklist: true,
										blacklisted_at:
											label === "Blacklist" ? new Date() : undefined,
									})
									.where(
										"username",
										"in",
										candidates.map(
											(x: Record<string, unknown>) =>
												(x.person as Record<string, unknown>)
													.username as string,
										),
									)
									.execute(),
							)
						: null,
				),

				// get all emails that belong to the users, combine with candidate emails
				Effect.andThen((candidates: Record<string, unknown>[]) =>
					pipe(
						// get all emails
						candidates.length > 0
							? db_retry_effect({ name: "getEmails" }, () =>
									db
										.selectFrom("Email")
										.innerJoin(
											"InstagramAccountBase",
											"Email.instagram_id",
											"InstagramAccountBase.id",
										)
										.select("Email.email")
										.where(
											"InstagramAccountBase.username",
											"in",
											candidates.map(
												(c: Record<string, unknown>) =>
													(c.person as Record<string, unknown>)
														.username as string,
											),
										)
										.execute()
										.then((x) => x.map((y) => y.email)),
								)
							: Effect.succeed([]),

						// combine db emails with candidate emails
						Effect.map((emails: string[]) => [
							...candidates.flatMap((x: Record<string, unknown>) =>
								(
									(x.person as Record<string, unknown>).email as Record<
										string,
										unknown
									>[]
								).map((y: Record<string, unknown>) => y.value as string),
							),
							...emails,
						]),

						// dedupe emails
						Effect.map((emails) => Array.from(new Set(emails))),

						// blacklist all of them
						Effect.tap((emails) => blacklistEmails(emails)),
					),
				),

				Effect.tap(Console.log("Done pipedrive + blacklist workflow!")),
			);
		}),

		// mark as read
		Effect.tap((m) => saveMessages(m as Message[], email, label)),
	);

const program = (email: string, label: Label) =>
	pipe(
		GoogleAuthTokenStore,
		Effect.flatMap((store) => store.get(email)),
		Effect.flatMap((refreshToken) =>
			pipe(
				mainFlow(email, label),
				Effect.provide(GmailClient.Live(refreshToken)),
				Effect.provide(GoogleAuthClient.Live),
				Effect.catchTags({
					NoNewEmailsError: () =>
						pipe(
							Effect.succeed([] as Message[]),
							Effect.tap(() => Console.log("No new emails")),
						),
					LabelNotFoundError: () =>
						pipe(
							Effect.succeed([] as Message[]),
							Effect.tap(() => Console.error("Label not found")),
						),
					InvalidLoginError: () =>
						pipe(
							Effect.succeed([] as Message[]),
							Effect.tap(() =>
								sendSlackMessageE(`invalid login error for ${email}`),
							),
						),
				}),
			),
		),
		Effect.provide(GoogleAuthTokenStore.Live),
		Effect.provide(pipedriveLIVE),
		Effect.catchAll((e) => {
			Console.error(e);
			return Effect.void;
		}),
	);

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
 * Translates NL language emails to German in Qualifizierung stage ONLY
 * Only runs ONCE per deal by checking for existing translation note
 */
const translateEmailsWorker = Effect.gen(function* () {
	console.log("🌍 Starting email translation worker...");

	try {
		// Get all open deals from Pipedrive
		const dealsResponse = yield* DealPipedrive.getDealsNeedingFollowUp().pipe(
			Effect.provide(pipedriveLIVE),
		);

		console.log(
			`📋 Checking ${dealsResponse.data.length} open deals for NL language translation needs`,
		);

		let translatedCount = 0;
		let skippedCount = 0;

		for (const deal of dealsResponse.data) {
			try {
				// Filter for Qualifizierung stage ONLY (stage_id 10 - "Qualifizierung / Terminanfrage")
				const QUALIFIZIERUNG_STAGE_ID = 10;
				if (deal.stage_id !== QUALIFIZIERUNG_STAGE_ID) {
					continue;
				}

				// Get person ID from deal
				const personId = deal.person_id?.value;
				if (!personId) {
					console.log(`⚠️ Deal ${deal.id} has no person_id, skipping`);
					continue;
				}

				// Get person details to check language
				const person = yield* PersonPipedrive.getById(personId).pipe(
					Effect.provide(pipedriveLIVE),
				);

				// Access person language field using the correct field ID
				const personData = person.data as Record<string, unknown>;
				const language = personData[
					"696c621a27a918553dcb5b9e0e9531b8ef084439"
				] as string; // Person language field ID

				// Only process NL language deals (skip EN/DE and other languages)
				if (language !== "NL") {
					continue;
				}

				console.log(
					`📧 Deal ${deal.id} (${deal.title}) - Person ${personData.name} has language: ${language}`,
				);

				// Check if already translated (look for translation note)
				const notes = yield* NotePipedrive.getDealNotes(deal.id).pipe(
					Effect.provide(pipedriveLIVE),
				);

				const hasTranslation = notes?.some(
					(note) =>
						note.content?.includes("🌍 Email Translation (") &&
						note.content.includes(language),
				);

				if (hasTranslation) {
					console.log(`✓ Deal ${deal.id} already has translation, skipping`);
					skippedCount++;
					continue;
				}

				// Get associated emails
				const mailMessages = yield* DealPipedrive.getMailMessages(deal.id, {
					limit: 20,
				}).pipe(Effect.provide(pipedriveLIVE));

				if (!mailMessages.data || mailMessages.data.length === 0) {
					console.log(
						`⏳ Deal ${deal.id} has no emails associated yet, skipping...`,
					);
					continue;
				}

				// Find the first customer email (not from startviral)
				const customerEmail = mailMessages.data.find(
					(msg) =>
						msg.data.from?.[0]?.email_address &&
						!msg.data.from[0].email_address
							.toLowerCase()
							.includes("startviral.de"),
				);

				if (!customerEmail || !customerEmail.data.body_url) {
					console.log(`⚠️ Deal ${deal.id} has no customer email with body_url`);
					continue;
				}

				console.log(
					`📨 Fetching email body for deal ${deal.id} from: ${customerEmail.data.from[0]?.email_address}`,
				);

				// Fetch email body from signed URL
				const response = yield* Effect.tryPromise({
					try: () => fetch(customerEmail.data.body_url as string),
					catch: (error) =>
						new Error(
							`Failed to fetch email body for deal ${deal.id}: ${error}`,
						),
				});

				const emailBody = yield* Effect.tryPromise({
					try: () => (response as Response).text(),
					catch: (error) =>
						new Error(
							`Failed to read email body for deal ${deal.id}: ${error}`,
						),
				});

				// Clean HTML to text
				const cleanText = htmlToCleanText(emailBody);

				if (!cleanText || cleanText.length < 10) {
					console.log(`⚠️ Deal ${deal.id} has empty or too short email body`);
					skippedCount++;
					continue;
				}

				console.log(
					`🤖 Translating email for deal ${deal.id} (${language} → German)...`,
				);

				// Translate with OpenAI
				const translation = yield* Effect.tryPromise({
					try: () =>
						openai.chat.completions.create({
							model: "gpt-4",
							messages: [
								{
									role: "system",
									content: `You are translating an email from ${language} to German. 
											Maintain the tone, style, and formatting. 
											Only provide the German translation, no explanations or additional text.
											Keep line breaks and structure similar to the original.`,
								},
								{
									role: "user",
									content: cleanText,
								},
							],
							max_tokens: 2000,
							temperature: 0.3,
						}),
					catch: (error) =>
						new Error(
							`OpenAI translation failed for deal ${deal.id}: ${error}`,
						),
				});

				const translatedText = translation.choices[0]?.message?.content;

				if (!translatedText) {
					console.log(`❌ Translation failed for deal ${deal.id}`);
					skippedCount++;
					continue;
				}

				// Create pinned note with translation
				yield* NotePipedrive.add({
					content: `🌍 Email Translation (${language} → DE)

Person: ${personData.name} (${personData.primary_email})
Original email from: ${customerEmail.data.from[0]?.email_address}
Sent: ${customerEmail.data.message_time}

──────────────────────────
GERMAN TRANSLATION:
──────────────────────────

${translatedText}

──────────────────────────
This translation was automatically generated to help with communication in the Qualifizierung stage.`,
					deal_id: deal.id,
					pinned_to_deal_flag: 1, // Pin it for visibility
				}).pipe(Effect.provide(pipedriveLIVE));

				console.log(
					`✅ Successfully translated and added note to deal ${deal.id}`,
				);
				translatedCount++;

				// Small delay to avoid rate limiting
				yield* Effect.sleep("1 second");
			} catch (error) {
				console.error(`Error processing deal ${deal.id}:`, error);
			}
		}

		console.log(
			`✓ Email translation worker completed: ${translatedCount} translated, ${skippedCount} skipped`,
		);
	} catch (error) {
		console.error("❌ Email translation worker error:", error);
	}
}).pipe(
	Effect.catchAll((error) => {
		console.error("❌ Email translation worker fatal error:", error);
		return Effect.void;
	}),
	Effect.provide(pipedriveLIVE),
);

export const gmailLabelCron = Effect.repeat(
	Effect.all([
		// Process Gmail labels (new emails) - joleen@startviral.de
		...langs.map((l) =>
			program(
				"joleen@startviral.de",
				l === "DE" ? "Pipedrive" : `Pipedrive ${l}`,
			),
		),
		program("joleen@startviral.de", "Blacklist"),
		// Process Gmail labels (new emails) - mani@startviral.de
		...langs.map((l) =>
			program(
				"mani@startviral.de",
				l === "DE" ? "Pipedrive" : `Pipedrive ${l}`,
			),
		),
		program("mani@startviral.de", "Blacklist"),
		// Translate existing emails in Qualifizierung stage
		translateEmailsWorker,
	]),
	Schedule.spaced("200 seconds"),
);

// BunRuntime.runMain(program("joleen@startviral.de", "Blacklist"));

// const test = getCandidatesFromMsgs([
// 	{
// 		id: "1",
// 		from: "estella.scheinecker@gmail.com",
// 		to: "estella.scheinecker@gmail.com",
// 		date: "2021-09-01",
// 		message: "test",
// 		reply_to: "",
// 		subject: "test",
// 	},
// ]).pipe(Effect.tap((x) => Console.log(x)));

// BunRuntime.runMain(programBlacklist);
