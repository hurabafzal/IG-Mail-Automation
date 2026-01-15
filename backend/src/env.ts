import { z } from "zod";

const envSchema = z.object({
	// general
	NODE_ENV: z.enum(["development", "production", "test"]),
	PORT: z.coerce.number().optional(),
	WEBHOOK_KEY: z.string(),
	REDIS_URL: z.string().min(1),
	EMAIL_KEY: z.string().min(1),
	PIPEDRIVE_CLIENT_ID: z.string().min(1),
	PIPEDRIVE_CLIENT_SECRET: z.string().min(1),
	PIPEDRIVE_API_KEY: z.string().min(1),

	// external services
	ME_SLACK_URL: z.string().url(),
	NILS_SLACK_URL: z.string().url(),
	WEBHOOK_SECRET: z.string(),
	CALENDLY_KEY: z.string(),

	MIXMAX_KEY: z.string().min(1),
	INSTANTLY_KEY: z.string().min(1),

	// DB
	DATABASE_URL: z.string().min(1),
	DATABASE_HOST: z.string().min(1),
	DATABASE_USERNAME: z.string().min(1),
	DATABASE_PASSWORD: z.string().min(1),
	DATABASE_PORT: z.coerce.number(),

	// google
	GOOGLE_CLIENT_ID: z.string(),
	GMAIL_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),
	GMAIL_CLIENT_SECRET: z.string(),
	GOOGLE_CALLBACK_URL: z.string(),
	GMAIL_CALLBACK_URL: z.string(),

	// brightdata
	BRIGHTDATA_API_KEY: z.string(),
	BRIGHTDATA_ACCOUNT_ID: z.string(),
	BRIGHTDATA_ZONE: z.string(),

	// proxy
	PROXY_URL: z.string().min(1),
	PROXY_USERNAME: z.string().min(1),
	PROXY_PASSWORD: z.string().min(1),
	PROXY_LIST: z.string().min(1),
	// hikerapi (instagram)
	LAMADAVA_KEY: z.string().min(1),
	LAMADAVA_URL: z.string().min(1),

	RUNPOD_KEY: z.string(),
	STRIPE_KEY: z.string(),

	// INSTAGRAM_DB_URL: z.string().url(),

	OPEN_AI_API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
