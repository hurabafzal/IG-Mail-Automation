import { Effect } from "effect";

// Custom error types
export class ImageDownloadError {
	readonly _tag = "ImageDownloadError";
	constructor(
		public readonly message: string,
		public readonly url: string,
		public readonly cause?: unknown,
	) {}
}

export class ImageConversionError {
	readonly _tag = "ImageConversionError";
	constructor(
		public readonly message: string,
		public readonly cause?: unknown,
	) {}
}

/**
 * Downloads an image from a URL and converts it to base64 data URL
 */
export function downloadImageAsBase64(
	url: string,
	timeoutMs = 10000,
): Effect.Effect<string, ImageDownloadError> {
	return Effect.gen(function* () {
		console.log(`Downloading image: ${url.substring(0, 20)}...`);

		const response = yield* Effect.tryPromise({
			try: async () => {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

				try {
					const response = await fetch(url, {
						signal: controller.signal,
						headers: {
							"User-Agent":
								"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
						},
					});

					clearTimeout(timeoutId);

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}

					return response;
				} catch (error) {
					clearTimeout(timeoutId);
					throw error;
				}
			},
			catch: (error) =>
				new ImageDownloadError(
					`Failed to download image: ${error}`,
					url,
					error,
				),
		});

		// Check content type
		const contentType = response.headers.get("content-type");
		if (!contentType || !contentType.startsWith("image/")) {
			return yield* Effect.fail(
				new ImageDownloadError(`Invalid content type: ${contentType}`, url),
			);
		}

		// Convert to base64
		const base64String = yield* Effect.tryPromise({
			try: async () => {
				const arrayBuffer = await response.arrayBuffer();
				const base64 = Buffer.from(arrayBuffer).toString("base64");
				return `data:${contentType};base64,${base64}`;
			},
			catch: (error) =>
				new ImageDownloadError(
					`Failed to convert image to base64: ${error}`,
					url,
					error,
				),
		});

		console.log(`✓ Downloaded and converted image: ${url.substring(0, 50)}...`);
		return base64String;
	});
}

/**
 * Downloads multiple images and converts them to base64, with error handling for individual failures
 */
export function downloadImagesAsBase64(
	urls: string[],
	timeoutMs = 10000,
): Effect.Effect<
	Array<{ url: string; base64?: string; error?: string }>,
	never
> {
	return Effect.gen(function* () {
		if (urls.length === 0) {
			return [];
		}

		console.log(`Downloading ${urls.length} images for base64 conversion`);

		const results: Array<{ url: string; base64?: string; error?: string }> = [];

		// Process images with limited concurrency to avoid overwhelming the servers
		yield* Effect.forEach(
			urls,
			(url) =>
				Effect.gen(function* () {
					const result = yield* Effect.either(
						downloadImageAsBase64(url, timeoutMs),
					);

					if (result._tag === "Right") {
						results.push({ url, base64: result.right });
					} else {
						const errorMessage = result.left.message;
						console.error(`Failed to download ${url}: ${errorMessage}`);
						results.push({ url, error: errorMessage });
					}
				}),
			{ concurrency: 3 }, // Limit concurrency to be respectful to Instagram's servers
		);

		const successCount = results.filter((r) => r.base64).length;
		const failureCount = results.filter((r) => r.error).length;

		console.log(
			`Image download complete: ${successCount} successful, ${failureCount} failed`,
		);

		return results;
	});
}

/**
 * Gets unique image URLs from an array, removing duplicates
 */
export function getUniqueImageUrls(
	urls: (string | null | undefined)[],
): string[] {
	const uniqueUrls = new Set<string>();

	for (const url of urls) {
		if (url?.trim() && url.startsWith("http")) {
			uniqueUrls.add(url.trim());
		}
	}

	return Array.from(uniqueUrls);
}
