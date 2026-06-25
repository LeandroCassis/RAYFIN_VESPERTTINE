---
name: visual-style-recipes
description: Use when generating chart and data grid visuals. Provides guidance for consistent, polished data visualizations.

---
# Visual Style Recipes

Styling guidance for dashboard kit chart and data grid visuals — theming, dark mode, layout, and chart-specific patterns.

---

## Theming

### How theming works

All visual styling flows from CSS custom properties defined in `src/global.css`. Kit components read these variables at runtime — edit `global.css` to theme everything.

- **Light mode** values go in the `@theme` block
- **Dark mode** overrides go in the `.dark` block
- Changes cascade automatically to all charts and grids

The important tokens are `--color-primary`, `--color-primary-soft`, `--color-background`, `--color-card`, `--color-border`, `--color-ring`, `--color-brand`, `--color-chart-1` through `--color-chart-6`, `--font-display`, `--font-sans`, `--font-mono`, and the radius scale (`--radius-sm` through `--radius-3xl`, plus `--radius-full`).

### Custom theme colors

Chart cards auto-theme from the design tokens. Compose the kit and pass mapped data; do not pass a separate chart theme object.

```tsx
import { LineChartCard, toChartData } from "@/components/dashboard";

const rows = toChartData(data);

<LineChartCard
  title="Revenue trend"
  loading={isLoading}
  error={error}
  data={rows}
  xKey="Month"
  series={[{ key: "Revenue", color: "chart-1" }]}
  valueFormat="currency"
/>;
```

Edit `--color-chart-1` through `--color-chart-6` in `global.css` (and the `.dark` block) to change series and categorical colors. The accent is a single swappable family: recolor `--color-primary`, `--color-primary-soft`, `--color-primary-strong`, `--color-chart-1`, `--color-ring`, and `--color-brand` together.

### Data color alignment

Validate that chart data colors fit the app's current visual theme and design direction. Prefer kit color names in series configs: chart tokens (`"chart-1"`…`"chart-6"`) for ordered series and semantic roles (`"success"`, `"warning"`, `"info"`, `"brand"`, `"neutral"`) when the color carries meaning.

```tsx
<BarChartCard
  title="Revenue by region"
  data={rows}
  xKey="Region"
  series={[
    { key: "Actual", color: "chart-1" },
    { key: "Target", color: "neutral" },
  ]}
  valueFormat="currency"
/>;
```

### Chart typography alignment

Validate that chart text styling fits the app's current theme and typography direction. Kit chart axes, legends, tooltips, and cards inherit from `--font-sans`, `--font-display`, and `--font-mono`; update those tokens rather than styling each chart independently.

- Keep chart font family aligned with the primary app font choice.
- Adjust card titles and surrounding layout density to match the type hierarchy.
- Re-check label legibility after changing theme colors, since typography and color contrast must work together.

### Axis and label color consistency

Axis labels, gridlines, cursors, and tooltip surfaces come from chart tokens such as `--color-chart-axis`, `--color-chart-grid`, `--color-chart-cursor`, `--color-card`, and `--color-foreground-secondary`. Keep those token mappings consistent across all charts to avoid mismatched label colors.

---

## Layout

### Chart container sizing

Use `PageShell`, `KpiGrid`, and `ChartGrid` for dashboard structure. Chart cards own their responsive chart container; set the card `height` prop only when a specific visual needs more or less vertical space.

```tsx
import {
  PageShell,
  ThemeToggle,
  KpiGrid,
  ChartGrid,
  KpiCard,
  LineChartCard,
  DonutChartCard,
  DataTableCard,
  toChartData,
  toDataTable,
} from "@/components/dashboard";

const chartRows = toChartData(data);
const table = toDataTable(data, columnMetadata);

<PageShell title="Sales overview" actions={<ThemeToggle />}>
  <KpiGrid>
    <KpiCard label="Revenue" value={revenue} valueFormat="currency" accent="chart-1" />
    <KpiCard label="Margin" value={margin} valueFormat="percent" accent="success" />
  </KpiGrid>
  <ChartGrid>
    <LineChartCard title="Revenue trend" data={chartRows} xKey="Month" series={[{ key: "Revenue", color: "chart-1" }]} valueFormat="currency" />
    <DonutChartCard title="Sales mix" data={chartRows} nameKey="Channel" valueKey="Sales" valueFormat="currency" colors={["chart-1", "chart-2", "chart-3"]} />
    <DataTableCard title="Details" data={table} pageSize={10} />
  </ChartGrid>
</PageShell>;
```

### Chart container height chain

Charts must fill their card's visible height — no dead space, no cropping. With kit cards, the height chain is mostly handled for you:

1. **Grid/flex cell** → provides the width and placement
2. **Card wrapper** → `ChartCard`/chart card owns the rounded card shell
3. **Tile body** → state handling reserves the requested height
4. **Chart renderer** → responsive chart fills that body

If a chart appears squished, first check the surrounding grid or flex parent, then adjust the card `height` prop. Do not wrap chart cards in fixed-height containers unless the whole dashboard section needs that constraint.

The kit's `DataTableCard` already wraps the Fabric DataGrid in a rounded, scrollable, themed container.

### `minHeight` vs `height` for chart containers

Validate that containers provide a definite height when a section relies on full-height cards.

- `height` creates a definite height and allows full-height wrappers to resolve correctly.
- `minHeight` alone does not create a definite height for flex/grid children and can lead to squished charts in standalone sections.

Use layout-aware checks:

