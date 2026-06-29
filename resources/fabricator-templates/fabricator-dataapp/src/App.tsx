//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
    Card,
    ChartCard,
    DashboardGrid,
    DateRangeSlicer,
    DropdownSlicer,
    EmptyTile,
    FilterBar,
    FilterStateProvider,
    PageShell,
    Section,
    SelectionStoreProvider,
    Stat,
    StatStrip,
    ThemeToggle,
    Tile,
} from "@/components/dashboard";

/**
 * Starter dashboard — your canvas, and the **canonical layout recipe**.
 *
 * Every visual is one **Graphein `ChartSpec`** (a single JSON object) dropped into a
 * `<ChartCard spec={…} />`. The card owns the theme, axes, tooltips, number
 * formatting, dark mode, and loading/empty/error states — so you author data +
 * a spec, never chart code. The look is **Graphein-native by default** (teal
 * accent, slate neutrals, the 10-hue palette) — rebrand by editing the tokens in
 * `src/global.css`, not by coloring specs.
 *
 * The layout below is the golden path — copy its shape, then swap in your data:
 *
 *   - **`PageShell`** — the page frame (editorial masthead: eyebrow + title +
 *     actions) with a `toolbar` row that already holds the **slicers**. Use
 *     `SidebarShell` for a filter-heavy app with a persistent rail.
 *   - **`FilterStateProvider` + `FilterBar` + slicers** — one shared filter
 *     model every tile can read; ships wired by default. `SelectionStoreProvider`
 *     adds Power BI–style cross-filtering: a chart click dims that chart's own
 *     unpicked marks and re-queries every other tile (see the wired copy-paste).
 *   - **`StatStrip` + `Stat`** — one hairline-divided metric band (not four
 *     look-alike KPI boxes).
 *   - **`DashboardGrid` + `Tile size="…"`** — a 12-col canvas; vary tile sizes
 *     (`sm` `md` `lg` `wide` `hero` `full`) for an editorial, non-uniform layout
 *     instead of a uniform grid.
 *
 * The template ships no mock data, so the tiles start empty and the slicers show
 * no options. To build your app:
 *
 *   1. Declare a connection in `fabric.yaml` and run `npm run build:fabric`.
 *   2. Add a DAX query, fetch it with `useSemanticModelQuery(...)`, and map the
 *      result to rows with `toChartData(...)`.
 *   3. Author a `ChartSpec` per tile and pass it to `<ChartCard spec={…}>`
 *      (KPIs → `StatStrip`/`Stat` or `KpiCard`, tabular → `DataTableCard`).
 *   4. Populate the slicers with `useSlicerOptions(...)` and apply the shared
 *      selections with `applyFilters(rows, selections)` (or `toDaxFilters`).
 *
 * See `AGENTS.md` and the `app-design` / `visuals` skills for the full recipe +
 * spec reference. A wired copy-paste version of this exact layout is at the
 * bottom of this file.
 */
