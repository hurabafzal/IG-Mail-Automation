import { HttpClientResponse } from "@effect/platform";
import { Schema as S } from "@effect/schema";
import { sendSlackMessageE } from "backend/src/utils/slack";
import { Console, Effect, pipe } from "effect";
import { DelRes, Pipedrive, PostRes } from "../types";
import { swapKeys } from "../utils";
import {
	type NewPerson,
	NewPersonEncoded,
	PersonFindRes,
	PersonGetByIdRes,
	type PersonListT,
	PersonSearchRes,
	type PersonUpdate,
	personPairs,
} from "./person.schema";

export const PersonPipedrive = {
	search: (term: string, fields: string) =>
		pipe(
			Pipedrive.get("/persons/search", {
				term,
				fields,
			}),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(PersonSearchRes)),
			Effect.scoped,
		),
	getById: (id: number) =>
		pipe(
			Pipedrive.get(`/persons/${id}`),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(PersonGetByIdRes)),
			Effect.scoped,
		),
	add: (params: S.Schema.Encoded<typeof NewPerson>) =>
		pipe(
			Effect.succeed(params),
			Effect.tap((p) =>
				pipe(
					PersonPipedrive.search(p.email[0].value, "email"),
					Effect.flatMap((res) => {
						const id = res.data.items.find((i) =>
							i.item.emails
								.map((e) => e.toLowerCase())
								.includes(p.email[0].value.toLowerCase()),
						)?.item.id;

						if (id) {
							console.log("person already exists", id);
							return pipe(
								sendSlackMessageE(
									`[pipedrive] Person with email ${p.email[0].value} already exists`,
								),
								Effect.andThen(() =>
									Effect.fail(new PersonAlreadyExistsError(id)),
								),
							);
						}
						return Effect.void;
					}),
				),
			),
			Effect.flatMap(() => swapKeys(personPairs, params)),
			Effect.flatMap(S.decodeUnknown(NewPersonEncoded)),
			Effect.flatMap((p) => Pipedrive.post("/persons", p)),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(PostRes)),
			Effect.catchTag("PersonAlreadyExistsError", (e) =>
				Effect.succeed({ success: false, data: { id: e.id } }),
			),
			Effect.scoped,
		),
	getAll: () =>
		pipe(
			Effect.iterate(
				{
					data: [] as PersonListT,
					more_items_in_collection: true,
					next_start: 0,
				},
				{
					while: (result) => result.more_items_in_collection,
					body: (result) =>
						pipe(
							Pipedrive.get("/persons", {
								start: result.next_start,
							}),
							Effect.tap(
								Console.log(`[persons] got res for start ${result.next_start}`),
							),
							Effect.flatMap(HttpClientResponse.schemaBodyJson(PersonFindRes)),
							Effect.map((x) => ({
								data: [...result.data, ...x.data],
								more_items_in_collection:
									x.additional_data.pagination.more_items_in_collection,
								next_start: x.additional_data.pagination.next_start ?? -1,
							})),
							Effect.tap(Effect.sleep(100)),
						),
				},
			),

			Effect.map((x) =>
				x.data
					.map((y) => ({
						id: y.id,
						email: y.primary_email,
						username: y["823033198a5d4385dd7f33bb129e0d919badefc3"] ?? "",
						add_time: y.add_time,
					}))
					.filter((y) => y.username !== ""),
			),

			Effect.scoped,
		),
	update: (id: number, params: S.Schema.Encoded<typeof PersonUpdate>) =>
		pipe(
			swapKeys(personPairs, params),
			// Effect.tap(Console.log),
			Effect.flatMap((p) => Pipedrive.put(`/persons/${id}`, p)),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(PostRes)),
			Effect.scoped,
		),
	delete: (id: number) =>
		pipe(
			Pipedrive.del(`/persons/${id}`),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(DelRes)),
			Effect.scoped,
		),
};

class PersonAlreadyExistsError {
	readonly _tag = "PersonAlreadyExistsError";
	constructor(readonly id: number) {}
}
