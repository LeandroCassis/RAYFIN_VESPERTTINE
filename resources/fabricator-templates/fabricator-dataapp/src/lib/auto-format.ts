//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Safe, zero-config formatting heuristics for the dashboard kit. These only
 * ever *fill in a sensible default* — a card always lets an explicit
 * `xFormat` / `valueFormat` win. They deliberately never guess a value's
 * **unit** (currency vs. percent vs. ratio) from bare numbers, since numbers
 * alone can't reveal that; only structural facts (is-a-date, label width) are
 * inferred here.
 */

import { formatDate } from "./format";

// Matches ISO-8601-ish date strings ("2024-01", "2024-01-31", "2024-01-31T09:30").
// Deliberately strict so plain category labels ("Jan", "2024", "Q1") are NOT
// treated as dates — a mislabeled axis is worse than a raw one.
const ISO_DATE_RE = /^\d{4}-\d{2}(-\d{2})?([T ]\d{2}:\d{2})?/;

/**
 * Whether a value looks like a real date — a `Date` instance or an ISO-ish
 * string that parses. Plain labels, years, and quarter names return `false`.
 *
 * @example
 * ```ts
 * isDateLike(new Date());      // true
 * isDateLike("2024-01-31");    // true
 * isDateLike("Jan");           // false
 * isDateLike(2024);            // false (ambiguous: year? count?)
 * ```
 */
export function isDateLike(value: unknown): boolean {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value === "string") {
        if (!ISO_DATE_RE.test(value)) return false;
        return !Number.isNaN(Date.parse(value));
    }
    return false;
}

/**
 * Infer an X-axis tick formatter from the data: returns a `formatDate` wrapper
 * when the X column is date-like, otherwise `undefined` (leave values as-is).
 * Cards call this only when the caller didn't pass an explicit `xFormat`.
 *
 * @example
 * ```ts
 * const xFormat = explicitXFormat ?? inferXFormat(rows, "Month");
 * ```
 */
export function inferXFormat(
    rows: ReadonlyArray<Record<string, unknown>>,
    xKey: string,
): ((value: string | number) => string) | undefined {
    for (const row of rows) {
        const value = row?.[xKey];
        if (value == null) continue;
        return isDateLike(value)
            ? (input: string | number) => formatDate(input)
            : undefined;
    }
    return undefined;
}

/** Options for {@link autoAxisWidth}. */
export interface AutoAxisWidthOptions {
    /** Smallest width to return (px). Default 44. */
    min?: number;
    /** Largest width to return (px). Default 96. */
    max?: number;
    /** Approx. px per character for the mono tick font. Default 7.2. */
    charPx?: number;
    /** Extra padding added to the measured label width (px). Default 14. */
    padding?: number;
}

/**
 * Estimate a numeric Y-axis width (px) from the formatted extremes of the data
 * so long ticks (currency, big compacts) never clip — replacing a hard-coded
 * axis width. Samples min / mid / max, formats each, and sizes to the widest,
 * clamped to `[min, max]`.
 *
 * @example
 * ```ts
 * const width = autoAxisWidth(values, resolveFormat("currency"));
 * <YAxis width={width} … />
 * ```
 */
export function autoAxisWidth(
    values: ReadonlyArray<number>,
    format: (value: number) => string,
    options?: AutoAxisWidthOptions,
): number {
    const { min = 44, max = 96, charPx = 7.2, padding = 14 } = options ?? {};
    const finite = values.filter((value) => Number.isFinite(value));
    if (finite.length === 0) return min;

    const lo = Math.min(...finite);
    const hi = Math.max(...finite);
    const candidates = [lo, hi, (lo + hi) / 2];
    const widest = candidates.reduce(
        (longest, value) => Math.max(longest, format(value).length),
        0,
    );
    const px = Math.ceil(widest * charPx) + padding;
    return Math.min(max, Math.max(min, px));
}
