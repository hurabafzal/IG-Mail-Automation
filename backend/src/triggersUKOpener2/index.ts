import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runEmailGenerationWorkerUK } from "./email-generation-worker";
import { runCampaignSubmissionWorkerUK } from "./instantly-sender";

BunRuntime.runMain(
	Effect.all(
		[runEmailGenerationWorkerUK(5)],
		{
			concurrency: "unbounded",
		},
	),
);

