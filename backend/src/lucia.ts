import { pg } from "@lucia-auth/adapter-postgresql";
import { google } from "@lucia-auth/oauth/providers";
import { lucia } from "lucia";
import { elysia } from "lucia/middleware";
import { pool } from "./db/db";
import { env } from "./env";
import type { UserAttributes } from "./export";

export const auth = lucia({
	experimental: {
		// debugMode: env.NODE_ENV === "development",
	},
	adapter: pg(pool, {
		user: "user",
		session: "user_session",
		key: "user_key",
	}),
	middleware: elysia(),
	env: env.NODE_ENV === "production" ? "PROD" : "DEV",
	csrfProtection:
		env.NODE_ENV === "production"
			? {
					allowedSubDomains: ["dashboard", "api"],
				}
			: false,
	getUserAttributes: (data) => {
		return {
			username: data.username,
			email: data.email,
			pfp: data.pfp,
		} satisfies UserAttributes;
	},
});

export const googleAuth = google(auth, {
	clientId: env.GOOGLE_CLIENT_ID,
	clientSecret: env.GOOGLE_CLIENT_SECRET,
	redirectUri: env.GOOGLE_CALLBACK_URL,
	scope: [
		"https://www.googleapis.com/auth/userinfo.email",
		"https://www.googleapis.com/auth/userinfo.profile",
		"openid",
	],
});

export type Auth = typeof auth;
