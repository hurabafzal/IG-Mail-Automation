import { Effect, Schema, pipe } from "effect";
import { db } from "../db";
import { env } from "../env";

export type SequenceFolder = {
	_id: string;
	userId: string;
	name: string;
	sequenceIds: string[];
	createdAt: string;
	savedAt: string;
	shared: unknown;
};

export type Sequence = {
	_id: string;
	variables: unknown[];
	name: string;
	stages: {
		_id: string;
		userId: string;
		createdAt: string;
		updatedAt: string;
		type: string;
		subject: string;
		body: string;
		scheduleBetween: {
			timezone: string;
			start: number;
			end: number;
		};
	}[];
};

export const getTokens = async () => {
	const x = await db.selectFrom("MixMaxTokens").select("token").execute();
	return x.map((x) => x.token);
};

const SequenceRecipientSchema = Schema.Struct({
	_id: Schema.String,
	createdAt: Schema.Number,
	to: Schema.Struct({
		email: Schema.String,
		// name: Schema.String,
	}),
	analytics: Schema.Struct({
		events: Schema.Struct({
			opens: Schema.Number,
			clicks: Schema.Number,
		}),
	}),
	stages: Schema.Array(
		Schema.Struct({
			ordinal: Schema.Number,
			failedError: Schema.NullishOr(Schema.String),
			opens: Schema.Number,
			replied: Schema.Number,
			clicks: Schema.Number,
			bounced: Schema.Number,
			sentAt: Schema.NullishOr(Schema.Number),
			from: Schema.Struct({
				email: Schema.String,
				name: Schema.String,
			}),
		}),
	),
});
type SequenceRecipient = typeof SequenceRecipientSchema.Type;
const decodeSequenceRecipients = Schema.decodeUnknown(
	SequenceRecipientSchema.pipe(Schema.Array),
);

interface FetchMixmaxEmails {
	offset: number;
	sequenceId: string;
	orderBy:
		| "email"
		| "lastStage"
		| "lastMessageCreated"
		| "nextStageScheduledAt"
		| "opens"
		| "clicks"
		| "replied"
		| "downloads"
		| "accepted";
	orderDesc: boolean;
}

function fetchMixmaxRecipientChunk({
	offset,
	sequenceId,
	orderBy,
	orderDesc,
}: FetchMixmaxEmails) {
	return pipe(
		Effect.tryPromise(() =>
			fetch(
				`https://api.mixmax.com/v1/sequences/${sequenceId}/recipients?sortBy=${orderBy}&sortDesc=${orderDesc}&limit=50&offset=${offset}`,
				{
					headers: {
						"X-API-Token": env.MIXMAX_KEY,
					},
				},
			).then((res) => {
				if (res.status !== 200) {
					throw new Error(
						`[code ${res.status}] Failed to fetch recipients: ${res.statusText}`,
					);
				}
				return res.json();
			}),
		),
		Effect.andThen((res) => decodeSequenceRecipients(res)),
	);
}

export function fetchMixmaxRecipients({
	sequenceId,
	orderBy,
	offset = 0,
	orderDesc = true,
}: FetchMixmaxEmails) {
	return Effect.gen(function* () {
		const recipients: SequenceRecipient[] = [];
		while (true) {
			if (offset > 9_950) {
				break;
			}
			yield* Effect.sleep(500);
			const chunk = yield* fetchMixmaxRecipientChunk({
				offset,
				sequenceId,
				orderBy,
				orderDesc,
			});
			console.log(`Fetched ${chunk.length + offset} recipients`);
			recipients.push(...chunk);
			offset += chunk.length;
			if (chunk.length < 50) {
				break;
			}
		}
		return recipients;
	});
}
