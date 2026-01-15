import { refreshInstagramAccountsCron } from "backend/src/triggers/refresh-instagram-accounts";
import { sendSlackMessage } from "backend/src/utils/slack";
import { Effect } from "effect";

// if (env.NODE_ENV === "production") {
await Effect.runPromiseExit(refreshInstagramAccountsCron(200)).catch((e) => {
	console.error("error in instagram miner: ", e);
	void sendSlackMessage(`[fatal] error in instagram miner: ${e}`);
});
// }
