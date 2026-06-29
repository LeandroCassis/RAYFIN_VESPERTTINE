//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
    ChartCard,
    DashboardGrid,
    PageShell,
    Stat,
    StatStrip,
    ThemeToggle,
    Tile,
    type ChartSpec,
} from "@/components/dashboard";
import { channelMix, revenueByMonth, salesByRegion } from "@/data/sample";

/**
 * Starter dashboard — lightweight and any-data.
 *
 * Each visual is one Graphein `ChartSpec` dropped into `<ChartCard spec={…} />`;
 * the card owns theme, axes, formatting, dark mode, and loading/empty/error.
 * Tiles below use inline demo data from `src/data/sample.ts` so it renders with
 * no connection. To go live, query a semantic model with `useSemanticModelQuery`,
 * map the result with `toChartData`, and pass that as `spec.data` (see AGENTS.md
 * + the `connect-semantic-model` skill). Rebrand via `src/global.css`.
 */

const revenueSpec: ChartSpec = {
    type: "line",
    data: revenueByMonth,
    encoding: {
        x: { field: "month", type: "ordinal" },
        y: { field: "revenue", type: "quantitative", format: "$,.0f" },
    },
};

const regionSpec: ChartSpec = {
    type: "bar",
    data: salesByRegion,
    encoding: {
        x: { field: "region", type: "ordinal" },
        y: { field: "sales", type: "quantitative", format: "$,.0f" },
    },
};

const channelSpec: ChartSpec = {
    type: "pie",
    data: channelMix,
    encoding: { theta: { field: "share" }, color: { field: "channel" } },
};

function Dashboard() {
    return (
        <PageShell eyebrow="Your workspace" title="Dashboard" subtitle="Overview" actions={<ThemeToggle />}>
            <StatStrip>
                <Stat label="Revenue" value={615000} valueFormat="currency" accent="chart-1" delta={12.4} />
                <Stat label="Sales" value={711000} valueFormat="currency" delta={4.8} />
                <Stat label="Avg. order" value={284} valueFormat="currency" delta={-1.2} />
            </StatStrip>

            <DashboardGrid>
                <Tile size="hero">
                    <ChartCard title="Revenue" subtitle="Last 6 months" spec={revenueSpec} className="h-full" />
                </Tile>
                <Tile size="md">
                    <ChartCard title="Sales by region" spec={regionSpec} />
                </Tile>
                <Tile size="md">
                    <ChartCard title="Channel mix" spec={channelSpec} />
                </Tile>
            </DashboardGrid>
        </PageShell>
    );
}

export default Dashboard;
