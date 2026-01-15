import { BunRuntime } from "@effect/platform-bun";
import { CloneService } from "backend/src/cloneTool/clone.service";

console.log("Starting CloneService...");
console.log("This service will run:");
console.log("  - GPT Qualifier Service");
console.log("  - Fill Clone Tasks (every 4 minutes)");
console.log("  - Profile Pictures Handler (every 5 minutes)");
console.log("  - GPT Name Variations (every 5 minutes)");
console.log("");

BunRuntime.runMain(CloneService);

