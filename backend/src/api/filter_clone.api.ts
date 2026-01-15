// import { Effect } from "effect";
// import { Elysia, t } from "elysia";
// import { z } from "zod";
// import { createZipFilter } from "../cloneTool/clone.controller";
// import { db } from "../db";

// const taskSchema = z.object({
// 	id: z.number(),
// 	title: z.string(),
// 	target: z.coerce.number(),
// 	target_male: z.coerce.number(),
// 	target_female: z.coerce.number(),
// 	total_count: z.coerce.number(),
// 	got_pfp_count: z.coerce.number(),
// 	done_count: z.coerce.number(),
// });
// const tasksSchema = z.array(taskSchema);

// export const FiltercloneRouter = new Elysia({ prefix: "/api/filtertask/clone" })
// 	.get("/list", async () => {
// 		const tasks = await db
// 			.selectFrom("FilterCloneTask")
// 			.leftJoin("FilterUserToClone", "FilterUserToClone.TaskId", "FilterCloneTask.id")
// 			.select((x) => [
// 				x.fn
// 					.countAll<number>()
// 					.filterWhere("pfp_fail", "=", false)
// 					.as("total_count"),
// 				x.fn
// 					.count<number>("FilterUserToClone.ig_id")
// 					.filterWhere("got_pfp", "=", true)
// 					.as("got_pfp_count"),
// 				x.fn
// 					.count<number>("FilterUserToClone.ig_id")
// 					.filterWhere("got_pfp", "=", true)
// 					.filterWhere("FilterUserToClone.alt_name_unique", "=", true)
// 					.as("done_count"),
// 				"FilterCloneTask.id",
// 				"FilterCloneTask.target",
// 				"FilterCloneTask.target_male",
// 				"FilterCloneTask.target_female",
// 				"FilterCloneTask.title",
// 			])
// 			.groupBy("FilterCloneTask.id")
// 			.orderBy("FilterCloneTask.createdAt", "desc")
// 			.execute();

// 		const res = tasksSchema.parse(tasks);
// 		return res.map((x) => ({
// 			...x,
// 			done_count: Math.min(x.done_count, x.target),
// 			got_pfp_count: Math.min(x.got_pfp_count, x.target),
// 			total_count: Math.min(x.total_count, x.target),
// 		}));
// 	})
// 	.post(
// 		"/new",
// 		async ({ body: { title, target_male, target_female, target_country,keywords,min_followers,max_followers,result_limit ,post_date} }) => {

// 			return await db
// 				.insertInto("FilterCloneTask")
// 				.values({
// 					target: target_male + target_female,
// 					title,
// 					target_male,
// 					target_female,
// 					target_country,
// 					keywords,
// 					min_followers,
// 					max_followers,
// 					result_limit,
// 					post_date
// 				})
// 				.execute();
// 		},
// 		{
// 			body: t.Object({
// 				title: t.String(),
// 				target_male: t.Number(),
// 				target_female: t.Number(),
// 				target_country: t.String(),
// 				keywords: t.String(),
// 				min_followers: t.Number(),
// 				max_followers: t.Number(),
// 				limit: t.Number(),
// 				result_limit: t.Number(),
// 				post_date: t.String()
// 			}),
// 		},
// 	)
// 	.get(
// 		"/:id/zip",
// 		async ({ params: { id } }) => {
// 			const location = await Effect.runPromise(createZipFilter(id));
// 			return Bun.file(location);
// 		},
// 		{
// 			params: t.Object({
// 				id: t.Numeric(),
// 			}),
// 		},
// 	);
// import { Effect } from "effect";
// import { Elysia, t } from "elysia";
// import { z } from "zod";
// // import { createZipFilter } from "../cloneTool/clone.controller";
// import { db } from "../db";

// const taskSchema = z.object({
// 	id: z.number(),
// 	title: z.string(),
// 	target: z.coerce.number(),
// 	target_male: z.coerce.number(),
// 	target_female: z.coerce.number(),
// 	total_count: z.coerce.number(),
// 	got_pfp_count: z.coerce.number(),
// 	done_count: z.coerce.number(),
// });
// const tasksSchema = z.array(taskSchema);

