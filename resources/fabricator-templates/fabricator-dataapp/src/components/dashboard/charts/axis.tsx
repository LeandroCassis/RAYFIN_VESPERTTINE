//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ChartTheme } from "@/lib/chartTokens";

/** A resolved axis tick: a label and its pixel position along the axis. */
export interface AxisTick {
    key: string;
    label: string;
    /** Pixel offset along the axis (x for bottom, y for left). */
    pos: number;
}

const TICK_FONT = "var(--font-mono)";

/**
 * Bottom (category / x) axis — muted mono tick labels, no axis or tick lines
 * (matching the kit's flat look). Positions are precomputed by the caller so
 * this component stays decoupled from the d3 scale type.
 */
export function AxisBottom({
    ticks,
    top,
    theme,
}: {
    ticks: ReadonlyArray<AxisTick>;
    /** Y pixel of the axis baseline (bottom of the plot). */
    top: number;
    theme: ChartTheme;
}) {
    return (
        <g aria-hidden>
            {ticks.map((tick) => (
                <text
                    key={tick.key}
                    x={tick.pos}
                    y={top + 16}
                    textAnchor="middle"
                    fontFamily={TICK_FONT}
                    fontSize={11}
                    letterSpacing={0.2}
                    fill={theme.axis}
                >
                    {tick.label}
                </text>
            ))}
        </g>
    );
}

/**
 * Left (numeric / y) axis — right-aligned mono tick labels, no axis or tick
 * lines. Pair with {@link GridRows} for the faint horizontal gridlines.
 */
export function AxisLeft({
    ticks,
    right,
    theme,
}: {
    ticks: ReadonlyArray<AxisTick>;
    /** X pixel where labels end (just left of the plot). */
    right: number;
    theme: ChartTheme;
}) {
    return (
        <g aria-hidden>
            {ticks.map((tick) => (
                <text
                    key={tick.key}
                    x={right - 8}
                    y={tick.pos}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontFamily={TICK_FONT}
                    fontSize={11}
                    letterSpacing={0.2}
                    fill={theme.axis}
                >
                    {tick.label}
                </text>
            ))}
        </g>
    );
}
