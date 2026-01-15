import { Schema as S } from "@effect/schema";
import { infinite_loop_effect } from "backend/src/utils/infinite_loop_effect";
import { Console, Effect, Either, Schedule, pipe } from "effect";
import { InstagramDB } from "../InstagramDB";
import { BrowserLayer } from "../browser/browserLayer";
import { RequestDuplicators } from "../browser/requestDuplicator";

// https://github.com/MohanSha/InstagramResearch

const UsernameSchema = S.Struct({
	data: S.Struct({
		user: S.Struct({
			reel: S.Struct({
				user: S.Struct({
					username: S.String,
				}),
			}),
		}),
	}),
});
const BlockedSchema = S.Struct({
	message: S.String,
	require_login: S.Boolean,
	status: S.String,
});

class RateLimitError {
	readonly _tag = "RateLimitError";
}

// TODO: test what would happen if we input an id that does not belong to an account
const program = () =>
	pipe(
		Effect.all({
			req: RequestDuplicators.InstagramGraphQuery,
			// TODO: get ids from db
			ids: Effect.succeed([""]),
		}),
		Effect.tap(Console.log("getting usernames!")),
		Effect.andThen(({ req: { duplicate }, ids }) =>
			Effect.all(
				ids.map((id, i) =>
					pipe(
						Effect.sync(() => {
							const params = new URLSearchParams();
							params.append("query_hash", "ad99dd9d3646cc3c0dda65debcd266a7");
							params.append(
								"variables",
								JSON.stringify({ user_id: id, include_reel: true }),
							);
							return `https://www.instagram.com/graphql/query/?${params.toString()}`;
						}),
						Effect.flatMap((url) => duplicate(() => ({ url }))),
						Effect.tap(() => Console.log("got res!")),
						Effect.map((x) => JSON.parse(x) as unknown),
						Effect.retry({
							times: 3,
						}),

						Effect.andThen(
							S.decodeUnknown(S.Union(BlockedSchema, UsernameSchema)),
						),
						Effect.andThen((x) =>
							"require_login" in x
								? Either.left(new RateLimitError())
								: Either.right(x),
						),
						Effect.map((r) => r.data.user.reel.user.username),
						Effect.tap((username) =>
							Console.log(`[${i}/${ids.length}] got username: ${username}`),
						),
						Effect.tap((username) => InstagramDB.updateUsername(id, username)),
					),
				),
			),
		),
		Effect.timeout(1000 * 60 * 30),
		Effect.catchAllDefect((e) => {
			console.error("!!! caught defect in username finder !!!", e);
			return Effect.void;
		}),
		Effect.catchTags({
			RateLimitError: (e) => {
				console.warn("rate limit");
				return Effect.void;
			},
		}),
		Effect.catchAll((e) =>
			Console.log(`error getting username ${JSON.stringify(e)}`),
		),
		Effect.provide(BrowserLayer.ProxyLive),
		Effect.scoped,
	);

export const mineUsernamesFromID = () =>
	infinite_loop_effect(
		"mineUsernamesFromID",
		program(),
		Schedule.jittered(Schedule.spaced("100 seconds")),
	);

// BunRuntime.runMain(program);
