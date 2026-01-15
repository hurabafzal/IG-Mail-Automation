import { Effect, Schedule } from "effect";
import { db } from "../db";
import { EmailSequenceStage } from "../db/db_types";
import {
	browser_mine_web_profiles,
	getAccountIdsWithHiddenLikes,
} from "../mining/instagramMiner/mineWebProfiles";
import type { MediaItem } from "../mining/instagramMiner/schema";

/**
 * Processes a batch of account refreshes
 */
export function refreshInstagramAccountsCron(batchSize = 100) {
	return Effect.gen(function* () {
		const accounts = yield* getAccountsNeedingRefresh(batchSize);

		if (accounts.length === 0) {
			console.log("No accounts need refreshing");
			return { successful: [], failed: [] };
		}

		// Print stats about last_data_refreshed_at
		const now = new Date();
		const diffsInDays: number[] = [];
		for (const account of accounts) {
			if (account.last_data_refreshed_at) {
				const diffMs =
					now.getTime() - new Date(account.last_data_refreshed_at).getTime();
				const diffDays = diffMs / (1000 * 60 * 60 * 24);
				diffsInDays.push(diffDays);
			}
		}
		if (diffsInDays.length > 0) {
			const min = Math.min(...diffsInDays);
			const max = Math.max(...diffsInDays);
			const avg = diffsInDays.reduce((a, b) => a + b, 0) / diffsInDays.length;
			console.log(
				`InstagramAccountBase.last_data_refreshed_at stats: min=${min.toFixed(2)}d, max=${max.toFixed(2)}d, avg=${avg.toFixed(2)}d (n=${diffsInDays.length})`,
			);
		} else {
			console.log("No accounts have last_data_refreshed_at set.");
		}

		// Record refresh attempts for all accounts
		console.log(`Processing ${accounts.length} accounts for data refresh`);
		yield* db
			.updateTable("InstagramAccountBase")
			.set({
				last_data_refresh_attempt_at: new Date(),
			})
			.where(
				"id",
				"in",
				accounts.map((account) => account.id),
			)
			.executeE();

		/////////////////////////////////////////////////////////////
		// Mine all profiles in a single batch call
		/////////////////////////////////////////////////////////////
		const usernames = accounts.map((account) => account.username);
		const webProfilesResult = yield* Effect.either(
			browser_mine_web_profiles(usernames),
		);
		if (webProfilesResult._tag === "Left") {
			console.error("Failed to mine profiles batch:", webProfilesResult.left);
			// All accounts failed due to batch mining failure
			const failed = accounts.map((account) => ({
				account,
				error: `Batch mining failed: ${webProfilesResult.left}`,
			}));
			return { successful: [], failed };
		}

		const webProfiles = webProfilesResult.right;
		console.log(`Got ${webProfiles.length} web profile results`);

		// Check for hidden likes
		const hiddenLikeIds = getAccountIdsWithHiddenLikes(webProfiles);

		// Create a map for quick lookup of profile results by username
		const profileMap = new Map(
			webProfiles.map((profile) => [profile.username, profile]),
		);

		/////////////////////////////////////////////////////////////
		// Process each account with its corresponding profile data
		/////////////////////////////////////////////////////////////
		yield* Effect.forEach(
			accounts,
			(account, i) =>
				Effect.gen(function* () {
					const profileResult = profileMap.get(account.username);
					if (!profileResult) {
						// yield* logInfo(`No result for ${account.username}`);
						return;
					}
					if (!profileResult.success) {
						// Check if the error indicates the profile is missing
						if (profileResult.error === "missing") {
							// Record the account as missing
							yield* db
								.updateTable("InstagramAccountBase")
								.set({
									missing: true,
									needs_data_refresh: false,
									last_data_refresh_attempt_at: new Date(),
								})
								.where("id", "=", account.id)
								.executeE();
						}

						console.error(
							`Failed to refresh ${account.username}: ${profileResult.error}`,
						);
						return;
					}

					// Process successful profile data
					const user = profileResult.data;
					if (!user) {
						console.log(`No user data for ${account.username}`);
						return;
					}

					// Extract ALL media from the profile (posts + clips/reels)
					const media =
						user.edge_owner_to_timeline_media?.edges?.map((e) => e.node) || [];
					const clips =
						user.edge_felix_video_timeline?.edges?.map((e) => e.node) || [];
					const _allMediaItems = media.concat(clips);

					// Sort by timestamp (newest first)
					_allMediaItems.sort(
						(a, b) => b.taken_at_timestamp - a.taken_at_timestamp,
					);

					// Deduplicate media items with the same post id
					const seen = new Set();
					const allMediaItems: typeof _allMediaItems = [];
					for (const item of _allMediaItems) {
						if (seen.has(item.id)) continue;
						seen.add(item.id);
						allMediaItems.push(item);
					}

					// Process and store all media
					yield* processAccountPosts(user.id, allMediaItems);

					// 💾 Save the results
					console.log("saving results for ", user.id, i);
					yield* db
						.updateTable("InstagramAccountBase")
						.set({
							needs_data_refresh: false,
							last_data_refreshed_at: new Date(),
							last_data_refresh_attempt_at: new Date(),
							followers_count: user.edge_followed_by.count,
							following_count: user.edge_follow.count,
							bio: user.biography,
							ig_full_name: user.full_name || "",
							posts_count: user.edge_owner_to_timeline_media.count,
							is_verified: user.is_verified,
							hiddenLikes: hiddenLikeIds.includes(user.id),
							external_link: user.external_url,
							ig_category_enum: user.category_enum,
						})
						.where("id", "=", account.id)
						.returningAll()
						.executeTakeFirstOrThrowE();
				}),
			{ concurrency: 5 },
		);
	}).pipe(
		Effect.catchAll((e) => {
			console.error("Error processing batch refresh:", e);
			return Effect.succeed(undefined);
		}),
		Effect.catchAllDefect((e) => {
			console.error("Error processing campaign submission:", e);
			return Effect.succeed(undefined);
		}),
		Effect.repeat(Schedule.spaced("1 minute")),
	);
}

