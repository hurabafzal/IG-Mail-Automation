import { db } from "backend/src/db";
import { Runpod } from "backend/src/mining/ML/runpod";
import { ACTIVE_COUNTRIES } from "backend/src/utils/consts";
import { Console, Effect, Schedule, pipe } from "effect";
import OpenAI from "openai";
import { z } from "zod";

const POD_ID = "mr1xod1dna8dag";

const client = new OpenAI({
	apiKey: "F2brbRYY2rvfxteF3007OzzJCtul5hTIVhUpnaESHWQ=", // Your API key
	baseURL: `https://${POD_ID}-8000.proxy.runpod.net/v1`,
});

const instruction = `You will be given info about an instagram profile, 
and you must provide either a first name if the account belongs to a creator or a business name if the account belongs to a business.
respond in the following format. use only ascii characters:
{
	"type": "creator" | "business",
    "first_name": string | null
    "business_name": string | null
}

Here is the data:`;

const data = await db
	.selectFrom("InstagramAccountBase")
	.select([
		"id",
		"username",
		"ig_full_name",
		"bio",
		"ig_email",
		"ig_category_enum",
		"niche",
	])
	// .where("business_name", "is not", null)
	.where("first_name", "is", null)
	.where("business_name", "is", null)
	.where("followers_count", ">", 7_000)
	.where("followers_count", "<", 100_000)
	.where((oc) =>
		oc.or([
			oc("country", "in", ACTIVE_COUNTRIES),
			// oc.and([
			// 	oc("InstagramAccountBase.country", "in", EN_ACTIVE_COUNTRIES),
			// 	oc("bio_language", "=", "EN"),
			// ]),
		]),
	)
	.where("approved", "=", "PENDING")
	.where("first_name_checked_at", "is", null)
	// prio newer accounts
	.orderBy("created_at", "desc")
	.execute();
console.log(data.length);

const outputSchema = z.object({
	first_name: z.string().nullable(),
	business_name: z.string().nullable(),
});

async function getCompletion(prompt: string) {
	const response = await client.chat.completions.create({
		model: "Youcef/name-balanced", // Model identifier
		messages: [
			{
				role: "user",
				content: prompt,
			},
		],
		max_tokens: 200,
		temperature: 0.0,
		stop: ["<|end|>"],
		response_format: { type: "json_object" },
	});

	console.log("Response:", response.choices[0].message.content);
	return response.choices[0].message.content?.trim();
}

let not_business_count = 0;
export const main = pipe(
	Effect.succeed(data),
	Effect.tap((a) => Console.log(`there are ${a.length} accounts pending!`)),
	Effect.andThen(Runpod.resource(POD_ID)),
	// Wait for endpoint to be ready
	Effect.flatMap(() =>
		Effect.iterate(
			{ i: 0, text: "" },
			{
				while: ({ text }) => text !== '{"detail":"Not Found"}',
				body: ({ i }) =>
					pipe(
						Effect.promise(async () => {
							console.log(`connection attempt ${i}`);
							return {
								i: i + 1,
								text: await fetch(
									`https://${POD_ID}-8000.proxy.runpod.net`,
								).then((x) => x.text()),
							};
						}),
						Effect.tap(Effect.sleep(2000)),
					),
			},
		),
	),
	Effect.tap(() => Console.log("connected!")),
	Effect.timeout(1000 * 60 * 5),
	// Continue with existing processing
	Effect.flatMap(() =>
		Effect.all(
			data.map((item, i) =>
				pipe(
					Effect.sync(() => {
						const question = JSON.stringify({
							username: item.username,
							ig_full_name: item.ig_full_name,
							bio: item.bio,
							email: item.ig_email,
							category_enum: item.ig_category_enum,
							niche: item.niche,
						});

						return `${instruction}\n${question}`;
					}),
					Effect.andThen((prompt) =>
						Effect.tryPromise(() => getCompletion(prompt)),
					),
					Effect.map((response) => {
						try {
							return outputSchema.parse(JSON.parse(response ?? "{}"));
						} catch (e) {
							console.log(`[${i}] "${response}"`);
							throw e;
						}
					}),
					Effect.tap((response) => {
						if (
							response.first_name !== null &&
							response.business_name === null
						) {
							not_business_count++;
							console.log(
								`!!!! got ${response.first_name} for ${item.username} !!!`,
							);
						}
						return Effect.tryPromise(() =>
							db
								.updateTable("InstagramAccountBase")
								.set({
									first_name: response.first_name,
									business_name: response.business_name,
									// approve_counter: 0,
									first_name_checked_at: new Date(),
								})
								.where("id", "=", item.id)
								.execute(),
						).pipe(
							Effect.retry({ times: 10, schedule: Schedule.spaced(1000 * 3) }),
						);
					}),
					Effect.tap(() =>
						Console.log(`[${i}] Not business count: ${not_business_count}`),
					),
					Effect.catchAll((e) => {
						console.log(`[${i}] Error: ${e}`);
						return Effect.succeed(null);
					}),
					Effect.catchAllDefect((e) => {
						console.log(`[${i}] Error: ${e}`);
						return Effect.succeed(null);
					}),
				),
			),
			{ concurrency: 8 },
		),
	),
	Effect.scoped,
	Effect.retry({ times: 3, schedule: Schedule.spaced(1000 * 10) }),
);

export const PhiCron = pipe(
	main,
	Effect.catchAll((e) => Console.error(e)),
	Effect.schedule(Schedule.cron("0 */6 * * *")),
);
