---
name: visuals
description: >
  Use when adding charts, KPIs, tables, slicers, or any visual to a dashboard.
  This is the dashboard KIT catalog: a curated set of pre-built, themed
  components you COMPOSE by passing data — you should rarely hand-write SVG or
  raw JSX. Charts are fully custom (D3 math + SVG, no charting library). Covers
  KpiCard, the chart cards (line/area/bar/combo/scatter/donut/gauge/funnel/
  bullet), DataTableCard, slicers (dropdown/list/search/date-range/range +
  FilterBar) with shared filter state, Tableau-like coordinated interactions
  (click-to-cross-filter, cross-highlight, drill-down), layout (PageShell/grids/
  bento), controls, state tiles, the DAX-mapping helpers (toChartData /
  toDataTable / pivotChartData / topN / deriveKpi), value formatting, color
  tokens, and the custom-chart escape hatch.
---

# Visuals — the dashboard kit (compose, don't hand-code)

**Pick a component from the kit and pass it data.** The kit lives in
`src/components/dashboard/` and is exported from a single barrel
(`@/components/dashboard`). Each card owns its theme, axes, gridlines,
tooltip, legend, number/date formatting, dark mode, and loading/empty/error
states — so you write *data*, not chart code. Writing a bespoke SVG chart or a
hand-rolled `<div>` grid is the slow, expensive, error-prone path; reach
for it only when nothing in the kit fits (see [Escape hatch](#escape-hatch)).

Charts are **fully custom D3/SVG** (built on `d3-scale`/`d3-shape` math + React
SVG — no Recharts, no charting library). Tables are the Fabric **DataGrid**.
There is no Vega-Lite.

## Fast path

Optimize *time to wow*: ship one real tile, deploy, review, iterate.

**Phase 1 — Hero slice:** render ONE compelling, real visual the simplest
way — a single `KpiCard` or `LineChartCard`/`BarChartCard` fed your hero
query. Map the DAX result with `toChartData(...)`, pass `loading`/`error`
straight from the query hook, and you're done. That is enough to deploy.

```tsx
import { LineChartCard, toChartData } from "@/components/dashboard";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";

const { data, isLoading, error } = useSemanticModelQuery({ connection, query });
const rows = toChartData(data); // pass the query result straight in

<LineChartCard
  title="Revenue"
  loading={isLoading}
  error={error}
  data={rows}
  xKey="Month"
  series={[{ key: "Revenue", color: "chart-1" }]}
  valueFormat="currency"
/>
```

**Phase 2 — Breadth:** add the remaining KPIs/charts/table, wrapping them in
`PageShell` + `KpiGrid`/`ChartGrid`. Deploy + review every 1–2 additions.

**Phase 3 — Polish:** slicers + cross-filtering (`FilterStateProvider` +
`FilterBar`/`DropdownSlicer`/…, or click-to-cross-filter via `useCrossFilter`),
lightweight controls (`SegmentedControl`/`FilterChips`), reference lines,
sparklines in KPI cards, donut breakdowns, and final formatting.

Read the per-component props below only when you reach for that component.
Every component also carries a JSDoc usage snippet — hover it or open the file.

## The two-step data flow

Every tile follows the same shape. **Map once, pass to the card.**

1. **Fetch** with `useSemanticModelQuery({ connection, query })` →
   `{ data, isLoading, error }` (see the `query-design` + `fabric-sdk` skills).
2. **Map** the DAX result into the shape the card wants. Both helpers accept the
   query result, a raw `QueryTable`, or `undefined` — no `status` check needed:
   - **Charts** want an array of row objects → `toChartData(result, options?)`.
   - **DataGrid** wants a `DataTable` → `toDataTable(result, columnMetadata)`.
3. **Pass** `data` + `loading` + `error` to the card. Don't pre-render
   skeletons/empty states yourself — the cards do it.

```tsx
// DAX rows are positional (unknown[][]); toChartData keys them by column
// (short) name and coerces numeric columns to numbers.
const rows = toChartData(data);
// rows → [{ Month: "Jan", Revenue: 84200 }, …]

// Prefer explicit aliases — stable lowercase keys, and the only safe option
// when two columns share a short name (e.g. Date[Month] + Ship[Month]):
const rows2 = toChartData(data, {
  columns: { month: "Date[Month]", revenue: "Total Revenue" },
});
// rows2 → [{ month: "Jan", revenue: 84200 }, …]
```

### Shape helpers (multi-series · ranked · KPI)

Three helpers map common DAX result shapes straight into a card's props — so
you never hand-write a pivot loop, a sort, or a delta calc. All accept the
query result, a `QueryTable`, or `undefined`.

- **`pivotChartData(result, { x, series, value, order? })`** — reshape a
  **long** result (`x, category, value` — one row per combo) into **wide**
  rows AND the matching `series[]` (keys + order). Spread both into a
  multi-series line/area/bar card. Replaces the manual `Map` pivot.
- **`topN(rows, valueKey, n, { other?, ascending? })`** — sort + slice already
  mapped rows for ranked bars / leaderboards, with an optional `"Other"` rollup.
- **`deriveKpi(result, { valueKey })`** → `{ value, previous, delta, trend }` —
  one call feeds a `KpiCard`'s value + delta + sparkline from a time series.

```tsx
// Long result → stacked multi-series bars, no pivot loop:
const { rows, series, xKey } = pivotChartData(data, {
  x: "Date[Month]", series: "Product[Category]", value: "Revenue",
  order: "total-desc",
});
<BarChartCard title="Revenue by category" data={rows} xKey={xKey}
  series={series} stacked valueFormat="currency" />

// Time series → KPI value + delta + sparkline in one call:
const kpi = deriveKpi(data, { valueKey: "Revenue" });
<KpiCard label="Revenue" value={kpi.value ?? undefined} valueFormat="currency"
  delta={kpi.delta ?? undefined} trend={kpi.trend} deltaLabel="vs last month" />
```

## Import surface

```tsx
import {
  // layout
  PageShell, KpiGrid, ChartGrid, Section, BentoGrid, BentoItem, ThemeToggle,
  // controls
  SegmentedControl, FilterChips,
  // slicers + shared filter state
  FilterStateProvider, useFilterState, FilterBar,
  DropdownSlicer, ListSlicer, SearchSlicer, DateRangeSlicer, RangeSlicer,
  // coordinated interactions (Tableau-like)
  useCrossFilter, useDrilldown, DrilldownBreadcrumb,
  useSlicerOptions, applyFilters, toDaxFilters,
  // cards
  KpiCard, ChartCard, DataTableCard,
  // charts
  LineChartCard, AreaChartCard, BarChartCard, ComboChartCard, ScatterChartCard,
  DonutChartCard, PieChartCard, GaugeCard, FunnelChartCard, BulletChartCard,
  ProgressBar, Sparkline, ChartTooltip, ChartFrame, AnimatedNumber,
  // state tiles
  EmptyTile, ErrorTile, ChartSkeleton, KpiSkeleton, TileBody,
  // DAX-mapping helpers
  toChartData, toDataTable, pivotChartData, topN, deriveKpi,
  formatNumber, formatCompact, formatCurrency, formatPercent, formatDate,
  seriesColor, roleColor, useChartTheme,
} from "@/components/dashboard";
```

## Shared conventions

- **`valueFormat`** (charts + KPI): `"number" | "compact" | "currency" |
  "percent" | "ratio"` or a `(n: number) => string` function. `"percent"`
  expects a 0–100 value; `"ratio"` expects 0–1.
- **Colors** accept a chart token (`"chart-1"`…`"chart-6"`), a semantic role
  (`"success" | "danger" | "warning" | "info" | "brand" | "neutral"`),
  a `var(--…)`, or a hex string. Prefer tokens so charts re-theme with dark
  mode. Series default to the palette in order.
- **State props** (`loading`, `error`, `emptyMessage`, `onRetry`) are shared
  by every chart/table card. Pass the query hook's `isLoading`/`error`
  directly; the card renders skeleton → error → empty → content.
- **Never ship mock/fake data.** A tile with no data shows the empty state.

### Responsive, legends & formatting — by default

The kit handles these three so you rarely configure them — and never burn a
deploy to discover a chart clipped, squished, or mis-scaled:

- **Responsive height.** Every chart scales with its container (an aspect ratio,
  clamped ~200–360px) — short on a phone, taller in a wide bento tile. You rarely
  set `height`; pass `height={n}` only to pin a fixed pixel height, or `aspect={n}`
  to tune the shape (lower = taller).
- **Legends.** Multi-series charts legend automatically. Position with
  `legendPlacement="top" | "right" | "bottom" | "none"` (default `"top"`; the
  donut defaults to `"right"`). No prop wiring, no manual `<Legend>`.
- **Formatting.** Date x-axes auto-format and the Y-axis width auto-sizes to the
  widest tick, so labels never clip. You still pass `valueFormat` for *units*
  (currency / percent / ratio) — the kit deliberately never guesses a unit from
  bare numbers. See [Formatting by default](references/formatting.md#formatting-by-default).

---

## Layout

### `PageShell`
The page frame: sticky blurred header (title / subtitle / actions) over a
centered, max-width column. Put `<ThemeToggle />` (and filters) in `actions`.

```tsx
<PageShell title="Sales overview" subtitle="FY24" actions={<ThemeToggle />}>
  <KpiGrid>{/* KpiCards */}</KpiGrid>
  <ChartGrid>{/* ChartCards */}</ChartGrid>
</PageShell>
```

- **`KpiGrid`** — fluid auto-fit grid (~220px min) — any number of KPI cards flow
  cleanly (3 or 5 no longer leave a ragged gap).
- **`ChartGrid`** — fluid auto-fit grid (~380px min) for chart cards.
- **`Section`** — titled grouping (`title`, `subtitle`, `action`) for a band
  of tiles.
- **`ThemeToggle`** — light/dark button wired to the app theme context.

### `BentoGrid` / `BentoItem`
For varied, editorial layouts — a wide hero chart beside a stack of KPIs, a
tall trend next to short tiles. A 12-column grid on `lg` that collapses to one
column on small screens; set each item's `colSpan` (1–12) and optional
`rowSpan` (1–3). Reach for it over `ChartGrid` when you want non-uniform card
sizes (the `app-design` skill asks for this — avoid a uniform spreadsheet grid).

```tsx
<BentoGrid>
  <BentoItem colSpan={8}><ComboChartCard title="Revenue & margin" … /></BentoItem>
  <BentoItem colSpan={4}><GaugeCard title="Quota" value={72} target={100} valueFormat="percent" /></BentoItem>
  <BentoItem colSpan={4}><KpiCard label="MRR" … /></BentoItem>
  <BentoItem colSpan={4}><KpiCard label="Churn" … /></BentoItem>
  <BentoItem colSpan={4}><KpiCard label="NRR" … /></BentoItem>
</BentoGrid>
```

## Controls (filters)

Controlled — own the value in `useState`, then filter your mapped rows (or
re-query; see `query-design`).

```tsx
const [range, setRange] = useState("30d");
<SegmentedControl
  value={range} onChange={setRange}
  options={[{ label: "7D", value: "7d" }, { label: "30D", value: "30d" }]}
/>

const [regions, setRegions] = useState<string[]>([]);
<FilterChips value={regions} onChange={setRegions} options={regionOptions} />
```

- **`SegmentedControl<T>`** — single-select pill group (`size?: "sm" | "md"`).
- **`FilterChips<T>`** — multi-select chip row (`value` is an array).

These are **lightweight, self-managed** controls (you own the `useState` and
filter rows yourself). For **Power BI-style slicers** that auto-share selection
across the whole dashboard (and drive cross-filtering), use the slicer suite +
`FilterStateProvider` below instead.

---

## Slicers & shared filter state

Slicers are real filter controls wired to one **shared filter model**. Wrap the
dashboard in `<FilterStateProvider>` once; every slicer (and every chart click)
reads/writes the same selections. Then **apply** those selections one of two
ways: `applyFilters(rows, selections)` (instant, client-side) or
`toDaxFilters(selections)` (re-query the model — see `query-design`).

```tsx
import {
  FilterStateProvider, useFilterState, FilterBar,
  DropdownSlicer, DateRangeSlicer, RangeSlicer,
  applyFilters, BarChartCard, toChartData,
} from "@/components/dashboard";

function Dashboard() {
  return (
    <FilterStateProvider>
      <FilterBar>
        <DropdownSlicer label="Category" field="Product[Category]" options={catOptions} />
        <DateRangeSlicer label="Date" field="Date[Date]" />
        <RangeSlicer label="Price" field="Product[Price]" min={0} max={1000} />
      </FilterBar>
      <RevenueByRegion />
    </FilterStateProvider>
  );
}

function RevenueByRegion() {
  const { selections } = useFilterState();
  const rows = applyFilters(toChartData(data), selections); // client-side filter
  return <BarChartCard data={rows} xKey="Region" series={[{ key: "Revenue" }]} />;
}
```

Every slicer works **connected** (pass `field` → shared state) OR **controlled**
(pass `value` + `onChange`). Connected mode is a no-op outside a provider, so a
single tile stays safe.

- **`DropdownSlicer`** — popover single/multi-select with search, select-all/
  clear, and per-value counts. `options: SlicerOption[]` (`{ value, label, count? }`).
- **`ListSlicer`** — the same list rendered inline (for a sidebar).
- **`SearchSlicer`** — a text `contains` filter.
- **`DateRangeSlicer`** — from/to dates + relative presets (Last 7/30/90, MTD, YTD, All).
- **`RangeSlicer`** — dual-thumb numeric min/max.
- **`FilterBar`** — toolbar that hosts slicers + shows active-filter chips + "Clear all".

Fetch a slicer's distinct values straight from the model with
**`useSlicerOptions({ connection, field, measure?, orderBy?, top? })`** →
`{ options, isLoading, error }` (a `SUMMARIZECOLUMNS` + `TOPN` DAX query).
Full guide: [slicers & filter state](references/slicers.md).

---

## Coordinated interactions (Tableau-like)

Built on the same filter state — clicking a chart mark filters the rest.

**Cross-filter + cross-highlight:** spread `useCrossFilter(field)` onto any
interactive chart card. A click toggles that category in shared state; selected
marks stay vivid while the rest dim across every connected card.

```tsx
const cross = useCrossFilter("Region[Region]");
<BarChartCard data={rows} xKey="Region" series={[{ key: "Revenue" }]} {...cross} />
// cross = { selectedKeys, onSelect, dimUnselected }
```

**Drill-down:** `useDrilldown(id, levels)` advances through a field hierarchy on
click; pair it with `<DrilldownBreadcrumb>` to climb back up.

```tsx
const drill = useDrilldown("geo", [{ field: "Geo[Country]" }, { field: "Geo[City]" }]);
<DrilldownBreadcrumb drilldown={drill} rootLabel="All" />
<BarChartCard data={rows} xKey={drill.xKey} series={[{ key: "Revenue" }]}
  onSelect={drill.drillInto} />
```

Cards expose the interaction contract (`MarkInteraction`: `onSelect`,
`selectedKeys`, `dimUnselected`) — the cartesian cards (`LineChartCard` /
`AreaChartCard` / `BarChartCard`) respond to clicks; donut and scatter currently
show hover tooltips only. Full guide: [coordinated interactions](references/interactions.md).

---

## Cards

### `KpiCard`
Hero metric tile: big formatted value, colored delta pill, optional accent
dot / badge / icon, and an optional sparkline slot (`children`).

```tsx
<KpiCard
  label="Revenue"
  data={rows}             // derive the value from the first row…
  valueKey="revenue"      // …reading this column
  valueFormat="currency"
  secondary="vs $1.1M last month"   // optional muted sub-value
  delta={12.4}            // signed % vs baseline → green/red pill
  deltaLabel="vs last month"
  accent="chart-1"
  loading={isLoading}
  error={error}
  invertDelta={false}     // set true when down-is-good (cost, churn, latency)
>
  <Sparkline data={trend} color="chart-1" />
</KpiCard>
```

Pass either a literal `value` **or** `data` + `valueKey` (reads the first row).
With no value and no rows it renders the empty state — never a fake `0`.

> **Empty card with data present?** `valueKey` must match a column name **exactly**
> (case-sensitive) as it appears in your mapped rows. A mismatch (wrong casing, an
> un-aliased DAX name like `[Total Revenue]`, or forgetting `toChartData`) makes the
> card fall back to its empty state. In dev the console prints the available keys —
> alias columns in `toChartData({ columns: { revenue: "Total Revenue" } })` for stable keys.

Props: `label`, `value` (number→formatted, or string) **or** `data` + `valueKey`,
`valueFormat`, `secondary`, `delta`, `deltaLabel`, `invertDelta`, `accent`,
`icon`, `badge`, `loading`, `error`, `emptyMessage`, `onRetry`, `children`.

### `ChartCard`
Titled card shell (rounded-2xl, hairline border, no shadow) wrapping any
chart or content. The chart cards below use it internally; use it directly
only for custom content or the [escape hatch](#escape-hatch).

```tsx
<ChartCard title="Revenue" subtitle="Last 12 months" action={<FilterChips … />}>
  {/* any chart or content */}
</ChartCard>
```

Props: `title`, `subtitle`, `action`, `footer`, `bodyClassName`, `children`.

### `DataTableCard`
Fabric `DataGrid` inside the card shell — sortable, filterable, resizable,
themed for light/dark. See [data-grid-visual.md](references/data-grid-visual.md)
for custom cell rendering and [data-table.md](references/data-table.md) for
the `DataTable` shape.

```tsx
const table = toDataTable(data, columnMetadata); // result → DataTable

<DataTableCard title="Top accounts" loading={isLoading} error={error}
  data={table} pageSize={10} />
```

Props: `data` (a `DataTable`), `height`, `rowHeight`, `pageSize`, plus the
shared state props.

---

## Charts

All chart cards share `ChartCardCommonProps` (`title`, `subtitle`, `action`,
`className`, `loading`, `error`, `emptyMessage`, `onRetry`) and render the
right state automatically.

### `LineChartCard` / `AreaChartCard`
Time series, single or multi-series. `AreaChartCard` fills under the line and
supports `stacked`.

```tsx
<LineChartCard
  title="Revenue" subtitle="Last 12 months"
  loading={isLoading} error={error}
  data={rows}
  xKey="Month"
  xFormat={(m) => formatDate(m, "short")}
  series={[
    { key: "Revenue", label: "Revenue", color: "chart-1" },
    { key: "Target",  label: "Target",  color: "neutral" },
  ]}
  valueFormat="currency"
  referenceLines={[{ y: 1_000_000, label: "Goal" }]}
/>
```

### `BarChartCard`
Grouped or stacked bars (`stacked`), vertical by default. Set `horizontal`
for ranked horizontal bars (category on the Y axis) — ideal for "top N"
breakdowns. Bars plot in row order, so sort `rows` by value first.

```tsx
<BarChartCard title="Revenue by region" data={rows} xKey="Region"
  series={[{ key: "Revenue" }]} valueFormat="currency" />

// Ranked horizontal bars — categories down the Y axis, sorted by value:
<BarChartCard title="Top regions" horizontal data={rows} xKey="region"
  series={[{ key: "revenue", label: "Revenue" }]} valueFormat="currency" />
```

Cartesian chart props: `data` (mapped rows), `xKey`, `series`
(`{ key, label?, color?, stackId? }[]`), `height`/`aspect` (responsive by
default), `valueFormat`, `xFormat` (auto for dates), `showGrid`, `showLegend`,
`legendPlacement`, `stacked`, `layout`/`horizontal` (bar), `curve` (line/area),
`referenceLines`.

### `DonutChartCard` / `PieChartCard`
Categorical share with a value + % legend. The donut center shows the total
by default.

```tsx
<DonutChartCard title="Sales by channel" data={rows}
  nameKey="Channel" valueKey="Sales" valueFormat="currency" />
```

Props: `data`, `nameKey`, `valueKey`, `colors?`, `height` (max donut size),
`valueFormat`, `donut`, `centerLabel`, `showLegend`, `legendPlacement`
(`"top" | "right" | "bottom"`, default `"right"`), plus shared state props.

### `ComboChartCard`
Bars **plus** line(s), with an optional **dual Y axis** so a different-unit
trend (a margin %, a conversion rate) overlays value bars without being
flattened. The classic "revenue bars + margin line" combo.

```tsx
<ComboChartCard
  title="Revenue & margin" data={rows} xKey="Month"
  bars={[{ key: "Revenue", label: "Revenue", color: "chart-1" }]}
  lines={[{ key: "Margin", label: "Margin %", color: "chart-4" }]}
  valueFormat="currency"        // left axis (bars)
  rightValueFormat="percent"    // right axis (lines)
/>
```

Props: `data`, `xKey`, `bars` / `lines` (`SeriesConfig[]`), `valueFormat`,
`rightValueFormat`, `rightAxis?` (default on when both bars+lines present),
`stacked`, `curve`, `referenceLines`, `xFormat`, `height`/`aspect`,
`legendPlacement`, plus shared state props.

### `ScatterChartCard`
X/Y correlation, with optional **bubble** sizing (`sizeKey`) and categorical
**grouping** (`series` splits points into themed, legended groups).

```tsx
<ScatterChartCard
  title="Discount vs margin" data={rows}
  xKey="DiscountRate" yKey="GrossMargin"
  sizeKey="Revenue" series="Segment"
  xFormat="ratio" valueFormat="ratio" sizeName="Revenue"
/>
```

Props: `data`, `xKey`, `yKey`, `sizeKey?`, `series?`, `xFormat`, `valueFormat`,
`sizeName?`, `height`/`aspect`, `showGrid`, `showLegend`, `legendPlacement`,
plus shared state props.

### `GaugeCard`
A single metric vs a target (or max) as a radial gauge with a big centered
value. Pass `thresholds` to color the arc by attainment.

```tsx
<GaugeCard
  title="Quota attainment" value={72} target={100} valueFormat="percent"
  thresholds={[{ at: 0, color: "danger" }, { at: 60, color: "warning" }, { at: 90, color: "success" }]}
/>
```

Props: `value`, `target?` **or** `max?`, `valueFormat`, `thresholds?`
(`{ at, color }[]`, greatest `at ≤ %` wins), `label?`, `height`/`aspect`,
`startAngle`/`endAngle`, plus shared state props.

### `FunnelChartCard`
Ordered stage conversion (lead → opportunity → win) sized by value, with
per-stage conversion labels (% of the first stage). Auto-sorts descending.

```tsx
<FunnelChartCard title="Pipeline" data={rows}
  stageKey="Stage" valueKey="Accounts" valueFormat="compact" />
```

Props: `data`, `stageKey`, `valueKey`, `valueFormat`, `height`/`aspect`, `sort`
(default true), `showConversion` (default true), plus shared state props.

### `BulletChartCard` / `ProgressBar`
Compact actual-vs-target bars for "progress to goal" lists (quota, budget
burn, OKRs). `BulletChartCard` maps rows to a stack of bars; `ProgressBar` is
the single-bar primitive. A `targetKey`/`target` draws a goal marker and tints
met bars green.

```tsx
<BulletChartCard title="Quota attainment" data={rows}
  labelKey="rep" valueKey="bookings" targetKey="quota" valueFormat="currency" />

<ProgressBar label="Q3 quota" value={82_000} target={100_000} valueFormat="currency" />
```

`BulletChartCard` props: `data`, `labelKey`, `valueKey`, `targetKey?`,
`valueFormat`, `max?`, `color?`, `barHeight?`, plus shared state props.

### `Sparkline`
Compact, axis-less trend for KPI cards / inline cells. Accepts a raw
`number[]` (or objects + `dataKey`).

```tsx
<Sparkline data={[12, 18, 9, 22, 17, 25]} color="chart-1" />
```

### `ChartTooltip`
The themed tooltip the chart cards wire up automatically. You only touch it in a
custom chart — render it inside the `tooltipBoxStyle(x, y, width)` overlay driven
by `useChartTooltip()` (see its JSDoc and `cartesian.tsx`).

## State tiles

Used internally by the cards; use directly only in the escape hatch or for
custom content. `TileBody` is the switchboard (error → loading → empty →
children).

- **`EmptyTile`** (`message`, `icon`, `height`) — friendly no-data state.
- **`ErrorTile`** (`error`, `title`, `onRetry`, `height`).
- **`ChartSkeleton`** / **`KpiSkeleton`** — shimmer placeholders.

---

## Escape hatch

If a visualization genuinely isn't in the kit (e.g. radar, treemap, heatmap,
waterfall), **first consider adding it to the kit** — copy the closest card
(`cartesian.tsx` is the reference) and reuse the custom chart core. For a true
one-off, build it on that same core so it stays themed, responsive, and
dark-mode-correct. There is **no charting library** to fall back on — you draw
SVG, but the core does the hard parts (sizing, scales, axes, tooltip).

The core: `ChartFrame` measures the plot and hands your render-prop the
`{ width, height }`; `d3-scale` maps data → pixels; `useChartTheme()` +
`seriesColor` / `roleColor` give theme-correct colors.

```tsx
import { scaleBand, scaleLinear } from "d3-scale";
import { ChartCard, ChartFrame, useChartTheme, seriesColor } from "@/components/dashboard";

function LollipopCard({ data }: { data: Array<{ label: string; value: number }> }) {
  const theme = useChartTheme();
  const m = { top: 12, right: 16, bottom: 28, left: 8 };
  return (
    <ChartCard title="Score by category">
      <ChartFrame aspect={1.8}>
        {({ width, height }) => {
          const iw = width - m.left - m.right;
          const ih = height - m.top - m.bottom;
          const x = scaleBand<string>()
            .domain(data.map((d) => d.label)).range([0, iw]).padding(0.5);
          const y = scaleLinear()
            .domain([0, Math.max(0, ...data.map((d) => d.value))]).range([ih, 0]).nice();
          return (
            <svg width={width} height={height} role="img">
              <g transform={`translate(${m.left},${m.top})`}>
                {y.ticks(4).map((t) => (
                  <line key={t} x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke={theme.grid} />
                ))}
                {data.map((d) => {
                  const cx = (x(d.label) ?? 0) + x.bandwidth() / 2;
                  return (
                    <g key={d.label}>
                      <line x1={cx} x2={cx} y1={ih} y2={y(d.value)}
                        stroke={theme.grid} strokeWidth={2} />
                      <circle cx={cx} cy={y(d.value)} r={5} fill={seriesColor(0)} />
                      <text x={cx} y={ih + 18} textAnchor="middle" fontSize={11} fill={theme.axis}>
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          );
        }}
      </ChartFrame>
    </ChartCard>
  );
}
```

Rules for the escape hatch:
- Size with `ChartFrame` (responsive aspect + clamps, optional `legend` /
  `legendPlacement`) and its render-prop — never a fixed-height `<svg>`, so your
  chart scales like the built-in ones.
- Scale with `d3-scale`; for kit-perfect axes / gridlines / tooltips reuse the
  core primitives in `@/components/dashboard/charts/*` (`bandScale` / `linearScale`,
  `AxisBottom` / `AxisLeft`, `GridRows`, `useChartTooltip` + `tooltipBoxStyle` +
  the `ChartTooltip` component).
- Color with `useChartTheme()` + `seriesColor` / `roleColor` (or
  `var(--color-chart-n)`) — never hardcode hex, so dark mode keeps working.
- Spread `useCrossFilter(field)` (the `MarkInteraction` contract) onto your marks
  to make a custom chart participate in cross-filtering.
- If you write the same custom chart twice, promote it into the kit.

For the full chart-core walkthrough (primitives + how to add a mark), see
[custom charts](references/custom-charts.md).

For deeper details: [formatting & colors](references/formatting.md),
[multiple series & overlays](references/multi-data-input.md),
[slicers & filter state](references/slicers.md),
[coordinated interactions](references/interactions.md),
[DataGrid cell rendering](references/data-grid-visual.md),
[the `DataTable` shape](references/data-table.md).
