import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { file, write } from "bun";
import { Console, Effect, pipe } from "effect";
import { db } from "../../db";
import { HikerAPI } from "../../mining/HikerAPI";
import { updateAnOutdatedAccount } from "../../mining/updateOutdatedAccounts";
import { formatError } from "./error-formatter";

async function downloadImage(url: string) {
	const response = await fetch(url).catch(console.error);
	if (!response?.ok) {
		console.error(`HTTP error! status: ${response?.status}`, url);
		return null;
	}
	const arrayBuffer = await response.arrayBuffer();

	if (arrayBuffer.byteLength <= 21) {
		console.log(
			`Skipping ${url} due to small file size (${arrayBuffer.byteLength} bytes)`,
		);
		return null;
	}
	return new Uint8Array(arrayBuffer);
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
								console.log(filename, "Existing profile");
								console.log(
									`[${i}/${as.length}] Using cached image for ${id.username}`,
								);
								success_count++;
								// Only check for a newer thumbnail if you want to update the cached image
								const thumbnailUrl = await Effect.runPromise(
									HikerAPI.getLatestPostThumbnail(id.ig_id),
								);

								if (
									thumbnailUrl === "PRIVATE_ACCOUNT" ||
									thumbnailUrl === "NOT_FOUND"
								) {
									console.log(
										`[${i}/${as.length}] Account ${id.username} is ${thumbnailUrl.toLowerCase()} - removing from cloning and deleting cached image`,
									);

									// Remove from UsersToClone
									await db
										.deleteFrom("UsersToClone")
										.where("ig_id", "=", id.ig_id)
										.execute();

									// Mark as missing in InstagramAccountBase
									await db
										.updateTable("InstagramAccountBase")
										.set({ missing: true })
										.where("id", "=", id.ig_id)
										.execute();

									// Delete the cached image file
									if (existsSync(filename)) {
										await Bun.write(filename, ""); // Clear the file
										console.log(
											`[PRIVATE PROFILE] Deleted cached image for ${id.username}`,
										);
									}

									console.log(
										`[PRIVATE PROFILE] Successfully removed ${id.username} from InstagramAccountBase and cloning`,
									);
									return {
										success: false,
										cached: false,
										filename,
										removed: true,
									};
								}
								if (
									thumbnailUrl &&
									thumbnailUrl !== "PRIVATE_ACCOUNT" &&
									thumbnailUrl !== "NOT_FOUND"
								) {
									console.log(
										`[${i}/${as.length}] Found newer post thumbnail for ${id.username}, updating cached image`,
									);
									const imageData = await downloadImage(thumbnailUrl);
									if (imageData) {
										await write(filename, imageData);
										success_count++;
										console.log(
											`[${i}/${as.length} - ${success_count}] Updated cached image with post thumbnail for ${id.username}`,
										);
									}
								}
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
								console.log(
									`[${i}/${as.length}] Account ${id.username} was removed - skipping download`,
								);
								return Effect.succeed(null);
							}
							if (cached && success) {
								// If we used a cached image, return success directly
								return Effect.succeed(true);
							}

							// Otherwise, proceed with the update and download flow
							return pipe(
								updateAnOutdatedAccount(id.ig_id),
								Effect.tap(() =>
									console.log(
										`[${i}/${as.length} - ${success_count}] got img for ${id.ig_id}`,
									),
								),
								Effect.andThen(() =>
									// NOTE: this is important, we need to refetch url after the account is updated
									Effect.tryPromise(async () => {
										const pfpUrl = await db
											.selectFrom("InstagramAccountBase")
											.select("pfpUrl")
											.where("id", "=", id.ig_id)
											.executeTakeFirst();
										if (!pfpUrl) throw new Error("no pfp url");
										return pfpUrl.pfpUrl;
									}),
								),
								Effect.andThen((pfpUrl) =>
									Effect.tryPromise(async () => {
										if (!pfpUrl) throw new Error("no pfp url");
										const thumbnailUrl = await Effect.runPromise(
											HikerAPI.getLatestPostThumbnail(id.ig_id),
										);
										if (
											thumbnailUrl &&
											thumbnailUrl !== "PRIVATE_ACCOUNT" &&
											thumbnailUrl !== "NOT_FOUND"
										) {
											console.log(
												`[${i}/${as.length}] Found post thumbnail for ${id.username}, downloading`,
											);
										}
										console.log("Thumbnail URL:", thumbnailUrl);
										let imageData: Uint8Array | null = null;
										if (thumbnailUrl) {
											imageData = await downloadImage(thumbnailUrl);
										}
										// const imageData = await downloadImage(pfpUrl);
										if (!imageData) return false;
										await write(filename, imageData);
										success_count++;
										console.log(
											`[${i}/${as.length} - ${success_count}] got img for ${id.username}`,
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
