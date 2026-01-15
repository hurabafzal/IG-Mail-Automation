import { Cause, Effect } from "effect";
import { catchAllDefect, promise, retry } from "effect/Effect";
import { type Schedule, forever, spaced } from "effect/Schedule";
import { sendSlackMessage } from "./slack";

export function infinite_loop_effect<A, B, C>(
	name: string,
	e: Effect.Effect<A, B, C>,
	schedule?: Schedule<number>,
) {
	return retry(
		Effect.schedule(
			e.pipe(
				catchAllDefect((defect) => {
					if (Cause.isRuntimeException(defect)) {
						return promise(() =>
							sendSlackMessage(
								`[${name}] RuntimeException defect caught: ${defect.message}`,
							),
						);
					}
					console.error(defect);
					return Effect.sleep(60000);
				}),
			),
			schedule ?? forever,
		),
		spaced("10 seconds"),
	);
}
