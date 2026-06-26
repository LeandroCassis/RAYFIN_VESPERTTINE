//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Dev-only component gallery. Renders every kit visual with static sample data
 * so the look + behavior can be eyeballed (and AI-reviewed) without a live
 * semantic model. Excluded from the production build — see `gallery.html`.
 */

import { useState } from "react";

import {
    AreaChartCard,
    BarChartCard,
    ChartCard,
    ComboChartCard,
    DateRangeSlicer,
    DonutChartCard,
    DrilldownBreadcrumb,
    DropdownSlicer,
    EmptyTile,
    ErrorTile,
    FilterBar,
    FunnelChartCard,
    GaugeCard,
    KpiCard,
    LineChartCard,
    ListSlicer,
    RangeSlicer,
    ScatterChartCard,
    SearchSlicer,
    Sparkline,
    useDrilldown,
} from "@/components/dashboard";
import type { SlicerOption } from "@/components/dashboard";
import { ChartSkeleton } from "@/components/dashboard/states";
import { useCrossFilter } from "@/hooks/use-cross-filter";
import { useFilterState } from "@/components/dashboard/filters/filter-state";
import { useThemeContext } from "@/hooks/theme.context";

import {
    categoryShare,
    channelRevenue,
    funnelStages,
    monthlyRevenue,
    priceVsUnits,
    regionRevenue,
} from "./sample-data";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-4">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground-secondary">
                {title}
            </h2>
            {children}
        </section>
    );
}

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

const cityByRegion: Record<string, Array<{ city: string; revenue: number }>> =
    Object.fromEntries(
        regionRevenue.map((row) => [
            row.region,
            [
                { city: `${row.region} · North`, revenue: Math.round(row.revenue * 0.5) },
                { city: `${row.region} · Central`, revenue: Math.round(row.revenue * 0.3) },
                { city: `${row.region} · South`, revenue: Math.round(row.revenue * 0.2) },
            ],
        ]),
    );

/** Click-to-drill demo: Region → City, with a breadcrumb to climb back up. */
function DrilldownDemo() {
    const drill = useDrilldown("gallery-geo", [
        { field: "Geography[Region]", xKey: "region" },
        { field: "Geography[City]", xKey: "city" },
    ]);
    const atRoot = drill.level === 0;
    const region = drill.path.length ? String(drill.path[0]) : undefined;
    const data = atRoot
        ? regionRevenue
        : region
          ? (cityByRegion[region] ?? [])
          : [];
    return (
        <ChartCard
            title="Click a bar to drill down"
            subtitle="Region → city; the breadcrumb climbs back up"
            action={
                drill.canDrillUp ? (
                    <button
                        type="button"
                        onClick={drill.drillUp}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground-secondary hover:bg-card-hover"
                    >
                        Back
                    </button>
                ) : null
            }
        >
            <DrilldownBreadcrumb
                drilldown={drill}
                rootLabel="All regions"
                className="mb-3"
            />
            <BarChartCard
                data={data}
                xKey={atRoot ? "region" : "city"}
                series={[{ key: "revenue", label: "Revenue", color: "chart-2" }]}
                valueFormat="currency"
                horizontal
                showLegend={false}
                onSelect={atRoot ? (value) => drill.drillInto(value) : undefined}
            />
        </ChartCard>
    );
}

