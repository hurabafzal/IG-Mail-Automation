import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import type { MetaFunction } from "@remix-run/react";
import { api_fetch } from "~/services/api";

export const meta: MetaFunction = () => {
	return [
		{ title: "Dashboard" },
		{
			name: "description",
			content: "An admin dashboard for Keaz outreach data",
		},
	];
};

export async function loader({ request }: LoaderFunctionArgs) {
	// If the user is already authenticated redirect to /dashboard directly
	await api_fetch("/auth/logout", {
		method: "POST",
		headers: {
			cookie: request.headers.get("cookie") ?? "",
		},
	});
	const headers = new Headers();
	headers.append(
		"Set-Cookie",
		"google_ouath_state=deleted; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
	);
	headers.append(
		"Set-Cookie",
		"auth_session=deleted; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
	);

	return redirect("/login", {
		headers: headers,
	});
}