// export const FiltercloneRouter = new Elysia({ prefix: "/api/filtertask/clone" })
// 	.get("/list", async () => {
// 		const tasks = await db
// 			.selectFrom("FilterCloneTask")
// 			.leftJoin(
// 				"FilterUserToClone",
// 				"FilterUserToClone.TaskId",
// 				"FilterCloneTask.id",
// 			)
// 			.select((x) => [
// 				x.fn
// 					.countAll<number>()
// 					.filterWhere("pfp_fail", "=", false)
// 					.as("total_count"),
// 				x.fn
// 					.count<number>("FilterUserToClone.ig_id")
// 					.filterWhere("got_pfp", "=", true)
// 					.as("got_pfp_count"),
// 				x.fn
// 					.count<number>("FilterUserToClone.ig_id")
// 					.filterWhere("got_pfp", "=", true)
// 					.filterWhere("FilterUserToClone.alt_name_unique", "=", true)
// 					.as("done_count"),
// 				"FilterCloneTask.id",
// 				"FilterCloneTask.target",
// 				"FilterCloneTask.target_male",
// 				"FilterCloneTask.target_female",
// 				"FilterCloneTask.title",
// 			])
// 			.groupBy("FilterCloneTask.id")
// 			.orderBy("FilterCloneTask.createdAt", "desc")
// 			.execute();

// 		const res = tasksSchema.parse(tasks);
// 		return res.map((x) => ({
// 			...x,
// 			done_count: Math.min(x.done_count, x.target),
// 			got_pfp_count: Math.min(x.got_pfp_count, x.target),
// 			total_count: Math.min(x.total_count, x.target),
// 		}));
// 	})
// 	.post(
// 		"/new",
// 		async ({ body }) => {
// 			const result_limit = body.result_limit ?? body.limit;

// 			return await db
// 				.insertInto("FilterCloneTask")
// 				.values({
// 					target: body.target_male + body.target_female,
// 					title: body.title,
// 					target_male: body.target_male,
// 					target_female: body.target_female,
// 					target_country: body.target_country,
// 					keywords: body.keywords,
// 					min_followers: body.min_followers,
// 					max_followers: body.max_followers,
// 					result_limit: body.result_limit,
// 					post_date: body.post_date,
// 				})
// 				.execute();
// 		},
// 		{
// 			body: t.Object({
// 				title: t.String(),
// 				target_male: t.Number(),
// 				target_female: t.Number(),
// 				target_country: t.String(),
// 				keywords: t.String(),
// 				min_followers: t.Number(),
// 				max_followers: t.Number(),
// 				result_limit: t.Number(),
// 				limit: t.Optional(t.Number()), // Accept limit as well
// 				post_date: t.String(),
// 			}),
// 		},
// 	)
// 	.get(
// 		"/:id/zip",
// 		async ({ params: { id } }) => {
// 			const location = await Effect.runPromise(createZipFilter(id));
// 			return Bun.file(location);
// 		},
// 		{
// 			params: t.Object({
// 				id: t.Numeric(),
// 			}),
// 		},
// 	);

// import { Effect } from "effect";
// import { is } from "effect/ParseResult";
// import { Elysia, t } from "elysia";
// import { z } from "zod";
// // import { createZipFilter } from "../cloneTool/clone.controller";
// import { db } from "../db";

// const taskSchema = z.object({
// 	id: z.number(),
// 	title: z.string(),
// 	target: z.coerce.number(),
// 	target_male: z.coerce.number(),
// 	target_female: z.coerce.number(),
// 	found: z.coerce.number(), // New field
// 	result_limit: z.coerce.number(), // New field
// 	is_active: z.coerce.boolean(), // New field
// });
// const tasksSchema = z.array(taskSchema);

// // --- small CSV helper (no external CSV lib needed) ---
// function rowsToCSV(rows: Record<string, any>[]): string {
// 	if (!rows.length) return "";
// 	// Only include these columns in this order
// 	const headers = [
// 		"id",
// 		"instagram_account_id",
// 		"email",
// 		"created_at",
// 		"updated_at",
// 		"triggerid",
// 	];
// 	const esc = (v: any) => {
// 		if (v == null) return "";
// 		const s = String(v);
// 		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
// 	};
// 	const header = headers.map(esc).join(",");
// 	const lines = rows.map((r) => headers.map((h) => esc(r[h])).join(","));
// 	return [header, ...lines].join("\n");
// }

