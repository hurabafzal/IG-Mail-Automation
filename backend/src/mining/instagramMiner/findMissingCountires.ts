import { db } from "backend/src/db";
import { HikerAPI } from "backend/src/mining/HikerAPI";
import { Console, Effect, Schedule, pipe } from "effect";

const accounts = Effect.promise(() =>
	db
		.selectFrom("InstagramAccountBase")
		// .leftJoin(
		// 	"InitialInstagramAccount",
		// 	"InitialInstagramAccount.account_id",
		// 	"InstagramAccountBase.id",
		// )
		.select(["id", "InstagramAccountBase.created_at"])
		.where("country", "is", null)
		.where("followers_count", ">", 7_000)
		.where("followers_count", "<", 100_000)
		// .where((w) =>
		// 	w.or([
		// 		w("InstagramAccountBase.country", "in", [
		// 			...ACTIVE_COUNTRIES,
		// 			...EN_ACTIVE_COUNTRIES,
		// 		]),
		// 		w("InstagramAccountBase.de_caption_count", ">=", 4),
		// 		w("InitialInstagramAccount.source_type", "=", "COMMENTS"),
		// 	]),
		// )
		.orderBy("InstagramAccountBase.created_at", "desc")
		.limit(5000)
		.execute(),
);

export const findMissingCountries = pipe(
	accounts,
	Effect.tap((x) =>
		Console.log(`got ${x.length} results, first date is ${x[0]?.created_at}`),
	),
	Effect.andThen((as) =>
		Effect.all(
			as.map((a, i) =>
				pipe(
					HikerAPI.about_req(a.id),
					Effect.tap((x) =>
						console.log(
							`[${i}/${as.length}] got country ${JSON.stringify(x, null, 2)}`,
						),
					),
					Effect.andThen((about) =>
						about
							? Effect.promise(() =>
									db
										.updateTable("InstagramAccountBase")
										.set({
											country: about.country,
											account_created_at: about.date,
											is_verified: about.is_verified,
											former_username_count: about.former_usernames,
											username:
												about.username !== "" ? about.username : undefined,
										})
										.where("id", "=", a.id)
										.execute(),
								)
							: null,
					),
				),
			),
			{ concurrency: 5 },
		),
	),
);

export const findMissingCountriesCron = pipe(
	findMissingCountries,
	Effect.catchAll((e) => Console.error(e)),
	Effect.schedule(Schedule.cron("0 */6 * * *")),
);
