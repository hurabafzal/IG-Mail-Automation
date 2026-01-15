import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import {
	broadcastDevReady,
	createRequestHandler,
} from "@remix-run/server-runtime";
import { app } from "backend/src/api/app";
import chokidar from "chokidar";

type ServerBuild = import("@remix-run/node").ServerBuild;

const BUILD_PATH = path.resolve("./build/index.js");
const VERSION_PATH = path.resolve("./build/version.txt");
const initialBuild = await reimportServer();

const STATIC_PATH = "./public";

// we are using require because in ESM, there's no way to remove entries from the import cache.
// While a timestamp workaround works, it means that the import cache will grow over time which
// can eventually cause Out of Memory errors.
// https://remix.run/docs/en/main/guides/manual-mode
async function reimportServer() {
	const stat = fs.statSync(BUILD_PATH);

	// convert build path to URL for Windows compatibility with dynamic `import`
	const BUILD_URL = url.pathToFileURL(BUILD_PATH).href;

	// use a timestamp query parameter to bust the import cache
	return (await import(`${BUILD_URL}?t=${stat.mtimeMs}`)) as ServerBuild;
}

const HOUR_IN_SECONDS = 60 * 60;
const YEAR_IN_SECONDS = 365 * 24 * HOUR_IN_SECONDS;
const node_env = Bun.env.NODE_ENV;
function createDevRequestHandler(initialBuild: ServerBuild) {
	let build = initialBuild;
	async function handleServerUpdate() {
		build = await reimportServer();
		if (build.assets === undefined) {
			console.log("Server build is not ready yet");
			return;
		}
		await broadcastDevReady(build).catch();
	}

	chokidar
		.watch(VERSION_PATH, { ignoreInitial: true })
		.on("add", handleServerUpdate)
		.on("change", handleServerUpdate);

	// wrap request handler to make sure its recreated with the latest build for every request
	return async (request: Request) => {
		const url = new URL(request.url);
		try {
			const filePath = STATIC_PATH + url.pathname;
			if (fs.statSync(filePath).isFile()) {
				const file = Bun.file(filePath);

				let cacheControl: string;
				if (url.pathname.startsWith("/build/")) {
					cacheControl = `immutable, max-age=${YEAR_IN_SECONDS}`;
				} else {
					cacheControl = `max-age=${HOUR_IN_SECONDS}`;
				}
				return new Response(file, {
					headers: { "Cache-Control": cacheControl },
				});
			}
		} catch {
			/* empty */
			console.error("File not found", url.pathname);
		}

		try {
			const handler = createRequestHandler(build, node_env);
			const loadContext = {};
			return handler(request, loadContext);
		} catch (error) {
			console.error(error);
			return new Response("Internal Server Error", { status: 500 });
		}
	};
}

const production = (request: Request) => {
	const url = new URL(request.url);
	try {
		const filePath = STATIC_PATH + url.pathname;
		if (fs.statSync(filePath).isFile()) {
			const file = Bun.file(filePath);

			let cacheControl: string;
			if (url.pathname.startsWith("/build/")) {
				cacheControl = `immutable, max-age=${YEAR_IN_SECONDS}`;
			} else {
				cacheControl = `max-age=${HOUR_IN_SECONDS}`;
			}
			return new Response(file, { headers: { "Cache-Control": cacheControl } });
		}
	} catch {
		/* empty */
		console.error("File not found", url.pathname);
	}

	try {
		const handler = createRequestHandler(initialBuild);
		const loadContext = {};
		return handler(request, loadContext);
	} catch (error) {
		console.error(error);
		return new Response("Internal Server Error", { status: 500 });
	}
};

app
	.mount(
		"/",
		node_env === "development"
			? createDevRequestHandler(initialBuild)
			: production,
	)
	.listen(3000);

console.log(
	`[${node_env}] Elysia Server is running at ${app.server?.hostname}:${app.server?.port}.`,
);
