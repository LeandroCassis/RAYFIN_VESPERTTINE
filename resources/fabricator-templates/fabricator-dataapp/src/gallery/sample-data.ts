//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Static sample data for the **dev-only** component gallery. This file is only
 * imported by `src/gallery/*` (reachable via `npm run gallery` → `/gallery.html`)
 * and is NOT part of the deployed dashboard bundle, so it does not violate the
 * "never ship mock data" rule that governs the live app.
 */

/** 12 months of revenue / profit / orders — for line / area / combo charts. */
export const monthlyRevenue = [
    { month: "2024-01", revenue: 184_000, profit: 42_000, orders: 1_240 },
    { month: "2024-02", revenue: 172_500, profit: 38_500, orders: 1_180 },
    { month: "2024-03", revenue: 209_800, profit: 51_200, orders: 1_410 },
    { month: "2024-04", revenue: 221_300, profit: 55_900, orders: 1_505 },
    { month: "2024-05", revenue: 198_700, profit: 47_300, orders: 1_360 },
    { month: "2024-06", revenue: 243_900, profit: 63_100, orders: 1_640 },
    { month: "2024-07", revenue: 256_400, profit: 67_800, orders: 1_712 },
    { month: "2024-08", revenue: 248_100, profit: 64_500, orders: 1_688 },
    { month: "2024-09", revenue: 271_600, profit: 72_400, orders: 1_804 },
    { month: "2024-10", revenue: 289_200, profit: 78_900, orders: 1_905 },
    { month: "2024-11", revenue: 312_700, profit: 86_300, orders: 2_064 },
    { month: "2024-12", revenue: 341_500, profit: 95_700, orders: 2_233 },
];

/** Revenue by region — for ranked (vertical) bar charts. */
export const regionRevenue = [
    { region: "North America", revenue: 482_000 },
    { region: "Europe", revenue: 364_500 },
    { region: "Asia Pacific", revenue: 298_700 },
    { region: "Latin America", revenue: 142_300 },
    { region: "Middle East", revenue: 98_600 },
];

/** Region performance grid — for the Graphein `table` with conditional formatting. */
export const regionPerformance = [
    { region: "North America", revenue: 482_000, margin: 0.32, yoy: 0.124 },
    { region: "Europe", revenue: 364_500, margin: 0.28, yoy: 0.061 },
    { region: "Asia Pacific", revenue: 298_700, margin: 0.35, yoy: 0.187 },
    { region: "Latin America", revenue: 142_300, margin: 0.21, yoy: -0.043 },
    { region: "Middle East", revenue: 98_600, margin: 0.3, yoy: 0.092 },
];

/** Revenue split across product lines — for stacked bars / areas. */
export const channelRevenue = [
    { quarter: "Q1", online: 142_000, retail: 98_000, wholesale: 61_000 },
    { quarter: "Q2", online: 168_000, retail: 104_000, wholesale: 72_000 },
    { quarter: "Q3", online: 191_000, retail: 96_000, wholesale: 80_000 },
    { quarter: "Q4", online: 224_000, retail: 112_000, wholesale: 88_000 },
];

/** Category share — for donut / pie. */
export const categoryShare = [
    { category: "Bikes", value: 420_000 },
    { category: "Accessories", value: 168_000 },
    { category: "Clothing", value: 124_000 },
    { category: "Components", value: 96_000 },
];

/** Price vs. units with a magnitude — for scatter (size encoding). */
export const priceVsUnits = [
    { product: "Road-150", price: 3_578, units: 412, margin: 0.34 },
    { product: "Mountain-200", price: 2_295, units: 638, margin: 0.29 },
    { product: "Touring-1000", price: 2_384, units: 287, margin: 0.31 },
    { product: "Hybrid-500", price: 1_120, units: 1_044, margin: 0.22 },
    { product: "Kids-40", price: 420, units: 1_812, margin: 0.18 },
    { product: "Electric-900", price: 4_290, units: 196, margin: 0.41 },
];

/** Funnel stages — for the funnel chart. */
export const funnelStages = [
    { stage: "Visited", count: 48_200 },
    { stage: "Signed up", count: 18_640 },
    { stage: "Activated", count: 9_310 },
    { stage: "Purchased", count: 4_120 },
    { stage: "Renewed", count: 2_480 },
];

/** Distinct categories for slicer demos. */
export const productCategories = [
    "Bikes",
    "Accessories",
    "Clothing",
    "Components",
];

/* ----------------------------------------------------------------------- *
 * Long / tidy reshapes. Graphein reads ONE long table per chart and splits
 * multiple series via `encoding.series` — so melt wide rows (a column per
 * series) into `{ category, series, value }` rather than pivoting. DAX
 * `SUMMARIZECOLUMNS` already returns this shape; these derive it from the wide
 * samples above for the gallery.
 * ----------------------------------------------------------------------- */

/** `monthlyRevenue` melted to one row per month × metric — multi-series line. */
export const revenueProfitLong = monthlyRevenue.flatMap((row) => [
    { month: row.month, metric: "Revenue", value: row.revenue },
    { month: row.month, metric: "Profit", value: row.profit },
]);

/** `channelRevenue` melted to one row per quarter × channel — stacks/groups. */
export const channelLong = channelRevenue.flatMap((row) => [
    { quarter: row.quarter, channel: "Online", revenue: row.online },
    { quarter: row.quarter, channel: "Retail", revenue: row.retail },
    { quarter: row.quarter, channel: "Wholesale", revenue: row.wholesale },
]);

/** Region × quarter revenue grid — for the heatmap (x × y → color). */
export const regionQuarter = regionRevenue.flatMap((row, regionIndex) =>
    ["Q1", "Q2", "Q3", "Q4"].map((quarter, quarterIndex) => ({
        region: row.region,
        quarter,
        revenue: Math.round(
            (row.revenue / 4) * (0.78 + 0.14 * ((regionIndex + quarterIndex) % 4)),
        ),
    })),
);
