import { sendSlackMessage } from "backend/src/utils/slack";
import type { Obj } from "backend/src/utils/types";
import { Effect, pipe } from "effect";
import {
	GmailClient,
	GoogleAuthClient,
	GoogleAuthTokenStore,
} from "./services";

// 0. getting the auth url
export const getAuthURL = GoogleAuthClient.pipe(
	Effect.map((client) =>
		client.generateAuthUrl({
			access_type: "offline",
			prompt: "consent", // <-- add this line
			scope: [
				"https://www.googleapis.com/auth/gmail.readonly",
				"https://www.googleapis.com/auth/gmail.settings.basic",
			],
			include_granted_scopes: true,
		}),
	),
	Effect.provide(GoogleAuthClient.Live),
);

// 1. parsing the code from the query
const getCode = (req: Obj) => {
	if (!req.code) return Effect.die("No code found in query");
	return Effect.succeed(req.code as string);
};

class NoRefreshTokenReturnedError {
	readonly _tag = "NoRefreshTokenReturnedError";
}

// 2. an effect for getting the token from the code
const getToken = (req: Obj) =>
	GoogleAuthClient.pipe(
		Effect.flatMap((client) =>
			pipe(
				getCode(req),
				Effect.flatMap((code) =>
					Effect.tryPromise(() => client.getToken(code)),
				),
				Effect.map((res) => res.tokens),
				// Effect.tap((tokens) => Console.log(tokens)),
				Effect.flatMap((tokens) =>
					tokens.refresh_token
						? Effect.succeed(tokens.refresh_token)
						: Effect.fail(new NoRefreshTokenReturnedError()),
				),
			),
		),
		Effect.provide(GoogleAuthClient.Live),
	);

export const gmailAuthCallback = (req: Obj) =>
	getToken(req).pipe(
		Effect.flatMap((refreshToken) =>
			pipe(
				Effect.all({
					store: GoogleAuthTokenStore,
					email: getEmail,
				}),
				Effect.flatMap(({ store, email }) => store.set(email, refreshToken)),
				Effect.provide(GmailClient.Live(refreshToken)),
				Effect.provide(GoogleAuthClient.Live),
				Effect.provide(GoogleAuthTokenStore.Live),
			),
		),
		Effect.map(() => "Authenticated"),
	);

class EmailNotFoundError {
	readonly _tag = "EmailNotFoundError";
}

const getEmail = GmailClient.pipe(
	Effect.flatMap((gmail) =>
		pipe(
			Effect.tryPromise({
				try: () => gmail.users.getProfile({ userId: "me" }),
				catch: (e) => {
					void sendSlackMessage("Error in getEmail");
					console.error(e);
					return new EmailNotFoundError();
				},
			}),
			Effect.flatMap((res) =>
				res.data.emailAddress
					? Effect.succeed(res.data.emailAddress)
					: Effect.fail(new EmailNotFoundError()),
			),
		),
	),
);
