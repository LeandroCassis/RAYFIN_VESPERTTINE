//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Inline demo data so the starter dashboard renders the moment it's deployed —
 * no semantic-model connection required. Replace these arrays with your own
 * inline data, a `fetch`, or a `useSemanticModelQuery` + `toChartData` result.
 * Keep rows long/tidy (one row per category × series) so Graphein can read them.
 */

export const revenueByMonth = [
    { month: "Jan", revenue: 82000 },
    { month: "Feb", revenue: 91000 },
    { month: "Mar", revenue: 88000 },
    { month: "Apr", revenue: 104000 },
    { month: "May", revenue: 118000 },
    { month: "Jun", revenue: 132000 },
];

export const salesByRegion = [
    { region: "West", sales: 240000 },
    { region: "East", sales: 198000 },
    { region: "Central", sales: 152000 },
    { region: "South", sales: 121000 },
];

export const channelMix = [
    { channel: "Direct", share: 44 },
    { channel: "Partner", share: 31 },
    { channel: "Online", share: 25 },
];
