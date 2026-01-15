import { expect, test } from "bun:test";
import { Console, Effect, pipe } from "effect";
import {
	GmailClient,
	GoogleAuthClient,
	GoogleAuthTokenStore,
} from "../auth/services";
import { NoNewEmailsError, aggregatorEmail, getEmailContent } from "./cron";
import { findLabel, getEmailIds } from "./findEmails";
import { getCandidatesFromMsgs } from "./getCandidate";
import type { Message } from "./getMessage";

const mainFlow = (email: string) =>
	pipe(
		// get pipedrive label id
		findLabel("Pipedrive"),
		Effect.tap(() => Console.log(`Main Flow for: ${email}`)),
		Effect.tap((labelId) => Console.log(`Label id: ${labelId}`)),

		// get email ids with pipedrive label
		Effect.flatMap((labelId) => getEmailIds(labelId)),
		Effect.tap((ids) => Console.log(`Email ids: ${ids}`)),

		// filter for emails not in the database
		// Effect.flatMap(filterEmails),
		// Effect.tap((ids) => Console.log(`New email ids: ${ids}`)),

		// get email content
		Effect.flatMap((ids) => getEmailContent(ids)),

		Effect.flatMap((messages) =>
			messages.length < 1
				? Effect.fail(new NoNewEmailsError())
				: Effect.succeed(messages),
		),

		Effect.tap((messages) =>
			pipe(
				getCandidatesFromMsgs(messages, 21367363, 21367363), // user_id and owner_id for joleen@startviral.de
				Effect.tap((candidates) => Console.log(candidates)),
				// Effect.flatMap((candidates) =>
				// 	Effect.all(candidates.map((c) => CandidatePipedrive.add(c))),
				// ),
			),
		),

		// mark as read
		// Effect.tap((m) => saveMessages(m, email)),
	);
test("list pipeline emails", async () => {
	const program = pipe(
		GoogleAuthTokenStore,
		Effect.flatMap((store) => store.get(aggregatorEmail)),
		Effect.flatMap((token) =>
			pipe(
				mainFlow(aggregatorEmail),
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
				}),
				Effect.provide(GmailClient.Live(token)),
				Effect.provide(GoogleAuthClient.Live),
			),
		),
		Effect.provide(GoogleAuthTokenStore.Live),
		// Effect.flatMap((p) => Effect.all(p)),
	);
	const res = await Effect.runPromise(program);
	// console.log(
	// 	"---------- Forwarded message ---------\r\nVon: Niklas Böhm <niklas@startviral.co>\r\nDate: Fr., 7. Juni 2024 um 16:14 Uhr\r\nSubject: Re: Kooperationsanfragen für @kathy_fitmom\r\nTo: Kathy.ta <kathy@koerperliebe.net>",
	// );
	console.log(res);
	expect(res).toBeArray();
});
