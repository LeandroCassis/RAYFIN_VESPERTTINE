//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Dev-only component gallery. Renders the kit's visuals — Envy chart specs in
 * `ChartCard`s, `KpiCard`s, slicers, and the state tiles — with static sample
 * data so the look + behavior can be eyeballed (and AI-reviewed) without a live
 * semantic model. Excluded from the production build — see `gallery.html`.
 */

import { useState } from "react";

import {
    ChartCard,
    ChartSkeleton,
    DateRangeSlicer,
    DropdownSlicer,
    EmptyTile,
    ErrorTile,
    FilterBar,
    KpiCard,
    ListSlicer,
    RangeSlicer,
    SearchSlicer,
    Sparkline,
    type ChartSpec,
    type SlicerOption,
} from "@/components/dashboard";
import { useThemeContext } from "@/hooks/theme.context";

import {
    categoryShare,
    channelLong,
    monthlyRevenue,
    priceVsUnits,
    regionQuarter,
    regionRevenue,
    revenueProfitLong,
} from "./sample-data";

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground-secondary">
                {title}
            </h2>
            {children}
        </section>
    );
}

/* ----------------------------- Chart specs ------------------------------ *
 * One JSON spec per visual. Authored WITHOUT a `theme` — `ChartCard` injects
 * the app's CSS-token theme (and re-themes on the toggle below). Module-level
 * constants keep their identity stable across renders, so toggling the theme
 * cross-fades instead of replaying the entrance animation.
 * ------------------------------------------------------------------------ */

const lineSpec: ChartSpec = {
    type: "line",
    data: revenueProfitLong,
    points: true,
    encoding: {
        x: { field: "month", type: "temporal" },
        y: { field: "value", type: "quantitative", format: "$,.0f" },
        series: { field: "metric" },
    },
};

const areaSpec: ChartSpec = {
    type: "area",
    data: channelLong,
    stack: true,
    encoding: {
        x: { field: "quarter", type: "ordinal" },
        y: { field: "revenue", type: "quantitative", format: "$,.0f" },
        series: { field: "channel" },
    },
};

const barGroupedSpec: ChartSpec = {
    type: "bar",
    data: channelLong,
    encoding: {
        x: { field: "quarter" },
        y: { field: "revenue", type: "quantitative", format: "$,.0f" },
        series: { field: "channel" },
    },
};

const barStackedSpec: ChartSpec = {
    type: "bar",
    data: channelLong,
    stack: true,
    encoding: {
        x: { field: "quarter" },
        y: { field: "revenue", type: "quantitative", format: "$,.0f" },
        series: { field: "channel" },
    },
};

const barRankedSpec: ChartSpec = {
    type: "bar",
    data: regionRevenue,
    encoding: {
        x: { field: "region", type: "nominal" },
        y: { field: "revenue", type: "quantitative", format: "$,.2s" },
    },
};

const scatterSpec: ChartSpec = {
    type: "scatter",
    data: priceVsUnits,
    encoding: {
        x: { field: "price", type: "quantitative", format: "$,.0f" },
        y: { field: "units", type: "quantitative" },
        size: { field: "margin", title: "Margin" },
    },
};

const donutSpec: ChartSpec = {
    type: "pie",
    data: categoryShare,
    donut: 0.6,
    encoding: {
        theta: { field: "value", type: "quantitative", format: "$,.0f" },
        color: { field: "category" },
    },
};

const heatmapSpec: ChartSpec = {
    type: "heatmap",
    data: regionQuarter,
    scheme: "teal",
    encoding: {
        x: { field: "quarter" },
        y: { field: "region" },
        color: { field: "revenue", type: "quantitative", format: "$,.2s" },
    },
};

const categoryOptions: SlicerOption[] = categoryShare.map((row) => ({
    value: row.category,
    label: row.category,
    count: row.value,
}));
const regionOptions: SlicerOption[] = regionRevenue.map((row) => ({
    value: row.region,
    label: row.region,
}));

