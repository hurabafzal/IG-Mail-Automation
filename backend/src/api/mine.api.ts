import { createId } from "@paralleldrive/cuid2";
import { stringify } from "csv-stringify/sync";
import Elysia, { t } from "elysia";
import { sql } from "kysely";
import { db } from "../db";
import { chunkArray } from "../utils/chunkArray";

export const mineRouter = new Elysia({ prefix: "/api/mine" })
	.get("/list", async () => {
		const tasks = await db
			.selectFrom("ManualMiningQueue")
			.select((x) => [
				x.fn.countAll<number>().as("count"),
				"batch_id",
				"batch_title",
				sql<number>`SUM(CASE WHEN (not_found = true OR account_id IS NOT NULL) THEN 1 ELSE 0 END)`.as(
					"processed_count",
				),
				sql<number>`SUM(CASE WHEN "private" = true THEN 1 ELSE 0 END)`.as(
					"private_count",
				),
				sql<number>`SUM(CASE WHEN ("private" = false AND account_id IS NOT NULL) THEN 1 ELSE 0 END)`.as(
					"public_count",
				),
				sql<number>`SUM(CASE WHEN not_found = true THEN 1 ELSE 0 END)`.as(
					"not_found_count",
				),
				sql<Date>`MAX("createdAt")`.as("createdAt"),
			])
			.groupBy(["batch_id", "batch_title"])
			.orderBy("createdAt", "desc")
			.execute();
		return tasks;
	})
	.post(
		"/new",
		async ({ body }) => {
			const { title, usernames: raw_usernames } = body;
			const usernames = Array.from(
				new Set(
					raw_usernames
						.split("\n")
						.map((x) => x.trim())
						.filter((x) => x.length > 0),
				),
			);
			const batch_id = createId();
			const chunks = chunkArray(Array.from(usernames), 1000);

			for (const chunk of chunks) {
				await db
					.insertInto("ManualMiningQueue")
					.values(
						chunk.map((x) => ({
							batch_title: title,
							username: x,
							batch_id,
						})),
					)
					.execute();
			}

			return {
				batch_id,
			};
		},
		{
			body: t.Object({
				title: t.String(),
				usernames: t.String(),
			}),
		},
	)
	.get(
		"/:id/output",
		async ({ params: { id } }) => {
			const accounts = await db
				.selectFrom("ManualMiningQueue")
				.select([
					"account_id",
					"not_found",
					"private",
					"username",
					"full_name",
					"followers_count",
					"following_count",
					"posts_count",
					"bio",
				])
				.where("batch_id", "=", id)
				.execute();

			const csv = stringify(
				accounts.map((a) => ({
					...a,
					private: a.private ? "yes" : "no",
					not_found: a.not_found ? "yes" : "no",
				})),
				{
					header: true,
				},
			);

			return new Response(csv, {
				headers: {
					"Content-Type": "text/csv",
				},
			});
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		},
	);
