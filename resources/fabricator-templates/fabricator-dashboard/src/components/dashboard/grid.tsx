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

import { ArrowDownRightIcon, ArrowUpRightIcon } from "./icons";

/* ============================ DashboardGrid =========================== *
 * The canvas: one responsive 12-column grid. Drop <Tile size="…"> children
 * in and vary sizes for a non-uniform layout. Static span maps so Tailwind's
 * content scanner emits every span utility.
 * ===================================================================== */

const LG_COL_SPAN: Record<number, string> = {
    1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4",
    5: "lg:col-span-5", 6: "lg:col-span-6", 7: "lg:col-span-7", 8: "lg:col-span-8",
    9: "lg:col-span-9", 10: "lg:col-span-10", 11: "lg:col-span-11", 12: "lg:col-span-12",
};
const LG_ROW_SPAN: Record<number, string> = {
    1: "lg:row-span-1", 2: "lg:row-span-2", 3: "lg:row-span-3",
};
const SM_COL_SPAN: Record<number, string> = { 1: "sm:col-span-1", 2: "sm:col-span-2" };

/** Responsive 12-column grid (1 → sm:2 → lg:12). Vary `<Tile>` sizes inside. */
export function DashboardGrid({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:auto-rows-[minmax(0,auto)]",
                className,
            )}
        >
            {children}
        </div>
    );
}

/** Semantic tile sizes → column / row spans on the 12-col `lg` grid. */
export type TileSize = "sm" | "md" | "lg" | "wide" | "hero" | "full";

const TILE_SIZES: Record<TileSize, { col: number; row?: number }> = {
    sm: { col: 3 }, md: { col: 4 }, lg: { col: 6 }, wide: { col: 8 }, hero: { col: 8, row: 2 }, full: { col: 12 },
};
const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export interface TileProps {
    /** Size preset: `sm`(3) · `md`(4) · `lg`(6) · `wide`(8) · `hero`(8×2) · `full`(12). */
    size?: TileSize;
    /** Explicit column span (1–12 on `lg`) — overrides `size`. */
    colSpan?: number;
    /** Explicit row span (1–3 on `lg`) — overrides `size`. `hero` cards need `className="h-full"`. */
    rowSpan?: number;
    children: ReactNode;
    className?: string;
}

/** A cell in a {@link DashboardGrid}. Add `className="h-full"` to a card inside a `hero` tile. */
export function Tile({ size = "md", colSpan, rowSpan, children, className }: TileProps) {
    const preset = TILE_SIZES[size];
    const col = clampInt(colSpan ?? preset.col, 1, 12);
    const row = clampInt(rowSpan ?? preset.row ?? 1, 1, 3);
    const sm = col >= 6 ? 2 : 1;
    return (
        <div className={cn("flex min-w-0 flex-col", SM_COL_SPAN[sm], LG_COL_SPAN[col], row > 1 && LG_ROW_SPAN[row], className)}>
            {children}
        </div>
    );
}

/* ============================== StatStrip ============================= *
 * One bordered band of metrics divided by hairlines — a header strip that
 * reads as a single unit. Put 2–5 <Stat> items inside.
 * ===================================================================== */

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                "grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0",
                className,
            )}
        >
            {children}
        </div>
    );
}

export interface StatProps {
    label: ReactNode;
    value?: number | string;
    data?: Array<Record<string, unknown>>;
    valueKey?: string;
    valueFormat?: ValueFormat;
    delta?: number;
    invertDelta?: boolean;
    secondary?: ReactNode;
    accent?: string;
    loading?: boolean;
    className?: string;
}

/** A single metric inside a {@link StatStrip}: label, value, optional delta. */
export function Stat({ label, value, data, valueKey, valueFormat, delta, invertDelta, secondary, accent, loading, className }: StatProps) {
    const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
    const derived = data && valueKey ? data[0]?.[valueKey] : undefined;
    const metricValue = value ?? derived;
    const showDelta = typeof delta === "number" && Number.isFinite(delta);
    const direction = !showDelta || delta === 0 ? "flat" : delta > 0 ? "up" : "down";
    const good = direction === "flat" ? null : (direction === "up") !== Boolean(invertDelta);
    const accentColor = accent ? resolveColor(accent) : undefined;
    const valueText = typeof metricValue === "number" ? format(metricValue) : String(metricValue ?? "—");

    return (
        <div className={cn("flex flex-col gap-2 p-5", className)}>
            <div className="flex min-w-0 items-center gap-2">
                {accentColor && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accentColor }} />}
                <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
            </div>
            {loading ? (
                <div className="h-7 w-24 animate-shimmer rounded-md" aria-hidden />
            ) : (
                <div className="flex items-end justify-between gap-2">
                    <span className="block truncate font-display text-[26px] font-bold leading-none tracking-tight text-foreground tabular-nums">{valueText}</span>
                    {showDelta && (
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                good === null ? "bg-muted text-muted-foreground" : good ? "text-success" : "text-destructive",
                            )}
                            style={good === null ? undefined : { background: good ? "var(--color-success-soft)" : "var(--color-destructive-soft)" }}
                        >
                            {direction === "up" && <ArrowUpRightIcon size={12} />}
                            {direction === "down" && <ArrowDownRightIcon size={12} />}
                            {formatDelta(delta as number)}
                        </span>
                    )}
                </div>
            )}
            {secondary && <span className="truncate text-xs text-muted-foreground">{secondary}</span>}
        </div>
    );
}
