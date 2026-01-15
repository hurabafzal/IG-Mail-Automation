import { Effect } from "effect";

type ReadOnlyPairs = readonly (readonly [string, string])[];

export const swapKeys = (pairs: ReadOnlyPairs, o: Record<string, unknown>) =>
	Effect.sync(() => {
		for (const [new_key, old_key] of pairs) {
			const p = Object.getOwnPropertyDescriptor(o, old_key);
			if (p) {
				Object.defineProperty(o, new_key, p);
				delete o[old_key];
			}
		}
		return o;
	});
