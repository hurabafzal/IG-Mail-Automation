import { Console, Effect, Schedule, Schema, pipe } from "effect";
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
import { sendSlackMessageE } from "../utils/slack";
import { getMainLanguageByCountry } from "./prompt-manager";

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
	parsed_follow_up_1: string | null;
	parsed_follow_up_2: string | null;
	parsed_follow_up_3: string | null;
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

// Campaign configuration
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
): string {
	const region = getCountryCampaignRegion(country);
	const campaigns = instantlyCampaigns[region];

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

// XML tag parser function (similar to prompt-test.ts)
function parseXmlTag(content: string, tag: string): string | null {
	const regex = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\/${tag}>`, "m");
	const match = content.match(regex);
	return match ? match[1].trim() : null;
}

/**
 * Builds variables object for Instantly campaign personalization
 */
function buildCampaignVariables(
	account: CampaignAccount,
	emailRequest: CampaignEmailRequest,
) {
	if (
		!emailRequest.parsed_subject ||
		!emailRequest.parsed_email ||
		!emailRequest.parsed_follow_up_1 ||
		!emailRequest.parsed_follow_up_2 ||
		!emailRequest.parsed_follow_up_3
	) {
		console.error("Email request is missing required fields", emailRequest);
		return null;
	}

	const language = getMainLanguageByCountry(account.country ?? "Germany");

	return {
		first_name: account.first_name || account.ig_full_name || account.username,
		username: account.username,
		followers_count: account.followers_count?.toString() || "0",
		bio: account.bio || "",
		subject: getSubjectForLanguage(account.username, language) || "Follow up",
		body1: emailRequest.parsed_email || "",
		body2: emailRequest.parsed_follow_up_1 || "",
		body3: emailRequest.parsed_follow_up_2 || "",
		body4: emailRequest.parsed_follow_up_3 || "",
		category: account.ig_category_enum || "",
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
 * JSON stringify with Unicode preservation for Instantly API
 */
function stringifyForInstantly(obj: Record<string, unknown>): string {
	// Use Buffer to ensure UTF-8 encoding
	return Buffer.from(JSON.stringify(obj), "utf8").toString("utf8");
}

/**
 * Creates a new lead in Instantly.ai campaign
 */
function createInstantlyLead(
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
				body: stringifyForInstantly({
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
 * Gets sequences ready for campaign submission (with completed email generation)
 */
function getSequencesReadyForCampaign() {
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
		.where("EmailSequence.current_stage_number", "=", 2)
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
						const parsed_follow_up_1 = parseXmlTag(
							generatedBody,
							"follow_up_1",
						);
						const parsed_follow_up_2 = parseXmlTag(
							generatedBody,
							"follow_up_2",
						);
						const parsed_follow_up_3 = parseXmlTag(
							generatedBody,
							"follow_up_3",
						);

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
								parsed_follow_up_1,
								parsed_follow_up_2,
								parsed_follow_up_3,
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

/**
 * Removes all existing active leads for an email from ALL campaigns (including target campaign)
 */
function removeLeadFromAllCampaigns(
	email: string,
	newCampaignId: string,
): Effect.Effect<number, Error> {
	return Effect.gen(function* () {
		// Find ALL active leads for this email (including in the target campaign)
		const existingLeads = yield* db
			.selectFrom("InstantlyLead")
			.selectAll()
			.where("email_address", "=", email)
			.where("status", "=", InstantlyLeadStatus.ACTIVE)
			.executeE()
			.pipe(Effect.mapError((error) => new Error(`Database error: ${error}`)));

		console.log(
			`Found ${existingLeads.length} existing active leads for ${email}`,
		);

		let removedCount = 0;
		// Remove each lead from Instantly API
		for (const lead of existingLeads) {
			console.log(
				`Removing lead ${lead.instantly_lead_id} from campaign ${lead.instantly_campaign_id}`,
			);

			const deleteResult = yield* Effect.tryPromise({
				try: () =>
					fetch(
						`https://api.instantly.ai/api/v2/leads/${lead.instantly_lead_id}`,
						{
							method: "DELETE",
							headers: {
								Authorization: `Bearer ${env.INSTANTLY_KEY}`,
							},
						},
					).then(async (res) => {
						if (!res.ok) {
							const errorText = await res.text().catch(() => "Unknown error");
							throw new Error(
								`Instantly API error: ${res.status} ${res.statusText} - ${errorText}`,
							);
						}
						return res.ok;
					}),
				catch: (error) =>
					new Error(
						`Failed to delete lead ${lead.instantly_lead_id}: ${error}`,
					),
			});

			if (deleteResult) {
				// Update database status
				yield* db
					.updateTable("InstantlyLead")
					.set({
						status: InstantlyLeadStatus.COMPLETED,
						updated_at: new Date(),
					})
					.where("instantly_lead_id", "=", lead.instantly_lead_id)
					.executeE()
					.pipe(
						Effect.mapError((error) => new Error(`Database error: ${error}`)),
					);

				removedCount++;
				console.log(
					`✓ Removed lead ${lead.instantly_lead_id} from campaign ${lead.instantly_campaign_id}`,
				);
			}
		}

		return removedCount;
	});
}

