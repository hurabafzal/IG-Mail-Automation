import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runEmailGenerationWorker } from "./email-generation-worker";
import { runCampaignSubmissionWorker } from "./instantly-sender";

BunRuntime.runMain(
	Effect.all([runCampaignSubmissionWorker(), runEmailGenerationWorker(30)], {
		concurrency: "unbounded",
	}),
);
