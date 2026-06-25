//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useEffect, useState } from "react";

import {
    cssThemeChanged,
    readCssTheme,
    type VisualTheme,
} from "@microsoft/fabric-visuals-core";

/**
 * Reactive bridge from the CSS design tokens to a Fabric `VisualTheme`, for
 * `<DataGrid theme={…} />`. Reads the bridged `--color-*` vars via
 * `readCssTheme()` and re-resolves whenever the `.dark` class on `<html>`
 * flips — replacing the old `useCssTheme` from `@microsoft/fabric-visuals`.
 *
 * `DataTableCard` already wires this up, so most apps never call it directly.
 */
export function useCssTheme(): VisualTheme {
    const [theme, setTheme] = useState<VisualTheme>(() => readCssTheme());

    useEffect(() => {
        const sync = () =>
            setTheme((prev) => {
                const next = readCssTheme();
                return cssThemeChanged(prev, next) ? next : prev;
            });
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "data-appearance"],
        });
        return () => observer.disconnect();
    }, []);

    return theme;
}
