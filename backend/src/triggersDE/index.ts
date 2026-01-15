import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runEmailGenerationWorkerDE } from "./email-generation-worker";
import { runCampaignSubmissionWorkerDE } from "./instantly-sender";

BunRuntime.runMain(
	Effect.all([runCampaignSubmissionWorkerDE(), runEmailGenerationWorkerDE(5)], {
		concurrency: "unbounded",
	}),
);
