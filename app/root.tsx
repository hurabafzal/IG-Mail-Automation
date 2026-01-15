import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useRouteError,
} from "@remix-run/react";

import { cssBundleHref } from "@remix-run/css-bundle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";
import {
	PreventFlashOnWrongTheme,
	ThemeProvider,
	useTheme,
} from "remix-themes";
import { env } from "~/services/env.server";
import { Toaster } from "./components/ui/sonner";
import { themeSessionResolver } from "./sessions.server";
import styles from "./tailwind.css";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: styles },
	...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

// Return the theme from the session storage using the loader
export function loader({ request }: LoaderFunctionArgs) {
	const { getTheme } = themeSessionResolver(request);
	return {
		theme: getTheme(),
		ENV: {
			NODE_ENV: env.NODE_ENV,
		},
	};
}

// Wrap your app with ThemeProvider.
// `specifiedTheme` is the stored theme in the session storage.
// `themeAction` is the action name that's used to change the theme in the session storage.
export default function AppWithProviders() {
	const data = useLoaderData<typeof loader>();
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						networkMode:
							data.ENV.NODE_ENV === "development" ? "always" : "online",
					},
					mutations: {
						networkMode:
							data.ENV.NODE_ENV === "development" ? "always" : "online",
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider
				specifiedTheme={data.theme}
				themeAction="/action/set-theme"
			>
				<App />
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export function ErrorBoundary() {
	const error = useRouteError() as {
		status: number;
		statusText: string;
		data: string;
	};
	return (
		<html lang="en">
			<head>
				<title>Oh no!</title>
				<Meta />
				<Links />
			</head>
			<body>
				<h1>{error.status}</h1>
				<p>{error.statusText}</p>
				<pre>{error.data}</pre>
				<Scripts />
			</body>
		</html>
	);
}

export function App() {
	const data = useLoaderData<typeof loader>();
	const [theme] = useTheme();
	return (
		<html lang="en" className={clsx(theme)}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} />
				<Links />
			</head>
			<body>
				<Outlet />
				<Toaster />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Environment variables are safe to be included in the client
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(data.ENV)}`,
					}}
				/>
				<ScrollRestoration />
				<Scripts />
				<LiveReload />
			</body>
		</html>
	);
}
