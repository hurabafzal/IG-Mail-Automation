import { Elysia, t } from "elysia";

// import { PromptRegistry } from "../prompts/prompt-registry";
import { db } from "../db";

export const promptsRouter = new Elysia({ prefix: "/api/prompts" })
	.get("/", async () => {
		const prompts = await db.selectFrom("Prompt").selectAll().execute();
		return prompts;
	})
	.patch(
		"/:id/enabled",
		async ({
			params,
			body,
		}: {
			params: { id: number };
			body: { enabled: boolean };
		}) => {
			await db
				.updateTable("Prompt")
				.set({ enabled: body.enabled })
				.where("id", "=", params.id)
				.execute();
			return { success: true };
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({ enabled: t.Boolean() }),
		},
	)
	// Update content column
	.patch(
		"/:id/content",
		async ({
			params,
			body,
		}: {
			params: { id: number };
			body: { content: string };
		}) => {
			await db
				.updateTable("Prompt")
				.set({ content: body.content, updatedAt: new Date() })
				.where("id", "=", params.id)
				.execute();
			return { success: true };
		},
		{
			params: t.Object({ id: t.Numeric() }),
			body: t.Object({ content: t.String() }),
		},
	);
