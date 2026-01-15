/**
 * Utility functions for string manipulation and sanitization
 */

/**
 * Sanitizes a string by removing malformed Unicode characters that could cause JSON parsing errors.
 * This function specifically handles broken emoji and surrogate pairs that can appear in Instagram data.
 *
 * @param str - The string to sanitize (can be null/undefined)
 * @returns A sanitized string safe for JSON serialization, or null if input was null/undefined
 */
export function sanitizeUnicode(str: string | null | undefined): string | null {
	if (!str) return str || null;

	try {
		// First, try to clean up common problematic sequences
		const sanitized = str
			// Remove unpaired high surrogates (0xD800-0xDBFF without following low surrogate)
			.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
			// Remove unpaired low surrogates (0xDC00-0xDFFF without preceding high surrogate)
			.replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
			// Remove control characters except newlines and tabs
			// biome-ignore lint/suspicious/noControlCharactersInRegex: needed
			.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, " ")
			// Replace multiple whitespace with single space
			.replace(/\s+/g, " ")
			.trim();

		// Test if the result can be JSON stringified safely
		JSON.stringify(sanitized);

		return sanitized;
	} catch (error) {
		console.warn(
			"Failed to sanitize string, using aggressive fallback:",
			error,
		);

		// Aggressive fallback: keep only basic Latin characters, common punctuation, and well-formed Unicode
		try {
			const aggressiveSanitized = str
				// Keep only ASCII printable characters and basic Unicode range
				.replace(
					/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]/g,
					" ",
				)
				.replace(/\s+/g, " ")
				.trim();

			// Test again
			JSON.stringify(aggressiveSanitized);
			return aggressiveSanitized;
		} catch (secondError) {
			// Final fallback: ASCII only
			console.warn("Using ASCII-only fallback for string sanitization");
			return (
				str
					.replace(/[^\x20-\x7E]/g, " ")
					.replace(/\s+/g, " ")
					.trim() || "[Content removed due to encoding issues]"
			);
		}
	}
}

/**
 * Recursively sanitizes string values in an object to handle malformed Unicode
 *
 * @param obj - The object to sanitize (can be any type)
 * @returns A sanitized version of the object with all string values cleaned
 */
export function sanitizeObjectStrings(obj: unknown): unknown {
	if (typeof obj === "string") {
		return sanitizeUnicode(obj) || "[Removed due to encoding issues]";
	}

	if (Array.isArray(obj)) {
		return obj.map(sanitizeObjectStrings);
	}

	if (obj && typeof obj === "object") {
		const sanitized: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			sanitized[key] = sanitizeObjectStrings(value);
		}
		return sanitized;
	}

	return obj;
}

/**
 * Safely parses a JSON string while handling malformed Unicode characters.
 * This function prevents JSON parsing errors caused by broken emoji or surrogate pairs.
 *
 * @param jsonString - The JSON string to parse
 * @returns The parsed object, or a fallback object if parsing fails
 */
export function safeJsonParse(jsonString: string): unknown {
	try {
		// First attempt: try direct parse
		return JSON.parse(jsonString);
	} catch (error) {
		// If it fails, try to sanitize the string and parse again
		const sanitized = sanitizeUnicode(jsonString);
		if (!sanitized) {
			return { error: "Could not sanitize JSON string" };
		}

		try {
			return JSON.parse(sanitized);
		} catch (secondError) {
			// Final fallback: return an error object
			return {
				error: "JSON contained malformed Unicode and could not be parsed",
				originalLength: jsonString.length,
				sanitizedLength: sanitized.length,
			};
		}
	}
}

/**
 * Safely stringifies an object while handling malformed Unicode characters.
 * This function prevents JSON serialization errors caused by broken emoji or surrogate pairs.
 *
 * @param obj - The object to stringify
 * @returns A JSON string representation of the object
 */
export function safeJsonStringify(obj: Record<string, unknown>): string {
	try {
		// First attempt: try direct stringify
		return JSON.stringify(obj);
	} catch (error) {
		// If it fails, recursively sanitize string values and try again
		const sanitized = sanitizeObjectStrings(obj);
		try {
			return JSON.stringify(sanitized);
		} catch (secondError) {
			// Final fallback: return a minimal safe payload
			return JSON.stringify({
				error: "Payload contained malformed Unicode and was sanitized",
				originalKeys: Object.keys(obj),
				sanitizationApplied: true,
			});
		}
	}
}

/**
 * Sanitizes a string and truncates it to a maximum length
 *
 * @param str - The string to sanitize and truncate
 * @param maxLength - Maximum length (default: 1000)
 * @returns Sanitized and truncated string
 */
export function sanitizeAndTruncate(
	str: string | null | undefined,
	maxLength = 1000,
): string | null {
	const sanitized = sanitizeUnicode(str);
	if (!sanitized) return sanitized;

	if (sanitized.length <= maxLength) return sanitized;

	return `${sanitized.substring(0, maxLength - 3)}...`;
}
