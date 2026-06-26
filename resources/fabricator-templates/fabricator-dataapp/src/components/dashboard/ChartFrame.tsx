//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useChartSize } from "./charts/useChartSize";
import type { ChartSize } from "./charts/types";

/**
 * Shared responsive + legend wrapper behind every kit chart card. Owns the
 * `ResizeObserver` sizing and the (static) legend so all cards scale and
 * legend identically with zero per-card duplication.
 *
 * **Sizing.** By default the plot is **aspect-ratio responsive**: its height is
 * derived from the container width (`aspect`) and clamped to
 * `[minHeight, maxHeight]`, so a chart is short on a phone and taller in a wide
 * bento tile — never a fixed pixel height. Pass an explicit `height` to opt out
 * and pin a fixed pixel height (back-compat).
 *
 * **Render prop.** `children` receives the measured `{ width, height }` of the
 * plot box (in CSS px) and returns the custom SVG chart. It is invoked only
 * once the box has a non-zero size. The box is `position: relative`, so a chart
 * can absolutely-position an HTML tooltip overlay inside it.
 */

/** Default width ÷ height ratio for wide charts (line / area / bar / combo). */
export const DEFAULT_ASPECT = 2.2;
/** Lower clamp for responsive chart height (px). */
export const MIN_CHART_HEIGHT = 200;
/** Upper clamp for responsive chart height (px). */
export const MAX_CHART_HEIGHT = 360;

/** Where the legend sits relative to the plot (`"none"` hides it). */
export type LegendPlacement = "top" | "right" | "bottom" | "none";

/** One legend entry: a swatch color, a label, and an optional trailing value. */
export interface LegendItem {
    /** Series label. */
    label: ReactNode;
    /** Resolved swatch color (a `var(--…)` / hex string). */
    color: string;
    /** Optional formatted value shown right-aligned (e.g. a total / latest). */
    value?: ReactNode;
}

export interface ChartFrameProps {
    /** Render prop: receives the measured plot size, returns the SVG chart. */
    children: ReactNode | ((size: ChartSize) => ReactNode);
    /** Fixed pixel height — overrides the responsive aspect sizing. */
    height?: number;
    /** Width/height ratio used when `height` is unset (default {@link DEFAULT_ASPECT}). */
    aspect?: number;
    /** Lower height clamp for aspect mode (default {@link MIN_CHART_HEIGHT}). */
    minHeight?: number;
    /** Upper height clamp for aspect mode (default {@link MAX_CHART_HEIGHT}). */
    maxHeight?: number;
    /** Legend entries; omit or pass an empty array to render no legend. */
    legend?: ReadonlyArray<LegendItem>;
    /** Legend placement (default `"top"`). */
    legendPlacement?: LegendPlacement;
    className?: string;
}

/** Renders the static legend strip/column for a given placement. */
function LegendStrip({
    items,
    placement,
}: {
    items: ReadonlyArray<LegendItem>;
    placement: LegendPlacement;
}) {
    const vertical = placement === "right";
    return (
        <div
            className={cn(
                vertical
                    ? "flex min-w-0 shrink-0 flex-col gap-1.5 self-center"
                    : "flex flex-wrap items-center gap-x-4 gap-y-1",
                placement === "top" && "mb-3",
                placement === "bottom" && "mt-3",
                placement === "right" && "pl-1",
            )}
        >
            {items.map((item, index) => (
                <span
                    key={index}
                    className="inline-flex min-w-0 items-center gap-1.5 text-xs text-foreground-secondary"
                >
                    <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: item.color }}
                    />
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.value != null && (
                        <span className="ml-auto pl-3 font-numeric tabular-nums text-foreground">
                            {item.value}
                        </span>
                    )}
                </span>
            ))}
        </div>
    );
}

/**
 * Wrap a custom SVG chart for responsive sizing + a themed static legend.
 *
 * @example
 * ```tsx
 * <ChartFrame
 *   legend={[{ label: "Revenue", color: seriesColor(0) }]}
 *   legendPlacement="top"
 * >
 *   {({ width, height }) => <MyChartSvg width={width} height={height} />}
 * </ChartFrame>
 * ```
 */
export function ChartFrame({
    children,
    height,
    aspect = DEFAULT_ASPECT,
    minHeight = MIN_CHART_HEIGHT,
    maxHeight = MAX_CHART_HEIGHT,
    legend,
    legendPlacement = "top",
    className,
}: ChartFrameProps) {
    const showLegend =
        legendPlacement !== "none" && legend != null && legend.length > 0;
    const { ref, size } = useChartSize();

    // Fixed height when provided; otherwise aspect-driven + clamped.
    const plotStyle: CSSProperties =
        height != null
            ? { height }
            : { aspectRatio: String(aspect), minHeight, maxHeight };

    const renderChild = () => {
        if (size.width <= 0 || size.height <= 0) return null;
        return typeof children === "function" ? children(size) : children;
    };

    const plot = (
        <div ref={ref} className="relative w-full" style={plotStyle}>
            {renderChild()}
        </div>
    );

    if (showLegend && legendPlacement === "right") {
        return (
            <div className={cn("flex w-full items-stretch gap-4", className)}>
                <div className="min-w-0 flex-1">{plot}</div>
                <LegendStrip items={legend} placement="right" />
            </div>
        );
    }

    return (
        <div className={cn("w-full", className)}>
            {showLegend && legendPlacement === "top" && (
                <LegendStrip items={legend} placement="top" />
            )}
            {plot}
            {showLegend && legendPlacement === "bottom" && (
                <LegendStrip items={legend} placement="bottom" />
            )}
        </div>
    );
}