/**
 * Gets accounts that need data refresh based on sequence stage and refresh timing
 */
function getAccountsNeedingRefresh(limit = 100) {
	const now = new Date();
	const staleDataThreshold = new Date();
	staleDataThreshold.setDate(staleDataThreshold.getDate() - 24 * 7); // 7 days ago

	return (
		db
			.selectFrom("InstagramAccountBase")
			.innerJoin(
				"EmailSequence",
				"InstagramAccountBase.id",
				"EmailSequence.instagram_account_id",
			)
			.selectAll("InstagramAccountBase")
			.where((eb) =>
				eb.or([
					// Explicitly marked as needing refresh
					eb("InstagramAccountBase.needs_data_refresh", "=", true),
					// In active sequence stages and data is stale
					eb.and([
						eb("EmailSequence.current_stage", "in", [
							EmailSequenceStage.AWAITING_TRIGGERS,
							EmailSequenceStage.OPENER_PENDING_GENERATION,
							EmailSequenceStage.TRIGGER_EMAIL_PENDING_GENERATION,
						]),
						eb.or([
							eb("InstagramAccountBase.last_data_refreshed_at", "is", null),
							eb(
								"InstagramAccountBase.last_data_refreshed_at",
								"<",
								staleDataThreshold,
							),
						]),
					]),
				]),
			)
			// Don't retry failed attempts too frequently (wait at least 12 hours)
			.where((eb) =>
				eb.or([
					eb("InstagramAccountBase.last_data_refresh_attempt_at", "is", null),
					eb(
						"InstagramAccountBase.last_data_refresh_attempt_at",
						"<",
						new Date(now.getTime() - 12 * 60 * 60 * 1000),
					),
				]),
			)
			// Exclude accounts that are marked as missing
			.where("InstagramAccountBase.missing", "!=", true)
			.limit(limit)
			.executeE()
	);
}

/**
 * Processes and stores Instagram posts/media for an account
 */
function processAccountPosts(userId: string, mediaItems: MediaItem[]) {
	return Effect.gen(function* () {
		if (mediaItems.length === 0) {
			return [];
		}

		const now = new Date();
		const newPosts = mediaItems.map((item) => {
			// Extract caption text
			const captionEdges = item.edge_media_to_caption?.edges || [];
			const caption =
				captionEdges.length > 0 && captionEdges[0]?.node?.text
					? captionEdges[0].node.text
					: "";

			return {
				id: item.id,
				thumbnail: item.thumbnail_src || null,
				user_id: userId,
				shortcode: item.shortcode,
				likes_disabled: item.edge_media_preview_like?.count === -1,
				comment_count: item.edge_media_to_comment?.count || 0,
				like_count: item.edge_liked_by?.count || 0,
				play_count: item.video_view_count || null,
				reshare_count: null, // Not available in web profile data
				product_type: item.product_type || null,
				taken_at: new Date(item.taken_at_timestamp * 1000),
				caption,
				created_at: now,
				caption_lang: null, // Would need language detection
			};
		});

		// Use upsert to handle existing posts

		for (const post of newPosts) {
			yield* db
				.insertInto("UniqueInstagramPost")
				.values(post)
				.onConflict((oc) =>
					oc.column("id").doUpdateSet({
						thumbnail: post.thumbnail,
						reshare_count: post.reshare_count,
						comment_count: post.comment_count,
						like_count: post.like_count,
						play_count: post.play_count,
						likes_disabled: post.likes_disabled,
						caption: post.caption,
					}),
				)
				.executeTakeFirstE();
		}
	});
}
