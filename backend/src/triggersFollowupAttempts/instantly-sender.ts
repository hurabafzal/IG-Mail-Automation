import { Effect, Schedule, Schema, pipe } from "effect";
import type { Selectable, Updateable } from "kysely";
import { db } from "../db";
import {
	type EmailSequence,
	EmailSequenceStage,
	GeneratedEmailType,
	InstantlyLeadStatus,
	OpenAIRequestStatus,
} from "../db/db_types";
import { env } from "../env";
import { getMainLanguageByCountry } from "../triggers/prompt-manager";
// Custom error types following the codebase pattern
class InstantlyAPIError {
	readonly _tag = "InstantlyAPIError";
	constructor(
		public readonly message: string,
		public readonly statusCode?: number,
		public readonly cause?: unknown,
	) {}
}

class EmailValidationError {
	readonly _tag = "EmailValidationError";
	constructor(
		public readonly message: string,
		public readonly email: string,
		public readonly cause?: unknown,
	) {}
}

/**
 * Handles sequence processing errors with specific logic for different error types
 */
function handleSequenceError(
	sequenceData: SequenceForCampaign,
	error: unknown,
) {
	return Effect.gen(function* () {
		const sequenceId = sequenceData.sequence.id;
		const username = sequenceData.account.username;

		if (error instanceof InstantlyAPIError) {
			const errorMessage = error.message.toLowerCase();

			// Handle "Lead is in blocklist" errors
			if (errorMessage.includes("lead is in blocklist")) {
				console.log(
					`⚠️ Sequence ${sequenceId} (${username}): Lead is in blocklist, marking as failed`,
				);

				yield* advanceToStage(sequenceId, EmailSequenceStage.SEQUENCE_FAILED, {
					stageNumber: sequenceData.sequence.current_stage_number,
				});
				return;
			}

			// Handle "Invalid email address" errors
			if (errorMessage.includes("invalid email address")) {
				console.log(
					`❌ Sequence ${sequenceId} (${username}): Invalid email address (${sequenceData.email}), marking as failed`,
				);

				yield* advanceToStage(sequenceId, EmailSequenceStage.SEQUENCE_FAILED, {
					stageNumber: sequenceData.sequence.current_stage_number,
				});
				return;
			}

			// Handle other API errors
			console.error(
				`🚨 Sequence ${sequenceId} (${username}): InstantlyAPI error (${error.statusCode}): ${error.message}`,
			);
		} else {
			// Handle non-Instantly API errors
			console.error(
				`💥 Sequence ${sequenceId} (${username}): Unexpected error:`,
				error,
			);
		}
	});
}

/**
 * Instantly campaign configuration by country and email type
 */
const instantlyCampaigns = {
	DE: {
		openers: {
			1: "d219c6ee-1711-44bb-940f-eaf00c00849e", // 🇩🇪 Campaign 1
			2: "d219c6ee-1711-44bb-940f-eaf00c00849e", // 🇩🇪 Campaign 2 (New)
			3: "",
		},
		triggers: {
			1: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
			2: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
			3: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
		},
	},
	US: {
		openers: {
			1: "b2b0fe45-b1b9-4d98-a8c5-0709a95496da", // 🇺🇸 Campaign 1
			2: "",
			3: "",
		},
		triggers: {
			1: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
			2: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
			3: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
		},
	},
	UK: {
		openers: {
			1: "90eac56a-7b45-4fb9-b0c9-d1f57c5b5ce9", // 🇬🇧 Campaign 1
			2: "",
			3: "",
		},
		triggers: {
			1: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
			2: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
			3: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
		},
	},
	NL: {
		openers: {
			1: "68e429a3-dcea-4bb5-bc3d-527b7840ac82", // 🇳🇱 Campaign 1
			2: "",
			3: "",
		},
		triggers: {
			1: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
			2: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
			3: {
				followingChange: "",
				followerDrop: "",
				hiddenLikes: "",
			},
		},
	},
} as const;

const CreateLeadResponseSchema = Schema.Struct({
	id: Schema.String,
});

const decodeCreateLeadResponse = Schema.decodeUnknown(CreateLeadResponseSchema);

