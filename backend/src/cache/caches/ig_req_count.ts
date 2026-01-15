import { db } from "../../db";

export async function getToday() {
	const today = new Date();
	// need date in format YYYY-MM-DD
	const day = today.toISOString().split("T")[0];
	const val = await db
		.selectFrom("Counters")
		.select("hikerAPI_calls")
		.where("date", "=", day)
		.executeTakeFirst();
	if (!val) {
		console.warn(`[hiker api] no count found for ${day}`);
		await db
			.insertInto("Counters")
			.values({
				date: day,
				hikerAPI_calls: 0,
			})
			.execute();
		return getToday();
	}
	console.log(`[hiker api] today's count: ${val.hikerAPI_calls}`);
	return val.hikerAPI_calls;
}

export async function incrementToday() {
	const today = new Date();
	// need date in format YYYY-MM-DD
	const day = today.toISOString().split("T")[0];
	await db
		.updateTable("Counters")
		.set((eb) => ({
			hikerAPI_calls: eb("hikerAPI_calls", "+", 1),
		}))
		.where("date", "=", day)
		.execute();
	// return await redis.incr("ig_req_count." + day);
}
