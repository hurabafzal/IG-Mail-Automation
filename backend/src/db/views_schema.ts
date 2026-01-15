import type {
	CandidateApproval,
	DB,
	Generated,
	IGHistoryTable,
	Timestamp,
} from "./db_types";

export type total_daily_count = {
	bucket: Generated<Timestamp>;
	count: number;
};

export type target_daily_counts = {
	bucket: Generated<Timestamp>;
	count: number;
};

export type leads = {
	id: string;
	username: string;
	created_at: Timestamp;
	country: string;
	bitmap: number;
	bio_language: string | null;
	lastSentEmail: Timestamp | null;
	approved: Generated<CandidateApproval>;
	lastSentOpener: Timestamp | null;
	email: string;
	activeCampaignId: string | null;
	hiddenLikes: boolean;
};

export interface DB_WITH_VIEWS extends DB {
	total_daily_count: total_daily_count;
	leads: leads;
	target_daily_counts: target_daily_counts;
	ig_history_leads: IGHistoryTable;
}
