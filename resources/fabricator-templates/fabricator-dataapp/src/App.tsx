//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
    ChartCard,
    ChartGrid,
    KpiCard,
    KpiGrid,
    PageShell,
    Section,
    ThemeToggle,
    EmptyTile,
} from "@/components/dashboard";

/**
 * Starter dashboard — your canvas.
 *
 * This is a real, composed layout built entirely from the dashboard kit
 * (`PageShell` → `KpiGrid` / `ChartGrid` → `KpiCard` / `ChartCard`). Every
 * tile is intentionally empty: the template never ships mock data. To build
 * your dashboard:
 *
 *   1. Declare a connection in `fabric.yaml` and run `npm run build:fabric`.
 *   2. Add a DAX query, fetch it with `useSemanticModelQuery(...)`, and map
 *      the result with `toChartData(...)`.
 *   3. Swap the empty tiles below for kit components, passing your data.
 *
 * See `AGENTS.md` and the `visuals` skill for the full component catalog.
 */
function App() {
    return (
        <PageShell
            title="Your data app"
            subtitle="A starter canvas — compose it from the dashboard kit"
            actions={<ThemeToggle />}
        >
            {/* Onboarding hero — delete once you start building. */}
            <section className="overflow-hidden rounded-2xl border border-border bg-accent-gradient">
                <div className="flex flex-col gap-5 p-6 sm:p-8">
                    <div className="flex flex-col gap-2">
                        <span className="w-fit rounded-full border border-border-strong/60 bg-card/60 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            Dashboard kit
                        </span>
                        <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            Build a stunning dashboard — compose it, don&apos;t
                            hand-code it.
                        </h2>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Pick components from the kit and pass your semantic
                            model data. The cards own the theme, axes, tooltips,
                            number formatting, dark mode, and loading/empty
                            states — so you write data, not chart code.
                        </p>
                    </div>

                    <ol className="grid gap-3 sm:grid-cols-3">
                        {STEPS.map((step, index) => (
                            <li
                                key={step.title}
                                className="flex flex-col gap-1 rounded-xl border border-border bg-card/70 p-4"
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
            </section>

            {/* Live canvas — the real layout, awaiting your data. */}
            <Section
                title="Your canvas"
                subtitle="Replace these tiles with kit components wired to your queries"
            >
                <KpiGrid>
                    {KPI_PLACEHOLDERS.map((kpi) => (
                        <KpiCard
                            key={kpi.label}
                            label={kpi.label}
                            value="—"
                            accent={kpi.accent}
                            deltaLabel="Connect a query to populate"
                        />
                    ))}
                </KpiGrid>

                <ChartGrid>
                    <ChartCard
                        title="Trend"
                        subtitle="LineChartCard / AreaChartCard / ComboChartCard"
                    >
                        <EmptyTile
                            message="Map a time-series query and drop in a LineChartCard"
                            height={260}
                        />
                    </ChartCard>
                    <ChartCard
                        title="Breakdown"
                        subtitle="BarChartCard / DonutChartCard / FunnelChartCard"
                    >
                        <EmptyTile
                            message="Map a categorical query and drop in a BarChartCard"
                            height={260}
                        />
                    </ChartCard>
                </ChartGrid>
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
        title: "Compose the kit",
        body: "Pass your data to KpiCard, LineChartCard, BarChartCard, ComboChartCard, GaugeCard, FunnelChartCard, DataTableCard, and more.",
    },
] as const;

const KPI_PLACEHOLDERS = [
    { label: "Metric one", accent: "chart-1" },
    { label: "Metric two", accent: "chart-4" },
    { label: "Metric three", accent: "chart-5" },
    { label: "Metric four", accent: "chart-6" },
] as const;

/*
 * ───────────────────────────────────────────────────────────────────────────
 * COPY-PASTE STARTER: one real tile, fully wired (fetch → map → pass).
 * Replace the `App` above with this, then swap the connection alias, DAX, and
 * column names for your model's. This is the entire pattern — no mock data;
 * the cards own the loading / empty / error states.
 *
 * For multi-series, pivot a long DAX result with `pivotChartData(...)`; for a
 * KPI value + delta + trend in one call use `deriveKpi(...)`; for ranked bars
 * use `topN(...)`. See the `visuals` skill for the full catalog.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
 * import {
 *   PageShell, KpiGrid, ChartGrid, ThemeToggle,
 *   KpiCard, LineChartCard, BarChartCard, toChartData,
 * } from "@/components/dashboard";
 *
 * const REVENUE_BY_MONTH = `
 *   EVALUATE
 *   SUMMARIZECOLUMNS(
 *     'Date'[Month],
 *     "Revenue", [Total Revenue]
 *   )
 *   ORDER BY 'Date'[Month]
 * `;
 *
 * function App() {
 *   const { data, isLoading, error, refetch } = useSemanticModelQuery({
 *     connection: "sales",                 // a profile from fabric.yaml
 *     query: REVENUE_BY_MONTH,
 *   });
 *
 *   // Map once; the cards key off these names. Explicit aliases = stable keys.
 *   const rows = toChartData(data, {
 *     columns: { month: "Date[Month]", revenue: "Revenue" },
 *   });
 *
 *   return (
 *     <PageShell title="Sales overview" subtitle="FY24" actions={<ThemeToggle />}>
 *       <KpiGrid>
 *         <KpiCard
 *           label="Revenue"
 *           data={rows}
 *           valueKey="revenue"
 *           valueFormat="currency"
 *           accent="chart-1"
 *           loading={isLoading}
 *           error={error}
 *           onRetry={refetch}
 *         />
 *       </KpiGrid>
 *       <ChartGrid>
 *         <LineChartCard
 *           title="Revenue trend"
 *           data={rows}
 *           xKey="month"
 *           series={[{ key: "revenue", label: "Revenue", color: "chart-1" }]}
 *           valueFormat="currency"
 *           loading={isLoading}
 *           error={error}
 *           onRetry={refetch}
 *         />
 *         <BarChartCard
 *           title="Revenue by month"
 *           data={rows}
 *           xKey="month"
 *           series={[{ key: "revenue", label: "Revenue" }]}
 *           valueFormat="currency"
 *           loading={isLoading}
 *           error={error}
 *           onRetry={refetch}
 *         />
 *       </ChartGrid>
 *     </PageShell>
 *   );
 * }
 */

export default App;
