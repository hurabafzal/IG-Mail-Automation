import { HttpClient, HttpClientRequest } from "@effect/platform";
import { Effect, Layer, pipe } from "effect";
import { env } from "../env";
import { Pipedrive } from "./types";

export const pipedriveLIVE = Layer.succeed(
	Pipedrive,
	Pipedrive.of({
		get: (path, q) =>
			pipe(
				HttpClientRequest.get(`${BASE_URL}${path}`),
				HttpClientRequest.appendUrlParams(q ?? {}),
				HttpClientRequest.appendUrlParam("api_token", env.PIPEDRIVE_API_KEY),
				HttpClient.fetchOk,
			),
		post: (path, body) =>
			pipe(
				HttpClientRequest.post(`${BASE_URL}${path}`),
				HttpClientRequest.appendUrlParam("api_token", env.PIPEDRIVE_API_KEY),
				HttpClientRequest.jsonBody(body),
				Effect.catchTag("HttpBodyError", () => Effect.die("invalid json body")), // should never happen
				Effect.flatMap(HttpClient.fetchOk),
			),
		del: (path) =>
			pipe(
				HttpClientRequest.del(`${BASE_URL}${path}`),
				HttpClientRequest.appendUrlParam("api_token", env.PIPEDRIVE_API_KEY),
				HttpClient.fetchOk,
			),
		put: (path, body) =>
			pipe(
				HttpClientRequest.put(`${BASE_URL}${path}`),
				HttpClientRequest.appendUrlParam("api_token", env.PIPEDRIVE_API_KEY),
				HttpClientRequest.jsonBody(body),
				Effect.catchTag("HttpBodyError", () => Effect.die("invalid json body")), // should never happen
				Effect.flatMap(HttpClient.fetchOk),
			),
	}),
);

const BASE_URL = "https://api.pipedrive.com/v1";
