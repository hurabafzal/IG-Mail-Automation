import { shuffleList } from "backend/src/utils/shuffleList";
import { Console, Effect, Either, pipe } from "effect";
import { BrowserLayer } from "../browser/browserLayer";
import { RequestDuplicators } from "../browser/requestDuplicator";
import { web_profile_schema, type web_profile_type } from "./schema";

class LoginNeededError {
	readonly _tag = "LoginNeededError";
}

class MissingPageError {
	readonly _tag = "MissingPageError";
}

class JsonParseError {
	constructor(readonly response: string) {
		this.response = response;
	}
	readonly _tag = "JsonParseError";
}

export type Profile = {
	data: web_profile_type["data"]["user"];
	username: string;
};

type Duplicator = Effect.Effect.Success<
	typeof RequestDuplicators.InstagramWebProfile
>;

const processAccount = (
	username: string,
	{ duplicate }: Duplicator,
	c: number,
) =>
	pipe(
		// duplicate the request
		duplicate(() => ({
			url: `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
		})),

		Effect.timeout(60_000),

		// handle known errors:
		Effect.andThen((x) =>
			x.includes("<title>Login • Instagram</title>") ||
			x.includes("Please wait a few minutes before you try again.")
				? Effect.fail(new LoginNeededError())
				: Effect.succeed(x),
		),
		Effect.andThen((x) =>
			x.includes("<h2>Sorry, this page isn&#39;t available.</h2>")
				? Effect.fail(new MissingPageError())
				: Effect.succeed(x),
		),

		Effect.andThen((x) =>
			Effect.try({
				try: () => web_profile_schema.safeParse(JSON.parse(x)),
				catch: () => new JsonParseError(x),
			}),
		),
		Effect.andThen((r) =>
			!r || !r.success || !r.data.data.user
				? Either.left(new MissingPageError())
				: Either.right({
						success: true,
						data: r.data.data.user,
						username,
					} as const),
		),
		Effect.tap(() => console.log(`[${c}] done mining ${username}`)),

		// TODO: just ignore missing pages for now
		// in the future, I should search their ids OR delete them from the initial accounts table
		Effect.catchTags({
			MissingPageError: () =>
				Console.error(`[${c}] page missing for ${username}`).pipe(
					Effect.as({
						success: false,
						error: "missing" as const,
						username,
					} as const),
				),
			TimeoutException: () =>
				Console.error(`[${c}] timeout for ${username}`).pipe(
					Effect.as({
						success: false,
						error: "timeout" as const,
						username,
					} as const),
				),
			JsonParseError: (e) =>
				Console.error(
					`${e.response}\n[${c}] json parse error for ${username}`,
				).pipe(
					Effect.as({
						success: false,
						error: "json_parse_error" as const,
						username,
					} as const),
				),
			// UnknownException: (e) =>
			// 	sendSlackMessageE(`[web profiles] unknown error: ${e.message}`).pipe(
			// 		Effect.as({
			// 			success: false,
			// 			error: "unknown" as const,
			// 			username,
			// 		} as const),
			// 	),
		}),
	);

const requestProcessor = (usernames: string[]) => {
	const out: Effect.Effect.Success<ReturnType<typeof processAccount>>[] = [];
	let c = 0;
	return pipe(
		RequestDuplicators.InstagramWebProfile,
		Effect.andThen((d) =>
			Effect.all(
				usernames.map((username) =>
					processAccount(username, d, c++).pipe(Effect.tap((x) => out.push(x))),
				),
				{ concurrency: 5 },
			),
		),
		Effect.as(out),
		Effect.catchAll((e) => {
			console.error(e);
			return Effect.succeed(out);
		}),
	);
};

export function getAccountIdsWithHiddenLikes(
	web_profiles: Effect.Effect.Success<
		ReturnType<typeof browser_mine_web_profiles>
	>,
) {
	// followers must be between 10k and 100k
	let hidden_count = 0;
	const ids = [];
	// count the number of web_profiles that are not null and have at least one post with hidden likes
	for (const profile of web_profiles) {
		if (!profile.success) {
			continue;
		}
		const web_profile = profile.data;

		// followers must be between 10k and 100k
		const media = web_profile.edge_owner_to_timeline_media.edges.map(
			(e) => e.node,
		);

		// deduplicate media items with the same post id
		for (const item of media) {
			if (item.edge_media_preview_like.count === -1) {
				ids.push(web_profile.id);
				hidden_count++;
				break;
			}
		}
	}

	return ids;
}

export const browser_mine_web_profiles = (usernames: string[]) =>
	pipe(
		// requestProcessor(shuffleList(usernames)),
		requestProcessor(usernames),
		Effect.provide(BrowserLayer.ProxyLive),
		Effect.scoped,
	);
