import { expect, test } from "bun:test";
import { Effect, pipe } from "effect";
import { browser_mine_web_profiles } from "./mineWebProfiles";

test.skip(
	"web profile",
	async () => {
		const usernames = ["nike", "therock", "potasticpanda"];
		const program = pipe(browser_mine_web_profiles(usernames));
		const res = await Effect.runPromise(program);
		expect(res).toBeArrayOfSize(3);
		console.log(res);
	},
	{
		timeout: 60_000,
	},
);

test(
	"web missing page",
	async () => {
		const usernames = [
			"nikegp9auweh",
			"therochauoweg",
			"potasticpandaauhowegi",
		];
		const program = pipe(browser_mine_web_profiles(usernames));
		const res = await Effect.runPromise(program);
		expect(res).toBeArrayOfSize(3);
		expect(res.map((x) => !x.success && x.error === "missing")).toEqual(
			usernames.map(() => true),
		);
		console.log(res);
	},
	{
		timeout: 60_000,
	},
);
