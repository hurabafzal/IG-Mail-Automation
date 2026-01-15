import { Schema as S } from "@effect/schema";

// pase person schema, default pipedrive
const NewPersonBase = S.Struct({
	name: S.String,
	first_name: S.optional(S.String),
	owner_id: S.optional(S.Number),
	org_id: S.optional(S.Number),
	email: S.Array(
		S.Struct({
			value: S.String,
			primary: S.String,
			label: S.optional(S.String),
		}),
	),
	phone: S.optional(
		S.Array(
			S.Struct({
				value: S.String,
				primary: S.String,
				label: S.optional(S.String),
			}),
		),
	),
});

////////////////////////////////////////////
//               decoded                  //
////////////////////////////////////////////
// custom labels for my custom person fields
// New Person Custom Object
const npco = {
	username: S.String,
	follower: S.optional(S.Number),
	niche: S.optional(S.String),
	account_creation: S.optional(S.String),
	country: S.optional(S.String),
	language: S.optional(S.String),
	ig_full_name: S.optional(S.String),
	followingCount: S.optional(S.Number),
	post_count: S.optional(S.Number),
	avg_comment_count: S.optional(S.Number),
	avg_like_count: S.optional(S.Number),
	hiddenLikes: S.optional(S.Union(S.Literal("yes"), S.Literal("no"))),
	lastEmailSequence: S.optional(S.String),
	firstNameCustom: S.optional(S.String),
} as const;
const NewPersonCustom = S.Struct(npco);
export const NewPerson = S.extend(NewPersonBase, NewPersonCustom);
export const PersonUpdate = NewPerson.pipe(
	S.pick(
		"account_creation",
		"firstNameCustom",
		"hiddenLikes",
		"language",
		"country",
		"lastEmailSequence",
	),
);

////////////////////////////////////////////
//                encoded                 //
////////////////////////////////////////////
// custom fields encoded with their pipedrive id

export const personPairs = [
	["823033198a5d4385dd7f33bb129e0d919badefc3", "username"],
	["58b79b0435bb9ba90bf400c6ac0e683cff8b553c", "follower"],
	["4eb7f95dd24f1e1ac7fed031f12c892f8ea33b2b", "niche"],
	["f094eb1f6d678345b5ad050adc8bdc96fd79f188", "account_creation"],
	["f864ce01957cdaf64ca5613058d2af39f7f292b4", "country"],
	["696c621a27a918553dcb5b9e0e9531b8ef084439", "language"],
	["2b87f98db4f9238a681cb7bb37f4063c5bca702d", "post_count"],
	["1da21cc7f1aae5f5e7d10ee617693bba9d234b94", "ig_full_name"],
	["1eb1b2aff1958fe6850ebfdb45dee6eb0c813526", "avg_comment_count"],
	["73f178520743d1c2bb6a3fc3f16cffb57bf5189e", "avg_like_count"],
	["c00b2d3b50cd4826779192e4a805aa6dde82f120", "followingCount"],
	["895a2e64659aace2f20124872cd5948c9d802763", "hiddenLikes"],
	["5d72ceb65620d96dff674e998a576222c34cb921", "lastEmailSequence"],
	["b4707b18aa05625a9fb597e34870affc2b878f60", "firstNameCustom"],
] as const;

const newPersonCustomEncoded = S.Struct({
	"823033198a5d4385dd7f33bb129e0d919badefc3": npco.username,
	"58b79b0435bb9ba90bf400c6ac0e683cff8b553c": npco.follower,
	"4eb7f95dd24f1e1ac7fed031f12c892f8ea33b2b": npco.niche,
	f094eb1f6d678345b5ad050adc8bdc96fd79f188: npco.account_creation,
	f864ce01957cdaf64ca5613058d2af39f7f292b4: npco.country,
	"696c621a27a918553dcb5b9e0e9531b8ef084439": npco.language,
	"5d72ceb65620d96dff674e998a576222c34cb921": npco.lastEmailSequence,
	"2b87f98db4f9238a681cb7bb37f4063c5bca702d": npco.post_count,
	"1da21cc7f1aae5f5e7d10ee617693bba9d234b94": npco.ig_full_name,
	"1eb1b2aff1958fe6850ebfdb45dee6eb0c813526": npco.avg_comment_count,
	"73f178520743d1c2bb6a3fc3f16cffb57bf5189e": npco.avg_like_count,
	c00b2d3b50cd4826779192e4a805aa6dde82f120: npco.followingCount,
	"895a2e64659aace2f20124872cd5948c9d802763": npco.hiddenLikes,
	b4707b18aa05625a9fb597e34870affc2b878f60: npco.firstNameCustom,
});
export const NewPersonEncoded = S.extend(NewPersonBase, newPersonCustomEncoded);

const PersonList = S.Array(
	S.Struct({
		id: S.Number,
		primary_email: S.NullOr(S.String),
		add_time: S.DateFromString,
		"823033198a5d4385dd7f33bb129e0d919badefc3": npco.username.pipe(S.NullOr),
	}),
);
export type PersonListT = S.Schema.Type<typeof PersonList>;

const PersonItem = S.Struct({
	id: S.Number,
	name: S.String,
	primary_email: S.NullishOr(S.String),
	// Include all custom fields with their encoded IDs using NullishOr like deal.schema.ts
	"823033198a5d4385dd7f33bb129e0d919badefc3": S.NullishOr(S.String), // username
	"58b79b0435bb9ba90bf400c6ac0e683cff8b553c": S.NullishOr(S.Number), // follower
	"4eb7f95dd24f1e1ac7fed031f12c892f8ea33b2b": S.NullishOr(S.String), // niche
	f864ce01957cdaf64ca5613058d2af39f7f292b4: S.NullishOr(S.String), // country
	"696c621a27a918553dcb5b9e0e9531b8ef084439": S.NullishOr(S.String), // language
});
export type PersonItemT = S.Schema.Type<typeof PersonItem>;

export const PersonGetByIdRes = S.Struct({
	success: S.Boolean,
	data: PersonItem.pipe(S.NullishOr),
});

export const PersonFindRes = S.Struct({
	success: S.Boolean,
	data: PersonList,
	additional_data: S.Struct({
		pagination: S.Struct({
			start: S.Number,
			limit: S.Number,
			more_items_in_collection: S.Boolean,
			next_start: S.optional(S.Number),
		}),
	}),
});

export const PersonSearchRes = S.Struct({
	success: S.Boolean,
	data: S.Struct({
		items: S.Array(
			S.Struct({
				result_score: S.Number,
				item: S.Struct({
					id: S.Number,
					type: S.Literal("person"),
					name: S.String,
					phones: S.Array(S.String),
					emails: S.Array(S.String),
					primary_email: S.String,
					visible_to: S.Number,
					owner: S.Struct({
						id: S.Number,
					}),
					organization: S.NullOr(S.Unknown),
					custom_fields: S.Array(S.Unknown),
					notes: S.Array(S.Unknown),
					update_time: S.String,
				}),
			}),
		),
	}),
});