/** Slicer toolbar + an inline list slicer, all driving shared filter state. */
function SlicersDemo() {
    return (
        <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex-1">
                <FilterBar>
                    <DropdownSlicer
                        label="Category"
                        field="Product[Category]"
                        options={categoryOptions}
                    />
                    <DropdownSlicer
                        label="Region"
                        field="Geography[Region]"
                        options={regionOptions}
                        multiple={false}
                    />
                    <SearchSlicer
                        label="Product"
                        field="Product[Name]"
                        placeholder="Search products…"
                    />
                    <DateRangeSlicer label="Date" field="Date[Date]" />
                    <RangeSlicer
                        label="Price"
                        field="Product[Price]"
                        min={0}
                        max={1000}
                    />
                </FilterBar>
            </div>
            <div className="w-full lg:w-56">
                <ChartCard title="Inline list slicer">
                    <ListSlicer
                        label="Category"
                        field="Product[Category]"
                        options={categoryOptions}
                    />
                </ChartCard>
            </div>
        </div>
    );
}

export function Gallery() {
    const { isDark, toggleTheme } = useThemeContext();
    const [showStates, setShowStates] = useState(true);

    return (
        <div className="min-h-screen bg-background px-6 py-8 text-foreground">
            <div className="mx-auto flex max-w-6xl flex-col gap-10">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-semibold tracking-tight">
                            Data app kit gallery
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Envy chart specs · KPI cards · slicers · state tiles
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground-secondary hover:bg-card-hover"
                    >
                        {isDark ? "☀ Light" : "☾ Dark"}
                    </button>
                </header>

                <Section title="KPIs">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <KpiCard
                            label="Revenue"
                            value={341_500}
                            valueFormat="currency"
                            delta={9.2}
                            deltaLabel="vs last month"
                            trend={monthlyRevenue.map((row) => row.revenue)}
                        />
                        <KpiCard
                            label="Profit"
                            value={95_700}
                            valueFormat="currency"
                            delta={10.8}
                            trend={monthlyRevenue.map((row) => row.profit)}
                        />
                        <KpiCard
                            label="Orders"
                            value={2_233}
                            delta={8.2}
                            trend={monthlyRevenue.map((row) => row.orders)}
                        />
                        <KpiCard
                            label="Conversion"
                            value={0.051}
                            valueFormat="ratio"
                            delta={-0.4}
                            invertDelta
                            secondary={
                                <Sparkline
                                    data={monthlyRevenue}
                                    dataKey="orders"
                                />
                            }
                        />
                    </div>
                </Section>

                <Section title="Slicers & filters">
                    <SlicersDemo />
                </Section>

                <Section title="Line & area">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <ChartCard
                            title="Revenue & profit"
                            subtitle="Monthly, 2024 · multi-series line"
                            spec={lineSpec}
                        />
                        <ChartCard
                            title="Channel mix"
                            subtitle="Quarterly revenue · stacked area"
                            spec={areaSpec}
                        />
                    </div>
                </Section>

                <Section title="Bars">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <ChartCard
                            title="Grouped"
                            subtitle="By quarter & channel"
                            spec={barGroupedSpec}
                        />
                        <ChartCard
                            title="Stacked"
                            subtitle="By quarter & channel"
                            spec={barStackedSpec}
                        />
                        <ChartCard
                            title="Ranked by region"
                            subtitle="Single measure"
                            spec={barRankedSpec}
                        />
                    </div>
                </Section>

                <Section title="Scatter & pie">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <ChartCard
                            title="Price vs units"
                            subtitle="Bubble size = margin"
                            spec={scatterSpec}
                        />
                        <ChartCard
                            title="Category share"
                            subtitle="Donut"
                            spec={donutSpec}
                        />
                    </div>
                </Section>

                <Section title="Heatmap">
                    <ChartCard
                        title="Revenue by region & quarter"
                        subtitle="Category × category → color"
                        spec={heatmapSpec}
                        height={280}
                    />
                </Section>

                <Section title="States">
                    <label className="flex items-center gap-2 text-sm text-foreground-secondary">
                        <input
                            type="checkbox"
                            checked={showStates}
                            onChange={(event) =>
                                setShowStates(event.target.checked)
                            }
                        />
                        Show loading / empty / error tiles
                    </label>
                    {showStates && (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            <ChartCard title="Loading">
                                <ChartSkeleton />
                            </ChartCard>
                            <ChartCard title="Empty">
                                <EmptyTile message="No rows match the current filters" />
                            </ChartCard>
                            <ChartCard title="Error">
                                <ErrorTile
                                    error={new Error("Query failed: timeout")}
                                    onRetry={() => undefined}
                                />
                            </ChartCard>
                        </div>
                    )}
                </Section>
            </div>
        </div>
    );
}
