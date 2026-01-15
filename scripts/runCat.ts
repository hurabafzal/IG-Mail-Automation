import { Console, Effect, Schedule, pipe } from "effect";
import { main } from "../backend/src/mining/ML/cat";

await Effect.runPromise(
	pipe(
		main,
		Effect.tapError(Console.log),
		Effect.retry({
			schedule: Schedule.spaced("10 seconds"),
		}),
	),
);
