import React, { useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Label,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";

const CountsPerDayChart = ({
	data,
	onDateChange,
}: {
	data: { date: string; count: number }[];
	onDateChange?: (year: number, month: number) => void;
}) => {
	const [selectedDate, setSelectedDate] = useState(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
			2,
			"0",
		)}`;
	});

	// Generate date options for the next 24 months
	const dateOptions = useMemo(() => {
		const options = [];
		for (let year = 2024; year <= 2025; year++) {
			for (let month = 1; month <= 12; month++) {
				options.push({
					value: `${year}-${String(month).padStart(2, "0")}`,
					label: new Date(year, month - 1).toLocaleString("default", {
						month: "long",
						year: "numeric",
					}),
				});
			}
		}
		return options;
	}, []);

	// Filter data based on the selected date
	const { chartData, max } = useMemo(() => {
		const [year, month] = selectedDate.split("-").map(Number);
		const filteredData = data.filter((entry) => {
			const [entryYear, entryMonth] = entry.date.split("-");
			return (
				Number.parseInt(entryMonth, 10) === month &&
				Number.parseInt(entryYear, 10) === year
			);
		});

		// Create an array for all days in the month
		const daysInMonth = new Date(year, month, 0).getDate();
		const allDays = Array.from({ length: daysInMonth }, (_, i) => ({
			date: String(i + 1).padStart(2, "0"),
			count: 0,
		}));

		// Fill in the actual data
		for (const entry of filteredData) {
			const day = entry.date.split("-")[2];
			const dayIndex = Number.parseInt(day, 10) - 1;
			if (dayIndex >= 0 && dayIndex < daysInMonth) {
				allDays[dayIndex].count = entry.count;
			}
		}

		// Calculate max rounded to next almost order of magnitude
		const dataMax = Math.max(...allDays.map((d) => d.count));
		const orderOfMagnitude = 10 ** Math.floor(Math.log10(dataMax));
		const niceMax =
			Math.ceil(dataMax / (orderOfMagnitude / 5)) * (orderOfMagnitude / 5);

		return {
			chartData: allDays,
			max: Math.max(niceMax, 200),
		};
	}, [selectedDate, data]);

	return (
		<div>
			<div className="mb-4 flex gap-4">
				<Select
					value={selectedDate}
					onValueChange={(value) => {
						setSelectedDate(value);
						const [year, month] = value.split("-").map(Number);
						onDateChange?.(year, month);
					}}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Select date" />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectLabel>Date</SelectLabel>
							{dateOptions.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</div>
			<ResponsiveContainer width="100%" height={400}>
				<BarChart
					data={chartData}
					margin={{ bottom: 10, left: 5, right: 5, top: 5 }}
				>
					<CartesianGrid
						strokeDasharray="3 3"
						horizontal={true}
						vertical={false}
					/>
					<XAxis dataKey="date" interval={0}>
						<Label value="Day" position="insideBottom" offset={-7} />
					</XAxis>
					<YAxis
						domain={[0, max]}
						// tickCount={8}
						// allowDecimals={false}
					/>
					<Tooltip />
					<Bar dataKey="count" fill="#8884d8" />
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
};

export default CountsPerDayChart;
