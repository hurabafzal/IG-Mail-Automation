import { Console, Effect, Schedule, pipe } from "effect";
import { sql } from "kysely";
import { db } from ".";
import { sendSlackMessageE } from "../utils/slack";

export const refreshViews = Effect.all([
	Effect.tryPromise(() =>
		sql`REFRESH MATERIALIZED VIEW CONCURRENTLY total_daily_count;`.execute(db),
	),
	Effect.tryPromise(() =>
		sql`REFRESH MATERIALIZED VIEW CONCURRENTLY leads;`.execute(db),
	),
	Effect.tryPromise(() =>
		sql`REFRESH MATERIALIZED VIEW CONCURRENTLY target_daily_counts;`.execute(
			db,
		),
	),
	Effect.tryPromise(() =>
		sql`REFRESH MATERIALIZED VIEW CONCURRENTLY ig_history_leads;`.execute(db),
	),
]);

export const refreshViewsCron = pipe(
	refreshViews,
	Effect.schedule(Schedule.cron("*/20 * * * *")),
	Effect.catchAllDefect((e) =>
		sendSlackMessageE(`defect in frefresh views ${e}`),
	),
	Effect.catchAll(Console.error),
);
