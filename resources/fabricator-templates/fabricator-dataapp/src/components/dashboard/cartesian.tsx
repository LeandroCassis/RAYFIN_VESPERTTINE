//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactElement, ReactNode } from "react";
import { useId } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {
    axisProps,
    barCursor,
    gridProps,
    lineCursor,
    referenceLineProps,
    resolveColor,
    useChartTheme,
} from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";

import { ChartTooltip } from "./ChartTooltip";

/** One plotted measure. The model maps DAX rows → array and lists series. */
export interface SeriesConfig {
    /** Property on each row to plot. */
    key: string;
    /** Legend / tooltip label (defaults to `key`). */
    label?: string;
    /** Color — a chart token (`chart-1`), role, `var(--…)`, or hex.
     *  Defaults to the Nth color of the chart palette. */
    color?: string;
    /** Group id for stacked bars/areas. */
    stackId?: string;
}

/** Props shared by every chart card shell (title, state handling). */
export interface ChartCardCommonProps {
    title?: ReactNode;
    subtitle?: ReactNode;
    /** Right-aligned header slot (filters, legend, menu). */
    action?: ReactNode;
    className?: string;
    /** Render the loading skeleton. */
    loading?: boolean;
    /** Render the error tile when set. */
    error?: unknown;
    /** Message for the empty (no-rows) state. */
    emptyMessage?: ReactNode;
    /** Retry handler shown on the error tile. */
    onRetry?: () => void;
}

export interface CartesianChartProps {
    type: "line" | "area" | "bar";
    /** Row objects — map your DAX result into these. */
    data?: Array<Record<string, unknown>>;
    /** Property used for the X axis (category / time). */
    xKey: string;
    /** One or more measures to plot. */
    series: SeriesConfig[];
    /** Bar layout (default "vertical"). Use "horizontal" for ranked bars. */
    layout?: "vertical" | "horizontal";
    /** Plot height in px (default 280). */
    height?: number;
    /** Y-axis + tooltip value format (default `"number"`). */
    valueFormat?: ValueFormat;
    /** X-axis tick formatter (e.g. `formatDate`). */
    xFormat?: (value: string | number) => string;
    /** Toggle the horizontal gridlines (default true). */
    showGrid?: boolean;
    /** Toggle the legend (default: on when >1 series). */
    showLegend?: boolean;
    /** Stack bars / areas (default false). */
    stacked?: boolean;
    /** Line/area interpolation (default `"monotone"`). */
    curve?: "monotone" | "linear" | "natural" | "step";
    /** Horizontal marker lines (avg / target). */
    referenceLines?: ReadonlyArray<{ y: number; label?: string }>;
}

/** Compact legend strip rendered above multi-series charts. */
export function ChartLegend({
    series,
    colors,
}: {
    series: SeriesConfig[];
    colors: string[];
}) {
    return (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {series.map((entry, index) => (
                <span
                    key={entry.key}
                    className="inline-flex items-center gap-1.5 text-xs text-foreground-secondary"
                >
                    <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: colors[index] }}
                    />
                    {entry.label ?? entry.key}
                </span>
            ))}
        </div>
    );
}

/**
 * Shared renderer behind `LineChartCard` / `AreaChartCard` / `BarChartCard`.
 * Owns the ResponsiveContainer, themed axes/grid/tooltip/cursor, optional
 * legend, gradients, dark-mode, and number/date formatting — so the public
 * cards stay declarative. Not exported from the kit barrel; use the cards.
 */
