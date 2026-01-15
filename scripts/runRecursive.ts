import { recursiveSearch } from "backend/src/mining/recursive-import";
import { Console, Effect, Schedule, pipe } from "effect";

await Effect.runPromise(
	pipe(
		recursiveSearch,
		Effect.catchAll(Console.log),
		Effect.repeat(Schedule.forever),
	),
);

console.log("done");
