import { HttpClientResponse } from "@effect/platform";
import { Effect, pipe } from "effect";
import { Pipedrive } from "../types";
import {
	type MailThreadMessageT,
	MailThreadMessagesRes,
} from "./mailbox.schema";

export const MailboxPipedrive = {
	getMailThreadMessages: (threadId: number) =>
		pipe(
			Pipedrive.get(`/mailbox/mailThreads/${threadId}/mailMessages`),
			Effect.flatMap(HttpClientResponse.schemaBodyJson(MailThreadMessagesRes)),
			Effect.scoped,
		),
};
