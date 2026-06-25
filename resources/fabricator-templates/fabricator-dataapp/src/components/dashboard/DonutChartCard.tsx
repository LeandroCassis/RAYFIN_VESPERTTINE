//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { resolveColor, seriesColor } from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";

import { ChartCard } from "./ChartCard";
import { type ChartCardCommonProps } from "./cartesian";
import { ChartTooltip } from "./ChartTooltip";
import { TileBody } from "./states";

export interface DonutChartCardProps extends ChartCardCommonProps {
    /** Categorical rows: each has a name + a numeric value. */
    data?: Array<Record<string, unknown>>;
    /** Category-name accessor (default `"name"`). */
    nameKey?: string;
    /** Numeric value accessor (default `"value"`). */
    valueKey?: string;
    /** Slice colors — chart tokens / roles / hex. Defaults to the palette. */
    colors?: string[];
    /** Chart height in px (default 280). */
    height?: number;
    /** Value format for the legend + tooltip (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Donut (hole) vs full pie (default true). */
    donut?: boolean;
    /** Custom node for the donut center (defaults to the total). */
    centerLabel?: ReactNode;
    /** Show the category legend with values + share (default true). */
    showLegend?: boolean;
}

/**
 * Categorical share as a donut (or pie) with a value/share legend. The donut
 * center shows the total by default.
 *
 * @example
 * ```tsx
 * <DonutChartCard
 *   title="Sales by channel"
 *   data={rows}
 *   nameKey="channel"
 *   valueKey="sales"
 *   valueFormat="currency"
 * />
 * ```
 */
export function DonutChartCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    data = [],
    nameKey = "name",
    valueKey = "value",
    colors,
    height = 280,
    valueFormat,
    donut = true,
    centerLabel,
    showLegend = true,
}: DonutChartCardProps) {
    const format = resolveFormat(valueFormat);
    const cellColor = (index: number) =>
        colors && colors.length
            ? resolveColor(colors[index % colors.length], index)
            : seriesColor(index);
    const rows = data;
    const total = rows.reduce(
        (sum, row) => sum + (Number(row[valueKey]) || 0),
        0,
    );
    const resolvedCenter =
        donut &&
        (centerLabel ?? (
            <>
                <span className="font-numeric text-lg font-semibold tabular-nums text-foreground">
                    {format(total)}
                </span>
                <span className="text-xs text-muted-foreground">Total</span>
            </>
        ));

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
                isEmpty={rows.length === 0}
                height={height}
                emptyMessage={emptyMessage}
                onRetry={onRetry}
            >
                <div className="flex flex-col items-center gap-5 sm:flex-row">
                    <div
                        className="relative mx-auto shrink-0"
                        style={{ width: height, height, maxWidth: "100%" }}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={rows}
                                    dataKey={valueKey}
                                    nameKey={nameKey}
                                    innerRadius={donut ? "62%" : 0}
                                    outerRadius="92%"
                                    paddingAngle={donut ? 2 : 0}
                                    stroke="var(--color-card)"
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                >
                                    {rows.map((_, index) => (
                                        <Cell
                                            key={index}
                                            fill={cellColor(index)}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={
                                        <ChartTooltip valueFormat={valueFormat} />
                                    }
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {resolvedCenter && (
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                {resolvedCenter}
                            </div>
                        )}
                    </div>

                    {showLegend && (
                        <ul className="flex w-full min-w-0 flex-1 flex-col gap-2">
                            {rows.map((row, index) => {
                                const value = Number(row[valueKey]) || 0;
                                const pct = total > 0 ? (value / total) * 100 : 0;
                                return (
                                    <li
                                        key={index}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <span
                                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                                            style={{ background: cellColor(index) }}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-foreground-secondary">
                                            {String(row[nameKey] ?? "")}
                                        </span>
                                        <span className="font-numeric tabular-nums text-foreground">
                                            {format(value)}
                                        </span>
                                        <span className="w-10 text-right font-mono text-xs text-foreground-muted">
                                            {pct.toFixed(0)}%
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </TileBody>
        </ChartCard>
    );
}

/** Full pie (no center hole) — a thin wrapper over {@link DonutChartCard}. */
export function PieChartCard(props: Omit<DonutChartCardProps, "donut">) {
    return <DonutChartCard donut={false} {...props} />;
}
