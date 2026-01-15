"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Company } from "backend/src/api/outreach";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../ui/dialog";

import { Check, Loader, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { api_fetch } from "~/services/api";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Separator } from "../ui/separator";
import { useHiddenList } from "./columns";

const formSchema = z.object({
	name: z.string(),
	nameType: z.enum(["business", "creator"]),
	useForTraining: z.boolean(),
});

export function ProfileForm({ company }: { company: Company }) {
	const [isOpen, setIsOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const isCreator = useMemo(() => {
		return (
			company.first_name &&
			company.first_name !== "No name found" &&
			(company.business_name === "No name found" ||
				company.business_name === null)
		);
	}, [company]);
	// 1. Define your form.
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: isCreator
				? (company.first_name ?? "")
				: (company.business_name ?? ""),
			nameType: isCreator ? "creator" : "business",
			useForTraining: true,
		},
	});
	const hide = useHiddenList((s) => s.hide);

	// 2. Define a submit handler.
	async function onSubmit(values: z.infer<typeof formSchema>) {
		setLoading(true);
		await api_fetch("/api/outreach/edit", {
			method: "POST",
			body: {
				id: company.id,
				isBusiness: values.nameType === "business",
				name: values.name,
				useForTraining: values.useForTraining,
			},
		});
		hide(company.id);
		setIsOpen(false);
		setLoading(false);
	}

	useEffect(() => {
		form.reset({
			name: isCreator
				? (company.first_name ?? "")
				: (company.business_name ?? ""),
			nameType: isCreator ? "creator" : "business",
			useForTraining: true,
		});
	}, [company, form, isCreator]);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger>
				<Button variant="ghost" size={"icon"}>
					<Pencil className="w-4 h-4" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit Candidate @{company.username}</DialogTitle>
				</DialogHeader>
				<div className="p-2">
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
							<div className="flex gap-2">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Enter a name..."
													className="w-56"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="nameType"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name Type</FormLabel>
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger className="w-56">
														<SelectValue placeholder="Select a name type..." />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="creator">Creator</SelectItem>
													<SelectItem value="business">Business</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
							<div>
								<FormField
									control={form.control}
									name="useForTraining"
									render={({ field }) => (
										<FormItem className="flex flex-row items-start p-4 space-x-3 space-y-0 border rounded-md shadow">
											<FormControl>
												<Checkbox
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
											<div className="space-y-1 leading-none">
												<FormLabel>
													Use this entry to improve our AI model?
													<FormDescription className="text-xs">
														NOTE: Only select this option if it can be inferred
														from just the info below
													</FormDescription>
												</FormLabel>
											</div>
										</FormItem>
									)}
								/>
							</div>
							<Separator />
							<div className="grid grid-cols-2 gap-2">
								<div className="col-span">
									<Label>Username: </Label>
									<div className="w-full p-2 text-xs border rounded shadow">
										<pre>{company.username}</pre>
									</div>
								</div>
								<div className="col-span">
									<Label>Email: </Label>
									<div className="w-full p-2 text-xs border rounded shadow">
										<pre>{company.email}</pre>
									</div>
								</div>
								<div className="col-span-2">
									<Label>Full Name: </Label>
									<div className="w-full p-2 text-xs border rounded shadow">
										<pre>{company.full_name}</pre>
									</div>
								</div>
								<div className="col-span-2">
									<Label>Bio: </Label>
									<div className="w-full p-2 text-xs border rounded shadow">
										<pre className="whitespace-pre-wrap">{company.bio}</pre>
									</div>
								</div>
							</div>
							<div className="flex justify-between">
								<div />
								<Button type="submit" disabled={loading}>
									{loading ? (
										<Loader className="w-4 h-4 mr-2 animate-spin" />
									) : (
										<Check className="w-4 h-4 mr-2" />
									)}
									Approve
								</Button>
							</div>
						</form>
					</Form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
