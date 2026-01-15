import { db } from "backend/src/db";
import { EmailSequenceStage } from "backend/src/db/db_types";
while (true) {
	const pendingIds = await db
		.selectFrom("InstagramAccountBase")
		.innerJoin("Email", "Email.instagram_id", "InstagramAccountBase.id")
		.leftJoin(
			"EmailSequence",
			"EmailSequence.instagram_account_id",
			"InstagramAccountBase.id",
		)
		.where("country", "in", [
			// "Germany",
			// "Switzerland",
			// "Austria",
			// "GERMAN_CAPTIONS",
			"United States",
		])
		.where("first_name", "!=", "No name found")
		// .where("business_name", "=", "No name found")
		.where("Email.code", "<>", 6)
		.where("Email.code", "<>", 7)
		.where("followers_count", ">", 7000)
		.where("followers_count", "<", 100000)
		.where((eb) =>
			eb.or([
				eb("lastSentEmail", "is", null),
				eb(
					"lastSentEmail",
					"<",
					new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
				),
			]),
		)
		.where("blacklist", "=", false)
		.where("InstagramAccountBase.blacklisted_at", "is", null)
		.where("Email.blacklisted_at", "is", null)
		.where("EmailSequence.id", "is", null)
		.select(["InstagramAccountBase.id", "Email.email"])
		.distinctOn(["InstagramAccountBase.id"])
		// .limit(5000)
		.execute();

	console.log(pendingIds.length);

	if (pendingIds.length > 0) {
		break;
	}

	for (const [index, account] of pendingIds.entries()) {
		const now = new Date();
		console.log(
			`[${index + 1}/${pendingIds.length}] Creating sequence for ${account.id}`,
		);

		const highestSequence = await db
			.selectFrom("EmailSequence")
			.select("id")
			.orderBy("id", "desc")
			.executeTakeFirstOrThrow();
		const highestSequenceId = highestSequence?.id ?? 0;
		console.log("Highest sequence ID:", highestSequenceId);
		await db
			.insertInto("EmailSequence")
			.values({
				id: highestSequenceId + 1,
				instagram_account_id: account.id,
				current_stage: EmailSequenceStage.OPENER_PENDING_GENERATION,
				current_stage_number: 2,
				email: account.email,
				stage_entered_at: now,
				next_action_possible_at: now, // Can start immediately
				trigger_window_ends_at: null,
				last_instantly_campaign_completed_at: null,
				created_at: now,
				updated_at: now,
			})
			.returningAll()
			.executeTakeFirstOrThrow()
			.catch((e) => {
				console.error(
					`[${index + 1}/${pendingIds.length}] Error creating sequence for ${account.id}: ${e}`,
				);
				console.log(account);
			});
	}
}