function Dashboard() {
    return (
        <PageShell
            eyebrow="Your workspace"
            title="Your data app"
            subtitle="A starter canvas — one JSON spec per visual, Graphein-themed"
            actions={<ThemeToggle />}
            toolbar={
                // Slicers ship wired to shared filter state. Swap options={[]}
                // for useSlicerOptions({ connection, field }) once a model is
                // connected; the same selections drive every tile.
                <FilterBar>
                    <DropdownSlicer
                        label="Region"
                        field="Geography[Region]"
                        options={[]}
                    />
                    <DropdownSlicer
                        label="Category"
                        field="Product[Category]"
                        options={[]}
                    />
                    <DateRangeSlicer label="Date" field="Date[Date]" />
                </FilterBar>
            }
        >
            {/* Onboarding hero — flat feature surface with an accent spine.
                Delete once you start building. */}
            <Card variant="feature" accent="brand" className="overflow-hidden">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <span className="w-fit font-mono text-[11px] uppercase tracking-[0.18em] text-primary-strong">
                            Spec-first dashboards
                        </span>
                        <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            Build a stunning dashboard — describe it, don&apos;t
                            hand-code it.
                        </h2>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Each chart is a single JSON spec rendered by Graphein and
                            themed straight from the tokens in src/global.css. Map
                            your semantic-model data to rows, write the spec, and
                            drop it into a card — the card owns the theme, axes,
                            tooltips, number formatting, dark mode, and
                            loading/empty states. The toolbar slicers above already
                            share one filter model.
                        </p>
                    </div>

                    <ol className="grid gap-3 sm:grid-cols-3">
                        {STEPS.map((step, index) => (
                            <li
                                key={step.title}
                                className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4"
                            >
                                <span className="font-mono text-xs text-primary-strong">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <span className="font-display text-sm font-semibold text-foreground">
                                    {step.title}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {step.body}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            </Card>

            {/* Live canvas — the real layout, awaiting your data. */}
            <Section
                title="Your canvas"
                subtitle="Replace these tiles with kit components wired to your queries"
            >
                {/* Metric band — one strip, not four look-alike boxes. */}
                <StatStrip>
                    {KPI_PLACEHOLDERS.map((kpi) => (
                        <Stat
                            key={kpi.label}
                            label={kpi.label}
                            value="—"
                            accent={kpi.accent}
                            secondary="Connect a query to populate"
                        />
                    ))}
                </StatStrip>

                {/* Varied grid — mix Tile sizes for editorial rhythm. */}
                <DashboardGrid>
                    <Tile size="hero">
                        <ChartCard
                            title="Trend"
                            subtitle="A line or area spec"
                            className="h-full"
                            bodyClassName="flex flex-1 flex-col"
                        >
                            <EmptyTile
                                message="Map a time-series query and pass a line spec to ChartCard"
                                height={320}
                                className="flex-1"
                            />
                        </ChartCard>
                    </Tile>
                    <Tile size="md">
                        <ChartCard title="Breakdown" subtitle="A bar spec">
                            <EmptyTile
                                message="Map a categorical query and pass a bar spec"
                                height={200}
                            />
                        </ChartCard>
                    </Tile>
                    <Tile size="md">
                        <ChartCard title="Composition" subtitle="A pie or donut spec">
                            <EmptyTile
                                message="Map a share query and pass a pie spec"
                                height={200}
                            />
                        </ChartCard>
                    </Tile>
                    <Tile size="full">
                        <ChartCard title="Detail" subtitle="A table or matrix spec">
                            <EmptyTile
                                message="Map a query and pass a table spec to DataTableCard"
                                height={200}
                            />
                        </ChartCard>
                    </Tile>
                </DashboardGrid>
            </Section>
        </PageShell>
    );
}

const STEPS = [
    {
        title: "Connect a model",
        body: "Add a semantic-model connection in fabric.yaml, then run npm run build:fabric.",
    },
    {
        title: "Query with DAX",
        body: "Fetch rows with useSemanticModelQuery(...) and shape them via toChartData(...).",
    },
    {
        title: "Author & cross-filter",
        body: "Write one Graphein ChartSpec per visual, drop it into <ChartCard spec={…}/>. Slicers filter every tile; clicking a chart dims its own marks and cross-filters the rest (Power BI–style).",
    },
] as const;

const KPI_PLACEHOLDERS = [
    { label: "Metric one", accent: "chart-1" },
    { label: "Metric two", accent: "chart-2" },
    { label: "Metric three", accent: "chart-3" },
    { label: "Metric four", accent: "chart-4" },
] as const;

function App() {
    return (
        <FilterStateProvider>
            <SelectionStoreProvider>
                <Dashboard />
            </SelectionStoreProvider>
        </FilterStateProvider>
    );
}

/*
 * ───────────────────────────────────────────────────────────────────────────
 * COPY-PASTE STARTER: the golden-path layout, fully wired (fetch → map → spec)
 * with slicers over shared filter state AND Power BI–style cross-filtering on by
 * default — clicking a bar dims that chart's unpicked marks while every OTHER
 * tile re-queries (server-side DAX) for the click. Replace the connection alias,
 * DAX, and column names for your model's. The cards own loading/empty/error.
 *
 * Keep DAX results LONG (tidy): one row per category/time point. For multiple
 * series, add a category column and set `encoding.series` — no client-side
 * pivot needed. For ranked bars use `topN(...)`. See the `visuals` skill for the
 * full spec reference and examples.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * import { useMemo } from "react";
 * import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
 * import {
 *   PageShell, ThemeToggle, StatStrip, Stat,
 *   DashboardGrid, Tile, ChartCard, toChartData, applyFilters,
 *   FilterStateProvider, FilterBar, DropdownSlicer, DateRangeSlicer,
 *   SelectionStoreProvider, useFilterState, useSlicerOptions,
 *   useCrossHighlight, crossHighlightParams, toDaxFilters,
 * } from "@/components/dashboard";
 *
 * const REGION = "Geography[Region]";
 * const REVENUE_BY_REGION = `
 *   EVALUATE
 *   SUMMARIZECOLUMNS('Geography'[Region], "Revenue", [Total Revenue], "Orders", [Order Count])
 *   ORDER BY 'Geography'[Region]
 * `;
 *
 * function Dashboard() {
 *   const filters = useFilterState();
 *   const region = useSlicerOptions({ connection: "sales", field: REGION });
 *   // Power BI–style source: clicks dim THIS chart's bars, cross-filter the rest.
 *   const pick = useCrossHighlight(REGION);
 *
 *   // OTHER tiles filter to the click + slicers (server-side DAX re-query).
 *   const dax = toDaxFilters(filters.selections);
 *   const { data, isLoading, error, refetch } = useSemanticModelQuery({
 *     connection: "sales", query: REVENUE_BY_REGION, filters: dax,
 *   });
 *   const rows = toChartData(data, { columns: { Region: REGION, revenue: "Revenue", orders: "Orders" } });
 *   // The SOURCE bar keeps ALL bars (dims unpicked) — exclude its own field:
 *   const barRows = useMemo(() => applyFilters(rows, pick.own(filters.selections)), [rows, filters.selections]);
 *
 *   return (
 *     <PageShell eyebrow="Sales" title="Revenue overview" subtitle="FY24"
 *       actions={<ThemeToggle />}
 *       toolbar={
 *         <FilterBar>
 *           <DropdownSlicer label="Region" field={REGION}
 *             options={region.options} isLoading={region.isLoading} error={region.error} />
 *           <DateRangeSlicer label="Date" field="Date[Date]" />
 *         </FilterBar>
 *       }
 *     >
 *       <StatStrip>
 *         <Stat label="Revenue" data={rows} valueKey="revenue" valueFormat="currency" accent="chart-1" loading={isLoading} />
 *         <Stat label="Orders" data={rows} valueKey="orders" loading={isLoading} />
 *       </StatStrip>
 *
 *       <DashboardGrid>
 *         <Tile size="hero">
 *           <ChartCard title="Revenue by region" className="h-full" store={pick.store}
 *             loading={isLoading} error={error} onRetry={refetch}
 *             spec={{ type: "bar", data: barRows,
 *               encoding: { x: { field: "Region" }, y: { field: "revenue", type: "quantitative", format: "$,.0f" } },
 *               ...crossHighlightParams(REGION, [REGION]) }} />
 *         </Tile>
 *         <Tile size="md">
 *           <ChartCard title="Orders by region" store={pick.store}
 *             loading={isLoading} error={error} onRetry={refetch}
 *             spec={{ type: "bar", data: rows,
 *               encoding: { x: { field: "Region" }, y: { field: "orders", type: "quantitative" } } }} />
 *         </Tile>
 *       </DashboardGrid>
 *     </PageShell>
 *   );
 * }
 *
 * function App() {
 *   return (
 *     <FilterStateProvider>
 *       <SelectionStoreProvider>
 *         <Dashboard />
 *       </SelectionStoreProvider>
 *     </FilterStateProvider>
 *   );
 * }
 */

export default App;
