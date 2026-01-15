import { BunRuntime } from "@effect/platform-bun";
import { findMissingCountries } from "backend/src/mining/instagramMiner/findMissingCountires";

BunRuntime.runMain(findMissingCountries);
