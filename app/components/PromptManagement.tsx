import type React from "react";
import { useEffect, useState } from "react";
import { api_fetch } from "~/services/api";
type Prompt = {
	id: number;
	name: string;
	type: string;
	content: string;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
};

// ...existing code...
export default function PromptManagement({ prompts }: { prompts: Prompt[] }) {
	const [rows, setRows] = useState<Prompt[]>([]);
	const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);
	const [mode, setMode] = useState<"view" | "edit" | null>(null);
	const [editContent, setEditContent] = useState<string>("");

	useEffect(() => {
		setRows(prompts);
	}, [prompts]);

	const openView = (prompt: Prompt) => {
		setActivePrompt(prompt);
		setMode("view");
	};

	const openEdit = (prompt: Prompt) => {
		setActivePrompt(prompt);
		setEditContent(prompt.content);
		setMode("edit");
	};

	const closeModal = () => {
		setActivePrompt(null);
		setMode(null);
		setEditContent("");
	};

	const toggleEnabled = async (id: number) => {
		setRows((prev) =>
			prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
		);
		const prompt = rows.find((p) => p.id === id);
		if (!prompt) return;
		try {
			await fetch(`/api/prompts/${id}/enabled`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: !prompt.enabled }),
			});
		} catch (err) {}
	};

	const handleSaveClick = async () => {
		if (!activePrompt) return;
		const id = activePrompt.id;
		setRows((prev) =>
			prev.map((p) =>
				p.id === id
					? { ...p, content: editContent, updatedAt: new Date().toISOString() }
					: p,
			),
		);
		try {
			await fetch(`/api/prompts/${id}/content`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: editContent }),
			});
		} catch (err) {}
		closeModal();
	};

	return (
		<div className="w-full h-screen">
			<div className="p-8 font-sans">
				<h2 className="text-3xl mb-6 text-foreground font-bold">Prompts</h2>
				<div className="overflow-x-auto rounded-lg shadow-md h-screen">
					<table className="w-full border-separate border-spacing-0">
						<thead className="bg-muted">
							<tr>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">
									ID
								</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">
									Name
								</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">
									Type
								</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">
									Content
								</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">
									Enabled
								</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">
									Created At
								</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">
									Updated At
								</th>
								<th className="px-4 py-3 text-left font-semibold text-muted-foreground">
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((prompt) => (
								<tr key={prompt.id} className="border-b last:border-b-0">
									<td className="px-4 py-2">{prompt.id}</td>
									<td className="px-4 py-2">{prompt.name}</td>
									<td className="px-4 py-2">{prompt.type}</td>
									<td className="px-4 py-2">
										<pre className="max-h-24 overflow-y-auto rounded bg-muted/50 p-2 font-mono text-sm text-foreground">
											{prompt.content.length > 30
												? `${prompt.content.slice(0, 30)}...`
												: prompt.content}
										</pre>
									</td>
									<td className="px-4 py-2">
										<label className="inline-flex items-center cursor-pointer select-none">
											<input
												type="checkbox"
												checked={prompt.enabled}
												onChange={() => toggleEnabled(prompt.id)}
												className="sr-only"
												aria-label={`Toggle enabled for ${prompt.name}`}
											/>
											<span
												className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${prompt.enabled ? "bg-green-500" : "bg-gray-300"}`}
											>
												<span
													className={`absolute top-0 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${prompt.enabled ? "translate-x-5" : ""}`}
												/>
											</span>
											<span
												className={`ml-2 font-semibold ${prompt.enabled ? "text-green-700" : "text-gray-400"}`}
											>
												{prompt.enabled ? "Enabled" : "Disabled"}
											</span>
										</label>
									</td>
									<td className="px-4 py-2">
										{new Date(prompt.createdAt).toLocaleString()}
									</td>
									<td className="px-4 py-2">
										{new Date(prompt.updatedAt).toLocaleString()}
									</td>
									<td className="px-4 py-2">
										<button
											type="button"
											className="mr-2 bg-blue-600 text-white rounded px-3 py-1 text-sm font-medium hover:bg-blue-700 transition"
											onClick={() => openView(prompt)}
										>
											View
										</button>
										<button
											type="button"
											className="bg-yellow-300 text-gray-800 rounded px-3 py-1 text-sm font-semibold hover:bg-yellow-400 transition"
											onClick={() => openEdit(prompt)}
										>
											Edit
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{activePrompt && mode && (
					<Modal
						onClose={closeModal}
						title={mode === "view" ? "Prompt Content" : "Edit Prompt"}
					>
						{mode === "view" ? (
							<div className="text-foreground whitespace-pre-wrap font-mono text-base">
								{activePrompt.content}
							</div>
						) : (
							<div className="text-foreground">
								<label
									htmlFor="edit-content"
									className="font-semibold mb-2 block"
								>
									Content
								</label>
								<textarea
									id="edit-content"
									value={editContent}
									onChange={(e) => setEditContent(e.target.value)}
									className="w-full h-[70vh] font-mono text-base rounded-lg border border-muted p-2 resize-vertical text-foreground bg-background"
								/>
								<div className="text-right mt-4 space-x-2">
									<button
										type="button"
										className="bg-green-600 text-white rounded px-5 py-2 font-semibold text-base hover:bg-green-700 transition"
										onClick={handleSaveClick}
									>
										Save
									</button>
									<button
										type="button"
										className="bg-red-600 text-white rounded px-5 py-2 font-semibold text-base hover:bg-red-700 transition"
										onClick={closeModal}
									>
										Cancel
									</button>
								</div>
							</div>
						)}
					</Modal>
				)}
			</div>
		</div>
	);
}

function Modal({
	children,
	onClose,
	title,
}: {
	children: React.ReactNode;
	onClose: () => void;
	title?: string;
}) {
	return (
		<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
			<div className="bg-muted rounded-lg shadow-lg w-[90vw] h-[90vh] relative flex flex-col overflow-hidden">
				<button
					type="button"
					onClick={onClose}
					className="absolute top-4 right-4 bg-muted rounded-full w-8 h-8 text-xl text-foreground flex items-center justify-center z-10 hover:bg-muted/80 transition"
					aria-label="Close"
				>
					&times;
				</button>
				{title && (
					<h3 className="m-0 px-6 py-4 bg-muted border-b border-muted-foreground text-xl text-foreground font-semibold flex-shrink-0">
						{title}
					</h3>
				)}
				<div className="p-6 overflow-y-auto flex-grow font-mono text-base whitespace-pre-wrap">
					{children}
				</div>
			</div>
		</div>
	);
}
// ...existing code...

/* styles */
