import z from "zod";

const envSchema = z.object({
	NODE_ENV: z.string(),
	AUTH_SECRET: z.string(),
	WEBHOOK_KEY: z.string(),
	GOOGLE_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),
	GOOGLE_CALLBACK_URL: z.string(),
	HUBSPOT_TOKEN: z.string(),
});
export const env = envSchema.parse(process.env);
