import { Effect, Either, pipe } from "effect";
import type { HTTPRequest, Page } from "puppeteer";
import { BrowserLayer } from "./browserLayer";

export type BaseRequest = {
	url: string;
	method: string;
	/**
	 * The request's post body, if any.
	 */
	postData: string | undefined;
	headers: Record<string, string>;
	searchParams: URLSearchParams;
};

interface GetBaseRequestProps {
	visitUrl: string;
	targetUrl: string;
}

// const cache = new Map();
// const cacheHits = new Map();

class BadConnectionError {
	readonly _tag = "BadConnectionError";
}

const getBaseRequest = ({ visitUrl, targetUrl }: GetBaseRequestProps) =>
	pipe(
		BrowserLayer,
		Effect.tap(({ page }) => page.setRequestInterception(true)),
		// I need to fork it!
		Effect.andThen(({ page }) =>
			Effect.promise(() => {
				console.log("starting request interception...");
				const r = new Promise<HTTPRequest>((resolve, reject) => {
					page
						.goto(visitUrl, {
							timeout: 10 * 1000,
							waitUntil: "domcontentloaded",
						})
						.then((x) => {
							if (!x?.ok()) {
								reject("bad response");
							}
						})
						.catch((e) => {
							console.error(e);
							reject("threw on request");
						});

					page.on("request", async (request) => {
						if (request.url().startsWith(targetUrl)) {
							// console.log("got request: ", request.url());
							resolve(request);
						}
						const url = request.url();
						const resourceType = request.resourceType();

						// Block images, stylesheets, and other unnecessary assets
						if (
							["image", "stylesheet", "font", "media"].includes(resourceType)
						) {
							await request.abort();
							return;
						}
						// if (cache.has(url)) {
						// 	const hits = (cacheHits.get(url) || 0) + 1;
						// 	cacheHits.set(url, hits);
						// 	// console.log(`[hit #${hits}] cache hit with ${url}`);
						// 	await request.respond(cache.get(url)).catch((e) => {
						// 		console.error(e);
						// 		request.continue();
						// 	});
						// } else {
						request.continue();
						// }
					});
				});
				// page.on("response", async (response) => {
				// 	const url = response.url();
				// 	const request = response.request();
				// 	const resourceType = request.resourceType();

				// 	// Cache JavaScript responses
				// 	if (resourceType === "script") {
				// 		try {
				// 			const headers = response.headers();
				// 			const status = response.status();

				// 			// Check if it's not a redirect
				// 			if (status >= 200 && status <= 299) {
				// 				const body = await response.text();
				// 				cache.set(url, {
				// 					status: status,
				// 					headers: headers,
				// 					body: body,
				// 				});
				// 			}
				// 		} catch (error) {
				// 			console.error(`Error caching response for ${url}:`, error);
				// 		}
				// 	}
				// });

				// console.log();

				// a bit scuffed to do it this way, but it works ig
				return r.catch(console.error);
			}).pipe(
				Effect.andThen((request) =>
					!request
						? Either.left(new BadConnectionError())
						: Either.right({
								request,
								page,
							}),
				),
			),
		),
		Effect.timeout(20 * 1000),
		Effect.tap(() => console.log("got base request!")),
		Effect.tap(() => Effect.sleep(2000)),
		Effect.map(({ page, request }) => ({
			url: request.url(),
			method: request.method(),
			postData: request.postData(),
			headers: request.headers(),
			searchParams: new URL(request.url()).searchParams,
			page,
		})),
	);

const RequestDuplicatorFactory = (p: GetBaseRequestProps) =>
	pipe(
		getBaseRequest(p),
		Effect.map((baseRequest) => ({
			duplicate: (req: (base: BaseRequest) => Partial<BaseRequest>) =>
				pipe(
					Effect.sync(() => ({
						...baseRequest,
						...req(baseRequest),
					})),
					Effect.andThen(({ page, ...r }) =>
						page.evaluate(async (request) => {
							const res = await fetch(request.url, {
								method: request.method,
								body: request.postData ?? null,
								headers: request.headers,
							}).catch((e) => {
								console.error(e);
								return null;
							});
							return (await res?.text().catch(() => null)) ?? "";
						}, r),
					),
				),
		})),
	);

export const RequestDuplicators = {
	InstagramWebProfile: RequestDuplicatorFactory({
		visitUrl: "https://www.instagram.com/therock/",
		targetUrl: "https://www.instagram.com/api/v1/users/web_profile_info",
	}),
	InstagramGraphQuery: RequestDuplicatorFactory({
		visitUrl: "https://www.instagram.com/therock/",
		targetUrl: "https://www.instagram.com/graphql/query",
	}),
	InstagramComments: RequestDuplicatorFactory({
		visitUrl: "https://www.instagram.com/p/C-eQptuv5tl/",
		targetUrl: "https://www.instagram.com/graphql/query",
	}),
};
