import { Effect, Schedule } from "effect";
import { retry, tryPromise } from "effect/Effect";
import { exponential, recurs } from "effect/Schedule";
import { sql } from "kysely";
import { sendSlackMessage, sendSlackMessageE } from "../utils/slack";
import { db as db_ } from "./db";

export const raw_sql = sql;

export const db = db_;

// this is a function that takes in a promise, tries it, if it fails
// send the error to slack, then throw
// this is wrapped by a fib retry effect
interface DBRetryEffectOptions {
	name: string;
	msg?: string;
}
export function db_retry_effect<T>(
	{ name, msg }: DBRetryEffectOptions,
	transaction: () => Promise<T>,
) {
	return retry(
		tryPromise(async () => {
			try {
				return await transaction();
			} catch (e) {
				if (e instanceof Error) {
					console.error(e);
					if (e.message.includes("deadlock detected")) {
						// no need to send to slack, we know it's a deadlock
						throw e;
					}
					void sendSlackMessage(`[${name}] ${msg}: ${e.message}`);
				} else {
					void sendSlackMessage(`[${name}] ${msg}: Unknown DB Error!`);
				}
				throw e;
			}
		}),
		Schedule.intersect(exponential("200 millis"), recurs(6)),
	).pipe(
		Effect.tapError((e) =>
			sendSlackMessageE(`[${name}] FATAL DB ERROR: ${e.message}`),
		),
		Effect.orDie,
	);
}
