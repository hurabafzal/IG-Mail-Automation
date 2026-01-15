// import { Context, Effect, Layer, Random, pipe } from "effect";
// import type { UnknownException } from "effect/Cause";
// import type { Browser, Page } from "puppeteer";
// import { env } from "../../env";
// import { browseResource } from "./browserResource";
// import { switchPage } from "./switchPage";

// const oldProxies = [
// 	// 56321, 36781, 20421, 57313, 28044, 44642, 45869, 44504, 33609, 40708, 25934,
// 	// 46930, 50577, 27099, 22963, 54009, 42765, 46342, 39119, 36970, 55734, 51340,
// 	// 41315, 27732, 58302, 38128, 37130, 24886, 24649, 27951,
// ].map((p) => ({
// 	username: "DBGHS8VU",
// 	password: "DBGHS8VU",
// 	url: `${env.PROXY_URL}:${p}`,
// }));

// const newProxy = [
// 	{
// 		username: env.PROXY_USERNAME,
// 		password: env.PROXY_PASSWORD,
// 		url: "gate.smartproxy.com:7000",
// 	},
// 	{
// 		username: env.PROXY_USERNAME,
// 		password: env.PROXY_PASSWORD,
// 		url: "gate.smartproxy.com:7000",
// 	},
// 	{
// 		username: env.PROXY_USERNAME,
// 		password: env.PROXY_PASSWORD,
// 		url: "gate.smartproxy.com:7000",
// 	},
// 	{
// 		username: env.PROXY_USERNAME,
// 		password: env.PROXY_PASSWORD,
// 		url: "gate.smartproxy.com:7000",
// 	},
// 	{
// 		username: env.PROXY_USERNAME,
// 		password: env.PROXY_PASSWORD,
// 		url: "gate.smartproxy.com:7000",
// 	},
// 	{
// 		username: env.PROXY_USERNAME,
// 		password: env.PROXY_PASSWORD,
// 		url: "gate.smartproxy.com:7000",
// 	},
// ];

// const proxies = [...oldProxies, ...newProxy, ...newProxy];

// export class BrowserLayer extends Context.Tag("Browser")<
// 	BrowserLayer,
// 	{
// 		readonly browser: Browser;
// 		readonly page: Page;
// 		readonly switchPage: (url: string) => Effect.Effect<Page, UnknownException>;
// 	}
// >() {
// 	static ProxyLive = Layer.effect(
// 		BrowserLayer,
// 		pipe(
// 			Random.nextIntBetween(0, proxies.length),
// 			Effect.flatMap((index) => browseResource(proxies[index])),
// 			Effect.map(({ browser, page }) => ({
// 				browser,
// 				page,
// 				switchPage: (url: string) => switchPage(url, page),
// 			})),
// 		),
// 	);

// 	static Live = Layer.effect(
// 		BrowserLayer,
// 		pipe(
// 			browseResource(),
// 			Effect.map(({ browser, page }) => ({
// 				browser,
// 				page,
// 				switchPage: (url: string) => switchPage(url, page),
// 			})),
// 		),
// 	);
// }

import { Context, Effect, Layer, pipe } from "effect";
import type { UnknownException } from "effect/Cause";
import type { Browser, Page } from "puppeteer";
import { env } from "../../env";
import { browseResource } from "./browserResource";
import { switchPage } from "./switchPage";

export interface Proxy {
	username: string;
	password: string;
	url: string;
}