/**
 * Processes a single sequence for campaign submission
 */
function processSequenceForCampaign(sequenceData: SequenceForCampaign) {
	return Effect.gen(function* () {
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

		// Get target campaign ID
		const campaignId = getCampaignIdForSequence(
			emailRequest.email_type,
			emailRequest.email_type_number,
			account.country,
		);

		// Build personalization variables
		const variables = buildCampaignVariables(account, emailRequest);

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

		// NEW: Remove from ALL campaigns first (including target campaign)
		const removedCount = yield* removeLeadFromAllCampaigns(
			emailAddress,
			campaignId,
		);

		if (removedCount > 0) {
			console.log(
				`🗑️ Removed ${removedCount} existing leads for ${emailAddress} before adding to campaign ${campaignId}`,
			);
		}

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
			.executeE()
			.pipe(Effect.mapError((error) => new Error(`Database error: ${error}`)));

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

/**
 * Adds new leads to Instantly (sequences ready for sending) - EXACTLY like old system
 */
function addNewLeads(count: number): Effect.Effect<number, Error> {
	return Effect.gen(function* () {
		if (count <= 0) return 0;

		// Get sequences ready for campaign submission - EXACTLY like old system
		const sequencesReady = yield* getSequencesReadyForCampaign().pipe(
			Effect.mapError((error) => new Error(`Database error: ${error}`)),
		);

		if (sequencesReady.length === 0) {
			console.log("No sequences ready for campaign submission");
			return 0;
		}

		console.log(
			`Processing ${Math.min(sequencesReady.length, count)} sequences for campaign submission`,
		);

		// Limit to the requested count
		const limitedSequences = sequencesReady.slice(0, count);

		let addedCount = 0;
		// Process each sequence - EXACTLY like old system
		for (const sequenceData of limitedSequences) {
			const result = yield* Effect.either(
				processSequenceForCampaign(sequenceData),
			);

			if (result._tag === "Right") {
				addedCount++;
			} else {
				console.error(
					`Failed to process sequence ${sequenceData.sequence.id}:`,
					result.left,
				);
			}
		}

		console.log(`✓ Processed ${addedCount} sequences for campaign submission`);
		return addedCount;
	});
}

/**
 * Fetches campaign information from Instantly API
 */
function getInstantlyCampaignInfo(
	campaignId: string,
): Effect.Effect<{ dailyLimit: number; name: string; status: string }, Error> {
	return Effect.gen(function* () {
		const response = yield* Effect.tryPromise({
			try: () =>
				fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}`, {
					method: "GET",
					headers: {
						Authorization: `Bearer ${env.INSTANTLY_KEY}`,
						"Content-Type": "application/json",
					},
				}).then((res) => {
					if (!res.ok) {
						throw new Error(
							`Instantly API error: ${res.status} ${res.statusText}`,
						);
					}
					return res.json();
				}),
			catch: (error) => new Error(`Failed to fetch campaign info: ${error}`),
		});

		return {
			dailyLimit: response.daily_max_leads || response.daily_limit || 100, // Prefer daily_max_leads, fallback to daily_limit
			name: response.name || "Unknown Campaign",
			status: response.status || "active",
		};
	});
}

/**
 * Fetches campaign limits from Instantly API for all active campaigns
 */
function getCampaignLimits(): Effect.Effect<Record<string, number>, Error> {
	return Effect.gen(function* () {
		// Get all unique campaign IDs from the sequences ready for submission
		const sequencesReady = yield* getSequencesReadyForCampaign().pipe(
			Effect.mapError((error) => new Error(`Database error: ${error}`)),
		);

		// Extract unique campaign IDs that will be used
		const campaignIds = new Set<string>();
		for (const sequenceData of sequencesReady) {
			try {
				const campaignId = getCampaignIdForSequence(
					sequenceData.emailRequest.email_type,
					sequenceData.emailRequest.email_type_number,
					sequenceData.account.country,
				);
				campaignIds.add(campaignId);
			} catch (error) {
				// Skip sequences with invalid campaign IDs
				console.warn(
					`Skipping sequence ${sequenceData.sequence.id} - invalid campaign ID: ${error}`,
				);
			}
		}

		// Fetch limits for each campaign
		const limits: Record<string, number> = {};
		for (const campaignId of campaignIds) {
			const campaignInfo = yield* getInstantlyCampaignInfo(campaignId);
			limits[campaignId] = campaignInfo.dailyLimit;
		}

		return limits;
	});
}

/**
 * Gets current active leads count per campaign
 */
function getCurrentActiveLeadsPerCampaign(): Effect.Effect<
	Record<string, number>,
	Error
> {
	return Effect.gen(function* () {
		const activeLeads = yield* db
			.selectFrom("InstantlyLead")
			.select(["instantly_campaign_id", (eb) => eb.fn.count("id").as("count")])
			.where("status", "=", InstantlyLeadStatus.ACTIVE)
			.groupBy("instantly_campaign_id")
			.executeE()
			.pipe(Effect.mapError((error) => new Error(`Database error: ${error}`)));

		const leadsPerCampaign: Record<string, number> = {};
		for (const row of activeLeads) {
			leadsPerCampaign[row.instantly_campaign_id] = Number(row.count);
		}

		return leadsPerCampaign;
	});
}

/**
 * Calculates optimal lead counts based on campaign daily email limits
 * Each lead will receive the full email sequence, so optimal count = daily limit
 */
function calculateOptimalLeadCounts(
	campaignLimits: Record<string, number>,
): Record<string, number> {
	const optimalCounts: Record<string, number> = {};
	for (const [campaignId, dailyLimit] of Object.entries(campaignLimits)) {
		// Optimal lead count equals daily email limit
		// Each lead will receive the full email sequence over time
		optimalCounts[campaignId] = dailyLimit;
	}

	return optimalCounts;
}

/**
 * Adds new leads to Instantly (sequences ready for sending) with campaign-specific limits
 */
function addNewLeadsForCampaign(
	campaignId: string,
	count: number,
): Effect.Effect<number, Error> {
	return Effect.gen(function* () {
		if (count <= 0) return 0;

		// Get sequences ready for campaign submission
		const sequencesReady = yield* getSequencesReadyForCampaign().pipe(
			Effect.mapError((error) => new Error(`Database error: ${error}`)),
		);

		// Filter sequences that will use this specific campaign
		const sequencesForCampaign = sequencesReady.filter((sequenceData) => {
			try {
				const sequenceCampaignId = getCampaignIdForSequence(
					sequenceData.emailRequest.email_type,
					sequenceData.emailRequest.email_type_number,
					sequenceData.account.country,
				);
				return sequenceCampaignId === campaignId;
			} catch {
				return false;
			}
		});

		// Limit to the requested count
		const limitedSequences = sequencesForCampaign.slice(0, count);

		let addedCount = 0;
		// Process each sequence - EXACTLY like old system
		for (const sequenceData of limitedSequences) {
			const result = yield* Effect.either(
				processSequenceForCampaign(sequenceData),
			);

			if (result._tag === "Right") {
				addedCount++;
			} else {
				console.error(
					`Failed to process sequence ${sequenceData.sequence.id}:`,
					result.left,
				);
			}
		}

		return addedCount;
	});
}

/**
 * Main dynamic lead management worker - Smart campaign-aware lead management
 */
export function runDynamicLeadManager(): Effect.Effect<void, Error> {
	return Effect.gen(function* () {
		yield* Console.log("🚀 Starting Dynamic Lead Manager");

		// 1. Get campaign limits from Instantly API
		const campaignLimits = yield* getCampaignLimits();
		if (Object.keys(campaignLimits).length === 0) {
			console.log("No active campaigns found");
			return;
		}

		// 2. Calculate optimal lead counts
		const optimalCounts = calculateOptimalLeadCounts(campaignLimits);

		// 3. Get current active leads per campaign
		const currentLeads = yield* getCurrentActiveLeadsPerCampaign();

		// 4. Process each campaign
		let totalAdded = 0;
		const campaignResults: string[] = [];

		for (const [campaignId, dailyLimit] of Object.entries(campaignLimits)) {
			const currentCount = currentLeads[campaignId] || 0;
			const optimalCount = optimalCounts[campaignId] || 0;

			let added = 0;

			// Add leads if needed (only if under limit)
			if (currentCount < optimalCount) {
				const neededCount = optimalCount - currentCount;
				added = yield* addNewLeadsForCampaign(campaignId, neededCount);
				totalAdded += added;
			}

			// Track results for this campaign
			campaignResults.push(
				`${campaignId.slice(0, 8)}...: ${currentCount}→${currentCount + added} (limit: ${dailyLimit})`,
			);

			yield* Console.log(
				`[Campaign ${campaignId.slice(0, 8)}...] Current: ${currentCount}, Optimal: ${optimalCount}, Added: ${added}`,
			);
		}

		// 5. Send comprehensive Slack notification
		// yield* sendSlackMessageE(
		// 	`[Dynamic Lead Manager] Cycle Complete:\n• Campaigns Managed: ${Object.keys(campaignLimits).length}\n• Total Added: ${totalAdded} leads\n• Campaign Details:\n${campaignResults.map((r) => `  • ${r}`).join("\n")}`,
		// );

		yield* Console.log("✓ Dynamic Lead Manager cycle complete");
	}).pipe(
		Effect.catchAll((e) => {
			console.error("Error in dynamic lead manager:", e);
			return Effect.succeed(undefined);
		}),
		Effect.repeat(Schedule.spaced("30 minutes")), // Run every 30 minutes
	);
}
