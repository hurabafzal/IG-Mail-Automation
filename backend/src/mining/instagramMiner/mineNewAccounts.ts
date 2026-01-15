import { infinite_loop_effect } from "backend/src/utils/infinite_loop_effect";
import { Console, Effect, Either, Schedule, Unify, pipe } from "effect";
import { extractEmail } from "extract-email-address";
import {
	type BasicAccount,
	InstagramDB,
	getDaysSince2020,
} from "../InstagramDB";
import { browser_mine_web_profiles } from "./mineWebProfiles";

export const getAccountIdsWithHiddenLikes = (
	web_profiles: Effect.Effect.Success<
		ReturnType<typeof browser_mine_web_profiles>
	>,
) =>
	Effect.sync(() => {
		// followers must be between 10k and 100k
		let hidden_count = 0;
		const ids = [];
		// count the number of web_profiles that are not null and have at least one post with hidden likes
		for (const profile of web_profiles) {
			if (!profile.success) {
				continue;
			}
			const web_profile = profile.data;

			// followers must be between 10k and 100k
			const media = web_profile.edge_owner_to_timeline_media.edges.map(
				(e) => e.node,
			);

			// deduplicate media items with the same post id
			for (const item of media) {
				if (item.edge_media_preview_like.count === -1) {
					ids.push(web_profile.id);
					hidden_count++;
					break;
				}
			}
		}
		console.log(`hidden likes count: ${hidden_count}`);

		return ids;
	});

class NotEnoughData {
	readonly _tag = "NotEnoughData";
}

class NotFoundError {
	readonly _tag = "NotFoundError";
}

class UnknownMiningError {
	readonly _tag = "UnknownMiningError";
}

class PrivateAccount {
	readonly _tag = "PrivateAccount";
	constructor(public readonly account: BasicAccount) {}
}

const res_counts: number[] = [];

