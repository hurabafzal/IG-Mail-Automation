import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "~/components/outreach/data-table-stats";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api_fetch } from "~/services/api";

const tableNames = [
	"daily_statistics",
	"combined_daily_statistics",
	"daily_statistics_recovery",
	"combined_daily_statistics_recovery",
	"daily_statistics_scraper",
	"combined_daily_statistics_scrapers",
	"change_48_hours",
	"sort",
	"settings",
] as const;

type TableName = (typeof tableNames)[number];
type Row = Record<string, unknown>;

export default function StatsTabs() {
	const [activeTab, setActiveTab] = useState<TableName>(tableNames[0]);

	const { data, isLoading, error } = useQuery<Row[]>({
		queryKey: ["stats", activeTab],
		queryFn: async () => {
			// const r: { status: number; data?: unknown } = await api_fetch(
			// 	`/api/stats/${activeTab}`,
			// 	{
			// 		method: "GET",
			// 		params: undefined,
			// 		query: undefined,
			// 		body: undefined,
			// 	},
			// );
			let r: { status: number; data?: unknown };

			if (activeTab === "settings") {
				r = await api_fetch("/api/stats/settings", { method: "GET" });
			} else if (activeTab === "daily_statistics") {
				r = await api_fetch("/api/stats/daily_statistics", { method: "GET" });
			} else if (activeTab === "combined_daily_statistics") {
				r = await api_fetch("/api/stats/combined_daily_statistics", {
					method: "GET",
				});
			} else if (activeTab === "daily_statistics_recovery") {
				r = await api_fetch("/api/stats/daily_statistics_recovery", {
					method: "GET",
				});
			} else if (activeTab === "combined_daily_statistics_recovery") {
				r = await api_fetch("/api/stats/combined_daily_statistics_recovery", {
					method: "GET",
				});
			} else if (activeTab === "daily_statistics_scraper") {
				r = await api_fetch("/api/stats/daily_statistics_scraper", {
					method: "GET",
				});
			} else if (activeTab === "combined_daily_statistics_scrapers") {
				r = await api_fetch("/api/stats/combined_daily_statistics_scrapers", {
					method: "GET",
				});
			} else if (activeTab === "change_48_hours") {
				r = await api_fetch("/api/stats/change_48_hours", { method: "GET" });
			} else if (activeTab === "sort") {
				r = await api_fetch("/api/stats/sort", { method: "GET" });
			} else {
				throw new Error("Unknown stats tab");
			}

			if (r.status === 200 && r.data) {
				return r.data as Row[];
			}
			throw new Error("Failed to load stats");
		},
	});

	const tableData = useMemo<Row[]>(() => data ?? [], [data]);

	return (
		<div className="p-8">
			<Tabs
				value={activeTab}
				onValueChange={(v) => setActiveTab(v as TableName)}
			>
				<TabsList className="mb-4 flex gap-2 justify-start">
					{tableNames.map((name) => (
						<TabsTrigger
							key={name}
							value={name}
							className="px-4 py-2 rounded-md font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted text-muted-foreground transition-colors"
						>
							{name.replace(/_/g, " ")}
						</TabsTrigger>
					))}
				</TabsList>

				<div>
					{isLoading ? (
						<div className="text-center py-8">Loading...</div>
					) : error ? (
						<div className="text-center py-8 text-destructive">
							Error loading stats
						</div>
					) : tableData.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No data available
						</div>
					) : (
						<DataTable
							columns={Object.keys(tableData[0] ?? {})
								.filter((key) => key !== "stat_date")
								.map((key) => ({
									accessorKey: key,
									header: key.replace(/_/g, " "),
								}))}
							data={tableData}
							status={isLoading ? "loading" : "success"}
							columnVisibility={{}}
						/>
					)}
				</div>
			</Tabs>
		</div>
	);
}
