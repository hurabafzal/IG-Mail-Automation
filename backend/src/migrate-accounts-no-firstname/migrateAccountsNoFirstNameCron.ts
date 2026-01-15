import { db } from "backend/src/db";
import { Effect, Schedule, pipe } from "effect";

/**
 * Service to migrate Instagram accounts without first_name from InstagramAccountBase
 * to InstagramAccountBaseNoFirstName table.
 *
 * This service:
 * 1. Finds accounts where first_name IS NULL OR first_name = 'No name found'
 * 2. Moves them to InstagramAccountBaseNoFirstName table
 * 3. Deletes them from InstagramAccountBase table
 */
const BATCH_SIZE = 1000;

const migrateAccountsBatch = async (batchSize: number): Promise<number> => {
	return await db.transaction().execute(async (trx) => {
		// Find accounts without first_name
		const accountsToMigrate = await trx
			.selectFrom("InstagramAccountBase")
			.where((eb) =>
				eb.or([
					eb("first_name", "is", null),
					eb("first_name", "=", "No name found"),
				]),
			)
			.selectAll()
			.limit(batchSize)
			.execute();

		if (accountsToMigrate.length === 0) {
			return 0;
		}

		// Insert into new table
		await trx
			.insertInto("InstagramAccountBaseNoFirstName")
			.values(
				accountsToMigrate.map((account) => ({
					id: account.id,
					last_searched: account.last_searched,
					account_created_at: account.account_created_at,
					country: account.country,
					created_at: account.created_at,
					lastSentEmail: account.lastSentEmail,
					username: account.username,
					is_verified: account.is_verified,
					first_name: account.first_name,
					gender: account.gender,
					niche: account.niche,
					searched_for_email: account.searched_for_email,
					hiddenLikes: account.hiddenLikes,
					business_name: account.business_name,
					use_for_training: account.use_for_training,
					approved: account.approved,
					bio: account.bio,
					username_last_searched: account.username_last_searched,
					external_link: account.external_link,
					followers_count: account.followers_count,
					following_count: account.following_count,
					former_username_count: account.former_username_count,
					ig_category_enum: account.ig_category_enum,
					ig_email: account.ig_email,
					ig_full_name: account.ig_full_name,
					last_updated: account.last_updated,
					posts_count: account.posts_count,
					shopify_imported: account.shopify_imported,
					bio_language: account.bio_language,
					triggerBitmap: account.triggerBitmap,
					lastSentOpener: account.lastSentOpener,
					approve_counter: account.approve_counter,
					pfpUrl: account.pfpUrl,
					de_caption_count: account.de_caption_count,
					real_country: account.real_country,
					blacklist: account.blacklist,
					commented_on_de: account.commented_on_de,
					ai_bio_lang: account.ai_bio_lang,
					ai_bio_lang_conf: account.ai_bio_lang_conf,
					gender_conf: account.gender_conf,
					first_name_checked_at: account.first_name_checked_at,
					missing: account.missing,
					approved_at: account.approved_at,
					edited_at: account.edited_at,
					previous_name: account.previous_name,
					clone_count: account.clone_count,
					activeCampaignId: account.activeCampaignId,
					activeLeadId: account.activeLeadId,
					blacklisted_at: account.blacklisted_at,
					last_data_refresh_attempt_at: account.last_data_refresh_attempt_at,
					last_data_refreshed_at: account.last_data_refreshed_at,
					needs_data_refresh: account.needs_data_refresh,
				})),
			)
			.onConflict((oc) => oc.doNothing())
			.execute();

		// Delete from original table
		const accountIds = accountsToMigrate.map((a) => a.id);
		await trx
			.deleteFrom("InstagramAccountBase")
			.where("id", "in", accountIds)
			.execute();

		return accountsToMigrate.length;
	});
};

const getRemainingCount = async (): Promise<number> => {
	const result = await db
		.selectFrom("InstagramAccountBase")
		.where((eb) =>
			eb.or([
				eb("first_name", "is", null),
				eb("first_name", "=", "No name found"),
			]),
		)
		.select(({ fn }) => [fn.count<number>("id").as("count")])
		.executeTakeFirstOrThrow();

	return result.count;
};

export const migrateAccountsNoFirstNameCron = pipe(
	Effect.gen(function* () {
		let totalMigrated = 0;
		let batchCount = 0;

		while (true) {
			const remainingCount = yield* Effect.tryPromise({
				try: () => getRemainingCount(),
				catch: (error) => new Error(`Failed to get remaining count: ${error}`),
			});

			if (remainingCount === 0) {
				break;
			}

			batchCount++;

			const migrated = yield* Effect.tryPromise({
				try: () => migrateAccountsBatch(BATCH_SIZE),
				catch: (error) =>
					new Error(`Failed to migrate batch ${batchCount}: ${error}`),
			});

			totalMigrated += migrated;

			// Small delay between batches to avoid overwhelming the database
			yield* Effect.sleep("500 millis");
		}
	}),
	Effect.schedule(Schedule.cron("0 0 * * *")), // Daily at midnight (12:00 AM)
	Effect.catchAll((error) => Effect.void),
);
