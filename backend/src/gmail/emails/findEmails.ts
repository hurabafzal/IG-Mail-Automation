import { db, db_retry_effect } from "backend/src/db";
import type { Lang } from "backend/src/db/db_types";
import { Console, Effect, pipe } from "effect";
import type { gmail_v1 } from "googleapis";
import { GmailClient } from "../auth/services";

class LabelNotFoundError {
	readonly _tag = "LabelNotFoundError";
}

export type Label = "Pipedrive" | "Blacklist" | `Pipedrive ${Lang}`;

const labels = GmailClient.pipe(
	Effect.tap(() => Console.log("Getting labels")),
	Effect.flatMap((gmail) =>
		Effect.tryPromise(() => gmail.users.labels.list({ userId: "me" })),
	),
	Effect.map((res) => res.data.labels ?? []),
);

export const findLabel = (name: Label) =>
	pipe(
		labels,
		Effect.map((ls) => ls.find((l) => l.name === name)),
		Effect.tap((label) => Console.log(label)),
		Effect.flatMap((label) =>
			label?.id
				? Effect.succeed(label.id)
				: Effect.fail(new LabelNotFoundError()),
		),
	);

export const getEmailIds = (labelId: string) =>
	GmailClient.pipe(
		Effect.flatMap((gmail) =>
			Effect.tryPromise(() =>
				gmail.users.messages.list({ userId: "me", labelIds: [labelId] }),
			),
		),
		Effect.map((res) => res.data.messages?.map((m) => m.id) ?? []),
		Effect.map((ids) => ids.filter((id) => id !== undefined && id !== null)),
	);

export const getThreadIds = (labelId: string) =>
	GmailClient.pipe(
		Effect.flatMap((gmail) =>
			Effect.tryPromise(() =>
				gmail.users.messages.list({ userId: "me", labelIds: [labelId] }),
			),
		),
		Effect.map((res) => res.data.messages?.map((m) => m.threadId) ?? []),
		Effect.map((ids) => ids.filter((id) => id !== undefined && id !== null)),
	);

export const getAllThreadIds = (labelId: string) =>
	Effect.gen(function* () {
		const gmail: gmail_v1.Gmail = yield* GmailClient;
		let pageToken: string | undefined = "";
		const ids: string[] = [];
		while (pageToken !== undefined) {
			const emails_list = yield* Effect.tryPromise(() =>
				gmail.users.messages
					.list({
						userId: "me",
						labelIds: [labelId],
						pageToken: pageToken ?? "",
					})
					.then((a) => a.data),
			);
			if (emails_list.messages) {
				ids.push(
					...emails_list.messages
						.map((m) => m.threadId)
						.filter((m) => m !== null && m !== undefined),
				);
			}
			pageToken = emails_list.nextPageToken || undefined;
			// Add a small delay to avoid rate limiting
			yield* Effect.sleep(100);
		}
		const uniqueIds = Array.from(new Set(ids));
		console.log("found ids: ", uniqueIds.length);
		return uniqueIds;
	});

export const filterEmails = (threadIds: string[]) =>
	pipe(
		threadIds.length > 0
			? db_retry_effect({ name: "getGmails" }, () =>
					db
						.selectFrom("GmailAccountEmails")
						.select("threadId")
						.where("threadId", "in", threadIds)
						.execute(),
				)
			: Effect.succeed([]),
		Effect.map((rows) => rows.map((row) => row.threadId)),
		Effect.map((existing) => threadIds.filter((id) => !existing.includes(id))),
	);
