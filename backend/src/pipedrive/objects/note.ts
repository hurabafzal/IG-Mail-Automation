import { HttpClientResponse } from "@effect/platform";
import { Schema as S } from "@effect/schema";
import { Effect, pipe } from "effect";
import { Pipedrive } from "../types";
import {
	NewNote,
	type NewNoteT,
	NoteCreateRes,
	NoteFindRes,
	NoteUpdateRes,
} from "./note.schema";

export const NotePipedrive = {
	add: (params: NewNoteT) =>
		pipe(
			S.decodeUnknown(NewNote)(params),
			Effect.flatMap((p) => Pipedrive.post("/notes", p)),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(NoteCreateRes)),
			Effect.scoped,
		),
	update: (id: number, params: Partial<NewNoteT>) =>
		pipe(
			S.decodeUnknown(S.partial(NewNote))(params),
			Effect.flatMap((p) => Pipedrive.put(`/notes/${id}`, p)),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(NoteUpdateRes)),
			Effect.scoped,
		),

	getDealNotes: (dealId: number) =>
		pipe(
			Pipedrive.get("/notes", {
				deal_id: dealId,
			}),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(NoteFindRes)),
			Effect.map((res) => res.data),
			Effect.scoped,
		),

	getPersonNotes: (personId: number) =>
		pipe(
			Pipedrive.get("/notes", {
				person_id: personId,
			}),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(NoteFindRes)),
			Effect.map((res) => res.data),
			Effect.scoped,
		),

	delete: (id: number) => pipe(Pipedrive.del(`/notes/${id}`), Effect.scoped),
};
