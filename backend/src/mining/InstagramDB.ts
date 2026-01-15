import { Effect } from "effect";
import { type UpdateObject, sql } from "kysely";
import type { InsertObject } from "kysely/dist/cjs/parser/insert-values-parser";
import type { OrderByDirection } from "kysely/dist/cjs/parser/order-by-parser";
import cache from "../cache";
import { db, db_retry_effect } from "../db";
import type { DB } from "../db/db_types";
import { chunkArray } from "../utils/chunkArray";
import { EN_ACTIVE_COUNTRIES, SEARCH_COUNTRIES } from "../utils/consts";
import { sendSlackMessage } from "../utils/slack";

const orderNullsFirst = (direction: OrderByDirection) =>
	sql`${sql.raw(direction)} nulls first`;

const getHypeAuditAccounts = db_retry_effect(
	{ name: "GetHypeAuditAccounts" },
	() =>
		db
			.selectFrom("InitialInstagramAccount")
			.where("source_type", "=", "HYPE_AUDIT")
			.where("not_found", "=", false)
			.where("private", "=", false)
			.where("InitialInstagramAccount.account_id", "is", null)
			.limit(2000)
			.select(["InitialInstagramAccount.username as username"])
			.execute(),
);

const getManualAccountBatches = db_retry_effect(
	{ name: "GetManualAccountBatches" },
	() =>
		db
			.selectFrom("ManualMiningQueue")
			.select(["ManualMiningQueue.username", "ManualMiningQueue.batch_id"])
			.where((eb) =>
				eb.and([eb("account_id", "is", null), eb("not_found", "=", false)]),
			)
			.limit(2000)
			.execute(),
);

const getInitial = db_retry_effect(
	{ name: "GetInitialInstagramAccounts" },
	() =>
		db
			.selectFrom("InstagramAccountBase")
			.innerJoin(
				"RelatedAccounts",
				"RelatedAccounts.from_id",
				"InstagramAccountBase.id",
			)
			.innerJoin(
				"InitialInstagramAccount",
				"RelatedAccounts.to_username",
				"InitialInstagramAccount.username",
			)
			.where("InitialInstagramAccount.account_id", "is", null)
			.where("not_found", "=", false)
			.where("private", "=", false)
			.where((w) =>
				w.or([
					w("InstagramAccountBase.country", "in", SEARCH_COUNTRIES),
					w("InstagramAccountBase.de_caption_count", ">=", 2),
					w("InstagramAccountBase.bio_language", "in", ["DE", "NL"]),
					w("source_type", "=", "SHOPIFY"),
				]),
			)
			.groupBy("RelatedAccounts.to_username")
			.limit(2000)
			.select([
				"RelatedAccounts.to_username as username",
				// "InitialInstagramAccount.source_type",
				// "InstagramAccountBase.country as source_country",
				(eb) => eb.fn.count("InstagramAccountBase.id").as("count"),
			])
			.orderBy("count", "desc")
			.execute(),
);

const getExisting = db_retry_effect(
	{ name: "GetExistingInstagramAccounts" },
	() =>
		cache.settings.getOne("scraping_frequency").then((scraping_frequency) =>
			db
				.selectFrom("InstagramAccountBase")
				// .innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
				.select(["InstagramAccountBase.id", "username", "last_updated"])
				.orderBy("last_searched asc")
				// .where("Email.code", "<>", 6)
				// .where("Email.code", "<>", 7)
				// .where("Email.server_host_type", "<>", "RZONE")
				.where("blacklist", "=", false)
				.where("missing", "=", false)
				.where(
					"last_updated",
					"<",
					new Date(Date.now() - 1000 * 60 * 60 * 24 * scraping_frequency),
				)
				// .where("last_searched", "<", new Date(Date.now() - 1000 * 60 * 20))
				.where("InstagramAccountBase.followers_count", ">", 5000)
				.where((oc) =>
					oc.or([
						oc("country", "in", SEARCH_COUNTRIES),
						oc("bio_language", "=", "DE"),
						// oc.and([
						// 	oc("bio_language", "=", "EN"),
						// 	oc("InstagramAccountBase.country", "in", EN_ACTIVE_COUNTRIES),
						// ]),
					]),
				)
				.limit(2000)
				.execute(),
		),
);

const notFound = (username: string, batch_id?: string) =>
	db_retry_effect({ name: "InstagramAccountNotFound" }, () =>
		batch_id
			? db
					.updateTable("ManualMiningQueue")
					.set({ not_found: true, minedAt: new Date() })
					.where("username", "=", username)
					.where("batch_id", "=", batch_id)
					.execute()
			: db
					.updateTable("InitialInstagramAccount")
					.set({ last_searched: new Date(), not_found: true })
					.where("username", "=", username)
					.execute(),
	);

