/* eslint-disable @typescript-eslint/no-unsafe-return */

export const sanitizeValue = <T>(value: T): T => {
	if (value === null || value === undefined) {
		return null as T;
	}

	if (typeof value === "string") {
		return (
			value
				.replace(/\0/g, "") // Remove null bytes
				// .replace(/[\uFFFD\uFFFE\uFFFF]/g, "") // Remove Unicode replacement characters
				.trim() as T
		);
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeValue(item)) as T;
	}

	if (typeof value === "object") {
		const sanitized = {} as { [K in keyof T]: T };
		for (const [key, val] of Object.entries(value as object)) {
			sanitized[key as keyof T] = sanitizeValue(val);
		}
		return sanitized as T;
	}

	return value as T;
};

// Helper function to find differences between original and sanitized objects
const findDifferences = <T extends object>(
	original: T,
	sanitized: T,
): Array<{ path: string; original: unknown; sanitized: unknown }> => {
	const differences: Array<{
		path: string;
		original: unknown;
		sanitized: unknown;
	}> = [];

	const compare = (orig: unknown, san: unknown, path = ""): void => {
		if (orig === san) return;

		if (typeof orig === "object" && typeof san === "object" && orig && san) {
			for (const key of Object.keys({ ...orig, ...san })) {
				compare(
					(orig as Record<string, unknown>)[key],
					(san as Record<string, unknown>)[key],
					path ? `${path}.${key}` : key,
				);
			}
		} else {
			differences.push({
				path,
				original: orig,
				sanitized: san,
			});
		}
	};

	compare(original, sanitized);
	return differences;
};

// Optional debug function with proper typing
export const debugSanitization = <T extends object>(
	label: string,
	original: T,
	sanitized: T,
): void => {
	const originalJson = JSON.stringify(original);
	const sanitizedJson = JSON.stringify(sanitized);

	if (originalJson !== sanitizedJson) {
		console.log(`[Sanitization] Found invalid characters in ${label}:`, {
			original,
			sanitized,
			differences: findDifferences(original, sanitized),
		});
	}
};
