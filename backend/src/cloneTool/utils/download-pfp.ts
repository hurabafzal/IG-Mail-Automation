import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { file, write } from "bun";
import { Console, Effect, pipe } from "effect";
import { db } from "../../db";
import { HikerAPI } from "../../mining/HikerAPI";
import { updateAnOutdatedAccount } from "../../mining/updateOutdatedAccounts";
import { formatError } from "./error-formatter";
//////////////////////
// asd
/////////////////////
// Rate limiting: track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests
//////////////////////
// asd
/////////////////////
async function downloadImage(url: string) {
	// const response = await fetch(url).catch(console.error);
	// if (!response?.ok) {
	// 	console.error(`HTTP error! status: ${response?.status}`, url);
	// 	return null;
	// }
	// const arrayBuffer = await response.arrayBuffer();

	//////////////////////
	// asd
	/////////////////////
	// Rate limiting: wait if requests are too frequent
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;
	if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
		const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
		console.log(
			`⏳ Rate limiting: waiting ${waitTime}ms before next request...`,
		);
		await new Promise((resolve) => setTimeout(resolve, waitTime));
	}
	lastRequestTime = Date.now();

	try {
		const response = await fetch(url);

		if (!response?.ok) {
			if (response?.status === 403) {
				console.log(`🚫 Rate limited (403): ${url} - will retry later`);
				return null; // Don't throw error, just return null
			}
			if (response?.status === 429) {
				console.log(`⏰ Too many requests (429): ${url} - waiting longer...`);
				await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
				return null;
			}
		}

		const arrayBuffer = await response.arrayBuffer();
		//////////////////////
		// asd
		/////////////////////

		// if (arrayBuffer.byteLength <= 21) {
		// 	console.log(
		// 		`Skipping ${url} due to small file size (${arrayBuffer.byteLength} bytes)`,
		// 	);
		// 	return null;
		// }
		// return new Uint8Array(arrayBuffer);

		//////////////////////
		// asd
		/////////////////////
		if (arrayBuffer.byteLength <= 21) {
			console.log(
				`Skipping ${url} due to small file size (${arrayBuffer.byteLength} bytes)`,
			);
			return null;
		}

		console.log(
			`✅ Successfully downloaded image (${arrayBuffer.byteLength} bytes)`,
		);
		return new Uint8Array(arrayBuffer);
	} catch (error) {
		console.error(`❌ Download failed: ${error}`, url);
		return null;
	}
	//////////////////////
	// asd
	/////////////////////
}