export interface BasicAccount {
	username: string;
	account_id?: string;
	followers_count?: number;
	following_count?: number;
	posts_count?: number;
	full_name?: string;
	bio?: string;
	batch_id: string | undefined;
}

const privateAccount = (account: BasicAccount) =>
	db_retry_effect({ name: "InstagramAccountPrivate" }, () =>
		account.batch_id
			? db
					.updateTable("ManualMiningQueue")
					.set({
						private: true,
						account_id: account.account_id,
						followers_count: account.followers_count,
						following_count: account.following_count,
						posts_count: account.posts_count,
						full_name: account.full_name,
						bio: account.bio,
						minedAt: new Date(),
					})
					.where("username", "=", account.username)
					.where("batch_id", "=", account.batch_id)
					.execute()
			: db
					.updateTable("InitialInstagramAccount")
					.set({ last_searched: new Date(), private: true })
					.where("username", "=", account.username)
					.execute(),
	);

/**
 * counts the number of days between today and jan 1, 2020
 */
export function getDaysSince2020(date?: Date) {
	const jan12020 = new Date("2020-01-01T00:00:00.000Z"); // January 1, 2020, in UTC time
	const dateToCompare = date ?? new Date(); // Use provided date, or current date if none
	const diffInMs = dateToCompare.getTime() - jan12020.getTime(); // Difference in milliseconds
	const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24)); // Convert milliseconds to days
	return diffInDays;
}

const insertAccount = (
	username: string,
	manual_batch_id: string | undefined,
	base: InsertObject<DB, "InstagramAccountBase">,
	history: InsertObject<DB, "IGHistoryTable">,
	posts: InsertObject<DB, "InstagramPost">[],
) =>
	db_retry_effect({ name: "SaveInstagramAccount" }, () =>
		db.transaction().execute(async (trx) => {
			try {
				const { id, ...base_without_id } = base;

				await trx
					.insertInto("InstagramAccountBase")
					.values(base)
					.onConflict((oc) =>
						oc
							.column("id")
							.doUpdateSet(
								base_without_id as UpdateObject<DB, "InstagramAccountBase">,
							),
					)
					.execute();

				if (!manual_batch_id) {
					await trx
						.updateTable("InitialInstagramAccount")
						.set({ account_id: id as string })
						.where("username", "=", username)
						.executeTakeFirstOrThrow();
				} else {
					await trx
						.updateTable("ManualMiningQueue")
						.set({
							bio: base.bio as string,
							followers_count: base.followers_count as number,
							following_count: base.following_count as number,
							posts_count: base.posts_count as number,
							full_name: base.ig_full_name as string,
							not_found: false,
							account_id: base.id as string,
							minedAt: new Date(),
						})
						.where("username", "=", username)
						.where("batch_id", "=", manual_batch_id)
						.executeTakeFirstOrThrow();
				}

				await trx
					.insertInto("IGHistoryTable")
					.values(history)
					.onConflict((oc) => oc.doNothing())
					.execute();

				if (posts.length > 0)
					await trx
						.insertInto("InstagramPost")
						.values(posts)
						.onConflict((x) => x.doNothing())
						.execute();
			} catch (error) {
				// Check for UTF-8 encoding error
				if (
					error instanceof Error &&
					error.message.includes("invalid byte sequence for encoding")
				) {
					// Delete the problematic user
					// await trx
					// 	.deleteFrom("InitialInstagramAccount")
					// 	.where("username", "=", username)
					// 	.execute();

					await sendSlackMessage(
						`[igMining] Deleted user ${username} due to UTF-8 encoding error`,
					);
					console.error(
						`[igMining] Deleted user ${username} due to UTF-8 encoding error`,
					);
					return;
				}
				throw error; // Re-throw other errors
			}
		}),
	);

