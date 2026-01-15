import {
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Schema } from "@effect/schema";
import { Effect, Schedule, pipe } from "effect";
import cache from "../cache";
import { env } from "../env";
import { sendSlackMessage, sendSlackMessageE } from "../utils/slack";
import { InstagramDB } from "./InstagramDB";
import {
	a2Schema,
	about_schema,
	clipsSchema,
	commentSchema,
	followersSchema,
	followingSchema,
	mediaSchema,
	userByUsernameSchema,
	user_by_id_schema,
	web_profile_schema,
} from "./hiker_api_schemas";

const req = (
	endpoint: string,
	params: Record<string, string>,
	priority = true,
) =>
	Effect.retry(
		Effect.tryPromise(
			async (): Promise<{
				data: unknown;
				status: number;
				statusText: string;
			}> => {
				let c = await cache.ig_req_count.getToday();
				while ((priority && c > 50_000) || (!priority && c > 23_000)) {
					console.log("[instagram stats] daily limit reached");
					// await sendSlackMessage(`[instagram account Mining] daily limit reached`);
					await Bun.sleep(1000 * 60 * 60);
					c = await cache.ig_req_count.getToday();
				}
				const url = new URL(env.LAMADAVA_URL + endpoint);
				url.search = new URLSearchParams(params).toString();
				const r = await fetch(url.toString(), {
					headers: {
						"x-access-key": env.LAMADAVA_KEY,
					},
				});
				await cache.ig_req_count.incrementToday();
				if (r.status >= 500) {
					// console.log(`[instagram stats] error 500`);
					console.error(
						`[instagram account Mining] error 500 for ${endpoint} with ${JSON.stringify(
							params,
						)}`,
					);
					// await sendSlackMessage(
					// 	`[instagram account Mining] error 500 for ${endpoint} with ${JSON.stringify(params)}`,
					// );
					throw new Error("error 500");
				}
				if (r.status === 402) {
					console.log("[instagram stats] error 402 insufficient credits");
					await Bun.sleep(1000 * 60 * 60 * 12);
					throw new Error("error 402 - insufficient credits");
				}
				const res = await r.json();
				return { data: res, status: r.status, statusText: r.statusText };
			},
		),
		Schedule.intersect(Schedule.exponential("20 seconds"), Schedule.recurs(6)),
	);

const a2_req = (username: string) =>
	Effect.gen(function* (_) {
		const a2 = yield* _(req("a2/user", { username }));
		if (!a2) return null;

		if (a2.status === 404) {
			console.log(`[instagram stats] account ${username} not found`);
			yield* _(InstagramDB.notFound(username));
			yield* _(Effect.sleep(1000 * 60));
			return;
		}

		// this happens when the account is private
		if (a2.status === 403) {
			console.log(`[instagram stats] account ${username} is private`);
			yield* _(
				InstagramDB.privateAccount({
					username,
					batch_id: undefined,
				}),
			);
			yield* _(Effect.sleep(1000 * 60));
			return;
		}

		const parsed = a2Schema.safeParse(a2.data);
		if (!parsed.success) {
			console.error(
				`[instagram stats] account ${username} has no graphql data, status`,
				parsed.error,
			);
			void sendSlackMessage(
				"[instagram account Mining] Failed to parse instagram user",
			);
			yield* _(Effect.sleep(1000 * 60 * 10));
			return;
		}
		return parsed.data.graphql?.user;
	});

