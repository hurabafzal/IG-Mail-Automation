import AdmZip from "adm-zip";
import { stringify } from "csv-stringify/sync";
import { Effect, pipe } from "effect";
import { db } from "../db";
import { pfpTempDir } from "./clone.service";

const getZipAccounts = (taskId: number) =>
	Effect.promise(() =>
		db
			.selectFrom("UsersToClone")
			.innerJoin(
				"InstagramAccountBase",
				"UsersToClone.ig_id",
				"InstagramAccountBase.id",
			)
			.innerJoin("CloneTask", "UsersToClone.TaskId", "CloneTask.id")
			.select([
				"UsersToClone.ig_id",
				"InstagramAccountBase.bio",
				"InstagramAccountBase.gender",
				"UsersToClone.og_username",
				"UsersToClone.og_full_name",
				"UsersToClone.alt_full_name",
				"UsersToClone.alt_username",
				"InstagramAccountBase.gender",
				"CloneTask.target_male",
				"CloneTask.target_female",
				"UsersToClone.alt_bio",
			])
			.where("UsersToClone.got_pfp", "=", true)
			.where("TaskId", "=", taskId)
			.orderBy("UsersToClone.createdAt", "desc")
			.execute(),
	);

export function createZip(taskId: number) {
	const zip = new AdmZip();
	const zipFile = `.out/${taskId}.zip`;

	let male_count = 0;
	let female_count = 0;

	return pipe(
		getZipAccounts(taskId),
		Effect.tap((x) =>
			console.log(`got accounts ready to be zipped: ${x.length}`),
		),

		Effect.andThen((accounts) =>
			Effect.all(
				accounts.map((x) =>
					Effect.tryPromise(async () => {
						// check that the file exists
						if (!(await Bun.file(`${pfpTempDir}/${x.ig_id}.jpg`).exists())) {
							console.log(`${pfpTempDir}/${x.ig_id}.jpg doesn't exist`);
							await db
								.updateTable("UsersToClone")
								.set({ got_pfp: false })
								.where("ig_id", "=", x.ig_id)
								.execute();
							return null;
						}

						if (male_count >= x.target_male && x.gender === "M") {
							return null;
						}
						if (female_count >= x.target_female && x.gender === "F") {
							return null;
						}

						// Add all profile pictures to the same folder
						zip.addLocalFile(
							`${pfpTempDir}/${x.ig_id}.jpg`,
							"profile_pictures",
							`${x.alt_username}.jpg`,
						);
						if (x.gender === "M") {
							male_count++;
						} else {
							female_count++;
						}
						return x;
					}),
				),
				{ concurrency: 10 },
			),
		),

		// Create a single CSV with all accounts
		Effect.tap((accounts) =>
			Effect.try(() => {
				const header = [
					"id",
					"og_username",
					"og_full_name",
					"alt_full_name",
					"alt_username",
					"bio",
					"gender",
				];

				// Filter out null values
				const validAccounts = accounts.filter(
					(x): x is NonNullable<typeof x> => x !== null,
				);

				const createRows = (
					tmpAccounts: NonNullable<(typeof accounts)[number]>[],
				) =>
					tmpAccounts.map((x) => [
						x.ig_id,
						x.og_username,
						x.og_full_name,
						x.alt_full_name,
						x.alt_username,
						x.alt_bio ?? x.bio,
						x.gender,
					]);

				const allRows = createRows(validAccounts);

				const allAccountsCsv = stringify([header, ...allRows], {
					header: false,
					quoted: true,
				});

				zip.addFile("accounts.csv", Buffer.from(allAccountsCsv));
			}),
		),

		Effect.tap(() => zip.writeZip(zipFile)),
		Effect.as(zipFile),
	);
}
