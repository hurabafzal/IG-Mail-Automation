import { BunRuntime } from "@effect/platform-bun";
import { db, db_retry_effect } from "backend/src/db";
import { Console, Effect } from "effect";
import { pipe } from "effect";
import {
	GmailClient,
	GoogleAuthClient,
	GoogleAuthTokenStore,
} from "../auth/services";

const listSupportFilters = Effect.flatMap(GmailClient, (gmail) =>
	pipe(
		Effect.tryPromise(() =>
			gmail.users.settings.filters.list({
				userId: "me",
			}),
		),
		Effect.tap((filters) =>
			Console.log(`all filters: ${filters.data.filter?.length}`),
		),
		Effect.map((res) => {
			const filters = res.data.filter || [];
			return filters.filter(
				(filter) => filter.action?.forward === "support@startviral.de",
			);
		}),
		// 	Effect.tap((filters) => Console.log(`got ${filters.length} to delete`)),
		// 	Effect.tap(Effect.sleep(5000)),
		// 	Effect.tap((filters) =>
		// 		Effect.all(
		// 			filters.map((f, i) =>
		// 				pipe(
		// 					Effect.tryPromise(async () =>
		// 						f.id
		// 							? gmail.users.settings.filters.delete({
		// 									userId: "me",
		// 									id: f.id,
		// 								})
		// 							: null,
		// 					),
		// 					Effect.tap(Console.log(`[${i}] deleted filter ${f.id}`)),
		// 				),
		// 			),
		// 			{ concurrency: 2 },
		// 		),
		// 	),
	),
);

function saveExistingFilters(me: string) {
	return pipe(
		listSupportFilters,

		Effect.map((supportFilters) =>
			supportFilters.map((filter) => ({
				fromEmails: (filter.criteria?.from || "")
					.split(" OR ")
					.flatMap((email) => email.split(","))
					.map((email) => email.trim()),
				filter: filter,
			})),
		),

		Effect.andThen((filters) =>
			Effect.all(
				filters.map(({ filter, fromEmails }, i) =>
					db_retry_effect({ name: "saveGmailForwardingRules" }, () =>
						db
							.insertInto("GmailForwardingRules")
							.values(
								fromEmails.map((fromEmail) => ({
									sentFrom: fromEmail,
									sentTo: me,
									targetInbox: filter.action?.forward || "",
									filterID: filter.id || "",
								})),
							)
							.onConflict((oc) => oc.doNothing())
							.execute()
							.then(() =>
								console.log(
									`[${i}/${filters.length}}] done saving ${fromEmails.length} emails`,
								),
							),
					),
				),
				{ concurrency: 10 },
			),
		),
	);
}

const program = pipe(
	GoogleAuthTokenStore,
	Effect.flatMap((store) => store.getAll()),
	Effect.flatMap((accounts) =>
		Effect.forEach(
			accounts.filter(
				(account) =>
					account.email === "marc@startviral.de" ||
					account.email === "joleen@startviral.de",
			),
			(account) =>
				pipe(
					Console.log(`Saving filters for ${account.email}`),
					Effect.andThen(() => saveExistingFilters(account.email)),
					Effect.provide(GmailClient.Live(account.refreshToken)),
				),
		),
	),
	Effect.provide(GoogleAuthClient.Live),
	Effect.provide(GoogleAuthTokenStore.Live),
);

BunRuntime.runMain(program);
