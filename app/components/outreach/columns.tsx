import type { ColumnDef } from "@tanstack/react-table";
import type { Company } from "backend/src/api/outreach"; // IMPORTANT THAT THIS STAYS A TYPE ONLY IMPORT
import { ArrowDown, ArrowUp, Check, Minus, Pencil, X } from "lucide-react";
import { create } from "zustand";
import { api_fetch } from "~/services/api";
import { Button } from "../ui/button";
import { ProfileForm } from "./edit-form";

interface ApprovalBuckets {
	hidden: Set<string>;
	hide: (id: string) => void;
	reset: () => void;
}

export const useHiddenList = create<ApprovalBuckets>()((set) => ({
	hidden: new Set<string>(),
	hide: (id) =>
		set((state) => ({
			hidden: new Set(state.hidden).add(id),
		})),
	reset: () =>
		set({
			hidden: new Set(),
		}),
}));

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export const columns: ColumnDef<Company>[] = [
	{
		id: "actions",
		header: "Actions",
		cell: ({ row }) => {
			const company = row.original;
			const hide = useHiddenList((s) => s.hide);

			return (
				<div className="flex gap-1">
					<Button
						variant="ghost"
						size={"icon"}
						onClick={() => {
							void api_fetch("/api/outreach/approve", {
								method: "POST",
								body: {
									id: company.id,
								},
							});
							hide(company.id);
						}}
					>
						<Check className="h-4 w-4 stroke-green-500" />
					</Button>
					<Button
						variant="ghost"
						size={"icon"}
						onClick={() => {
							void api_fetch("/api/outreach/reject", {
								method: "POST",
								body: {
									id: company.id,
								},
							});
							hide(company.id);
						}}
					>
						<X className="h-4 w-4 stroke-rose-500" />
					</Button>
					<ProfileForm company={company} />
				</div>
			);
		},
	},
	{
		accessorKey: "username",
		header: "Username",
		cell: ({ row }) => {
			const username = row.getValue("username") as string;

			return (
				<a
					href={`https://instagram.com/${username}`}
					className="hover:underline"
				>
					{username}
				</a>
			);
		},
	},
	{
		accessorKey: "first_name",
		header: "First Name",
	},
	{
		accessorKey: "business_name",
		header: "Business Name",
	},
	{
		accessorKey: "full_name",
		header: "IG Full Name",
	},
	{
		accessorKey: "country",
		header: "Country",
	},
	{
		accessorKey: "niche",
		header: "Niche",
	},
	{
		accessorKey: "account_created_at",
		header: "Account Created",
	},
	{
		accessorKey: "days_diff",
		header: "Scrape Gap",
		cell: ({ row }) => {
			const diff = row.getValue("days_diff") as number | null;
			return diff ? <div>{diff} days</div> : <div>N/A</div>;
		},
	},
	{
		accessorKey: "followers",
		header: "Followers",
		cell: ({ row }) => {
			const followers = row.getValue("followers") as number | null;
			return <div>{followers}K</div>;
		},
	},
	{
		accessorKey: "followers_diff",
		header: "Followers Diff",
		cell: ({ row }) => {
			const diff = row.getValue("followers_diff") as number | null;

			return diff != null ? (
				diff < 0 ? (
					<span className="text-red-500">
						<ArrowDown className="inline-block mr-1 size-4" />
						{diff}
					</span>
				) : diff > 0 ? (
					<span className="text-green-500">
						<ArrowUp className="inline-block mr-1 size-4" />
						{diff}
					</span>
				) : (
					<span className="text-slate-500">
						<Minus className="inline-block mr-1 size-4" />
						{diff}
					</span>
				)
			) : null;
		},
	},
	{
		accessorKey: "following",
		header: "Following",
	},
	{
		accessorKey: "following_diff",
		header: "Following Diff",
		cell: ({ row }) => {
			const diff = row.getValue("following_diff") as number | null;

			return diff != null ? (
				diff < 0 ? (
					<span className="text-red-500">
						<ArrowDown className="inline-block mr-1 size-4" />
						{diff}
					</span>
				) : diff > 0 ? (
					<span className="text-green-500">
						<ArrowUp className="inline-block mr-1 size-4" />
						{diff}
					</span>
				) : (
					<span className="text-slate-500">
						<Minus className="inline-block mr-1 size-4" />
						{diff}
					</span>
				)
			) : null;
		},
	},
	{
		accessorKey: "post_count",
		header: "Post Count",
	},
	{
		accessorKey: "post_diff",
		header: "Post Count Diff",
	},
	{
		accessorKey: "email",
		header: "Email",
	},
	{
		accessorKey: "lastSentEmail",
		header: "Last Emailed",
		cell: ({ row }) => {
			const last_emailed = row.original.lastSentEmail;
			return (
				<div>
					{last_emailed === null ? "Never" : `${last_emailed} days ago`}
				</div>
			);
		},
	},
	{
		accessorKey: "rank",
		header: "Trigger Rank",
	},
	{
		accessorKey: "source",
		header: "Source",
	},
	{
		accessorKey: "found_on",
		header: "Found On",
	},
];
