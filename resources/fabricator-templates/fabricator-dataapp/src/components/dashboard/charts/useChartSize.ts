//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChartSize } from "./types";

/**
 * Measure an element with a `ResizeObserver`. Replaces Recharts'
 * `ResponsiveContainer`: attach `ref` to the plot box and read `size`
 * ({@link ChartSize}). `size` starts at `{ 0, 0 }` until the first measure —
 * callers should render the chart only once `size.width > 0`.
 *
 * @example
 * ```tsx
 * const { ref, size } = useChartSize();
 * return (
 *   <div ref={ref} style={{ height: 240 }}>
 *     {size.width > 0 && <svg width={size.width} height={size.height} />}
 *   </div>
 * );
 * ```
 */
export function useChartSize<T extends HTMLElement = HTMLDivElement>(): {
    ref: (node: T | null) => void;
    size: ChartSize;
} {
    const [size, setSize] = useState<ChartSize>({ width: 0, height: 0 });
    const observerRef = useRef<ResizeObserver | null>(null);

    const ref = useCallback((node: T | null) => {
        observerRef.current?.disconnect();
        if (node == null || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            setSize((prev) =>
                prev.width === width && prev.height === height
                    ? prev
                    : { width, height },
            );
        });
        observer.observe(node);
        observerRef.current = observer;
    }, []);

    useEffect(() => () => observerRef.current?.disconnect(), []);

    return { ref, size };
}
