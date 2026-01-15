import { useState } from "react";
import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Sector,
} from "recharts";
import type { ActiveShape } from "recharts/types/util/types";

type PieSectorDataItem = {
	percent: number;
	name: string;
	payload: {
		name: string;
		value: number;
		percent: number;
	};
	midAngle: number;
	cx: number;
	cy: number;
	fill: string;
	value: number;
	innerRadius: number;
	outerRadius: number;
	startAngle: number;
	endAngle: number;
};

const renderActiveShape = ({
	cx,
	cy,
	midAngle,
	innerRadius,
	outerRadius,
	startAngle,
	endAngle,
	fill,
	payload,
	percent,
	value,
}: PieSectorDataItem) => {
	const RADIAN = Math.PI / 180;
	const sin = Math.sin(-RADIAN * midAngle);
	const cos = Math.cos(-RADIAN * midAngle);
	const sx = cx + (outerRadius + 10) * cos;
	const sy = cy + (outerRadius + 10) * sin;
	const mx = cx + (outerRadius + 30) * cos;
	const my = cy + (outerRadius + 30) * sin;
	const ex = mx + (cos >= 0 ? 1 : -1) * 5;
	const ey = my;
	const textAnchor = cos >= 0 ? "start" : "end";

	return (
		<g>
			<text
				x={cx}
				y={cy}
				dy={8}
				textAnchor="middle"
				className="fill-foreground"
				fontSize={12}
			>
				{payload.name}
			</text>
			<Sector
				cx={cx}
				cy={cy}
				innerRadius={innerRadius}
				outerRadius={outerRadius}
				startAngle={startAngle}
				endAngle={endAngle}
				fill={fill}
			/>
			<Sector
				cx={cx}
				cy={cy}
				startAngle={startAngle}
				endAngle={endAngle}
				innerRadius={outerRadius + 6}
				outerRadius={outerRadius + 10}
				className="fill-foreground"
			/>
			<path
				d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
				className="stroke-foreground"
				fill="none"
			/>
			<circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
			<text
				x={ex + (cos >= 0 ? 1 : -1) * 12}
				y={ey}
				textAnchor={textAnchor}
				fill="#333"
				className="fill-foreground"
			>{`${value}`}</text>
			<text
				x={ex + (cos >= 0 ? 1 : -1) * 12}
				y={ey}
				dy={18}
				textAnchor={textAnchor}
				className="fill-muted-foreground"
				fontSize={12}
			>
				{`${(percent * 100).toFixed(2)}%`}
			</text>
		</g>
	);
};
// 8 colors for the pie chart
const colors = ["#F87171", "#FBBF24", "#FCD34D", "#86EFAC", "#9CA3AF"];

export function EmailPieChart({
	data,
}: {
	data: { name: string; value: number; percent: number }[];
}) {
	const [activeIndex, setActiveIndex] = useState(0);
	return (
		<div>
			<ResponsiveContainer width="80%" className={"m-auto"} height={350}>
				<PieChart>
					<Pie
						activeIndex={activeIndex}
						dataKey="value"
						nameKey="name"
						data={data}
						innerRadius={50}
						outerRadius={100}
						startAngle={90}
						endAngle={450}
						activeShape={renderActiveShape as ActiveShape}
						onMouseEnter={(_, index) => setActiveIndex(index)}
					>
						{data.map((entry, index) => (
							<Cell
								key={`cell-${entry.name}`}
								fill={colors[index % colors.length]}
							/>
						))}
					</Pie>
					<Legend
						formatter={(value, entry) => (
							<span color={entry.color} className={"text-xs"}>
								{value}
							</span>
						)}
					/>
				</PieChart>
			</ResponsiveContainer>
		</div>
	);
}
