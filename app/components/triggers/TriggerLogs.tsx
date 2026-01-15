import { useQuery } from "@tanstack/react-query";
import { RefreshCcw, ScrollText } from "lucide-react";
import React from "react";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";
import { api_fetch } from "~/services/api";

interface TriggerLogItemProps {
	id: number;
	name: string;
	instagram_id: string;
	date: string;
	email: string | null;
}

function TriggerLogItem(props: TriggerLogItemProps) {
	return (
		<div className="border p-3 rounded mt-2">
			<div className="flex items-center">
				<h3 className="text-base font-semibold tracking-tight">
					{props.instagram_id} - {props.name}
				</h3>
				{/*<Icon className="w-4 h-4 ml-auto" />*/}
			</div>
			<p className="text-xs text-muted-foreground">
				Sent to:
				<span className="text-foreground">
					{" "}
					<a
						href={`mailto:${props.email}`}
						className="hover:underline transition-colors file:text-primary file:hover:text-primary-hover"
					>
						{props.email || "no recipient"}
					</a>
				</span>
			</p>
			<p className="text-xs text-muted-foreground">{props.date}</p>
		</div>
	);
}
export function TriggerLogSheet() {
	const {
		data: trigger_log,
		refetch: refetch_log,
		fetchStatus,
	} = useQuery(["trigger-log"], async () => {
		const r = await api_fetch("/api/triggers/log", {
			method: "GET",
		});
		if (r.status === 200 && r.data) {
			return r.data;
		}
	});

	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant={"outline"}>
					<ScrollText className="w-4 h-4 mr-2" />
					Trigger Logs
				</Button>
			</SheetTrigger>
			<SheetContent className={"sm:max-w-xl flex flex-col gap-2"}>
				<SheetHeader>
					<div className="flex gap-2 items-center">
						<SheetTitle>Trigger Log</SheetTitle>
						<Button
							onClick={() => refetch_log()}
							variant={"outline"}
							disabled={fetchStatus === "fetching"}
						>
							<RefreshCcw className="w-4 h-4 mr-2" />
							Refresh Log
						</Button>
					</div>
				</SheetHeader>
				<ScrollArea className="h-screen flex gap-2 border p-3">
					{trigger_log?.map((t) => (
						<TriggerLogItem
							instagram_id={t.instagram_id}
							id={t.id}
							name={t.name}
							date={t.createdAt.toString()}
							email={t.emailRecipient}
							key={t.id}
						/>
					))}
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}
