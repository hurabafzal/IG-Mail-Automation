import { type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Outlet, useLocation } from "@remix-run/react";
import { ScrollArea } from "~/components/ui/scroll-area";

export const loader = ({ request }: LoaderFunctionArgs) => {
	// if path is exactly /dashboard, redirect to /dashboard/overview
	const url = new URL(request.url);
	if (url.pathname === "/dashboard" || url.pathname === "/dashboard/") {
		return redirect("/dashboard/overview");
	}
	return null;
};

// some interesting ideas for dashboard cards:
// number of domains
// number of domains with a verified email
// number of domains with active ads
// number of domains that have read an email
// two types of event logs

export default function DataMining() {
	const { pathname } = useLocation();
	const tab = pathname.split("/")[2];
	console.log("tab:", tab);

	return (
		<ScrollArea className="w-full">
			<div className="flex-1 space-y-6 p-8 pt-6 w-full">
				<h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
				<Outlet />
				<div className="flex flex-col space-y-4" />
			</div>
		</ScrollArea>
	);
}
