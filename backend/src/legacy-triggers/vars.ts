import { Console, Effect, Schedule } from "effect";
import { db } from "../db";
import { env } from "../env";
import { deepDiff, deepEqual } from "../utils/object";
import type { Lead } from "./sync-stats.cron";

class AccountDetailsNotFound {
	readonly _tag = "AccountDetailsNotFound";
	message: string;
	constructor(ig_id: string) {
		this.message = `Account details not found for ${ig_id}`;
	}
}

/**
 * 🔍 Fetches the latest variables for an Instagram account
 * @param ig_id - ID of the Instagram account to fetch variables for
 * @returns Effect containing the account details and variables
 */
export function getInstantlyVariables(ig_id: string) {
	return Effect.gen(function* () {
		const accountDetails = yield* db
			.selectFrom("InstagramAccountBase")
			.selectAll()
			.where("id", "=", ig_id)
			.executeTakeFirstE();

		if (!accountDetails) {
			return yield* Effect.fail(new AccountDetailsNotFound(ig_id));
		}

		const num = accountDetails.followers_count;
		const roundedFollowers = Math.ceil(num / 1000) * 1000;
		const downRound = Math.min(num - (num % 10_000), 100_000);

		const emailVars = yield* db
			.selectFrom("EmailVariables")
			.selectAll()
			.where("minFollowerCount", "=", downRound * 10)
			.executeE();

		return {
			username: accountDetails.username,
			"first name": accountDetails.first_name ?? "",
			"follower rounded": roundedFollowers.toString(),
			niche: accountDetails.niche ?? "",
			budget: emailVars.find((v) => v.name === "Daily Budget")?.value ?? "",
			"follower growth":
				emailVars.find((v) => v.name === "Follower Gain")?.value ?? "",
			"story views growth":
				emailVars.find((v) => v.name === "Story View Gain")?.value ?? "",
		};
	});
}

/**
 * 🔄 Updates the custom variables for a lead in Instantly
 *
 * This function fetches the latest variables for an Instagram account,
 * merges them with the existing lead payload, and updates the lead
 * in Instantly if there are any changes.
 *
 * @param lead - The lead object containing current payload
 * @param igid - The Instagram account ID to fetch variables for
 * @returns Effect representing the update operation
 */
export function updateInstantlyVariables(lead: Lead, igid: string) {
	return Effect.gen(function* () {
		// 📥 Fetch latest variables for the Instagram account
		const vars = yield* getInstantlyVariables(igid);

		// 🔄 Merge existing payload with new variables
		const updatedPayload = {
			...lead.payload,
			...vars,
		};

		// 🔍 Check if payload has changed
		if (!deepEqual(updatedPayload, lead.payload)) {
			console.log(
				"updating instantly variables for",
				igid,
				"diff:",
				deepDiff(updatedPayload, lead.payload),
			);
			// 📤 Update lead in Instantly if changes detected
			const res = yield* Effect.tryPromise(() =>
				fetch(`https://api.instantly.ai/api/v2/leads/${lead.id}`, {
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${env.INSTANTLY_KEY}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						custom_variables: updatedPayload,
					}),
				}),
			).pipe(
				Effect.retry({
					times: 3,
					schedule: Schedule.exponential("1 minute"),
				}),
			);
			if (res.status !== 200) {
				console.log("update lead response", res.status);
				const text = yield* Effect.tryPromise(() => res.text());
				console.log(text);
			}
		}
	}).pipe(
		Effect.catchTag("AccountDetailsNotFound", (e) => Console.error(e.message)),
	);
}