// Type definitions for campaign data structures
interface CampaignEmailRequest {
	id: number;
	email_type: GeneratedEmailType;
	email_type_number: number;
	// Parsed XML fields
	parsed_subject: string | null;
	parsed_email: string | null;
	parsed_follow_up: string | null;
}

interface CampaignAccount {
	username: string;
	first_name: string | null;
	ig_full_name: string;
	followers_count: number;
	bio: string;
	ig_category_enum: string | null;
	is_verified: boolean | null;
	country: string | null; // Country code or name
}

interface SequenceForCampaign {
	sequence: Selectable<EmailSequence>;
	emailRequest: CampaignEmailRequest;
	email: string | null;
	account: CampaignAccount;
}
import { db as baseDb } from "backend/src/db";
import { type Kysely, sql } from "kysely";
import { sendSlackMessageE } from "../utils/slack";
type FilterCloneTaskRow = {
	id: number | string;
	title: string | null;
	target: number | null;
	target_male: number | null;
	target_female: number | null;
	target_country: string | null;
	createdAt: Date | string | null;
	keywords: string | null;
	min_followers: number;
	max_followers: number;
	post_date: Date | string | null;
	result_limit: number | null;
	found: number | null;
	is_active: boolean | null;
	maxPerDay: number | null;
	instalnty_id?: number; // <-- Added property
};

type ExtraTables = {
	FilterCloneTask: FilterCloneTaskRow;
};
/**
 * Main worker function to process campaign submissions
 */
export function runCampaignSubmissionWorkerKeywordspipedrive() {
	return Effect.gen(function* () {
		const db = baseDb as unknown as Kysely<ExtraTables>;

		const activeFilterCloneTasks = [
			{
				id: 200,
				country: "Germany",
				is_active: true,
				instalnty_id: "91e7ae07-e89a-4a1c-aa3c-857a347cfd97",
			},
			{
				id: 300,
				country: "Netherlands",
				is_active: true,
				instalnty_id: "91e7ae07-e89a-4a1c-aa3c-857a347cfd97",
			},
			{
				id: 400,
				country: "United Kingdom",
				is_active: true,
				instalnty_id: "91e7ae07-e89a-4a1c-aa3c-857a347cfd97",
			},
			{
				id: 500,
				country: "United States",
				is_active: true,
				instalnty_id: "91e7ae07-e89a-4a1c-aa3c-857a347cfd97",
			},
		];

		for (const task of activeFilterCloneTasks) {
			console.log(`Active FilterCloneTask: ${task.id}`);
			console.log("🚀 Starting Campaign Submission Worker");

			// Get sequences ready for campaign submission
			const sequencesReady = yield* getSequencesReadyForCampaign(
				Number(task.id),
			);

			if (sequencesReady.length === 0) {
				console.log("No sequences ready for campaign submission");
				return;
			}

			console.log(
				`Processing ${sequencesReady.length} sequences for campaign submission`,
			);

			// Process each sequence
			for (const sequenceData of sequencesReady) {
				const result = yield* Effect.either(
					processSequenceForCampaign(sequenceData, task.instalnty_id),
				);

				if (result._tag === "Left") {
					yield* handleSequenceError(sequenceData, result.left);
				}
			}

			console.log("✓ Campaign submission worker cycle complete");
		}
	}).pipe(
		Effect.catchAll((e) => {
			console.error("Error processing batch refresh:", e);
			return Effect.succeed(undefined);
		}),
		Effect.catchAllDefect((e) => {
			console.error("Error processing campaign submission:", e);
			return Effect.succeed(undefined);
		}),
		Effect.repeat(Schedule.spaced("1 minutes")),
	);
}

/**
 * Advances a sequence to the next stage
 */
