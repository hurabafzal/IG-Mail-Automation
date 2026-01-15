import { Schema as S } from "@effect/schema";
import { Console, Effect, Either, pipe } from "effect";
import type { RequestDuplicators } from "../browser/requestDuplicator";

const BlockedSchema = S.Struct({
	message: S.String,
	require_login: S.Boolean,
	status: S.String,
});

class RateLimitError {
	readonly _tag = "RateLimitError";
}

const CommentSchema = S.Struct({
	data: S.Struct({
		xdt_shortcode_media: S.Struct({
			edge_media_preview_comment: S.Struct({
				count: S.Number,
				edges: S.Array(
					S.Struct({
						node: S.Struct({
							created_at: S.Number,
							owner: S.Struct({
								id: S.String,
								is_verified: S.Boolean,
								username: S.String,
							}),
						}),
					}),
				),
			}),
			location: S.NullishOr(
				S.Struct({
					id: S.String,
					has_public_page: S.Boolean,
					name: S.String,
					slug: S.String,
				}),
			),
		}).pipe(S.NullOr),
	}),
});

type Duplicator = Effect.Effect.Success<
	typeof RequestDuplicators.InstagramWebProfile
>;

function mineComments(
	shortcode: string,
	{ duplicate }: Duplicator,
	n: number,
	i: number,
) {
	return pipe(
		duplicate((base) => {
			const originalBody = base.postData;
			if (!originalBody) throw new Error("no body found");
			const variables = {
				shortcode: shortcode,
				fetch_comment_count: 40,
				parent_comment_count: 24,
				child_comment_count: 1,
				fetch_like_count: 10,
				fetch_tagged_user_count: null,
				fetch_preview_comment_count: 10,
				has_threaded_comments: true,
				hoisted_comment_id: null,
				hoisted_reply_id: null,
			};

			// Convert the variables to a URL-encoded string
			const encodedVariables = encodeURIComponent(JSON.stringify(variables));

			// Define the request body with the updated variables
			const body = originalBody.replace(
				/variables=[^&]+/,
				`variables=${encodedVariables}`,
			);

			return {
				postData: body,
			};
		}),
		Effect.tap(() => Console.log("got res!")),
		Effect.andThen((x) => Effect.try(() => JSON.parse(x) as unknown)),
		Effect.retry({
			times: 3,
		}),
		Effect.andThen(S.decodeUnknown(S.Union(BlockedSchema, CommentSchema))),
		Effect.andThen((x) =>
			"require_login" in x
				? Either.left(new RateLimitError())
				: Either.right(x),
		),
	);
}

export function mineUsernamesFromComments(
	shortcode: string,
	{ duplicate }: Duplicator,
	n: number,
	i: number,
) {
	return pipe(
		mineComments(shortcode, { duplicate }, n, i),
		Effect.map((comments) => {
			const usernames =
				comments.data.xdt_shortcode_media?.edge_media_preview_comment.edges.map(
					(x) => x.node.owner.username,
				) ?? [];

			console.log(`[${i}/${n}] - done mining comment ${shortcode}`);

			return usernames;
		}),
		Effect.map((usernames) => Array.from(new Set(usernames))),
	);
}

export function mineIdsFromComments(
	shortcode: string,
	{ duplicate }: Duplicator,
	n: number,
	i: number,
) {
	return pipe(
		mineComments(shortcode, { duplicate }, n, i),
		Effect.map((comments) => {
			const ids =
				comments.data.xdt_shortcode_media?.edge_media_preview_comment.edges.map(
					(x) => x.node.owner.id,
				) ?? [];

			console.log(`[${i}/${n}] - done mining comment ${shortcode}`);

			return ids;
		}),
		Effect.map((ids) => Array.from(new Set(ids))),
	);
}
