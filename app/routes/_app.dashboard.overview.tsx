import { useQuery } from "@tanstack/react-query";
import {
	Ban,
	Clock,
	Instagram,
	LucideMail,
	Target,
	TrendingUp,
	Users,
} from "lucide-react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import CountsPerDayChart from "~/components/CountsPerDayChart";
import { EmailPieChart } from "~/components/EmailDistribution";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { api_fetch } from "~/services/api";

const defaultCounts = [
	{ title: "Accounts Mined", value: 0, change: "loading...", Icon: Instagram },
	{ title: "target list", value: 0, change: "loading...", Icon: Target },
	{ title: "Active Targets", value: 0, change: "loading...", Icon: LucideMail },
	{ title: "not on cooldown", value: 0, change: "loading...", Icon: Clock },
];

const formatNumber = (num: number) => {
	return new Intl.NumberFormat().format(num);
};

function InfoCards() {
	const { data: counts } = useQuery(["dashboard-overview-counts"], async () => {
		const r = await api_fetch("/api/dashboard/overview/counts", {
			method: "GET",
		});
		if (r.status === 200 && r.data) {
			return r.data;
		}
		return null;
	});

	const data = counts
		? [
				{
					title: "Accounts Mined",
					value: counts.usernames,
					change: "",
					Icon: Instagram,
				},
				{
					title: "target lists",
					value: counts.targets,
					change: `${((counts.targets / counts.usernames) * 100).toFixed(
						2,
					)}% of accounts`,
					Icon: Target,
				},
				{
					title: "Active Targets",
					value: counts.active_targets,
					change: `${((counts.active_targets / counts.usernames) * 100).toFixed(
						2,
					)}% of accounts`,
					Icon: LucideMail,
				},
				{
					title: "not on cooldown",
					value: counts.not_cooldown,
					change: `${((counts.not_cooldown / counts.usernames) * 100).toFixed(
						2,
					)}% of accounts`,
					Icon: Clock,
				},
			]
		: defaultCounts;

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{data.map(({ title, value, change, Icon }) => (
				<Card key={`${title}`}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">{title}</CardTitle>
						<Icon className={"w-4 h-4 text-muted-foreground"} />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatNumber(value ?? 0)}</div>
						<p className="text-xs text-muted-foreground">{change}</p>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function EmailDistributionCard() {
	const { data: emailPieData } = useQuery(
		["dashboard-overview-email-distribution"],
		async () => {
			const r = await api_fetch("/api/dashboard/overview/email-distribution", {
				method: "GET",
			});
			if (r.status === 200 && r.data) {
				return r.data;
			}
			return [];
		},
	);

	return (
		<Card className="col-span-3">
			<CardHeader>
				<CardTitle>Email Verification Status</CardTitle>
				<CardDescription>
					breakdown of email verification statuses for all emails
				</CardDescription>
			</CardHeader>
			<CardContent className="pl-2">
				<EmailPieChart data={emailPieData ?? []} />
			</CardContent>
		</Card>
	);
}

function DailyCountsCard() {
	const [year, setYear] = useState(new Date().getFullYear());
	const [month, setMonth] = useState(new Date().getMonth() + 1);

	const { data: barData } = useQuery(
		["dashboard-overview-daily-counts", year, month],
		async () => {
			const r = await api_fetch("/api/dashboard/overview/daily-counts", {
				method: "GET",
				query: { year, month },
			});
			if (r.status === 200 && r.data) {
				return r.data;
			}
			return [];
		},
	);

	return (
		<Card className="col-span-3">
			<CardHeader>
				<CardTitle>Emailable Accounts Mined Per Day</CardTitle>
			</CardHeader>
			<CardContent>
				<CountsPerDayChart
					data={barData ?? []}
					onDateChange={(y, m) => {
						setYear(y);
						setMonth(m);
					}}
				/>
			</CardContent>
		</Card>
	);
}

function CountryCountsCard() {
	const [year, setYear] = useState(new Date().getFullYear());
	const [month, setMonth] = useState(new Date().getMonth() + 1);

	const {
		data: barDataCountries,
		error,
		isError,
	} = useQuery(["dashboard-overview-country-counts", year, month], async () => {
		const r = await api_fetch("/api/dashboard/overview/country-counts", {
			method: "GET",
			query: { year, month },
		});
		if (r.status === 200 && r.data) {
			return r.data;
		}
		throw new Error("Failed to load country data");
	});

	return (
		<Card className="col-span-3">
			<CardHeader>
				<CardTitle>Target Country Accounts Mined Per Day</CardTitle>
				<CardDescription>
					{isError ? (
						<span className="text-destructive">
							Error loading country data: {JSON.stringify(error)}
						</span>
					) : barDataCountries ? (
						"Number of accounts found that are marked as from Germany, Austria, or Switzerland. Note that only target accounts are checked for their country"
					) : (
						"Loading country data..."
					)}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<CountsPerDayChart
					data={barDataCountries ?? []}
					onDateChange={(y, m) => {
						setYear(y);
						setMonth(m);
					}}
				/>
			</CardContent>
		</Card>
	);
}

function AllCountsCard() {
	const [year, setYear] = useState(new Date().getFullYear());
	const [month, setMonth] = useState(new Date().getMonth() + 1);

	const { data: barDataAll } = useQuery(
		["dashboard-overview-all-counts", year, month],
		async () => {
			console.log("fetching all counts", year, month);
			const r = await api_fetch("/api/dashboard/overview/all-counts", {
				method: "GET",
				query: { year, month },
			});
			console.log("all counts fetched", r);
			if (r.status === 200 && r.data) {
				return r.data;
			}
			return [];
		},
	);

	return (
		<Card className="col-span-3">
			<CardHeader>
				<CardTitle>All Accounts Mined Per Day</CardTitle>
				<CardDescription>No filters</CardDescription>
			</CardHeader>
			<CardContent>
				<CountsPerDayChart
					data={barDataAll ?? []}
					onDateChange={(y, m) => {
						setYear(y);
						setMonth(m);
					}}
				/>
			</CardContent>
		</Card>
	);
}

function LeadsMetricCards() {
	const { data: counts } = useQuery(["dashboard-leads-counts"], async () => {
		const r = await api_fetch("/api/dashboard/leads/counts", {
			method: "GET",
		});
		if (r.status === 200 && r.data) {
			return r.data;
		}
		return null;
	});

	const defaultCards = [
		{
			title: "Total Leads",
			value: 0,
			change: "loading...",
			Icon: Users,
		},
		{
			title: "Not on Cooldown",
			value: 0,
			change: "loading...",
			Icon: Clock,
		},
		{
			title: "Blacklisted",
			value: 0,
			change: "loading...",
			Icon: Ban,
		},
		{
			title: "Avg Contacts per Lead",
			value: 0,
			change: "loading...",
			Icon: TrendingUp,
		},
	];

	const data = counts
		? [
				{
					title: "Total Leads",
					value: counts.total,
					change: "",
					Icon: Users,
				},
				{
					title: "Not on Cooldown",
					value: counts.not_cooldown,
					change: counts.total
						? `${((counts.not_cooldown / counts.total) * 100).toFixed(2)}% of total`
						: "",
					Icon: Clock,
				},
				{
					title: "Blacklisted",
					value: counts.blacklisted,
					change: counts.total
						? `${((counts.blacklisted / counts.total) * 100).toFixed(2)}% of total`
						: "",
					Icon: Ban,
				},
				{
					title: "Avg Contacts per Lead",
					value: counts.avg_contacts.toFixed(2),
					change: "Average outreaches",
					Icon: TrendingUp,
				},
			]
		: defaultCards;

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{data.map(({ title, value, change, Icon }) => (
				<Card key={title}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">{title}</CardTitle>
						<Icon className="w-4 h-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{typeof value === "number" ? formatNumber(value) : value}
						</div>
						<p className="text-xs text-muted-foreground">{change}</p>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function CountryBreakdownTable() {
	const { data: countryData } = useQuery(
		["dashboard-leads-by-country"],
		async () => {
			const r = await api_fetch("/api/dashboard/leads/by-country", {
				method: "GET",
			});
			if (r.status === 200 && r.data) {
				return r.data;
			}
			return [];
		},
	);

	if (!countryData || countryData.length === 0) {
		return (
			<Card className="col-span-6">
				<CardHeader>
					<CardTitle>Leads by Country</CardTitle>
					<CardDescription>Loading country data...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-muted-foreground">No data available</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="col-span-6">
			<CardHeader>
				<CardTitle>Leads by Country</CardTitle>
				<CardDescription>
					Breakdown of leads metrics by country (first name + email)
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Country</TableHead>
							<TableHead className="text-right">Total</TableHead>
							<TableHead className="text-right">Not Cooldown</TableHead>
							<TableHead className="text-right">Blacklisted</TableHead>
							<TableHead className="text-right">Avg Contacts</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{countryData.map((row) => (
							<TableRow key={row.country}>
								<TableCell className="font-medium">{row.country}</TableCell>
								<TableCell className="text-right">
									{formatNumber(row.total)}
								</TableCell>
								<TableCell className="text-right">
									{formatNumber(row.not_cooldown)}
								</TableCell>
								<TableCell className="text-right">
									{formatNumber(row.blacklisted)}
								</TableCell>
								<TableCell className="text-right">
									{row.avg_contacts.toFixed(2)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

function CampaignPerformanceChart() {
	const { data: campaignData } = useQuery(
		["dashboard-leads-by-campaign"],
		async () => {
			const r = await api_fetch("/api/dashboard/leads/by-campaign", {
				method: "GET",
			});
			if (r.status === 200 && r.data) {
				return r.data;
			}
			return [];
		},
	);

	if (!campaignData || campaignData.length === 0) {
		return (
			<Card className="col-span-6">
				<CardHeader>
					<CardTitle>Campaign Performance by Country</CardTitle>
					<CardDescription>Loading campaign data...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-muted-foreground">No data available</div>
				</CardContent>
			</Card>
		);
	}

	// Group data by country and campaign
	const groupedData: Record<string, Record<string, number>> = {};
	const countries = new Set<string>();
	const campaigns = new Set<string>();

	for (const row of campaignData) {
		if (!groupedData[row.country]) {
			groupedData[row.country] = {};
		}
		groupedData[row.country][row.campaign] = row.count;
		countries.add(row.country);
		campaigns.add(row.campaign);
	}

	const chartData = Array.from(countries).map((country) => {
		const data: Record<string, string | number> = { country };
		for (const campaign of Array.from(campaigns)) {
			data[campaign] = groupedData[country]?.[campaign] ?? 0;
		}
		return data;
	});

	const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#8dd1e1"];

	return (
		<Card className="col-span-6">
			<CardHeader>
				<CardTitle>Campaign Performance by Country</CardTitle>
				<CardDescription>
					Number of leads in each campaign stage by country
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={400}>
					<BarChart
						data={chartData}
						margin={{ bottom: 10, left: 5, right: 5, top: 5 }}
					>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="country" />
						<YAxis />
						<Tooltip />
						<Legend />
						{Array.from(campaigns).map((campaign, index) => (
							<Bar
								key={campaign}
								dataKey={campaign}
								fill={colors[index % colors.length]}
							/>
						))}
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}

function DailyLeadsChart() {
	const [days, setDays] = useState(30);
	const [hiddenCountries, setHiddenCountries] = useState<Set<string>>(
		new Set(),
	);

	const { data: dailyData } = useQuery(
		["dashboard-leads-daily", days],
		async () => {
			const r = await api_fetch("/api/dashboard/leads/daily", {
				method: "GET",
				query: { days },
			});
			if (r.status === 200 && r.data) {
				return r.data;
			}
			return [];
		},
	);

	if (!dailyData || dailyData.length === 0) {
		return (
			<Card className="col-span-6">
				<CardHeader>
					<CardTitle>New Leads Over Time</CardTitle>
					<CardDescription>Loading daily data...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-muted-foreground">No data available</div>
				</CardContent>
			</Card>
		);
	}

	// Group by date and country
	const groupedData: Record<string, Record<string, number>> = {};
	const countries = new Set<string>();
	const dates = new Set<string>();

	for (const row of dailyData) {
		if (!groupedData[row.date]) {
			groupedData[row.date] = {};
		}
		groupedData[row.date][row.country] = row.count;
		dates.add(row.date);
		countries.add(row.country);
	}

	// Format dates to show only date part (YYYY-MM-DD)
	const formatDate = (dateStr: string): string => {
		// Extract just the date part (YYYY-MM-DD) if it's a full timestamp
		const dateOnly = dateStr.split("T")[0]?.split(" ")[0] || dateStr;
		// Format as MM/DD for display
		const [year, month, day] = dateOnly.split("-");
		if (year && month && day) {
			return `${month}/${day}`;
		}
		return dateOnly;
	};

	const chartData = Array.from(dates)
		.sort()
		.map((date) => {
			const data: Record<string, string | number> = {
				date: formatDate(date),
				dateFull: date, // Keep original for sorting/grouping
			};
			for (const country of Array.from(countries)) {
				data[country] = groupedData[date]?.[country] ?? 0;
			}
			return data;
		});

	const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#8dd1e1"];

	return (
		<Card className="col-span-6">
			<CardHeader>
				<CardTitle>New Leads Over Time</CardTitle>
				<CardDescription>
					Number of new leads found per day by country (click country in legend
					to toggle visibility)
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="mb-4 flex gap-4">
					<Select
						value={String(days)}
						onValueChange={(v) => setDays(Number(v))}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Select period" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="30">Last 30 days</SelectItem>
							<SelectItem value="60">Last 60 days</SelectItem>
							<SelectItem value="90">Last 90 days</SelectItem>
							<SelectItem value="180">Last 180 days</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<ResponsiveContainer width="100%" height={400}>
					<AreaChart
						data={chartData}
						margin={{ bottom: 10, left: 5, right: 5, top: 5 }}
					>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="date" />
						<YAxis />
						<Tooltip
							labelFormatter={(label) => {
								// Find the original date from chartData
								const item = chartData.find((d) => d.date === label);
								if (item?.dateFull) {
									const [year, month, day] =
										(item.dateFull as string).split("T")[0]?.split(" ") || [];
									if (year && month && day) {
										return `Date: ${month}/${day}/${year}`;
									}
									return `Date: ${label}`;
								}
								return `Date: ${label}`;
							}}
						/>
						<Legend
							onClick={(value) => {
								const country =
									typeof value === "string" ? value : String(value);
								if (country) {
									setHiddenCountries((prev) => {
										const newSet = new Set(prev);
										if (newSet.has(country)) {
											newSet.delete(country);
										} else {
											newSet.add(country);
										}
										return newSet;
									});
								}
							}}
							wrapperStyle={{ cursor: "pointer" }}
						/>
						{Array.from(countries).map((country, index) => {
							const isHidden = hiddenCountries.has(country);
							return (
								<Area
									key={country}
									type="monotone"
									dataKey={country}
									stackId="1"
									stroke={colors[index % colors.length]}
									fill={colors[index % colors.length]}
									hide={isHidden}
								/>
							);
						})}
					</AreaChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}

export default function Index() {
	return (
		<div className="flex flex-col space-y-4 w-full">
			<InfoCards />
			<div className="grid xl:gap-4 gap-y-4 md:grid-cols-2 xl:grid-cols-6 w-full">
				<EmailDistributionCard />
				<DailyCountsCard />
				<CountryCountsCard />
				<AllCountsCard />
			</div>
			{/* Leads Dashboard Section */}
			<div className="mt-8">
				<h3 className="text-2xl font-bold tracking-tight mb-4">
					Leads Dashboard
				</h3>
				<LeadsMetricCards />
				<div className="grid xl:gap-4 gap-y-4 md:grid-cols-2 xl:grid-cols-6 w-full mt-4">
					<CountryBreakdownTable />
				</div>
				<div className="grid xl:gap-4 gap-y-4 md:grid-cols-2 xl:grid-cols-6 w-full mt-4">
					<CampaignPerformanceChart />
				</div>
				<div className="grid xl:gap-4 gap-y-4 md:grid-cols-2 xl:grid-cols-6 w-full mt-4">
					<DailyLeadsChart />
				</div>
			</div>
		</div>
	);
}