const web_profile_req = (username: string) =>
	Effect.gen(function* (_) {
		const web_profile = yield* _(req("v1/user/web_profile_info", { username }));

		if (!web_profile) return null;
		if (web_profile.status === 404) {
			console.log("404 web_profile", web_profile);
			console.log(`[instagram stats] account ${username} not found`);
			// yield* _(InstagramDB.notFound(username));
			// yield* _(Effect.sleep(1000 * 60));
			return { not_found: true };
		}

		if (web_profile.status === 403) {
			console.log(`[instagram stats] account ${username} is private`);
			yield* _(
				InstagramDB.privateAccount({
					username,
					batch_id: undefined,
				}),
			);
			yield* _(Effect.sleep(1000 * 60));
			return;
		}

		const parsed = web_profile_schema.safeParse(web_profile.data);
		if (!parsed.success) {
			console.error(
				`[instagram stats] account ${username} has no graphql data, status`,
				parsed.error,
			);
			void sendSlackMessage(
				"[instagram account Mining] Failed to parse instagram user",
			);
			yield* _(Effect.sleep(1000 * 60 * 10));
			return;
		}
		if (!parsed.data.user) {
			yield* _(InstagramDB.notFound(username));
		}
		return parsed.data.user;
	});

const about_req = (id: string) =>
	Effect.gen(function* (_) {
		const about = yield* _(req("v1/user/about", { id: id }));
		if (!about) return null;
		if (about.status === 404 || about.status === 403) {
			return;
		}

		const parsed = about_schema.safeParse(about.data);
		if (!parsed.success) {
			console.error(
				`[instagram about] failed to parse about for account ${id}`,
				parsed.error,
			);
			void sendSlackMessage(
				`[instagram about] Failed to parse ${id}. Got ${JSON.stringify(about)}`,
			);
			yield* _(Effect.sleep(1000 * 60 * 10));
			return;
		}
		return parsed.data;
	});

const user_by_id = (id: string) =>
	Effect.gen(function* (_) {
		const about = yield* _(req("v2/user/by/id", { id: id }));
		if (!about) return null;
		if (about.status === 404) {
			return {
				status: "notFound",
				user: null,
			};
		}
		if (about.status === 403) {
			return {
				status: "private",
				user: null,
			};
		}

		const parsed = user_by_id_schema.safeParse(about.data);
		if (!parsed.success) {
			console.error(
				`[instagram user by id] failed to parse about for account ${id}`,
				parsed.error,
			);
			void sendSlackMessage(
				`[instagram user by id] Failed to parse for ${id}. Got ${JSON.stringify(
					parsed.error,
				)}`,
			);
			yield* _(Effect.sleep(1000 * 60 * 10));
			return;
		}

		// Check if the account is private from the is_private field in the response
		if (parsed.data.user?.is_private === true) {
			console.log(
				`[${id}] Account is private (is_private: true) - ${parsed.data.user.username}`,
			);
			return {
				status: "private",
				user: parsed.data.user,
			};
		}

		return parsed.data;
	});

const media_req = (user_id: string) =>
	Effect.gen(function* (_) {
		const media = yield* _(req("v2/user/medias", { user_id: user_id }));
		if (!media) return null;

		const parsed = mediaSchema.safeParse(media.data);
		if (parsed.success) {
			return parsed.data.response?.items ?? [];
		}
		console.error(
			`[instagram media] account ${user_id} has no graphql data, status`,
			media.data,
			parsed.error,
		);
		void sendSlackMessage(
			"[instagram media Mining] Failed to parse instagram media",
		);
		yield* _(Effect.sleep(1000 * 60 * 10));
	});

const clips_req = (user_id: string) =>
	Effect.gen(function* (_) {
		const clips = yield* _(req("v2/user/clips", { user_id: user_id }));
		if (!clips) return null;

		const parsed = clipsSchema.safeParse(clips.data);
		if (parsed.success) {
			return parsed.data.response?.items.map((e) => e.media) ?? [];
		}
		console.error(
			`[instagram media] account ${user_id} has no graphql data, status`,
			clips.data,
			parsed.error,
		);
		void sendSlackMessage(
			"[instagram media Mining] Failed to parse instagram clips",
		);
		yield* _(Effect.sleep(1000 * 60 * 10));
	});
