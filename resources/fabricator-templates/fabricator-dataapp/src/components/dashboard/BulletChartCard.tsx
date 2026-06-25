//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";

import { resolveColor } from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { warnMissingKeys } from "@/lib/validate";

import { ChartCard } from "./ChartCard";
import type { ChartCardCommonProps } from "./cartesian";
import { TileBody } from "./states";

function toNumber(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

export interface ProgressBarProps {
    /** Current value. */
    value: number;
    /** Scale ceiling (100%). Defaults to `target` (or `100`) when omitted. */
    max?: number;
    /** Optional goal — draws a marker tick and tints the fill (met → success). */
    target?: number;
    /** Left-aligned label. */
    label?: ReactNode;
    /** Fill color — a chart token, role, `var(--…)`, or hex. Overrides the
     *  automatic met/below-target tint. */
    color?: string;
    /** Format for the trailing value text (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Show the formatted value on the right (default true). */
    showValue?: boolean;
    /** Track thickness in px (default 8). */
    height?: number;
    className?: string;
}

/**
 * A single labelled actual-vs-target bar — the primitive behind
 * {@link BulletChartCard}, also handy on its own inside a card for a
 * "progress to goal" row.
 *
 * @example
 * ```tsx
 * <ProgressBar label="Q3 quota" value={82_000} target={100_000} valueFormat="currency" />
 * ```
 */
export function ProgressBar({
    value,
    max,
    target,
    label,
    color,
    valueFormat,
    showValue = true,
    height = 8,
    className,
}: ProgressBarProps) {
    const ceiling = max ?? (target != null ? Math.max(value, target) : 100);
    const fraction = ceiling > 0 ? clamp01(value / ceiling) : 0;
    const targetFraction =
        target != null && ceiling > 0 ? clamp01(target / ceiling) : null;
    const met = target != null && value >= target;
    const fillColor = color
        ? resolveColor(color)
        : target != null
          ? resolveColor(met ? "success" : "chart-1")
          : resolveColor("chart-1");
    const format = resolveFormat(valueFormat);

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {(label != null || showValue) && (
                <div className="flex items-baseline justify-between gap-3 text-sm">
                    {label != null ? (
                        <span className="min-w-0 truncate text-foreground-secondary">
                            {label}
                        </span>
                    ) : (
                        <span />
                    )}
                    {showValue && (
                        <span className="shrink-0 font-numeric tabular-nums text-foreground">
                            {format(toNumber(value))}
                            {target != null && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                    / {format(toNumber(target))}
                                </span>
                            )}
                        </span>
                    )}
                </div>
            )}
            <div
                className="relative w-full overflow-hidden rounded-full"
                style={{
                    height,
                    background: "var(--color-chart-track)",
                }}
            >
                <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                        width: `${fraction * 100}%`,
                        background: fillColor,
                    }}
                />
                {targetFraction != null && (
                    <span
                        className="absolute top-0 h-full w-[2px] -translate-x-1/2 rounded-full"
                        style={{
                            left: `${targetFraction * 100}%`,
                            background: "var(--color-foreground)",
                            opacity: 0.55,
                        }}
                        aria-hidden
                    />
                )}
            </div>
        </div>
    );
}

export interface BulletChartCardProps extends ChartCardCommonProps {
    /** Row objects — one bar per row. */
    data?: Array<Record<string, unknown>>;
    /** Property holding each row's category label. */
    labelKey: string;
    /** Property holding the numeric value. */
    valueKey: string;
    /** Optional property holding the per-row target/goal. */
    targetKey?: string;
    /** Format for the value + target text (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Shared scale ceiling for every bar. Defaults per-row to
     *  `max(value, target)` so each bar uses its own scale. */
    max?: number;
    /** Fill color override — a chart token, role, `var(--…)`, or hex. */
    color?: string;
    /** Track thickness in px (default 8). */
    barHeight?: number;
}

/**
 * Compact actual-vs-target list — a stack of labelled {@link ProgressBar}s for
 * "progress to goal" KPI lists (quota attainment, budget burn, OKRs). Maps a
 * DAX result straight to bars; pass `targetKey` to show goal markers.
 *
 * @example
 * ```tsx
 * <BulletChartCard
 *   title="Quota attainment"
 *   data={rows}
 *   labelKey="rep"
 *   valueKey="bookings"
 *   targetKey="quota"
 *   valueFormat="currency"
 * />
 * ```
 */
export function BulletChartCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    data = [],
    labelKey,
    valueKey,
    targetKey,
    valueFormat,
    max,
    color,
    barHeight = 8,
}: BulletChartCardProps) {
    warnMissingKeys("BulletChartCard", data, [
        labelKey,
        valueKey,
        ...(targetKey ? [targetKey] : []),
    ]);

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
                height={200}
                emptyMessage={emptyMessage}
                onRetry={onRetry}
            >
                <div className="flex flex-col gap-4">
                    {data.map((row, index) => (
                        <ProgressBar
                            key={String(row[labelKey] ?? index)}
                            label={String(row[labelKey] ?? "")}
                            value={toNumber(row[valueKey])}
                            target={
                                targetKey != null
                                    ? toNumber(row[targetKey])
                                    : undefined
                            }
                            max={max}
                            color={color}
                            valueFormat={valueFormat}
                            height={barHeight}
                        />
                    ))}
                </div>
            </TileBody>
        </ChartCard>
    );
}
