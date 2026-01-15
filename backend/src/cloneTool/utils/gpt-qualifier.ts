import { Console, Effect, Schedule, pipe } from "effect";

import { BunRuntime } from "@effect/platform-bun";
import { db } from "backend/src/db";
import { env } from "backend/src/env";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { sendSlackMessageE } from "../../utils/slack";

const client = new OpenAI({
	apiKey: env.OPEN_AI_API_KEY,
});

const schema = z.object({
	language: z.object({
		value: z.string(),
		confidence: z.number(),
	}),
	gender: z.object({
		value: z.enum(["F", "M"]),
		confidence: z.number(),
	}),
});

const system_prompt = `you are an expert at analyzing instagram profiles. You will be given an instagram profile, and you must:
1. decipher what language it is with the language code (eg. DE for german, EN for english, FR for french, etc).
2. decipher what the gender of the owner is (F for female, M for male)
You must also state how confident you are with your prediction with a score from 1 to 5 (1 is a wild guess because not enough info, 3 is pretty sure, 5 is you are certain). 
Respond using the following json format:
{
    "language": {
        "value": string,
        "confidence": number,
    },
    "gender": {
        "value": "F" | "M",
        "confidence": number,
    }
}
`;

type Data = {
	username: string;
	bio: string;
	full_name: string;
};

async function ai_magic(data: Data) {
	const chatCompletion = await client.chat.completions.create({
		messages: [
			{
				role: "system",
				content: system_prompt,
			},
			{ role: "user", content: JSON.stringify(data) },
		],
		model: "gpt-4o-mini",
		temperature: 0.1,
		max_tokens: 200,
		response_format: zodResponseFormat(schema, "info"),
	});

	const res = JSON.parse(chatCompletion.choices[0].message.content ?? "");
	return schema.parse(res);
}

function getPendingAccounts() {
	return Effect.promise(() =>
		db
			.selectFrom("InstagramAccountBase")
			.select(["username", "ig_full_name as full_name", "bio", "id"])
			.where("bio", "is not", null)
			.where("bio", "!=", "")
			.where("posts_count", ">=", 5)
			.where("posts_count", "<=", 40)
			.where("followers_count", ">=", 50)
			.where("followers_count", "<=", 1000)
			.where("following_count", ">=", 50)
			.where("following_count", "<=", 1000)
			.where("bio_language", "=", "DE")
			.where("InstagramAccountBase.ai_bio_lang", "is", null)
			.where((eb) =>
				eb.or([
					eb("InstagramAccountBase.external_link", "is", null),
					eb("InstagramAccountBase.external_link", "=", ""),
				]),
			)
			.execute(),
	);
}

export function GptQualifierService() {
	return pipe(
		getPendingAccounts(),
		Effect.tap((c) =>
			Console.log(`[gpt qualifier] got ${c.length} pending accounts`),
		),
		Effect.andThen((xs) =>
			Effect.all(
				xs.map((x, i) =>
					pipe(
						Effect.tryPromise(() =>
							ai_magic({
								bio: x.bio,
								full_name: x.full_name,
								username: x.username,
							}),
						),
						Effect.tap((r) =>
							console.log(`[${i}/${xs.length}] got ai res: `, r),
						),
						Effect.andThen((r) =>
							Effect.tryPromise(() =>
								db
									.updateTable("InstagramAccountBase")
									.set({
										ai_bio_lang: r.language.value,
										ai_bio_lang_conf: r.language.confidence,
										gender: r.gender.value,
										gender_conf: r.gender.confidence,
									})
									.where("id", "=", x.id)
									.execute(),
							),
						),
					),
				),
				{ concurrency: 2 },
			),
		),
		Effect.catchAll((e) => sendSlackMessageE(`[gpt qualifier error] - ${e}`)),
		Effect.catchAllDefect((e) =>
			sendSlackMessageE(`[gpt qualifier defect] - ${e}`),
		),
		Effect.repeat({ schedule: Schedule.spaced("4 minute") }),
	);
}

// BunRuntime.runMain(
// 	pipe(
// 		GptQualifierService(),
// 		Effect.catchAll((e) => Console.log(e)),
// 		Effect.repeat({ schedule: Schedule.spaced("1 minute") }),
// 	),
// );
