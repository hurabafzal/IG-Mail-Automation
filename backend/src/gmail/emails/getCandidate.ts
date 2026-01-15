// import { BunRuntime } from "@effect/platform-bun";
import { toASCII } from "node:punycode";
import type { Schema as S } from "@effect/schema";
import { db, db_retry_effect } from "backend/src/db";
import type { NewCandidate } from "backend/src/pipedrive/objects/candidate";
import { COUNTRY_GROUPS } from "backend/src/utils/consts";
import { sequenceIdTitleMap } from "backend/src/utils/consts.server";
import { sql } from "kysely";
import { z } from "zod";
import type { Message } from "./getMessage";

// Mapping from Gmail inbox to Pipedrive user_id (deal and person owner)
export const INBOX_TO_USER_ID_MAP: Record<string, number> = {
	"joleen@startviral.de": 21367363,
	"mani@startviral.de": 24482090,
};

export const aggregatorEmail = "joleen@startviral.de";
export const getXYFromID = async (id: string, importDate?: Date) => {
	const x = await db
		.selectFrom("InstagramAccountBase")
		.leftJoin(
			"TriggerLog",
			"TriggerLog.instagram_id",
			"InstagramAccountBase.id",
		)
		.leftJoin("SentEmail", "TriggerLog.sent_email_id", "SentEmail.id")
		.select([
			"InstagramAccountBase.id",
			"InstagramAccountBase.hiddenLikes",
			"InstagramAccountBase.account_created_at",
			"InstagramAccountBase.username",
			"InstagramAccountBase.country",
			"InstagramAccountBase.real_country",
			"InstagramAccountBase.ig_full_name",
			"InstagramAccountBase.following_count",
			"InstagramAccountBase.posts_count",
			"InstagramAccountBase.followers_count",
			"InstagramAccountBase.first_name",
			"InstagramAccountBase.niche",
			"SentEmail.mixMaxSequenceId",
		])
		.where("InstagramAccountBase.id", "=", id)
		.where((eb) =>
			importDate ? eb("SentEmail.createdAt", "<", importDate) : eb.val(true),
		)
		.orderBy(sql`"SentEmail"."createdAt" desc nulls last`)
		.executeTakeFirst();

	if (!x) {
		return { x: undefined, y: undefined, emailVars: undefined };
	}

	const y = await db
		.selectFrom("InstagramPost")
		.select((oc) => [
			oc.fn.avg("InstagramPost.comment_count").as("avg_comment_count"),
			oc.fn.avg("InstagramPost.like_count").as("avg_like_count"),
		])
		.where("InstagramPost.user_id", "=", x.id)
		.executeTakeFirst();

	const num = x.followers_count;
	// const roundedFollowers = Math.ceil(num / 1000) * 1000;
	const downRound = Math.min(num - (num % 10_000), 100_000);

	const monthyBudget = await db
		.selectFrom("EmailVariables")
		.selectAll()
		.where("minFollowerCount", "=", downRound * 10)
		.where("name", "=", "Monthly Budget")
		.executeTakeFirst();

	const dailyBudget = await db
		.selectFrom("EmailVariables")
		.selectAll()
		.where("minFollowerCount", "=", downRound * 10)
		.where("name", "=", "Daily Budget")
		.executeTakeFirst();
	const followerGain = await db
		.selectFrom("EmailVariables")
		.selectAll()
		.where("minFollowerCount", "=", downRound * 10)
		.where("name", "=", "Follower Gain")
		.executeTakeFirst();

	const storyGain = await db
		.selectFrom("EmailVariables")
		.selectAll()
		.where("minFollowerCount", "=", downRound * 10)
		.where("name", "=", "Story View Gain")
		.executeTakeFirst();

	const sequence_title = sequenceIdTitleMap[x.mixMaxSequenceId ?? ""];

	return {
		x,
		y,
		sequence_title,
		emailVars: {
			monthlyBudget: Number.parseInt(monthyBudget?.value ?? "0"),
			dailyBudget: dailyBudget?.value ?? "",
			followerGain: followerGain?.value ?? "",
			storyGain: storyGain?.value ?? "",
		},
	};
};

