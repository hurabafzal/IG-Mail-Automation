import { Elysia, t } from "elysia";
import { z } from "zod";
import { env } from "../env";
import { auth } from "../lucia";
import { authRouter } from "./auth";
import { cloneRouter } from "./clone.api";
import { dashboardRouter } from "./dashboard";
import { mineRouter } from "./mine.api";
import { outreachRouter } from "./outreach";
import { triggersRouter } from "./triggers";


import { FiltercloneRouter } from "./filter_clone.api";
import { promptsRouter } from "./prompts";

import { statsRouter } from "./stats";
// import { FiltercloneRouter } from "./filter_clone.api";
console.log("NODE_ENV", env.NODE_ENV);

export const app = new Elysia({
	serve: {
		idleTimeout: 60,
	},
})
	.onError(({ code, error }) => {
		console.log("error", code, error);
		if (code === "VALIDATION") return error.message;
	})
	.use(authRouter)
	// .use(swagger())
	.all(
		"/action/set-theme",
		({ body, cookie }) => {
			const theme = z
				.object({
					theme: z.string(),
				})
				.parse(JSON.parse(body)).theme;
			const isProduction = env.NODE_ENV === "production";
			cookie.theme.set({
				value: theme,
				path: "/",
				httpOnly: true,
				sameSite: "lax",
				// Set domain and secure only if in production
				...(isProduction
					? { domain: "data.highonlikes.com", secure: true }
					: {}),
			});
		},
		{
			body: t.String(),
		},
	)
	////////////////////////
	//  WITHOUT AUTH ABOVE 👆
	////////////////////////
	.onBeforeHandle(async ({ request, set }) => {
		const url = new URL(request.url);
		if (
			url.pathname.startsWith("/build") ||
			url.pathname.startsWith("/public") ||
			url.pathname === "/login" ||
			url.pathname === "/favicon.ico"
		) {
			return;
		}
		const authRequest = auth.handleRequest({ request, set });
		const session = await authRequest.validate();
		if (
			!session &&
			!url.pathname.startsWith("/api") &&
			!url.pathname.startsWith("/auth")
		) {
			console.log(
				`no session for ${url.pathname} with method ${request.method}, redirect to login`,
			);
			set.status = 302;
			set.redirect = "/login";
			return "Unauthorized";
		}

		if (!session) {
			console.log("no session! return a 401");
			set.status = 401;
			return "Unauthorized";
		}
	})
	////////////////////////
	//  WITH AUTH  BELOW 👇
	////////////////////////
	.use(dashboardRouter)
	.use(outreachRouter)
	.use(triggersRouter)
	.use(cloneRouter)
	.use(mineRouter)
	.use(promptsRouter)
	.use(statsRouter)
	.use(FiltercloneRouter);
// .use(FiltercloneRouter);