function advanceToStage(
	sequenceId: number,
	newStage: EmailSequenceStage,
	options: {
		stageNumber?: number;
		nextActionPossibleAt?: Date;
		triggerWindowEndsAt?: Date | null;
		lastInstantlyCampaignCompletedAt?: Date;
	} = {},
) {
	return Effect.gen(function* () {
		const updateData: Updateable<EmailSequence> = {
			current_stage: newStage,
			stage_entered_at: new Date(),
			updated_at: new Date(),
		};

		if (options.stageNumber !== undefined) {
			updateData.current_stage_number = options.stageNumber;
		}
		if (options.nextActionPossibleAt !== undefined) {
			updateData.next_action_possible_at = options.nextActionPossibleAt;
		}
		if (options.triggerWindowEndsAt !== undefined) {
			updateData.trigger_window_ends_at = options.triggerWindowEndsAt;
		}
		if (options.lastInstantlyCampaignCompletedAt !== undefined) {
			updateData.last_instantly_campaign_completed_at =
				options.lastInstantlyCampaignCompletedAt;
		}

		return yield* db
			.updateTable("EmailSequence")
			.set(updateData)
			.where("id", "=", sequenceId)
			.returningAll()
			.executeTakeFirstOrThrowE();
	});
}

/**
 * Country to campaign region mapping
 */
const countryToCampaignRegion: Record<string, keyof typeof instantlyCampaigns> =
	{
		// German-speaking countries
		Germany: "DE",
		Austria: "DE",
		Switzerland: "DE",
		GERMAN_CAPTIONS: "DE",

		// United States
		"United States": "US",

		// United Kingdom
		"United Kingdom": "UK",

		// Netherlands and Belgium
		Netherlands: "NL",
		Belgium: "NL",
	} as const;

/**
 * Maps country names to campaign region codes
 */
function getCountryCampaignRegion(
	country: string | null,
): keyof typeof instantlyCampaigns {
	if (!country) return "DE"; // Default to German campaigns

	return countryToCampaignRegion[country] || "DE"; // Default to German campaigns for unknown countries
}

/**
 * Campaign ID mapping based on email type, stage, and country
 */
