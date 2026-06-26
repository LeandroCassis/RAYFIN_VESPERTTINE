//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { resolveColor, seriesColor } from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";

import { ChartCard } from "./ChartCard";
import type { ChartCardCommonProps } from "./cartesian";
import type { LegendPlacement } from "./ChartFrame";
import { ChartTooltip } from "./ChartTooltip";
import { arcCentroid, arcPath, pieSlices } from "./charts/arc";
import { tooltipBoxStyle, useChartTooltip } from "./charts/tooltip";
import { useChartSize } from "./charts/useChartSize";
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
    /** Maximum donut size in px (default 280); the chart scales down responsively. */
    height?: number;
    /** Value format for the legend + tooltip (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Donut (hole) vs full pie (default true). */
    donut?: boolean;
    /** Custom node for the donut center (defaults to the total). */
    centerLabel?: ReactNode;
    /**
     * Category legend placement with values + share (default `"right"`).
     *
     * @example
     * ```tsx
     * <DonutChartCard title="Mix" data={rows} legendPlacement="bottom" />
     * ```
     */
    legendPlacement?: LegendPlacement;
    /**
     * Back-compat legend visibility switch. When `false`, overrides
     * `legendPlacement` and hides the legend.
     *
     * @example
     * ```tsx
     * <DonutChartCard title="Mix" data={rows} showLegend={false} />
     * ```
     */
    showLegend?: boolean;
}

/** Measured custom-SVG donut/pie with hover tooltip. */
function DonutSvg({
    rows,
    nameKey,
    valueKey,
    donut,
    cellColor,
    valueFormat,
}: {
    rows: Array<Record<string, unknown>>;
    nameKey: string;
    valueKey: string;
    donut: boolean;
    cellColor: (index: number) => string;
    valueFormat?: ValueFormat;
}) {
    const { ref, size } = useChartSize();
    const tooltip = useChartTooltip();
    const reduce = useReducedMotion();

    const width = size.width;
    const height = size.height;
    const radius = Math.max(0, Math.min(width, height) / 2);
    const outer = radius * 0.96;
    const inner = donut ? radius * 0.62 : 0;
    const values = rows.map((row) => Number(row[valueKey]) || 0);
    const slices = pieSlices(values, { padAngle: donut ? 0.018 : 0 });
    const active = tooltip.state;

    return (
        <div ref={ref} className="absolute inset-0">
            {width > 0 && height > 0 && (
                <svg width={width} height={height} role="img">
                    <g transform={`translate(${width / 2},${height / 2})`}>
                        {slices.map((slice, index) => (
                            <motion.path
                                key={index}
                                d={arcPath({
                                    innerRadius: inner,
                                    outerRadius: outer,
                                    startAngle: slice.startAngle,
                                    endAngle: slice.endAngle,
                                    cornerRadius: donut ? 3 : 0,
                                })}
                                fill={cellColor(index)}
                                stroke="var(--color-card)"
                                strokeWidth={2}
                                initial={reduce ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.4, delay: index * 0.04 }}
                                style={{ cursor: "default" }}
                                onPointerEnter={() => {
                                    const [cx, cy] = arcCentroid({
                                        innerRadius: inner,
                                        outerRadius: outer,
                                        startAngle: slice.startAngle,
                                        endAngle: slice.endAngle,
                                    });
                                    tooltip.show(
                                        index,
                                        width / 2 + cx,
                                        height / 2 + cy,
                                    );
                                }}
                                onPointerLeave={tooltip.hide}
                            />
                        ))}
                    </g>
                </svg>
            )}
            {active != null && rows[active.index] && (
                <div style={tooltipBoxStyle(active.x, active.y, width)}>
                    <ChartTooltip
                        active
                        label={String(rows[active.index][nameKey] ?? "")}
                        payload={[
                            {
                                name: String(rows[active.index][nameKey] ?? ""),
                                value: Number(rows[active.index][valueKey]),
                                color: cellColor(active.index),
                            },
                        ]}
                        valueFormat={valueFormat}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Categorical share as a donut (or pie) with a value/share legend — a fully
 * custom SVG (no charting library). The donut center shows the total by
 * default.
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
    legendPlacement = "right",
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
    const placement = showLegend === false ? "none" : legendPlacement;
    const layoutClass =
        placement === "right"
            ? "flex flex-col items-center gap-5 sm:flex-row"
            : "flex flex-col items-center gap-5";
    const pie = (
        <div
            className="relative mx-auto aspect-square w-full shrink-0"
            style={{ maxWidth: height }}
        >
            <DonutSvg
                rows={rows}
                nameKey={nameKey}
                valueKey={valueKey}
                donut={donut}
                cellColor={cellColor}
                valueFormat={valueFormat}
            />
            {resolvedCenter && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    {resolvedCenter}
                </div>
            )}
        </div>
    );
    const legend =
        placement !== "none" ? (
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
        ) : null;

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
                {placement === "none" ? (
                    pie
                ) : (
                    <div className={layoutClass}>
                        {placement === "top" && legend}
                        {pie}
                        {placement !== "top" && legend}
                    </div>
                )}
            </TileBody>
        </ChartCard>
    );
}

/** Full pie (no center hole) — a thin wrapper over {@link DonutChartCard}. */
export function PieChartCard(props: Omit<DonutChartCardProps, "donut">) {
    return <DonutChartCard donut={false} {...props} />;
}
