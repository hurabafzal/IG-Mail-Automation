import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";
import type { UserAttributes } from "backend/src/export";
import {
	BarChart2,
	Contact,
	Filter,
	Home,
	type LucideIcon,
	MessageSquare,
	Pickaxe,
	Siren,
	Users,
	Variable,
} from "lucide-react";
import { ModeToggle } from "~/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { api_fetch } from "~/services/api";

export const meta: MetaFunction = () => {
	return [
		{ title: "Dashboard" },
		{ name: "description", content: "Keaz Internal Outreach Dashboard" },
	];
};

// loader
export async function loader({ request }: LoaderFunctionArgs) {
	const req = await api_fetch("/auth/me", {
		headers: {
			cookie: request.headers.get("cookie") ?? "",
		},
	});
	if (!req.data || req.data === "Unauthorized") {
		return redirect("/login");
	}
	return { user: req.data };
}

export function UserNav({ user }: { user: UserAttributes }) {
	// return type of loader
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-8 w-8 rounded-full">
					<Avatar className="h-8 w-8">
						<AvatarImage src={user.pfp} alt={user.username} />
						<AvatarFallback>{user.username?.charAt(0)}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end" forceMount>
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none">{user.username}</p>
						<p className="text-xs leading-none text-muted-foreground">
							{user.email}
						</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem className={"p-0"}>
					<Link to={"/logout"} className={"w-full h-full px-2 py-1.5"}>
						Log out
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

interface PageButtonProps {
	path: string;
	Icon: LucideIcon;
}

function PageButton({ path, Icon }: PageButtonProps) {
	return (
		<NavLink
			to={path}
			className={({ isActive }) =>
				cn(
					"text-sm font-medium transition-colors hover:text-secondary-foreground",
					!isActive && "text-muted-foreground",
				)
			}
		>
			<Button variant={"ghost"} size={"icon"}>
				<Icon className="h-[1.2rem] w-[1.2rem] my-auto" />
			</Button>
		</NavLink>
	);
}

const whitelist = [
	"youcef@highonlikes.com",
	"nils@highonlikes.com",
	"youcef@startviral.de",
	"nils@startviral.de",
	"ali.rehan2842@gmail.com",

];

export default function Index() {
	const { user } = useLoaderData<typeof loader>();
	return (
		<div className="h-screen w-screen flex">
			<div className="h-full w-14 border-r grid grid-col justify-center p-4">
				<div>
					<UserNav user={user} />
				</div>
				<div className="space-y-2 my-auto">
					<PageButton Icon={Home} path="/dashboard" />
					<PageButton Icon={Siren} path="/triggers" />
					<PageButton Icon={Variable} path="/email/settings" />
					<PageButton Icon={Contact} path="/approve" />
					{whitelist.includes(user.email ?? "") && (
						<PageButton Icon={Users} path="/clone" />
					)}
					<PageButton Icon={Pickaxe} path="/mine" />

					<PageButton Icon={MessageSquare} path="/prompts" />
					<PageButton Icon={BarChart2} path="/stats" />
					<PageButton Icon={Filter} path="/keywords-trigger" />
				</div>
				<div className="mt-auto">
					<ModeToggle />
				</div>
			</div>
			<Outlet />
		</div>
	);
}
