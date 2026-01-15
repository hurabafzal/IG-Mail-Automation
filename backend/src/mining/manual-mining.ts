import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Schedule } from "effect";
import { pipe } from "effect";
import { db } from "../db";
import { sendSlackMessageE } from "../utils/slack";
import { HikerAPI } from "./HikerAPI";
import { InstagramDB } from "./InstagramDB";

const body = (
	account: { username: string; batch_id: string },
	i: number,
	total: number,
) =>
	Effect.gen(function* () {
		const res = yield* HikerAPI.web_profile_req(account.username);
		if (!res) {
			Console.error(`error in manual mining for ${account.username}`);
			return yield* Effect.sleep(1000 * 60 * 10);
		}
		const insert =
			"not_found" in res
				? { not_found: true, minedAt: new Date() }
				: {
						private: res?.is_private,
						account_id: res?.id,
						followers_count: res?.edge_followed_by.count,
						following_count: res?.edge_follow.count,
						posts_count: res?.edge_owner_to_timeline_media.count,
						full_name: res?.full_name,
						bio: res?.biography,
						minedAt: new Date(),
					};
		console.log(`[${i}/${total}] ${account.username} - `, insert);

		const result = yield* Effect.tryPromise(() =>
			db
				.updateTable("ManualMiningQueue")
				.set(insert)
				.where("username", "=", account.username)
				.where("batch_id", "=", account.batch_id)
				.executeTakeFirst(),
		);
		if (!result) {
			Console.error(`[manual mining] account ${account.username} not found`);
		}
	});

const program = Effect.gen(function* () {
	const batches = yield* InstagramDB.getManualAccountBatches;
	console.log(batches.length, "batches to process");
	yield* Effect.forEach(
		batches,
		(account, i) => body(account, i, batches.length),
		{
			concurrency: 2, //update concurrency 2 instead of 15
		},
	);
});

export const ManualMiningService = pipe(
	program,
	Effect.catchAll((e) =>
		sendSlackMessageE(`[manual mining] error: ${e.message}`),
	),
	Effect.repeat(Schedule.spaced("1 minute")),
);
