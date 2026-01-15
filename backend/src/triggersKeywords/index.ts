import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runEmailGenerationWorkerKeywords } from "./email-generation-worker";
import { runCampaignSubmissionWorkerKeywords } from "./instantly-sender";

BunRuntime.runMain(
	Effect.all(
		[
			runCampaignSubmissionWorkerKeywords(),
			runEmailGenerationWorkerKeywords(5),
		],
		{
			concurrency: "unbounded",
		},
	),
);