const getLatestPostThumbnail = (user_id: string) =>
	Effect.gen(function* (_) {
		const media = yield* _(req("v2/user/medias", { user_id: user_id }));
		if (!media) return null;

		// Check if the account is private (403 status)
		if (media.status === 403) {
			console.log(`[${user_id}] Account is private - cannot access media`);
			return "PRIVATE_ACCOUNT"; // Special marker for private accounts
		}

		// Check if account not found (404 status)
		if (media.status === 404) {
			console.log(`[${user_id}] Account not found - cannot access media`);
			return "NOT_FOUND"; // Special marker for not found accounts
		}

		// Parse the raw response to get image URLs
		interface MediaCandidate {
			url: string;
			height: number;
			width: number;
		}

		interface MediaItem {
			media_type: number; // 1 = photo, 2 = video, 8 = carousel
			image_versions2?: {
				candidates: MediaCandidate[];
			};
			// Add other fields as needed
		}

		interface MediaResponse {
			response?: {
				items: MediaItem[];
			};
		}

		const rawData = media.data as MediaResponse;
		if (rawData?.response?.items && rawData.response.items.length > 0) {
			// Filter for picture posts only (media_type 1 = photo, 8 = carousel with photos)
			const picturePosts = rawData.response.items.filter(
				(item) => item.media_type === 1 || item.media_type === 8,
			);

			if (picturePosts.length === 0) {
				console.log(`[${user_id}] No picture posts found in media response`);
				return null;
			}

			// Get the latest picture post (first in the filtered array)
			const latestPicturePost = picturePosts[0];

			// Try to get the highest quality image from image_versions2.candidates
			if (
				latestPicturePost.image_versions2?.candidates &&
				latestPicturePost.image_versions2.candidates.length > 0
			) {
				// Sort by height to get the highest quality (first candidate is usually highest)
				const sortedCandidates =
					latestPicturePost.image_versions2.candidates.sort(
						(a, b) => b.height - a.height,
					);
				const thumbnailUrl = sortedCandidates[0]?.url;

				if (thumbnailUrl) {
					console.log(`[${user_id}] Found latest picture post thumbnail`);
					return thumbnailUrl;
				}
			}
		}
		// If we get here, it means we have a valid response but no picture posts
		// This could mean the account has no picture posts, or it's private
		// We'll let the caller decide based on the user_by_id result
		console.log(`[${user_id}] No picture thumbnail found in media response`);
		return null;
	});
const comments_req = (media_id: string) =>
	Effect.gen(function* (_) {
		const comments = yield* _(
			req("v2/media/comments", { id: media_id }, false),
		);
		if (!comments) return null;

		const parsed = commentSchema.safeParse(comments.data);
		if (parsed.success) {
			return parsed.data.response;
		}
		console.error(
			`[instagram comments] media ${media_id} has no graphql data, status`,
			comments.data,
			parsed.error,
		);
		void sendSlackMessage(
			"[instagram comments Mining] Failed to parse instagram comments",
		);
		yield* _(Effect.sleep(1000 * 60 * 10));
	});

export class NotFoundError {
	readonly _tag = "NotFoundError";
}
const followers_req = (user_id: string, page_id?: string) =>
	Effect.gen(function* (_) {
		const followers = yield* _(
			req(
				"v2/user/followers",
				!page_id
					? { user_id }
					: {
							user_id,
							page_id,
						},
			),
		);
		if (!followers) return yield* Effect.fail(new NotFoundError());

		const parsed = followersSchema.safeParse(followers.data);
		if (parsed.success) {
			return parsed.data;
		}
		console.error(
			`[instagram followers] followers for ${user_id} err`,
			followers.data,
			parsed.error,
		);
		yield* Effect.sleep(1000 * 60 * 10);
		throw new Error("Error!");
	});

const following_req = (user_id: string, page_id?: string) =>
	Effect.gen(function* (_) {
		const following = yield* _(
			req(
				"v2/user/following",
				!page_id
					? { user_id }
					: {
							user_id,
							page_id,
						},
			),
		);
		if (!following) return yield* Effect.fail(new NotFoundError());

		const parsed = followingSchema.safeParse(following.data);
		if (parsed.success) {
			return parsed.data;
		}
		console.error(
			`[instagram following] following for ${user_id} err`,
			following.data,
			parsed.error,
		);
		yield* Effect.sleep(1000 * 60 * 10);
		throw new Error("Error!");
	});

