import { BunRuntime } from "@effect/platform-bun";
import { blacklistEmails } from "backend/src/gmail/emails/blacklist";

BunRuntime.runMain(
	blacklistEmails(["lisa@vermilion-family.com", "dana@vermilion-family.com"]),
);
