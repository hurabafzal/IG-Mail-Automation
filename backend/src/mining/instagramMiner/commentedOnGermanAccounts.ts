import { BunRuntime } from "@effect/platform-bun";
import { db } from "backend/src/db";
import { Console, Effect, Schedule, pipe } from "effect";
import { InstagramDB } from "../InstagramDB";
import { BrowserLayer } from "../browser/browserLayer";
import { RequestDuplicators } from "../browser/requestDuplicator";
import { mineIdsFromComments, mineUsernamesFromComments } from "./mineComments";

class NotEnoughData {
	readonly _tag = "NotEnoughData";
}

const cte = (offset: number) =>
	db
		.selectFrom("InstagramAccountBase")
		.select("id")
		.where("InstagramAccountBase.country", "=", "Germany")
		.where("InstagramAccountBase.de_caption_count", ">=", 5)
		.orderBy("created_at")
		.offset(offset)
		.limit(10);

const germanAccounts = (offset: number) =>
	pipe(
		Effect.promise(() =>
			db
				.selectFrom("InstagramPost")
				.select([
					"InstagramPost.shortcode",
					// "InstagramPost.user_id",
					// "InstagramPost.id as post_id",
				])
				.where("InstagramPost.user_id", "in", cte(offset))
				.execute(),
		),
		Effect.tap((a) => Console.log(a.length)),
		Effect.andThen((a) =>
			a.length < 100 ? Effect.fail(new NotEnoughData()) : Effect.succeed(a),
		),
		Effect.tap((x) => Console.log(`getting comments: ${x.length}`)),
	);

let n = 40;
const getUsernames = pipe(
	// get and check the data
	Effect.sync(() => n),
	Effect.andThen((offset) => germanAccounts(offset)),
	Effect.andThen((codes) => {
		return pipe(
			RequestDuplicators.InstagramComments,
			Effect.andThen((duplicate) =>
				Effect.all(
					codes.map(({ shortcode }, i) =>
						pipe(
							mineIdsFromComments(shortcode, duplicate, codes.length, i),
							// append results to be saved later
							Effect.tap((xs) =>
								xs.length > 1
									? Effect.tryPromise(() =>
											db
												.updateTable("InstagramAccountBase")
												.set({ commented_on_de: true })
												.where("id", "in", xs)
												.execute(),
										)
									: null,
							),
						),
					),
					{ concurrency: 3 },
				),
			),
			Effect.provide(BrowserLayer.ProxyLive),
			Effect.scoped,
		);
	}),
	Effect.tap((x) => {
		n += 10;
	}),
	Effect.tapError((x) => {
		n += 10;
		return Effect.void;
	}),
	Effect.retry({ schedule: Schedule.forever }),
	Effect.repeat({ schedule: Schedule.forever }),
);

BunRuntime.runMain(getUsernames);
