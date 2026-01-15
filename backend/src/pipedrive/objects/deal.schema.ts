import { Schema as S } from "@effect/schema";

const NewDealBase = S.Struct({
	title: S.String,
	person_id: S.Number,
	label: S.optional(S.Array(S.Number)),
	user_id: S.Number,
	value: S.Number,
	pipeline_id: S.optional(S.Number),
	stage_id: S.optional(S.Number),
	status: S.optional(
		S.Union(
			S.Literal("open"),
			S.Literal("won"),
			S.Literal("lost"),
			S.Literal("deleted"),
		),
	),
	// currency: S.optional(S.String),
	// value: S.optional(S.String),
	// org_id: S.optional(S.Number),
});

////////////////////////////////////////////
//               decoded                  //
////////////////////////////////////////////
// custom labels for my custom deal fields
// New Deal Custom Object
const ndco = {
	original_inbox: S.optional(S.String),
	follower_growth: S.optional(S.String),
	story_growth: S.optional(S.String),
	daily_budget: S.optional(S.String),
	language: S.optional(S.String),
	first_name: S.optional(S.String),
} as const;
const NewDealCustom = S.Struct(ndco);
export const NewDeal = S.extend(NewDealBase, NewDealCustom);
export const DealUpdate = NewDeal.pipe(
	S.pick("daily_budget", "follower_growth", "story_growth", "first_name"),
);
export type newDeal = S.Schema.Encoded<typeof NewDeal>;

////////////////////////////////////////////
//                encoded                 //
////////////////////////////////////////////
// custom fields encoded with their pipedrive id

export const dealPairs = [
	["dd3e1902ae4f55567d18970e5cc4cf7680af2b77", "original_inbox"],
	["8522a88ebf5e25e61120ceca129768f9f818d891", "follower_growth"],
	["f716628ccd4dba48a106430e7f43a2ebcd294ceb", "story_growth"],
	["0fe1db574a4823f55057face2d5c6e7051c5d339", "daily_budget"],
	["1d0fa70006672b28e884cd86b789f8eb3c358933", "language"],
	["13d2a0b91c8297c8dd7e603c5e2facf0e2ad5e55", "first_name"],
] as const;

const newDealCustomEncoded = S.Struct({
	dd3e1902ae4f55567d18970e5cc4cf7680af2b77: ndco.original_inbox,
	"8522a88ebf5e25e61120ceca129768f9f818d891": ndco.follower_growth,
	f716628ccd4dba48a106430e7f43a2ebcd294ceb: ndco.story_growth,
	"0fe1db574a4823f55057face2d5c6e7051c5d339": ndco.daily_budget,
	"1d0fa70006672b28e884cd86b789f8eb3c358933": ndco.language,
	"13d2a0b91c8297c8dd7e603c5e2facf0e2ad5e55": ndco.first_name,
});
export const NewDealEncoded = S.extend(NewDealBase, newDealCustomEncoded);

const DealItem = S.Struct({
	id: S.Number,
	creator_user_id: S.Struct({
		id: S.Number,
		name: S.String,
		email: S.String,
		value: S.Number,
	}),
	user_id: S.Struct({
		id: S.Number,
		name: S.String,
		email: S.String,
		value: S.Number,
	}),
	person_id: S.Struct({
		name: S.String,
		email: S.Array(
			S.Struct({
				label: S.optional(S.String),
				value: S.String,
				primary: S.Boolean,
			}),
		),
		value: S.Number,
	}).pipe(S.NullOr),
	org_id: S.optional(
		S.NullOr(
			S.Struct({
				name: S.String,
				people_count: S.Number,
				owner_id: S.Number,
				value: S.Number,
			}),
		),
	),
	stage_id: S.Number,
	title: S.String,
	value: S.Number,
	next_activity_subject: S.NullishOr(S.String),
	next_activity_type: S.NullishOr(S.String),
	next_activity_note: S.NullishOr(S.String),
});

export type DealItemT = S.Schema.Type<typeof DealItem>;

export const DealFindRes = S.Struct({
	success: S.Boolean,
	data: S.Array(DealItem),
	additional_data: S.Struct({
		pagination: S.Struct({
			start: S.Number,
			limit: S.Number,
			more_items_in_collection: S.Boolean,
			next_start: S.optional(S.NullOr(S.Number)),
		}),
	}),
});

const MailMessageParty = S.Struct({
	id: S.Number,
	email_address: S.String,
	name: S.String,
	linked_person_id: S.NullOr(S.Number),
	linked_person_name: S.NullOr(S.String),
	mail_message_party_id: S.Number,
});

const MailMessage = S.Struct({
	// Essential fields
	id: S.Number,
	from: S.Array(MailMessageParty),
	to: S.Array(MailMessageParty),
	subject: S.String,
	body_url: S.optional(S.String),
	user_id: S.Number,
	mail_thread_id: S.Number,
	message_time: S.String,
	company_id: S.Number,

	// Optional recipient fields
	cc: S.NullishOr(S.Array(MailMessageParty)),
	bcc: S.NullishOr(S.Array(MailMessageParty)),

	// Optional content fields
	snippet: S.NullishOr(S.String),
	draft: S.NullishOr(S.String),

	// Optional integration fields
	nylas_id: S.NullishOr(S.String),
	account_id: S.NullishOr(S.String),
	mail_tracking_status: S.NullishOr(S.String),
	s3_bucket: S.NullishOr(S.String),
	s3_bucket_path: S.NullishOr(S.String),
	mua_message_id: S.NullishOr(S.String),
	template_id: S.NullishOr(S.Number),

	// Optional flag fields (with defaults)
	mail_link_tracking_enabled_flag: S.NullishOr(S.Number),
	read_flag: S.NullishOr(S.Number),
	draft_flag: S.NullishOr(S.Number),
	synced_flag: S.NullishOr(S.Number),
	deleted_flag: S.NullishOr(S.Number),
	external_deleted_flag: S.NullishOr(S.Number),
	has_body_flag: S.NullishOr(S.Number),
	sent_flag: S.NullishOr(S.Number),
	sent_from_pipedrive_flag: S.NullishOr(S.Number),
	smart_bcc_flag: S.NullishOr(S.Number),
	has_attachments_flag: S.NullishOr(S.Number),
	has_inline_attachments_flag: S.NullishOr(S.Number),
	has_real_attachments_flag: S.NullishOr(S.Number),

	// Optional timestamp and metadata fields
	add_time: S.NullishOr(S.String),
	update_time: S.NullishOr(S.String),
	timestamp: S.NullishOr(S.String),
	item_type: S.NullishOr(S.String),
});

const MailMessageResponse = S.Struct({
	object: S.String,
	timestamp: S.String,
	data: MailMessage,
});

export const DealMailMessagesRes = S.Struct({
	success: S.Boolean,
	data: S.Array(MailMessageResponse).pipe(S.NullOr),
	additional_data: S.Struct({
		pagination: S.Struct({
			start: S.Number,
			limit: S.Number,
			more_items_in_collection: S.Boolean,
		}),
	}),
});

export type MailMessageT = S.Schema.Type<typeof MailMessage>;
export type DealMailMessagesResT = S.Schema.Type<typeof DealMailMessagesRes>;
