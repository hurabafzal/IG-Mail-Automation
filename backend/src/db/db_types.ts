import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
	? ColumnType<S, I | undefined, U>
	: ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export const EmailServerHost = {
	GOOGLE: "GOOGLE",
	RZONE: "RZONE",
	MAIL_DE: "MAIL_DE",
	IONOS_DE: "IONOS_DE",
	AGENTURSERVER_DE: "AGENTURSERVER_DE",
	YAHOO: "YAHOO",
	OTHER: "OTHER",
} as const;
export type EmailServerHost =
	(typeof EmailServerHost)[keyof typeof EmailServerHost];
export const GmailLabel = {
	PIPEDRIVE: "PIPEDRIVE",
	BLACKLIST: "BLACKLIST",
} as const;
export type GmailLabel = (typeof GmailLabel)[keyof typeof GmailLabel];
export const ForwardingRuleSource = {
	STRIPE: "STRIPE",
	PIPEDRIVE: "PIPEDRIVE",
} as const;
export type ForwardingRuleSource =
	(typeof ForwardingRuleSource)[keyof typeof ForwardingRuleSource];
export const InstantlyLeadStatus = {
	ACTIVE: "ACTIVE",
	PAUSED: "PAUSED",
	COMPLETED: "COMPLETED",
	BOUNCED: "BOUNCED",
	UNSUBSCRIBED: "UNSUBSCRIBED",
	SKIPPED: "SKIPPED",
} as const;
export type InstantlyLeadStatus =
	(typeof InstantlyLeadStatus)[keyof typeof InstantlyLeadStatus];
export const InstantlyVerificationStatus = {
	VERIFIED: "VERIFIED",
	PENDING: "PENDING",
	PENDING_VERIFICATION_JOB: "PENDING_VERIFICATION_JOB",
	INVALID: "INVALID",
	RISKY: "RISKY",
	CATCH_ALL: "CATCH_ALL",
	JOB_CHANGE: "JOB_CHANGE",
} as const;
export type InstantlyVerificationStatus =
	(typeof InstantlyVerificationStatus)[keyof typeof InstantlyVerificationStatus];
export const LeadStatus = {
	ACTIVE: "ACTIVE",
	PAUSED: "PAUSED",
	COMPLETED: "COMPLETED",
	BOUNCED: "BOUNCED",
	UNSUBSCRIBED: "UNSUBSCRIBED",
	SKIPPED: "SKIPPED",
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];
export const GeneratedEmailType = {
	OPENER: "OPENER",
	TRIGGER_FOLLOWER_LOSS: "TRIGGER_FOLLOWER_LOSS",
	TRIGGER_FOLLOWING_INCREASE: "TRIGGER_FOLLOWING_INCREASE",
	TRIGGER_HIDDEN_LIKES: "TRIGGER_HIDDEN_LIKES",
} as const;
export type GeneratedEmailType =
	(typeof GeneratedEmailType)[keyof typeof GeneratedEmailType];
export const OpenAIRequestStatus = {
	PENDING_SUBMISSION: "PENDING_SUBMISSION",
	SUBMITTED: "SUBMITTED",
	PROCESSING: "PROCESSING",
	COMPLETED: "COMPLETED",
	FAILED: "FAILED",
	CANCELLED: "CANCELLED",
} as const;
export type OpenAIRequestStatus =
	(typeof OpenAIRequestStatus)[keyof typeof OpenAIRequestStatus];
export const EmailSequenceStage = {
	OPENER_PENDING_GENERATION: "OPENER_PENDING_GENERATION",
	OPENER_PENDING_SEND: "OPENER_PENDING_SEND",
	OPENER_SENT_AWAITING_COMPLETION: "OPENER_SENT_AWAITING_COMPLETION",
	AWAITING_TRIGGERS: "AWAITING_TRIGGERS",
	TRIGGER_EMAIL_PENDING_GENERATION: "TRIGGER_EMAIL_PENDING_GENERATION",
	TRIGGER_EMAIL_PENDING_SEND: "TRIGGER_EMAIL_PENDING_SEND",
	TRIGGER_EMAIL_SENT_AWAITING_COMPLETION:
		"TRIGGER_EMAIL_SENT_AWAITING_COMPLETION",
	SEQUENCE_COMPLETED: "SEQUENCE_COMPLETED",
	SEQUENCE_PAUSED_INVALID_EMAIL: "SEQUENCE_PAUSED_INVALID_EMAIL",
	SEQUENCE_PAUSED_MANUAL: "SEQUENCE_PAUSED_MANUAL",
	SEQUENCE_FAILED: "SEQUENCE_FAILED",
} as const;
export type EmailSequenceStage =
	(typeof EmailSequenceStage)[keyof typeof EmailSequenceStage];
