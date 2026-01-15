import type { HttpClientResponse, UrlParams } from "@effect/platform";
import type { HttpClientError } from "@effect/platform/HttpClientError";
import { Schema } from "@effect/schema";
import { Effect, type Scope } from "effect";
import type { Obj } from "../utils/types";

export const PostRes = Schema.Struct({
	success: Schema.Boolean,
	data: Schema.Struct({
		id: Schema.Number,
	}),
});

export const FindRes = Schema.Struct({
	success: Schema.Boolean,
	data: Schema.Array(
		Schema.Struct({
			id: Schema.Number,
		}),
	),
});

export const DelRes = Schema.Struct({
	success: Schema.Boolean,
});

type HttpResponse = Effect.Effect<
	HttpClientResponse.HttpClientResponse,
	HttpClientError,
	Scope.Scope
>;

export class Pipedrive extends Effect.Tag("pipedrive")<
	Pipedrive,
	{
		get: (
			path: string,
			query?: UrlParams.Input,
			version?: "v1" | "v2",
		) => HttpResponse;
		post: (path: string, body: Obj, version?: "v1" | "v2") => HttpResponse;
		put: (path: string, body: Obj, version?: "v1" | "v2") => HttpResponse;
		del: (path: string, version?: "v1" | "v2") => HttpResponse;
	}
>() {}
