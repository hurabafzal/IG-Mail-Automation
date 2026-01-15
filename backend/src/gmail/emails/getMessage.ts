import { sendSlackMessage } from "backend/src/utils/slack";
import { Effect } from "effect";
import type { gmail_v1 } from "googleapis";
import parse from "node-html-parser";

export interface Message {
	id: string;
	threadId: string;
	message: string;
	from: string;
	subject: string;
	date: string;
	to: string;
	reply_to: string;
	forwarded_from?: string;
}

function parseEmail(e: string) {
	if (e.includes("<") && e.includes(">")) {
		const start = e.indexOf("<");
		const end = e.indexOf(">");
		return e.slice(start + 1, end);
	}
	return e;
}

export function getThreadMessages(
	threadId: string,
	thread: gmail_v1.Schema$Thread,
) {
	const messages = thread.messages || [];
	return Effect.all(messages.map((m) => getMessage(threadId, m)));
}
export function getMessage(
	threadId: string,
	message: gmail_v1.Schema$Message,
): Effect.Effect<Message> {
	if (!message.id) {
		sendSlackMessage("FIX IMMEDIATELY. NO ID");
		throw new Error("no id");
	}
	let from = "";
	let subject = "";
	let date = "";
	let to = "";
	let reply_to = "";
	for (const header of message.payload?.headers || []) {
		if (header.name === "From") from = parseEmail(header.value ?? "");
		if (header.name === "Subject") subject = header.value ?? "";
		if (header.name === "Date") date = header.value ?? "";
		if (header.name === "To") to = parseEmail(header.value ?? "");
		if (header.name === "Reply-To") reply_to = parseEmail(header.value ?? "");
	}
	// need to search for a message with the mime type of text/plain
	const message_parts = [message.payload];
	let first_html_part = "";
	while (message_parts.length > 0) {
		const message_part = message_parts.pop();
		if (!message_part) continue;
		if (message_part.mimeType === "text/html" && first_html_part === "") {
			const body64 = message_part.body?.data;
			// base64 decode the body
			if (!body64) continue;
			first_html_part = Buffer.from(body64, "base64").toString();
		} else if (message_part.mimeType === "text/plain") {
			const body64 = message_part.body?.data;
			// base64 decode the body
			if (!body64) continue;
			const body = Buffer.from(body64, "base64").toString();
			// support both German ("Von:") and English ("From:") forwarded headers
			const forwarded_message_regex =
				/^---------- Forwarded message ---------\r\n(?:Von|From): (.*)\r\n(?:Date|Gesendet): (.*)\r\n(?:Subject|An): (.*)\r\n(?:To|Betreff): (.*)/m;

			const forwarded_message = forwarded_message_regex.exec(body);
			// console.log("forwarded_message: ", forwarded_message);
			if (forwarded_message) {
				// get Von and To
				const forwarded_from = parseEmail(from);
				from = parseEmail(forwarded_message[1]);
				// "forwarded_message" can have Subject/Betreff and To/An in either order depending on language
				// If "Subject" is present, then [3] is Subject and [4] is To
				// If "Betreff" is present, then [3] is To and [4] is Subject
				// We'll check if [3] matches an email regex to decide
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				const possibleTo = parseEmail(forwarded_message[4]);
				const possibleToAlt = parseEmail(forwarded_message[3]);
				if (emailRegex.test(possibleTo)) {
					to = possibleTo;
				} else if (emailRegex.test(possibleToAlt)) {
					to = possibleToAlt;
				} else {
					to = possibleTo; // fallback, even if not a valid email
				}

				return Effect.succeed({
					id: message.id,
					threadId,
					message: body,
					from,
					subject,
					date,
					to,
					reply_to,
					forwarded_from,
				});
			}
			return Effect.succeed({
				id: message.id,
				threadId,
				message: body,
				from,
				subject,
				date,
				to,
				reply_to,
			});
		} else if (message_part.parts) {
			message_parts.push(...message_part.parts);
		}
	}
	console.error(
		`no text/plain message found for message id ${message.id}, parsing text/html instead...`,
	);
	if (first_html_part === "") {
		console.error(
			`no text/html message found for message id ${message.id} either`,
		);
		return Effect.succeed({
			id: message.id,
			threadId,
			message: "",
			from,
			subject,
			date,
			to,
			reply_to,
		});
	}
	const root = parse(first_html_part);
	// get rid of all the script and style and DOCTYPE
	for (const s of root.querySelectorAll("script")) s.remove();
	for (const s of root.querySelectorAll("style")) s.remove();

	const messageText = (root.querySelector("html") ?? root).structuredText;

	return Effect.succeed({
		id: message.id,
		threadId,
		message: messageText,
		from,
		subject,
		date,
		to,
		reply_to,
	});
}
