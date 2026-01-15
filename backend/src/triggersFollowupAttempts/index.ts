import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runEmailGenerationWorkerKeywordspipedrive } from "./email-generation-worker";
import { runCampaignSubmissionWorkerKeywordspipedrive } from "./instantly-sender";

BunRuntime.runMain(
	Effect.all(
		[
			runCampaignSubmissionWorkerKeywordspipedrive(),
			runEmailGenerationWorkerKeywordspipedrive(2),
		],
		{
			concurrency: "unbounded",
		},
	),
);
