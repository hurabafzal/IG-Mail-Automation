import { sendSlackMessage } from "backend/src/utils/slack";
import { Effect } from "effect";
import { mineNewAccounts } from "./mineNewAccounts";

await Effect.runPromiseExit(mineNewAccounts()).catch((e) => {
	console.error("error in instagram miner: ", e);
	void sendSlackMessage(`[fatal] error in instagram miner: ${e}`);
});
