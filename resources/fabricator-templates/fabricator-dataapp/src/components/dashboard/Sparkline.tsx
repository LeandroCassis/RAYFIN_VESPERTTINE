//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useId } from "react";
import { area as d3Area, line as d3Line } from "d3-shape";

import { resolveColor } from "@/lib/chartTokens";

import { useChartSize } from "./charts/useChartSize";

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
 * Compact, axis-less trend line for KPI cards and inline cells — a fully custom
 * SVG sparkline (no charting library). Pass a raw `number[]` (or objects +
 * `dataKey`).
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
    const gradientId = useId().replace(/:/g, "");
    const stroke = resolveColor(color, 0);
    const { ref, size } = useChartSize();

    const values = (
        typeof data[0] === "number"
            ? (data as ReadonlyArray<number>)
            : (data as ReadonlyArray<Record<string, unknown>>).map((row) =>
                  Number(row[dataKey]),
              )
    ).map((value) => (Number.isFinite(value) ? value : Number.NaN));

    const width = size.width;
    const inner = Math.max(0, height - 4);

    let linePath = "";
    let areaPath = "";
    if (width > 0 && values.length > 0) {
        const finite = values.filter((value) => Number.isFinite(value));
        const min = finite.length ? Math.min(...finite) : 0;
        const max = finite.length ? Math.max(...finite) : 1;
        const span = max - min || 1;
        const x = (index: number) =>
            values.length <= 1
                ? width / 2
                : (index / (values.length - 1)) * width;
        const y = (value: number) => 2 + (1 - (value - min) / span) * inner;
        const points = values.map(
            (value, index) => [x(index), y(value)] as [number, number],
        );
        const defined = (point: [number, number]) => Number.isFinite(point[1]);
        linePath =
            d3Line<[number, number]>()
                .defined(defined)
                .x((point) => point[0])
                .y((point) => point[1])(points) ?? "";
        areaPath =
            d3Area<[number, number]>()
                .defined(defined)
                .x((point) => point[0])
                .y0(height)
                .y1((point) => point[1])(points) ?? "";
    }

    return (
        <div ref={ref} className={className} style={{ height }}>
            {width > 0 && (
                <svg width={width} height={height} role="img" aria-hidden>
                    <defs>
                        <linearGradient
                            id={gradientId}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
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
                    {variant === "area" && (
                        <path d={areaPath} fill={`url(#${gradientId})`} />
                    )}
                    <path
                        d={linePath}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </div>
    );
}
