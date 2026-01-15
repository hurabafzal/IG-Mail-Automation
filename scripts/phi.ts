import { BunRuntime } from "@effect/platform-bun";
import { main } from "backend/src/mining/ML/phi";
import { Console, Effect, Schedule, pipe } from "effect";

BunRuntime.runMain(
	pipe(
		main,
		Effect.tapError(Console.log),
		Effect.retry({
			schedule: Schedule.spaced("10 seconds"),
		}),
	),
);
