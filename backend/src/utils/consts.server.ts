import { db } from "../db";

const triggers = await db
	.selectFrom("Trigger")
	.select([
		"name",
		"lang",
		"mixMaxSequenceId1",
		"Trigger.instantlyCampaignId",
		"Trigger.subsequenceId",
	])
	.execute();

export const sequenceIdTitleMap = triggers.reduce(
	(acc, trigger) => {
		if (trigger.mixMaxSequenceId1) {
			acc[trigger.mixMaxSequenceId1] = `${trigger.name} ${trigger.lang}`;
		}
		if (trigger.instantlyCampaignId) {
			acc[trigger.instantlyCampaignId] = `${trigger.name} ${trigger.lang}`;
		}
		if (trigger.subsequenceId) {
			acc[trigger.subsequenceId] = `${trigger.name} ${trigger.lang}`;
		}
		return acc;
	},
	{} as Record<string, string>,
);
