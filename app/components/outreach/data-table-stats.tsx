import {
	AccessorColumnDef,
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react"; // Add icons

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";

type NewType = unknown;

interface RowData {
	stat_date?: string;
	mp_name?: string;
	[key: string]: NewType;
}

interface DataTableProps<TData extends RowData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	columnVisibility: Record<string, boolean>;
	data: TData[];
	status: string;
}

export function DataTable<TData extends RowData, TValue>({
	columns,
	data,
	status,
	columnVisibility,
}: DataTableProps<TData, TValue>) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		state: {
			columnVisibility,
		},
	});

	const is_loading = status === "loading";

	return (
		<ScrollArea className="h-[calc(100vh-5rem)] w-[calc(100vw-5.5rem)] rounded-xl flex flex-col p-2 m-2 border bg-muted/10 transition-colors">
			<Table className="p-3">
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => {
								return (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody className={"whitespace-nowrap"}>
					{table.getRowModel().rows?.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
							>
								{row.getVisibleCells().map((cell) => {
									const rowData = row.original;
									const isStatDateEmpty = !rowData.stat_date;
									const isMpNameEmpty = !rowData.mp_name;
									const value = cell.getValue();

									// Only show arrow for numeric columns except "mp_name" and "stat_date"
									const cellColumnId = cell.column.id;
									const showArrow =
										typeof value === "number" &&
										value !== 0 &&
										cellColumnId !== "mp_name" &&
										cellColumnId !== "stat_date" &&
										(isStatDateEmpty || isMpNameEmpty);

									const isPositive = showArrow ? value > 0 : false;

									return (
										<TableCell
											key={cell.id}
											className={
												showArrow
													? isPositive
														? "bg-green-100 text-green-700"
														: "bg-red-100 text-red-700"
													: ""
											}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
											{showArrow &&
												(isPositive ? (
													<ArrowUp
														className="inline ml-2 text-green-700"
														size={16}
													/>
												) : (
													<ArrowDown
														className="inline ml-2 text-red-700"
														size={16}
													/>
												))}
										</TableCell>
									);
								})}
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className={cn(
									"h-24 text-center",
									is_loading && "animate-pulse",
								)}
							>
								{is_loading ? "Loading..." : "No Results"}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
			<ScrollBar orientation="horizontal" />
		</ScrollArea>
	);
}
