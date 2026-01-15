// import { db } from "backend/src/db";
// import { HikerAPI } from "backend/src/mining/HikerAPI";
// import { InstagramDB, getDaysSince2020 } from "backend/src/mining/InstagramDB";
// import { COUNTRY_GROUPS } from "backend/src/utils/consts";
// import { daysAgo } from "backend/src/utils/daysAgo";
// import { Console, Effect, Schedule, pipe } from "effect";
// import { EmailSequenceStage, type Lang } from "../db/db_types";

// const countryIdsToUpdate = ["DE"] as Lang[];

// const outdatedAccounts = Effect.tryPromise(() =>
// 	db
// 		.selectFrom("InstagramAccountBase")
// 		.select("InstagramAccountBase.id")
// 		.innerJoin(
// 			"EmailSequence",
// 			"EmailSequence.instagram_account_id",
// 			"InstagramAccountBase.id",
// 		)
// 		.innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
// 		.where(
// 			"EmailSequence.current_stage",
// 			"=",
// 			EmailSequenceStage.OPENER_PENDING_GENERATION,
// 		)
// 		// .where("code", "<>", 6)
// 		// .where("code", "<>", 7)
// 		// .where("Email.server_host_type", "<>", "RZONE")
// 		// .where("blacklist", "=", false)
// 		// .where("missing", "=", false)
// 		// .where((oc) =>
// 		// 	oc.or(
// 		// 		COUNTRY_GROUPS.filter((c) => countryIdsToUpdate.includes(c.id)).map(
// 		// 			(c) =>
// 		// 				c.bioLanguage !== undefined
// 		// 					? oc.and([
// 		// 							oc("bio_language", "=", c.bioLanguage),
// 		// 							oc("country", "in", c.countries),
// 		// 						])
// 		// 					: oc("country", "in", c.countries),
// 		// 		),
// 		// 	),
// 		// )
// 		// .where("last_data_refreshed_at", "<", daysAgo(25))
// 		.where("last_data_refreshed_at", "is", null)
// 		.orderBy("last_data_refreshed_at", "desc")
// 		// .limit(1000)
// 		.execute(),
// );

// export const updateAnOutdatedAccount = (id: string) =>
// 	pipe(
// 		HikerAPI.user_by_id(id),
// 		Effect.andThen((x) => {
// 			if (x?.status === "notFound") {
// 				// return db
// 				// 	.deleteFrom("InstagramPost")
// 				// 	.where("user_id", "=", id)
// 				// 	.execute()
// 				// 	.then(() => {
// 				// 		return db
// 				// 			.deleteFrom("InstagramAccountBase")
// 				// 			.where("id", "=", id)
// 				// 			.execute();
// 				// 	});
// 				console.error(`account ${id} not found`);
// 				return db
// 					.updateTable("InstagramAccountBase")
// 					.set({
// 						missing: true,
// 						last_updated: new Date(),
// 						last_data_refreshed_at: new Date(),
// 					})
// 					.where("id", "=", id)
// 					.execute();
// 			}

// 			if (x?.user && x.user.username !== "") {
// 				return InstagramDB.updateAccount(
// 					id,
// 					{
// 						username: x.user.username ?? undefined,
// 						last_searched: new Date(),
// 						bio: x.user.biography ?? undefined,
// 						external_link: x.user.external_url,
// 						followers_count: x.user.follower_count ?? undefined,
// 						following_count: x.user.following_count ?? undefined,
// 						ig_email:
// 							x.user.public_email?.trim() === ""
// 								? undefined
// 								: (x.user.public_email ?? undefined),
// 						ig_full_name: x.user.full_name ?? undefined,
// 						posts_count: x.user.media_count ?? undefined,
// 						username_last_searched: new Date(),
// 						last_updated: new Date(),
// 						pfpUrl: x.user.profile_pic_url_hd ?? x.user.profile_pic_url,
// 						last_data_refreshed_at: new Date(),
// 					},
// 					x.user.follower_count && x.user.following_count && x.user.media_count
// 						? {
// 								followers: x.user.follower_count,
// 								following: x.user.following_count,
// 								postsCount: x.user.media_count,
// 								user_id: id,
// 								day: getDaysSince2020(),
// 							}
// 						: null,
// 					[],
// 				);
// 			}
// 			console.error(`account ${id} not found`, x);

// 			return db
// 				.updateTable("InstagramAccountBase")
// 				.set({
// 					last_updated: new Date(),
// 					last_data_refreshed_at: new Date(),
// 				})
// 				.where("id", "=", id)
// 				.execute();
// 		}),
// 	);

// export const updateOutdated = pipe(
// 	outdatedAccounts,
// 	Effect.tap((a) => Console.log(`got ${a.length} accounts`)),
// 	Effect.andThen((accounts) =>
// 		Effect.all(
// 			accounts.map(({ id }, i) =>
// 				pipe(
// 					updateAnOutdatedAccount(id),
// 					Effect.tap(Console.log(`[${i}/${accounts.length}] updated ${id}`)),
// 				),
// 			),
// 			{ concurrency: 10 },
// 		),
// 	),
// );

// export const updateOutdatedCron = pipe(
// 	updateOutdated,
// 	Effect.catchAll((e) => Console.error(e)),
// 	Effect.schedule(Schedule.cron("30 */20 * * *")),
// );

