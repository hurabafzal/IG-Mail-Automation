import { db } from "backend/src/db";
import {
	ACTIVE_COUNTRIES,
	DE_ACTIVE_COUNTRIES,
	EN_ACTIVE_COUNTRIES,
} from "backend/src/utils/consts";
import { daysAgo } from "backend/src/utils/daysAgo";
import { Console, Effect, Schedule, pipe } from "effect";
import { HikerAPI } from "../HikerAPI";

export async function getMissedPublicEmails() {
	const ids = await db
		.selectFrom("InstagramAccountBase")
		.select("InstagramAccountBase.id")
		.where((oc) =>
			oc.or([
				oc("country", "in", DE_ACTIVE_COUNTRIES),
				// oc.and([
				// 	oc("InstagramAccountBase.country", "in", EN_ACTIVE_COUNTRIES),
				// 	oc("bio_language", "=", "EN"),
				// ]),
			]),
		)
		.where("InstagramAccountBase.followers_count", ">", 7_000)
		.where("InstagramAccountBase.followers_count", "<", 100_000)
		.where("searched_for_email", "=", false)
		.where("ig_email", "is", null)
		.where("created_at", ">", daysAgo(120))
		.limit(3000)
		.execute();

	const n = ids.length;
	console.log(`Found ${n} accounts to process`);

	await Effect.runPromise(
		Effect.all(
			ids.map((x) => get_public_email(x.id)),
			{ concurrency: 10 },
		),
	);

	console.log("done");
}

export const getMissedPublicEmailsCron = pipe(
	Effect.tryPromise(getMissedPublicEmails),
	Effect.catchAll((e) => Console.error(e)),
	Effect.schedule(Schedule.cron("30 0 * * *")),
);

export function get_public_email(id: string) {
	return pipe(
		HikerAPI.user_by_id(id),
		Effect.tap((d) => {
			let email = d?.user?.public_email;
			email = email?.trim() === "" ? undefined : (email ?? undefined);
			if (email) {
				console.log("\x1b[32m%s\x1b[0m", `[email found] - ${id} - ${email}`);
			}
			void db
				.updateTable("InstagramAccountBase")
				.set({
					searched_for_email: true,
					ig_email: email,
				})
				.where("id", "=", id)
				.execute();
		}),
	);
}
