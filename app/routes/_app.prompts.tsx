import { useQuery } from "@tanstack/react-query";
import { api_fetch } from "~/services/api";
import PromptManagement from "../components/PromptManagement";

export default function AppPrompts() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["prompts"],
		queryFn: async () => {
			const r = await api_fetch("/api/prompts/", { method: "GET" });
			if (r.status === 200 && r.data) {
				return r.data;
			}
			throw new Error("Failed to load prompts");
		},
	});

	if (isLoading) {
		return (
			<div className="w-full h-screen flex items-center justify-center">
				Loading...
			</div>
		);
	}

	if (error) {
		return (
			<div className="w-full h-screen flex items-center justify-center text-red-500">
				Error loading prompts
			</div>
		);
	}

	// type NewType = any;

	return (
		<div className="w-full h-screen">
			<PromptManagement
				prompts={(data ?? []).map((prompt) => ({
					...prompt,
					createdAt:
						prompt.createdAt instanceof Date
							? prompt.createdAt.toISOString()
							: prompt.createdAt,
					updatedAt:
						prompt.updatedAt instanceof Date
							? prompt.updatedAt.toISOString()
							: prompt.updatedAt,
				}))}
			/>
		</div>
	);
}
