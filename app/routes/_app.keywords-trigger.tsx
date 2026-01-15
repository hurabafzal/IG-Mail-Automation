// what should be in this page?
// a page that shows a list of months, and the data that has been collected for each month
// it will collect data until it hits the cap, then it will stop until the next month

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { FolderArchive, Loader, PackagePlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "~/components/ui/form";
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
import { Switch } from "~/components/ui/switch"; // NEW
import { formatZipFilename } from "~/lib/formatZipFilename";
import { api_fetch, api_host } from "~/services/api";

/**
 * Downloads a file from an API response
 * @param url - The API endpoint URL
 * @param filename - Optional custom filename for the downloaded file
 * @param options - Optional fetch options (headers, method, etc.)
 */
async function setTaskActive(id: number, is_active: boolean) {
	return api_fetch("/api/filtertask/clone/:id/active", {
		method: "POST",
		body: { is_active },
		// most typed api clients accept params like this:
		params: { id },
	});
}

function ensureCsvExt(name: string): string {
	return name?.toLowerCase().endsWith(".csv") ? name : `${name}.csv`;
}
async function downloadFile(id: number, title: string): Promise<void> {
	try {
		const response = await fetch(`${api_host}/api/filtertask/clone/${id}/csv`, {
			credentials: "include",
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		// Try to read server filename first
		const cd = response.headers.get("content-disposition") || "";
		const serverFilename = cd
			.split(";")
			.map((s) => s.trim())
			.find((s) => s.toLowerCase().startsWith("filename="))
			?.split("=")[1]
			?.replace(/^"(.*)"$/, "$1"); // strip quotes

		// Fall back to your title; ensure .csv
		const finalFilename = ensureCsvExt(
			serverFilename || title?.trim() || `trigger_${id}`,
		);

		const blob = await response.blob(); // should be text/csv; charset=utf-8
		const url = window.URL.createObjectURL(blob);

		const link = document.createElement("a");
		link.href = url;
		link.download = finalFilename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
	} catch (error) {
		toast.error(`Download failed... ${error}`);
		console.error("Download failed:", error);
	}
}

type CloneTask = {
	id: number;
	title: string;
	target: number;
	target_male: number;
	target_female: number;
	accounts_found: number; // maps from 'found'
	done: number; // placeholder until backend provides it
	got_pfp: number; // placeholder until backend provides it
	zip_ready: boolean;
	found: number; // you're also showing this directly in UI
	result_limit: number;
	is_active: boolean;
	maxPerDay: number;
	enable_mentions_scraping: boolean;
	enable_hashtag_scraping: boolean;
};

type ApiTask = {
	id: string | number;
	title: string;
	target: number;
	target_male: number;
	target_female: number;
	result_limit: number;
	found: number;
	is_active: boolean;
	maxPerDay?: number;
	enable_mentions_scraping?: boolean;
	enable_hashtag_scraping?: boolean;
};

function CloneTaskRow({ task }: { task: CloneTask }) {
	const [downloadingZip, setDownloadingZip] = useState(false);
	const [active, setActive] = useState<boolean>(task.is_active);
	const [busy, setBusy] = useState(false);
	const [maxPerDay, setMaxPerDay] = useState<number>(task.maxPerDay); // fallback if not present
	const [enableMentionsScraping, setEnableMentionsScraping] = useState<boolean>(
		task.enable_mentions_scraping || false,
	);
	const [enableHashtagScraping, setEnableHashtagScraping] = useState<boolean>(
		task.enable_hashtag_scraping || false,
	);
	// Debug: Log the task data to see what we're receiving
	console.log("🎯 CloneTaskRow received task data:", {
		id: task.id,
		title: task.title,
		enable_mentions_scraping: task.enable_mentions_scraping,
		enable_hashtag_scraping: task.enable_hashtag_scraping,
		enable_mentions_scraping_type: typeof task.enable_mentions_scraping,
		enable_hashtag_scraping_type: typeof task.enable_hashtag_scraping,
	});

	// Handler for updating maxPerDay
	const handleMaxPerDayChange = async (v: string) => {
		const newVal = Number.parseInt(v);
		setMaxPerDay(newVal);
		await api_fetch("/api/filtertask/clone/maxPerDay", {
			method: "POST",
			body: {
				id: task.id,
				maxPerDay: newVal,
			},
		});
		// Optionally: refetch or show toast
		toast.success("Max per day updated");
	};

	// Handler for updating mentions scraping toggle
	const handleMentionsScrapingChange = async (checked: boolean) => {
		console.log("🔄 handleMentionsScrapingChange called:", {
			taskId: task.id,
			checked,
			currentState: enableMentionsScraping,
			newState: checked,
		});
		setEnableMentionsScraping(checked);
		try {
			console.log("📡 Making API call to update mentions scraping...");
			const result = await api_fetch(
				"/api/filtertask/clone/:id/mentionsScraping",
				{
					method: "POST",
					body: {
						enable_mentions_scraping: checked,
					},
					params: { id: task.id },
				},
			);
			console.log("✅ Mentions scraping update result:", result);
			toast.success(`Mentions scraping ${checked ? "enabled" : "disabled"}`);
		} catch (error) {
			console.error("❌ Error updating mentions scraping:", error);
			toast.error("Failed to update mentions scraping");
			// Revert the state on error
			setEnableMentionsScraping(!checked);
		}
	};

	// Handler for updating hashtag scraping toggle
	const handleHashtagScrapingChange = async (checked: boolean) => {
		console.log("🔄 handleHashtagScrapingChange called:", {
			taskId: task.id,
			checked,
			currentState: enableHashtagScraping,
			newState: checked,
		});
		setEnableHashtagScraping(checked);
		try {
			console.log("📡 Making API call to update hashtag scraping...");
			const result = await api_fetch(
				"/api/filtertask/clone/:id/hashtagScraping",
				{
					method: "POST",
					body: {
						enable_hashtag_scraping: checked,
					},
					params: { id: task.id },
				},
			);
			console.log("✅ Hashtag scraping update result:", result);
			toast.success(`Hashtag scraping ${checked ? "enabled" : "disabled"}`);
		} catch (error) {
			console.error("❌ Error updating hashtag scraping:", error);
			toast.error("Failed to update hashtag scraping");
			// Revert the state on error
			setEnableHashtagScraping(!checked);
		}
	};

	return (
		<div className="grid items-center mt-2">
			<div className="border border-t-muted-foreground border-x-muted-foreground p-3 w-full h-full flex items-center rounded-t">
				<div className={"ml-1"}>
					<h3 className="ml-2 text-lg font-semibold tracking-tight">
						{task.title}
					</h3>
				</div>

				{/* Start/Pause toggle */}
				<div className="ml-auto flex items-center gap-3">
					<Badge variant={active ? "default" : "outline"}>
						{active ? "Collecting" : "Paused"}
					</Badge>

					<div className="flex items-center gap-2">
						<Label htmlFor={`toggle-${task.id}`} className="text-xs">
							{active ? "Pause" : "Start"}
						</Label>
						<Switch
							id={`toggle-${task.id}`}
							checked={active}
							disabled={busy}
							onCheckedChange={async (checked) => {
								const prev = active;
								setBusy(true);
								setActive(checked); // optimistic
								try {
									const res = await setTaskActive(task.id, checked);
									if (res.status !== 200) {
										setActive(prev);
										toast.error("Couldn’t update state");
									} else {
										toast.success(checked ? "Started" : "Paused");
									}
								} catch (e) {
									setActive(prev);
									toast.error("Network error while toggling");
									console.error(e);
								} finally {
									setBusy(false);
								}
							}}
						/>
					</div>

					{/* Scraping Toggles */}
					<div className="flex gap-4 items-center">
						<div className="flex gap-2 items-center">
							<Label className="text-xs">Mentions</Label>
							{(() => {
								console.log("🎛️ Rendering Mentions Switch:", {
									taskId: task.id,
									checked: enableMentionsScraping,
									type: typeof enableMentionsScraping,
								});
								return (
									<Switch
										checked={enableMentionsScraping}
										onCheckedChange={handleMentionsScrapingChange}
									/>
								);
							})()}
						</div>
						<div className="flex gap-2 items-center">
							<Label className="text-xs">Hashtag</Label>
							{(() => {
								console.log("🎛️ Rendering Hashtag Switch:", {
									taskId: task.id,
									checked: enableHashtagScraping,
									type: typeof enableHashtagScraping,
								});
								return (
									<Switch
										checked={enableHashtagScraping}
										onCheckedChange={handleHashtagScrapingChange}
									/>
								);
							})()}
						</div>
					</div>

					{/* Max Per Day Dropdown */}
					<div className="flex gap-2 items-center justify-center flex-col">
						<Label className="text-xs">Max Per Day</Label>
						<Select
							onValueChange={handleMaxPerDayChange}
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

					{/* Manage page/url */}
					{/* <Button asChild size="sm" variant="secondary">
						<a href={`/clone/${task.id}`}>Manage</a>
					</Button> */}
				</div>
			</div>
			<div className="border border-b-muted-foreground border-x-muted-foreground grid grid-cols-4 h-full text-sm rounded-b">
				<div className={"border-r p-3"}>
					<Label>Candidates Limit</Label>
					<p className={"text-xs text-muted-foreground"}>
						{task.result_limit} accounts
					</p>
				</div>
				<div className={"border-r p-3"}>
					<Label>Found</Label>
					<p className={"text-xs text-muted-foreground"}>
						{task.found} accounts
					</p>
				</div>
				<div className={"border-r p-3"}>
					<Label />
					<p className="text-xs text-muted-foreground break-all">
						{/* {`${api_host}/api/filtertask/clone/${task.id}/status`} */}
					</p>
				</div>
				<div className={"border-r"}>
					<Button
						className="w-full h-full disabled:opacity-60"
						variant={"ghost"}
						onClick={async () => {
							setDownloadingZip(true);
							await downloadFile(task.id, task.title);
							setDownloadingZip(false);
						}}
						disabled={downloadingZip}
					>
						{downloadingZip ? (
							<>
								<Loader className="h-4 w-4 mr-2 animate-spin" />
								Zipping...
							</>
						) : (
							<>
								<FolderArchive className="size-4 mr-2" />
								Download ZIP
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}

const FormSchema = z.object({
	title: z.string().min(2, {
		message: "Title must be at least 2 characters.",
	}),
	target_male: z.coerce.number().min(0, { message: "Invalid target count" }),
	target_female: z.coerce.number().min(0, { message: "Invalid target count" }),
	target_country: z.string().min(1, { message: "Country is required" }),
	target_keywords: z.string().min(1, { message: "Keywords are required" }),
	target_min_followers: z.coerce
		.number()
		.min(0, { message: "Invalid target min followers" }),
	target_max_followers: z.coerce
		.number()
		.max(100000000, { message: "Max followers must be 100,000,000 or less" }),
	target_limit: z.coerce.number().min(0, { message: "Invalid target limit" }),
	post_date: z.string().min(1, { message: "Post date is required" }),
	instalnty_id: z.string().min(1, { message: "Campaign ID is required" }),
	enable_mentions_scraping: z.boolean().default(false),
	enable_hashtag_scraping: z.boolean().default(false),
});

function CreateTaskButton({ refetch }: { refetch: () => Promise<unknown> }) {
	const [isOpen, setIsOpen] = useState(false);
	const form = useForm<z.infer<typeof FormSchema>>({
		resolver: zodResolver(FormSchema),
		defaultValues: {
			title: "",
			target_male: 0,
			target_female: 0,
			target_country: "Germany",
			target_keywords: "",
			target_min_followers: 0,
			target_max_followers: 100000000,
			target_limit: 0,
			post_date: "",
			instalnty_id: "",
			enable_mentions_scraping: false,
			enable_hashtag_scraping: false,
		},
	});

	async function onSubmit(data: z.infer<typeof FormSchema>) {
		await api_fetch("/api/filtertask/clone/new", {
			method: "POST",
			body: {
				title: data.title,
				target_male: 5,
				target_female: 5,
				target_country: data.target_country,
				keywords: data.target_keywords,
				min_followers: data.target_min_followers,
				max_followers: data.target_max_followers,
				post_date: data.post_date,
				limit: data.target_limit,
				result_limit: data.target_limit,
				instalnty_id: data.instalnty_id,
				enable_mentions_scraping: data.enable_mentions_scraping,
				enable_hashtag_scraping: data.enable_hashtag_scraping,
			},
		});
		await refetch();
		toast(
			<div className="p-2 flex w-full flex-col">
				You submitted the following values:
				<pre className="mt-2 w-full rounded-md bg-slate-950 p-4">
					<code className="text-white">{JSON.stringify(data, null, 2)}</code>
				</pre>
			</div>,
		);
		setIsOpen(false);
	}

	return (
		<Dialog onOpenChange={setIsOpen} open={isOpen}>
			<DialogTrigger asChild>
				<Button variant={"outline"}>
					<PackagePlus className="size-4 mr-2" />
					New Task
				</Button>
			</DialogTrigger>
			<DialogContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="w-fit space-y-6"
					>
						<DialogHeader>
							<DialogTitle>Create an Account Cloning Task</DialogTitle>
						</DialogHeader>
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Title</FormLabel>
									<FormControl>
										<Input placeholder="November batch #1" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex gap-2 w-full">
							{/* <FormField
								control={form.control}
								name="target_male"
								render={({ field }) => (
									<FormItem>
										<FormLabel># of male accounts</FormLabel>
										<FormControl>
											<Input type="number" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/> */}
							{/* <FormField
								control={form.control}
								name="target_female"
								render={({ field }) => (
									<FormItem>
										<FormLabel># of female accounts</FormLabel>
										<FormControl>
											<Input type="number" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/> */}
						</div>
						<div className="flex gap-2 w-full">
							<FormField
								control={form.control}
								name="target_country"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Country</FormLabel>
										<FormControl>
											<select
												{...field}
												className="w-full border rounded px-2 py-1 bg-background"
											>
												<option value="">Select country</option>
												<option value="United States">United States</option>
												<option value="Germany">Germany</option>
												{/* Add more countries as needed */}
											</select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="flex gap-2 w-full">
							<FormField
								control={form.control}
								name="target_keywords"
								render={({ field }) => (
									<FormItem className="w-full">
										<FormLabel>Keywords</FormLabel>
										<FormControl>
											<Input
												className="min-w-[350px] py-2"
												placeholder="Comma separated keywords (e.g. travel,food)"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="flex gap-4 w-full">
							<FormField
								control={form.control}
								name="enable_mentions_scraping"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												Mentions Scraping
											</FormLabel>
											<div className="text-sm text-muted-foreground">
												Scrape @ mentions from posts and their followings
											</div>
										</div>
										<FormControl>
											<Switch
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="enable_hashtag_scraping"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												Hashtag Scraping
											</FormLabel>
											<div className="text-sm text-muted-foreground">
												Search Instagram hashtags for posts
											</div>
										</div>
										<FormControl>
											<Switch
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
						<div className="flex gap-2 w-full">
							<FormField
								control={form.control}
								name="instalnty_id"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Instalnty Campaign ID</FormLabel>
										<FormControl>
											<Input placeholder="Enter campaign ID" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="flex gap-2 w-full">
							<FormField
								control={form.control}
								name="target_min_followers"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Min Followers</FormLabel>
										<FormControl>
											<Input type="number" placeholder="e.g. 1000" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="target_max_followers"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Max Followers</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="e.g. 100000000"
												max={100000000}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="flex gap-2 w-full">
							<FormField
								control={form.control}
								name="post_date"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Post Date After</FormLabel>
										<FormControl>
											<Input type="date" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="flex gap-2 w-full">
							<FormField
								control={form.control}
								name="target_limit"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Limit</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="Max accounts to clone"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<Button type="submit">Submit</Button>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

export default function Users() {
	const { data: table_data, refetch } = useQuery({
		queryKey: ["email_vars"],
		queryFn: async () => {
			const d = await api_fetch("/api/filtertask/clone/list", {
				method: "GET",
			});
			if (d.status === 200 && d.data) {
				console.log("🔍 API Response from /api/filtertask/clone/list:", d.data);
				console.log("🔍 First task data:", d.data[0]);
				console.log(
					"🔍 Task 14 data:",
					d.data.find((t: ApiTask) => t.id === 14),
				);
				console.log(
					"🔍 All tasks with toggle data:",
					d.data.map((t: ApiTask) => ({
						id: t.id,
						title: t.title,
						enable_mentions_scraping: t.enable_mentions_scraping,
						enable_hashtag_scraping: t.enable_hashtag_scraping,
					})),
				);
				return d.data;
			}
			return [];
		},
	});

	return (
		<div className="w-full h-screen">
			<div className="flex justify-between items-center p-3 border">
				<div className={"flex gap-2"}>
					<CreateTaskButton refetch={refetch} />
				</div>
			</div>
			<ScrollArea className="h-[calc(100vh-4rem)] gap-3 p-4">
				{table_data?.map((task) => {
					console.log("🔄 Processing task for CloneTaskRow:", {
						id: task.id,
						title: task.title,
						raw_enable_mentions_scraping: (task as ApiTask)
							.enable_mentions_scraping,
						raw_enable_hashtag_scraping: (task as ApiTask)
							.enable_hashtag_scraping,
						processed_enable_mentions_scraping: Boolean(
							(task as ApiTask).enable_mentions_scraping ?? false,
						),
						processed_enable_hashtag_scraping: Boolean(
							(task as ApiTask).enable_hashtag_scraping ?? false,
						),
					});

					return (
						<div key={task.id}>
							<CloneTaskRow
								task={{
									id: Number(task.id),
									title: task.title,
									target: task.target,
									// CHANGED: use fields that exist
									accounts_found: task.found, // instead of task.total_count
									done: 0, // instead of task.done_count
									got_pfp: 0, // instead of task.got_pfp_count
									target_male: task.target_male,
									target_female: task.target_female,
									zip_ready: true,
									found: task.found,
									result_limit: task.result_limit,
									is_active: Boolean(task.is_active),
									maxPerDay: task.maxPerDay || task.result_limit,
									enable_mentions_scraping: Boolean(
										(task as ApiTask).enable_mentions_scraping ?? false,
									),
									enable_hashtag_scraping: Boolean(
										(task as ApiTask).enable_hashtag_scraping ?? false,
									),
								}}
							/>
						</div>
					);
				})}
			</ScrollArea>
		</div>
	);
}
