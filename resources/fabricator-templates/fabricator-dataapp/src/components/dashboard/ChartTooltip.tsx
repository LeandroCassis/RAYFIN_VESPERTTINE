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
    /** Injected by Recharts. */
    active?: boolean;
    /** Injected by Recharts. */
    payload?: ReadonlyArray<TooltipEntry>;
    /** Injected by Recharts. */
    label?: number | string;
    /** Formats each series value (defaults to `"number"`). */
    valueFormat?: ValueFormat;
    /** Formats the axis label (e.g. a date). */
    labelFormat?: (label: number | string) => ReactNode;
}

/**
 * Themed tooltip shared by every kit chart. Pass it to a Recharts
 * `<Tooltip content={<ChartTooltip valueFormat="currency" />} />` — Recharts
 * injects `active` / `payload` / `label`. The kit chart cards wire this up
 * automatically, so apps rarely use it directly.
 */
export function ChartTooltip({
    active,
    payload,
    label,
    valueFormat,
    labelFormat,
}: ChartTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;
    const format = resolveFormat(valueFormat);
    const formatValue = (value: TooltipEntry["value"]) =>
        typeof value === "number" ? format(value) : String(value ?? "");

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
                            {formatValue(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
