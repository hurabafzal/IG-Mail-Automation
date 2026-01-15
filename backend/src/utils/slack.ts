import { promise, retry, runPromise, tryPromise } from "effect/Effect";
import { fibonacci } from "effect/Schedule";
import { env } from "../env";

export const sendSlackMessage = (message: string) =>
	runPromise(sendSlackMessageE(message));

export const sendSlackMessageE = (message: string, user?: "nils" | "me") =>
	retry(
		tryPromise(async () => {
			console.log("check");
			// await fetch(user === "nils" ? env.NILS_SLACK_URL : env.ME_SLACK_URL, {
			// 	method: "POST",
			// 	body: JSON.stringify({ text: message }),
			// });
			// console.log("Slack message sent");
		}),
		fibonacci("10 millis"),
	);
