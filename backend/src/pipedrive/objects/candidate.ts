import { Schema as S } from "@effect/schema";
import { Effect, pipe } from "effect";
import { DealPipedrive } from "./deal";
import { DealUpdate, NewDeal } from "./deal.schema";
import { PersonPipedrive } from "./person";
import { NewPerson, PersonUpdate } from "./person.schema";

export const NewCandidate = S.Struct({
	person: NewPerson,
	deal: NewDeal.pipe(S.omit("person_id")),
});
export const CandidateUpdate = S.Struct({
	person: PersonUpdate,
	deal: DealUpdate,
});

export const CandidatePipedrive = {
	add: (params: S.Schema.Encoded<typeof NewCandidate>) =>
		pipe(
			PersonPipedrive.add(params.person),
			Effect.flatMap((person) =>
				person.success
					? Effect.all({
							person_id: Effect.succeed(person.data.id),
							deal_id: Effect.map(
								DealPipedrive.add({
									...params.deal,
									person_id: person.data.id,
								}),
								(res) => res.data.id,
							),
						})
					: Effect.succeed({ person_id: person.data.id }),
			),
		),
	update: (
		person_id: number,
		params: S.Schema.Encoded<typeof CandidateUpdate>,
	) =>
		pipe(
			DealPipedrive.findFromPerson(person_id),
			Effect.map((res) => res.data.map((d) => d.id)[0]),
			Effect.flatMap((deal_id) =>
				Effect.all({
					person: pipe(PersonPipedrive.update(person_id, params.person)),
					deal: pipe(DealPipedrive.update(deal_id, params.deal)),
				}),
			),
			Effect.catchTag("ParseError", () => Effect.void),
		),
	delete: (person_id: number) =>
		pipe(
			// find deal
			DealPipedrive.findFromPerson(person_id),
			Effect.map((res) => res.data.map((d) => d.id)[0]),
			// delete deal
			Effect.flatMap((id) => DealPipedrive.delete(id)),
			// // delete person
			Effect.tap(() => PersonPipedrive.delete(person_id)),
		),
};

// export const addTestCandidate = CandidatePipedrive.add({
// 	person: {
// 		name: "test2",
// 		email: [{ value: "test@example.com", primary: "true" }],
// 		username: "test",
// 		follower: 100,
// 		niche: "test",
// 		account_creation: "2021",
// 		country: "test",
// 		first_name: "bob",
// 		firstNameCustom: "bob",
// 		phone: [{ value: "123456789", primary: "true" }],
// 	},
// 	deal: {
// 		title: "testDeal",
// 		user_id: 21367363,
// 		value: 0,
// 		daily_budget: "21",
// 		follower_growth: "21",
// 		story_growth: "21",
// 		first_name: "bob",
// 	},
// });
