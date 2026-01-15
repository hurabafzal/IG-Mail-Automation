// // Update content column
import { Elysia } from "elysia";
import { sql } from "kysely";
import { db } from "../db";

type GenericRow = Record<string, unknown>;
type NumericRecord = Record<string, number>;
type DiffRow = Record<string, number>;
type ResultItem = GenericRow | DiffRow;

function toNumericRecord(row: GenericRow): NumericRecord {
	const out: NumericRecord = {};
	for (const [k, v] of Object.entries(row)) {
		if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
	}
	return out;
}

export const statsRouter = new Elysia({ prefix: "/api/stats" })
	.get("/daily_statistics", async () => {
		const { rows: data } = await sql`
			select *
			from "daily_statistics"
			order by "created_at" desc
		`.execute(db);
		return data;
	})
	.get("/combined_daily_statistics", async () => {
		// Get all distinct dates from daily_statistics
		const { rows: dates } = await sql`
			select distinct date("created_at") as d
			from "daily_statistics"
			order by d desc
		`.execute(db);

		const results: GenericRow[] = [];

		for (const { d } of dates as Array<{ d: string }>) {
			// Get all rows for this date
			const { rows } = await sql`
				select *
				from "daily_statistics"
				where date("created_at") = ${d}
			`.execute(db);

			if (rows.length === 0) continue;

			// Merge numeric values for each column
			const merged: GenericRow = {};
			for (const row of rows) {
				for (const [key, value] of Object.entries(row as GenericRow)) {
					if (typeof value === "number" && Number.isFinite(value)) {
						merged[key] =
							(typeof merged[key] === "number" ? merged[key] : 0) + value;
					} else if (merged[key] === undefined) {
						merged[key] = value;
					}
				}
			}
			// Set the date column
			merged.date = d;
			results.push(merged);
		}

		return results;
	})
	.get("/daily_statistics_recovery", async () => {
		// const data = await db
		// 	.selectFrom("daily_statistics_recovery")
		// 	.selectAll()
		// 	.execute();
		// return data;
		const { rows } = await sql`
				select * from "daily_statistics_recovery"
				order by "created_at" desc
			`.execute(db);
		return rows;
	})
	.get("/combined_daily_statistics_recovery", async () => {
		// Get all distinct dates from daily_statistics_recovery
		const { rows: dates } = await sql`
			select distinct date("created_at") as d
			from "daily_statistics_recovery"
			order by d desc
		`.execute(db);

		const results: GenericRow[] = [];

		for (const { d } of dates as Array<{ d: string }>) {
			// Get all rows for this date
			const { rows } = await sql`
				select *
				from "daily_statistics_recovery"
				where date("created_at") = ${d}
			`.execute(db);

			if (rows.length === 0) continue;

			// Merge numeric values for each column
			const merged: GenericRow = {};
			for (const row of rows) {
				for (const [key, value] of Object.entries(row as GenericRow)) {
					if (typeof value === "number" && Number.isFinite(value)) {
						merged[key] =
							(typeof merged[key] === "number" ? merged[key] : 0) + value;
					} else if (merged[key] === undefined) {
						merged[key] = value;
					}
				}
			}
			// Set the date column
			merged.date = d;
			results.push(merged);
		}

		return results;
	})
	.get("/daily_statistics_scraper", async () => {
		const { rows } = await sql`
				select * from ${sql.ref("daily_statistics_scraper")}
				order by "created_at" desc
			`.execute(db);
		return rows;
	})
	.get("/combined_daily_statistics_scrapers", async () => {
		// Get all distinct dates from daily_statistics_scraper
		const { rows: dates } = await sql`
			select distinct date("created_at") as d
			from "daily_statistics_scraper"
			order by d desc
		`.execute(db);

		const results: GenericRow[] = [];

		for (const { d } of dates as Array<{ d: string }>) {
			// Get all rows for this date
			const { rows } = await sql`
				select *
				from "daily_statistics_scraper"
				where date("created_at") = ${d}
			`.execute(db);

			if (rows.length === 0) continue;

			// Merge numeric values for each column
			const merged: GenericRow = {};
			for (const row of rows) {
				for (const [key, value] of Object.entries(row as GenericRow)) {
					if (typeof value === "number" && Number.isFinite(value)) {
						merged[key] =
							(typeof merged[key] === "number" ? merged[key] : 0) + value;
					} else if (merged[key] === undefined) {
						merged[key] = value;
					}
				}
			}
			// Set the date column
			merged.date = d;
			results.push(merged);
		}

		return results;
	})
	// .get("/change_48_hours", async () => {
	// 	// Get the 18 most recent distinct dates
	// 	const dates = await db
	// 		.selectFrom("daily_statistics")
	// 		.select("created_at")
	// 		.distinct()
	// 		.orderBy("created_at", "desc")
	// 		.limit(18)
	// 		.execute();

	// 	if (dates.length < 18) {
	// 		return { recent: [], previous: [] };
	// 	}

	// 	const recentDate = dates[0].created_at;
	// 	const previousDate = dates[dates.length - 1].created_at;

	// 	const recent = await db
	// 		.selectFrom("daily_statistics")
	// 		.selectAll()
	// 		.where(
	// 			db.fn("DATE", ["created_at"]),
	// 			"=",
	// 			recentDate.toISOString().slice(0, 10),
	// 		)
	// 		.execute();

	// 	const previous = await db
	// 		.selectFrom("daily_statistics")
	// 		.selectAll()
	// 		.where(
	// 			db.fn("DATE", ["created_at"]),
	// 			"=",
	// 			previousDate.toISOString().slice(0, 10),
	// 		)
	// 		.execute();

	// 	const result: ResultItem[] = [];
	// 	const len = Math.min(previous.length, recent.length);

	// 	for (let i = 0; i < len; i++) {
	// 		const prev = previous[i] as GenericRow;
	// 		const rec = recent[i] as GenericRow;

	// 		const prevNum = toNumericRecord(prev);
	// 		const recNum = toNumericRecord(rec);

	// 		const diff: DiffRow = {};
	// 		for (const key of Object.keys(prevNum)) {
	// 			if (key in recNum) {
	// 				diff[key] = recNum[key] - prevNum[key];
	// 			}
	// 		}

	// 		// Preserve your original flat array structure: [prev, rec, diff, ...]
	// 		result.push(prev, rec, diff);
	// 	}

	// 	return result;
	// })
	.get("/change_48_hours", async () => {
		// previous = rows from the 18th-most-recent distinct date
		// Get the 18 most recent distinct dates, ordered by created_at desc
		const { rows: dates } = await sql`
			select distinct date("created_at") as d
			from "daily_statistics"
			order by d desc
			limit 18
		`.execute(db);

		if (dates.length === 0) {
			return { recent: [], previous: [] };
		}

		const mostRecentDate = (dates as Array<{ d: string }>)[0].d;
		const previousDate = (dates as Array<{ d: string }>)[1]?.d;

		// Get rows for the most recent date
		const { rows: recent } = await sql`
			select *
			from "daily_statistics"
			where date("created_at") = ${mostRecentDate}
			order by "created_at" desc
		`.execute(db);

		// Get rows for the previous date
		const { rows: previous } = previousDate
			? await sql`
				select *
				from "daily_statistics"
				where date("created_at") = ${previousDate}
				order by "created_at" desc
			`.execute(db)
			: { rows: [] };

		// Create a map for previous rows by mp_name
		const prevMap = new Map<string, GenericRow>();
		for (const row of previous) {
			const typedRow = row as GenericRow;
			if (typedRow.mp_name && typeof typedRow.mp_name === "string") {
				prevMap.set(typedRow.mp_name, typedRow);
			}
		}

		const result: ResultItem[] = [];
		for (const rec of recent as GenericRow[]) {
			const mpName = rec.mp_name as string;
			const prev = prevMap.get(mpName);
			if (!prev) continue;

			const prevNum = toNumericRecord(prev);
			const recNum = toNumericRecord(rec);

			const diff: DiffRow = {};
			for (const key of Object.keys(prevNum)) {
				if (key in recNum) diff[key] = recNum[key] - prevNum[key];
			}

			result.push(prev, rec, diff);
		}

		return result;
	})

	// .get("/sort", async () => {
	// 	// Same structure as /change_48_hours
	// 	const dates = await db
	// 		.selectFrom("daily_statistics")
	// 		.select("created_at")
	// 		.distinct()
	// 		.orderBy("created_at", "desc")
	// 		.limit(18)
	// 		.execute();

	// 	if (dates.length < 18) {
	// 		return { recent: [], previous: [] };
	// 	}

	// 	const recentDate = dates[0].created_at;
	// 	const previousDate = dates[dates.length - 1].created_at;

	// 	const recent = await db
	// 		.selectFrom("daily_statistics")
	// 		.selectAll()
	// 		.where(
	// 			db.fn("DATE", ["created_at"]),
	// 			"=",
	// 			recentDate.toISOString().slice(0, 10),
	// 		)
	// 		.execute();

	// 	const previous = await db
	// 		.selectFrom("daily_statistics")
	// 		.selectAll()
	// 		.where(
	// 			db.fn("DATE", ["created_at"]),
	// 			"=",
	// 			previousDate.toISOString().slice(0, 10),
	// 		)
	// 		.execute();

	// 	const result: ResultItem[] = [];
	// 	const len = Math.min(previous.length, recent.length);

	// 	for (let i = 0; i < len; i++) {
	// 		const prev = previous[i] as GenericRow;
	// 		const rec = recent[i] as GenericRow;

	// 		const prevNum = toNumericRecord(prev);
	// 		const recNum = toNumericRecord(rec);

	// 		const diff: DiffRow = {};
	// 		for (const key of Object.keys(prevNum)) {
	// 			if (key in recNum) {
	// 				diff[key] = recNum[key] - prevNum[key];
	// 			}
	// 		}

	// 		result.push(prev, rec, diff);
	// 	}

	// 	return result;
	// })
	.get("/sort", async () => {
		// Same structure as /change_48_hours
		// previous = rows from the 18th-most-recent distinct date
		const { rows: dates } = await sql`
			select distinct date("created_at") as d
			from "daily_statistics"
			order by d desc
			limit 18
		`.execute(db);

		if (dates.length === 0) {
			return { recent: [], previous: [] };
		}

		const mostRecentDate = (dates as Array<{ d: string }>)[0].d;
		const previousDate = (dates as Array<{ d: string }>)[1]?.d;

		// Get rows for the most recent date
		const { rows: recent } = await sql`
			select *
			from "daily_statistics"
			where date("created_at") = ${mostRecentDate}
			order by "created_at" desc
		`.execute(db);

		// Get rows for the previous date
		const { rows: previous } = previousDate
			? await sql`
				select *
				from "daily_statistics"
				where date("created_at") = ${previousDate}
				order by "created_at" desc
			`.execute(db)
			: { rows: [] };

		// Create a map for previous rows by mp_name
		const prevMap = new Map<string, GenericRow>();
		for (const row of previous) {
			const typedRow = row as GenericRow;
			if (typedRow.mp_name && typeof typedRow.mp_name === "string") {
				prevMap.set(typedRow.mp_name, typedRow);
			}
		}

		const result: ResultItem[] = [];
		for (const rec of recent as GenericRow[]) {
			const mpName = rec.mp_name as string;
			const prev = prevMap.get(mpName);
			if (!prev) continue;

			const prevNum = toNumericRecord(prev);
			const recNum = toNumericRecord(rec);

			const diff: DiffRow = {};
			for (const key of Object.keys(prevNum)) {
				if (key in recNum) diff[key] = recNum[key] - prevNum[key];
			}

			result.push(prev, rec, diff);
		}

		return result;
	})
	.get("/settings", async () => {
		// const data = await db
		// 	.selectFrom("mp_account_settings")
		// 	.selectAll()
		// 	.execute();
		// return data;
		const { rows } =
			await sql`select * from ${sql.ref("mp_account_settings")}`.execute(db);
		return rows;
	});