// export const FiltercloneRouter = new Elysia({ prefix: "/api/filtertask/clone" })
// 	.get("/list", async () => {
// 		const tasks = await db
// 			.selectFrom("FilterCloneTask")
// 			.select([
// 				"id",
// 				"title",
// 				"target",
// 				"target_male",
// 				"target_female",
// 				"found",
// 				"result_limit",
// 				"is_active",
// 			])
// 			.orderBy("createdAt", "desc")
// 			.execute();
// 		// Provide JS defaults for missing/null values
// 		const safeTasks = tasks.map((task) => ({
// 			id: task.id,
// 			title: task.title ?? "",
// 			target: task.target ?? 0,
// 			target_male: task.target_male ?? 0,
// 			target_female: task.target_female ?? 0,
// 			found: task.found ?? 0,
// 			result_limit: task.result_limit ?? 0,
// 			is_active: task.is_active ?? false,
// 		}));

// 		const res = tasksSchema.parse(safeTasks);
// 		return res;
// 	})
// 	.post(
// 		"/new",
// 		async ({ body }) => {
// 			const result_limit = body.result_limit ?? body.limit;

// 			return await db
// 				.insertInto("FilterCloneTask")
// 				.values({
// 					target: body.target_male + body.target_female,
// 					title: body.title,
// 					target_male: body.target_male,
// 					target_female: body.target_female,
// 					target_country: body.target_country,
// 					keywords: body.keywords,
// 					min_followers: body.min_followers,
// 					max_followers: body.max_followers,
// 					result_limit: result_limit,
// 					post_date: body.post_date,
// 				})
// 				.execute();
// 		},
// 		{
// 			body: t.Object({
// 				title: t.String(),
// 				target_male: t.Number(),
// 				target_female: t.Number(),
// 				target_country: t.String(),
// 				keywords: t.String(),
// 				min_followers: t.Number(),
// 				max_followers: t.Number(),
// 				result_limit: t.Number(),
// 				limit: t.Optional(t.Number()),
// 				post_date: t.String(),
// 			}),
// 		},
// 	)
// 	.get(
// 		"/:id/csv",
// 		async ({ params: { id } }) => {
// 			const rows = await db
// 				.selectFrom("TriggerTask")
// 				.selectAll()
// 				.where("triggerid", "=", Number(id))
// 				.execute();

// 			const csvBody = rowsToCSV(rows);
// 			const bom = "\uFEFF";
// 			const body = bom + csvBody;

// 			const filename = `trigger_${id}.csv`;
// 			const headers = {
// 				"Content-Type": "text/csv; charset=utf-8",
// 				"Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
// 			};

// 			return new Response(body, { headers });
// 		},
// 		{
// 			params: t.Object({
// 				id: t.Numeric(),
// 			}),
// 		},
// 	)
// 	.post(
// 		"/:id/active",
// 		async ({ params, body }) => {
// 			await db
// 				.updateTable("FilterCloneTask")
// 				.set({ is_active: body.is_active })
// 				.where("id", "=", Number(params.id))
// 				.execute();
// 			return { success: true };
// 		},
// 		{
// 			params: t.Object({ id: t.Numeric() }),
// 			body: t.Object({ is_active: t.Boolean() }),
// 		},
// 	);

import { post } from "@effect/platform/HttpClientRequest";
import { Effect } from "effect";
import { is } from "effect/ParseResult";
import { Elysia, t } from "elysia";
import type { Kysely } from "kysely";
import { z } from "zod";
import { db as baseDb } from "../db";

/* ──────────────────────────────────────────────────────────────
   1) Local table typings (only the fields we read/write here)
   ────────────────────────────────────────────────────────────── */
