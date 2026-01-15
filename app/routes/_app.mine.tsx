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
import { Textarea } from "~/components/ui/textarea";
import { api_fetch, api_host } from "~/services/api";

type MineTask = {
	id: string;
	title: string;
	count: number;
	processed_count: number;
	private_count: number;
	public_count: number;
	not_found_count: number;
};

/**
 * Downloads a CSV file from the API
 * @param id - The batch ID
 * @param title - The title to use for the filename
 */
async function downloadCSV(id: string, title: string): Promise<void> {
	try {
		const response = await fetch(`${api_host}/api/mine/${id}/output`, {
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

		// Format the filename - sanitize the title and add date
		const date = new Date().toISOString().split("T")[0];
		const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
		const finalFilename =
			`${sanitizedTitle}_${date}.csv` || serverFilename || "download.csv";

		// Get the blob from the response
		const blob = await response.blob();

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

function MineTaskRow({ task }: { task: MineTask }) {
	const [downloadingCSV, setDownloadingCSV] = useState(false);

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
						{task.count}
					</Badge>
				</div>
			</div>
			<div className="border border-b-muted-foreground border-x-muted-foreground grid grid-cols-5 h-full text-sm rounded-b">
				<div className={"border-r p-3"}>
					<Label>Processed</Label>
					<p className={"text-xs text-muted-foreground"}>
						{task.processed_count} accounts
					</p>
				</div>
				<div className={"border-r p-3"}>
					<Label>Private</Label>
					<p className={"text-xs text-muted-foreground"}>
						{task.private_count} accounts
					</p>
				</div>
				<div className={"border-r p-3"}>
					<Label>Public</Label>
					<p className={"text-xs text-muted-foreground"}>
						{task.public_count} accounts
					</p>
				</div>
				<div className={"border-r p-3"}>
					<Label>Not found</Label>
					<p className={"text-xs text-muted-foreground"}>
						{task.not_found_count} accounts
					</p>
				</div>
				<div className={"border-r"}>
					<Button
						className="w-full h-full disabled:opacity-60"
						variant={"ghost"}
						onClick={async () => {
							setDownloadingCSV(true);
							await downloadCSV(task.id, task.title);
							setDownloadingCSV(false);
						}}
						disabled={downloadingCSV}
					>
						{downloadingCSV ? (
							<>
								<Loader className="h-4 w-4 mr-2 animate-spin" />
								Creating CSV...
							</>
						) : (
							<>
								<FolderArchive className="size-4 mr-2" />
								Download CSV
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
	usernames: z.string().min(1),
});

function CreateMineTaskButton({
	refetch,
}: { refetch: () => Promise<unknown> }) {
	const [isOpen, setIsOpen] = useState(false);
	const form = useForm<z.infer<typeof FormSchema>>({
		resolver: zodResolver(FormSchema),
		defaultValues: {
			title: "",
			usernames: "",
		},
	});

	async function onSubmit(data: z.infer<typeof FormSchema>) {
		await api_fetch("/api/mine/new", {
			method: "POST",
			body: {
				title: data.title,
				usernames: data.usernames,
			},
		});
		await refetch();
		toast(
			<div className="p-2 flex w-full flex-col">
				You submitted the following values:
				<pre className="mt-2 w-full rounded-md bg-slate-950 p-4">
					<code className="text-white">
						{JSON.stringify(
							{
								title: data.title,
								usernames: `${data.usernames.split("\n").length} usernames`,
							},
							null,
							2,
						)}
					</code>
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
						className="w-full space-y-6"
					>
						<DialogHeader>
							<DialogTitle>Create a Manual Mining Task</DialogTitle>
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
						<FormField
							control={form.control}
							name="usernames"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Usernames</FormLabel>
									<FormControl>
										<Textarea
											className="w-full"
											placeholder="Paste in a new line separated list of usernames"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit">Submit</Button>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

// "Paste in a new line separated list of usernames"
export default function Mine() {
	const { data: table_data, refetch } = useQuery({
		queryKey: ["mine_tasks"],
		queryFn: async () => {
			const d = await api_fetch("/api/mine/list", {
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
					<CreateMineTaskButton refetch={refetch} />
				</div>
			</div>
			<ScrollArea className="h-[calc(100vh-4rem)] gap-3 p-4">
				{table_data?.map((task) => (
					<div key={task.batch_id}>
						<MineTaskRow
							task={{
								id: task.batch_id,
								title: task.batch_title,
								count: task.count,
								processed_count: task.processed_count,
								private_count: task.private_count,
								public_count: task.public_count,
								not_found_count: task.not_found_count,
							}}
						/>
					</div>
				))}
			</ScrollArea>
		</div>
	);
}
