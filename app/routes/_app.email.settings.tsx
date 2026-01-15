import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import React, { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { api_fetch } from "~/services/api";

function FollowerRangesRow({
	range,
	vals,
	setVals,
}: {
	range: string;
	vals: string[];
	setVals: (val: string, i: number) => void;
}) {
	return (
		<TableRow>
			<TableCell className={"text-center font-mono"}>{range}</TableCell>
			{vals.map((val, i) => (
				<TableCell className={"text-center"} key={i}>
					<Input
						className={"max-w-32 m-auto"}
						value={val}
						onInput={(e) => setVals(e.currentTarget.value, i)}
					/>
				</TableCell>
			))}
		</TableRow>
	);
}

interface props {
	followerRanges: {
		minFollowerCount: number;
		settings: {
			name: string;
			value: string;
		}[];
	}[];
	setFollowerRanges: (
		val: {
			minFollowerCount: number;
			settings: {
				name: string;
				value: string;
			}[];
		}[],
	) => void;
}

function FollowerRanges({ followerRanges, setFollowerRanges }: props) {
	if (!followerRanges[0]) {
		return null;
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className={"text-center"}>Follower Range</TableHead>
					{followerRanges[0].settings.map((e, i) => (
						<TableHead key={i} className={"text-center"}>
							{e.name}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{followerRanges.map((f, i) => (
					<FollowerRangesRow
						key={i}
						range={
							f.minFollowerCount >= 1_000_000
								? `${f.minFollowerCount / 10}+`
								: `${f.minFollowerCount / 10}-${
										f.minFollowerCount / 10 + 9_999
									}`
						}
						vals={f.settings.map((e) => e.value)}
						setVals={(val: string, j: number) => {
							const newFollowerRanges = [...followerRanges];
							newFollowerRanges[i].settings[j].value = val;
							setFollowerRanges(newFollowerRanges);
						}}
					/>
				))}
			</TableBody>
		</Table>
	);
}

const defaultRanges = Array(10)
	.fill(100)
	.map((_, i) => ({
		minFollowerCount: (i + 1) * 100000,
		settings: [
			{ name: "Follower Gain", value: "0" },
			{ name: "Story View Gain", value: "0" },
			{ name: "Daily Budget", value: "0" },
			{ name: "Monthly Budget", value: "0" },
		],
	}));

export default function EmailSettings() {
	const { data: table_data } = useQuery({
		queryKey: ["email_vars"],
		queryFn: async () => {
			const d = await api_fetch("/api/outreach/email/vars", {
				method: "GET",
			});
			if (d.status === 200 && d.data) {
				return d.data;
			}
			return defaultRanges;
		},
	});

	const [followerRanges, setFollowerRanges] = React.useState(table_data);

	useEffect(() => {
		if (!table_data || followerRanges || table_data.length === 0) return;
		setFollowerRanges(table_data);
	}, [table_data, followerRanges]);

	const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving">("idle");

	return (
		<div className={"flex-1 h-screen flex flex-col"}>
			<div className={"flex justify-between border p-4 items-center"}>
				<h1 className={"font-light tracking-tighter text-lg"}>
					Email Variables
				</h1>
				<Button
					className={"ml-auto"}
					disabled={saveStatus === "saving"}
					onClick={async () => {
						if (!followerRanges) return;
						setSaveStatus("saving");
						await api_fetch("/api/outreach/email/vars", {
							method: "POST",
							body: {
								followerRanges: followerRanges,
							},
						});
						setSaveStatus("idle");
						// toast("✅ Saved email variables");
					}}
				>
					{saveStatus === "saving" ? (
						<>
							<Loader2 className={"mr-2 w-4 h-4 animate-spin"} />
							Saving...
						</>
					) : (
						<>
							<Save className={"mr-2 w-4 h-4"} />
							Save
						</>
					)}
				</Button>
			</div>
			<div className={"p-4"}>
				<FollowerRanges
					followerRanges={followerRanges || []}
					setFollowerRanges={setFollowerRanges}
				/>
			</div>
		</div>
	);
}
