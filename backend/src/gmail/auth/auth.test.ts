import { expect, test } from "bun:test";
import { Console, Effect, pipe } from "effect";
import { GmailClient, GoogleAuthClient } from "./services";

test("invalid login error", async () => {
	let invalidLoginTriggered = false;
	const t = pipe(
		GmailClient,
		Effect.andThen((gmail) => gmail.users.getProfile({ userId: "me" })),
		Effect.tap((r) => Console.log(r.data)),
		Effect.provide(GmailClient.Live("asdadsasdas")),
		Effect.provide(GoogleAuthClient.Live),
		Effect.catchTag("InvalidLoginError", () => {
			console.log("invalid login!");
			invalidLoginTriggered = true;
			return Effect.void;
		}),
	);

	const exit = await Effect.runPromiseExit(t);
	console.log(exit);

	expect(exit._tag).toBe("Success");
	expect(invalidLoginTriggered).toBe(true);
});