// Parse proxies from environment variable
// Format: "host1:port1:user1:pass1,host2:port2:user2:pass2,..."
const parseProxiesFromEnv = (): Proxy[] => {
	if (!env.PROXY_LIST) {
		// Fallback to single proxy from old env variables if PROXY_LIST not set
		console.log(
			"⚠️  PROXY_LIST not set, falling back to individual proxy env variables",
		);
		if (!env.PROXY_USERNAME || !env.PROXY_PASSWORD || !env.PROXY_URL) {
			throw new Error(
				"Either PROXY_LIST or (PROXY_USERNAME, PROXY_PASSWORD, PROXY_URL) must be set in environment variables",
			);
		}
		return [
			{
				username: env.PROXY_USERNAME,
				password: env.PROXY_PASSWORD,
				url: env.PROXY_URL,
			},
		];
	}

	const proxyStrings = env.PROXY_LIST.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return proxyStrings.map((proxyStr) => {
		const parts = proxyStr.split(":");
		if (parts.length !== 4) {
			throw new Error(
				`Invalid proxy format: ${proxyStr}. Expected: host:port:user:pass`,
			);
		}
		const url = `${parts[0]}:${parts[1]}`;
		const username = parts[2];
		const password = parts[3];
		return { username, password, url };
	});
};

const proxies = parseProxiesFromEnv();

// In-memory proxy pool tracking
const proxyPool = new Map<
	string,
	{ failures: number; lastUsed: number; successCount: number }
>();

const getNextProxy = (): Proxy => {
	// Filter out proxies that failed more than 5 times
	const activeProxies = proxies.filter((proxy) => {
		const key = `${proxy.url}:${proxy.username}`;
		const stats = proxyPool.get(key);
		return !stats || stats.failures < 5;
	});

	if (activeProxies.length === 0) {
		// Reset all proxies if all have failed
		console.log("🔄 All proxies exhausted, resetting pool");
		proxyPool.clear();
		return proxies[0];
	}

	// Select random proxy from active ones
	const randomIndex = Math.floor(Math.random() * activeProxies.length);
	const selectedProxy = activeProxies[randomIndex];

	// Update success count
	const key = `${selectedProxy.url}:${selectedProxy.username}`;
	const stats = proxyPool.get(key) || {
		failures: 0,
		lastUsed: Date.now(),
		successCount: 0,
	};
	stats.successCount += 1;
	stats.lastUsed = Date.now();
	proxyPool.set(key, stats);

	console.log(
		`🎲 Selected proxy: ${selectedProxy.url} (Success: ${stats.successCount}, Failures: ${stats.failures}, ${activeProxies.length} active)`,
	);
	return selectedProxy;
};

const markProxyFailed = (proxy: Proxy) => {
	const key = `${proxy.url}:${proxy.username}`;
	const stats = proxyPool.get(key) || {
		failures: 0,
		lastUsed: Date.now(),
		successCount: 0,
	};
	stats.failures += 1;
	stats.lastUsed = Date.now();
	proxyPool.set(key, stats);
	console.log(
		`❌ Proxy ${proxy.url} marked as failed (${stats.failures} failures, ${stats.successCount} successes)`,
	);
};

export class BrowserLayer extends Context.Tag("Browser")<
	BrowserLayer,
	{
		readonly browser: Browser;
		readonly page: Page;
		readonly switchPage: (url: string) => Effect.Effect<Page, UnknownException>;
	}
>() {
	static ProxyLive = Layer.effect(
		BrowserLayer,
		pipe(
			Effect.sync(() => {
				const proxy = getNextProxy();
				return proxy;
			}),
			Effect.flatMap((proxy) =>
				browseResource(proxy).pipe(
					Effect.tap(() =>
						Effect.sync(() => {
							console.log(`✅ Proxy ${proxy.url} succeeded`);
						}),
					),
					Effect.catchAll((error) => {
						markProxyFailed(proxy);
						return Effect.fail(error);
					}),
				),
			),
			Effect.map(({ browser, page }) => ({
				browser,
				page,
				switchPage: (url: string) => switchPage(url, page),
			})),
		),
	);

	static Live = Layer.effect(
		BrowserLayer,
		pipe(
			browseResource(),
			Effect.map(({ browser, page }) => ({
				browser,
				page,
				switchPage: (url: string) => switchPage(url, page),
			})),
		),
	);
}
