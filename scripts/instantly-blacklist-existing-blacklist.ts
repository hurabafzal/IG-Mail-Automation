import { db } from "backend/src/db";
import { env } from "backend/src/env";
import { Effect, Schedule } from "effect";

const blackListedEmails = await db
	.selectFrom("Email")
	.where("code", "=", 7)
	.where("reason", "=", "blacklist")
	.selectAll()
	.execute();

const emails = blackListedEmails.map((email) => email.email);

function isValidEmail(email: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const validEmails = emails.filter((email) => isValidEmail(email));

//

console.log(emails.length);
console.log(validEmails.length);
console.log(validEmails);

await Effect.forEach(validEmails, (email, i) =>
	Effect.tryPromise(() =>
		fetch("https://api.instantly.ai/api/v2/block-lists-entries", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.INSTANTLY_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ bl_value: email }),
		})
			.then((x) => x.json())
			.then((x) =>
				console.log(
					`[${i}] blacklisted ${email}: ${JSON.stringify(x, null, 2)}`,
				),
			),
	).pipe(
		Effect.retry({
			times: 3,
			schedule: Schedule.exponential("1 minute"),
		}),
		Effect.tap(Effect.sleep("0.1 second")),
	),
).pipe(Effect.runPromise);
