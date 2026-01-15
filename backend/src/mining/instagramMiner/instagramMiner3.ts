import { sendSlackMessage } from "backend/src/utils/slack";
import { Effect } from "effect";
import { mineCloneAccounts } from "./mineCloneAccounts";

await Effect.runPromiseExit(mineCloneAccounts()).catch((e) => {
	console.error("error in instagram miner: ", e);
	void sendSlackMessage(`[fatal] error in instagram miner: ${e}`);
});
