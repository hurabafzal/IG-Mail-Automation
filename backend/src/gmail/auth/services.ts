import { db, db_retry_effect } from "backend/src/db";
import { Context, Effect, Layer, pipe } from "effect";
import { tryPromise } from "effect/Effect";
import { OAuth2Client } from "google-auth-library";
import { type gmail_v1, google } from "googleapis";
import { env } from "../../env";

export class GoogleAuthClient extends Context.Tag("google/authClient")<
	GoogleAuthClient,
	OAuth2Client
>() {
	static Live = Layer.effect(
		GoogleAuthClient,
		Effect.sync(
			() =>
				new OAuth2Client(
					env.GMAIL_CLIENT_ID,
					env.GMAIL_CLIENT_SECRET,
					env.GMAIL_CALLBACK_URL,
				),
		),
	);
}

class InvalidLoginError {
	readonly _tag = "InvalidLoginError";
}

export class GmailClient extends Context.Tag("google/gmailClient")<
	GmailClient,
	gmail_v1.Gmail
>() {
	static Live = (refresh_token: string) =>
		Layer.effect(
			GmailClient,
			Effect.andThen(GoogleAuthClient, (client) =>
				tryPromise({
					try: async () => {
						client.setCredentials({ refresh_token });
						const gmail = google.gmail({ version: "v1", auth: client });
						const me = await gmail.users.getProfile({ userId: "me" });
						console.log(`[gmail] auth success: ${me.data.emailAddress}`);

						return gmail;
					},
					catch: () => new InvalidLoginError(),
				}),
			),
		);
}

class NoTokenFoundError {
	readonly _tag = "NoTokenFoundError";
}

export class GoogleAuthTokenStore extends Context.Tag("google/authTokenStore")<
	GoogleAuthTokenStore,
	{
		readonly get: (email: string) => Effect.Effect<string, NoTokenFoundError>;
		readonly getAll: () => Effect.Effect<
			readonly { email: string; refreshToken: string }[]
		>;
		readonly set: (email: string, token: string) => Effect.Effect<unknown>;
	}
>() {
	static Live = Layer.succeed(GoogleAuthTokenStore, {
		get: (email) =>
			pipe(
				tryPromise({
					try: () =>
						db
							.selectFrom("GmailAccount")
							.select("refreshToken")
							.where("email", "=", email)
							.executeTakeFirstOrThrow(),
					catch: () => new NoTokenFoundError(),
				}),
				Effect.map((row) => row.refreshToken),
			),
		getAll: () =>
			db_retry_effect({ name: "GoogleAuthTokenStoreLive.getAll" }, () =>
				db
					.selectFrom("GmailAccount")
					.select(["email", "refreshToken"])
					.execute(),
			),
		set: (email, token) =>
			db_retry_effect({ name: "GoogleAuthTokenStoreLive.set" }, () =>
				db
					.insertInto("GmailAccount")
					.values({ email, refreshToken: token })
					.onConflict((oc) =>
						oc
							.column("email")
							.doUpdateSet({ refreshToken: token, updatedAt: new Date() }),
					)
					.execute(),
			),
	});
}
