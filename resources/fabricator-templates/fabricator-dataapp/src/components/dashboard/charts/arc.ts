//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Radial geometry helpers (donut / pie / gauge) built on `d3-shape`'s `arc`
 * and `pie` generators. Angles follow d3's convention: radians, clockwise,
 * with `0` at 12 o'clock.
 */

import {
    arc as d3Arc,
    pie as d3Pie,
    type DefaultArcObject,
    type PieArcDatum,
} from "d3-shape";

/** One computed pie/donut slice. */
export type Slice = PieArcDatum<number>;

/** Lay out values into pie/donut slices (input order preserved). */
export function pieSlices(
    values: ReadonlyArray<number>,
    options?: { padAngle?: number },
): Slice[] {
    return d3Pie<number>()
        .value((value) => (Number.isFinite(value) ? value : 0))
        .padAngle(options?.padAngle ?? 0)
        .sort(null)([...values]);
}

/** Build an SVG path string for a single arc/ring segment. */
export function arcPath(spec: {
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    cornerRadius?: number;
    padAngle?: number;
}): string {
    const generator = d3Arc<DefaultArcObject>().cornerRadius(
        spec.cornerRadius ?? 0,
    );
    return (
        generator({
            innerRadius: spec.innerRadius,
            outerRadius: spec.outerRadius,
            startAngle: spec.startAngle,
            endAngle: spec.endAngle,
            padAngle: spec.padAngle ?? 0,
        }) ?? ""
    );
}

/** The centroid `[x, y]` of an arc segment (for slice labels / leader lines). */
export function arcCentroid(spec: {
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
}): [number, number] {
    return d3Arc<DefaultArcObject>().centroid({
        innerRadius: spec.innerRadius,
        outerRadius: spec.outerRadius,
        startAngle: spec.startAngle,
        endAngle: spec.endAngle,
    });
}

/**
 * Convert a "compass" angle in degrees — measured counter-clockwise from the
 * positive x-axis (3 o'clock), the convention the kit's gauge props use — into
 * d3's radians-clockwise-from-top. So `210°` → bottom-left, `-30°` →
 * bottom-right, giving a 240° speedometer arc open at the bottom.
 */
export function compassToRadians(deg: number): number {
    return ((90 - deg) * Math.PI) / 180;
}
