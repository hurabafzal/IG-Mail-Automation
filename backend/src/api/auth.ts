import { OAuthRequestError } from "@lucia-auth/oauth";
import { Effect } from "effect";
import { Elysia } from "elysia";
import { env } from "../env";
import type { UserAttributes } from "../export";
import { getAuthURL, gmailAuthCallback } from "../gmail/auth/oAuthFlow";
import { auth, googleAuth } from "../lucia";

const DASHBOARD_URL =
	env.NODE_ENV === "production"
		? "https://data.highonlikes.com"
		: "http://localhost:3000";

const serializeCookie = (name: string, value: string) => {
	const settings = {
		httpOnly: "HttpOnly",
		secure: env.NODE_ENV === "production" ? "Secure" : "",
		sameSite: "SameSite=Lax",
		path: "Path=/",
		maxAge: "Max-Age=3600",
		domain: env.NODE_ENV === "production" ? "Domain=data.highonlikes.com" : "",
	};
	const settingsString = Object.entries(settings)
		.filter(([, value]) => value)
		.map(([key]) => key)
		.join("; ");

	return `${name}=${value}; ${settingsString}`;
};

export const authRouter = new Elysia({ prefix: "/auth" })
	.get("/gmail", () => Response.redirect(Effect.runSync(getAuthURL)))
	.get("/gmail/callback", async ({ query }) =>
		Effect.runPromise(gmailAuthCallback(query)),
	)
	.get("/google", async ({ set, request }) => {
		const authRequest = auth.handleRequest({ request, set });
		const session = await authRequest.validate();
		set.status = 302;
		if (session) {
			set.redirect = DASHBOARD_URL;
			return new Response("Already logged in", {
				headers: {
					"Set-Cookie": serializeCookie("auth_session", session.sessionId),
				},
			});
		}

		const [url, state] = await googleAuth.getAuthorizationUrl();
		// using built in cookie setting is inconsistent for some reason
		// so we set it manually
		return new Response("Redirecting", {
			headers: {
				"Set-Cookie": serializeCookie("google_oauth_state", state),
				Location: url.toString(),
			},
			status: 302,
		});
	})
	.get("/google/callback", async ({ set, request, query }) => {
		console.log("callback");
		//==================================================
		// this takes the latest state cookie and uses that
		// I have no idea why there are multiple state cookies
		// but this works
		const cookies = request.headers.get("Cookie");
		if (!cookies) {
			set.status = 400;
			console.log("no cookies");
			return;
		}
		const state_cookies = cookies
			.split("; ")
			.filter((c) => c.startsWith("google_oauth_state="));
		const storedState = state_cookies[state_cookies.length - 1].split("=")[1];
		//==================================================

		if (!storedState) {
			set.status = 400;
			console.log("no stored state");
			return;
		}

		set.redirect = DASHBOARD_URL;
		const { state, code } = query;
		if (
			!storedState ||
			!state ||
			storedState !== state ||
			typeof code !== "string"
		) {
			console.log("invalid state");
			set.status = 400;
			return;
		}

		try {
			const { getExistingUser, googleUser, createUser } =
				await googleAuth.validateCallback(code);

			const whiteListEmails = [
				"nils@highonlikes.com",
				"youcef@highonlikes.com",
				"awaisahmadkhanlist@gmail.com",
				"ali.rehan2842@gmail.com",
			];

			const existingUser = await getExistingUser();

			if (!googleUser.email) {
				set.status = 400;
				return "Email not provided";
			}

			// Check if email is in whitelist or has @startviral.de domain
			if (
				!whiteListEmails.includes(googleUser.email) &&
				!googleUser.email.endsWith("@startviral.de")
			) {
				set.status = 401;
				return "Unauthorized";
			}

			const user = existingUser
				? existingUser
				: await createUser({
						attributes: {
							username: googleUser.name,
							email: googleUser.email,
							pfp: googleUser.picture,
						},
					});

			const session = await auth.createSession({
				userId: user.userId,
				attributes: {},
			});
			const authRequest = auth.handleRequest({ request, set });
			authRequest.setSession(session);
			return "Logged in";
		} catch (e) {
			console.error(e);
			set.status = e instanceof OAuthRequestError ? 400 : 500;
		}
	})
	.post("/logout", async (ctx) => {
		const authRequest = auth.handleRequest(ctx);
		const session = await authRequest.validate();
		if (!session) {
			ctx.set.status = 401;
			return "Unauthorized";
		}
		await auth.invalidateSession(session.sessionId);
		authRequest.setSession(null);
		// redirect back to login page
		ctx.set.status = 200;
		return "Logged out";
	})
	.get("/me", async (ctx) => {
		const authRequest = auth.handleRequest(ctx);
		const session = await authRequest.validate();
		if (!session) {
			ctx.set.status = 401;
			return "Unauthorized";
		}
		return session.user as UserAttributes;
	});

export const authChecker = new Elysia({ name: "authChecker" }).derive(
	async ({ request, set }) => {
		const authRequest = auth.handleRequest({ request, set });
		const session = await authRequest.validate();

		return {
			user: session ? session.user : null,
			is_authenticated: !!session,
		};
	},
);
