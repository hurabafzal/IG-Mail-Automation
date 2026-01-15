import { BunRuntime } from "@effect/platform-bun";
import { updateOutdated } from "backend/src/mining/updateOutdatedAccounts";

BunRuntime.runMain(updateOutdated);