- Grid layouts: `minHeight` on the grid container is generally acceptable because grid tracks provide definite row heights.
- Standalone full-width chart sections: prefer explicit `height` on the section/container when using full-height card wrappers.

### Chart titles in cards

Use the kit card `title` and `subtitle` props for dashboard cards. Scale the surrounding page headings to match the app's type hierarchy.

- The title should summarize what the chart shows in plain language (e.g., "Monthly Revenue by Region", "Top 10 Products by Units Sold").
- Derive the title from the data fields and the intent of the visualization — do not use generic titles like "Chart" or "Bar Chart".
- If the user provides a title, use it as-is. Otherwise, infer a good title from the query and encodings.

> **Layout creativity**: Consider mixed card spans, a full-width hero row, asymmetric column ratios, or generous negative space between sections. The layout should reinforce the aesthetic direction.

---

## Named Styles

The kit exposes named color conventions through component props. Use these instead of raw hex values.

| Convention | Use case | Effect |
|---|---|---|
| `color: "chart-1"`…`"chart-6"` | Ordered series / categories | Uses the tokenized chart palette and dark-mode overrides |
| `color: "success"` | Positive state, healthy KPI, increase | Maps to semantic success colors |
| `color: "warning"` / `"info"` | Attention or informational series | Keeps meaning consistent across cards |
| `valueFormat="currency"` / `"percent"` / `"compact"` | Numbers in KPIs, axes, legends, tooltips | Centralized formatting with no per-chart formatter boilerplate |

Usage in a chart card:

```tsx
<AreaChartCard
  title="Pipeline coverage"
  data={rows}
  xKey="Month"
  series={[{ key: "Coverage", color: "success" }]}
  valueFormat="ratio"
/>;
```

---

## Soft Guidance

These produce good results. Deviate when the design calls for it.

### Card content spacing

Content areas inside a card should use consistent horizontal padding that matches the card header. The kit cards already do this; keep custom `ChartCard` children aligned with the same rhythm.

### Bar corner radius

The kit uses a consistent rounded bar treatment that follows the app's flat, modern radius system. If you use the Recharts escape hatch for a bespoke bar shape, choose sharp or rounded corners deliberately and apply that choice consistently across all bar charts.

### Grouped bar charts

Use multiple `series` entries for grouped bars. Use `stacked` when the analytic intent is contribution-to-total rather than side-by-side comparison.

```tsx
<BarChartCard
  title="Actual vs target"
  data={rows}
  xKey="Region"
  series={[{ key: "Actual", color: "chart-1" }, { key: "Target", color: "chart-2" }]}
  valueFormat="currency"
/>;
```

### Trend cards

Use `LineChartCard` for precise trend comparison and `AreaChartCard` when the filled shape helps emphasize volume. Add `referenceLines` for goals or thresholds.

```tsx
<LineChartCard
  title="Monthly recurring revenue"
  data={rows}
  xKey="Month"
  series={[{ key: "MRR", color: "chart-1" }]}
  valueFormat="currency"
  referenceLines={[{ y: target, label: "Target" }]}
/>;
```

### Pie / Donut

Use `DonutChartCard` for categorical share with a value + percent legend. Use `colors` only when the default palette needs tighter alignment with the app's direction.

```tsx
<DonutChartCard
  title="Sales by channel"
  data={rows}
  nameKey="Channel"
  valueKey="Sales"
  valueFormat="currency"
  colors={["chart-1", "chart-2", "chart-3", "chart-4"]}
/>;
```

### KPI rows

Use `KpiGrid` with `KpiCard` for a compact metric row. Use `accent` to connect each KPI to the chart palette or a semantic role; use `invertDelta` for down-is-good measures such as churn, cost, or latency.

```tsx
<KpiGrid>
  <KpiCard label="Revenue" value={revenue} valueFormat="currency" delta={revenueDelta} deltaLabel="vs prior period" accent="chart-1" />
  <KpiCard label="Churn" value={churn} valueFormat="percent" delta={churnDelta} deltaLabel="vs prior period" accent="warning" invertDelta />
</KpiGrid>;
```

### Tables

Use `DataTableCard` for Fabric DataGrid output. Map query tables with `toDataTable(table, columnMetadata)`; the card handles theming, scrolling, sorting, filtering, resizing, loading, empty, and error states.

```tsx
const table = toDataTable(data, columnMetadata);

<DataTableCard
  title="Top accounts"
  loading={isLoading}
  error={error}
  data={table}
  pageSize={10}
/>;
```

---

## Workarounds

Most dashboard visuals should be composed from `KpiCard`, `LineChartCard`, `AreaChartCard`, `BarChartCard`, `DonutChartCard`, `DataTableCard`, `PageShell`, `KpiGrid`, and `ChartGrid`.

If a visualization genuinely is not in the kit (scatter, radar, treemap, waterfall, heatmap, or a combo chart), use the `visuals` skill escape hatch: wrap a Recharts implementation in `ChartCard`, use `ChartTooltip`, `useChartTheme`, `seriesColor`/`roleColor`, and token colors such as `var(--color-chart-1)`. Do not hardcode hex colors.

---

## DataGrid

Use the kit wrapper instead of wiring Fabric DataGrid directly. `DataTableCard` reads the CSS theme internally and passes it to the underlying grid.

```tsx
import { DataTableCard, toDataTable } from "@/components/dashboard";

const table = toDataTable(data, columnMetadata);

<DataTableCard title="Accounts" data={table} loading={isLoading} error={error} />;
```

Font, spacing, border, focus, scrollbar, and dark-mode styles are controlled by CSS variables in `global.css` and cascade automatically.
