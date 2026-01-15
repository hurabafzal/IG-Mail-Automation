import { tryPromise } from "effect/Effect";
import type { Page } from "puppeteer";

export const switchPage = (url: string, page: Page) =>
	tryPromise(async () => {
		await page.goto(url, {
			timeout: 60 * 1000,
			waitUntil: "domcontentloaded",
		});
		const cf = await page.$("#challenge-running");
		if (cf) {
			console.error(`cloudflare detected for ${url}`);
			throw new Error("cloudflare detected");
		}
		await page
			.waitForSelector("a", { timeout: 20 * 1000 })
			.catch(() => console.warn(`no link tags found for ${url}`));
		// check if we're on a cloudflare page
		await page
			.waitForNetworkIdle({ timeout: 5 * 1000 })
			.catch(() =>
				console.log(
					`network idle timeout for ${url}, but we keep going anyway`,
				),
			);

		return page;
	});

export const getPageText = (page: Page) =>
	tryPromise(() =>
		page.evaluate(() => {
			const walk = (doc: Document | null) => {
				if (!doc) return "";
				/// @ts-ignore
				const iframeHTML = [...doc.querySelectorAll("iframe")].map((e) =>
					walk(e.contentDocument),
				);
				const dom = new DOMParser().parseFromString(
					doc.body.innerHTML,
					"text/html",
				);
				const iframes = dom.querySelectorAll("iframe");
				iframes.forEach((e, i) => {
					e.outerHTML = iframeHTML[i];
				});
				const styles = dom.querySelectorAll("style");
				styles.forEach((e, i) => {
					e.outerHTML = "";
				});
				const scripts = dom.querySelectorAll("script");
				scripts.forEach((e, i) => {
					e.outerHTML = "";
				});
				const noscripts = dom.querySelectorAll("noscript");
				noscripts.forEach((e, i) => {
					e.innerHTML = "";
				});
				const pagesCss = dom.querySelectorAll("pages-css");
				pagesCss.forEach((e, i) => {
					e.outerHTML = "";
				});
				const links = dom.querySelectorAll("link");
				links.forEach((e, i) => {
					e.outerHTML = "";
				});
				const head = dom.querySelector("head");
				if (head) {
					head.innerHTML = "";
				}
				return dom.body.innerHTML;
			};
			const html = walk(document);
			// get innerText of html
			const doc = new DOMParser().parseFromString(html, "text/html");
			return doc.body.outerHTML;
			// filter out script and style tag
		}),
	);
