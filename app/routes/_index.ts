import { type LoaderFunction, redirect } from "@remix-run/node";

export const loader: LoaderFunction = ({ request }) => {
	return redirect("/dashboard");
};
