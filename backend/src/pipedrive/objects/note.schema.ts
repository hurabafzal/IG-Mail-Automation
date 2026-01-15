import { Schema as S } from "@effect/schema";

export const NewNote = S.Struct({
	content: S.String,
	lead_id: S.optional(S.String),
	deal_id: S.optional(S.Number),
	person_id: S.optional(S.Number),
	org_id: S.optional(S.Number),
	user_id: S.optional(S.Number),
	add_time: S.optional(S.String),
	pinned_to_lead_flag: S.optional(S.Number),
	pinned_to_deal_flag: S.optional(S.Number),
	pinned_to_organization_flag: S.optional(S.Number),
	pinned_to_person_flag: S.optional(S.Number),
});

export type NewNoteT = S.Schema.Encoded<typeof NewNote>;

const NoteResponse = S.Struct({
	id: S.Number,
});

export const NoteCreateRes = S.Struct({
	success: S.Boolean,
	data: NoteResponse,
});

export const NoteUpdateRes = S.Struct({
	success: S.Boolean,
	data: NoteResponse,
});

export type NoteResponseT = S.Schema.Type<typeof NoteResponse>;
export type NoteCreateResT = S.Schema.Type<typeof NoteCreateRes>;
export type NoteUpdateResT = S.Schema.Type<typeof NoteUpdateRes>;

const NoteItem = S.Struct({
	id: S.Number,
	content: S.String,
	deal_id: S.optional(S.Number),
	person_id: S.Union(S.Number, S.Null, S.Undefined),
	org_id: S.Union(S.Number, S.Null, S.Undefined),
	add_time: S.String,
	update_time: S.Union(S.String, S.Null, S.Undefined),
	user_id: S.optional(S.Number),
	pinned_to_deal_flag: S.Union(S.Number, S.Boolean, S.Undefined),
});

export const NoteFindRes = S.Struct({
	success: S.Boolean,
	data: S.Union(S.Array(NoteItem), S.Null),
	additional_data: S.optional(S.Any),
});

export type NoteItemT = S.Schema.Type<typeof NoteItem>;
export type NoteFindResT = S.Schema.Type<typeof NoteFindRes>;