export const pfpTempDir = ".out/temp_images";
export function DownloadProfilePictures(
	ids: {
		id: number;
		ig_id: string;
		username: string;
		ig_full_name: string;
	}[],
) {
	return pipe(
		Effect.succeed(ids),
		Effect.tap((x) => Console.log(`[pfp extractor] got ${x.length} accounts`)),
		Effect.tap(() =>
			Effect.tryPromise(async () => {
				if (ids.length === 0) {
					console.log("\n📊 PROFILE PICTURE PROCESSING BREAKDOWN:");
					console.log("   📈 Total accounts to process: 0");
					console.log("   🎯 No accounts to process\n");
					return;
				}

				// Get task information for these accounts
				const accountsWithTasks = await db
					.selectFrom("UsersToClone")
					.innerJoin("CloneTask", "UsersToClone.TaskId", "CloneTask.id")
					.select([
						"UsersToClone.id as user_id",
						"UsersToClone.TaskId",
						"CloneTask.title",
						"CloneTask.id as task_id",
					])
					.where(
						"UsersToClone.id",
						"in",
						ids.map((id) => id.id),
					)
					.execute();

				console.log("\n📊 PROFILE PICTURE PROCESSING BREAKDOWN:");
				console.log("   📈 Total accounts to process: ${ids.length}");
				console.log("···🎯·Tasks·involved:");

				// Group accounts by task
				const taskGroups = accountsWithTasks.reduce(
					(acc, account) => {
						const taskKey = `${account.task_id}`;
						if (!acc[taskKey]) {
							acc[taskKey] = {
								task_id: account.task_id,
								title: account.title,
								count: 0,
							};
						}
						acc[taskKey].count++;
						return acc;
					},
					{} as Record<
						string,
						{ task_id: number; title: string; count: number }
					>,
				);

				// Display task breakdown
				for (const task of Object.values(taskGroups)) {
					console.log(
						`      • Task ${task.task_id}: "${task.title}" - ${task.count} accounts`,
					);
				}
				console.log("\n🚀·Starting·profile·picture·processing...\n");
			}),
		),
		Effect.tap(() =>
			Effect.promise(async () => {
				if (!existsSync(pfpTempDir)) {
					await mkdir(pfpTempDir, { recursive: true });
				}
			}),
		),
		Effect.andThen((as) => {
			let success_count = 0;
			return Effect.all(
				as.map((id, i) =>
					pipe(
						Effect.tryPromise(async () => {
							// Check if the file already exists in the temp folder first
							const filename = join(pfpTempDir, `${id.ig_id}.jpg`);
							if (existsSync(filename)) {
								// Delete the old cached image first
								await Bun.write(filename, ""); // Clear the old image
								console.log(`🗑️ Deleted old cached image for ${id.username}`);
								// Rate limiting: wait before HikerAPI call
								await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
								console.log(
									`⏳ Rate limiting: waiting 1s before HikerAPI call for ${id.username}...`,
								);

								const thumbnailUrl = await Effect.runPromise(
									HikerAPI.getLatestPostThumbnail(id.ig_id),
								);

								if (
									thumbnailUrl === "PRIVATE_ACCOUNT" ||
									thumbnailUrl === "NOT_FOUND"
								) {
									await db
										.deleteFrom("UsersToClone")
										.where("ig_id", "=", id.ig_id)
										.execute();

									await db
										.updateTable("InstagramAccountBase")
										.set({ missing: true })
										.where("id", "=", id.ig_id)
										.execute();
									// Delete the cached image file
									if (existsSync(filename)) {
										await Bun.write(filename, ""); // Clear the file
									}

									return {
										success: false,
										cached: true, // ✅ Fixed: This is cached image processing
										filename,
										removed: true,
									};
								}

								if (
									thumbnailUrl &&
									thumbnailUrl !== "PRIVATE_ACCOUNT" &&
									thumbnailUrl !== "NOT_FOUND"
								) {
									const imageData = await downloadImage(thumbnailUrl);
									if (imageData) {
										await write(filename, imageData);
										success_count++;

										// Only update database if image was successfully downloaded
										await db
											.updateTable("UsersToClone")
											.set({
												got_pfp: true,
												og_username: id.username,
												og_full_name: id.ig_full_name,
											})
											.where("UsersToClone.id", "=", id.id)
											.execute();

										return {
											success: true,
											cached: true,
											filename,
											removed: false,
										};
									}
									await db
										.deleteFrom("UsersToClone")
										.where("ig_id", "=", id.ig_id)
										.execute();

									await db
										.updateTable("InstagramAccountBase")
										.set({ missing: true })
										.where("id", "=", id.ig_id)
										.execute();
									// Delete the cached image file
									if (existsSync(filename)) {
										await Bun.write(filename, ""); // Clear the file
									}
									return {
										success: false,
										cached: true, // ✅ Fixed: This is cached image processing
										filename,
										removed: true,
									};
								}
								console.log("   ℹ️  No valid thumbnail URL available");
								await db
									.deleteFrom("UsersToClone")
									.where("ig_id", "=", id.ig_id)
									.execute();

								await db
									.updateTable("InstagramAccountBase")
									.set({ missing: true })
									.where("id", "=", id.ig_id)
									.execute();
								// Delete the cached image file
								if (existsSync(filename)) {
									await Bun.write(filename, ""); // Clear the file
								}
								return {
									success: false,
									cached: true, // ✅ Fixed: This is cached image processing
									filename,
									removed: true,
								};
							}
							// If not cached, proceed with updating and downloading
							return {
								success: false,
								cached: false,
								filename,
								removed: false,
							};
						}),
						Effect.andThen(({ success, cached, filename, removed }) => {
							if (removed) {
								// Account was removed (private/not found), skip processing
								return Effect.succeed(null);
							}
							if (cached && success) {
								// If we used a cached image, return success directly
								return Effect.succeed(true);
							}

							// Otherwise, proceed with the update and download flow
							return Effect.tryPromise(async () => {
								console.log(
									`⏳ Rate limiting: waiting 1s before updateAnOutdatedAccount for ${id.username}...`,
								);
								await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
								return true;
							}).pipe(
								Effect.andThen(() =>
									pipe(
										updateAnOutdatedAccount(id.ig_id),
										Effect.andThen(() =>
											Effect.tryPromise(async (): Promise<string | null> => {
												// Get the pfpUrl that was just updated by updateAnOutdatedAccount
												const account = await db
													.selectFrom("InstagramAccountBase")
													.select("pfpUrl")
													.where("id", "=", id.ig_id)
													.executeTakeFirst();

												const imageUrl = account?.pfpUrl;

												if (!imageUrl || typeof imageUrl !== "string") {
													console.log(
														`[${i}/${as.length}] No image URL available for ${id.username}, skipping`,
													);
													return null;
												}

												console.log(
													`[${i}/${as.length}] Found image URL for ${id.username}, downloading`,
												);
												return imageUrl;
											}),
										),
										Effect.andThen((imageUrl) =>
											Effect.tryPromise(async () => {
												// Use the imageUrl from database (which should be the post thumbnail from updateAnOutdatedAccount)
												console.log(
													`[${i}/${as.length}] Using database URL for ${id.username}: ${imageUrl?.substring(0, 80)}...`,
												);

												if (!imageUrl || typeof imageUrl !== "string")
													return false;

												const imageData = await downloadImage(imageUrl);
												if (!imageData) return false;

												await write(filename, imageData);
												success_count++;
												console.log(
													`[${i}/${as.length} - ${success_count}] got POST THUMBNAIL for ${id.username}`,
												);
												await db
													.updateTable("UsersToClone")
													.set({
														got_pfp: true,
														og_username: id.username,
														og_full_name: id.ig_full_name,
													})
													.where("UsersToClone.id", "=", id.id)
													.execute();
												return true;
											}),
										),
									),
								),
							);
						}),
						Effect.catchAll((x) =>
							Console.error(
								`[pfp extractor error] ${formatError(x.error)} for ${id.ig_id}`,
							),
						),
						Effect.tap((success) =>
							Effect.tryPromise(() =>
								db
									.updateTable("UsersToClone")
									.set({
										pfp_last_attempted: new Date(),
										pfp_fail: success !== true,
									})
									.where("UsersToClone.id", "=", id.id)
									.execute(),
							),
						),
					),
				),
				{ concurrency: 5 },
			);
		}),
	);
}

