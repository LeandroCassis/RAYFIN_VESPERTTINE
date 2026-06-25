//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
    Funnel,
    FunnelChart,
    LabelList,
    Tooltip,
} from "recharts";

import { seriesColor, useChartTheme } from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { warnMissingKeys } from "@/lib/validate";

import { ChartCard } from "./ChartCard";
import { ChartFrame } from "./ChartFrame";
import { type ChartCardCommonProps } from "./cartesian";
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

interface FunnelTooltipEntry {
    payload?: unknown;
}

interface FunnelTooltipProps {
    active?: boolean;
    payload?: ReadonlyArray<FunnelTooltipEntry>;
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
    const theme = useChartTheme();
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
                    <FunnelChart>
                        <Tooltip
                            content={
                                <FunnelTooltip showConversion={showConversion} />
                            }
                        />
                        <Funnel
                            dataKey={valueKey}
                            nameKey="name"
                            data={rows}
                            stroke="var(--color-card)"
                            strokeWidth={2}
                            isAnimationActive={false}
                        >
                            <LabelList
                                position="right"
                                dataKey="name"
                                fill={theme.foreground}
                                fontSize={12}
                            />
                            <LabelList
                                position="center"
                                dataKey="summaryLabel"
                                fill={theme.foregroundMuted}
                                fontSize={11}
                            />
                        </Funnel>
                    </FunnelChart>
                </ChartFrame>
            </TileBody>
        </ChartCard>
    );
}

function FunnelTooltip({
    active,
    payload,
    showConversion,
}: FunnelTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;
    const row = readDatum(payload[0]?.payload);
    if (!row) return null;

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

function readDatum(payload: unknown): FunnelDatum | undefined {
    if (isFunnelDatum(payload)) return payload;
    if (!payload || typeof payload !== "object") return undefined;
    const nested = (payload as { payload?: unknown }).payload;
    return isFunnelDatum(nested) ? nested : undefined;
}

function isFunnelDatum(value: unknown): value is FunnelDatum {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
        typeof record.name === "string" &&
        typeof record.value === "number" &&
        typeof record.valueLabel === "string" &&
        typeof record.summaryLabel === "string" &&
        typeof record.fill === "string"
    );
}
