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
 * Every visual is one **Graphein `ChartSpec`** (a single JSON object) dropped into a
 * `<ChartCard spec={…} />`. The card owns the theme, axes, tooltips, number
 * formatting, dark mode, and loading/empty/error states — so you author data +
 * a spec, never chart code. The template ships no mock data, so the tiles below
 * start empty. To build your dashboard:
 *
 *   1. Declare a connection in `fabric.yaml` and run `npm run build:fabric`.
 *   2. Add a DAX query, fetch it with `useSemanticModelQuery(...)`, and map the
 *      result to rows with `toChartData(...)`.
 *   3. Author a `ChartSpec` for each tile and pass it to `<ChartCard spec={…}>`
 *      (KPIs → `KpiCard`, tabular → `DataTableCard`).
 *
 * See `AGENTS.md` and the `visuals` skill for the spec reference + examples.
 */
function App() {
    return (
        <PageShell
            title="Your data app"
            subtitle="A starter canvas — one JSON spec per visual"
            actions={<ThemeToggle />}
        >
            {/* Onboarding hero — delete once you start building. */}
            <section className="overflow-hidden rounded-2xl border border-border bg-accent-gradient">
                <div className="flex flex-col gap-5 p-6 sm:p-8">
                    <div className="flex flex-col gap-2">
                        <span className="w-fit rounded-full border border-border-strong/60 bg-card/60 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            Spec-first dashboards
                        </span>
                        <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            Build a stunning dashboard — describe it, don&apos;t
                            hand-code it.
                        </h2>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Each chart is a single JSON spec rendered by Graphein. Map
                            your semantic-model data to rows, write the spec, and
                            drop it into a card — the card owns the theme, axes,
                            tooltips, number formatting, dark mode, and
                            loading/empty states.
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
                    <ChartCard title="Trend" subtitle="A line or area spec">
                        <EmptyTile
                            message="Map a time-series query and pass a line spec to ChartCard"
                            height={260}
                        />
                    </ChartCard>
                    <ChartCard title="Breakdown" subtitle="A bar or pie spec">
                        <EmptyTile
                            message="Map a categorical query and pass a bar spec to ChartCard"
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
        title: "Author a spec",
        body: "Write one Graphein ChartSpec per visual and drop it into <ChartCard spec={…}/>; use KpiCard and DataTableCard for stats and tables.",
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
 * COPY-PASTE STARTER: one real KPI + two chart specs, fully wired
 * (fetch → map → spec). Replace the `App` above with this, then swap the
 * connection alias, DAX, and column names for your model's. This is the entire
 * pattern — no mock data; the cards own the loading / empty / error states.
 *
 * Keep DAX results LONG (tidy): one row per category/time point. For multiple
 * series, add a category column and set `encoding.series` — no client-side
 * pivot needed. For a KPI value + delta + trend in one call use `deriveKpi(...)`;
 * for ranked bars use `topN(...)`. See the `visuals` skill for the full
 * spec reference and examples.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
 * import {
 *   PageShell, KpiGrid, ChartGrid, ThemeToggle,
 *   KpiCard, ChartCard, toChartData,
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
 *   // Map once; the specs reference these names. Explicit aliases = stable keys.
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
 *         <ChartCard
 *           title="Revenue trend"
 *           loading={isLoading}
 *           error={error}
 *           onRetry={refetch}
 *           spec={{
 *             type: "line",
 *             data: rows,
 *             encoding: {
 *               x: { field: "month", type: "temporal" },
 *               y: { field: "revenue", type: "quantitative", format: "$,.0f" },
 *             },
 *           }}
 *         />
 *         <ChartCard
 *           title="Revenue by month"
 *           loading={isLoading}
 *           error={error}
 *           onRetry={refetch}
 *           spec={{
 *             type: "bar",
 *             data: rows,
 *             encoding: {
 *               x: { field: "month" },
 *               y: { field: "revenue", type: "quantitative", format: "$,.0f" },
 *             },
 *           }}
 *         />
 *       </ChartGrid>
 *     </PageShell>
 *   );
 * }
 */

export default App;
