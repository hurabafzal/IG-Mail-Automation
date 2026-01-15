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
import { formatZipFilename } from "~/lib/formatZipFilename";
import { api_fetch, api_host } from "~/services/api";

/**
 * Downloads a file from an API response
 * @param url - The API endpoint URL
 * @param filename - Optional custom filename for the downloaded file
 * @param options - Optional fetch options (headers, method, etc.)
 */
async function downloadFile(id: number, title: string): Promise<void> {
	try {
		const response = await fetch(`${api_host}/api/clone/${id}/zip`, {
			credentials: "include",
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		// Get filename from Content-Disposition header if not provided
		const contentDisposition = response.headers.get("content-disposition");
		const serverFilename = contentDisposition
			?.split(";")
			.find((n) => n.includes("filename="))
			?.replace("filename=", "")
			?.trim()
			?.replace(/"/g, "");

		const finalFilename =
			formatZipFilename(title) || serverFilename || "download";

		// Get the blob from the response
		const blob = await response.blob();
		console.log(typeof blob);

		// Create a temporary URL for the blob
		const url = window.URL.createObjectURL(blob);

		// Create a temporary link element
		const link = document.createElement("a");
		link.href = url;
		link.download = finalFilename;

		// Append link to body, click it, and remove it
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// Clean up the temporary URL
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
	accounts_found: number;
	got_pfp: number;
	done: number;
	zip_ready: boolean;
};

function CloneTaskRow({ task }: { task: CloneTask }) {
	const [downloadingZip, setDownloadingZip] = useState(false);
	return (
		<div className="grid items-center mt-2">
			<div className="border border-t-muted-foreground border-x-muted-foreground p-3 w-full h-full flex items-center rounded-t">
				<div className={"ml-1"}>
					<h3 className="ml-2 text-lg font-semibold tracking-tight">
						{task.title}
					</h3>
					{/* <CustomTriggerEventSettings props={props} /> */}
				</div>
				<div className="flex flex-col ml-auto gap-2">
					<Badge
						variant={"outline"}
						className="text-xs font-normal tracking-tight text-muted-foreground max-w-[18.5rem]"
					>
						<span className="mr-2 font-bold border-r pr-2 h-full">Target:</span>
						{task.target_male}M - {task.target_female}F
					</Badge>
				</div>
			</div>
			<div className="border border-b-muted-foreground border-x-muted-foreground grid grid-cols-4 h-full text-sm rounded-b">
				<div className={"border-r p-3"}>
					<Label>Candidates found</Label>
					<p className={"text-xs text-muted-foreground"}>
						{task.accounts_found} accounts
					</p>
				</div>
				<div className={"border-r p-3"}>
					<Label>Got profile pic</Label>
					<p className={"text-xs text-muted-foreground"}>
						{task.got_pfp} accounts
					</p>
				</div>
				<div className={"border-r p-3"}>
					<Label>Done</Label>
					<p className={"text-xs text-muted-foreground"}>
						{task.done} accounts
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
		},
	});

	async function onSubmit(data: z.infer<typeof FormSchema>) {
		await api_fetch("/api/clone/new", {
			method: "POST",
			body: {
				title: data.title,
				target_male: data.target_male,
				target_female: data.target_female,
				target_country: data.target_country, // Remove this line if not supported by backend
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
							<FormField
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
							/>
							<FormField
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
							/>
						</div>
						<div className="flex gap-2 w-full">
							<FormField
								control={form.control}
								name="target_country"
								render={({ field }) => (
									<FormItem>
										<FormLabel># of accounts from country</FormLabel>
										<FormControl>
											<select
												{...field}
												className="w-full border rounded px-2 py-1 bg-background"
											>
												<option value="">Select country</option>
												<option value="United States">United States</option>
												<option value="Germany">Germany</option>
											</select>
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
			const d = await api_fetch("/api/clone/list", {
				method: "GET",
			});
			if (d.status === 200 && d.data) {
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
				{table_data?.map((task) => (
					<div key={task.id}>
						<CloneTaskRow
							task={{
								id: task.id,
								title: task.title,
								target: task.target,
								accounts_found: task.total_count,
								done: task.done_count,
								got_pfp: task.got_pfp_count,
								target_male: task.target_male,
								target_female: task.target_female,
								zip_ready: true,
							}}
						/>
					</div>
				))}
			</ScrollArea>
		</div>
	);
}