// export function DownloadProfilePictures(
// 	ids: {
// 		id: number;
// 		ig_id: string;
// 		username: string;
// 		ig_full_name: string;
// 	}[],
// ) {
// 	return pipe(
// 		Effect.succeed(ids),
// 		Effect.tap((x) => Console.log(`[pfp extractor] got ${x.length} accounts`)),
// 		Effect.tap(() =>
// 			Effect.promise(async () => {
// 				if (!existsSync(pfpTempDir)) {
// 					await mkdir(pfpTempDir, { recursive: true });
// 				}
// 			}),
// 		),
// 		Effect.andThen((as) => {
// 			let success_count = 0;
// 			return Effect.all(
// 				as.map((id, i) =>
// 					pipe(
// 						Effect.tryPromise(async () => {
// 							// Check if the file already exists in the temp folder first
// 							const filename = join(pfpTempDir, `${id.ig_id}.jpg`);
// 							if (existsSync(filename)) {
// 								console.log(
// 									`[${i}/${as.length}] Using cached image for ${id.username}`,
// 								);
// 								success_count++;
// 								pipe(
// 									HikerAPI.getLatestPostThumbnail(id.ig_id),
// 									Effect.tap((thumbnailUrl) =>
// 										console.log(
// 											`[${i}/${as.length}] Getting latest post thumbnail for cached account ${id.username}`,
// 										),
// 									),
// 									Effect.andThen(async (thumbnailUrl) => {
// 										if (
// 											thumbnailUrl === "PRIVATE_ACCOUNT" ||
// 											thumbnailUrl === "NOT_FOUND"
// 										) {
// 											console.log(
// 												`[${i}/${as.length}] No post thumbnail available for ${id.username}, using cached image`,
// 											);
// 											return Effect.succeed(null); // Use cached image
// 										}

