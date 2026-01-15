import { Schema as S } from "@effect/schema";
import {
	ACTIVE_COUNTRIES,
	EN_ACTIVE_COUNTRIES,
} from "backend/src/utils/consts";
import { Console, Effect, Schedule, pipe } from "effect";
import { db } from "../../db";
import { Runpod } from "./runpod";

const BASE_URL = "https://r6f3zb661kcdh4-8400.proxy.runpod.net/";
const CAT_ENDPOINT = `${BASE_URL}/get-cat2`;
const API_KEY = "F2brbRYY2rvfxteF3007OzzJCtul5hTIVhUpnaESHWQ=";

const CatSchema = S.Array(
	S.Tuple(
		S.Literal(
			"Arts",
			"Beauty",
			"Business",
			"Causes",
			"Cinema & Acting",
			"Culture",
			"DIY",
			"Dance",
			"Family",
			"Fashion",
			"Fitness & Wellness",
			"Food",
			"Home & Decor",
			"Humor",
			"Lifestyle",
			"Media",
			"Medicine",
			"Nutrition",
			"Music",
			"Nature",
			"Pets & Animals",
			"Spirituality & Mindfulness",
			"Sport",
			"Tech & Science",
			"Travel",
		),
		S.Number,
	),
);

const accounts = Effect.promise(() =>
	db
		.selectFrom("InstagramAccountBase")
		.select([
			"InstagramAccountBase.bio",
			"ig_email as email",
			"InstagramAccountBase.username",
			"InstagramAccountBase.id as user_id",
			"InstagramAccountBase.ig_full_name as full_name",
			"InstagramAccountBase.country",
		])
		.where("niche", "is", null)
		// .where("first_name", "is not", null)
		.where("followers_count", ">", 7_000)
		.where("followers_count", "<", 100_000)
		.where((oc) =>
			oc.or([
				oc("country", "in", ACTIVE_COUNTRIES),
				oc.and([
					oc("InstagramAccountBase.country", "in", EN_ACTIVE_COUNTRIES),
					oc("bio_language", "=", "EN"),
				]),
			]),
		)
		// .where(sql`"triggerBitmap" & ${1 << BitmapTrigger.Opener}`, "=", 0)
		.orderBy("created_at", "desc")
		.execute(),
);

const posts = (id: string) =>
	Effect.tryPromise(() =>
		db
			.selectFrom("InstagramPost")
			.select("caption")
			.where("user_id", "=", id)
			.orderBy("taken_at", "desc")
			.limit(5)
			.execute(),
	).pipe(Effect.retry({ times: 3, schedule: Schedule.spaced(1000 * 10) }));
class NotEnoughData {
	readonly _tag = "NotEnoughData";
}
export const main = pipe(
	accounts,
	Effect.tap((a) => Console.log(`there are ${a.length} accounts pending!`)),
	Effect.andThen((a) =>
		a.length < 300 ? Effect.fail(new NotEnoughData()) : Effect.void,
	),
	Effect.andThen(Runpod.resource("r6f3zb661kcdh4")),
	// keep trying to ping BASE_URL, until result is "{"detail":"Not Found"}"
	Effect.flatMap(() =>
		Effect.iterate(
			{ i: 0, text: "" }, // Initial result
			{
				while: ({ text }) => text !== '{"detail":"Not Found"}', // Condition to continue iterating
				body: ({ i }) =>
					pipe(
						Effect.promise(async () => {
							console.log(`connection attempt ${i}`);
							return {
								i: i + 1,
								text: await fetch(BASE_URL).then((x) => x.text()),
							};
						}),
						Effect.tap(Effect.sleep(2000)),
					),
			},
		),
	),
	Effect.tap(Console.log("connected!")),
	Effect.timeout(1000 * 60 * 2),

	Effect.andThen(accounts),
	Effect.flatMap((r) =>
		Effect.all(
			r.map((account, i) =>
				pipe(
					posts(account.user_id),
					Effect.flatMap((p) =>
						Effect.promise(async () => {
							console.log(`Processing account ${i + 1}/${r.length}`);
							await getCat(
								account,
								p.map((x) => x.caption),
							);
						}),
					),
				),
			),
			{ concurrency: 5 },
		),
	),
	Effect.scoped,
);

interface Account {
	username: string;
	full_name: string;
	bio: string;
	email: string | null;
	country: string | null;
	user_id: string;
}

const system_prompt = `Username: {{username}}
Name: {{full_name}}
Biografie: {{bio}}
E-Mail: {{email}}
instagram post captions: {{cap}}`;

async function getCat(account: Account, captions: string[]) {
	const prompt = system_prompt
		.replace("{{username}}", account.username)
		.replace("{{full_name}}", account.full_name)
		.replace("{{bio}}", account.bio)
		.replace("{{email}}", account.email ?? "no email found")
		.replace("{{country}}", account.country ?? "no country found")
		.replace("{{cap}}", captions.join("\n"));

	const myHeaders = new Headers();
	myHeaders.append("Content-Type", "application/json");
	myHeaders.append("X-API-Key", API_KEY);
	const requestOptions = {
		method: "POST",
		headers: myHeaders,
		body: JSON.stringify({
			query: prompt,
		}),
		redirect: "follow",
	} as const;

	const res = await fetch(CAT_ENDPOINT, requestOptions).then((response) =>
		response.json(),
	);
	try {
		const cat = S.decodeUnknownSync(CatSchema)(res);
		await db
			.updateTable("InstagramAccountBase")
			.set({
				niche: cat[0][0],
			})
			.where("InstagramAccountBase.id", "=", account.user_id)
			.execute();
	} catch {
		console.log(res);
	}
}

export const CatCron = pipe(
	main,
	Effect.catchAll((e) => Console.error(e)),
	Effect.schedule(Schedule.cron("0 */6 * * *")),
);