export const SequenceType = {
	OPENER: "OPENER",
	TRIGGER_FOLLOWER_LOSS: "TRIGGER_FOLLOWER_LOSS",
	TRIGGER_FOLLOWING_INCREASE: "TRIGGER_FOLLOWING_INCREASE",
	TRIGGER_HIDDEN_LIKES: "TRIGGER_HIDDEN_LIKES",
} as const;
export type SequenceType = (typeof SequenceType)[keyof typeof SequenceType];
export const Language = {
	DE: "DE",
	EN: "EN",
} as const;
export type Language = (typeof Language)[keyof typeof Language];
export const ApiQueueStatus = {
	DONE: "DONE",
	PENDING: "PENDING",
} as const;
export type ApiQueueStatus =
	(typeof ApiQueueStatus)[keyof typeof ApiQueueStatus];
export const InstagramAccountSource = {
	MANUAL: "MANUAL",
	COMMENTS: "COMMENTS",
	RELATED_ACCOUNTS: "RELATED_ACCOUNTS",
	SHOPIFY: "SHOPIFY",
	ACTIVE_RELATED: "ACTIVE_RELATED",
	STARNGAGE: "STARNGAGE",
	HYPE_AUDIT: "HYPE_AUDIT",
} as const;
export type InstagramAccountSource =
	(typeof InstagramAccountSource)[keyof typeof InstagramAccountSource];
export const CandidateApproval = {
	APPROVED: "APPROVED",
	REJECTED: "REJECTED",
	PENDING: "PENDING",
} as const;
export type CandidateApproval =
	(typeof CandidateApproval)[keyof typeof CandidateApproval];
export const EmailType = {
	MANUAL: "MANUAL",
	FOLLOWER_LOSS: "FOLLOWER_LOSS",
} as const;
export type EmailType = (typeof EmailType)[keyof typeof EmailType];
export const TriggerIcons = {
	google: "google",
	facebook: "facebook",
	instagram: "instagram",
} as const;
export type TriggerIcons = (typeof TriggerIcons)[keyof typeof TriggerIcons];
export const Lang = {
	EN: "EN",
	DE: "DE",
	NL: "NL",
} as const;
export type Lang = (typeof Lang)[keyof typeof Lang];
export const BlackListReason = {
	MANUAL: "MANUAL",
	CUSTOMER: "CUSTOMER",
} as const;
export type BlackListReason =
	(typeof BlackListReason)[keyof typeof BlackListReason];
