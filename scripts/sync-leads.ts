import { Effect } from "effect";
import { instantlyLeadStatsSync } from "../backend/src/triggers/sync-stats.cron";

await Effect.runPromise(instantlyLeadStatsSync);
