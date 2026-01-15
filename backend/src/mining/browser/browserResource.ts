import { acquireRelease, promise, tryPromise } from "effect/Effect";
import type { Browser } from "puppeteer";
import puppeteer from "puppeteer-extra";
import stealth from "puppeteer-extra-plugin-stealth";

export interface Proxy {
	username: string;
	password: string;
	url: string;
}

export const browseResource = (proxy?: Proxy) =>
	acquireRelease(acquireBrowser(proxy), releaseBrowser);

const releaseBrowser = ({ browser }: { browser: Browser }) =>
	promise(() => browser.close());

const acquireBrowser = (proxy?: Proxy) =>
	tryPromise(async () => {
		// console.log("using proxy", proxy);
		const browser = await puppeteer.use(stealth()).launch({
			// headless: false,
			headless: true,
			ignoreHTTPSErrors: true,

			devtools: false,
			// devtools: true,

			timeout: 30_000,
			slowMo: 0,
			args: [
				"--aggressive-cache-discard",
				"--disable-cache",
				"--disable-application-cache",
				"--disable-offline-load-stale-cache",
				"--disable-gpu-shader-disk-cache",
				"--media-cache-size=0",
				"--disk-cache-size=0",
				"--no-zygote",
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-web-security",
				"--ignore-certifcate-errors",
				"--ignore-certifcate-errors-spki-list",
				"--disable-features=IsolateOrigins,site-per-process",
				"--disable-site-isolation-trials",

				"--disable-blink-features",
				"--disable-blink-features=AutomationControlled",

				"--no-default-browser-check",
				"--no-first-run",
				"--disable-infobars",
				"--disable-notifications",
				"--disable-desktop-notifications",
				"--hide-scrollbars",
				"--mute-audio",

				"--window-position=0,0",
				"--window-size=1920,1080",

				"--font-render-hinting=none",
				"--disable-gpu",
				"--disable-gpu-sandbox",
				"--disable-dev-shm-usage",
				"--disable-software-rasterizer",
				"--enable-low-res-tiling",
				"--disable-accelerated-2d-canvas",
				"--disable-canvas-aa",
				"--disable-2d-canvas-clip-aa",
				"--disable-gl-drawing-for-tests",

				"--disable-background-timer-throttling",
				"--disable-backgrounding-occluded-windows",
				"--disable-breakpad",
				"--disable-client-side-phishing-detection",
				"--disable-component-extensions-with-background-pages",
				"--disable-default-apps",
				"--disable-dev-shm-usage",
				"--disable-extensions",
				"--disable-features=TranslateUI",
				"--disable-hang-monitor",
				"--disable-ipc-flooding-protection",
				"--disable-popup-blocking",
				"--disable-prompt-on-repost",
				"--disable-renderer-backgrounding",
				"--disable-sync",
				"--force-color-profile=srgb",
				"--metrics-recording-only",

				"--disable-webgl",
				"--disable-webgl2",
				"--disable-gpu-compositing",
				proxy ? `--proxy-server=${proxy.url}` : "",
			],

			ignoreDefaultArgs: ["--enable-automation"],
		});

		let page = await browser.pages().then((pages) => pages[0]);
		if (!page) page = await browser.newPage();
		// const userAgent = new UserAgent();
		// await page.setUserAgent(userAgent.random().toString());
		// await blocker.enableBlockingInPage(page);

		if (proxy) {
			console.log("[mining] authenticating browser with proxy", proxy.url);
			await page.authenticate({
				username: proxy.username,
				password: proxy.password,
			});
			console.log("[mining] auth success");
			// await page.goto("https://api.ipify.org?format=json");

			// // Get the pre-formatted text content of the page
			// const content = await page.evaluate(() => document.body.textContent);
			// console.log(content);
		}

		page.setDefaultNavigationTimeout(10 * 1000);
		await page.setViewport({
			width: 1920,
			height: 1080 - 74,
		});
		await page.emulateTimezone("Europe/Amsterdam");
		return { browser, page } as const;
	});
