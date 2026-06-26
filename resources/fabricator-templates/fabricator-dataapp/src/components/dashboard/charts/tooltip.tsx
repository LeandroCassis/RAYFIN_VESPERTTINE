//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { type CSSProperties, useCallback, useState } from "react";

/** Active hover target: a datum index plus the pointer position (plot pixels). */
export interface TooltipState {
    index: number;
    x: number;
    y: number;
}

/**
 * Tracks the hovered datum + pointer position for a chart's HTML tooltip
 * overlay. The chart's pointer-capture rect calls `show(index, x, y)` on move
 * and `hide()` on leave; the card renders {@link ChartTooltip} positioned via
 * {@link tooltipBoxStyle}.
 */
export function useChartTooltip(): {
    state: TooltipState | null;
    show: (index: number, x: number, y: number) => void;
    hide: () => void;
} {
    const [state, setState] = useState<TooltipState | null>(null);
    const show = useCallback(
        (index: number, x: number, y: number) => setState({ index, x, y }),
        [],
    );
    const hide = useCallback(() => setState(null), []);
    return { state, show, hide };
}

/**
 * Absolute-position style for the tooltip box: centered above the pointer and
 * clamped so it stays within the plot width. The plot box is `position:
 * relative` (the `ChartFrame` plot wrapper), so `left`/`top` are plot-local.
 */
export function tooltipBoxStyle(
    x: number,
    y: number,
    width: number,
): CSSProperties {
    const clampedLeft = Math.min(Math.max(x, 64), Math.max(64, width - 64));
    return {
        position: "absolute",
        left: clampedLeft,
        top: Math.max(0, y - 12),
        transform: "translate(-50%, -100%)",
        pointerEvents: "none",
        zIndex: 1,
    };
}