// 										console.log(
// 											`[${i}/${as.length}] Found newer post thumbnail for ${id.username}, updating cached image`,
// 										);
// 										if (!thumbnailUrl) {
// 											console.log(
// 												`[${i}/${as.length}] No thumbnail URL for ${id.username}, using cached image`,
// 											);
// 											return null; // Use cached image
// 										}
// 										const imageData = await downloadImage(thumbnailUrl);
// 										if (!imageData) {
// 											console.log(
// 												`[${i}/${as.length}] Failed to download post thumbnail for ${id.username}, using cached image`,
// 											);
// 											return null; // Use cached image
// 										}

// 										await write(filename, imageData);
// 										success_count++;
// 										console.log(
// 											`[${i}/${as.length} - ${success_count}] Updated cached image with post thumbnail for ${id.username}`,
// 										);
// 										return Effect.succeed(thumbnailUrl);
// 									}),
// 								);
// 								await db
// 									.updateTable("UsersToClone")
// 									.set({
// 										got_pfp: true,
// 										og_username: id.username,
// 										og_full_name: id.ig_full_name,
// 									})
// 									.where("UsersToClone.id", "=", id.id)
// 									.execute();
// 								return { success: true, cached: true, filename };
// 							}

// 							console.log(
// 								`[${i}/${as.length}] Using cached image for ${id.username}`,
// 							);
// 							success_count++;
// 							pipe(
// 								HikerAPI.getLatestPostThumbnail(id.ig_id),
// 								Effect.tap((thumbnailUrl) =>
// 									console.log(
// 										`[${i}/${as.length}] Getting latest post thumbnail for cached account ${id.username}`,
// 									),
// 								),
// 								Effect.andThen(async (thumbnailUrl) => {
// 									if (
// 										thumbnailUrl === "PRIVATE_ACCOUNT" ||
// 										thumbnailUrl === "NOT_FOUND"
// 									) {
// 										console.log(
// 											`[${i}/${as.length}] No post thumbnail available for ${id.username}, using cached image`,
// 										);
// 										return Effect.succeed(null); // Use cached image
// 									}

// 									console.log(
// 										`[${i}/${as.length}] Found newer post thumbnail for ${id.username}, updating cached image`,
// 									);
// 									if (!thumbnailUrl) {
// 										console.log(
// 											`[${i}/${as.length}] No thumbnail URL for ${id.username}, using cached image`,
// 										);
// 										return null; // Use cached image
// 									}
// 									const imageData = await downloadImage(thumbnailUrl);
// 									if (!imageData) {
// 										console.log(
// 											`[${i}/${as.length}] Failed to download post thumbnail for ${id.username}, using cached image`,
// 										);
// 										return null; // Use cached image
// 									}

// 									await write(filename, imageData);
// 									success_count++;
// 									console.log(
// 										`[${i}/${as.length} - ${success_count}] Updated cached image with post thumbnail for ${id.username}`,
// 									);
// 									return Effect.succeed(thumbnailUrl);
// 								}),
// 							);
// 							await db
// 								.updateTable("UsersToClone")
// 								.set({
// 									got_pfp: true,
// 									og_username: id.username,
// 									og_full_name: id.ig_full_name,
// 								})
// 								.where("UsersToClone.id", "=", id.id)
// 								.execute();
// 							return { success: false, cached: false, filename };

// 							// If not cached, proceed with updating and downloading
// 							// return { success: false, cached: false, filename };
// 						}),
// 						Effect.andThen(({ success, cached, filename }) => {
// 							if (cached && success) {
// 								// If we used a cached image, return success directly
// 								return Effect.succeed(true);
// 							}