// 232192182
const updateAccount = (
	account_id: string,
	base_update: UpdateObject<DB, "InstagramAccountBase">,
	snapshot: InsertObject<DB, "IGHistoryTable"> | null,
	media_snapshots: InsertObject<DB, "InstagramPost">[],
) =>
	Effect.all([
		// update the base account
		Effect.tryPromise(() =>
			db
				.updateTable("InstagramAccountBase")
				.set(base_update)
				.where("id", "=", account_id)
				.execute(),
		),

		// insert follower history
		snapshot
			? Effect.tryPromise(() =>
					db
						.insertInto("IGHistoryTable")
						.values(snapshot)
						.onConflict((oc) => oc.doNothing())
						.execute(),
				)
			: Effect.void,

		// if there is a username, insert it into username history
		base_update.username
			? Effect.tryPromise(() =>
					db
						.insertInto("UsernameHistory")
						.values({
							user_id: account_id,
							username: base_update.username as string,
						})
						.onConflict((o) => o.doNothing())
						.execute(),
				)
			: Effect.void,

		// update existing posts, and insert new ones
		media_snapshots.length > 0
			? Effect.tryPromise(async () => {
					// find the ids of posts that already exist
					const existing = (
						await db
							.selectFrom("InstagramPost")
							.select("id")
							.where(
								"id",
								"in",
								media_snapshots.map((x) => x.id),
							)
							.execute()
					).map((x) => x.id);

					// filter for new posts
					const new_snapshots = media_snapshots.filter(
						(x) => !existing.includes(x.id as string),
					);

					// get the existing posts, and update
					const other = media_snapshots
						.filter((x) => existing.includes(x.id as string))
						.map((obj) =>
							Effect.promise(() =>
								db
									.updateTable("InstagramPost")
									.set({
										...obj,
										taken_at: undefined,
										updated_at: new Date(),
										created_at: undefined,
										comments_searched: undefined,
									})
									.where("id", "=", obj.id)
									.execute(),
							),
						);
					await Effect.runPromise(Effect.all(other, { concurrency: 5 }));

					// if there is new posts, save them
					if (new_snapshots.length > 0) {
						await db
							.insertInto("InstagramPost")
							.values(new_snapshots)
							.execute();
					}
				})
			: Effect.void,
	]);

const updateLastSearched = (account_ids: string[]) =>
	db_retry_effect({ name: "UpdateLastSearched" }, () =>
		db
			.updateTable("InstagramAccountBase")
			.set({ last_searched: new Date() })
			.where("id", "in", account_ids)
			.execute(),
	);

const insertCommentAccounts = (
	accounts: { username: string; source_id: string }[],
) =>
	Effect.all(
		chunkArray(accounts, 2000).map((chunk) =>
			db_retry_effect({ name: "InsertCommentAccount" }, () =>
				db
					.insertInto("InitialInstagramAccount")
					.values(
						chunk.map(({ source_id, username }) => ({
							username,
							source_type: "COMMENTS",
							from_account_id: source_id,
						})),
					)
					.onConflict((oc) => oc.doNothing())
					.execute()
					.then(console.log),
			),
		),
	);

const insertRelatedAccounts = (
	usernames: { username: string; id: string }[],
	source_id: string,
) =>
	Effect.all(
		[
			db_retry_effect({ name: "insertRelatedAccounts" }, () =>
				db
					.insertInto("InitialInstagramAccount")
					.values(
						usernames.map(({ username }) => ({
							username,
							source_type: "RELATED_ACCOUNTS",
							from_account_id: source_id,
						})),
					)
					.onConflict((oc) => oc.doNothing())
					.execute(),
			),
			db_retry_effect({ name: "insertRelatedAccounts2" }, () =>
				db
					.insertInto("RelatedAccounts")
					.values(
						usernames.map(({ username, id }) => ({
							from_id: source_id,
							to_id: id,
							to_username: username,
						})),
					)
					.onConflict((oc) => oc.doNothing())
					.executeTakeFirst(),
			),
		],
		{ concurrency: 2 },
	);

const postCommentsSearched = (post_id: string) =>
	db_retry_effect({ name: "postCommentsSearched" }, () =>
		db
			.updateTable("InstagramPost")
			.where("id", "=", post_id)
			.set({ comments_searched: true })
			.execute(),
	);

const updateUsername = (user_id: string, username: string) =>
	db_retry_effect({ name: "updateUsername" }, async () => {
		await db
			.updateTable("InstagramAccountBase")
			.set({
				username,
				username_last_searched: new Date(),
			})
			.where("id", "=", user_id)
			.execute();

		await db
			.insertInto("UsernameHistory")
			.values({
				user_id,
				username,
			})
			.onConflict((x) => x.doNothing())
			.execute();
	});

const getIDs = db_retry_effect({ name: "getIDs" }, () =>
	db
		.selectFrom("InstagramAccountBase")
		.select("id")
		.where(
			"username_last_searched",
			"<",
			new Date(Date.now() - 1000 * 60 * 60 * 12),
		)
		.where("country", "in", SEARCH_COUNTRIES)
		.orderBy("last_updated", "asc")
		.limit(2000)
		.execute(),
);

export const InstagramDB = {
	updateUsername,
	getIDs,
	getInitial,
	getExisting,
	getHypeAuditAccounts,
	notFound,
	privateAccount,
	insertAccount,
	updateAccount,
	insertCommentAccounts,
	insertRelatedAccounts,
	postCommentsSearched,
	updateLastSearched,
	getManualAccountBatches,
};
