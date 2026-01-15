/**
 * 🔄 Performs a deep comparison between two objects
 *
 * This function recursively compares two objects and their nested properties,
 * handling primitive types, null values, and object structures.
 *
 * @param obj1 First object to compare
 * @param obj2 Second object to compare
 * @returns true if objects are deeply equal, false otherwise
 *
 * @example
 * ```typescript
 * deepEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 }) // true
 * deepEqual({ a: 1 }, { a: 2 }) // false
 * ```
 */
export function deepEqual(obj1: unknown, obj2: unknown): boolean {
	// 🔍 Handle primitive types
	if (obj1 === obj2) return true;
	if (
		typeof obj1 !== "object" ||
		typeof obj2 !== "object" ||
		obj1 === null ||
		obj2 === null
	) {
		return false;
	}

	// 🔑 Get the keys of both objects
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	// 📏 Check if both objects have the same number of keys
	if (keys1.length !== keys2.length) return false;

	// 🔄 Check if all keys in obj1 exist in obj2 and their values are equal
	for (const key of keys1) {
		if (!keys2.includes(key)) return false;
		if (
			!deepEqual(
				(obj1 as Record<string, unknown>)[key],
				(obj2 as Record<string, unknown>)[key],
			)
		) {
			return false;
		}
	}

	return true;
}

/**
 * 🔍 Returns the differences between two objects
 *
 * This function recursively compares two objects and returns an object containing
 * the differences. The returned object will have the same structure as the input
 * objects, with values being arrays containing the different values.
 *
 * @param obj1 First object to compare
 * @param obj2 Second object to compare
 * @returns Object containing the differences, or null if objects are equal
 *
 * @example
 * ```typescript
 * deepDiff({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } }) // { b: { c: [2, 3] } }
 * deepDiff({ a: 1 }, { a: 1 }) // null
 * ```
 */
export function deepDiff(
	obj1: unknown,
	obj2: unknown,
): Record<string, unknown> | [unknown, unknown] | null {
	// 🔍 Handle primitive types
	if (obj1 === obj2) return null;
	if (
		typeof obj1 !== "object" ||
		typeof obj2 !== "object" ||
		obj1 === null ||
		obj2 === null
	) {
		return [obj1, obj2];
	}

	const result: Record<string, unknown> = {};
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);
	const allKeys = new Set([...keys1, ...keys2]);

	for (const key of allKeys) {
		const val1 = (obj1 as Record<string, unknown>)[key];
		const val2 = (obj2 as Record<string, unknown>)[key];

		// If key exists in one object but not the other
		if (!keys1.includes(key) || !keys2.includes(key)) {
			result[key] = [val1, val2];
			continue;
		}

		// Recursively compare nested objects
		const diff = deepDiff(val1, val2);
		if (diff !== null) {
			result[key] = diff;
		}
	}

	return Object.keys(result).length > 0 ? result : null;
}
