//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, type CSSProperties } from "react";

import type { ChartSpec } from "envy";

import { useEnvyTheme } from "@/lib/envy-theme";

import { useChart } from "./use-chart";

/**
 * Declarative React wrapper around the Envy runtime — `<Chart spec={…} />`.
 *
 * The published `envy` package ships only the framework-agnostic core, so the
 * app owns this thin binding instead of a separate React package. Renders a
 * container `<div>` that fills its parent (override via `style`) and draws
 * `spec` into it; pass a new spec to update.
 *
 * `Chart` injects the app's CSS-token theme automatically, so every chart is
 * on-brand and dark-mode aware. Author specs WITHOUT a `theme` and let the tile
 * own it; recolor via `src/global.css` tokens, not per-spec hex. (Set
 * `spec.theme` yourself only as a deliberate escape hatch.)
 */

export interface ChartProps {
    /** The Envy chart spec to render. */
    spec: ChartSpec;
    className?: string;
    style?: CSSProperties;
}

const FILL: CSSProperties = { width: "100%", height: "100%" };

export function Chart({ spec, className, style }: ChartProps) {
    const appTheme = useEnvyTheme();
    // Inject the app theme unless the spec opts out with its own `theme`.
    const themed = useMemo<ChartSpec>(
        () => (spec.theme != null ? spec : { ...spec, theme: appTheme }),
        [spec, appTheme],
    );
    const ref = useChart<HTMLDivElement>(themed);
    return (
        <div
            ref={ref}
            className={className}
            style={style ? { ...FILL, ...style } : FILL}
        />
    );
}
