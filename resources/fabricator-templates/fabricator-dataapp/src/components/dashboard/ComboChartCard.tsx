//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceLine,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { autoAxisWidth, inferXFormat } from "@/lib/auto-format";
import {
    axisProps,
    barCursor,
    gridProps,
    referenceLineProps,
    resolveColor,
    useChartTheme,
} from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { warnMissingKeys } from "@/lib/validate";

import { ChartCard } from "./ChartCard";
import { ChartFrame } from "./ChartFrame";
import type { LegendPlacement } from "./ChartFrame";
import { type ChartCardCommonProps, type SeriesConfig } from "./cartesian";
import { ChartTooltip } from "./ChartTooltip";
import { TileBody } from "./states";

export interface ComboChartCardProps extends ChartCardCommonProps {
    /** Row objects — one per x value, carrying every bar + line measure. */
    data?: Array<Record<string, unknown>>;
    /** Property used for the X axis (category / time). */
    xKey: string;
    /** Measures drawn as bars (left axis). */
    bars?: SeriesConfig[];
    /** Measures drawn as lines (right axis when `rightAxis`, else left). */
    lines?: SeriesConfig[];
    /** Fixed pixel height; omit for responsive aspect height (default). */
    height?: number;
    /** Width/height ratio used when `height` is unset (default from `ChartFrame`). */
    aspect?: number;
    /** Legend placement around the responsive chart frame (default `"top"`). */
    legendPlacement?: LegendPlacement;
    /** Left-axis (bars) value format + tooltip default (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Right-axis (lines) value format (defaults to `valueFormat`). */
    rightValueFormat?: ValueFormat;
    /** Put the lines on a secondary right Y axis. Defaults to `true` when the
     *  card has both bars and lines (the classic dual-axis combo). */
    rightAxis?: boolean;
    /** X-axis tick formatter (e.g. `formatDate`). */
    xFormat?: (value: string | number) => string;
    /** Toggle the horizontal gridlines (default true). */
    showGrid?: boolean;
    /** Toggle the legend (default: on when >1 total series). */
    showLegend?: boolean;
    /** Stack the bars (default false). */
    stacked?: boolean;
    /** Line interpolation (default `"monotone"`). */
    curve?: "monotone" | "linear" | "natural" | "step";
    /** Horizontal marker lines on the left axis (avg / target). */
    referenceLines?: ReadonlyArray<{ y: number; label?: string }>;
}

/**
 * Combo chart — bars plus line(s), with an optional **dual Y axis** so a
 * different-unit trend (e.g. a margin %) overlays value bars (e.g. revenue)
 * without being flattened. Same declarative, themed contract as the other
 * chart cards: map your DAX result, declare `bars` + `lines`, pass data.
 *
 * @example
 * ```tsx
 * <ComboChartCard
 *   title="Revenue & margin"
 *   data={rows}
 *   xKey="Month"
 *   bars={[{ key: "Revenue", label: "Revenue", color: "chart-1" }]}
 *   lines={[{ key: "Margin", label: "Margin %", color: "chart-4" }]}
 *   valueFormat="currency"
 *   rightValueFormat="percent"
 * />
 * ```
 */