const thing = pipe(
	// InstagramDB.getHypeAuditAccounts,
	Effect.all([
		InstagramDB.getInitial,

		// InstagramDB.getManualAccountBatches
	]),
	Effect.tap(([initial]) => {
		console.log("Initial data:", initial);
	}),
	Effect.andThen(([initial]) => [
		...initial.map((i) => ({
			username: i.username,
			batch_id: undefined,
		})),
		// ...manual.map((m) => ({
		// 	username: m.username,
		// 	batch_id: m.batch_id,
		// })),
	]),
	Effect.tap((accounts) =>
		console.log(`pending new instagram accounts: ${accounts.length}`),
	),
	// print the first 5 account json
	Effect.tap((a) => Effect.log(a.slice(0, 5))),
	Effect.andThen((a) =>
		a.length < 1 ? Either.left(new NotEnoughData()) : Either.right(a),
	),
	Effect.andThen((accounts) =>
		pipe(
			browser_mine_web_profiles(accounts.map((a) => a.username)),
			Effect.tap((p) => res_counts.push(p.length)),
			Effect.andThen((p) =>
				Effect.all({
					profiles: Effect.succeed(p),
					hidden_like_ids: getAccountIdsWithHiddenLikes(p),
				}),
			),
			Effect.andThen(({ hidden_like_ids, profiles }) =>
				Effect.all(
					profiles.map((d, i) =>
						pipe(
							///////////////////////////////////////
							//            GET ERRORS
							///////////////////////////////////////
							Unify.unify(
								!d.success && d.error === "missing"
									? Either.left(new NotFoundError())
									: Either.right(d),
							),
							Effect.andThen((p) =>
								!p.success
									? Either.left(new UnknownMiningError())
									: Either.right({
											web_profile: p.data,
											username: p.username,
											source_account: accounts.find(
												(a) => a.username === p.data.username,
											),
											email: extractEmail(p.data.biography)[0]?.email as
												| string
												| undefined,
										}),
							),
							Effect.andThen((p) =>
								p.web_profile.is_private
									? Either.left(
											new PrivateAccount({
												username: p.username,
												followers_count: p.web_profile.edge_followed_by.count,
												following_count: p.web_profile.edge_follow.count,
												posts_count:
													p.web_profile.edge_owner_to_timeline_media.count,
												full_name: p.web_profile.full_name,
												bio: p.web_profile.biography,
												batch_id: p.source_account?.batch_id,
											}),
										)
									: Either.right(p),
							),
							Effect.andThen((x) =>
								!x.source_account
									? Either.left(new UnknownMiningError())
									: Either.right(x),
							),

							///////////////////////////////////////
							//          init vars
							///////////////////////////////////////
							Effect.andThen((p) => {
								const is_target =
									p.web_profile.edge_followed_by.count >= 7_000 &&
									p.web_profile.edge_followed_by.count <= 100_000 &&
									p.web_profile.is_private === false;

								const media =
									p.web_profile.edge_owner_to_timeline_media.edges.map(
										(e) => e.node,
									);
								const clips =
									p.web_profile.edge_felix_video_timeline?.edges.map(
										(e) => e.node,
									) ?? [];
								const allMediaItems = media.concat(clips);
								// sort by date, where the first item is the newest
								allMediaItems.sort(
									(a, b) => b.taken_at_timestamp - a.taken_at_timestamp,
								);

								return {
									...p,
									is_target,
									allMediaItems,
								};
							}),

							///////////////////////////////////////
							//      GET IF EXISTS ALREADY
							///////////////////////////////////////
							// Effect.andThen((p) =>
							// 	Effect.andThen(
							// 		Effect.promise(() =>
							// 			db
							// 				.selectFrom("InstagramAccountBase")
							// 				.select("username")
							// 				.where("id", "=", p.web_profile.id)
							// 				.executeTakeFirst(),
							// 		),
							// 		(exists) => ({
							// 			...p,
							// 			exists: !!exists,
							// 		}),
							// 	),
							// ),

							///////////////////////////////////////
							//           GET COUNTRY
							///////////////////////////////////////
							// Effect.andThen((p) => {
							// 	if (
							// 		!p.is_target ||
							// 		p.exists ||
							// 		ACTIVE_COUNTRIES.includes(
							// 			p.source_account?.source_country ?? "Germany",
							// 		)
							// 	) {
							// 		return Effect.succeed({
							// 			...p,
							// 			about: undefined,
							// 			is_country_target: false,
							// 		});
							// 	}

							// 	return Effect.andThen(
							// 		HikerAPI.about_req(p.web_profile.id),
							// 		(about) => ({
							// 			...p,
							// 			about,
							// 			is_country_target: ACTIVE_COUNTRIES.includes(
							// 				about?.country ?? "",
							// 			),
							// 		}),
							// 	);
							// }),

							///////////////////////////////////////
							//           SAVE RELATED
							///////////////////////////////////////
							Effect.tap(({ web_profile, username, email }) => {
								if (email) {
									console.log(
										"\x1b[32m%s\x1b[0m",
										`[email found] - ${username} - ${email}`,
									);
								}

								const usernames = web_profile.edge_related_profiles?.edges
									.filter((p) => p.node.is_private === false)
									.map((p) => ({ username: p.node.username, id: p.node.id }));

								if (usernames && usernames.length > 0) {
									return InstagramDB.insertRelatedAccounts(
										usernames,
										web_profile.id,
									);
								}
							}),

							///////////////////////////////////////
							//           SAVE EVERYTHING
							///////////////////////////////////////
							Effect.tap(
								({
									allMediaItems,
									email,
									username,
									web_profile,
									is_target,
									source_account,
								}) =>
									InstagramDB.insertAccount(
										username,
										source_account?.batch_id ?? undefined,
										{
											id: web_profile.id,
											username: username,
											last_searched: new Date(),
											// account_created_at: about?.date,
											// country: about?.country,
											is_verified: web_profile.is_verified,
											hiddenLikes: hidden_like_ids.includes(web_profile.id),
											bio: web_profile.biography,
											external_link: web_profile.external_url,
											followers_count: web_profile.edge_followed_by.count,
											following_count: web_profile.edge_follow.count,
											ig_email: email ?? undefined,
											// former_username_count: about?.former_usernames ?? "",
											ig_category_enum: web_profile.category_name,
											ig_full_name: web_profile.full_name,
											posts_count:
												web_profile.edge_owner_to_timeline_media.count,
											username_last_searched: new Date(),
											last_updated: new Date(),
											pfpUrl: web_profile.profile_pic_url_hd,
										},
										{
											followers: web_profile.edge_followed_by.count,
											following: web_profile.edge_follow.count,
											postsCount:
												web_profile.edge_owner_to_timeline_media.count,
											user_id: web_profile.id,
											day: getDaysSince2020(),
										},
										allMediaItems?.map((e) => ({
											id: e.id,
											user_id: web_profile.id,
											caption:
												e.edge_media_to_caption.edges[0]?.node.text ?? "",
											comment_count: e.edge_media_to_comment.count,
											like_count: e.edge_liked_by.count,
											shortcode: e.shortcode,
											taken_at: new Date(e.taken_at_timestamp * 1000),
											play_count: e.video_view_count,
											product_type: e.product_type,

											likes_disabled: e.edge_media_preview_like.count === -1,
										})) ?? [],
									),
							),

							///////////////////////////////////////
							//        PUBLIC EMAIL SEARCH
							///////////////////////////////////////
							// Effect.tap(({ is_country_target, web_profile }) =>
							// 	is_country_target ? get_public_email(web_profile.id) : null,
							// ),

							Effect.tap(({ web_profile }) =>
								Console.log(
									`[${i}/${profiles.length}] done saving ${web_profile.username} web profile`,
								),
							),

							///////////////////////////////////////
							//           ERROR HANDLING
							///////////////////////////////////////
							Effect.catchTags({
								NotFoundError: () => {
									console.log(
										`[${i}/${profiles.length}] ${d.username} is not found because null`,
									);
									return InstagramDB.notFound(
										d.username,
										accounts.find((a) => a.username === d.username)?.batch_id,
									);
								},
								PrivateAccount: (e) => {
									console.error(
										`[${i}/${profiles.length}] ${d.username} is private`,
									);
									return InstagramDB.privateAccount(e.account);
								},
								UnknownMiningError: () =>
									!d.success
										? Console.error(
												`[${i}/${profiles.length}] ${d.username} skipping cause ${d.error}`,
											)
										: Effect.void,
							}),
							Effect.catchAll((e) => {
								console.error(e);
								return Effect.void;
							}),
							Effect.catchAllDefect((e) => {
								console.error(e);
								return Effect.void;
							}),
						),
					),
					{ concurrency: 10 },
				),
			),
		),
	),
	// Effect.tap(() => Effect.sleep("30 seconds")),
);

export const mineNewAccounts = () =>
	infinite_loop_effect("mineNewAccounts", thing, Schedule.spaced("5 seconds"));
