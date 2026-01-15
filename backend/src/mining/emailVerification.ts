import { checkSingle } from "@reacherhq/api";
import { Console, Effect, Schedule, pipe } from "effect";
import { z } from "zod";
import { db } from "../db";
import { EmailServerHost } from "../db/db_types";
import { sendSlackMessage } from "../utils/slack";

export function getServerHostType(mx: string[]) {
	if (mx.length > 0) {
		const record = mx[0].toLowerCase();
		if (record.includes("google")) {
			return EmailServerHost.GOOGLE;
		}
		if (record.includes("rzone")) {
			return EmailServerHost.RZONE;
		}
		if (record.includes("mail.de")) {
			return EmailServerHost.MAIL_DE;
		}
		if (record.includes("ionos.de")) {
			return EmailServerHost.IONOS_DE;
		}
		if (record.includes("agenturserver.de")) {
			return EmailServerHost.AGENTURSERVER_DE;
		}
		if (record.includes("yahoo")) {
			return EmailServerHost.YAHOO;
		}
		return EmailServerHost.OTHER;
	}
	return EmailServerHost.OTHER;
}

async function verify_email() {
	console.log("[email verification] checking for new emails...");
	const new_emails = (await db
		.selectFrom("InstagramAccountBase")
		.leftJoin("Email", "InstagramAccountBase.ig_email", "Email.email")
		.where("Email.email", "is", null)
		.where("InstagramAccountBase.ig_email", "is not", null)
		.select([
			"InstagramAccountBase.ig_email as email",
			"InstagramAccountBase.id as user_id",
		])
		.execute()) as { email: string; user_id: string }[];

	console.log(`[email verification] found ${new_emails.length} new emails`);

	if (new_emails.length > 0) {
		const emailsThatNeedFixing = new_emails.filter((e) =>
			e.email.startsWith("#"),
		);

		// remove the slash and update InstagramAccountBase
		for (const email of emailsThatNeedFixing) {
			console.log(`[email verification] fixing ${email.email}...`);
			const newEmail = email.email.slice(1);
			await db
				.updateTable("InstagramAccountBase")
				.set({ ig_email: newEmail })
				.where("id", "=", email.user_id)
				.execute();
		}
		console.log(
			`[email verification] fixed ${emailsThatNeedFixing.length} emails`,
		);
		if (emailsThatNeedFixing.length > 0) return;

		console.log(
			`[email verification] inserting ${new_emails.length} emails...`,
		);
		await db
			.insertInto("Email")
			.values(
				new_emails.map((e) => ({ email: e.email, instagram_id: e.user_id })),
			)
			.onConflict((eb) => eb.doNothing())
			.execute();
	}

	console.log("[email verification] starting...");

	await Bun.sleep(1000);

	const emailQ = await db
		.selectFrom("Email")
		.select(["email"])
		.where("code", "is", null)
		.where("email", "like", "%@%")
		.where("email", "not like", "% %")
		.where("email", "not like", "#%")
		.where("email", "not like", "&@%")
		.limit(1000)
		.execute();

	if (!emailQ?.length) return;

	console.log(`[email verification] found ${emailQ.length} emails to verify`);

	const queries = Effect.all(
		emailQ.map(({ email }, index) =>
			Effect.tryPromise(async () => {
				try {
					const result = await checkSingle(
						{ to_email: email },
						{
							// Required.
							apiToken: "",
							backendUrl: "http://128.140.57.252:8080/v0/check_email",
						},
					);
					let code: number;

					// check for errors
					if ("message" in result.smtp) {
						return await sendSlackMessage(
							`[email verification] ${email} is invalid: ${result.smtp.message}`,
						);
					}
					if ("message" in result.misc) {
						return await sendSlackMessage(
							`[email verification] ${email} is invalid: ${result.misc.message}`,
						);
					}
					if ("message" in result.mx) {
						return await sendSlackMessage(
							`[email verification] ${email} is invalid: ${result.mx.message}`,
						);
					}

					switch (result.is_reachable) {
						case "risky":
							if (result.smtp.is_deliverable) {
								code = 5; // valid
							} else {
								code = 7; // risky
							}
							break;
						case "safe":
							code = 5; // valid
							break;
						case "invalid":
							code = 6; // bounce
							break;
						case "unknown":
							code = 7; // unknown
							break;
					}

					console.log(
						`[emails ${index}/${emailQ.length} - ${(
							(index / emailQ.length) * 100
						).toFixed(2)}%] (${email}): ${result.is_reachable}. Deliverable: ${
							result.smtp.is_deliverable ?? "unknown"
						}`,
					);

					await db
						.updateTable("Email")
						.set({
							code,
							reason: result.is_reachable,
							role: result.misc.is_role_account,
							free_email: result.misc.is_disposable,
							send_transactional: result.smtp.is_deliverable ? 1 : 0,
							used_reacher: true,
							server_host_type: getServerHostType(result.mx.records),
							server_host_name: JSON.stringify(result.mx.records),
						})
						.where("email", "=", email)
						.execute();
				} catch (error) {
					console.error(error);
				}
			}),
		),
		{ concurrency: 3 },
	);

	await Effect.runPromiseExit(queries);
}

export const markBadEmailCron = pipe(
	Effect.tryPromise(() =>
		db
			.updateTable("Email")
			.set({
				code: 7,
				reason: "bad format",
			})
			.where("code", "is", null)
			.where((oc) =>
				oc.or([
					// bad email if:
					oc("email", "not like", "%@%"), // doesn't have @ or
					oc("email", "like", "% %"), // has a space or
					oc("email", "like", "#%"), // has a #
					oc("email", "like", "&@%"), // has a &@
				]),
			)
			.execute(),
	),
	Effect.catchAll((e) => Console.error(e)),
	Effect.schedule(Schedule.cron("*/30 * * * *")),
);

export const emailVerificationLoop = pipe(
	Effect.tryPromise(verify_email),
	Effect.catchAll((e) => Console.error(e)),
	Effect.repeat(Schedule.spaced("1 minute")),
);