export function ComboChartCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    data = [],
    xKey,
    bars = [],
    lines = [],
    height,
    aspect,
    legendPlacement = "top",
    valueFormat,
    rightValueFormat,
    rightAxis,
    xFormat,
    showGrid = true,
    showLegend,
    stacked,
    curve = "monotone",
    referenceLines,
}: ComboChartCardProps) {
    const theme = useChartTheme();
    const barColors = bars.map((entry, index) => resolveColor(entry.color, index));
    const lineColors = lines.map((entry, index) =>
        resolveColor(entry.color, bars.length + index),
    );
    const leftFormat = resolveFormat(valueFormat);
    const rightFormat = resolveFormat(rightValueFormat ?? valueFormat);
    const resolvedXFormat = xFormat ?? inferXFormat(data, xKey);
    const useRightAxis = rightAxis ?? (bars.length > 0 && lines.length > 0);
    const lineAxisId = useRightAxis ? "right" : "left";
    const legend = showLegend ?? bars.length + lines.length > 1;
    const leftValues = data.flatMap((row) =>
        bars.map((entry) => Number(row[entry.key])),
    );
    const rightValues = data.flatMap((row) =>
        lines.map((entry) => Number(row[entry.key])),
    );
    const leftAxisWidth = autoAxisWidth(leftValues, leftFormat);
    const rightAxisWidth = autoAxisWidth(rightValues, rightFormat);

    warnMissingKeys("ComboChartCard", data, [
        xKey,
        ...bars.map((entry) => entry.key),
        ...lines.map((entry) => entry.key),
    ]);

    // Per-series tooltip formats so bars/lines read in their own axis's units.
    const seriesFormats: Record<string, ValueFormat> = {};
    if (valueFormat) {
        for (const entry of bars) {
            seriesFormats[entry.key] = valueFormat;
            if (entry.label) seriesFormats[entry.label] = valueFormat;
        }
    }
    const rightFmt = rightValueFormat ?? valueFormat;
    if (rightFmt) {
        for (const entry of lines) {
            seriesFormats[entry.key] = rightFmt;
            if (entry.label) seriesFormats[entry.label] = rightFmt;
        }
    }

    const legendSeries: SeriesConfig[] = [...bars, ...lines];
    const legendColors = [...barColors, ...lineColors];
    const legendItems = legend
        ? legendSeries.map((entry, index) => ({
              label: entry.label ?? entry.key,
              color: legendColors[index],
          }))
        : undefined;

    return (
        <ChartCard
            title={title}
            subtitle={subtitle}
            action={action}
            className={className}
        >
            <TileBody
                loading={loading}
                error={error}
                isEmpty={data.length === 0}
                height={height}
                emptyMessage={emptyMessage}
                onRetry={onRetry}
            >
                <ChartFrame
                    height={height}
                    aspect={aspect}
                    legend={legendItems}
                    legendPlacement={legendPlacement}
                >
                    <ComposedChart data={data}>
                        {showGrid && <CartesianGrid {...gridProps(theme)} />}
                        <XAxis
                            dataKey={xKey}
                            {...axisProps(theme)}
                            minTickGap={24}
                            tickFormatter={
                                resolvedXFormat
                                    ? (value) =>
                                          resolvedXFormat(value as string | number)
                                    : undefined
                            }
                        />
                        <YAxis
                            yAxisId="left"
                            {...axisProps(theme)}
                            width={leftAxisWidth}
                            tickFormatter={(value) => leftFormat(Number(value))}
                        />
                        {useRightAxis && (
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                {...axisProps(theme)}
                                width={rightAxisWidth}
                                tickFormatter={(value) =>
                                    rightFormat(Number(value))
                                }
                            />
                        )}
                        <Tooltip
                            cursor={barCursor(theme)}
                            content={
                                <ChartTooltip
                                    valueFormat={valueFormat}
                                    seriesFormats={seriesFormats}
                                    labelFormat={resolvedXFormat}
                                />
                            }
                        />
                        {referenceLines?.map((line, index) => (
                            <ReferenceLine
                                key={`ref-${index}`}
                                yAxisId="left"
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
                        ))}
                        {bars.map((entry, index) => (
                            <Bar
                                key={entry.key}
                                yAxisId="left"
                                dataKey={entry.key}
                                name={entry.label ?? entry.key}
                                fill={barColors[index]}
                                stackId={
                                    stacked
                                        ? (entry.stackId ?? "stack")
                                        : entry.stackId
                                }
                                radius={[4, 4, 0, 0]}
                                maxBarSize={48}
                                isAnimationActive={false}
                            />
                        ))}
                        {lines.map((entry, index) => (
                            <Line
                                key={entry.key}
                                yAxisId={lineAxisId}
                                type={curve}
                                dataKey={entry.key}
                                name={entry.label ?? entry.key}
                                stroke={lineColors[index]}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                isAnimationActive={false}
                            />
                        ))}
                    </ComposedChart>
                </ChartFrame>
            </TileBody>
        </ChartCard>
    );
}
