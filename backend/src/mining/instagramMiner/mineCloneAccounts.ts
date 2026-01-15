import { randomNameVariation } from "backend/src/cloneTool/utils/random-variation";
import { db } from "backend/src/db";
import { infinite_loop_effect } from "backend/src/utils/infinite_loop_effect";
import { Console, Effect, Either, Schedule, Unify, pipe } from "effect";
import { browser_mine_web_profiles } from "./mineWebProfiles";

class NotEnoughData {
	readonly _tag = "NotEnoughData";
}

class NotMissingError {
	readonly _tag = "NotMissingError";
}

const getCloneAccounts = Effect.promise(() =>
	db
		.selectFrom("UsersToClone")
		.select(["UsersToClone.alt_username as username", "ig_id", "id"])
		.where("alt_name_unique", "=", false)
		.where("alt_username", "is not", null)
		.execute(),
);

const thing = pipe(
	getCloneAccounts,
	Effect.tap((accounts) =>
		console.log(`pending new instagram accounts: ${accounts.length}`),
	),
	Effect.andThen((a) =>
		a.length < 1 ? Either.left(new NotEnoughData()) : Either.right(a),
	),
	Effect.andThen((accounts) =>
		pipe(
			browser_mine_web_profiles(accounts.map((a) => a.username ?? "")),
			Effect.andThen((p) =>
				Effect.all({
					profiles: Effect.succeed(p),
				}),
			),
			Effect.andThen(({ profiles }) =>
				Effect.all(
					profiles.map((d, i) =>
						pipe(
							///////////////////////////////////////
							//            GET ERRORS
							///////////////////////////////////////
							Unify.unify(
								d.success || d.error !== "missing"
									? Either.left(new NotMissingError())
									: Either.right(d),
							),

							///////////////////////////////////////
							//         Mark Clone as Valid
							///////////////////////////////////////
							Effect.tap(
								Console.log(
									`[${i}/${profiles.length}] unique name: ${d.username}`,
								),
							),
							Effect.andThen((x) =>
								Effect.promise(() =>
									db
										.updateTable("UsersToClone")
										.set({
											alt_name_unique: true,
										})
										.where("UsersToClone.alt_username", "=", x.username)
										.execute(),
								),
							),

							///////////////////////////////////////
							//           ERROR HANDLING
							///////////////////////////////////////
							Effect.catchTags({
								NotMissingError: () => {
									const newName = randomNameVariation(d.username);
									console.log(
										`[${i}/${profiles.length}] not unique:  ${d.username} - set variation: ${newName}`,
									);
									return Effect.tryPromise(() =>
										db
											.updateTable("UsersToClone")
											.set((eb) => ({
												alt_name_unique: false,
												name_attempts: eb("name_attempts", "+", 1),
												alt_username: newName,
											}))
											.where("alt_username", "=", d.username)
											.execute(),
									);
								},
								// UnknownException: Console.error,
							}),
						),
					),
					{ concurrency: 5 },
				),
			),
		),
	),
);

export const mineCloneAccounts = () =>
	infinite_loop_effect(
		"checkCloneAccountUsernames",
		thing,
		Schedule.spaced("5 seconds"),
	);
