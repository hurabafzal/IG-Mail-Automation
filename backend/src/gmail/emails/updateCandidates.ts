// the best strat is actually listing all people, then searching database for account history for username to get the ig_id.
// then with ig_id it's easy to get everything else.

import { BunRuntime } from "@effect/platform-bun";
import { pipedriveLIVE } from "backend/src/pipedrive";
import { CandidatePipedrive } from "backend/src/pipedrive/objects/candidate";
import { PersonPipedrive } from "backend/src/pipedrive/objects/person";
import { Console, Effect, pipe } from "effect";
import { getCandidateInfoFromUsername } from "./getCandidate";

class CandidateNotFoundError {
	readonly _tag = "CandidateNotFoundError";
}

const getCandidate = (username: string) =>
	pipe(
		Effect.tryPromise(() => getCandidateInfoFromUsername(username)),
		Effect.flatMap(({ emailVars, x, not_found }) => {
			if (not_found) return Effect.fail(new CandidateNotFoundError());

			return Effect.succeed({
				deal: {
					daily_budget: emailVars?.dailyBudget ?? undefined,
					follower_growth: emailVars?.followerGain ?? undefined,
					story_growth: emailVars?.storyGain ?? undefined,
				},
				person: {
					account_creation: x?.account_created_at ?? undefined,
					hiddenLikes:
						x?.hiddenLikes === true
							? ("yes" as const)
							: x?.hiddenLikes === false
								? ("no" as const)
								: undefined,
				},
			});
		}),
	);

const program = pipe(
	PersonPipedrive.getAll(),
	Effect.tap(Console.log("got persons!")),
	Effect.flatMap((x) =>
		Effect.all(
			x.map((person, i) =>
				pipe(
					getCandidate(person.username),
					Effect.tap((c) =>
						console.log(
							`[${i}/${x.length}] candidate for `,
							person.username,
							"is",
							c,
						),
					),
					Effect.flatMap((c) => CandidatePipedrive.update(person.id, c)),
					Effect.catchTag("CandidateNotFoundError", () => Effect.void),
				),
			),
			{ concurrency: 4 },
		),
	),
	Effect.provide(pipedriveLIVE),
	Effect.scoped,
);

BunRuntime.runMain(program);
