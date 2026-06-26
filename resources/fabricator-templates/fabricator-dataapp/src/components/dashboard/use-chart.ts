//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useEffect, useRef } from "react";

import { render, type ChartInstance, type ChartSpec } from "envy";

/**
 * Headless Envy binding: mount a chart into a DOM node and keep it in sync with
 * `spec`.
 *
 * Returns a ref to attach to the container element (give it an explicit size).
 * The chart is created on mount, re-rendered via `instance.update()` whenever
 * `spec` changes identity, and torn down on unmount. StrictMode-safe (double
 * mount → destroy → mount leaks nothing and never double-renders).
 *
 * Pass a *stable* (memoized or module-constant) `spec`; a fresh object every
 * render replays the entrance/crossfade animation.
 */
export function useChart<T extends HTMLElement = HTMLDivElement>(
    spec: ChartSpec,
) {
    const ref = useRef<T | null>(null);
    const instanceRef = useRef<ChartInstance | null>(null);
    const skipNextUpdate = useRef(true);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const instance = render(el, spec);
        instanceRef.current = instance;
        // The update effect fires once right after mount; skip that pass so we
        // don't redundantly re-render the freshly created chart.
        skipNextUpdate.current = true;
        return () => {
            instance.destroy();
            instanceRef.current = null;
        };
        // Mount once with the initial spec; the effect below syncs later changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (skipNextUpdate.current) {
            skipNextUpdate.current = false;
            return;
        }
        instanceRef.current?.update(spec);
    }, [spec]);

    return ref;
}
