/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */

import type {
	ActionFunctionArgs,
	AppLoadContext,
	EntryContext,
	LoaderFunctionArgs,
} from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import isbot from "isbot";
import { renderToReadableStream } from "react-dom/server.browser";

const ABORT_DELAY = 5_000;

export default async function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	loadContext: AppLoadContext,
) {
	const stream = await renderToReadableStream(
		<RemixServer
			context={remixContext}
			url={request.url}
			abortDelay={ABORT_DELAY}
		/>,
		{
			onError(error) {
				responseStatusCode = 500;
			},
		},
	);

	if (isbot(request.headers.get("user-agent"))) {
		await stream.allReady;
	}

	const headers = new Headers(responseHeaders);
	headers.set("Content-Type", "text/html");
	return new Response(stream, {
		headers,
		status: responseStatusCode,
	});
}

export function handleError(
	error: unknown,
	{ request, params, context }: LoaderFunctionArgs | ActionFunctionArgs,
) {
	if (!request.signal.aborted) {
	}
}
