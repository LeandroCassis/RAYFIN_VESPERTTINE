//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Shared types for the custom SVG chart core. The core renders every chart as
 * plain, declarative SVG — sized by a `ResizeObserver`, scaled by `d3-scale`,
 * shaped by `d3-shape`, animated by `framer-motion`. There is no Recharts.
 */

/** Measured plot-box size in CSS pixels. */
export interface ChartSize {
    width: number;
    height: number;
}

/** Inner plot margins (space reserved for axes / labels). */
export interface Margin {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

/**
 * Interaction props shared by every interactive mark (bars, points, slices).
 * A card spreads `useCrossFilter(field)` straight onto these — clicking a mark
 * toggles its membership in the shared filter state and dims the rest.
 */
export interface MarkInteraction {
    /** Currently selected category keys; non-empty turns on emphasis/dimming. */
    selectedKeys?: ReadonlyArray<string | number>;
    /** Called with a mark's category value when the user clicks it. */
    onSelect?: (value: string | number) => void;
    /** Dim unselected marks (default: on when `selectedKeys` is non-empty). */
    dimUnselected?: boolean;
}

/** Opacity for a mark given the active selection (1 = full, dimmed otherwise). */
export function markOpacity(
    value: string | number,
    interaction?: MarkInteraction,
): number {
    const keys = interaction?.selectedKeys;
    const hasSelection = keys != null && keys.length > 0;
    const dim = interaction?.dimUnselected ?? hasSelection;
    if (!dim || !hasSelection) return 1;
    return keys!.some((key) => String(key) === String(value)) ? 1 : 0.26;
}

/** Whether a mark is part of the active selection. */
export function isSelected(
    value: string | number,
    interaction?: MarkInteraction,
): boolean {
    const keys = interaction?.selectedKeys;
    if (!keys || keys.length === 0) return false;
    return keys.some((key) => String(key) === String(value));
}

/** True when a card has a click handler wired (enables pointer affordances). */
export function isInteractive(interaction?: MarkInteraction): boolean {
    return typeof interaction?.onSelect === "function";
}
