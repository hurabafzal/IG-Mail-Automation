/**
 * Options for asyncPoolForEach
 */
interface AsyncPoolOptions {
	concurrency: number;
	retry?: number;
	retryDelay?: number;
}

/**
 * Processes an array with controlled concurrency using a pool-based approach.
 *
 * @param array - The array to process
 * @param mapFn - Async function that maps a single value to another value
 * @param options - Configuration options including concurrency limit, retry count, and retry delay
 * @returns Promise that resolves when all items have been processed
 */
export async function asyncPoolForEach<T, R>(
	array: T[],
	mapFn: (item: T, index: number) => Promise<R>,
	options: AsyncPoolOptions,
): Promise<R[]> {
	const { concurrency, retry = 0, retryDelay = 1000 } = options;

	if (concurrency <= 0) {
		throw new Error("Concurrency must be greater than 0");
	}

	if (retry < 0) {
		throw new Error("Retry count must be 0 or greater");
	}

	if (retryDelay < 0) {
		throw new Error("Retry delay must be 0 or greater");
	}

	if (array.length === 0) {
		return [];
	}

	const results: R[] = new Array(array.length);
	let currentIndex = 0;

	// Helper function to sleep for a specified duration
	const sleep = (ms: number): Promise<void> =>
		new Promise((resolve) => setTimeout(resolve, ms));

	// Create a worker function that processes items from the queue
	const worker = async (): Promise<void> => {
		while (currentIndex < array.length) {
			const index = currentIndex++;
			if (index < array.length) {
				let attempts = 0;
				let lastError: Error | undefined;

				while (attempts <= retry) {
					try {
						results[index] = await mapFn(array[index], index);
						break; // Success, exit retry loop
					} catch (error) {
						lastError =
							error instanceof Error ? error : new Error(String(error));
						attempts++;

						if (attempts <= retry) {
							// Wait before retrying (except on the last attempt)
							await sleep(retryDelay);
						}
					}
				}

				// If all retries failed, throw the last error
				if (attempts > retry && lastError) {
					throw lastError;
				}
			}
		}
	};

	// Create the specified number of workers
	const workers: Promise<void>[] = [];
	const actualConcurrency = Math.min(concurrency, array.length);

	for (let i = 0; i < actualConcurrency; i++) {
		workers.push(worker());
	}

	// Wait for all workers to complete
	await Promise.all(workers);

	return results;
}