export const getCandidateInfoFromUsername = async (username: string) => {
	const id_search = await db
		.selectFrom("InstagramAccountBase")
		.leftJoin("Email", "InstagramAccountBase.id", "Email.instagram_id")
		.select(["InstagramAccountBase.id as user_id", "Email.email"])
		.where("InstagramAccountBase.username", "=", username)
		.executeTakeFirst();

	if (!id_search) {
		console.error(`No account found for username: ${username}`);
		return { not_found: true };
	}

	const id = id_search.user_id;
	const email = id_search.email;

	const { x, y, emailVars, sequence_title } = await getXYFromID(id);
	if (!x) {
		console.error(`No account info for id: ${id}`);
		return { id, email, not_found: true };
	}

	const avg_comment_count = y?.avg_comment_count
		? Math.round(Number.parseFloat(y.avg_comment_count.toString()))
		: undefined;
	const avg_like_count = y?.avg_like_count
		? Math.round(Number.parseFloat(y.avg_like_count.toString()))
		: undefined;

	return {
		id,
		email,
		x,
		y,
		sequence_title,
		emailVars,
		avg_comment_count,
		avg_like_count,
	};
};

type Candidate = S.Schema.Encoded<typeof NewCandidate>;
export const getCandidatesFromMsgs = (
	msgs: Message[],
	user_id: number,
	owner_id?: number,
) =>
	db_retry_effect({ name: "getCandidateFromEmail" }, async () => {
		const raw_emails: string[] = [];
		for (const m of msgs) {
			raw_emails.push(m.from);
			raw_emails.push(m.to);
			raw_emails.push(m.reply_to);
		}
		const emails = raw_emails.map((e) => {
			// if it has < or >, remove everything before and after
			if (e.includes("<") && e.includes(">")) {
				const start = e.indexOf("<");
				const end = e.indexOf(">");
				return e.slice(start + 1, end);
			}
			return e;
		});
		const filtered_emails = emails.filter(
			(e) =>
				!e.includes("highonlikes") &&
				!e.includes("pipedrive") &&
				!e.includes("startviral.") &&
				!e.includes("mixmax") &&
				!e.includes("google") &&
				z.string().transform(toASCII).pipe(z.string().email()).safeParse(e)
					.success,
		);
		const unique_emails = Array.from(new Set(filtered_emails));

		const usernames = msgs.map((m) =>
			m.subject.includes("@") ? m.subject.split("@")[1].split(" ")[0] : "",
		);
		const usernames_unique = Array.from(new Set(usernames));

		const res: Candidate[] = [];

		console.log("usernames_unique: ", usernames_unique);

		for (const username of usernames_unique) {
			console.log(`getting info for ${username}`);
			const {
				avg_comment_count,
				avg_like_count,
				email,
				emailVars,
				x,
				sequence_title,
			} = await getCandidateInfoFromUsername(username);
			const relatedMsg = msgs.filter((m) =>
				m.subject.includes(`@${username}`),
			)[0];
			if (!email || !emailVars || !x) continue;

			// remove the email from the list
			const idx = unique_emails.indexOf(email);
			if (idx > -1) {
				unique_emails.splice(idx, 1);
			}

			let language: string | undefined;
			const languages = COUNTRY_GROUPS.map((c) => c.id);
			for (const lang of languages) {
				if (sequence_title?.includes(` ${lang}`)) {
					language = lang;
					break;
				}
			}
			if (language === undefined) {
				language =
					COUNTRY_GROUPS.find((c) => c.countries.includes(x?.country ?? ""))
						?.id ?? "EN";
			}

			res.push({
				person: {
					account_creation: x?.account_created_at ?? undefined,
					lastEmailSequence: sequence_title,
					country:
						x.country === "GERMAN_CAPTIONS" && x.real_country
							? x.real_country
							: (x.country ?? undefined),
					language,
					username: x?.username ?? username,
					email: [{ value: email, primary: "true" }],
					follower: x?.followers_count ?? 0,
					name: username,
					first_name: x?.first_name ?? undefined,
					firstNameCustom: x?.first_name ?? undefined,
					niche: x?.niche ?? undefined,
					followingCount: x?.following_count ?? 0,
					ig_full_name: x?.ig_full_name ?? undefined,
					avg_comment_count: avg_comment_count,
					avg_like_count: avg_like_count,
					post_count: x?.posts_count ?? 0,
					hiddenLikes:
						x?.hiddenLikes === true
							? "yes"
							: x?.hiddenLikes === false
								? "no"
								: undefined,
					owner_id: owner_id,
				},
				deal: {
					title: username,
					user_id: user_id,
					first_name: x?.first_name ?? undefined,
					value: emailVars.monthlyBudget,
					original_inbox: relatedMsg?.forwarded_from
						? relatedMsg.forwarded_from
						: relatedMsg.from.includes("startviral.co")
							? relatedMsg.from
							: relatedMsg.to,
					daily_budget: emailVars.dailyBudget,
					follower_growth: emailVars.followerGain,
					story_growth: emailVars.storyGain,
				},
			} satisfies Candidate);
		}

		console.log("unique_emails: ", JSON.stringify(unique_emails));

		// NOTE: I can just uncomment this if I want to add based on email too
		for (const email of unique_emails) {
			const getId = await db
				.selectFrom("Email")
				.select("instagram_id")
				.where("Email.email", "=", email)
				.executeTakeFirst();
			const id = getId?.instagram_id;
			if (!id) {
				console.error(`No account found for email: ${email}`);
				continue;
			}

			const { x, y, emailVars } = await getXYFromID(id);
			if (!x) {
				console.error(`No account found for email: ${email}`);
				continue;
			}

			const avg_comment_count = y?.avg_comment_count
				? Math.round(Number.parseFloat(y.avg_comment_count.toString()))
				: undefined;
			const avg_like_count = y?.avg_like_count
				? Math.round(Number.parseFloat(y.avg_like_count.toString()))
				: undefined;

			const relatedMsg = msgs.filter((m) =>
				[m.from, m.to, m.reply_to].includes(email),
			)[0];
			// console.log("relatedMsg: ", relatedMsg);
			res.push({
				person: {
					account_creation: x.account_created_at ?? undefined,
					country: x.country ?? undefined,
					username: x.username,
					email: [{ value: email, primary: "true" }],
					follower: x.followers_count,
					name: x.username,
					first_name: x.first_name ?? undefined,
					firstNameCustom: x.first_name ?? undefined,
					niche: x.niche ?? undefined,
					followingCount: x.following_count,
					ig_full_name: x.ig_full_name ?? undefined,
					avg_comment_count: avg_comment_count,
					avg_like_count: avg_like_count,
					post_count: x.posts_count,
					hiddenLikes:
						x?.hiddenLikes === true
							? "yes"
							: x?.hiddenLikes === false
								? "no"
								: undefined,
					owner_id: owner_id,
				},
				deal: {
					title: x.username,
					user_id: user_id,
					value: emailVars.monthlyBudget,
					first_name: x?.first_name ?? undefined,
					original_inbox: relatedMsg?.forwarded_from
						? relatedMsg.forwarded_from
						: relatedMsg.from.includes("startviral.co")
							? relatedMsg.from
							: relatedMsg.to,
					daily_budget: emailVars.dailyBudget,
					follower_growth: emailVars.followerGain,
					story_growth: emailVars.storyGain,
				},
			} satisfies Candidate);
		}
		return res;
	});
