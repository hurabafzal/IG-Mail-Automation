import { edenFetch } from "@elysiajs/eden";
import type { App } from "backend/src/export";

// check if we are on the client or server
let host = "http://localhost:3000";
if (typeof window === "undefined") {
	const { env } = await import("./env.server");
	host =
		env.NODE_ENV === "production"
			? "https://data.highonlikes.com"
			: "http://localhost:3000";
} else {
	try {
		host =
			// @ts-expect-error - env is defined in the window
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			window.ENV.NODE_ENV === "production"
				? "https://data.highonlikes.com"
				: "http://localhost:3000";
		console.log("host ", host);
	} catch (e) {
		console.log("error getting window.ENV", e);
	}
}

export const api_host = host;

export const api_fetch = edenFetch<App>(host);
