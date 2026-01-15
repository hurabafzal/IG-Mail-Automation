/**
 * Formats an error object into a readable string, including stack traces when available
 */
export function formatError(error: unknown): string {
	if (error === null) return "null";
	if (error === undefined) return "undefined";

	// Handle Error objects with stack traces
	if (error instanceof Error) {
		return error.stack || error.message;
	}

	// Handle objects with error/message/stack properties
	if (typeof error === "object") {
		const errorObj = error as Record<string, unknown>;

		// If object has a stack trace, prioritize that
		if ("stack" in errorObj) {
			return String(errorObj.stack);
		}

		if ("error" in errorObj) {
			// Handle nested Error objects
			if (errorObj.error instanceof Error) {
				return errorObj.error.stack || String(errorObj.error);
			}
			return String(errorObj.error);
		}

		if ("message" in errorObj) {
			return String(errorObj.message);
		}

		return JSON.stringify(error);
	}

	// Handle primitive values
	return String(error);
}