export function CartesianChart({
    type,
    data = [],
    xKey,
    series,
    layout = "vertical",
    height = 280,
    valueFormat,
    xFormat,
    showGrid = true,
    showLegend,
    stacked,
    curve = "monotone",
    referenceLines,
}: CartesianChartProps) {
    const theme = useChartTheme();
    const uid = useId();
    const formatValue = resolveFormat(valueFormat);
    const colors = series.map((entry, index) => resolveColor(entry.color, index));
    const legend = showLegend ?? series.length > 1;
    const isHorizontalBar = type === "bar" && layout === "horizontal";

    if (import.meta.env.DEV) {
        validateChartKeys(data, xKey, series);
    }

    const common: ReactNode[] = [
        showGrid ? <CartesianGrid key="grid" {...gridProps(theme)} /> : null,
        <XAxis
            key="x"
            dataKey={xKey}
            {...axisProps(theme)}
            minTickGap={24}
            tickFormatter={
                xFormat ? (value) => xFormat(value as string | number) : undefined
            }
        />,
        <YAxis
            key="y"
            {...axisProps(theme)}
            width={48}
            tickFormatter={(value) => formatValue(Number(value))}
        />,
        <Tooltip
            key="tip"
            cursor={type === "bar" ? barCursor(theme) : lineCursor(theme)}
            content={
                <ChartTooltip valueFormat={valueFormat} labelFormat={xFormat} />
            }
        />,
        ...(referenceLines?.map((line, index) => (
            <ReferenceLine
                key={`ref-${index}`}
                y={line.y}
                {...referenceLineProps(theme)}
                label={
                    line.label
                        ? {
                              value: line.label,
                              position: "insideTopRight",
                              fill: theme.foregroundMuted,
                              fontSize: 11,
                          }
                        : undefined
                }
            />
        )) ?? []),
    ];

    const horizontalBarCommon: ReactNode[] = [
        showGrid ? (
            <CartesianGrid
                key="grid"
                {...gridProps(theme)}
                vertical
                horizontal={false}
            />
        ) : null,
        <XAxis
            key="x"
            type="number"
            {...axisProps(theme)}
            tickFormatter={(value) => formatValue(Number(value))}
        />,
        <YAxis
            key="y"
            type="category"
            dataKey={xKey}
            {...axisProps(theme)}
            width={112}
            tickFormatter={
                xFormat ? (value) => xFormat(value as string | number) : undefined
            }
        />,
        <Tooltip
            key="tip"
            cursor={barCursor(theme)}
            content={
                <ChartTooltip valueFormat={valueFormat} labelFormat={xFormat} />
            }
        />,
    ];

    let chart: ReactElement;
    if (type === "line") {
        chart = (
            <LineChart data={data}>
                {common}
                {series.map((entry, index) => (
                    <Line
                        key={entry.key}
                        type={curve}
                        dataKey={entry.key}
                        name={entry.label ?? entry.key}
                        stroke={colors[index]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        isAnimationActive={false}
                    />
                ))}
            </LineChart>
        );
    } else if (type === "area") {
        chart = (
            <AreaChart data={data}>
                <defs>
                    {series.map((entry, index) => (
                        <linearGradient
                            key={entry.key}
                            id={`${uid}-${index}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={colors[index]}
                                stopOpacity={0.28}
                            />
                            <stop
                                offset="100%"
                                stopColor={colors[index]}
                                stopOpacity={0.02}
                            />
                        </linearGradient>
                    ))}
                </defs>
                {common}
                {series.map((entry, index) => (
                    <Area
                        key={entry.key}
                        type={curve}
                        dataKey={entry.key}
                        name={entry.label ?? entry.key}
                        stroke={colors[index]}
                        strokeWidth={2}
                        fill={`url(#${uid}-${index})`}
                        fillOpacity={1}
                        stackId={
                            stacked ? (entry.stackId ?? "stack") : entry.stackId
                        }
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        isAnimationActive={false}
                    />
                ))}
            </AreaChart>
        );
    } else {
        chart = (
            <BarChart data={data} layout={isHorizontalBar ? "vertical" : undefined}>
                {isHorizontalBar ? horizontalBarCommon : common}
                {series.map((entry, index) => (
                    <Bar
                        key={entry.key}
                        dataKey={entry.key}
                        name={entry.label ?? entry.key}
                        fill={colors[index]}
                        stackId={
                            stacked ? (entry.stackId ?? "stack") : entry.stackId
                        }
                        radius={isHorizontalBar ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                        maxBarSize={isHorizontalBar ? 32 : 48}
                        isAnimationActive={false}
                    />
                ))}
            </BarChart>
        );
    }

    return (
        <div className="w-full">
            {legend && <ChartLegend series={series} colors={colors} />}
            <ResponsiveContainer width="100%" height={height}>
                {chart}
            </ResponsiveContainer>
        </div>
    );
}

function validateChartKeys(
    data: Array<Record<string, unknown>>,
    xKey: string,
    series: SeriesConfig[],
) {
    if (!data.length) return;
    const availableKeys = Object.keys(data[0] ?? {});
    const available = availableKeys.length ? availableKeys.join(", ") : "(none)";
    if (!availableKeys.includes(xKey)) {
        console.warn(
            `[CartesianChart] xKey="${xKey}" is missing from mapped rows. Available keys: ${available}`,
        );
    }
    series.forEach((entry) => {
        if (!availableKeys.includes(entry.key)) {
            console.warn(
                `[CartesianChart] series key "${entry.key}" is missing from mapped rows. Available keys: ${available}`,
            );
        }
    });
}
