import type React from "react";
import { useEffect, useState } from "react";

type Prompt = {
	id: number;
	name: string;
	type: string;
	content: string;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
};

export default function StatsManagement({ prompts }: { prompts: Prompt[] }) {
	// Make a local, editable copy of prompts
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

	// Toggle enabled directly in the table
	const toggleEnabled = async (id: number) => {
		setRows((prev) =>
			prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
		);
		// Persist to API
		const prompt = rows.find((p) => p.id === id);
		if (!prompt) return;
		try {
			await fetch(`/api/prompts/${id}/enabled`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: !prompt.enabled }),
			});
		} catch (err) {
			// Optionally handle error
		}
	};

	const handleSaveClick = async () => {
		if (!activePrompt) return;
		const id = activePrompt.id;

		// Update local state
		setRows((prev) =>
			prev.map((p) =>
				p.id === id
					? { ...p, content: editContent, updatedAt: new Date().toISOString() }
					: p,
			),
		);

		// Persist to API
		try {
			await fetch(`/api/prompts/${id}/content`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: editContent }),
			});
		} catch (err) {
			// Optionally handle error
		}

		closeModal();
	};

	return (
		<div className="w-full h-screen">
			<div style={{ padding: "32px", fontFamily: "Inter, Arial, sans-serif" }}>
				<h2
					style={{ fontSize: "2rem", marginBottom: "24px", color: "#2d3748" }}
				>
					Prompts
				</h2>
				<table
					style={{
						width: "100%",
						borderCollapse: "separate",
						borderSpacing: 0,
						boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
						background: "#fff",
						borderRadius: "12px",
						overflow: "hidden",
					}}
				>
					<thead style={{ background: "#f7fafc" }}>
						<tr>
							<th style={thStyle}>ID</th>
							<th style={thStyle}>Name</th>
							<th style={thStyle}>Type</th>
							<th style={thStyle}>Content</th>
							<th style={thStyle}>Enabled</th>
							<th style={thStyle}>Created At</th>
							<th style={thStyle}>Updated At</th>
							<th style={thStyle}>Actions</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((prompt) => (
							<tr key={prompt.id} style={{ borderBottom: "1px solid #eee" }}>
								<td style={tdStyle}>{prompt.id}</td>
								<td style={tdStyle}>{prompt.name}</td>
								<td style={tdStyle}>{prompt.type}</td>

								{/* CONTENT: full content shown, scrollable, no View button here */}
								<td style={tdStyle}>
									<pre style={contentPreStyle}>
										{prompt.content.length > 30
											? `${prompt.content.slice(0, 30)}...`
											: prompt.content}
									</pre>
								</td>

								{/* ENABLED: editable toggle */}
								<td style={tdStyle}>
									<label style={toggleWrapStyle}>
										<input
											type="checkbox"
											checked={prompt.enabled}
											onChange={() => toggleEnabled(prompt.id)}
											style={{ display: "none" }}
											aria-label={`Toggle enabled for ${prompt.name}`}
										/>
										<span
											style={{
												...toggleTrackStyle,
												background: prompt.enabled ? "#38a169" : "#cbd5e0",
											}}
										>
											<span
												style={{
													...toggleThumbStyle,
													transform: prompt.enabled
														? "translateX(20px)"
														: "translateX(0)",
												}}
											/>
										</span>
										<span
											style={{
												marginLeft: 8,
												fontWeight: 600,
												color: prompt.enabled ? "#2f855a" : "#a0aec0",
											}}
										>
											{prompt.enabled ? "Enabled" : "Disabled"}
										</span>
									</label>
								</td>

								<td style={tdStyle}>
									{new Date(prompt.createdAt).toLocaleString()}
								</td>
								<td style={tdStyle}>
									{new Date(prompt.updatedAt).toLocaleString()}
								</td>
								<td style={tdStyle}>
									<button
										type="button"
										style={viewBtnStyle}
										onClick={() => openView(prompt)}
									>
										View
									</button>
									<button
										type="button"
										style={editBtnStyle}
										onClick={() => openEdit(prompt)}
									>
										Edit
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>

				{/* Full-screen Modal */}
				{activePrompt && mode && (
					<Modal
						onClose={closeModal}
						title={mode === "view" ? "Prompt Content" : "Edit Prompt"}
					>
						{mode === "view" ? (
							<div
								style={{
									color: "black",
									whiteSpace: "pre-wrap",
									fontFamily: "monospace",
									fontSize: "1rem",
								}}
							>
								{activePrompt.content}
							</div>
						) : (
							<div style={{ color: "black" }}>
								<label
									htmlFor="edit-content"
									style={{ fontWeight: 600, marginBottom: 8, display: "block" }}
								>
									Content
								</label>
								<textarea
									id="edit-content"
									value={editContent}
									onChange={(e) => setEditContent(e.target.value)}
									style={{
										width: "100%",
										height: "70vh",
										fontFamily: "monospace",
										fontSize: "1rem",
										borderRadius: 8,
										border: "1px solid #ccc",
										padding: "8px",
										resize: "vertical",
										color: "black",
										background: "white",
									}}
								/>
								<div style={{ textAlign: "right", marginTop: 16 }}>
									<button
										type="button"
										style={saveBtnStyle}
										onClick={handleSaveClick}
									>
										Save
									</button>
									<button
										type="button"
										style={cancelBtnStyle}
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
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				background: "rgba(0,0,0,0.5)",
				zIndex: 1000,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div
				style={{
					background: "#fff",
					borderRadius: "8px",
					boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
					width: "90%",
					height: "90%",
					position: "relative",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				<button
					type="button"
					onClick={onClose}
					style={{
						position: "absolute",
						top: 16,
						right: 16,
						background: "#edf2f7",
						border: "none",
						borderRadius: "50%",
						width: 32,
						height: 32,
						fontSize: "1.5rem",
						color: "#2d3748",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 10,
					}}
					aria-label="Close"
				>
					&times;
				</button>

				{title && (
					<h3
						style={{
							margin: 0,
							padding: "16px 24px",
							background: "#f7fafc",
							borderBottom: "1px solid #e2e8f0",
							fontSize: "1.25rem",
							color: "#000309ff",
							flexShrink: 0,
						}}
					>
						{title}
					</h3>
				)}

				<div
					style={{
						padding: "24px",
						overflowY: "auto",
						flexGrow: 1,
						fontFamily: "monospace",
						fontSize: "1rem",
						whiteSpace: "pre-wrap",
					}}
				>
					{children}
				</div>
			</div>
		</div>
	);
}

/* styles */
const thStyle: React.CSSProperties = {
	padding: "14px 10px",
	background: "#f7fafc",
	color: "#4a5568",
	fontWeight: 700,
	fontSize: "1rem",
	borderBottom: "1px solid #e2e8f0",
	textAlign: "left",
};
const tdStyle: React.CSSProperties = {
	padding: "12px 10px",
	fontSize: "1rem",
	color: "#2d3748",
	background: "#fff",
	verticalAlign: "top",
};

/* Scrollable content cell so full text is visible without breaking layout */
const contentCellStyle: React.CSSProperties = {
	maxHeight: 120, // adjust as you like
	overflowY: "auto",
	border: "1px solid #e2e8f0",
	borderRadius: 8,
	padding: 8,
	background: "#fafafa",
};
const contentPreStyle: React.CSSProperties = {
	margin: 0,
	whiteSpace: "pre-wrap",
	fontFamily: "monospace",
	fontSize: "0.95rem",
	color: "#2d3748",
};

/* Pretty toggle */
const toggleWrapStyle: React.CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	cursor: "pointer",
	userSelect: "none",
};
const toggleTrackStyle: React.CSSProperties = {
	position: "relative",
	width: 40,
	height: 20,
	borderRadius: 999,
	transition: "background 150ms ease",
};
const toggleThumbStyle: React.CSSProperties = {
	position: "absolute",
	top: 2,
	left: 2,
	width: 16,
	height: 16,
	borderRadius: "50%",
	background: "#fff",
	boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
	transition: "transform 150ms ease",
};

const viewBtnStyle: React.CSSProperties = {
	marginRight: 8,
	background: "#3182ce",
	color: "#fff",
	border: "none",
	borderRadius: "6px",
	padding: "6px 12px",
	cursor: "pointer",
	fontSize: "0.95rem",
};
const editBtnStyle: React.CSSProperties = {
	background: "#ecc94b",
	color: "#2d3748",
	border: "none",
	borderRadius: "6px",
	padding: "6px 12px",
	cursor: "pointer",
	fontWeight: 600,
	fontSize: "0.95rem",
};
const saveBtnStyle: React.CSSProperties = {
	background: "#38a169",
	color: "#fff",
	border: "none",
	borderRadius: "6px",
	padding: "8px 20px",
	cursor: "pointer",
	fontWeight: 600,
	fontSize: "1rem",
	marginRight: 8,
};
const cancelBtnStyle: React.CSSProperties = {
	background: "#e53e3e",
	color: "#fff",
	border: "none",
	borderRadius: "6px",
	padding: "8px 20px",
	cursor: "pointer",
	fontWeight: 600,
	fontSize: "1rem",
};