type FilterCloneTaskRow = {
	id: number | string;
	title: string | null;
	target: number | null;
	target_male: number | null;
	target_female: number | null;
	found: number | null;
	result_limit: number | null;
	is_active: boolean | null;
	createdAt: Date | string | null;

	// present in inserts (created elsewhere) but not returned in the list
	target_country?: string | null;
	keywords?: string | null;
	min_followers?: number | null;
	max_followers?: number | null;
	post_date?: Date | string | null;
	instalnty_id?: string | null;
	maxPerDay?: number | null;
	enable_mentions_scraping?: boolean | null;
	enable_hashtag_scraping?: boolean | null;
};

type TriggerTaskRow = {
	id: number;
	instagram_account_id: string;
	email: string;
	created_at: Date;
	updated_at: Date;
	triggerid: number | string;
	post_url?: string | null;
	post_text?: string | null;
};

type ExtraTables = {
	FilterCloneTask: FilterCloneTaskRow;
	TriggerTask: TriggerTaskRow;
};

// Extend the imported db's type (no `any` used)
const db = baseDb as unknown as Kysely<ExtraTables>;

/* ──────────────────────────────────────────────────────────────
   2) Zod schemas used for response shaping
   ────────────────────────────────────────────────────────────── */
const taskSchema = z.object({
	id: z.union([z.number(), z.string()]),
	title: z.string(),
	target: z.number(),
	target_male: z.number(),
	target_female: z.number(),
	found: z.number(),
	result_limit: z.number(),
	is_active: z.boolean(),
	maxPerDay: z.number().optional(),
	enable_mentions_scraping: z.boolean(),
	enable_hashtag_scraping: z.boolean(),
});
const tasksSchema = z.array(taskSchema);

/* ──────────────────────────────────────────────────────────────
   3) CSV helper
   ────────────────────────────────────────────────────────────── */
function rowsToCSV(rows: Record<string, unknown>[]): string {
	if (!rows.length) return "";
	const headers = [
		"id",
		"instagram_account_id",
		"email",
		"created_at",
		"updated_at",
		"triggerid",
		"post_url",
		"post_text",
	] as const;

	const esc = (v: unknown) => {
		if (v == null) return "";
		const s = String(v);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};

	const header = headers.join(",");
	const lines = rows.map((r) =>
		headers.map((h) => esc((r as Record<string, unknown>)[h])).join(","),
	);
	return [header, ...lines].join("\n");
}

/* ──────────────────────────────────────────────────────────────
   4) Router
   ────────────────────────────────────────────────────────────── */
