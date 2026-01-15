import { db, db_retry_effect } from "backend/src/db";
import { env } from "backend/src/env";
import { sendSlackMessage, sendSlackMessageE } from "backend/src/utils/slack";
import { Console, Effect, Schedule, pipe } from "effect";

function blackListUsersFromEmail(initial_emails: string[]) {
	return pipe(
		db_retry_effect({ name: "SelectBlacklistIds" }, () =>
			db
				.selectFrom("Email")
				.innerJoin(
					"InstagramAccountBase",
					"Email.instagram_id",
					"InstagramAccountBase.id",
				)
				.select(["instagram_id", "InstagramAccountBase.blacklist"])
				.where("email", "in", initial_emails)
				// this is the id for THE "instagram" account
				// I used this id as a placeholder for emails that don't belong to an instagram account
				// in the database
				.where("instagram_id", "!=", "25025320")
				.execute(),
		),

		// print the ids that are not already blacklisted
		Effect.tap((ids) => {
			const ids_not_blacklisted = ids.filter((x) => !x.blacklist);
			return ids_not_blacklisted.length > 0
				? Console.log(
						`[${
							ids_not_blacklisted.length
						}] ids that are not blacklisted: ${ids_not_blacklisted
							.map((x) => x.instagram_id)
							.join(", ")}`,
					)
				: Console.log("no ids that are not blacklisted");
		}),

		Effect.tap((ids) =>
			ids.length > 0
				? db_retry_effect({ name: "UsernameBlackList" }, () =>
						db
							.updateTable("InstagramAccountBase")
							.set({
								blacklist: true,
							})
							.where(
								"id",
								"in",
								ids.map((x) => x.instagram_id),
							)
							.execute(),
					)
				: null,
		),

		Effect.andThen((ids) =>
			ids.length > 0
				? db_retry_effect({ name: "SelectBlackListEmails" }, () =>
						db
							.selectFrom("Email")
							.select(["instagram_id", "email"])
							.where(
								"instagram_id",
								"in",
								ids.map((x) => x.instagram_id),
							)
							.execute(),
					)
				: Effect.succeed([]),
		),

		Effect.map((xs) =>
			Array.from(
				new Set([
					//
					...initial_emails,
					...xs.map((x) => x.email),
				]),
			),
		),
	);
}

export function blacklistEmails(initial_emails: string[]) {
	if (initial_emails.length < 1) return Effect.void;

	return pipe(
		blackListUsersFromEmail(initial_emails),
		Effect.tap((es) =>
			Console.log(`got ${es.length} emails from ${initial_emails.length}`),
		),
		Effect.andThen((emails) =>
			pipe(
				// set the emails as blacklisted in the database
				db_retry_effect({ name: "BlackListEmails" }, () =>
					db
						.updateTable("Email")
						.set({
							code: 7,
							reason: "blacklist",
							blacklisted_at: new Date(),
						})
						.where("email", "in", emails)
						.where("blacklisted_at", "is", null)
						.execute(),
				),
				Effect.tap((x) => Console.log("blacklisted emails", x)),

				////////////////////////////
				// cancel mixmax sequences
				////////////////////////////
				// Effect.andThen(() =>
				// 	Effect.tryPromise(async () => {
				// 		const response = await fetch(
				// 			"https://api.mixmax.com/v1/sequences/cancel",
				// 			{
				// 				method: "POST",
				// 				headers: {
				// 					"X-API-Token": env.MIXMAX_KEY,
				// 					"Content-Type": "application/json",
				// 				},
				// 				body: JSON.stringify({
				// 					emails: emails,
				// 				}),
				// 			},
				// 		);
				// 		const json = (await response.json()) as { recipients?: unknown };
				// 		if (!json?.recipients) {
				// 			console.error("error deleting emails from sequence: ", json);
				// 			sendSlackMessage(
				// 				`error deleting emails from sequence: ${JSON.stringify(json)}`,
				// 			);
				// 			await Bun.sleep(1000);
				// 			throw new Error(`no recipients!! ${JSON.stringify(json)}`);
				// 		}

				// 		console.log(
				// 			`deleted ${emails.length} emails from sequence: ${JSON.stringify(
				// 				json,
				// 			)}`,
				// 		);
				// 	}),
				// ),
				////////////////////////////
				// add to instantly blacklist
				////////////////////////////
				// Effect.andThen(() =>
				// 	Effect.forEach(emails, (email, i) =>
				// 		Effect.tryPromise(() =>
				// 			fetch("https://api.instantly.ai/api/v2/block-lists-entries", {
				// 				method: "POST",
				// 				headers: {
				// 					Authorization: `Bearer ${env.INSTANTLY_KEY}`,
				// 					"Content-Type": "application/json",
				// 				},
				// 				body: JSON.stringify({ bl_value: email }),
				// 			}).then((x) => x.json()),
				// 		).pipe(
				// 			Effect.tap((x) =>
				// 				Console.log(
				// 					`[${i}] blacklisted ${email}: ${JSON.stringify(x, null, 2)}`,
				// 				),
				// 			),
				// 			Effect.tap(Effect.sleep("1 second")),
				// 			Effect.retry({
				// 				times: 3,
				// 				schedule: Schedule.exponential("1 minute"),
				// 			}),
				// 		),
				// 	),
				// ),
				// Effect.tapError((x) =>
				// 	sendSlackMessageE(`error with blacklist: ${JSON.stringify(x)}`),
				// ),

				Effect.retry({
					times: 10,
					schedule: Schedule.exponential("1 second"),
				}),
			),
		),
	);
}