import { db } from "backend/src/db";
import { HikerAPI } from "backend/src/mining/HikerAPI";
import { InstagramDB, getDaysSince2020 } from "backend/src/mining/InstagramDB";
import { COUNTRY_GROUPS } from "backend/src/utils/consts";
import { daysAgo } from "backend/src/utils/daysAgo";
import { Console, Effect, Schedule, pipe } from "effect";
import { EmailSequenceStage, type Lang } from "../db/db_types";

const countryIdsToUpdate = ["DE"] as Lang[];

const outdatedAccounts = Effect.tryPromise(() =>
	db
		.selectFrom("InstagramAccountBase")
		.select("InstagramAccountBase.id")
		.innerJoin(
			"EmailSequence",
			"EmailSequence.instagram_account_id",
			"InstagramAccountBase.id",
		)
		.innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
		.where(
			"EmailSequence.current_stage",
			"=",
			EmailSequenceStage.OPENER_PENDING_GENERATION,
		)
		// .where("code", "<>", 6)
		// .where("code", "<>", 7)
		// .where("Email.server_host_type", "<>", "RZONE")
		// .where("blacklist", "=", false)
		// .where("missing", "=", false)
		// .where((oc) =>
		// 	oc.or(
		// 		COUNTRY_GROUPS.filter((c) => countryIdsToUpdate.includes(c.id)).map(
		// 			(c) =>
		// 				c.bioLanguage !== undefined
		// 					? oc.and([
		// 							oc("bio_language", "=", c.bioLanguage),
		// 							oc("country", "in", c.countries),
		// 						])
		// 					: oc("country", "in", c.countries),
		// 		),
		// 	),
		// )
		// .where("last_data_refreshed_at", "<", daysAgo(25))
		.where("last_data_refreshed_at", "is", null)
		.orderBy("last_data_refreshed_at", "desc")
		// .limit(1000)
		.execute(),
);

const removePrivateProfileFromCloning = (igId: string, username: string) => {
	return Effect.tryPromise(async () => {
		// Remove from UsersToClone table
		await db.deleteFrom("UsersToClone").where("ig_id", "=", igId).execute();

		// Delete from InstagramAccountBase table entirely
		await db
			.updateTable("InstagramAccountBase")
			.set({
				missing: true,
				last_updated: new Date(),
				last_data_refreshed_at: new Date(),
			})
			.where("id", "=", igId)
			.execute();

		console.log(
			`[PRIVATE PROFILE] Successfully removed ${username} from InstagramAccountBase and cloning`,
		);
	});
};

export const updateAnOutdatedAccount = (id: string) =>
	pipe(
		Effect.all([HikerAPI.user_by_id(id), HikerAPI.getLatestPostThumbnail(id)], {
			concurrency: "unbounded",
		}),
		Effect.andThen(([userData, thumbnailUrl]) => {
			// Check if account is private from either user_by_id or getLatestPostThumbnail
			if (
				userData?.status === "private" ||
				thumbnailUrl === "PRIVATE_ACCOUNT"
			) {
				return removePrivateProfileFromCloning(
					id,
					userData?.user?.username || "unknown",
				);
			}

			// Check if account not found from either user_by_id or getLatestPostThumbnail
			if (userData?.status === "notFound" || thumbnailUrl === "NOT_FOUND") {
				return removePrivateProfileFromCloning(
					id,
					userData?.user?.username || "unknown",
				);
			}

			// Note: If thumbnailUrl is null, we'll fallback to profile picture below

			if (userData?.user && userData.user.username !== "") {
				// Use latest post thumbnail if available, otherwise fallback to profile picture
				const pfpUrl = thumbnailUrl;

				return InstagramDB.updateAccount(
					id,
					{
						username: userData.user.username ?? undefined,
						last_searched: new Date(),
						bio: userData.user.biography ?? undefined,
						external_link: userData.user.external_url,
						followers_count: userData.user.follower_count ?? undefined,
						following_count: userData.user.following_count ?? undefined,
						ig_email:
							userData.user.public_email?.trim() === ""
								? undefined
								: (userData.user.public_email ?? undefined),
						ig_full_name: userData.user.full_name ?? undefined,
						posts_count: userData.user.media_count ?? undefined,
						username_last_searched: new Date(),
						last_updated: new Date(),
						pfpUrl: pfpUrl,
						last_data_refreshed_at: new Date(),
					},
					userData.user.follower_count &&
						userData.user.following_count &&
						userData.user.media_count
						? {
								followers: userData.user.follower_count,
								following: userData.user.following_count,
								postsCount: userData.user.media_count,
								user_id: id,
								day: getDaysSince2020(),
							}
						: null,
					[],
				);
			}
			console.error(`account ${id} not found`, userData);

			return db
				.updateTable("InstagramAccountBase")
				.set({
					last_updated: new Date(),
					last_data_refreshed_at: new Date(),
				})
				.where("id", "=", id)
				.execute();
		}),
	);

export const updateOutdated = pipe(
	outdatedAccounts,
	Effect.tap((a) => Console.log(`got ${a.length} accounts`)),
	Effect.andThen((accounts) =>
		Effect.all(
			accounts.map(({ id }, i) =>
				pipe(
					updateAnOutdatedAccount(id),
					Effect.tap(Console.log(`[${i}/${accounts.length}] updated ${id}`)),
				),
			),
			{ concurrency: 10 },
		),
	),
);

export const updateOutdatedCron = pipe(
	updateOutdated,
	Effect.catchAll((e) => Console.error(e)),
	Effect.schedule(Schedule.cron("30 */20 * * *")),
);