/** Live click-to-cross-filter demo on the custom bar chart. */
function CrossFilterDemo() {
    const cross = useCrossFilter("Region[Region]");
    const { clearAll, isActive } = useFilterState();
    return (
        <ChartCard
            title="Click a bar to cross-filter"
            subtitle="Tableau-style: selecting a mark dims the rest and drives shared filter state"
            action={
                isActive ? (
                    <button
                        type="button"
                        onClick={clearAll}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground-secondary hover:bg-card-hover"
                    >
                        Clear
                    </button>
                ) : null
            }
        >
            <BarChartCard
                data={regionRevenue}
                xKey="region"
                series={[{ key: "revenue", label: "Revenue", color: "chart-1" }]}
                valueFormat="currency"
                horizontal
                showLegend={false}
                {...cross}
            />
            <p className="mt-2 font-mono text-xs text-foreground-muted">
                selected: {cross.selectedKeys.length ? cross.selectedKeys.join(", ") : "—"}
            </p>
        </ChartCard>
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
                            Dashboard kit gallery
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Custom D3/SVG visuals · slicers · coordinated interactions
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
                            delta={0.092}
                            deltaLabel="vs last month"
                            trend={monthlyRevenue.map((row) => row.revenue)}
                        />
                        <KpiCard
                            label="Profit"
                            value={95_700}
                            valueFormat="currency"
                            delta={0.108}
                            trend={monthlyRevenue.map((row) => row.profit)}
                        />
                        <KpiCard
                            label="Orders"
                            value={2_233}
                            delta={0.082}
                            trend={monthlyRevenue.map((row) => row.orders)}
                        />
                        <KpiCard
                            label="Conversion"
                            value={0.051}
                            valueFormat="percent"
                            delta={-0.004}
                            invertDelta
                            secondary={<Sparkline data={monthlyRevenue} dataKey="orders" />}
                        />
                    </div>
                </Section>

                <Section title="Slicers & filters">
                    <SlicersDemo />
                </Section>

                <Section title="Line & area">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <LineChartCard
                            title="Revenue & profit"
                            subtitle="Monthly, 2024"
                            data={monthlyRevenue}
                            xKey="month"
                            series={[
                                { key: "revenue", label: "Revenue" },
                                { key: "profit", label: "Profit" },
                            ]}
                            valueFormat="currency"
                            referenceLines={[{ y: 250_000, label: "Target" }]}
                        />
                        <AreaChartCard
                            title="Stacked channels"
                            subtitle="Quarterly revenue by channel"
                            data={channelRevenue}
                            xKey="quarter"
                            series={[
                                { key: "online", label: "Online" },
                                { key: "retail", label: "Retail" },
                                { key: "wholesale", label: "Wholesale" },
                            ]}
                            valueFormat="currency"
                            stacked
                        />
                    </div>
                </Section>

                <Section title="Bars">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <BarChartCard
                            title="Grouped"
                            data={channelRevenue}
                            xKey="quarter"
                            series={[
                                { key: "online", label: "Online" },
                                { key: "retail", label: "Retail" },
                                { key: "wholesale", label: "Wholesale" },
                            ]}
                            valueFormat="currency"
                        />
                        <BarChartCard
                            title="Stacked"
                            data={channelRevenue}
                            xKey="quarter"
                            series={[
                                { key: "online", label: "Online" },
                                { key: "retail", label: "Retail" },
                                { key: "wholesale", label: "Wholesale" },
                            ]}
                            valueFormat="currency"
                            stacked
                        />
                        <BarChartCard
                            title="Ranked (horizontal)"
                            data={regionRevenue}
                            xKey="region"
                            series={[{ key: "revenue", label: "Revenue" }]}
                            valueFormat="currency"
                            horizontal
                        />
                    </div>
                </Section>

                <Section title="Combo & scatter">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <ComboChartCard
                            title="Revenue vs orders"
                            data={monthlyRevenue}
                            xKey="month"
                            bars={[{ key: "revenue", label: "Revenue" }]}
                            lines={[{ key: "orders", label: "Orders", color: "chart-3" }]}
                            valueFormat="currency"
                            rightValueFormat="number"
                            rightAxis
                        />
                        <ScatterChartCard
                            title="Price vs units"
                            data={priceVsUnits}
                            xKey="price"
                            yKey="units"
                            sizeKey="margin"
                            xFormat="currency"
                            valueFormat="number"
                        />
                    </div>
                </Section>

                <Section title="Donut · gauge · funnel">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <DonutChartCard
                            title="Category share"
                            data={categoryShare}
                            nameKey="category"
                            valueKey="value"
                            valueFormat="currency"
                            centerLabel="Sales"
                        />
                        <GaugeCard
                            title="Quota attainment"
                            value={341_500}
                            target={300_000}
                            max={400_000}
                            valueFormat="currency"
                            label="Revenue"
                        />
                        <FunnelChartCard
                            title="Activation funnel"
                            data={funnelStages}
                            stageKey="stage"
                            valueKey="count"
                            valueFormat="number"
                        />
                    </div>
                </Section>

                <Section title="Coordinated interactions">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <CrossFilterDemo />
                        <DrilldownDemo />
                    </div>
                </Section>

                <Section title="States">
                    <label className="flex items-center gap-2 text-sm text-foreground-secondary">
                        <input
                            type="checkbox"
                            checked={showStates}
                            onChange={(event) => setShowStates(event.target.checked)}
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
