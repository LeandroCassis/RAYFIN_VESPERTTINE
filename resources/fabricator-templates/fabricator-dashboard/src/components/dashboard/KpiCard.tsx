//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";
import { useMemo } from "react";

import { resolveColor } from "@/lib/chartTokens";
import { formatDelta, resolveFormat, type ValueFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

import { cardClass, type CardVariant } from "./card-style";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "./icons";
import { EmptyTile, ErrorTile, KpiSkeleton } from "./states";

export interface KpiCardProps {
    /** Metric name (rendered as a small uppercase label). */
    label: ReactNode;
    /** The metric value — numbers are formatted with `valueFormat`. */
    value?: number | string;
    /** Rows used to derive the metric when `value` is not provided. */
    data?: Array<Record<string, unknown>>;
    /** Property read from the first row in `data` when deriving the metric. */
    valueKey?: string;
    /** Format applied when `value` is a number (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Optional small, muted value rendered below the primary metric. */
    secondary?: ReactNode;
    /** Percent change vs a baseline; its sign drives the colored pill. */
    delta?: number;
    /** Caption under the value, e.g. "vs last month". */
    deltaLabel?: ReactNode;
    /** Flip delta colors when down-is-good (cost, latency, churn…). */
    invertDelta?: boolean;
    /** Accent dot color — a chart token, role, `var(--…)`, or hex. */
    accent?: string;
    /** Flat surface treatment (default `"surface"`). Use `"feature"` for a hero metric. */
    variant?: CardVariant;
    /** Optional trailing icon. */
    icon?: ReactNode;
    loading?: boolean;
    error?: unknown;
    /** Message for the empty (no value) state. */
    emptyMessage?: ReactNode;
    /** Retry handler shown on the error tile. */
    onRetry?: () => void;
    className?: string;
}

/**
 * Metric tile: a big formatted value and an optional colored delta pill. Pass a
 * literal `value` (inline data) or `data` + `valueKey` (a query result). Pass raw
 * `loading` / `error` and the card renders the right state.
 *
 * @example
 * ```tsx
 * <KpiCard label="Revenue" value={1284000} valueFormat="currency" delta={12.4} deltaLabel="vs last month" accent="chart-1" />
 * ```
 */
export function KpiCard({
    label,
    value,
    data,
    valueKey,
    valueFormat,
    secondary,
    delta,
    deltaLabel,
    invertDelta,
    accent,
    icon,
    loading,
    error,
    emptyMessage,
    onRetry,
    className,
    variant,
}: KpiCardProps) {
    const derived = data && valueKey ? data[0]?.[valueKey] : undefined;
    const metricValue = value ?? derived;
    const isEmpty = value === undefined && (data?.length === 0 || derived == null);
    const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);

    if (loading) return <KpiSkeleton className={className} />;
    if (error != null)
        return (
            <div className={cardClass(variant, className)}>
                <ErrorTile error={error} title="Couldn't load" height={96} onRetry={onRetry} />
            </div>
        );
    if (isEmpty)
        return (
            <div className={cardClass(variant, className)}>
                <EmptyTile message={emptyMessage} height={96} />
            </div>
        );

    const isNumericValue = typeof metricValue === "number";
    const valueText = isNumericValue ? format(metricValue) : String(metricValue ?? "");

    const showDelta = typeof delta === "number" && Number.isFinite(delta);
    const direction = !showDelta || delta === 0 ? "flat" : delta > 0 ? "up" : "down";
    const good = direction === "flat" ? null : (direction === "up") !== Boolean(invertDelta);
    const accentColor = accent ? resolveColor(accent) : undefined;

    return (
        <section className={cn("flex flex-col gap-3", cardClass(variant, className))}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    {accentColor && (
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: accentColor }}
                        />
                    )}
                    <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                    </span>
                </div>
                {icon && <div className="shrink-0 text-foreground-muted">{icon}</div>}
            </div>

            <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <span className="block truncate font-display text-[32px] font-bold leading-none tracking-tight text-foreground tabular-nums">
                        {valueText}
                    </span>
                    {secondary && (
                        <span className="mt-1 block truncate text-sm text-muted-foreground tabular-nums">
                            {secondary}
                        </span>
                    )}
                </div>
                {showDelta && (
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            good === null
                                ? "bg-muted text-muted-foreground"
                                : good
                                  ? "text-success"
                                  : "text-destructive",
                        )}
                        style={
                            good === null
                                ? undefined
                                : {
                                      background: good
                                          ? "var(--color-success-soft)"
                                          : "var(--color-destructive-soft)",
                                  }
                        }
                    >
                        {direction === "up" && <ArrowUpRightIcon size={12} />}
                        {direction === "down" && <ArrowDownRightIcon size={12} />}
                        {formatDelta(delta as number)}
                    </span>
                )}
            </div>

            {deltaLabel && <p className="text-xs text-muted-foreground">{deltaLabel}</p>}
        </section>
    );
}
