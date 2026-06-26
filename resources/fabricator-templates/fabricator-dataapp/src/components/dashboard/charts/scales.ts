//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Thin `d3-scale` / `d3-shape` helpers for the chart core. These keep all d3
 * usage in one place so the mark + card components stay declarative React.
 */

import { scaleBand, scaleLinear, scalePoint } from "d3-scale";
import {
    curveLinear,
    curveMonotoneX,
    curveNatural,
    curveStepAfter,
    type CurveFactory,
} from "d3-shape";

/** Line/area interpolation modes exposed by the kit. */
export type CurveType = "monotone" | "linear" | "natural" | "step";

/** Map a {@link CurveType} to its `d3-shape` curve factory. */
export function curveFactory(curve: CurveType): CurveFactory {
    switch (curve) {
        case "linear":
            return curveLinear;
        case "natural":
            return curveNatural;
        case "step":
            return curveStepAfter;
        case "monotone":
        default:
            return curveMonotoneX;
    }
}

/** Banded categorical scale (bars): each category gets a slot of equal width. */
export function bandScale(domain: string[], width: number, padding = 0.28) {
    return scaleBand<string>()
        .domain(domain)
        .range([0, Math.max(0, width)])
        .paddingInner(padding)
        .paddingOuter(padding / 2);
}

/** Point categorical scale (line/area): one position per category. */
export function pointScale(domain: string[], width: number) {
    return scalePoint<string>()
        .domain(domain)
        .range([0, Math.max(0, width)])
        .padding(0.5);
}

/** Linear scale mapping a numeric domain onto a pixel range. */
export function linearScale(
    domain: [number, number],
    range: [number, number],
    nice = true,
) {
    const scale = scaleLinear().domain(domain).range(range);
    return nice ? scale.nice() : scale;
}

/**
 * Compute a numeric domain `[min, max]` from the plotted series values,
 * extending to include zero (so bars/areas sit on a real baseline) and
 * padding a flat series so it isn't a zero-height line.
 */
export function valueDomain(
    rows: ReadonlyArray<Record<string, unknown>>,
    keys: ReadonlyArray<string>,
    options?: { stacked?: boolean; includeZero?: boolean },
): [number, number] {
    const includeZero = options?.includeZero ?? true;
    let min = includeZero ? 0 : Number.POSITIVE_INFINITY;
    let max = includeZero ? 0 : Number.NEGATIVE_INFINITY;

    for (const row of rows) {
        if (options?.stacked) {
            let positive = 0;
            let negative = 0;
            for (const key of keys) {
                const value = Number(row[key]);
                if (!Number.isFinite(value)) continue;
                if (value >= 0) positive += value;
                else negative += value;
            }
            max = Math.max(max, positive);
            min = Math.min(min, negative);
        } else {
            for (const key of keys) {
                const value = Number(row[key]);
                if (!Number.isFinite(value)) continue;
                max = Math.max(max, value);
                min = Math.min(min, value);
            }
        }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min === max) {
        // Flat series — pad so it renders with some height.
        const pad = Math.abs(min) || 1;
        return [min - pad, max + pad];
    }
    return [min, max];
}

/** Evenly-spaced numeric ticks for a linear axis. */
export function linearTicks(
    scale: ReturnType<typeof linearScale>,
    count = 5,
): number[] {
    return scale.ticks(count);
}

/**
 * Pick a subset of categorical labels to render so they never overlap: keeps
 * roughly one label per `minGapPx`, always including the first and last.
 */
export function thinLabels<T>(
    domain: ReadonlyArray<T>,
    sizePx: number,
    minGapPx = 56,
): T[] {
    if (domain.length === 0 || sizePx <= 0) return [...domain];
    const maxLabels = Math.max(1, Math.floor(sizePx / minGapPx));
    if (domain.length <= maxLabels) return [...domain];
    const step = Math.ceil(domain.length / maxLabels);
    const kept: T[] = [];
    for (let i = 0; i < domain.length; i += step) kept.push(domain[i]);
    const last = domain[domain.length - 1];
    if (kept[kept.length - 1] !== last) kept.push(last);
    return kept;
}

/** A positioned axis tick label considered for collision thinning. */
export interface PositionedTick {
    pos: number;
    label: string;
}

/**
 * Greedily drop axis tick labels that would visually overlap, based on each
 * label's estimated rendered width. Labels are assumed centered on `pos`
 * (bottom axis). Width is estimated from character count since we can't measure
 * SVG text synchronously — `charPx` ≈ the mono tick font's per-char width.
 * Keeps the first fitting label, then each subsequent label whose left edge
 * clears the previously kept label's right edge.
 */
export function thinTicksByWidth<T extends PositionedTick>(
    ticks: ReadonlyArray<T>,
    options?: { charPx?: number; padPx?: number },
): T[] {
    const charPx = options?.charPx ?? 6.8;
    const padPx = options?.padPx ?? 12;
    const kept: T[] = [];
    let lastRight = Number.NEGATIVE_INFINITY;
    for (const tick of ticks) {
        const width = tick.label.length * charPx + padPx;
        const left = tick.pos - width / 2;
        if (left >= lastRight) {
            kept.push(tick);
            lastRight = tick.pos + width / 2;
        }
    }
    return kept;
}