export const FiltercloneRouter = new Elysia({ prefix: "/api/filtertask/clone" })
	// GET /list
	.get("/list", async () => {
		const tasks = await db
			.selectFrom("FilterCloneTask as fct")
			.select((eb) => [
				eb.ref("fct.id").as("id"),
				eb.ref("fct.title").as("title"),
				eb.ref("fct.target").as("target"),
				eb.ref("fct.target_male").as("target_male"),
				eb.ref("fct.target_female").as("target_female"),
				eb.ref("fct.found").as("found"),
				eb.ref("fct.result_limit").as("result_limit"),
				eb.ref("fct.is_active").as("is_active"),
				eb.ref("fct.maxPerDay").as("maxPerDay"),
				eb.ref("fct.enable_mentions_scraping").as("enable_mentions_scraping"),
				eb.ref("fct.enable_hashtag_scraping").as("enable_hashtag_scraping"),
			])
			.orderBy("fct.createdAt", "desc")
			.execute();

		// Normalize nullables to JS defaults for the API response
		const safeTasks = tasks.map((task) => ({
			id: task.id,
			title: task.title ?? "",
			target: task.target ?? 0,
			target_male: task.target_male ?? 0,
			target_female: task.target_female ?? 0,
			found: task.found ?? 0,
			result_limit: task.result_limit ?? 0,
			is_active: task.is_active ?? false,
			maxPerDay: task.maxPerDay ?? 0,
			enable_mentions_scraping: task.enable_mentions_scraping ?? false,
			enable_hashtag_scraping: task.enable_hashtag_scraping ?? false,
		}));

		return tasksSchema.parse(safeTasks);
	})

	// POST /new
	.post(
		"/new",
		async ({ body }) => {
			const result_limit = body.result_limit ?? body.limit;

			// Generate a new id (for example, using Date.now() or a UUID generator)
			// Get the current highest id and increment by 1
			const maxIdRow = await db
				.selectFrom("FilterCloneTask")
				.select((eb) => eb.fn.max("id").as("maxId"))
				.executeTakeFirst();

			const maxId =
				typeof maxIdRow?.maxId === "number"
					? maxIdRow.maxId
					: Number(maxIdRow?.maxId) || 0;

			const newId = maxId + 1;

			return await db
				.insertInto("FilterCloneTask")
				.values({
					id: newId,
					target: body.target_male + body.target_female,
					title: body.title,
					target_male: body.target_male,
					target_female: body.target_female,
					target_country: body.target_country,
					keywords: body.keywords,
					min_followers: body.min_followers,
					max_followers: body.max_followers,
					result_limit: result_limit,
					post_date: body.post_date,
					instalnty_id: body.instalnty_id,
					enable_mentions_scraping: body.enable_mentions_scraping ?? false,
					enable_hashtag_scraping: body.enable_hashtag_scraping ?? false,
				})
				.execute();
		},
		{
			body: t.Object({
				title: t.String(),
				target_male: t.Number(),
				target_female: t.Number(),
				target_country: t.String(),
				keywords: t.String(),
				min_followers: t.Number(),
				max_followers: t.Number(),
				result_limit: t.Number(),
				limit: t.Optional(t.Number()),
				post_date: t.String(),
				instalnty_id: t.String(),
				enable_mentions_scraping: t.Optional(t.Boolean()),
				enable_hashtag_scraping: t.Optional(t.Boolean()),
			}),
		},
	)

	// GET /:id/csv
	.get(
		"/:id/csv",
		async ({ params: { id } }) => {
			const rows = await db
				.selectFrom("TriggerTask as tt")
				.select((eb) => [
					eb.ref("tt.id").as("id"),
					eb.ref("tt.instagram_account_id").as("instagram_account_id"),
					eb.ref("tt.email").as("email"),
					eb.ref("tt.created_at").as("created_at"),
					eb.ref("tt.updated_at").as("updated_at"),
					eb.ref("tt.triggerid").as("triggerid"),
					eb.ref("tt.post_url").as("post_url"),
					eb.ref("tt.post_text").as("post_text"),
				])
				.where("tt.triggerid", "=", Number(id))
				.execute();

			const csvBody = rowsToCSV(rows as unknown as Record<string, unknown>[]);
			const bom = "\uFEFF";
			const body = bom + csvBody;

			const filename = `trigger_${id}.csv`;
			const headers = {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
					filename,
				)}`,
			};

			return new Response(body, { headers });
		},
		{
			params: t.Object({
				id: t.Numeric(),
			}),
		},
	)
	.post(
		"/maxPerDay",
		async ({ body }) => {
			const { id, maxPerDay } = body;
			await db
				.updateTable("FilterCloneTask")
				.set({ maxPerDay: Number(maxPerDay) }) // Use the actual DB column name
				.where("id", "=", Number(id))
				.execute();
			return { success: true };
		},
		{
			body: t.Object({
				id: t.Numeric(),
				maxPerDay: t.Numeric(),
			}),
		},
	)

	// POST /:id/active
	.post(
		"/:id/active",
		async ({ params, body }) => {
			await db
				.updateTable("FilterCloneTask")
				.set({ is_active: body.is_active })
				.where("id", "=", Number(params.id))
				.execute();

			return { success: true };
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({ is_active: t.Boolean() }),
		},
	)

	// POST /:id/mentionsScraping
	.post(
		"/:id/mentionsScraping",
		async ({ params, body }) => {
			await db
				.updateTable("FilterCloneTask")
				.set({ enable_mentions_scraping: body.enable_mentions_scraping })
				.where("id", "=", Number(params.id))
				.execute();

			return { success: true };
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({ enable_mentions_scraping: t.Boolean() }),
		},
	)

	// POST /:id/hashtagScraping
	.post(
		"/:id/hashtagScraping",
		async ({ params, body }) => {
			await db
				.updateTable("FilterCloneTask")
				.set({ enable_hashtag_scraping: body.enable_hashtag_scraping })
				.where("id", "=", Number(params.id))
				.execute();

			return { success: true };
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({ enable_hashtag_scraping: t.Boolean() }),
		},
	);
