import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, Schedule, pipe } from "effect";
import { db } from "../db";
import { sendSlackMessageE } from "../utils/slack";
import { DownloadProfilePictures } from "./utils/download-pfp";
import { fillCloneTask, unfilledTasks } from "./utils/fill-clone-task";
import { GptQualifierService } from "./utils/gpt-qualifier";
import { getGptNameVariations } from "./utils/gpt-variation";

export const pfpTempDir = ".out/temp_images";

//////////////////////////////////////////////////////////////////
//                        Fill Tasks                            //
//////////////////////////////////////////////////////////////////
function FillCloneTasks() {
	return pipe(
		unfilledTasks,
		Effect.tap((x) => {
			Console.log(`[unfilled clone tasks] got ${x.length} unfilled tasks`);
			console.log("Unfilled tasks detail:", x); // <-- Add this line to log the details
		}),
		Effect.andThen((unfilledTasks) =>
			Effect.all(
				unfilledTasks.flatMap((task) => [
					// male
					Console.log(
						`[fill clone tasks] got ${task.missing_male} fill tasks for male`,
					),
					fillCloneTask(task.missing_male, task.id, "M", task.target_country),

					// female
					Console.log(
						`[fill clone tasks] got ${task.missing_female} fill tasks for female`,
					),
					fillCloneTask(task.missing_female, task.id, "F", task.target_country),
				]),
			),
		),

		// error handling and cycles
		// Effect.catchAll((e) => {
		// 	console.error(e);
		// 	return sendSlackMessageE(`[fill clone error] - ${e.cause}`);
		// }),
		// Effect.catchAllDefect((e) =>
		// 	sendSlackMessageE(`[fill clone defect] - ${e}`),
		// ),
		Effect.repeat({ schedule: Schedule.spaced("4 minutes") }),
	);
}

//////////////////////////////////////////////////////////////////
//                     Profile Pictures                         //
//////////////////////////////////////////////////////////////////
function ProfilePicturesHandler() {
	return pipe(
		Effect.promise(() =>
			db
				.selectFrom("UsersToClone")
				.innerJoin(
					"InstagramAccountBase",
					"UsersToClone.ig_id",
					"InstagramAccountBase.id",
				)
				.innerJoin("CloneTask", "UsersToClone.TaskId", "CloneTask.id")
				.select(["UsersToClone.id", "ig_id", "username", "ig_full_name"])
				.where("UsersToClone.got_pfp", "=", false)
				.where("pfp_last_attempted", "is", null)
				.where("missing", "=", false)
				.orderBy("CloneTask.createdAt", "desc")
				.execute(),
		),
		Effect.andThen((r) => DownloadProfilePictures(r)),

		// error handling and cycles
		// Effect.catchAll((e) => sendSlackMessageE(`[pfp error] - ${e}`)),
		// Effect.catchAllDefect((e) => sendSlackMessageE(`[pfp defect] - ${e}`)),
		Effect.repeat({ schedule: Schedule.spaced("5 minutes") }),
	);
}

//////////////////////////////////////////////////////////////////
//                      Name Variants                           //
//////////////////////////////////////////////////////////////////
function CreateGptNameVariations() {
	return pipe(
		getGptNameVariations(),

		// error handling and cycles
		// Effect.catchAll((e) => {
		// 	console.error(e.cause);
		// 	return sendSlackMessageE(`[name variation error] - ${e.cause}`);
		// }),
		// Effect.catchAllDefect((e) => {
		// 	console.error(e);
		// 	return sendSlackMessageE(`[name variation defect] - ${e}`);
		// }),
		Effect.repeat({ schedule: Schedule.spaced("5 minutes") }),
	);
}

//////////////////////////////////////////////////////////////////
//                          Service                             //
//////////////////////////////////////////////////////////////////
export const CloneService = Effect.all(
	[
		GptQualifierService(),
		FillCloneTasks(),
		ProfilePicturesHandler(),
		CreateGptNameVariations(),
		// other parts here
	],
	{ concurrency: "unbounded" },
);

// BunRuntime.runMain(CloneService);