export type ApiQueue = {
	id: Generated<number>;
	headers: string;
	targetURL: string;
	sendOn: Timestamp;
	body: string;
	status: ApiQueueStatus;
};
export type CloneTask = {
	id: Generated<number>;
	title: string;
	target: number;
	createdAt: Generated<Timestamp>;
	target_female: Generated<number>;
	target_male: Generated<number>;
	target_country: string | null;
};
export type combined_daily_statistics = {
	stat_date: Timestamp;
	valid: Generated<number>;
	invalid: Generated<number>;
	slots_left: Generated<number>;
	account_disabled: Generated<number>;
	action_required: Generated<number>;
	captcha: Generated<number>;
	captcha_disabled: Generated<number>;
	compromised: Generated<number>;
	email_confirmation: Generated<number>;
	email_verification: Generated<number>;
	invalid_credentials: Generated<number>;
	password_reset: Generated<number>;
	pending: Generated<number>;
	phone_validation: Generated<number>;
	scrape_warning: Generated<number>;
	suspended: Generated<number>;
	temporary_locked: Generated<number>;
	delayed: Generated<number>;
	email_connection_error: Generated<number>;
	initializing: Generated<number>;
	stopped: Generated<number>;
	two_factor_authentication: Generated<number>;
	created_at: Generated<Timestamp>;
};
export type combined_daily_statistics_recovery = {
	stat_date: Timestamp;
	valid: Generated<number>;
	invalid: Generated<number>;
	account_disabled: Generated<number>;
	action_required: Generated<number>;
	captcha: Generated<number>;
	captcha_disabled: Generated<number>;
	compromised: Generated<number>;
	email_confirmation: Generated<number>;
	email_verification: Generated<number>;
	invalid_credentials: Generated<number>;
	password_reset: Generated<number>;
	pending: Generated<number>;
	phone_validation: Generated<number>;
	scrape_warning: Generated<number>;
	suspended: Generated<number>;
	temporary_locked: Generated<number>;
	delayed: Generated<number>;
	email_connection_error: Generated<number>;
	initializing: Generated<number>;
	stopped: Generated<number>;
	two_factor_authentication: Generated<number>;
	created_at: Generated<Timestamp>;
};
export type combined_daily_statistics_scrapers = {
	stat_date: Timestamp;
	mp_name: string;
	valid: Generated<number>;
	invalid: Generated<number>;
	slots_left: Generated<number>;
	account_disabled: Generated<number>;
	action_required: Generated<number>;
	captcha: Generated<number>;
	captcha_disabled: Generated<number>;
	compromised: Generated<number>;
	email_confirmation: Generated<number>;
	email_verification: Generated<number>;
	invalid_credentials: Generated<number>;
	password_reset: Generated<number>;
	pending: Generated<number>;
	phone_validation: Generated<number>;
	scrape_warning: Generated<number>;
	suspended: Generated<number>;
	temporary_locked: Generated<number>;
	delayed: Generated<number>;
	email_connection_error: Generated<number>;
	initializing: Generated<number>;
	stopped: Generated<number>;
	two_factor_authentication: Generated<number>;
	created_at: Generated<Timestamp>;
};
export type CommentedOnAccount = {
	id: Generated<number>;
	post_owner_id: string;
	commenter_id: string;
	commenter_username: string;
	createdAt: Generated<Timestamp>;
};
export type Counters = {
	id: Generated<number>;
	date: string;
	hikerAPI_calls: number;
};
export type daily_statistics = {
	stat_date: Timestamp;
	mp_name: string;
	valid: Generated<number>;
	invalid: Generated<number>;
	slots_left: Generated<number>;
	account_disabled: Generated<number>;
	action_required: Generated<number>;
	captcha: Generated<number>;
	captcha_disabled: Generated<number>;
	compromised: Generated<number>;
	email_confirmation: Generated<number>;
	email_verification: Generated<number>;
	invalid_credentials: Generated<number>;
	password_reset: Generated<number>;
	pending: Generated<number>;
	phone_validation: Generated<number>;
	scrape_warning: Generated<number>;
	suspended: Generated<number>;
	temporary_locked: Generated<number>;
	delayed: Generated<number>;
	email_connection_error: Generated<number>;
	initializing: Generated<number>;
	stopped: Generated<number>;
	two_factor_authentication: Generated<number>;
	created_at: Generated<Timestamp>;
};
export type daily_statistics_recovery = {
	stat_date: Timestamp;
	mp_name: string;
	valid: Generated<number>;
	invalid: Generated<number>;
	account_disabled: Generated<number>;
	action_required: Generated<number>;
	captcha: Generated<number>;
	captcha_disabled: Generated<number>;
	compromised: Generated<number>;
	email_confirmation: Generated<number>;
	email_verification: Generated<number>;
	invalid_credentials: Generated<number>;
	password_reset: Generated<number>;
	pending: Generated<number>;
	phone_validation: Generated<number>;
	scrape_warning: Generated<number>;
	suspended: Generated<number>;
	temporary_locked: Generated<number>;
	delayed: Generated<number>;
	email_connection_error: Generated<number>;
	initializing: Generated<number>;
	stopped: Generated<number>;
	two_factor_authentication: Generated<number>;
	created_at: Generated<Timestamp>;
};
export type daily_statistics_scraper = {
	stat_date: Timestamp;
	mp_name: string;
	valid: Generated<number>;
	invalid: Generated<number>;
	slots_left: Generated<number>;
	account_disabled: Generated<number>;
	action_required: Generated<number>;
	captcha: Generated<number>;
	captcha_disabled: Generated<number>;
	compromised: Generated<number>;
	email_confirmation: Generated<number>;
	email_verification: Generated<number>;
	invalid_credentials: Generated<number>;
	password_reset: Generated<number>;
	pending: Generated<number>;
	phone_validation: Generated<number>;
	scrape_warning: Generated<number>;
	suspended: Generated<number>;
	temporary_locked: Generated<number>;
	delayed: Generated<number>;
	email_connection_error: Generated<number>;
	initializing: Generated<number>;
	stopped: Generated<number>;
	two_factor_authentication: Generated<number>;
	created_at: Generated<Timestamp>;
};
export type Email = {
	id: Generated<number>;
	email: string;
	code: number | null;
	role: boolean | null;
	free_email: boolean | null;
	result: string | null;
	reason: string | null;
	send_transactional: number | null;
	createdAt: Generated<Timestamp>;
	instagram_id: string;
	used_reacher: Generated<boolean>;
	server_host_name: string | null;
	server_host_type: EmailServerHost | null;
	blacklisted_at: Timestamp | null;
	instantly_verification_status: InstantlyVerificationStatus | null;
};
export type EmailSequence = {
	id: Generated<number>;
	instagram_account_id: string;
	email: string;
	current_stage: EmailSequenceStage;
	current_stage_number: number;
	stage_entered_at: Generated<Timestamp>;
	next_action_possible_at: Timestamp | null;
	trigger_window_ends_at: Timestamp | null;
	last_instantly_campaign_completed_at: Timestamp | null;
	created_at: Generated<Timestamp>;
	updated_at: Timestamp;
	sequence_id: number | null;
};
export type EmailVariables = {
	id: Generated<number>;
	minFollowerCount: number;
	name: string;
	value: string;
	createdAt: Generated<Timestamp>;
	updatedAt: Generated<Timestamp>;
};
export type FollowupEmail = {
	id: Generated<number>;
	next_activity_subject: string;
	deal_id: number;
	fullSystemPrompt: string;
	fullResponse: string;
	recipientEmail: string;
	createdAt: Generated<Timestamp>;
};
export type GeneratedEmailRequest = {
	id: Generated<number>;
	email_sequence_id: number;
	email_type: GeneratedEmailType;
	email_type_number: number;
	openai_batch_id: string | null;
	openai_request_payload: unknown | null;
	openai_response: unknown | null;
	generated_subject: string | null;
	generated_body: string | null;
	status: Generated<OpenAIRequestStatus>;
	requested_at: Generated<Timestamp>;
	submitted_to_openai_at: Timestamp | null;
	completed_at: Timestamp | null;
	failed_at: Timestamp | null;
	created_at: Generated<Timestamp>;
	updated_at: Timestamp;
	recipient_email: string | null;
};
export type GmailAccount = {
	id: Generated<number>;
	email: string;
	refreshToken: string;
	createdAt: Generated<Timestamp>;
	updatedAt: Generated<Timestamp>;
};
export type GmailAccountEmails = {
	id: Generated<number>;
	gmail: string;
	emailId: string;
	from: string;
	subject: string;
	body: string;
	to: string;
	replyTo: string;
	createdAt: Generated<Timestamp>;
	updatedAt: Generated<Timestamp>;
	threadId: string | null;
	label: GmailLabel | null;
};
export type GmailForwardingRules = {
	id: Generated<number>;
	sentFrom: string;
	sentTo: string;
	targetInbox: string;
	filterID: string;
	source: ForwardingRuleSource | null;
};
export type IGHistoryTable = {
	id: Generated<number>;
	user_id: string;
	followers: number;
	following: number;
	postsCount: number;
	day: number;
	created_at: Generated<Timestamp>;
};
export type InitialInstagramAccount = {
	username: string;
	source_type: InstagramAccountSource;
	account_id: string | null;
	last_searched: Timestamp | null;
	not_found: Generated<boolean>;
	private: Generated<boolean>;
	created_at: Generated<Timestamp>;
	from_account_id: string | null;
};
export type InstagramAccountBase = {
	id: string;
	last_searched: Timestamp;
	account_created_at: string | null;
	country: string | null;
	created_at: Generated<Timestamp>;
	lastSentEmail: Timestamp | null;
	username: string;
	is_verified: boolean | null;
	first_name: string | null;
	gender: string | null;
	niche: string | null;
	searched_for_email: Generated<boolean>;
	hiddenLikes: boolean | null;
	business_name: string | null;
	use_for_training: Generated<boolean>;
	approved: Generated<CandidateApproval>;
	bio: Generated<string>;
	username_last_searched: Generated<Timestamp>;
	external_link: string | null;
	followers_count: Generated<number>;
	following_count: Generated<number>;
	former_username_count: Generated<string>;
	ig_category_enum: string | null;
	ig_email: string | null;
	ig_full_name: Generated<string>;
	last_updated: Timestamp | null;
	posts_count: Generated<number>;
	shopify_imported: Generated<boolean>;
	bio_language: string | null;
	triggerBitmap: Generated<number>;
	lastSentOpener: Timestamp | null;
	approve_counter: Generated<number>;
	pfpUrl: string | null;
	de_caption_count: number | null;
	real_country: string | null;
	blacklist: Generated<boolean>;
	commented_on_de: Generated<boolean>;
	ai_bio_lang: string | null;
	ai_bio_lang_conf: number | null;
	gender_conf: number | null;
	first_name_checked_at: Timestamp | null;
	missing: Generated<boolean>;
	approved_at: Timestamp | null;
	edited_at: Timestamp | null;
	previous_name: string | null;
	clone_count: Generated<number>;
	activeCampaignId: string | null;
	activeLeadId: string | null;
	blacklisted_at: Timestamp | null;
	last_data_refresh_attempt_at: Timestamp | null;
	last_data_refreshed_at: Timestamp | null;
	needs_data_refresh: Generated<boolean>;
};
export type InstagramAccountBaseNoFirstName = {
	id: string;
	last_searched: Timestamp;
	account_created_at: string | null;
	country: string | null;
	created_at: Generated<Timestamp>;
	lastSentEmail: Timestamp | null;
	username: string;
	is_verified: boolean | null;
	first_name: string | null;
	gender: string | null;
	niche: string | null;
	searched_for_email: Generated<boolean>;
	hiddenLikes: boolean | null;
	business_name: string | null;
	use_for_training: Generated<boolean>;
	approved: Generated<CandidateApproval>;
	bio: Generated<string>;
	username_last_searched: Generated<Timestamp>;
	external_link: string | null;
	followers_count: Generated<number>;
	following_count: Generated<number>;
	former_username_count: Generated<string>;
	ig_category_enum: string | null;
	ig_email: string | null;
	ig_full_name: Generated<string>;
	last_updated: Timestamp | null;
	posts_count: Generated<number>;
	shopify_imported: Generated<boolean>;
	bio_language: string | null;
	triggerBitmap: Generated<number>;
	lastSentOpener: Timestamp | null;
	approve_counter: Generated<number>;
	pfpUrl: string | null;
	de_caption_count: number | null;
	real_country: string | null;
	blacklist: Generated<boolean>;
	commented_on_de: Generated<boolean>;
	ai_bio_lang: string | null;
	ai_bio_lang_conf: number | null;
	gender_conf: number | null;
	first_name_checked_at: Timestamp | null;
	missing: Generated<boolean>;
	approved_at: Timestamp | null;
	edited_at: Timestamp | null;
	previous_name: string | null;
	clone_count: Generated<number>;
	activeCampaignId: string | null;
	activeLeadId: string | null;
	blacklisted_at: Timestamp | null;
	last_data_refresh_attempt_at: Timestamp | null;
	last_data_refreshed_at: Timestamp | null;
	needs_data_refresh: Generated<boolean>;
};
export type InstagramPost = {
	id: string;
	user_id: string;
	shortcode: string;
	likes_disabled: boolean;
	comment_count: number;
	comments_searched: Generated<boolean>;
	like_count: number;
	play_count: number | null;
	reshare_count: number | null;
	product_type: string | null;
	taken_at: Timestamp;
	caption: string;
	created_at: Generated<Timestamp>;
	updated_at: Generated<Timestamp>;
	caption_lang: string | null;
	thumbnail: string | null;
};
export type InstantlyLead = {
	id: Generated<number>;
	email_sequence_id: number;
	email_id: number;
	email_address: string;
	generated_email_request_id: number | null;
	instantly_campaign_id: string;
	instantly_lead_id: string;
	status: InstantlyLeadStatus;
	verification_status: InstantlyVerificationStatus | null;
	added_to_instantly_at: Generated<Timestamp>;
	timestamp_last_contact: Timestamp | null;
	timestamp_last_open: Timestamp | null;
	created_at: Generated<Timestamp>;
	updated_at: Timestamp;
	email_open_count: number | null;
	email_opened_step: number | null;
	email_reply_count: number | null;
	payload: unknown | null;
};
export type JapRequest = {
	id: Generated<number>;
	username: string;
	title: string;
	ig_id: string | null;
	external_url: string | null;
	last_checked_at: Generated<Timestamp>;
	last_bought_at: Generated<Timestamp>;
	created_at: Generated<Timestamp>;
	last_updated_at: Generated<Timestamp>;
};
export type Lead = {
	id: string;
	igid: string;
	email: string;
	campaign: string | null;
	subsequence_id: string | null;
	createdAt: Generated<Timestamp>;
	email_open_count: number | null;
	email_reply_count: number | null;
	payload: unknown | null;
	status: LeadStatus | null;
	timestamp_last_contact: Timestamp | null;
	timestamp_last_open: Timestamp | null;
	updatedAt: Timestamp | null;
	email_opened_step: number | null;
};
export type ManualMiningQueue = {
	id: Generated<number>;
	batch_id: string;
	username: string;
	account_id: string | null;
	not_found: Generated<boolean>;
	private: Generated<boolean>;
	createdAt: Generated<Timestamp>;
	batch_title: string;
	bio: string | null;
	followers_count: number | null;
	following_count: number | null;
	full_name: string | null;
	minedAt: Timestamp | null;
	posts_count: number | null;
};
export type MixMaxTokens = {
	id: Generated<number>;
	token: string;
	email: string | null;
	createdAt: Generated<Timestamp>;
};
export type mp_account_settings = {
	stat_date: Timestamp;
	mp_name: string;
	settings: string;
	email_notifications: string;
	created_at: Generated<Timestamp>;
};
export type PipedriveDeal = {
	id: Generated<number>;
	deal_id: number;
	deal_name: string;
	deal_status: string;
	deal_stage: string;
	next_activity_subject: string | null;
	followup_note_id: number | null;
};
export type Prompt = {
	id: Generated<number>;
	name: string;
	type: string;
	description: string | null;
	content: string;
	enabled: Generated<boolean>;
	createdAt: Generated<Timestamp>;
	updatedAt: Generated<Timestamp>;
};
export type RelatedAccounts = {
	id: Generated<number>;
	from_id: string;
	to_id: string;
	to_username: string;
	createdAt: Generated<Timestamp>;
};
export type SentEmail = {
	id: Generated<number>;
	mixMaxEmailId: string;
	mixMaxSequenceId: string;
	type: EmailType;
	expiresOn: Timestamp;
	payload: unknown;
	emailRecipient: string | null;
	createdAt: Generated<Timestamp>;
	updatedAt: Generated<Timestamp>;
};
export type Sequence = {
	id: Generated<number>;
	name: string;
	description: string | null;
	sequence_type: SequenceType;
	stage_number: number;
	instantly_campaign_id: string;
	active: Generated<boolean>;
	settings: unknown | null;
	language: Language | null;
	created_at: Generated<Timestamp>;
	updated_at: Timestamp;
};
export type Settings = {
	id: Generated<number>;
	name: string;
	value: string;
	createdAt: Generated<Timestamp>;
	updatedAt: Generated<Timestamp>;
};
export type Trigger = {
	id: Generated<number>;
	trigger_group_id: number;
	name: string;
	active: boolean;
	rank: number;
	cooldown: number;
	params: Generated<unknown>;
	mixMaxSequenceId1: string | null;
	mixMaxSequenceId2: string | null;
	icon: Generated<TriggerIcons>;
	description: string | null;
	lang: Generated<Lang>;
	maxPerDay: Generated<number>;
	instantlyCampaignId: string | null;
	subsequenceId: string | null;
};
export type TriggerLog = {
	id: Generated<number>;
	trigger_id: number;
	payload: unknown;
	sent_email_id: number | null;
	createdAt: Generated<Timestamp>;
	instagram_id: string;
};
export type UniqueInstagramPost = {
	id: string;
	thumbnail: string | null;
	user_id: string;
	shortcode: string;
	likes_disabled: boolean;
	comment_count: number;
	comments_searched: Generated<boolean>;
	like_count: number;
	play_count: number | null;
	reshare_count: number | null;
	product_type: string | null;
	taken_at: Timestamp;
	caption: string;
	created_at: Generated<Timestamp>;
	caption_lang: string | null;
};
export type user = {
	id: string;
	username: string;
	email: string;
	pfp: string;
};
export type user_key = {
	id: string;
	user_id: string;
	hashed_password: string | null;
};
export type user_session = {
	id: string;
	user_id: string;
	active_expires: string;
	idle_expires: string;
};
export type UsernameHistory = {
	id: Generated<number>;
	user_id: string;
	username: string;
	createdAt: Generated<Timestamp>;
};
export type UsersToClone = {
	ig_id: string;
	og_username: string;
	alt_username: string | null;
	og_full_name: string;
	alt_full_name: string | null;
	got_pfp: Generated<boolean>;
	pfp_last_attempted: Timestamp | null;
	TaskId: number;
	alt_name_unique: Generated<boolean>;
	createdAt: Generated<Timestamp>;
	name_attempts: Generated<number>;
	pfp_fail: Generated<boolean>;
	id: Generated<number>;
	alt_bio: string | null;
};
export type DB = {
	ApiQueue: ApiQueue;
	CloneTask: CloneTask;
	combined_daily_statistics: combined_daily_statistics;
	combined_daily_statistics_recovery: combined_daily_statistics_recovery;
	combined_daily_statistics_scrapers: combined_daily_statistics_scrapers;
	CommentedOnAccount: CommentedOnAccount;
	Counters: Counters;
	daily_statistics: daily_statistics;
	daily_statistics_recovery: daily_statistics_recovery;
	daily_statistics_scraper: daily_statistics_scraper;
	Email: Email;
	EmailSequence: EmailSequence;
	EmailVariables: EmailVariables;
	FollowupEmail: FollowupEmail;
	GeneratedEmailRequest: GeneratedEmailRequest;
	GmailAccount: GmailAccount;
	GmailAccountEmails: GmailAccountEmails;
	GmailForwardingRules: GmailForwardingRules;
	IGHistoryTable: IGHistoryTable;
	InitialInstagramAccount: InitialInstagramAccount;
	InstagramAccountBase: InstagramAccountBase;
	InstagramAccountBaseNoFirstName: InstagramAccountBaseNoFirstName;
	InstagramPost: InstagramPost;
	InstantlyLead: InstantlyLead;
	JapRequest: JapRequest;
	Lead: Lead;
	ManualMiningQueue: ManualMiningQueue;
	MixMaxTokens: MixMaxTokens;
	mp_account_settings: mp_account_settings;
	PipedriveDeal: PipedriveDeal;
	Prompt: Prompt;
	RelatedAccounts: RelatedAccounts;
	SentEmail: SentEmail;
	Sequence: Sequence;
	Settings: Settings;
	Trigger: Trigger;
	TriggerLog: TriggerLog;
	UniqueInstagramPost: UniqueInstagramPost;
	user: user;
	user_key: user_key;
	user_session: user_session;
	UsernameHistory: UsernameHistory;
	UsersToClone: UsersToClone;
};
