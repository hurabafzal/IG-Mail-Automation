import type { EmailType } from "../db/db_types";
import type { BitmapTrigger } from "./bitmap";

export interface triggerSettings {
	id: number;
	params: unknown;
	rank: number;
	active: boolean;
	sequenceId: string | null;
	maxPerDay: number;
	trigger_group_id: BitmapTrigger;
}

export interface Candidate {
	ig_id: string;
	email: string;
	lead_id: string | null;
	lastSentEmail: Date | null;
	trigger_type: EmailType;
	trigger: {
		id: number;
		group_id: BitmapTrigger;
		sequenceId: string;
		instantlyCampaignId: string;
		emailVariables: Record<string, string>;
	};
}