function getCampaignIdForSequence(
	emailType: GeneratedEmailType,
	stageNumber: number,
	country: string | null,
	instalnty_id?: number,
): string {
	const region = getCountryCampaignRegion(country);

	// const campaigns = instantlyCampaigns[region];

	// If a stage (FilterCloneTask id) is provided, try to get the campaign id from the database

	// const campaigns = instantlyCampaigns[region];
	const campaigns = {
		openers: {
			1: `${instalnty_id}`,
			2: "",
			3: "",
		},
		triggers: {
			1: { followingChange: "", followerDrop: "", hiddenLikes: "" },
			2: { followingChange: "", followerDrop: "", hiddenLikes: "" },
			3: { followingChange: "", followerDrop: "", hiddenLikes: "" },
		},
	} as const;
	console.log(campaigns);
	// For openers, use the main campaign
	if (emailType === GeneratedEmailType.OPENER) {
		const campaignId =
			campaigns.openers[stageNumber as keyof typeof campaigns.openers];
		if (!campaignId) {
			throw new Error(
				`No opener campaign found for stage ${stageNumber} in region ${region}`,
			);
		}
		return campaignId;
	}

	// For triggers, use specific subsequences
	const triggerCampaigns =
		campaigns.triggers[stageNumber as keyof typeof campaigns.triggers];
	if (!triggerCampaigns) {
		throw new Error(
			`No trigger campaigns found for stage ${stageNumber} in region ${region}`,
		);
	}

	if (emailType === GeneratedEmailType.TRIGGER_FOLLOWER_LOSS) {
		return triggerCampaigns.followerDrop;
	}
	if (emailType === GeneratedEmailType.TRIGGER_FOLLOWING_INCREASE) {
		return triggerCampaigns.followingChange;
	}
	if (emailType === GeneratedEmailType.TRIGGER_HIDDEN_LIKES) {
		return triggerCampaigns.hiddenLikes;
	}
	throw new Error(`Unknown trigger email type: ${emailType}`);
}
function getSubjectForLanguage(username: string, language: string): string {
	switch (language) {
		case "Dutch":
			return `Samenwerkingskans voor @${username}`;
		case "English":
			return `Collaboration Request(s) for @${username}`;
		default:
			// German (and fallback)
			return `Kooperationsanfrage(n) für @${username}`;
	}
}
function capitalizeName(name: string | null | undefined): string {
	if (!name) return "";
	return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
/**
 * Builds variables object for Instantly campaign personalization
 */
function buildCampaignVariables(
	account: CampaignAccount,
	emailRequest: CampaignEmailRequest,
) {
	// console.log(emailsRequest);
	if (
		!emailRequest.parsed_subject ||
		!emailRequest.parsed_email ||
		!emailRequest.parsed_follow_up
	) {
		console.error("Email request is missing required fields", emailRequest);
		return null;
	}

	const language = getMainLanguageByCountry(account.country ?? "Germany");

	return {
		first_name: capitalizeName(
			account.first_name || account.ig_full_name || account.username,
		),
		username: account.username,
		followers_count: account.followers_count?.toString() || "0",
		bio: account.bio || "",
		subject: getSubjectForLanguage(account.username, language) || "Follow up",
		body1: emailRequest.parsed_email || "",
		body2: emailRequest.parsed_follow_up || "",
		is_verified: account.is_verified ? "true" : "false",
	};
}

/**
 * Makes authenticated request to Instantly.ai API with schema validation
 */
function makeInstantlyRequest<T>(
	endpoint: string,
	decoder: (input: unknown) => Effect.Effect<T, unknown>,
	options: RequestInit = {},
): Effect.Effect<T, InstantlyAPIError> {
	return Effect.gen(function* () {
		const url = `https://api.instantly.ai${endpoint}`;

		const response = yield* Effect.tryPromise({
			try: () =>
				fetch(url, {
					...options,
					headers: {
						Authorization: `Bearer ${env.INSTANTLY_KEY}`,
						"Content-Type": "application/json",
						...options.headers,
					},
				}),
			catch: (error) =>
				new InstantlyAPIError("Network request failed", undefined, error),
		});

		if (!response.ok) {
			const errorText = yield* pipe(
				Effect.tryPromise(() => response.text()),
				Effect.catchAll(() => Effect.succeed("Unknown error")),
			);

			return yield* Effect.fail(
				new InstantlyAPIError(
					`Instantly API error: ${response.status} ${
						response.statusText
					} - ${errorText.slice(0, 200)}`,
					response.status,
				),
			);
		}

		const jsonData = yield* Effect.tryPromise({
			try: () => response.json(),
			catch: (error) =>
				new InstantlyAPIError(
					"Failed to parse JSON response",
					undefined,
					error,
				),
		});

		// Validate response with schema
		const validatedData = yield* decoder(jsonData).pipe(
			Effect.mapError(
				(error) =>
					new InstantlyAPIError(
						`Invalid response format: ${error}`,
						undefined,
						error,
					),
			),
		);

		return validatedData;
	});
}

/**
 * Creates a new lead in Instantly.ai campaign
 */
export function createInstantlyLead(
	campaignId: string,
	email: string,
	variables: Record<string, string>,
): Effect.Effect<string, InstantlyAPIError> {
	return Effect.gen(function* () {
		const response = yield* makeInstantlyRequest(
			"/api/v2/leads",
			decodeCreateLeadResponse,
			{
				method: "POST",
				body: JSON.stringify({
					campaign: campaignId,
					email,
					verify_leads_on_import: true,
					custom_variables: variables,
				}),
			},
		);

		console.log(`✓ Created lead ${response.id} in campaign ${campaignId}`);
		return response.id;
	});
}
/**
 * Removes one or more emails from Instantly blocklist (v1 endpoint)
 */

function removeFromInstantlyBlocklist(email: string) {
	return Effect.gen(function* () {
		console.log(`

 Removing ${email} from Instantly blocklist...`);

		try {
			// Step 1: Search blocklist for the email (fast lookup using search parameter)
			const searchUrl = `https://api.instantly.ai/api/v2/block-lists-entries?search=${encodeURIComponent(email)}`;
			const searchResponse = yield* Effect.tryPromise({
				try: () =>
					fetch(searchUrl, {
						method: "GET",
						headers: {
							Authorization: `Bearer ${env.INSTANTLY_KEY}`,
							"Content-Type": "application/json",
						},
					}),
				catch: (error) =>
					new Error(`Failed to search Instantly blocklist: ${error}`),
			});

			if (!searchResponse.ok) {
				console.log(
					`

 Instantly API returned ${searchResponse.status}, email may not be in blocklist`,
				);
				return { email, removed: false };
			}

			const blocklistData = (yield* Effect.tryPromise({
				try: () => searchResponse.json(),
				catch: (error) =>
					new Error(`Failed to parse Instantly blocklist response: ${error}`),
			})) as {
				items?: Array<{ id: string; bl_value: string }>;
			};

			// Find entry with exact email match (search may return partial matches)
			const foundEntry =
				blocklistData.items?.find(
					(item: { id: string; bl_value: string }) =>
						item.bl_value.toLowerCase() === email.toLowerCase(),
				) || null;

			if (!foundEntry) {
				console.log(
					`Email ${email} not found in Instantly blocklist (may not have been blacklisted)`,
				);
				return { email, removed: false };
			}

			const entryId = foundEntry.id;
			console.log(`

 Found blocklist entry ID: ${entryId}`);

			// Step 2: DELETE the blocklist entry
			const deleteResponse = yield* Effect.tryPromise({
				try: () =>
					fetch(
						`https://api.instantly.ai/api/v2/block-lists-entries/${entryId}`,
						{
							method: "DELETE",
							headers: {
								Authorization: `Bearer ${env.INSTANTLY_KEY}`,
							},
						},
					),
				catch: (error) =>
					new Error(`Failed to delete from Instantly blocklist: ${error}`),
			}).pipe(
				Effect.catchAll((error) => {
					// Log error but don't fail the entire process
					console.error(
						`

 Error removing ${email} from Instantly blocklist:`,
						error,
					);
					return Effect.gen(function* () {
						yield* sendSlackMessageE(
							`Warning: Failed to remove ${email} from Instantly blocklist: ${error}`,
						);
						return null;
					});
				}),
			);

			if (deleteResponse?.ok) {
				console.log(`✓ Removed ${email} from Instantly blocklist`);
				return { email, removed: true };
			}

			return { email, removed: false };
		} catch (error) {
			// Log error but don't fail the entire process
			console.error(
				`

 Error removing ${email} from Instantly blocklist:`,
				error,
			);
			yield* sendSlackMessageE(
				`Warning: Failed to remove ${email} from Instantly blocklist: ${error}`,
			);
			return { email, removed: false };
		}
	});
}
/**
 * Processes a single sequence for campaign submission
 */
function processSequenceForCampaign(
	sequenceData: SequenceForCampaign,
	instalnty_id?: string,
) {
	return Effect.gen(function* () {
		console.log(instalnty_id);
		const {
			sequence,
			emailRequest,
			email: emailAddress,
			account,
		} = sequenceData;

		// Skip if no email available
		if (!emailAddress) {
			console.log(`Skipping sequence ${sequence.id} - no email available`);
			return;
		}

		console.log(emailRequest);
		// Get target campaign ID
		// const campaignId = getCampaignIdForSequence(
		// 	emailRequest.email_type,
		// 	emailRequest.email_type_number,
		// 	account.country,
		// 	instalnty_id,
		// );
		const campaignId = `${instalnty_id}`;
		// Build personalization variables
		const variables = buildCampaignVariables(account, emailRequest);
		console.log(variables);
		if (!variables) {
			console.error(
				`Skipping sequence ${sequence.id} - no variables available`,
			);
			return yield* Effect.fail(
				new EmailValidationError(
					"Email request is missing required fields",
					emailAddress,
				),
			);
		}
		// yield* removeFromInstantlyBlocklist(emailAddress);

		// Create new lead
		const instantlyLeadId = yield* createInstantlyLead(
			campaignId,
			emailAddress,
			variables,
		);

		const emailObject = yield* db
			.selectFrom("Email")
			.selectAll()
			.where("email", "=", emailAddress)
			.executeTakeFirstOrThrowE();

		// Create InstantlyLead record using correct schema fields
		yield* db
			.insertInto("InstantlyLead")
			.values({
				email_sequence_id: sequence.id,
				email_id: emailObject.id,
				instantly_campaign_id: campaignId,
				instantly_lead_id: instantlyLeadId,
				email_address: emailAddress,
				status: InstantlyLeadStatus.ACTIVE,
				timestamp_last_contact: null,
				timestamp_last_open: null,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.onConflict((o) => o.doNothing())
			.executeE();

		console.log(
			`✓ Created new lead ${instantlyLeadId} in campaign ${campaignId}`,
		);

		// Advance sequence to awaiting campaign completion
		if (emailRequest.email_type === GeneratedEmailType.OPENER) {
			// After opener submission, wait for campaign completion
			yield* advanceToStage(
				sequence.id,
				EmailSequenceStage.OPENER_SENT_AWAITING_COMPLETION,
				{
					stageNumber: sequence.current_stage_number,
				},
			);
		} else {
			// After trigger submission, wait for campaign completion
			yield* advanceToStage(
				sequence.id,
				EmailSequenceStage.TRIGGER_EMAIL_SENT_AWAITING_COMPLETION,
				{
					stageNumber: sequence.current_stage_number,
				},
			);
		}

		console.log(`✓ Processed sequence ${sequence.id} for ${account.username}`);
	});
}

// XML tag parser function (similar to prompt-test.ts)
function parseXmlTag(content: string, tag: string): string | null {
	const regex = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\/${tag}>`, "m");
	const match = content.match(regex);
	return match ? match[1].trim() : null;
}

/**
 * Gets sequences ready for campaign submission (with completed email generation)
 */
function getSequencesReadyForCampaign(stage?: number) {
	const readyStages = [
		EmailSequenceStage.OPENER_PENDING_SEND,
		EmailSequenceStage.TRIGGER_EMAIL_PENDING_SEND,
	];

	return db
		.selectFrom("EmailSequence")
		.innerJoin(
			"GeneratedEmailRequest",
			"EmailSequence.id",
			"GeneratedEmailRequest.email_sequence_id",
		)
		.innerJoin(
			"InstagramAccountBase",
			"EmailSequence.instagram_account_id",
			"InstagramAccountBase.id",
		)
		.selectAll("EmailSequence")
		.select([
			"GeneratedEmailRequest.id as request_id",
			"GeneratedEmailRequest.email_type",
			"GeneratedEmailRequest.email_type_number",
			"GeneratedEmailRequest.generated_body",
			"GeneratedEmailRequest.recipient_email as email",
			"InstagramAccountBase.username",
			"InstagramAccountBase.first_name",
			"InstagramAccountBase.ig_full_name",
			"InstagramAccountBase.followers_count",
			"InstagramAccountBase.bio",
			"InstagramAccountBase.ig_category_enum",
			"InstagramAccountBase.is_verified",
			"InstagramAccountBase.country",
		])
		.where("EmailSequence.current_stage", "in", readyStages)
		.where("EmailSequence.current_stage_number", "=", stage ?? 2)
		.where("GeneratedEmailRequest.status", "=", OpenAIRequestStatus.COMPLETED)
		.where("GeneratedEmailRequest.generated_body", "is not", null)
		.executeE()
		.pipe(
			Effect.map(
				(results) =>
					results.map((row) => {
						// Parse XML content from generated_body
						const generatedBody = row.generated_body || "";
						const parsed_subject = parseXmlTag(generatedBody, "subject");
						const parsed_email = parseXmlTag(generatedBody, "email");
						const parsed_follow_up = parseXmlTag(generatedBody, "follow_up");

						return {
							sequence: {
								id: row.id,
								email: row.email,
								sequence_id: row.sequence_id,
								instagram_account_id: row.instagram_account_id,
								current_stage: row.current_stage,
								current_stage_number: row.current_stage_number,
								stage_entered_at: row.stage_entered_at,
								next_action_possible_at: row.next_action_possible_at,
								trigger_window_ends_at: row.trigger_window_ends_at,
								last_instantly_campaign_completed_at:
									row.last_instantly_campaign_completed_at,
								created_at: row.created_at,
								updated_at: row.updated_at,
							},
							emailRequest: {
								id: row.request_id,
								email_type: row.email_type,
								email_type_number: row.email_type_number,
								// Parsed XML fields
								parsed_subject,
								parsed_email,
								parsed_follow_up,
							},
							email: row.email,
							account: {
								username: row.username,
								first_name: row.first_name,
								ig_full_name: row.ig_full_name,
								followers_count: row.followers_count,
								bio: row.bio,
								ig_category_enum: row.ig_category_enum,
								is_verified: row.is_verified,
								country: row.country || "Germany", // Default to Germany if not set
							},
						};
					}) satisfies SequenceForCampaign[],
			),
		);
}
