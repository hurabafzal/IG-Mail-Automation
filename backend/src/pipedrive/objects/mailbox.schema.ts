import { Schema as S } from "@effect/schema";

const MailMessageParty = S.Struct({
	id: S.Number,
	email_address: S.String,
	name: S.String,
	linked_person_id: S.NullOr(S.Number),
	linked_person_name: S.NullOr(S.String),
	mail_message_party_id: S.Number,
});

const MailThreadMessage = S.Struct({
	id: S.Number,
	from: S.Array(MailMessageParty),
	to: S.Array(MailMessageParty),
	cc: S.Array(MailMessageParty),
	bcc: S.Array(MailMessageParty),
	body_url: S.optional(S.String),
	account_id: S.String,
	user_id: S.Number,
	mail_thread_id: S.Number,
	subject: S.String,
	snippet: S.String,
	mail_tracking_status: S.NullOr(S.String),
	mail_link_tracking_enabled_flag: S.Number,
	read_flag: S.Number,
	draft: S.NullOr(S.String),
	draft_flag: S.Number,
	synced_flag: S.Number,
	deleted_flag: S.Number,
	external_deleted_flag: S.Number,
	expunged_flag: S.Number,
	has_body_flag: S.Number,
	sent_flag: S.Number,
	sent_from_pipedrive_flag: S.Number,
	smart_bcc_flag: S.Number,
	message_time: S.String,
	add_time: S.String,
	update_time: S.String,
	has_attachments_flag: S.Number,
	has_inline_attachments_flag: S.Number,
	has_real_attachments_flag: S.Number,
	group_sending_flag: S.Number,
	last_replied_at: S.NullOr(S.String),
	mail_signature_id: S.NullOr(S.Number),
	connection_type: S.String,
	team_admin_user_id: S.NullOr(S.Number),
	sender_user_id: S.NullOr(S.Number),
});

export const MailThreadMessagesRes = S.Struct({
	data: S.Array(MailThreadMessage),
	success: S.Boolean,
	statusCode: S.Number,
	extendedStatusCode: S.Number,
	statusText: S.String,
	service: S.String,
});

export type MailThreadMessageT = S.Schema.Type<typeof MailThreadMessage>;
export type MailThreadMessagesResT = S.Schema.Type<
	typeof MailThreadMessagesRes
>;
