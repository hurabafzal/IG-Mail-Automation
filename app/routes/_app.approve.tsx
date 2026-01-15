import { useQuery } from "@tanstack/react-query";
import type { Lang } from "backend/src/db/db_types";
import { COUNTRY_GROUPS } from "backend/src/utils/consts";
import { CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { columns, useHiddenList } from "~/components/outreach/columns";
import { DataTable } from "~/components/outreach/data-table";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { api_fetch } from "~/services/api";

export default function Index() {
	const [tabPage, setTabPage] = useState<string>("pending");
	const [foundName, setFoundName] = useState<string>("yes");
	const [lang, setLang] = useState<string>("DE");
	const {
		data: table_data,
		status,
		fetchStatus,
		refetch,
	} = useQuery({
		queryKey: ["leads", tabPage, lang, foundName],
		queryFn: async () => {
			const d = await api_fetch("/api/outreach/leads", {
				method: "POST",
				body: {
					show_diffs: true,
					tabPage: tabPage as "pending" | "approved" | "rejected",
					lang: lang as Lang,
					foundName: foundName as "yes" | "no",
				},
			});
			if (d.status === 200 && d.data) {
				// only return 100 records
				return { data: d.data.candidates, count: d.data.count };
			}
			return {
				data: [],
				count: 0,
			};
		},
	});
	const hidden = useHiddenList((s) => s.hidden);
	const reset = useHiddenList((s) => s.reset);
	const data = useMemo(() => {
		return table_data?.data.filter((x) => !hidden.has(x.id));
	}, [hidden, table_data?.data]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		void refetch().then(() => reset());
	}, [tabPage]);

	// I should have a "mark as business" option
	// I should just have a name field, and then a "creator" or "business" field
	return (
		<div className={"flex flex-col p-2 w-full"}>
			<div className="flex justify-between">
				<div className="flex gap-2 items-center">
					<Tabs
						defaultValue="yes"
						onValueChange={setFoundName}
						value={foundName}
					>
						<TabsList>
							<TabsTrigger value="yes">Creator</TabsTrigger>
							<TabsTrigger value="no">Business</TabsTrigger>
						</TabsList>
					</Tabs>

					<Tabs defaultValue="DE" onValueChange={setLang} value={lang}>
						<TabsList>
							{COUNTRY_GROUPS.map((c) => (
								<TabsTrigger key={c.id} value={c.id}>
									{c.id}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
					<Tabs
						defaultValue="pending"
						onValueChange={setTabPage}
						value={tabPage}
					>
						<TabsList>
							<TabsTrigger value="pending">Pending</TabsTrigger>
							<TabsTrigger value="approved">Approved</TabsTrigger>
							<TabsTrigger value="rejected">Rejected</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				<Button
					onClick={async () => {
						// 1. send full list of ids to an /approve/many endpoint
						if (!data) return;
						await api_fetch("/api/outreach/approve/many", {
							method: "POST",
							body: {
								ids: data.map((x) => x.id),
							},
						});
						await refetch().then(() => reset());
						// 2. fetch a new page
					}}
				>
					<CheckCheck className="w-4 h-4 mr-2" />
					Approve Page {status === "success" ? `[${data?.length} rows]` : ""}
				</Button>
			</div>
			<DataTable
				columns={columns}
				data={data ?? []}
				status={status}
				columnVisibility={{
					first_name: foundName === "yes",
					business_name: foundName === "no",
				}}
			/>
			<div className="flex justify-between items-center px-3">
				<p className="text-xs text-muted-foreground">
					{table_data?.count ?? "0"} records
				</p>
				{fetchStatus === "fetching" && status === "success" && (
					<div className={cn("animate-pulse text-xs")}>refetching...</div>
				)}
			</div>
		</div>
	);
}
