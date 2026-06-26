//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ChartTheme } from "@/lib/chartTokens";

/**
 * Faint horizontal gridlines at the given y pixel positions (paired with the
 * numeric {@link AxisLeft}). Dashed + low-contrast to stay flat.
 */
export function GridRows({
    positions,
    left,
    right,
    theme,
}: {
    positions: ReadonlyArray<number>;
    left: number;
    right: number;
    theme: ChartTheme;
}) {
    return (
        <g aria-hidden>
            {positions.map((y, index) => (
                <line
                    key={index}
                    x1={left}
                    x2={right}
                    y1={y}
                    y2={y}
                    stroke={theme.grid}
                    strokeDasharray="3 3"
                    shapeRendering="crispEdges"
                />
            ))}
        </g>
    );
}

/**
 * Faint vertical gridlines at the given x pixel positions — used by horizontal
 * bar charts where the numeric axis runs along the bottom.
 */
export function GridColumns({
    positions,
    top,
    bottom,
    theme,
}: {
    positions: ReadonlyArray<number>;
    top: number;
    bottom: number;
    theme: ChartTheme;
}) {
    return (
        <g aria-hidden>
            {positions.map((x, index) => (
                <line
                    key={index}
                    x1={x}
                    x2={x}
                    y1={top}
                    y2={bottom}
                    stroke={theme.grid}
                    strokeDasharray="3 3"
                    shapeRendering="crispEdges"
                />
            ))}
        </g>
    );
}
