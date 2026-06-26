//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from "react";

import { resolveFormat, type ValueFormat } from "@/lib/format";

interface TooltipEntry {
    name?: number | string;
    value?: number | string | ReadonlyArray<number | string>;
    color?: string;
    dataKey?: number | string;
}

export interface ChartTooltipProps {
    /** Whether the tooltip is showing (set by the chart's hover state). */
    active?: boolean;
    /** The hovered series rows: `{ name, value, dataKey?, color? }`. */
    payload?: ReadonlyArray<TooltipEntry>;
    /** The hovered category/axis label. */
    label?: number | string;
    /** Formats each series value (defaults to `"number"`). */
    valueFormat?: ValueFormat;
    /** Optional per-series value formats, keyed by series `dataKey` or label.
     *  Falls back to `valueFormat` — used by dual-axis charts (e.g. combo) so
     *  each series formats with its own axis's units. */
    seriesFormats?: Record<string, ValueFormat>;
    /** Formats the axis label (e.g. a date). */
    labelFormat?: (label: number | string) => ReactNode;
}

/**
 * Themed tooltip shared by every kit chart. The custom SVG chart core tracks
 * the hovered mark with `useChartTooltip()` and renders this inside a
 * positioned overlay (`tooltipBoxStyle(x, y, width)`), passing `active` /
 * `payload` / `label`. The kit chart cards wire this up automatically, so apps
 * only touch it in the [escape hatch](../../.agents/skills/visuals/SKILL.md).
 *
 * @example
 * ```tsx
 * const tip = useChartTooltip();
 * // …on a mark: onMouseMove={() => tip.show(index, x, y)}
 * {tip.state && (
 *   <div style={tooltipBoxStyle(tip.state.x, tip.state.y, width)}>
 *     <ChartTooltip active payload={payload} label={label} valueFormat="currency" />
 *   </div>
 * )}
 * ```
 */
export function ChartTooltip({
    active,
    payload,
    label,
    valueFormat,
    seriesFormats,
    labelFormat,
}: ChartTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;
    const fallback = resolveFormat(valueFormat);
    const formatFor = (entry: TooltipEntry) => {
        const key = entry.dataKey ?? entry.name;
        const spec =
            seriesFormats && key != null ? seriesFormats[String(key)] : undefined;
        return spec ? resolveFormat(spec) : fallback;
    };
    const formatValue = (entry: TooltipEntry) =>
        typeof entry.value === "number"
            ? formatFor(entry)(entry.value)
            : String(entry.value ?? "");

    return (
        <div className="rounded-lg border border-border-strong bg-popover/95 px-3 py-2 text-xs backdrop-blur">
            {label != null && (
                <div className="mb-1.5 font-mono text-[11px] text-foreground-muted">
                    {labelFormat ? labelFormat(label) : String(label)}
                </div>
            )}
            <div className="flex flex-col gap-1">
                {payload.map((entry, index) => (
                    <div
                        key={entry.dataKey ?? index}
                        className="flex items-center gap-2"
                    >
                        <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: entry.color }}
                        />
                        {entry.name != null && (
                            <span className="text-foreground-secondary">
                                {entry.name}
                            </span>
                        )}
                        <span className="ml-auto pl-4 font-numeric tabular-nums text-foreground">
                            {formatValue(entry)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
