import { useQuery } from "@tanstack/react-query";
import type { AllSelection } from "kysely/dist/cjs/parser/select-parser";
import { Loader2, Save, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TriggerLogSheet } from "~/components/triggers/TriggerLogs";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api_fetch } from "~/services/api";
import type { DB } from "../../backend/src/db/db_types";

type TriggerEventProps = AllSelection<DB, "Trigger"> & {
	last_24_hours: number;
	total_sent: number;
	matching_rank: number;
	not_cooldown: number;
	refetch: () => Promise<unknown>;
};

const CustomSettings = {
	newPosts: {
		label: "New Posts",
		type: "posts" as const,
	},
	followerGainP: {
		label: "Follower Gain",
		type: "%" as const,
	},
	followerLossP: {
		label: "Follower Loss",
		type: "%" as const,
	},
	followingGain: {
		label: "Following Gain",
		type: "accounts" as const,
	},
} as const;

function BasicTriggerEventSettings({ props }: { props: TriggerEventProps }) {
	const maxPerDay = props.maxPerDay;
	return (
		<div className={"ml-auto flex gap-2"}>
			<div className="flex gap-2 items-center justify-center flex-col">
				<Label className="text-xs">Max Per Day</Label>
				<Select
					onValueChange={async (v) => {
						await api_fetch("/api/triggers/maxPerDay", {
							method: "POST",
							body: {
								id: props.id,
								maxPerDay: Number.parseInt(v),
							},
						});
						await props.refetch();
					}}
					value={maxPerDay.toString()}
				>
					<SelectTrigger className="w-20 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{[...Array(5).keys()]
							.map((i) => i + 1)
							.concat([...Array(100).keys()].map((i) => i * 10 + 10))
							.map((i) => (
								<SelectItem key={i} value={i.toString()}>
									{i.toString()}
								</SelectItem>
							))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

function CustomTriggerEventSettings({ props }: { props: TriggerEventProps }) {
	const [open, setOpen] = useState(false);
	const api_settings = props.params as Record<
		keyof typeof CustomSettings,
		unknown
	>;
	const [settings, setSettings] = useState(api_settings);
	const key = Object.keys(settings)[0] as
		| keyof typeof CustomSettings
		| undefined;

	const [saving, setSaving] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<button
					className="text-xs text-muted-foreground ml-2 hover:underline"
					disabled={!key}
					type="button"
				>
					{key
						? props.description?.replaceAll(
								`{${key}}`,
								api_settings[key] as string,
							)
						: props.description}
				</button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Settings: {props.name}</DialogTitle>
				</DialogHeader>
				<div className="w-36 m-auto py-2">
					<div className="flex gap-2 items-center justify-center flex-col">
						{key && (
							<>
								<Label>{CustomSettings[key].label}</Label>
								<div className={"flex"}>
									<input
										value={settings[key] as string}
										onChange={(e) => {
											const x = { ...settings };
											x[key] = e.target.value;
											setSettings(x);
										}}
										className="flex h-8 w-16 rounded-l-md border border-input bg-transparent pl-3 pr-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
									/>
									<div className="border-y border-r rounded-r-md px-1 text-xs text-center flex items-center">
										{CustomSettings[key].type}
									</div>
								</div>
							</>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button
						type="submit"
						onClick={async () => {
							setSaving(true);
							await api_fetch("/api/triggers/params", {
								method: "POST",
								body: {
									id: props.id,
									params: settings,
								},
							});
							setSaving(false);
							setOpen(false);
							await props.refetch();
						}}
					>
						{saving ? (
							<>
								<Loader2 className="animate-spin w-4 h-4 mr-2" />
								Saving...
							</>
						) : (
							<>
								<Save className="w-4 h-4 mr-2" />
								Save
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function TriggerEvent({ props }: { props: TriggerEventProps }) {
	const { data: campaigns } = useQuery(["sequences"], async () => {
		const r = await api_fetch("/api/triggers/sequences", {
			method: "GET",
		});
		if (r.status === 200 && r.data) {
			return r.data;
		}
	});

	const [subsequence, setSubsequence] = useState<string | null>(null);

	useEffect(() => {
		if (campaigns && props.instantlyCampaignId && props.subsequenceId) {
			const campaign = campaigns.find(
				(c) => c.id === props.instantlyCampaignId,
			);
			if (campaign) {
				const sub = campaign.subsequences.find(
					(s) => s.id === props.subsequenceId,
				);
				if (sub) {
					setSubsequence(sub.name);
				}
			}
		}
	}, [campaigns, props.instantlyCampaignId, props.subsequenceId]);

	return (
		<div className="grid items-center mt-2">
			<div className="border border-t-muted-foreground border-x-muted-foreground p-3 w-full h-full flex items-center rounded-t">
				<Switch
					checked={props.active}
					onCheckedChange={async (checked) => {
						await api_fetch("/api/triggers/active", {
							method: "POST",
							body: {
								id: props.id,
								active: checked,
							},
						});
						await props.refetch();
					}}
				/>
				<div className={"ml-1"}>
					<h3 className="ml-2 text-lg font-semibold tracking-tight">
						{props.name}
					</h3>
					<CustomTriggerEventSettings props={props} />
				</div>
				<div className="flex flex-col ml-auto gap-2">
					<BasicTriggerEventSettings props={props} />
					{subsequence && (
						<Badge
							variant={"outline"}
							className="text-xs font-normal tracking-tight text-muted-foreground max-w-[18.5rem]"
						>
							<span className="mr-2 font-bold border-r pr-2 h-full">
								Sequence:
							</span>
							{subsequence}
						</Badge>
					)}
				</div>
			</div>
			<div className="border border-b-muted-foreground border-x-muted-foreground grid grid-cols-4 gap-4 h-full text-sm rounded-b">
				<div className={"border-r p-3"}>
					<Label>Last 24 Hours</Label>
					<p className={"text-xs text-muted-foreground"}>
						{props.last_24_hours} triggers
					</p>
				</div>
				<div className={"border-r p-3"}>
					<Label>Total Sent</Label>
					<p className={"text-xs text-muted-foreground"}>
						{props.total_sent} sent
					</p>
				</div>
				<div className={"p-3 border-r"}>
					<Label>Matching Rank</Label>
					<p className={"text-xs text-muted-foreground"}>
						{props.matching_rank} candidates
					</p>
				</div>
				<div className={"p-3"}>
					<Label>Not on Cooldown and Approved</Label>
					<p className={"text-xs text-muted-foreground"}>
						{props.not_cooldown} candidates
					</p>
				</div>
			</div>
		</div>
	);
}

function SettingsDialog() {
	const [open, setOpen] = useState(false);
	const { data: api_cooldown } = useQuery(["trigger-cooldown"], async () => {
		const r = await api_fetch("/api/triggers/cooldown/global", {
			method: "GET",
		});
		if (r.status === 200 && r.data) {
			return r.data;
		}
	});

	const [saving, setSaving] = useState(false);

	const [cooldown, setCooldown] = useState(api_cooldown?.cooldown);
	const [scraping_frequency, setScrapingFrequency] = useState(
		api_cooldown?.scraping_frequency,
	);

	useEffect(() => {
		setCooldown(api_cooldown?.cooldown);
		setScrapingFrequency(api_cooldown?.scraping_frequency);
	}, [api_cooldown]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant={"outline"}>
					<Settings className="w-4 h-4 mr-2" />
					Global Settings
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Trigger Settings</DialogTitle>
				</DialogHeader>
				<div className={"grid grid-cols-2"}>
					<div className="w-36 m-auto py-2">
						<Label>Email Cooldown</Label>
						<div className="mt-2 flex">
							<Input
								type="number"
								// set to undefined if the value is NaN
								value={Number.isNaN(cooldown ?? Number.NaN) ? "" : cooldown}
								onChange={(e) => setCooldown(Number.parseInt(e.target.value))}
							/>
							<div className="ml-2 text-sm text-center flex items-center text-muted-foreground">
								days
							</div>
						</div>
					</div>
					<div className="w-36 m-auto py-2">
						<Label>Scraping Frequency</Label>
						<div className="mt-2 flex">
							<Input
								type="number"
								value={
									Number.isNaN(scraping_frequency ?? Number.NaN)
										? ""
										: scraping_frequency
								}
								onChange={(e) =>
									setScrapingFrequency(Number.parseInt(e.target.value))
								}
							/>
							<div className="ml-2 text-sm text-center flex items-center text-muted-foreground">
								days
							</div>
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button
						type="submit"
						onClick={async () => {
							if (!cooldown || !scraping_frequency) return;
							setSaving(true);
							await api_fetch("/api/triggers/cooldown/global", {
								method: "POST",
								body: {
									cooldown: cooldown,
									scraping_frequency: scraping_frequency,
								},
							});
							setSaving(false);
							setOpen(false);
						}}
					>
						{saving ? (
							<>
								<Loader2 className="animate-spin w-4 h-4 mr-2" />
								Saving...
							</>
						) : (
							<>
								<Save className="w-4 h-4 mr-2" />
								Save
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function Triggers() {
	const { data: triggers, refetch } = useQuery(["trigger-events"], async () => {
		const r = await api_fetch("/api/triggers/", {
			method: "GET",
		});
		if (r.status === 200 && r.data) {
			return r.data;
		}
	});
	const { data: triggers_data } = useQuery(["trigger-event-data"], async () => {
		const r = await api_fetch("/api/triggers/data", {
			method: "GET",
		});
		if (r.status === 200 && r.data) {
			return r.data;
		}
	});

	const { data: campaigns } = useQuery(["sequences"], async () => {
		const r = await api_fetch("/api/triggers/sequences", {
			method: "GET",
		});
		if (r.status === 200 && r.data) {
			return r.data;
		}
	});

	const [language, setLanguage] = useState("DE");

	// Group triggers by campaign
	const groupedTriggers = useMemo(() => {
		if (!triggers || !campaigns) return [];

		const filteredTriggers = triggers.filter((t) => t.lang === language);
		const grouped = new Map<string, typeof triggers>();

		// Only add triggers with campaigns
		for (const trigger of filteredTriggers) {
			if (trigger.instantlyCampaignId) {
				const campaign = campaigns.find(
					(c) => c.id === trigger.instantlyCampaignId,
				);
				if (campaign) {
					const key = `${campaign.language}|${campaign.name}`;
					if (!grouped.has(key)) {
						grouped.set(key, []);
					}
					grouped.get(key)?.push(trigger);
				}
			}
		}

		return Array.from(grouped.entries());
	}, [triggers, campaigns, language]);

	return (
		<div className="w-full h-screen">
			<div className="flex justify-between items-center p-3 border">
				<div className={"flex gap-2"}>
					<SettingsDialog />
					<Tabs value={language} onValueChange={(x) => setLanguage(x)}>
						<TabsList>
							<TabsTrigger value="DE">German</TabsTrigger>
							<TabsTrigger value="EN">English</TabsTrigger>
							<TabsTrigger value="NL">Dutch</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				<TriggerLogSheet />
			</div>
			<ScrollArea className="h-[calc(100vh-4rem)] gap-3 p-4">
				{groupedTriggers.map(([key, groupTriggers]) => {
					const [lang, campaignName] = key.split("|");
					return (
						<div key={key} className="mb-8">
							<div className="flex items-center mb-4">
								<h2 className="text-xl font-semibold">
									{campaignName}
									<span className="ml-2 text-sm text-muted-foreground">
										({groupTriggers.length} triggers)
									</span>
								</h2>
							</div>
							<div className="space-y-4 pl-4">
								{groupTriggers.map((t) => {
									const matching_ranks = triggers_data?.matchingRanks;
									const not_cooldowns = triggers_data?.notOnCooldown;

									const recent_events = triggers_data?.recent_events.find(
										(x) => x.trigger_id === t.id,
									)?.recent_events;
									const total_sent = triggers_data?.all_events.find(
										(x) => x.trigger_id === t.id,
									)?.all_events;
									const matching_rank = matching_ranks?.find(
										(x) => x.id === t.id,
									)?.active_targets;
									const not_cooldown = not_cooldowns?.find(
										(x) => x.id === t.id,
									)?.active_targets;

									return (
										<TriggerEvent
											props={{
												...t,
												last_24_hours: recent_events ?? 0,
												total_sent: total_sent ?? 0,
												matching_rank: matching_rank ?? 0,
												not_cooldown: not_cooldown ?? 0,
												refetch,
											}}
											key={t.id}
										/>
									);
								})}
							</div>
						</div>
					);
				})}
			</ScrollArea>
		</div>
	);
}
