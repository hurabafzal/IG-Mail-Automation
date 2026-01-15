import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Schedule, pipe } from "effect";
import { pipedriveLIVE } from ".";
import { db } from "../db";
import { getXYFromID } from "../gmail/emails/getCandidate";
import { COUNTRY_GROUPS } from "../utils/consts";
import { DealPipedrive } from "./objects/deal";
import { PersonPipedrive } from "./objects/person";

const program = pipe(
	// get all persons
	Effect.all(
		{
			deals: DealPipedrive.getAll(),
			people: PersonPipedrive.getAll(),
		},
		{ concurrency: 2 },
	),
	// get all candidates
	Effect.andThen(({ deals, people }) =>
		Effect.all(
			// TODO: get ids from username
			people.map((x, i) =>
				pipe(
					Effect.sleep(Math.floor(Math.random() * 1000) + 500),
					Effect.andThen(() =>
						Effect.tryPromise(() =>
							db
								.selectFrom("InstagramAccountBase")
								.select("InstagramAccountBase.id")
								.leftJoin(
									"Email",
									"Email.instagram_id",
									"InstagramAccountBase.id",
								)
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
											//
											oc("InstagramAccountBase.username", "=", x.username),
											oc("UsernameHistory.username", "=", x.username),
											oc("InitialInstagramAccount.username", "=", x.username),
											oc("Email.email", "=", x.email),
										]),
									]),
								)
								.executeTakeFirst()
								.then((l) => ({
									id: l?.id,
									person_id: x.id,
								})),
						),
					),
					Effect.retry({ times: 10, schedule: Schedule.spaced(10_000) }),

					Effect.andThen((x) => {
						const deal_ids = deals.data
							.filter((d) => d.person_id?.value === x.person_id)
							.map((d) => d.id);

						return { ...x, deal_ids };
					}),

					Effect.andThen(({ id, person_id, deal_ids }) =>
						id && person_id
							? processID(id, person_id, deal_ids)
							: Effect.succeed(null),
					),

					Effect.tap(
						Console.log(
							`[${i}/${people.length}] done updating person ${x.username}`,
						),
					),
				),
			),

			{ concurrency: 3 },
		),
	),
	Effect.tap((x) => Console.log(`got ${x.length} instagram ids`)),

	Effect.provide(pipedriveLIVE),

	Effect.catchTag("UnknownException", (e) => {
		console.error(e.error);
		return Effect.void;
	}),
);

function processID(igid: string, person_id: number, deal_ids: number[]) {
	console.log(
		`[${igid}] processing ${person_id} with ${deal_ids.length} deals`,
	);
	return pipe(
		Effect.tryPromise(() => getXYFromID(igid)),
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
				id: igid,
				country:
					x?.country === "GERMAN_CAPTIONS" && x.real_country
						? x.real_country
						: (x?.country ?? undefined),
				person_id,
				sequence_title,
				lang: language,
				firstNameCustom: x?.first_name ?? undefined,
			};
		}),

		Effect.tap(Console.log),

		// Effect.andThen((r) =>
		// 	r.firstNameCustom
		// 		? PersonPipedrive.update(person_id, {
		// 				// country: r.country,
		// 				// language: r.lang,
		// 				firstNameCustom: r.firstNameCustom,
		// 				// lastEmailSequence: r.sequence_title,
		// 			})
		// 		: Effect.void,
		// ),
		Effect.andThen((r) =>
			r.firstNameCustom
				? Effect.all(
						deal_ids.map((deal_id) =>
							DealPipedrive.update(deal_id, {
								first_name: r.firstNameCustom,
							}),
						),
					)
				: Effect.void,
		),

		Effect.catchTag("ResponseError", (e) => {
			console.error(e.message);
			return Effect.fail(e);
		}),
	);
}

// TODO: as a second step, I need to set all persons in the pipedrive EN pipeline to english

BunRuntime.runMain(program);
