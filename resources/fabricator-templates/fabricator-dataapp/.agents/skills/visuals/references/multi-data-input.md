# Multiple Series & Overlays

Most multi-value visuals are just **multiple `series` on one chart card** — no
special data plumbing. Map the DAX result into one array of row objects (each
row carries every measure for that x value) and declare a `series` entry per
measure. The kit never joins tables for you: shape one array, then declare
series.

## Multiple series from one query

One query returning several measures per x → one row object per x, several
series:

```tsx
const rows = toChartData(result); // [{ Month: "Jan", Revenue: 84200, Cost: 51000 }, …]

<LineChartCard
  title="Revenue vs cost"
  data={rows}
  xKey="Month"
  series={[
    { key: "Revenue", color: "chart-1" },
    { key: "Cost",    color: "chart-3" },
  ]}
  valueFormat="currency"
/>
```

## Long → wide: pivot a tidy result

The most common multi-series source is a **long/tidy** DAX result where one
column holds the *category* and another the *value* (e.g.
`SUMMARIZECOLUMNS('Date'[Month], 'Product'[Category], "Revenue", [Total Revenue])`
→ `(Month, Category, Revenue)`). Don't hand-roll a `Map` loop — `pivotChartData`
reshapes it to wide rows **and** returns the matching `series[]`:

```tsx
const { rows, series, xKey } = pivotChartData(result, {
  x: "Date[Month]",
  series: "Product[Category]",  // its distinct values become the series
  value: "Revenue",
  order: "total-desc",          // biggest categories first (optional)
});

<BarChartCard data={rows} xKey={xKey} series={series} stacked valueFormat="currency" />
```

`series` is the ready-to-spread config (one entry per category, palette colors
by order); pass `colors` in the options to pin specific category colors.

## Merging two queries

When measures come from separate queries (different grain or source), merge them
into one row array in TypeScript keyed by the shared x, then declare series as
above. Do the join in TS, not DAX, when the two results have different grains.

```tsx
const byMonth = new Map<string, Record<string, string | number>>();
for (const r of toChartData(salesResult)) byMonth.set(String(r.Month), { ...r });
for (const r of toChartData(targetResult)) {
  const key = String(r.Month);
  byMonth.set(key, { ...(byMonth.get(key) ?? { Month: r.Month }), Target: r.Target });
}
const rows = [...byMonth.values()];

<LineChartCard
  data={rows}
  xKey="Month"
  series={[
    { key: "Revenue", color: "chart-1" },
    { key: "Target",  color: "neutral" },
  ]}
/>
```

## Stacked series

Bars and areas stack with `stacked` (or share a `stackId`):

```tsx
<BarChartCard
  data={rows}
  xKey="Quarter"
  stacked
  series={[{ key: "New" }, { key: "Expansion" }, { key: "Renewal" }]}
/>
```

## Reference / target lines

A single-value target or average is a `referenceLines` entry — not a second
dataset:

```tsx
<LineChartCard
  data={rows}
  xKey="Month"
  series={[{ key: "Revenue", color: "chart-1" }]}
  referenceLines={[{ y: 1_000_000, label: "Goal" }]}
/>
```

## Subset overlay on a dimmed baseline (highlight)

To emphasize a subset against the whole, keep the baseline as one series and add
the subset as a **second series drawn on top**. Both come from aligned
aggregations sharing the x key; leave the subset value `null` where it doesn't
apply. The subset is a separate aligned DAX aggregation — see `query-design`'s
`highlight-queries` reference.

```tsx
// rows: [{ Category: "A", All: 120, Selected: 120 },
//        { Category: "B", All: 90,  Selected: null }, …]
<BarChartCard
  data={rows}
  xKey="Category"
  series={[
    { key: "All",      color: "neutral" }, // dim baseline
    { key: "Selected", color: "chart-1" }, // bright subset
  ]}
/>
```

Swap what fills `Selected` to change the highlight; drop the second series to
show the baseline alone.

## Keeping every category on the axis

Bars/lines only plot the x values present in the rows. If a sparse measure would
drop categories, left-join the full dimension list onto the measure rows in TS
(fill missing measures with `0`/`null`) before mapping — so every category keeps
its slot.

## Pies / donuts

A donut/pie is one `nameKey` + one `valueKey` over a categorical array — not
multi-series:

```tsx
<DonutChartCard data={rows} nameKey="Channel" valueKey="Sales" valueFormat="currency" />
```

## When you truly need a custom multi-layer chart

Most multi-layer needs are already kit cards: a bar+line **dual-axis combo** is
`ComboChartCard`, and x/y/bubble correlation is `ScatterChartCard` — reach for
those before a custom chart. Only for marks the cards don't cover (radar,
treemap, waterfall) use the **escape hatch** — build on the chart core inside a
`ChartCard` (see the
visuals catalog). You still pass plain arrays and the kit's theme helpers —
there is no spec or dataset registry to manage.