// 							// Otherwise, proceed with the update and download flow
// 							return pipe(
// 								updateAnOutdatedAccount(id.ig_id),
// 								Effect.tap(() =>
// 									console.log(
// 										`[${i}/${as.length} - ${success_count}] got img for ${id.ig_id}`,
// 									),
// 								),
// 								Effect.andThen(() =>
// 									// NOTE: this is important, we need to refetch url after the account is updated
// 									Effect.tryPromise(async () => {
// 										const pfpUrl = await db
// 											.selectFrom("InstagramAccountBase")
// 											.select("pfpUrl")
// 											.where("id", "=", id.ig_id)
// 											.executeTakeFirst();
// 										if (!pfpUrl) throw new Error("no pfp url");
// 										return pfpUrl.pfpUrl;
// 									}),
// 								),
// 								Effect.andThen((pfpUrl) =>
// 									Effect.tryPromise(async () => {
// 										if (!pfpUrl) throw new Error("no pfp url");

// 										// const imageData = await downloadImage(pfpUrl);
// 										// if (!imageData) return false;

// 										// await write(filename, imageData);
// 										// success_count++;
// 										// console.log(
// 										// 	`[${i}/${as.length} - ${success_count}] got img for ${id.username}`,
// 										// );

// 										await db
// 											.updateTable("UsersToClone")
// 											.set({
// 												got_pfp: true,
// 												og_username: id.username,
// 												og_full_name: id.ig_full_name,
// 											})
// 											.where("UsersToClone.id", "=", id.id)
// 											.execute();
// 										return true;
// 									}),
// 								),
// 							);
// 						}),
// 						Effect.catchAll((x) =>
// 							Console.error(
// 								`[pfp extractor error] ${formatError(x.error)} for ${id.ig_id}`,
// 							),
// 						),
// 						Effect.tap((success) =>
// 							Effect.tryPromise(() =>
// 								db
// 									.updateTable("UsersToClone")
// 									.set({
// 										pfp_last_attempted: new Date(),
// 										pfp_fail: success !== true,
// 									})
// 									.where("UsersToClone.id", "=", id.id)
// 									.execute(),
// 							),
// 						),
// 					),
// 				),
// 				{ concurrency: 5 },
// 			);
// 		}),
// 	);
// }
// ...existing code...
// export function DownloadProfilePictures(
// 	ids: {
// 		id: number;
// 		ig_id: string;
// 		username: string;
// 		ig_full_name: string;
// 	}[],
// ) {
// 	return pipe(
// 		Effect.succeed(ids),
// 		Effect.tap((x) => Console.log(`[pfp extractor] got ${x.length} accounts ${x.map(i => i.username).join(", ")}`)),
// 		Effect.tap(() =>
// 			Effect.promise(async () => {
// 				if (!existsSync(pfpTempDir)) {
// 					await mkdir(pfpTempDir, { recursive: true });
// 				}
// 			}),
// 		),
// 		Effect.andThen((as) => {
// 			let success_count = 0;
// 			return Effect.all(
// 				as.map((id, i) =>
// 					pipe(
// 						Effect.tryPromise(async () => {
// 							const filename = join(pfpTempDir, `${id.ig_id}.jpg`);
// 							// console.log(filename);
// 							if (existsSync(filename)) {
// 								console.log(filename, "Existing profile");
// 								console.log(
// 									`[${i}/${as.length}] Using cached image for ${id.username}`,
// 								);
// 								success_count++;
// 								// Only check for a newer thumbnail if you want to update the cached image
// 								const thumbnailUrl = await Effect.runPromise(
// 									HikerAPI.getLatestPostThumbnail(id.ig_id),
// 								);
// 								if (
// 									thumbnailUrl &&
// 									thumbnailUrl !== "PRIVATE_ACCOUNT" &&
// 									thumbnailUrl !== "NOT_FOUND"
// 								) {
// 									console.log(
// 										`[${i}/${as.length}] Found newer post thumbnail for ${id.username}, updating cached image`,
// 									);
// 									const imageData = await downloadImage(thumbnailUrl);
// 									if (imageData) {
// 										await write(filename, imageData);
// 										success_count++;
// 										console.log(
// 											`[${i}/${as.length} - ${success_count}] Updated cached image with post thumbnail for ${id.username}`,
// 										);
// 									}
// 								}
// 								await db
// 									.updateTable("UsersToClone")
// 									.set({
// 										got_pfp: true,
// 										og_username: id.username,
// 										og_full_name: id.ig_full_name,
// 									})
// 									.where("UsersToClone.id", "=", id.id)
// 									.execute();
// 								return { success: true, cached: true, filename };
// 							}

