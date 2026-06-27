//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { CSSProperties } from "react";

import { resolveColor } from "@/lib/chartTokens";
import { cn } from "@/lib/utils";

/**
 * Shared card surface styling — the single source of truth for the kit's tile
 * look so `Card`, `ChartCard`, and `KpiCard` stay visually consistent.
 *
 * Hierarchy comes from **flat** signals — surface token, border weight, and an
 * optional accent spine — never shadows.
 */
export type CardVariant = "surface" | "feature" | "outline" | "ghost";

const VARIANT_CLASS: Record<CardVariant, string> = {
    /** Default tile — card surface + hairline border. */
    surface: "border border-border bg-card p-5",
    /** Emphasized tile — a touch lifted via a stronger border + raised surface. */
    feature: "border border-border-strong bg-surface-1 p-5",
    /** Quiet tile — outline only, transparent fill. */
    outline: "border border-border bg-transparent p-5",
    /** Frameless — no border/fill/padding, for embedding inside a band. */
    ghost: "border border-transparent bg-transparent p-0",
};

/** Tailwind classes for a card surface of the given `variant`. */
export function cardClass(variant: CardVariant = "surface", className?: string) {
    return cn("rounded-2xl", VARIANT_CLASS[variant], className);
}

/**
 * Inline style for an optional thin accent spine on the card's left edge —
 * marks a hero/primary tile. `accent` is any chart token, role, `var(--…)`,
 * or hex (resolved via `resolveColor`).
 */
export function accentEdgeStyle(accent?: string): CSSProperties | undefined {
    return accent
        ? { borderLeftWidth: 3, borderLeftColor: resolveColor(accent) }
        : undefined;
}
