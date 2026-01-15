import { Effect } from "effect";
import { Elysia, t } from "elysia";
import { z } from "zod";
import { createZip } from "../cloneTool/clone.controller";
import { db } from "../db";

const taskSchema = z.object({
	id: z.number(),
	title: z.string(),
	target: z.coerce.number(),
	target_male: z.coerce.number(),
	target_female: z.coerce.number(),
	total_count: z.coerce.number(),
	got_pfp_count: z.coerce.number(),
	done_count: z.coerce.number(),
});
const tasksSchema = z.array(taskSchema);
function convertBigIntToNumber(obj: unknown): unknown {
	if (typeof obj === "bigint") return Number(obj);
	if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
	if (obj && typeof obj === "object") {
		return Object.fromEntries(
			Object.entries(obj).map(([k, v]) => [k, convertBigIntToNumber(v)]),
		);
	}
	return obj;
}
export const cloneRouter = new Elysia({ prefix: "/api/clone" })
	.get("/list", async () => {
		const tasks = await db
			.selectFrom("CloneTask")
			.leftJoin("UsersToClone", "UsersToClone.TaskId", "CloneTask.id")
			.select((x) => [
				x.fn.count<number>("UsersToClone.ig_id").as("total_count"),
				x.fn
					.count<number>("UsersToClone.ig_id")
					.filterWhere("got_pfp", "=", true)
					.as("got_pfp_count"),
				x.fn
					.count<number>("UsersToClone.ig_id")
					.filterWhere("got_pfp", "=", true)
					.filterWhere("UsersToClone.alt_name_unique", "=", true)
					.as("done_count"),
				"CloneTask.id",
				"CloneTask.target",
				"CloneTask.target_male",
				"CloneTask.target_female",
				"CloneTask.title",
			])
			.groupBy("CloneTask.id")
			.orderBy("CloneTask.createdAt", "desc")
			.execute();

		const res = tasksSchema.parse(tasks);
		return res.map((x) => ({
			...x,
			done_count: Math.min(x.done_count, x.target),
			got_pfp_count: Math.min(x.got_pfp_count, x.target),
			total_count: Math.min(x.total_count, x.target),
		}));
	})
	.post(
		"/new",
		async ({ body: { title, target_male, target_female, target_country } }) => {
			const result = await db
				.insertInto("CloneTask")
				.values({
					target: target_male + target_female,
					title,
					target_male,
					target_female,
					target_country,
				})
				.execute();
			return convertBigIntToNumber(result); // <-- Ensure BigInt is converted
		},
		{
			body: t.Object({
				title: t.String(),
				target_male: t.Number(),
				target_female: t.Number(),
				target_country: t.String(),
			}),
		},
	)
	.get(
		"/:id/zip",
		async ({ params: { id } }) => {
			const location = await Effect.runPromise(createZip(id));
			return Bun.file(location);
		},
		{
			params: t.Object({
				id: t.Numeric(),
			}),
		},
	);
