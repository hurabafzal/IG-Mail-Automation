import { db, db_retry_effect } from "backend/src/db";
import { chunkArray } from "backend/src/utils/chunkArray";
import { sendSlackMessageE } from "backend/src/utils/slack";
import { Console, Effect } from "effect";
import { pipe } from "effect";
import { UnknownException } from "effect/Cause";
import { sql } from "kysely";
import { GmailClient } from "../auth/services";

class RequestedEntityNotFoundError {
	readonly _tag = "RequestedEntityNotFound";
}

class RateLimitError {
	readonly _tag = "RateLimitError";
}

export const listFilters = Effect.flatMap(GmailClient, (gmail) =>
	Effect.tryPromise(() =>
		gmail.users.settings.filters.list({
			userId: "me",
		}),
	),
);

export const createFilter = ({
	me,
	newEmails,
}: { newEmails: string[]; me: string }) =>
	pipe(
		GmailClient,
		Effect.tap(
			Console.log(`[${me}] adding ${newEmails.length} emails to a new filter`),
		),
		Effect.flatMap((gmail) =>
			pipe(
				// create the filter:
				// timestamp=2024-09-20T10:49:27.916Z level=ERROR fiber=#0 cause="UnknownException: User-rate limit exceeded.  Retry after 2024-09-20T11:04:28.004Z (Forwarding rules)
				Effect.tryPromise({
					try: () =>
						gmail.users.settings.filters.create({
							userId: "me",
							requestBody: {
								criteria: { from: newEmails.join(" OR ") },
								action: {
									removeLabelIds: ["UNREAD", "SPAM"],
									addLabelIds: ["TRASH"],
									forward: "support@startviral.de",
								},
							},
						}),
					catch: (e) =>
						e instanceof Error &&
						e.message.includes("User-rate limit exceeded.")
							? new RateLimitError()
							: new UnknownException(e),
				}),

				// save filter to database
				Effect.tap((createdFilter) =>
					db_retry_effect({ name: "saveGmailForwardingRules" }, () =>
						db
							.insertInto("GmailForwardingRules")
							.values(
								newEmails.map((newEmail) => ({
									sentFrom: newEmail,
									sentTo: me,
									targetInbox: createdFilter.data.action?.forward || "",
									filterID: createdFilter.data.id || "",
								})),
							)
							.onConflict((oc) => oc.doNothing())
							.execute(),
					),
				),
			),
		),
	);

export const replaceFilter = ({
	filterId,
	me,
	newEmails,
}: { filterId: string; newEmails: string[]; me: string }) =>
	pipe(
		GmailClient,
		Effect.tap(
			Console.log(`[${me}] adding ${newEmails.length} emails to ${filterId}`),
		),
		Effect.flatMap((gmail) =>
			pipe(
				// gets filter using the id
				Effect.tryPromise(() =>
					gmail.users.settings.filters.get({
						userId: "me",
						id: filterId,
					}),
				),

				// updates the filter data
				Effect.map((existingFilter) => {
					const updatedFromCriteria = `${
						existingFilter.data.criteria?.from || ""
					} OR ${newEmails.join(" OR ")}`;
					return {
						...existingFilter.data,
						criteria: {
							...existingFilter.data.criteria,
							from: updatedFromCriteria,
						},
					};
				}),

				// creates a new filter with the updated data
				Effect.flatMap((newFilter) =>
					Effect.tryPromise(() =>
						gmail.users.settings.filters.create({
							userId: "me",
							requestBody: newFilter,
						}),
					),
				),

				// save rule to database
				Effect.tap((createdFilter) =>
					db_retry_effect({ name: "saveGmailForwardingRules" }, () =>
						db
							.insertInto("GmailForwardingRules")
							.values(
								newEmails.map((newEmail) => ({
									sentFrom: newEmail,
									sentTo: me,
									targetInbox: createdFilter.data.action?.forward || "",
									filterID: createdFilter.data.id || "",
								})),
							)
							.onConflict((oc) => oc.doNothing())
							.execute(),
					),
				),

				// update the filter id of existing entries
				Effect.tap((createdFilter) =>
					db
						.updateTable("GmailForwardingRules")
						.set({
							filterID: createdFilter.data.id ?? undefined,
						})
						.where("filterID", "=", filterId)
						.execute(),
				),

				// deletes old filter:
				// timestamp=2024-09-20T10:48:35.617Z level=ERROR fiber=#0 cause="UnknownException: Requested entity was not found.
				Effect.tap(() =>
					Effect.tryPromise({
						try: () =>
							gmail.users.settings.filters.delete({
								userId: "me",
								id: filterId,
							}),
						catch: (e) =>
							e instanceof Error &&
							e.message.includes("Requested entity was not found")
								? new RequestedEntityNotFoundError()
								: new UnknownException(e),
					}),
				),
			),
		),
	);

const filtersWithSpace = (targetEmail: string) =>
	Effect.promise(() =>
		db
			.selectFrom("GmailForwardingRules")
			.select([
				"filterID",
				sql<number>`COUNT("GmailForwardingRules"."sentFrom")`.as("count"),
			])
			.where("sentTo", "=", targetEmail)
			.groupBy(["filterID"])
			.having(sql`COUNT("GmailForwardingRules"."sentFrom")`, "<", 30)
			.execute(),
	);

export const bulkAddFilters = (emails: string[], targetEmail: string) =>
	pipe(
		filtersWithSpace(targetEmail),
		Effect.flatMap((existingFilters) =>
			pipe(
				Effect.iterate(
					{ remainingEmails: emails, updatedFilters: existingFilters },
					{
						while: ({ updatedFilters, remainingEmails }) =>
							updatedFilters.length > 0 && remainingEmails.length > 0,
						body: ({ remainingEmails, updatedFilters }) => {
							const newFilters = [...updatedFilters];
							const f = newFilters.pop();
							if (!f) throw Error("WTF");
							const availableSpace = 30 - f.count;
							const emailsToAdd = remainingEmails.slice(0, availableSpace);
							const newRemainingEmails = remainingEmails.slice(availableSpace);
							console.log(
								`[${updatedFilters.length}] there is ${availableSpace} available space and ${remainingEmails.length} remaining emails`,
							);
							return pipe(
								replaceFilter({
									filterId: f.filterID,
									me: targetEmail,
									newEmails: emailsToAdd,
								}),
								Effect.map(() => ({
									remainingEmails: newRemainingEmails,
									updatedFilters: newFilters,
								})),
							);
						},
					},
				),
				Effect.tap(({ remainingEmails }) =>
					Console.log(
						`Done filling existing: ${remainingEmails.length} emails left`,
					),
				),
				Effect.flatMap(({ remainingEmails }) =>
					remainingEmails.length > 0
						? pipe(
								Effect.all(
									chunkArray(remainingEmails, 30).map((chunk) =>
										createFilter({
											me: targetEmail,
											newEmails: chunk,
										}),
									),
								),
								Effect.as(null),
							)
						: Effect.void,
				),
			),
		),

		Effect.tapErrorTag("UnknownException", (e) =>
			sendSlackMessageE(`[filters] unknown error: ${e}`),
		),
	);
