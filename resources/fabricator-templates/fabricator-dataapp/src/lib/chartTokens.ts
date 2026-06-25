//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useEffect, useState } from "react";

/**
 * Shared chart-styling tokens for the kit's Recharts surfaces.
 *
 * Every color is resolved from the `--color-*` CSS custom properties defined
 * in `src/global.css`, so charts re-theme automatically when the `.dark`
 * class flips on `<html>`. Components should reference these helpers
 * (`seriesColor(0)`, `roleColor("success")`) rather than raw hex.
 */

/** Ordered chart series palette (CSS variable names, without `var()`). */
export const CHART_SERIES_VARS = [
    "--color-chart-1",
    "--color-chart-2",
    "--color-chart-3",
    "--color-chart-4",
    "--color-chart-5",
    "--color-chart-6",
] as const;

/** Semantic chart roles → CSS variable name (without `var()`). */
export type ChartRole =
    | "brand"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "neutral";

const ROLE_VARS: Record<ChartRole, string> = {
    brand: "--color-primary",
    success: "--color-success",
    danger: "--color-destructive",
    warning: "--color-warning",
    info: "--color-info",
    neutral: "--color-chart-2",
};

/** Wrap a CSS variable name in `var(...)` for inline-style / SVG props. */
export function cssVar(name: string): string {
    return `var(${name})`;
}

/** Color for the Nth series, cycling through the chart palette. */
export function seriesColor(index: number): string {
    const len = CHART_SERIES_VARS.length;
    return cssVar(CHART_SERIES_VARS[((index % len) + len) % len]);
}

/** Color for a semantic role (brand / success / danger / …). */
export function roleColor(role: ChartRole): string {
    return cssVar(ROLE_VARS[role]);
}

/**
 * Resolve a caller-supplied color token into a usable CSS color string.
 * Accepts a raw CSS color or `var(...)`, a `--color-*` variable name, a
 * `chart-1`..`chart-6` shorthand, or a {@link ChartRole}. Falls back to the
 * Nth series color when nothing is supplied.
 */
export function resolveColor(input?: string, fallbackIndex = 0): string {
    if (!input) return seriesColor(fallbackIndex);
    if (input.startsWith("var(") || input.startsWith("#") || input.includes("("))
        return input;
    if (input.startsWith("--")) return cssVar(input);
    if (/^chart-[1-6]$/.test(input)) return cssVar(`--color-${input}`);
    if (input in ROLE_VARS) return roleColor(input as ChartRole);
    return input;
}

/* ----------------------- Reactive resolved theme ----------------------- */

export interface ChartTheme {
    /** Card surface color — used for dot cores / tooltip backgrounds. */
    surface: string;
    /** Popover surface color — used for tooltip backgrounds. */
    popover: string;
    /** Subtle gridline color. */
    grid: string;
    /** Axis label / tick color. */
    axis: string;
    /** Tooltip cursor line/band color. */
    cursor: string;
    /** Primary body text color. */
    foreground: string;
    /** Secondary text color (axis ticks, labels). */
    foregroundSecondary: string;
    /** Muted text color (sub-labels, share %). */
    foregroundMuted: string;
    /** Default border color. */
    border: string;
    /** Stronger border color (tooltip outline). */
    borderStrong: string;
    /** Reference-line color (avg / target markers). */
    reference: string;
    /** Brand-accent color. */
    brand: string;
}

const VARS: Record<keyof ChartTheme, string> = {
    surface: "--color-card",
    popover: "--color-popover",
    grid: "--color-chart-grid",
    axis: "--color-chart-axis",
    cursor: "--color-chart-cursor",
    foreground: "--color-foreground",
    foregroundSecondary: "--color-foreground-secondary",
    foregroundMuted: "--color-foreground-muted",
    border: "--color-border",
    borderStrong: "--color-border-strong",
    reference: "--color-border-strong",
    brand: "--color-primary",
};

/** Concrete fallback used during SSR / before styles resolve (dark-ish). */
const FALLBACK: ChartTheme = {
    surface: "#101216",
    popover: "#161a20",
    grid: "rgba(230,232,236,0.06)",
    axis: "#6b7380",
    cursor: "rgba(230,232,236,0.08)",
    foreground: "#e6e8ec",
    foregroundSecondary: "#9aa3b2",
    foregroundMuted: "#6b7380",
    border: "#1f242c",
    borderStrong: "#2a313b",
    reference: "#2a313b",
    brand: "#bef264",
};

function read(): ChartTheme {
    if (typeof window === "undefined" || typeof document === "undefined")
        return FALLBACK;
    const styles = window.getComputedStyle(document.documentElement);
    const out = {} as ChartTheme;
    (Object.keys(VARS) as (keyof ChartTheme)[]).forEach((key) => {
        out[key] = styles.getPropertyValue(VARS[key]).trim() || FALLBACK[key];
    });
    return out;
}

/**
 * Resolves the CSS variables that Recharts cannot reference via `var()`
 * (axis `stroke` / tick `fill`, grid, cursor) into concrete color strings,
 * and re-resolves them whenever the `.dark` class on `<html>` flips.
 *
 * Series stroke/fill props can use `var(--color-chart-n)` directly; this
 * hook is for the props Recharts measures or rasterizes.
 */
export function useChartTheme(): ChartTheme {
    const [theme, setTheme] = useState<ChartTheme>(read);
    useEffect(() => {
        if (typeof window === "undefined") return;
        // Re-resolve whenever the theme flips. The lazy initial state already
        // read the tokens (global.css is imported before render), so the
        // observer is the only writer — no synchronous setState in the effect.
        const observer = new MutationObserver(() => setTheme(read()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "data-appearance"],
        });
        return () => observer.disconnect();
    }, []);
    return theme;
}

/* --------------- Shared Recharts prop bundles --------------- */

/** Shared axis props — hides axis/tick lines, uses muted mono ticks. */
export function axisProps(theme: ChartTheme) {
    return {
        stroke: theme.axis,
        tickLine: false,
        axisLine: false,
        tick: {
            fill: theme.axis,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            letterSpacing: 0.2,
        },
    } as const;
}

/** Shared `CartesianGrid` props — faint horizontal-only gridlines. */
export function gridProps(theme: ChartTheme) {
    return {
        stroke: theme.grid,
        strokeDasharray: "3 3",
        vertical: false,
    } as const;
}

/** Shared cursor for line/area Tooltips. */
export function lineCursor(theme: ChartTheme) {
    return { stroke: theme.cursor, strokeDasharray: "3 3" };
}

/** Shared cursor for bar Tooltips — a faint highlighted band. */
export function barCursor(theme: ChartTheme) {
    return { fill: theme.cursor, radius: 6 };
}

/** Reference-line styling (avg / target markers). */
export function referenceLineProps(theme: ChartTheme) {
    return {
        stroke: theme.reference,
        strokeDasharray: "4 4",
        strokeOpacity: 0.7,
    } as const;
}