// 							// If not cached, try to fetch the latest thumbnail and save it

// 							// If no thumbnail, mark as fail and continue
// 							// console.log(
// 							// 	`[${i}/${as.length}] No thumbnail for ${id.username}, marking as fail`,
// 							// );
// 							await db
// 								.updateTable("UsersToClone")
// 								.set({
// 									got_pfp: false,
// 									og_username: id.username,
// 									og_full_name: id.ig_full_name,
// 								})
// 								.where("UsersToClone.id", "=", id.id)
// 								.execute();
// 							return { success: false, cached: false, filename };
// 						}),
// 						Effect.andThen(({ success, cached, filename }) => {
// 							if (cached && success) {
// 								return Effect.succeed(true);
// 							}
// 							// If not successful, try to update the outdated account and retry
// 							console.log("entering update flow");
// 							return pipe(
// 								updateAnOutdatedAccount(id.ig_id),
// 								Effect.tap(() => console.log(`[${i}/${as.length}] updated account for ${id.ig_id}`)),

// 								Effect.tap(() =>
// 									console.log(
// 										`[${i}/${as.length} - ${success_count}] updated account for ${id.ig_id}`,
// 									),
// 								),
// 								Effect.andThen(() =>
// 									Effect.tryPromise(async () => {
// 										const pfpUrl = await db
// 											.selectFrom("InstagramAccountBase")
// 											.select("pfpUrl")
// 											.where("id", "=", id.ig_id)
// 											.executeTakeFirst();
// 										if (!pfpUrl) throw new Error("no pfp url");
// 										return pfpUrl.pfpUrl;

// 									}),
// 								),
// 								Effect.andThen((pfpUrl) =>
// 									Effect.tryPromise(async () => {
// 										if (!pfpUrl) throw new Error("no pfp url");
// 										const thumbnailUrl = await Effect.runPromise(
// 											HikerAPI.getLatestPostThumbnail(id.ig_id),
// 										);
// 										if (
// 											thumbnailUrl &&
// 											thumbnailUrl !== "PRIVATE_ACCOUNT" &&
// 											thumbnailUrl !== "NOT_FOUND"
// 										) {
// 											console.log(
// 												`[${i}/${as.length}] Found post thumbnail for ${id.username}, downloading`,
// 											);
// 										}
// 										console.log("Thumbnail URL:", thumbnailUrl);
// 										let imageData: Uint8Array | null = null;
// 										if (thumbnailUrl) {
// 											imageData = await downloadImage(thumbnailUrl);
// 										}
// 										// const imageData = await downloadImage(pfpUrl);
// 										if (!imageData) return false;
// 										await write(filename, imageData);
// 										success_count++;
// 										console.log(
// 											`[${i}/${as.length} - ${success_count}] Downloaded and saved updated pfp for ${id.username}`,
// 										);
// 										await db
// 											.updateTable("UsersToClone")
// 											.set({
// 												got_pfp: true,
// 												og_username: id.username,
// 												og_full_name: id.ig_full_name,
// 											})
// 											.where("UsersToClone.id", "=", id.id)
// 											.execute();
// 										return true;
// 									}),
// 								),
// 							);
// 						}),
// 						Effect.catchAll((x) =>
// 							Console.error(
// 								`[pfp extractor error] ${formatError(x.error)} for ${id.ig_id}`,
// 							),
// 						),
// 						Effect.tap((success) =>
// 							Effect.tryPromise(() =>
// 								db
// 									.updateTable("UsersToClone")
// 									.set({
// 										pfp_last_attempted: new Date(),
// 										pfp_fail: success !== true,
// 									})
// 									.where("UsersToClone.id", "=", id.id)
// 									.execute(),
// 							),
// 						),
// 					),
// 				),
// 				{ concurrency: 5 },
// 			);
// 		}),
// 	);
// }
// ...existing code...
