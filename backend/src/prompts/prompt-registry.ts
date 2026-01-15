// import {
// 	buildAngebotPrompt,
// 	buildQualifizierungPrompt,
// } from "../followups/followup-manager";
// import type { FollowupContext } from "../followups/followup-manager";
import {
	startviralGuidelines,
	startviralTriggerEmailSystemPrompt,
	startviralTriggerEmailSystemPromptLanguage,
} from "../triggers/prompt-manager";

export const PromptRegistry = {
	outreach: {
		guidelines: () => startviralGuidelines,
		triggerEmail: (formattedExamples = "") =>
			startviralTriggerEmailSystemPrompt(formattedExamples),
		triggerEmailLanguage: (formattedExamples = "", language = "DE") =>
			startviralTriggerEmailSystemPromptLanguage(formattedExamples, language),
	},
	// followups: {
	//     qualification: (context: FollowupContext) => buildQualifizierungPrompt(context),
	//     offer: (context: FollowupContext) => buildAngebotPrompt(context),
	//     // Add more as needed
	// },
	// Add more as needed
};