const user_by_username_req = (username: string) =>
	Effect.gen(function* (_) {
		const user = yield* _(req("v2/user/by/username", { username }));
		if (!user) return null;

		if (user.status === 404) {
			console.log(`[instagram user by username] account ${username} not found`);
			return {
				status: "notFound",
				user: null,
			};
		}

		if (user.status === 403) {
			console.log(
				`[instagram user by username] account ${username} is private`,
			);
			return {
				status: "private",
				user: null,
			};
		}

		const parsed = userByUsernameSchema.safeParse(user.data);
		if (!parsed.success) {
			console.error(
				`[instagram user by username] failed to parse user for account ${username}`,
				parsed.error,
			);

			yield* Effect.sleep(1000 * 60 * 10);
			return null;
		}

		return parsed.data;
	});

const balanceSchema = Schema.Struct({
	requests: Schema.Number,
	rate: Schema.Number,
	currency: Schema.String,
	amount: Schema.Number,
});

const lowBalanceNotify = (min_balance: number) =>
	pipe(
		HttpClientRequest.get(`${env.LAMADAVA_URL}sys/balance`),
		HttpClientRequest.setHeader("x-access-key", env.LAMADAVA_KEY),
		HttpClient.fetchOk,
		Effect.andThen(HttpClientResponse.schemaBodyJson(balanceSchema)),
		Effect.andThen((b) => {
			if (b.amount < min_balance) {
				return sendSlackMessageE(
					`[HikerAPI] low balance! $${b.amount.toFixed(2)}${b.currency}`,
					"nils",
				);
			}
			return Effect.void;
		}),
		Effect.scoped,
	);
export const user_medias_by_id = (user_id: string, opts?: { after?: Date }) =>
	Effect.gen(function* (_) {
		const media = yield* _(req("v2/user/medias", { user_id }));
		if (!media) return [];
		const parsed = mediaSchema.safeParse(media.data);
		if (!parsed.success) {
			console.error(
				`[instagram user_medias_by_id] failed to parse media for account ${user_id}`,
				parsed.error,
			);
			return [];
		}
		let items = parsed.data.response?.items ?? [];
		// Optionally filter by date if 'after' is provided
		if (opts?.after) {
			const afterTime = opts.after.getTime() / 1000;
			items = items.filter((item) => item.taken_at > afterTime);
		}
		return items;
	});
export const lowBalanceNotifyCron = Effect.schedule(
	lowBalanceNotify(20),
	Schedule.cron("0 0 * * *"),
);

/**
 * Hashtag Medias Recent Chunk. Get hashtag chunk of recent medias
 * @param name - The hashtag name (without #)
 * @param page_id - Optional page ID for pagination
 * @returns Array of media items from the hashtag
 */
