"use client";

import { Area, AreaChart, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

export const description = "An interactive area chart";

const chartConfig = (config: string) => ({
	container: {
		label: `${config[1].toUpperCase}${config.slice(1, config.length)}`,
		color: "var(--primary)",
	},
} satisfies ChartConfig);

export function ChartAreaInteractive({ title, tooltip, data}: { title: string, tooltip: string, data: {[key: string]: number}[]}) {
	return (
		<Card className="@container/card w-1/2">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
				<ChartContainer
					config={chartConfig(tooltip)}
					className="aspect-auto h-[200px] w-full"
				>
					<AreaChart data={data}>
						<defs>
							{/** biome-ignore lint/nursery/useUniqueElementIds: <id pra pintar> */}
<linearGradient id="fillNumbers" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-desktop)"
									stopOpacity={1.0}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-desktop)"
									stopOpacity={0.1}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={() => {
										return "";
									}}
									indicator="dot"
								/>
							}
						/>
						<Area
							dataKey={data.length > 1 ? Object.keys(data[0])[0] : "desktop"}
							type="natural"
							fill="url(#fillNumbers)"
							stroke="white"
							stackId="a"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
