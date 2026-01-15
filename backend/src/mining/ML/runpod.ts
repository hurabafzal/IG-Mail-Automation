import {
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Schema as S } from "@effect/schema";
import { env } from "backend/src/env";
import { Console, Effect, pipe } from "effect";

// const POD_ID = "gqctomqvqvdpz0";

type PodBidResumeInput = {
	podId: string;
	bidPerGpu: number;
	gpuCount: number;
};
const runPod = (input: PodBidResumeInput) => {
	// Define the response schema
	const responseSchema = S.Struct({
		data: S.Struct({
			podBidResume: S.Struct({
				id: S.String,
				desiredStatus: S.String,
				imageName: S.String,
				env: S.Array(S.String),
				machineId: S.String,
				machine: S.Struct({
					podHostId: S.String,
				}),
			}).pipe(S.NullOr),
		}),
	});

	// Construct the GraphQL query
	const query = `
		mutation { 
			podBidResume( input: { podId: "${input.podId}", bidPerGpu: ${input.bidPerGpu}, gpuCount: ${input.gpuCount} } ) { 
				id 
				desiredStatus 
				imageName 
				env 
				machineId 
				machine { 
					podHostId 
				} 
			} 
		}
      `;

	// Send the request and parse the response
	return pipe(
		HttpClientRequest.post(
			`https://api.runpod.io/graphql?api_key=${env.RUNPOD_KEY}`,
		),
		HttpClientRequest.setHeader("Content-Type", "application/json"),
		HttpClientRequest.jsonBody({
			query,
		}),
		Effect.flatMap(HttpClient.fetch),
		Effect.flatMap(HttpClientResponse.schemaBodyJson(responseSchema)),
		Effect.map((r) => r.data.podBidResume),
		Effect.scoped,
	);
};

// Pod Query
type PodQueryInput = {
	podId: string;
};

const getPod = (input: PodQueryInput) => {
	const responseSchema = S.Struct({
		data: S.Struct({
			pod: S.Struct({
				id: S.String,
				name: S.String,
				lowestBidPriceToResume: S.NullOr(S.Number),
				gpuCount: S.Number,
				runtime: S.NullishOr(
					S.Struct({
						uptimeInSeconds: S.Number,
						ports: S.Array(
							S.Struct({
								ip: S.String,
								isIpPublic: S.Boolean,
								privatePort: S.Number,
								publicPort: S.Number,
								type: S.String,
							}),
						),
						gpus: S.Array(
							S.Struct({
								id: S.String,
								gpuUtilPercent: S.Number,
								memoryUtilPercent: S.Number,
							}),
						),
						container: S.Struct({
							cpuPercent: S.Number,
							memoryPercent: S.Number,
						}),
					}),
				),
			}),
		}),
	});

	//
	const query = `
	query Pod { 
		pod(input: {podId: "${input.podId}"}) { 
			id name lowestBidPriceToResume gpuCount runtime { 
				uptimeInSeconds ports { 
					ip isIpPublic privatePort publicPort type 
				} gpus { 
					id gpuUtilPercent memoryUtilPercent 
				} container {
					cpuPercent memoryPercent 
				} 
			} 
		} 
	}
    `;

	return pipe(
		HttpClientRequest.post(
			`https://api.runpod.io/graphql?api_key=${env.RUNPOD_KEY}`,
		),
		HttpClientRequest.setHeader("Content-Type", "application/json"),
		HttpClientRequest.jsonBody({
			query,
		}),
		Effect.flatMap(HttpClient.fetch),
		HttpClientResponse.json,
		Effect.tap(Console.log),
		Effect.flatMap(S.decodeUnknown(responseSchema)),
		Effect.map((r) => r.data.pod),
		Effect.scoped,
	);
};

// Pod Stop
type PodStopInput = {
	podId: string;
};

const stopPod = (input: PodStopInput) => {
	const responseSchema = S.Struct({
		data: S.Struct({
			podStop: S.Struct({
				id: S.String,
				desiredStatus: S.String,
			}),
		}),
	});

	const mutation = `
		mutation { 
			podStop(input: {podId: "${input.podId}"}) {
				id desiredStatus 
			} 
		}
    `;

	return pipe(
		HttpClientRequest.post(
			`https://api.runpod.io/graphql?api_key=${env.RUNPOD_KEY}`,
		),
		HttpClientRequest.setHeader("Content-Type", "application/json"),
		HttpClientRequest.jsonBody({
			query: mutation,
		}),
		Effect.flatMap(HttpClient.fetch),
		Effect.flatMap(HttpClientResponse.schemaBodyJson(responseSchema)),
		Effect.map((r) => r.data.podStop),
		Effect.scoped,
	);
};

// create a resource that automatically starts if it's not already running,
// and clean up automatically
type RunPodResource = {
	close: typeof stopPod;
};

class NoGPUsAvailable {
	readonly _tag = "NoGPUsAvailable";
}

const acquire = (POD_ID: string) =>
	pipe(
		getPod({ podId: POD_ID }),
		Effect.andThen((p) => {
			if (!p.runtime) {
				if (p.gpuCount < 1 || !p.lowestBidPriceToResume) {
					return Effect.fail(new NoGPUsAvailable());
				}

				return pipe(
					runPod({
						bidPerGpu: p.lowestBidPriceToResume,
						gpuCount: 1,
						podId: POD_ID,
					}),
					Effect.map((r) => ({
						close: stopPod,
					})),
				);
			}

			return Effect.succeed({
				close: stopPod,
			});
		}),
	);

const release = (POD_ID: string) => (res: RunPodResource) =>
	pipe(
		res.close({ podId: POD_ID }),
		Effect.catchAll((x) => Console.error(x)),
	);

const resource = (POD_ID: string) =>
	Effect.acquireRelease(acquire(POD_ID), release(POD_ID));

export const Runpod = {
	runPod,
	getPod,
	stopPod,
	resource,
};
