//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { motion, useReducedMotion } from "framer-motion";

import { seriesColor, useChartTheme } from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { warnMissingKeys } from "@/lib/validate";

import { ChartCard } from "./ChartCard";
import { ChartFrame } from "./ChartFrame";
import { type ChartCardCommonProps } from "./cartesian";
import { tooltipBoxStyle, useChartTooltip } from "./charts/tooltip";
import { type ChartSize } from "./charts/types";
import { TileBody } from "./states";

export interface FunnelChartCardProps extends ChartCardCommonProps {
    /** Ordered stage rows — one per funnel step. */
    data?: Array<Record<string, unknown>>;
    /** Property used for the stage/category label. */
    stageKey: string;
    /** Numeric measure used for each funnel segment. */
    valueKey: string;
    /** Value format for labels + tooltip (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Fixed plot height in px; omit for responsive aspect sizing. */
    height?: number;
    /** Width/height ratio used when `height` is unset (default 1.8). */
    aspect?: number;
    /** Sort stages descending by value (default true). */
    sort?: boolean;
    /** Show conversion as % of the first/top stage (default true). */
    showConversion?: boolean;
}

interface FunnelDatum extends Record<string, unknown> {
    name: string;
    value: number;
    valueLabel: string;
    conversion?: string;
    summaryLabel: string;
    fill: string;
}

interface FunnelPlotProps {
    size: ChartSize;
    rows: FunnelDatum[];
    showConversion: boolean;
}

/**
 * Conversion funnel — ordered stages sized by value, with palette-stepped
 * segments and optional conversion labels (% of the first stage). Use it for
 * lead → opportunity → win, visit → signup → activation, or similar flows.
 *
 * @example
 * ```tsx
 * <FunnelChartCard
 *   title="Pipeline conversion"
 *   data={rows}
 *   stageKey="Stage"
 *   valueKey="Accounts"
 *   valueFormat="compact"
 * />
 * ```
 */
export function FunnelChartCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    data = [],
    stageKey,
    valueKey,
    valueFormat,
    height,
    aspect,
    sort = true,
    showConversion = true,
}: FunnelChartCardProps) {
    const format = resolveFormat(valueFormat);
    const values = data.map((row) => {
        const rawValue = Number(row[valueKey]);
        const value = Number.isFinite(rawValue) ? rawValue : 0;
        return {
            name: String(row[stageKey] ?? ""),
            value,
        };
    });
    const ordered = sort
        ? [...values].sort((a, b) => b.value - a.value)
        : values;
    const firstValue = ordered[0]?.value ?? 0;
    const rows: FunnelDatum[] = ordered.map((row, index) => {
        const valueLabel = format(row.value);
        const conversion =
            showConversion && firstValue > 0
                ? `${Math.round((row.value / firstValue) * 100)}%`
                : undefined;
        return {
            ...row,
            [stageKey]: row.name,
            [valueKey]: row.value,
            valueLabel,
            conversion,
            summaryLabel: conversion ? `${valueLabel} • ${conversion}` : valueLabel,
            fill: seriesColor(index),
        };
    });

    warnMissingKeys("FunnelChartCard", data, [stageKey, valueKey]);

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
                <ChartFrame height={height} aspect={aspect ?? 1.8}>
                    {(size) => (
                        <FunnelPlot
                            size={size}
                            rows={rows}
                            showConversion={showConversion}
                        />
                    )}
                </ChartFrame>
            </TileBody>
        </ChartCard>
    );
}

function FunnelPlot({ size, rows, showConversion }: FunnelPlotProps) {
    const theme = useChartTheme();
    const reduce = useReducedMotion();
    const tooltip = useChartTooltip();

    const { width, height } = size;
    const margin = { top: 8, right: 64, bottom: 8, left: 12 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const n = rows.length;
    if (innerW <= 0 || innerH <= 0 || n === 0) return null;

    const gap = 6;
    const segH = (innerH - gap * (n - 1)) / n;
    if (segH <= 0) return null;

    const cx = margin.left + innerW / 2;
    const maxValue = rows[0]?.value ?? 0;
    const halfWidth = (index: number) =>
        maxValue > 0 ? (innerW / 2) * (rows[index].value / maxValue) : 0;
    const active = tooltip.state;
    const activeRow = active != null ? rows[active.index] : undefined;

    return (
        <>
            <svg
                width={width}
                height={height}
                role="img"
                className="overflow-visible"
            >
                {rows.map((row, index) => {
                    const top = margin.top + index * (segH + gap);
                    const bottom = top + segH;
                    const midY = top + segH / 2;
                    const topHW = halfWidth(index);
                    const botHW =
                        index < n - 1 ? halfWidth(index + 1) : topHW;
                    const points = [
                        `${cx - topHW},${top}`,
                        `${cx + topHW},${top}`,
                        `${cx + botHW},${bottom}`,
                        `${cx - botHW},${bottom}`,
                    ].join(" ");

                    return (
                        <g key={`${row.name}-${index}`}>
                            <motion.polygon
                                points={points}
                                fill={row.fill}
                                stroke="var(--color-card)"
                                strokeWidth={2}
                                initial={reduce ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.05 }}
                            />
                            <text
                                x={cx}
                                y={midY}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={11}
                                fill={theme.foregroundMuted}
                                pointerEvents="none"
                            >
                                {row.summaryLabel}
                            </text>
                            <text
                                x={margin.left + innerW + 8}
                                y={midY}
                                textAnchor="start"
                                dominantBaseline="central"
                                fontSize={12}
                                fill={theme.foreground}
                            >
                                {row.name}
                            </text>
                            <rect
                                x={margin.left}
                                y={top}
                                width={innerW}
                                height={segH}
                                fill="transparent"
                                onPointerMove={() =>
                                    tooltip.show(index, cx, midY)
                                }
                                onPointerLeave={tooltip.hide}
                            />
                        </g>
                    );
                })}
            </svg>
            {active != null && activeRow && (
                <div style={tooltipBoxStyle(active.x, active.y, width)}>
                    <FunnelTooltip
                        row={activeRow}
                        showConversion={showConversion}
                    />
                </div>
            )}
        </>
    );
}

function FunnelTooltip({
    row,
    showConversion,
}: {
    row: FunnelDatum;
    showConversion: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-lg border border-border-strong bg-popover/95 px-3 py-2 text-xs shadow-sm backdrop-blur",
            )}
        >
            <div className="mb-1.5 font-mono text-[11px] text-foreground-muted">
                {row.name}
            </div>
            <div className="flex items-center gap-2">
                <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: row.fill }}
                />
                <span className="ml-auto pl-4 font-numeric tabular-nums text-foreground">
                    {row.valueLabel}
                </span>
            </div>
            {showConversion && row.conversion && (
                <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0" />
                    <span className="ml-auto pl-4 font-mono text-foreground-muted">
                        {row.conversion}
                    </span>
                </div>
            )}
        </div>
    );
}
