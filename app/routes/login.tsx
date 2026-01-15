import { redirect } from "@remix-run/node";
import type { MetaFunction } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/server-runtime";
import { Button } from "~/components/ui/button";
import { api_fetch, api_host } from "~/services/api";

export const meta: MetaFunction = () => {
	return [
		{ title: "Dashboard" },
		{
			name: "description",
			content: "An admin dashboard for Keaz outreach data",
		},
	];
};

const GoogleIcon = () => (
	<div className={"w-4 h-4 fill-background mr-2"}>
		<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<title>Google</title>
			<path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
		</svg>
	</div>
);

export async function loader({ request }: LoaderFunctionArgs) {
	// If the user is already authenticated redirect to /dashboard directly
	const req = await api_fetch("/auth/me", {
		method: "GET",
		headers: {
			cookie: request.headers.get("cookie") ?? "",
		},
	});
	console.log("login error", req.error);
	if (req.data === "Unauthorized" || req.status !== 200) {
		return req.data;
	}
	return redirect("/dashboard");
}

export default function Login() {
	return (
		<div
			className={
				"mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px] h-screen p-6"
			}
		>
			<div className={"flex flex-col space-y-2 text-center"}>
				<h1 className="text-2xl font-semibold tracking-tight">Login</h1>
				<p className={"text-sm text-muted-foreground"}>
					Login with your Google Account
				</p>
			</div>
			<div className={"flex justify-center"}>
				<Button
					onClick={() => {
						window.location.href = `${api_host}/auth/google`;
					}}
				>
					<GoogleIcon /> Login with Google
				</Button>
			</div>
		</div>
	);
}
