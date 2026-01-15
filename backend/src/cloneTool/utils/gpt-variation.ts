import { db } from "backend/src/db";
import { env } from "backend/src/env";
import { Console, Effect, pipe } from "effect";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { randomNameVariation } from "./random-variation";

const client = new OpenAI({
	apiKey: env.OPEN_AI_API_KEY,
});

// Define schema for multiple variations
const schema = z.object({
	variation: z.object({
		new_username: z.string(),
		new_name: z.string(),
		new_bio: z.string(),
	}),
});

const system_prompt = `You are a username variation generator who responds in JSON. 
1. Follow the schema {"new_username": string, "new_name": string, "new_bio": string} 
2. Usernames must be [a-zA-Z0-9_.] and should be creative and unique - something that hasn't been taken already
3. maintain the same gender and style as the original name and username.
4. Generate a bio variation that maintains the same style, language and themes as the original bio.`;

type PairData = {
	username: string;
	name: string;
	id: number;
	bio: string;
};

export async function getNewPair(og_pair: PairData) {
	const taken_usernames = await db
		.selectFrom("UsersToClone")
		.select("alt_username")
		.where("alt_username", "is not", null)
		.where("UsersToClone.og_username", "=", og_pair.username)
		.execute()
		.then((x) => x.map((y) => y.alt_username));
	console.log(taken_usernames);
	const max_attempts = 5;
	let attempts = 0;
	let newBio = og_pair.bio;
	while (true) {
		console.log(
			`[gpt name variation] attempt ${attempts + 1} for ${og_pair.username}`,
		);
		if (attempts > max_attempts) {
			console.log(
				`[gpt name variation] max attempts reached, using randomNameVariation for ${og_pair.username}`,
			);

			const newUsername = randomNameVariation(og_pair.username);
			const newName = og_pair.name;

			console.log(`[random name variation] generated username: ${newUsername}`);

			try {
				await db
					.updateTable("UsersToClone")
					.set({
						name_attempts: 1,
						alt_username: newUsername,
						alt_full_name: newName,
						alt_bio: newBio,
					})
					.where("UsersToClone.id", "=", og_pair.id)
					.execute();

				return {
					variation: {
						new_username: newUsername,
						new_name: newName,
						new_bio: newBio,
					},
				};
			} catch (e) {
				console.error(`[random name variation] failed to save: ${e}`);
				attempts++;
				taken_usernames.push(newUsername);
				continue;
			}
		}
		const taken_username_msg = `Note: the following usernames are already taken, do NOT use them:${taken_usernames.join(
			", ",
		)}\n`;
		const chatCompletion = await client.beta.chat.completions.parse({
			messages: [
				{
					role: "system",
					content: system_prompt,
				},
				{
					role: "user",
					content: `{"username": "gigi_turtle", "name": "Gianna 🐢", "bio": "turtle lover 🐢 | coffee addict ☕ | NYC"}`,
				},
				{
					role: "assistant",
					content: `{"new_username": "jiji_turtle", "new_name": "Julia 🐢", "new_bio": "obsessed with turtles 🐢 | can't live without coffee ☕ | New York City"}`,
				},
				{
					role: "user",
					content: `${
						taken_usernames.length > 0 ? taken_username_msg : ""
					}{"username": "${og_pair.username}", "name": "${
						og_pair.name
					}", "bio": "${og_pair.bio}"}`,
				},
			],
			model: "gpt-4o-mini",
			response_format: zodResponseFormat(schema, "names"),
		});

		const res = chatCompletion.choices[0].message.parsed;
		console.log(res);
		newBio = res?.variation.new_bio ?? og_pair.bio;
		try {
			if (!res) {
				console.error("No response from gpt");
				attempts++;
				continue;
			}
			await db
				.updateTable("UsersToClone")
				.set({
					name_attempts: 1,
					alt_username: res.variation.new_username,
					alt_full_name: res.variation.new_name,
					alt_bio: res.variation.new_bio,
				})
				.where("UsersToClone.id", "=", og_pair.id)
				.execute();
			return res;
		} catch (e) {
			console.error(e);
			attempts++;
			taken_usernames.push(res?.variation.new_username ?? "");
		}

		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

export function getGptNameVariations() {
	return pipe(
		Effect.tryPromise(() =>
			db
				.selectFrom("UsersToClone")
				.innerJoin(
					"InstagramAccountBase",
					"UsersToClone.ig_id",
					"InstagramAccountBase.id",
				)
				.select([
					"UsersToClone.og_username",
					"UsersToClone.og_full_name",
					"InstagramAccountBase.bio",
					"UsersToClone.id",
				])
				.where("UsersToClone.name_attempts", "=", 0)
				.execute(),
		),
		Effect.tap((x) =>
			Console.log(`[gpt name variation] got ${x.length} accounts`),
		),
		Effect.andThen((xs) =>
			Effect.all(
				xs.map((x, i) =>
					pipe(
						Effect.tryPromise(() =>
							getNewPair({
								username: x.og_username,
								name: x.og_full_name,
								id: x.id,
								bio: x.bio,
							}),
						),
						Effect.tap(
							Console.log(`[${i + 1}/${xs.length}] got gpt name variation`),
						),
					),
				),
				{ concurrency: 2 },
			),
		),
	);
}
