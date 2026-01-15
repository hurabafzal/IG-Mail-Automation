import { db } from "backend/src/db";
import { infinite_loop_effect } from "backend/src/utils/infinite_loop_effect";
import { shuffleList } from "backend/src/utils/shuffleList";
import { Console, Effect, Either, Schedule, pipe } from "effect";
import { extractEmail } from "extract-email-address";
import { InstagramDB, getDaysSince2020 } from "../InstagramDB";
import { getAccountIdsWithHiddenLikes } from "./mineNewAccounts";
import { browser_mine_web_profiles } from "./mineWebProfiles";

interface User {
	id: string;
	username: string;
	last_updated: Date | null;
}

function filterDuplicates(users: User[]): User[] {
	const seen = new Set<string>();
	return users.filter((user) => {
		const key = `${user.id}-${user.username}`;
		return seen.has(key) ? false : seen.add(key);
	});
}

function getDaysSince(date: Date | null): number {
	if (!date) {
		return -1;
	}

	const currentDate = new Date();
	const timeDifference = currentDate.getTime() - date.getTime();

	// Convert milliseconds to days
	const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

	return daysDifference;
}

const getOutdatedAccounts = pipe(
	InstagramDB.getExisting,
	Effect.map(filterDuplicates),
	Effect.map((d) =>
		d.map((d) => ({
			id: d.id,
			username: d.username,
			last_updated: d.last_updated,
		})),
	),
);

export const mineExistingAccounts = () =>
	infinite_loop_effect(
		"mineExistingAccounts",
		Effect.gen(body),
		Schedule.jittered(Schedule.spaced("30 seconds")),
	);

const body = function* () {
	const accounts = shuffleList(yield* getOutdatedAccounts);
	const size = accounts.length;
	console.log(`pending existing instagram accounts: ${size}`);

	if (size <= 500) return;

	// TODO: verify that there was no name change by using account.id
	// if there was a namechange, use
	const webProfilesResult = yield* Effect.either(
		browser_mine_web_profiles(accounts.map((a) => a.username)),
	);
	if (Either.isLeft(webProfilesResult)) {
		const error = webProfilesResult.left;
		console.error(`Error mining web profiles: ${error}`);
		return;
	}
	const web_profiles = webProfilesResult.right;
	console.log(`got ${web_profiles.length} web profiles`);

	const hidden_like_ids = yield* getAccountIdsWithHiddenLikes(web_profiles);

	const insertUpdates = Effect.all(
		web_profiles.map((profile, i) =>
			Effect.gen(function* () {
				if (!profile.success) {
					console.error("web_profile is null", profile.error);
					yield* Effect.tryPromise(() =>
						db
							.updateTable("InstagramAccountBase")
							.set({
								missing: true,
							})
							.where("username", "=", profile.username)
							.execute(),
					);
					return;
				}
				const web_profile = profile.data;
				const is_target =
					web_profile.edge_followed_by.count >= 7000 &&
					web_profile.edge_followed_by.count <= 100000 &&
					web_profile.is_private === false;

				const username = web_profile.username;
				const og_data = accounts.find((a) => a.username === username);
				const isSameAccount = og_data?.id === web_profile.id;

				console.log(
					`[updates] account last updated ${getDaysSince(
						og_data?.last_updated ?? null,
					)} days ago`,
				);

				if (!isSameAccount) {
					console.warn(`${username} is not the same account`);
					return;
				}

				// if (is_target) {
				const usernames = web_profile.edge_related_profiles?.edges
					.filter((p) => p.node.is_private === false)
					.map((p) => ({ username: p.node.username, id: p.node.id }));

				if (usernames && usernames.length > 0) {
					console.log(
						`[${i + 1}/${web_profiles.length}] !!! inserting ${
							usernames.length
						} related accounts for ${username} !!!`,
					);
					yield* InstagramDB.insertRelatedAccounts(usernames, web_profile.id);
				}
				// }

				// followers must be between 10k and 100k
				const media = web_profile.edge_owner_to_timeline_media.edges.map(
					(e) => e.node,
				);
				const clips =
					web_profile.edge_felix_video_timeline?.edges.map((e) => e.node) ?? [];
				const _allMediaItems = media.concat(clips);
				_allMediaItems.sort(
					(a, b) => b.taken_at_timestamp - a.taken_at_timestamp,
				);

				const email = extractEmail(web_profile.biography)[0];

				// deduplicate media items with the same post id
				const seen = new Set();
				const allMediaItems: typeof _allMediaItems = [];
				for (const item of _allMediaItems) {
					if (seen.has(item.id)) continue;
					seen.add(item.id);
					allMediaItems.push(item);
				}

				console.log(
					`[${i + 1}/${web_profiles.length}] updating ${username} in db`,
				);

				// update account
				yield* InstagramDB.updateAccount(
					web_profile.id,
					{
						last_searched: new Date(),
						is_verified: web_profile.is_verified,
						hiddenLikes: hidden_like_ids.includes(web_profile.id),
						bio: web_profile.biography,
						external_link: web_profile.external_url,
						followers_count: web_profile.edge_followed_by.count,
						following_count: web_profile.edge_follow.count,
						ig_email: email?.email ?? undefined,
						ig_category_enum: web_profile.category_name,
						ig_full_name: web_profile.full_name,
						posts_count: web_profile.edge_owner_to_timeline_media.count,
						username_last_searched: new Date(),
						last_updated: new Date(),
						pfpUrl: web_profile.profile_pic_url_hd,
					},
					{
						followers: web_profile.edge_followed_by.count,
						following: web_profile.edge_follow.count,
						postsCount: web_profile.edge_owner_to_timeline_media.count,
						user_id: web_profile.id,
						day: getDaysSince2020(),
					},
					allMediaItems?.map((e) => ({
						id: e.id,
						user_id: web_profile.id,
						caption: e.edge_media_to_caption.edges[0]?.node.text ?? "",
						comment_count: e.edge_media_to_comment.count,
						like_count: e.edge_liked_by.count,
						shortcode: e.shortcode,
						taken_at: new Date(e.taken_at_timestamp * 1000),
						play_count: e.video_view_count,
						product_type: e.product_type,

						likes_disabled: e.edge_media_preview_like.count === -1,
					})) ?? [],
				);
			}).pipe(
				Effect.tapError((e) => Console.error(e)),
				Effect.tapDefect((d) => Console.error(`!!! defect ${d}`)),
				Effect.retry({
					schedule: Schedule.jittered(Schedule.spaced("10 seconds")),
				}),
			),
		),
	);

	yield* insertUpdates;
	yield* InstagramDB.updateLastSearched(accounts.map((a) => a.id));
};
