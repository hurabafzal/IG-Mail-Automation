import { BunRuntime } from "@effect/platform-bun";
import { Effect, Schedule } from "effect";
import { db } from "../db";
import { env } from "../env";

function deleteNotFoundLeads(leadId: string, index: number, total: number) {
	return Effect.gen(function* () {
		const res = yield* Effect.tryPromise(() =>
			fetch(`https://api.instantly.ai/api/v2/leads/${leadId}`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${env.INSTANTLY_KEY}`,
				},
			}),
		).pipe(
			Effect.retry({
				times: 3,
				schedule: Schedule.exponential("1 minute"),
			}),
		);

		if (res.status === 404) {
			console.warn(`${index + 1}/${total} deleting lead ${leadId}`);
			// yield* db.deleteFrom("Lead").where("id", "=", leadId).executeE();
			return;
		}

		if (!res.ok) {
			const text = yield* Effect.tryPromise(() => res.text());
			return yield* Effect.fail(
				`Failed to delete lead ${leadId}, status: ${res.status}, body: ${text}`,
			);
		}

		console.log(`${index + 1}/${total} lead ${leadId} found, not deleting`);
	});
}

export const removeDeletedLeads = Effect.gen(function* () {
	const leads = yield* db.selectFrom("Lead").select(["id"]).executeE();

	console.log(`[delete-completed-leads] ${leads.length} leads to delete`);

	yield* Effect.forEach(leads, (lead, index) =>
		deleteNotFoundLeads(lead.id, index, leads.length),
	);
});

BunRuntime.runMain(removeDeletedLeads);
