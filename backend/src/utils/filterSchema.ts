import { z } from "zod";

export const filterSchema = z.object({
	followers: z.object({
		min: z.coerce.number(),
		max: z.coerce.number(),
	}),
	domain: z.string(),
	name: z.string(),
	niche: z.string(),
	hasReadEmail: z.boolean(),
});
