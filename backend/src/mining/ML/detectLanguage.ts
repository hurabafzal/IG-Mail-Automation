import {
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Schema } from "@effect/schema";
import { db } from "backend/src/db";
import { ACTIVE_COUNTRIES } from "backend/src/utils/consts";
import { Console, Effect, Schedule, pipe } from "effect";
import { sql } from "kysely";

const Res = Schema.Struct({
	language: Schema.String,
	iso_code: Schema.String,
});

export const detectLanguage = (text: string) =>
	pipe(
		HttpClientRequest.post("http://128.140.57.252:8000/detect"),
		HttpClientRequest.acceptJson,
		HttpClientRequest.jsonBody({
			text: text,
		}),
		Effect.andThen(HttpClient.fetchOk),
		Effect.flatMap(HttpClientResponse.schemaBodyJson(Res)),
		Effect.tap(Console.log),
		Effect.scoped,
	);

const x = Effect.tryPromise(() =>
	db
		.selectFrom("InstagramPost")
		// .innerJoin(
		// 	"InstagramAccountBase",
		// 	"InstagramAccountBase.id",
		// 	"InstagramPost.user_id",
		// )
		.select([
			"InstagramPost.id",
			"InstagramPost.user_id",
			"InstagramPost.caption",
		])
		// .where("followers_count", ">", 7_000)
		// .where("followers_count", "<", 100_000)
		.where("caption_lang", "is", null)
		// .where("caption_lang", "=", "")
		.where("caption", "!=", "")
		.where("caption", "is not", null)
		// .where("country", "in", SEARCH_COUNTRIES)
		// .where("InstagramAccountBase.account_created_at", "is not", null)
		.limit(50_000)
		.orderBy("InstagramPost.user_id", "desc")
		.execute(),
);

export const detectCaptionLang = pipe(
	x,
	Effect.tap((l) => Console.log(l.length)),
	Effect.flatMap((posts) =>
		Effect.all(
			posts.map((post, i) =>
				pipe(
					detectLanguage(post.caption),
					Effect.tap((l) =>
						Console.log(
							`[${i}/${posts.length}] lang is ${l.iso_code} for ${post.id}`,
						),
					),
					Effect.andThen((l) =>
						Effect.promise(() =>
							db
								.updateTable("InstagramPost")
								.set({
									caption_lang: l.iso_code,
								})
								.where("id", "=", post.id)
								.execute(),
						),
					),
					Effect.catchAll((e) => {
						console.error(
							`[${i}/${posts.length}] [${post.id}] error for account`,
							e,
						);

						if (e._tag === "ResponseError") {
							return Effect.promise(() =>
								db
									.updateTable("InstagramPost")
									.set({
										caption_lang: "",
									})
									.where("id", "=", post.id)
									.execute(),
							);
						}

						return Effect.void;
					}),
				),
			),
			{ concurrency: 5 },
		),
	),
);

export const detectCaptionLangCron = pipe(
	detectCaptionLang,
	Effect.catchAll(Console.error),
	Effect.schedule(Schedule.cron("17 */3 * * *")),
);

const pastMinCaptionThreshold = Effect.tryPromise(() =>
	db
		.selectFrom("InstagramPost")
		.innerJoin(
			"InstagramAccountBase",
			"InstagramAccountBase.id",
			"InstagramPost.user_id",
		)
		.select((oc) => [
			"InstagramPost.user_id",
			oc.fn.countAll<number>().as("post_count"),
		])
		// .where("country", "not in", ACTIVE_COUNTRIES)
		.where("country", "<>", "Germany")
		.where("country", "<>", "Austria")
		.where("country", "<>", "Switzerland")
		.where("country", "<>", "GERMAN_CAPTIONS")
		// .where("followers_count", ">=", 10_000)
		// .where("followers_count", "<=", 100_000)
		.where("InstagramPost.caption_lang", "=", "DE")
		.groupBy("InstagramPost.user_id")
		.having(sql`COUNT(*)`, ">=", 3)
		.execute(),
);

// after this is done, we should run the emergency update right away
// to maintain updated info?
export const findGermanAccounts = pipe(
	Console.log("=============Starting findGermanAccounts============="),
	Effect.andThen(() => pastMinCaptionThreshold),
	Effect.tap((l) => Console.log(l.length)),
	Effect.andThen((all_res) =>
		Effect.all(
			all_res.map((res, i) =>
				pipe(
					Effect.tryPromise(() =>
						db
							.updateTable("InstagramAccountBase")
							.set((eb) => ({
								de_caption_count: res.post_count,
								real_country: eb.ref("country"),
								// country: "GERMAN_CAPTIONS",
							}))
							.where("id", "=", res.user_id)
							.executeTakeFirst(),
					),
					Effect.tap(
						Console.log(
							`[${i}/${all_res.length}] set country to GERMAN_CAPTIONS for ${res.user_id}`,
						),
					),
				),
			),
			{ concurrency: 10 },
		),
	),
);

export const findGermanCaptionAccountsCron = pipe(
	findGermanAccounts,
	Effect.catchAll((e) => Console.error(e)),
	Effect.schedule(Schedule.cron("0 0 * * *")),
);