export const hashtag_medias_recent_v2 = (name: string, page_id?: string) =>
	Effect.gen(function* (_) {
		// Clean and encode the hashtag name
		const cleanName = name.trim().replace(/^#/, "").replace(/\s+/g, ""); // Remove leading # and all spaces
		const params: Record<string, string> = { name: cleanName };
		if (page_id) {
			params.page_id = page_id;
		}

		const response = yield* _(req("v2/hashtag/medias/recent", params));
		if (!response) return [];

		// Handle different possible response structures
		const responseData = response.data;

		// Check for API errors (404, etc.)
		if (
			responseData &&
			typeof responseData === "object" &&
			responseData !== null
		) {
			const data = responseData as Record<string, unknown>;
			if (
				data.detail &&
				typeof data.detail === "string" &&
				data.detail.includes("404 Not Found")
			) {
				console.log(
					`[hashtag_medias_recent_v2] Hashtag #${cleanName} not found (404) - skipping`,
				);
				return [];
			}
			if (data.exc_type && typeof data.exc_type === "string") {
				console.log(
					`[hashtag_medias_recent_v2] API error for #${cleanName}: ${data.exc_type} - ${data.detail || "Unknown error"}`,
				);
				return [];
			}
		}

		// Try to extract items from different possible structures
		let items: unknown[] = [];

		// Type guard to check if responseData is an object
		if (typeof responseData === "object" && responseData !== null) {
			const data = responseData as Record<string, unknown>;

			// Structure 1: response.sections (hashtag API structure)
			if (
				data.response &&
				typeof data.response === "object" &&
				data.response !== null
			) {
				const responseObj = data.response as Record<string, unknown>;
				if (Array.isArray(responseObj.sections)) {
					// Extract media items from sections
					const allItems: unknown[] = [];
					for (const section of responseObj.sections) {
						if (typeof section === "object" && section !== null) {
							const sectionData = section as Record<string, unknown>;

							// Check for layout_content.one_by_two_item.clips.items[].media
							if (
								sectionData.layout_content &&
								typeof sectionData.layout_content === "object" &&
								sectionData.layout_content !== null
							) {
								const layoutContent = sectionData.layout_content as Record<
									string,
									unknown
								>;

								if (
									layoutContent.one_by_two_item &&
									typeof layoutContent.one_by_two_item === "object" &&
									layoutContent.one_by_two_item !== null
								) {
									const oneByTwoItem = layoutContent.one_by_two_item as Record<
										string,
										unknown
									>;

									if (
										oneByTwoItem.clips &&
										typeof oneByTwoItem.clips === "object" &&
										oneByTwoItem.clips !== null
									) {
										const clips = oneByTwoItem.clips as Record<string, unknown>;

										if (Array.isArray(clips.items)) {
											for (const clipItem of clips.items) {
												if (typeof clipItem === "object" && clipItem !== null) {
													const clipItemData = clipItem as Record<
														string,
														unknown
													>;
													if (clipItemData.media) {
														allItems.push(clipItemData.media);
													}
												}
											}
										}
									}
								}
							}

							// Fallback: Check for direct media or items arrays
							else if (Array.isArray(sectionData.media)) {
								allItems.push(...sectionData.media);
							} else if (Array.isArray(sectionData.items)) {
								allItems.push(...sectionData.items);
							}
						}
					}
					items = allItems;
				}
			}
			// Structure 2: response.items (direct array)
			else if (Array.isArray(data.items)) {
				items = data.items;
			}
			// Structure 3: response.data.items
			else if (
				data.data &&
				typeof data.data === "object" &&
				data.data !== null
			) {
				const nestedData = data.data as Record<string, unknown>;
				if (Array.isArray(nestedData.items)) {
					items = nestedData.items;
				}
			}
			// Structure 4: response.results
			else if (Array.isArray(data.results)) {
				items = data.results;
			} else {
				console.log(
					`[hashtag_medias_recent_v2] Unknown response structure for #${cleanName}:`,
					JSON.stringify(responseData, null, 2),
				);
				return [];
			}
		}
		// Structure 4: direct array response
		else if (Array.isArray(responseData)) {
			items = responseData;
		} else {
			console.log(
				`[hashtag_medias_recent_v2] Unknown response structure for #${name}:`,
				JSON.stringify(responseData, null, 2),
			);
			return [];
		}

		console.log(
			`[hashtag_medias_recent_v2] Found ${items.length} items for hashtag #${name}`,
		);
		return items;
	});

export const HikerAPI = {
	followers_req,
	following_req,
	user_by_username_req,
	a2_req,
	web_profile_req,
	about_req,
	media_req,
	clips_req,
	comments_req,
	user_by_id,
	lowBalanceNotify,
	user_medias_by_id,
	getLatestPostThumbnail,
	hashtag_medias_recent_v2,
};
