import React from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export interface MeterChartDataPoint {
    period: string; // Timestamp or Period Label
    amount: number; // For Bar (Reconciliation Cost approximation or raw usage)
    meterReading?: number; // For Line (Meter Reading value)
    isDiscontinuous?: boolean;
}

interface MeterAnalysisChartProps {
    data: MeterChartDataPoint[];
    metricLabel: string;
    meterNumber: string;
    height?: number;
    showLegend?: boolean;
    isKvaMetric?: boolean;
}

export function MeterAnalysisChart({
    data,
    metricLabel,
    meterNumber,
    height = 400,
    showLegend = true,
    isKvaMetric = false,
}: MeterAnalysisChartProps) {

    const chartConfig = {
        amount: {
            label: "Consumption",
            color: "hsl(var(--primary))",
        },
        meterReading: {
            label: "Reading Value",
            color: "hsl(var(--chart-3))",
        }
    };

    return (
        <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={data}
                    margin={{ top: 10, right: 80, left: 50, bottom: 70 }}
                >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                    />
                    <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11 }}
                        label={{
                            value: metricLabel,
                            angle: -90,
                            position: 'insideLeft',
                            style: { textAnchor: 'middle' },
                        }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {showLegend && <Legend />}

                    <Bar
                        yAxisId="left"
                        dataKey="amount"
                        fill="var(--color-amount)"
                        radius={[4, 4, 0, 0]}
                        name="Consumption"
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
}
