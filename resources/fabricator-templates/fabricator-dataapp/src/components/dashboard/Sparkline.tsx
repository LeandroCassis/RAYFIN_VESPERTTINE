//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { resolveColor } from "@/lib/chartTokens";

export interface SparklineProps {
    /** A list of numbers, or objects keyed by `dataKey`. */
    data: ReadonlyArray<number | Record<string, unknown>>;
    /** Accessor when `data` holds objects (default `"value"`). */
    dataKey?: string;
    /** Line/fill color — a chart token, role, `var(--…)`, or hex. */
    color?: string;
    /** Pixel height (default 40). */
    height?: number;
    /** Filled area (default) or a bare line. */
    variant?: "area" | "line";
    className?: string;
}

/**
 * Compact, axis-less trend line for KPI cards and inline cells. Pass a raw
 * `number[]` (or objects + `dataKey`).
 *
 * @example
 * ```tsx
 * <Sparkline data={[12, 18, 9, 22, 17, 25]} color="chart-1" />
 * ```
 */
export function Sparkline({
    data,
    dataKey = "value",
    color,
    height = 40,
    variant = "area",
    className,
}: SparklineProps) {
    const gradientId = useId();
    const stroke = resolveColor(color, 0);

    if (data.length === 0) return <div className={className} style={{ height }} />;

    const isNumeric = typeof data[0] === "number";
    const chartData = isNumeric
        ? (data as ReadonlyArray<number>).map((value) => ({ value }))
        : (data as ReadonlyArray<Record<string, unknown>>);
    const key = isNumeric ? "value" : dataKey;

    return (
        <div className={className} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData as Record<string, unknown>[]}
                    margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop
                                offset="0%"
                                stopColor={stroke}
                                stopOpacity={0.35}
                            />
                            <stop
                                offset="100%"
                                stopColor={stroke}
                                stopOpacity={0}
                            />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey={key}
                        stroke={stroke}
                        strokeWidth={1.75}
                        fill={variant === "area" ? `url(#${gradientId})` : "none"}
                        isAnimationActive={false}
                        dot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
