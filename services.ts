import { BunRuntime } from "@effect/platform-bun";
import { CloneService } from "backend/src/cloneTool/clone.service";
import { refreshViewsCron } from "backend/src/db/refresh_views";
import { followupGenerationNewCron } from "backend/src/followupsprompt/run-followup-generation";
import { autoForwardingFilterCron } from "backend/src/gmail/autoforwarding";
import { gmailLabelCron } from "backend/src/gmail/emails/cron";
// import { followupGenerationCron } from "backend/src/followups/run-followup-generation";
import { importAccountsToEmailSequenceCronKeywordsWithHashtags } from "backend/src/import-accounts-to-email-sequence-cron/import-accounts-to-email-sequence-keywords-with-hashtags.cron";
import { importAccountsToEmailSequenceCronKeywords } from "backend/src/import-accounts-to-email-sequence-cron/import-accounts-to-email-sequence-keywords.cron";
import { importAccountsToEmailSequenceCron } from "backend/src/import-accounts-to-email-sequence-cron/import-accounts-to-email-sequence.cron";
import { lowBalanceNotifyCron } from "backend/src/mining/HikerAPI";
import { runDynamicLeadManager } from "backend/src/triggers/dynamic-lead-manager";
import { runDynamicLeadManagerDE } from "backend/src/triggersDE/dynamic-lead-manager";

// import { migrateAccountsNoFirstNameCron } from "backend/src/mining/migrate-accounts-no-first-name-cron/migrateAccountsNoFirstNameCron";
import { migrateAccountsNoFirstNameCron } from "backend/src/migrate-accounts-no-firstname";

import { CatCron } from "backend/src/mining/ML/cat";
import {
	detectCaptionLangCron,
	findGermanCaptionAccountsCron,
} from "backend/src/mining/ML/detectLanguage";
import { PhiCron } from "backend/src/mining/ML/phi";
import {
	emailVerificationLoop,
	markBadEmailCron,
} from "backend/src/mining/emailVerification";

// import { followupAttemptProcessingCron } from "backend/src/followupsprompt/run-followup-attempt-processing";
import { findMissingCountriesCron } from "backend/src/mining/instagramMiner/findMissingCountires";
import { getMissedPublicEmailsCron } from "backend/src/mining/instagramMiner/minePublicEmails";
import { ManualMiningService } from "backend/src/mining/manual-mining";
import { recursiveImportCron } from "backend/src/mining/recursive-import";
import { updateOutdatedCron } from "backend/src/mining/updateOutdatedAccounts";
import { runEmailGenerationWorker } from "backend/src/triggers/email-generation-worker";
import { runCampaignSubmissionWorker } from "backend/src/triggers/instantly-sender";
import { instantlyLeadStatsSyncCron } from "backend/src/triggers/sync-stats.cron";
import { runEmailGenerationWorkerDE } from "backend/src/triggersDE/email-generation-worker";
import { runCampaignSubmissionWorkerDE } from "backend/src/triggersDE/instantly-sender";
import { runEmailGenerationWorkerKeywords } from "backend/src/triggersKeywords/email-generation-worker";
import { runCampaignSubmissionWorkerKeywords } from "backend/src/triggersKeywords/instantly-sender";

import { runEmailGenerationWorkerKeywordspipedrive } from "backend/src/triggersFollowupAttempts/email-generation-worker";
import { runCampaignSubmissionWorkerKeywordspipedrive } from "backend/src/triggersFollowupAttempts/instantly-sender";

import { runEmailGenerationWorkerUK } from "backend/src/triggersUKOpener2/email-generation-worker";
import { runCampaignSubmissionWorkerUK } from "backend/src/triggersUKOpener2/instantly-sender";

import { Effect } from "effect";

const node_env = Bun.env.NODE_ENV;

if (node_env !== "development") {
	BunRuntime.runMain(
		Effect.all(
			[
				// outreach pipeline
				gmailLabelCron,
				CloneService,

				// mining
				recursiveImportCron,
				ManualMiningService,

				// T5Cron,
				detectCaptionLangCron,
				findGermanCaptionAccountsCron,
				// updateOutdatedCron,
				findMissingCountriesCron,
				getMissedPublicEmailsCron,
				// PhiCron,
				// CatCron,

				// slack notifs
				// lowBalanceNotifyCron,

				// email
				emailVerificationLoop,
				markBadEmailCron,
				autoForwardingFilterCron,
				instantlyLeadStatsSyncCron,

				// database:
				refreshViewsCron,
                 // UK Opener 2 Triggers
				// runCampaignSubmissionWorkerUK(),
				// runEmailGenerationWorkerUK(30),

				


				// triggers for new DE campaigns
					// runDynamicLeadManager(),
				// runCampaignSubmissionWorker(),
				// runEmailGenerationWorker(50),

				// // //triggerDE
				// runDynamicLeadManagerDE(),
				// runCampaignSubmissionWorkerDE(),
				// runEmailGenerationWorkerDE(50),

				// // followupGenerationCron,

                //Keywords triggers
				// runCampaignSubmissionWorkerKeywords(),
				// runEmailGenerationWorkerKeywords(5),

				// Pipedrive with new prompts data insertion logic
				// followupGenerationNewCron,
				//import-accounts-to-email-sequence-cron
				importAccountsToEmailSequenceCron,
				// importAccountsToEmailSequenceCronKeywords,
				importAccountsToEmailSequenceCronKeywordsWithHashtags,

				//pipedrive followup generation
				// followupGenerationNewCron,
				// runEmailGenerationWorkerKeywordspipedrive(2),
				// runCampaignSubmissionWorkerKeywordspipedrive(),

				
			],
			{
				concurrency: "unbounded",
			},
		),
	);
} else if (node_env === "development") {
	console.log(
		"Running in development mode: Mining services and CloneService will run.",
	);
	console.log("Services included:");
	console.log("  - ManualMiningService (processes ManualMiningQueue)");
	console.log("  - recursiveImportCron (mines accounts from post comments)");
	console.log("  - CloneService:");
	console.log("    • GPT Qualifier Service");
	console.log("    • Fill Clone Tasks (every 4 minutes)");
	console.log("    • Profile Pictures Handler (every 5 minutes)");
	console.log("    • GPT Name Variations (every 5 minutes)");
	console.log("");
	BunRuntime.runMain(
		Effect.all([ManualMiningService, recursiveImportCron, CloneService], {
			concurrency: "unbounded",
		}),
	);
}
