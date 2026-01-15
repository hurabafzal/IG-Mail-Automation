import { db } from "backend/src/db";
import { Console, Effect, pipe } from "effect";
import { sql } from "kysely";
import { z } from "zod";

export function fillCloneTask(
	count: number,
	taskId: number,
	gender: "M" | "F",
	target_country: string | null,
) {
	if (count <= 0) return Effect.void;
	console.log(target_country);
	return pipe(
		Effect.promise(() =>
			db
				.selectFrom("InstagramAccountBase as b")
				.select(["b.id", "b.username", "b.ig_full_name"])
				.leftJoin("UsersToClone", "UsersToClone.ig_id", "b.id")
				.where("b.ai_bio_lang", "=", "DE")
				.where("b.ai_bio_lang_conf", ">=", 3)
				.where("b.gender", "=", gender)
				.where("b.gender_conf", ">=", 4)
				.where("b.bio", "is not", null)
				.where("b.bio", "!=", "")
				// .where("b.pfpUrl", "is not", null)
				.where("b.posts_count", ">=", 5)
				.where("b.posts_count", "<=", 40)
				.where("b.followers_count", ">=", 50)
				.where("b.followers_count", "<=", 1000)
				.where("b.following_count", ">=", 50)
				.where("b.following_count", "<=", 1000)
				.where((eb) =>
					eb.or([
						eb("b.external_link", "is", null),
						eb("b.external_link", "=", ""),
					]),
				)
				// .where("last_updated", "<=", daysAgo(14))
				.limit(Math.min(count, 15000))
				.orderBy("b.clone_count", "asc")
				.orderBy("UsersToClone.createdAt", "asc")
				.execute(),
		),

		Effect.tap((accounts) =>
			Console.log(`[fill clone task] got ${accounts.length} accounts`),
		),

		Effect.tap((accounts) =>
			Console.log("[fill clone task] accounts from DB:", accounts),
		),

		Effect.map((accounts) =>
			accounts.filter(
				(account, index, self) =>
					index === self.findIndex((t) => t.username === account.username),
			),
		),

		Effect.tap((accounts) =>
			Console.log(`[fill clone task] deduplicated ${accounts.length} accounts`),
		),

		Effect.tap((accounts) =>
			accounts.length > 0
				? Effect.tryPromise(() =>
						db
							.insertInto("UsersToClone")
							.values(
								accounts.map((account) => ({
									ig_id: account.id,
									og_full_name: account.ig_full_name,
									og_username: account.username,
									TaskId: taskId,
								})),
							)
							.onConflict((o) => o.doNothing())
							.execute(),
					)
				: Effect.void,
		),

		Effect.andThen((accounts) =>
			accounts.length > 0
				? Effect.tryPromise(() =>
						db
							.updateTable("InstagramAccountBase")
							.set((eb) => ({
								clone_count: eb("clone_count", "+", 1),
							}))
							.where(
								"id",
								"in",
								accounts.map((x) => x.id),
							)
							.execute(),
					)
				: Effect.void,
		),
	);
}

const itemSchema = z.object({
	id: z.number(),
	title: z.string(),
	target_male: z.number(),
	target_female: z.number(),
	current_count_male: z.coerce.number(),
	current_count_female: z.coerce.number(),
	target_country: z.string().nullable(),
});
const schema = z.array(itemSchema);

export const unfilledTasks = Effect.promise(() =>
	db
		.selectFrom("CloneTask")
		.leftJoin("UsersToClone", "CloneTask.id", "UsersToClone.TaskId")
		.leftJoin(
			"InstagramAccountBase",
			"UsersToClone.ig_id",
			"InstagramAccountBase.id",
		)
		.select((e) => [
			"CloneTask.id",
			"CloneTask.title",
			"CloneTask.target_male",
			"CloneTask.target_female",
			"CloneTask.target_country",
			e.fn
				.count("UsersToClone.ig_id")
				.filterWhere((q) => q("InstagramAccountBase.gender", "=", "M"))
				.as("current_count_male"),
			e.fn
				.count("UsersToClone.ig_id")
				.filterWhere((q) => q("InstagramAccountBase.gender", "=", "F"))
				.as("current_count_female"),
		])
		.groupBy(["CloneTask.id", "CloneTask.title"])
		.where((q) =>
			q.or([
				q("UsersToClone.pfp_fail", "=", false),
				q("UsersToClone.pfp_last_attempted", "is", null),
			]),
		)
		.execute()
		.then((x) =>
			z
				.array(
					itemSchema.extend({
						target_country: z.string().nullable(),
					}),
				)
				.parse(x),
		)
		.then((tasks) =>
			tasks
				.filter(
					(task) =>
						task.target_male > task.current_count_male ||
						task.target_female > task.current_count_female,
				)
				.map((x) => ({
					...x,
					missing_male: x.target_male - x.current_count_male,
					missing_female: x.target_female - x.current_count_female,
				})),
		),
).pipe(Effect.tap(Console.log));

// export const unfilledTasks = Effect.promise(async () => {
// 	const { rows } = await sql`
//     select
//       ct."id",
//       ct."title",
//       ct."target_male",
//       ct."target_female",
//       ct."target_country",
//       coalesce(sum(case when iab."gender" = 'M' then 1 else 0 end), 0) as "current_count_male",
//       coalesce(sum(case when iab."gender" = 'F' then 1 else 0 end), 0) as "current_count_female"
//     from "CloneTask" ct
//     left join "UsersToClone" utc on ct."id" = utc."TaskId"
//     left join "InstagramAccountBase" iab on utc."ig_id" = iab."id"
//     where (utc."pfp_fail" = false or utc."pfp_last_attempted" is null)
//     group by ct."id", ct."title", ct."target_male", ct."target_female", ct."target_country"
//   `.execute(db);

// 	const tasks = z
// 		.array(
// 			itemSchema.extend({
// 				// keep the old key so you don't have to touch callers
// 				target_country: z.string().nullable(),
// 			}),
// 		)
// 		.parse(rows);

// 	return tasks
// 		.filter(
// 			(t) =>
// 				t.target_male > t.current_count_male ||
// 				t.target_female > t.current_count_female,
// 		)
// 		.map((x) => ({
// 			...x,
// 			missing_male: x.target_male - x.current_count_male,
// 			missing_female: x.target_female - x.current_count_female,
// 		}));
// }).pipe(Effect.tap(Console.log));
// To run this Effect and get the result, use the following code in your main file or a script:

// async function main() {
// 	const result = await Effect.runPromise(unfilledTasks);
// 	console.log(result);
// }

// main();
