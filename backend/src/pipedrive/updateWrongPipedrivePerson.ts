import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Schedule, pipe } from "effect";
import { pipedriveLIVE } from ".";
import { db } from "../db";
import { blacklistEmails } from "../gmail/emails/blacklist";
import { getXYFromID } from "../gmail/emails/getCandidate";
import { COUNTRY_GROUPS } from "../utils/consts";
import { PersonPipedrive } from "./objects/person";

// Helper function to build the lookup map
async function buildInstagramLookup(
	people: { username: string; email: string | null; id: number }[],
) {
	const usernames = people.map((p) => p.username).filter(Boolean);
	const emails = people.map((p) => p.email).filter(Boolean);

	console.log(
		`Fetching data for ${usernames.length} usernames and ${emails.length} emails...`,
	);
	const start = performance.now();

	const results = await db
		.selectFrom("InstagramAccountBase")
		.leftJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
		.select([
			"InstagramAccountBase.id",
			"InstagramAccountBase.username as base_username",
			"Email.email",
		])
		.leftJoin(
			"UsernameHistory",
			"UsernameHistory.user_id",
			"InstagramAccountBase.id",
		)
		.leftJoin(
			"InitialInstagramAccount",
			"InitialInstagramAccount.username",
			"InstagramAccountBase.username",
		)
		.where((oc) =>
			oc.and([
				oc.or([
					oc("Email.instagram_id", "<>", "25025320"),
					oc("Email.instagram_id", "is", null),
				]),
				oc.or([
					oc("InstagramAccountBase.username", "in", usernames),
					oc("UsernameHistory.username", "in", usernames),
					oc("InitialInstagramAccount.username", "in", usernames),
					oc("Email.email", "in", emails),
				]),
			]),
		)
		.execute();

	const end = performance.now();
	console.log(`Query took ${end - start}ms`);

	// Build lookup maps
	const lookupMap = new Map<string, string>();
	for (const result of results) {
		if (result.base_username) {
			lookupMap.set(result.base_username.toLowerCase(), result.id);
		}
		if (result.email) {
			lookupMap.set(result.email.toLowerCase(), result.id);
		}
	}

	return lookupMap;
}

const program = pipe(
	// get all persons
	PersonPipedrive.getAll(),
	Effect.tap((people) =>
		blacklistEmails(people.map((p) => p.email).filter((e) => e !== null)),
	),
	// get all candidates and process them
	Effect.flatMap((people) =>
		pipe(
			Effect.tryPromise(() => buildInstagramLookup(people)),
			Effect.tap((x) => Console.log(`got ${x.size} lookup map`)),
			Effect.flatMap((lookupMap) =>
				Effect.all(
					people.map((x, i) =>
						pipe(
							Effect.sleep(Math.floor(Math.random() * 1000) + 500),
							Effect.map(() => {
								let igId = undefined;
								if (x.username) {
									igId = lookupMap.get(x.username.toLowerCase());
									console.log(`got igId for ${x.username}: ${igId}`);
								}
								if (!igId && x.email) {
									igId = lookupMap.get(x.email.toLowerCase());
									console.log(`got igId for ${x.email}: ${igId}`);
								}
								return {
									id: igId,
									person_id: x.id,
									importDate: x.add_time,
								};
							}),
							Effect.flatMap(({ id, person_id, importDate }) =>
								id && person_id
									? processID(id, person_id, importDate)
									: Effect.succeed(null),
							),
							Effect.tap(() =>
								Console.log(
									`[${i}/${people.length}] done updating person ${x.username}`,
								),
							),
						),
					),
					{ concurrency: 3 },
				),
			),
			Effect.map((results) => results.filter(Boolean)),
			Effect.tap((results) =>
				Console.log(`got ${results.length} instagram ids`),
			),
		),
	),
	Effect.provide(pipedriveLIVE),
	Effect.catchTag("UnknownException", (e) => {
		console.error(e.error);
		return Effect.void;
	}),
);

function processID(igid: string, person_id: number, importDate: Date) {
	console.log(`[${igid}] processing ${person_id}`);
	return pipe(
		Effect.tryPromise(() => getXYFromID(igid, importDate)),
		Effect.retry({ times: 10, schedule: Schedule.spaced(10_000) }),
		Effect.map(({ x, sequence_title }) => {
			let language: string | undefined = undefined;
			const languages = COUNTRY_GROUPS.map((c) => c.id);
			for (const lang of languages) {
				if (sequence_title?.includes(` ${lang}`)) {
					language = lang;
					break;
				}
			}
			if (language === undefined) {
				language =
					COUNTRY_GROUPS.find((c) => c.countries.includes(x?.country ?? ""))
						?.id ?? "EN";
			}

			return {
				igid,
				// country:
				// 	x?.country === "GERMAN_CAPTIONS" && x.real_country
				// 		? x.real_country
				// 		: x?.country ?? undefined,
				person_id,
				sequence_title,
				lang: language,
				// firstNameCustom: x?.first_name ?? undefined,
			};
		}),

		Effect.tap(Console.log),

		Effect.tap((r) =>
			PersonPipedrive.update(person_id, {
				language: r.lang,
				lastEmailSequence: r.sequence_title ?? "",
			}),
		),

		Effect.catchTag("ResponseError", (e) => {
			console.error(e.message);
			return Effect.fail(e);
		}),
	);
}

// TODO: as a second step, I need to set all persons in the pipedrive EN pipeline to english

BunRuntime.runMain(program);
