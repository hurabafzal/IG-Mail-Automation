// https://www.instagram.com/andretattooartist/p/ConQTtnKO3R/
// can get comments from posts this way

import { db, db_retry_effect } from "backend/src/db";
import { InstagramDB } from "backend/src/mining/InstagramDB";
import { BrowserLayer } from "backend/src/mining/browser/browserLayer";
import { RequestDuplicators } from "backend/src/mining/browser/requestDuplicator";
import { ACTIVE_COUNTRIES } from "backend/src/utils/consts";
import { Console, Effect, Schedule, pipe } from "effect";
import { mineUsernamesFromComments } from "./instagramMiner/mineComments";

const postsQuery = db_retry_effect({ name: "recursiveImportSearch" }, () =>
	db
		.selectFrom("InstagramAccountBase")
		.innerJoin(
			"InstagramPost",
			"InstagramAccountBase.id",
			"InstagramPost.user_id",
		)
		.select([
			"InstagramPost.id as post_id",
			"InstagramPost.user_id",
			"shortcode",
		])
		.where("InstagramPost.comment_count", ">", 5)
		.where("InstagramPost.comments_searched", "=", false)
		.where("InstagramAccountBase.ai_bio_lang", "=", "DE")
		.where("InstagramAccountBase.ai_bio_lang_conf", ">=", 4)
		.limit(5_000)
		.execute(),
);

class NotEnoughData {
	readonly _tag = "NotEnoughData";
}

const minePostComments = (
	codes: { shortcode: string; user_id: string; post_id: string }[],
) => {
	const out: { username: string; source_id: string }[] = [];
	return pipe(
		RequestDuplicators.InstagramComments,
		Effect.andThen((duplicate) =>
			Effect.all(
				codes.map(({ shortcode, user_id, post_id }, i) =>
					pipe(
						mineUsernamesFromComments(shortcode, duplicate, codes.length, i),
						Effect.tap((xs) =>
							out.push(
								...xs.map((x) => ({
									username: x,
									source_id: user_id,
								})),
							),
						),
						Effect.tap(() =>
							Effect.sleep(Math.floor(Math.random() * 1000) + 500),
						),
						Effect.tap(() => InstagramDB.postCommentsSearched(post_id)),
					),
				),
				{ concurrency: 5 },
			),
		),
		Effect.as({ out, other: [] }),
		Effect.catchAll(() =>
			Effect.succeed({
				out,
				other: codes.filter((c) => !out.some((o) => o.source_id === c.user_id)),
			}),
		),
		Effect.provide(BrowserLayer.ProxyLive),
		Effect.scoped,
	);
};

export const recursiveSearch = pipe(
	postsQuery,
	Effect.tap((a) => Console.log(a.length)),
	Effect.andThen((a) =>
		a.length < 100 ? Effect.fail(new NotEnoughData()) : Effect.succeed(a),
	),
	Effect.tap((x) => Console.log(`getting comments: ${x.length}`)),
	Effect.andThen((codes) =>
		pipe(
			minePostComments(codes),
			Effect.andThen((result) => {
				// I can probably use an effect.gen with a while loop to do this
				if (result.other.length > 0) {
					return pipe(
						Console.log(`Retrying with ${result.other.length} remaining posts`),
						Effect.andThen(() => minePostComments(result.other)),
						Effect.map((retryResult) => ({
							out: [...result.out, ...retryResult.out],
							other: retryResult.other,
						})),
					);
				}
				return Effect.succeed(result);
			}),
		),
	),
	Effect.andThen((x) => InstagramDB.insertCommentAccounts(x.out)),
	Effect.catchAllDefect((e) => {
		console.error("!!! caught defect in username finder !!!", e);
		return Effect.void;
	}),
	Effect.catchTag("NotEnoughData", () => Effect.sleep("30 minutes")),
);

export const recursiveImportCron = pipe(
	recursiveSearch,
	Effect.schedule(Schedule.spaced("60 minutes")),
	Effect.retry({ schedule: Schedule.spaced("5 minutes") }),
);
