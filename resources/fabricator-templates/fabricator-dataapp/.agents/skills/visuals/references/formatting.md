# Visual Formatting & Color

How to format numbers/dates and color series in the kit. **Formatting lives in
the component layer, never in DAX** — emit raw typed numbers from queries and
format them here so charts can scale axes and tables can sort.

## Where formatting lives

| Surface | How to format |
|---|---|
| Chart cards (line/area/bar/donut) + `KpiCard` | the `valueFormat` prop (values) + `xFormat` prop (x-axis ticks) |
| `DataTableCard` / `DataGrid` | per-column `format` in `columnMetadata` (a VBA/ECMA-376 string) |
| Anywhere in JSX | call a formatter from `@/components/dashboard` directly |

## Formatting by default

The kit fills in safe formatting so a chart reads correctly the moment you pass
data — you only override when you want something specific:

- **Date x-axis** — when the x values are real dates (ISO-like) and you didn't
  pass `xFormat`, ticks auto-format with `formatDate`. Plain category labels
  ("Jan", "Q1", a bare year) are deliberately left untouched.
- **Y-axis width** — sized automatically from the widest formatted tick, so long
  currency / compact labels never clip (no hand-tuned axis width).
- **Compact numbers** — the `"number"` default already groups and compacts ≥ 10k
  on axes.

What the kit will **not** do is guess a value's **unit**. Bare numbers can't
reveal whether `0.42` is a ratio, a count, or 42¢ — so currency / percent / ratio
stay an explicit one-word `valueFormat`. An explicit `xFormat` / `valueFormat`
always wins over the inferred default.

## `valueFormat` (charts + KPI)

Accepts a preset string or a function `(n: number) => string`:

| value | renders | use for |
|---|---|---|
| `"number"` | grouped, compact ≥ 10k | counts, generic scalars (default) |
| `"compact"` | K / M / B / T | large magnitudes, axis ticks |
| `"currency"` | `$1,234.00` | money |
| `"percent"` | `42.0%` (expects a 0–100 value) | rates already in percent |
| `"ratio"` | `42%` (expects a 0–1 value) | ratios / shares |
| `(n) => …` | your own | anything custom |

```tsx
<BarChartCard … valueFormat="currency" />
<KpiCard … valueFormat={(n) => `${formatCompact(n)} CU`} />
```

`xFormat` formats the x-axis category/tick (commonly dates):

```tsx
<LineChartCard … xKey="Month" xFormat={(m) => formatDate(m, "short")} />
```

The standalone formatters the presets are built from are all exported and
null/NaN-safe (non-finite → em dash): `formatNumber`, `formatCompact`,
`formatCurrency`, `formatPercent`, `formatDelta`, `formatRatio`, `formatDate`.

## Table column formats

`DataTableCard` / `DataGrid` format each cell from that column's `format`
(VBA/ECMA-376) string in `columnMetadata`:

```tsx
const data = toDataTable(result, [
  { name: "month", displayName: "Month" },
  { name: "revenue", displayName: "Revenue", format: "$#,0.00" },
  { name: "margin", displayName: "Margin", format: "0.0%" },
]);
```

- `"#,0"` general integers/counts · `"$#,0.00"` currency · `"0.0%"` percent ·
  `"mm/dd/yyyy"` dates.
- A `cellRenderer` **overrides** `format` (it receives the raw value and owns its
  own formatting) — see [data-grid-visual.md](data-grid-visual.md).
- **Exception:** values that are numbers but read as identifiers (a year, an ID)
  should not be number-formatted.

## Number rules

- Prefer `"compact"` on axes and KPI heroes so large numbers stay legible; show
  full grouped values in tooltips and tables.
- Currency → 2 decimals; counts → 0.
- Never `FORMAT()` a measure to text in DAX — emit raw numerics. (See
  `query-design`.)

## Colors

Series colors come from the **chart token palette**: six tokens
`--color-chart-1` … `--color-chart-6` defined in `global.css`, plus semantic
roles. Reference them by token, never raw hex, so charts re-theme in dark mode.

| In a `series` / `colors` prop | resolves to |
|---|---|
| `"chart-1"` … `"chart-6"` | the Nth palette token |
| `"brand"` / `"success"` / `"danger"` / `"warning"` / `"info"` / `"neutral"` | semantic role token |
| `"--color-…"` or `var(--color-…)` | that CSS variable |
| `"#rrggbb"` | literal hex (avoid — won't re-theme) |

```tsx
series={[
  { key: "Revenue", color: "chart-1" },
  { key: "Target",  color: "neutral" },
]}
```

Omit `color` and series fall back to the palette in order (`seriesColor(i)`).

### Consistent categorical colors

When the same category (a region, a status) appears in more than one visual,
give it a fixed color so it reads the same everywhere. Discover the distinct
values first (see `query-design`), then build a `name → token` map and pass it
through each chart's `series` / `colors`:

```tsx
const REGION_COLOR = { East: "chart-1", West: "chart-2", North: "chart-3", South: "chart-4" };
```

Don't rely on incidental row ordering to keep colors stable across charts.

### Accessibility

The six palette tokens are pre-tuned for contrast. If you author a custom
palette, keep each series ≥ **3:1** against the card background and alternate
contrast (~±2 ratio) between neighbors so adjacent series never blend.

## Restyling everything at once

Every chart, grid, and card reads its look from CSS custom properties in
`src/global.css`. Override these to restyle the whole app; put light values in
the base scope and dark overrides under `.dark`.

| What to change | CSS variable(s) |
|---|---|
| Accent (one swap recolors charts/links/focus) | `--color-primary`, `--color-chart-1`, `--color-brand`, `--color-ring` |
| Series palette | `--color-chart-1` … `--color-chart-6` |
| Chart axes / grid / cursor | `--color-chart-axis`, `--color-chart-grid`, `--color-chart-cursor` |
| Text | `--color-foreground`, `--color-foreground-secondary`, `--color-foreground-muted` |
| Surfaces / borders | `--color-background`, `--color-card`, `--color-popover`, `--color-border`, `--color-border-strong` |
| Fonts | `--font-display`, `--font-sans`, `--font-mono` |
| Radius | `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl` |

Unlike the old theme, the **series palette is fully customizable** — recolor the
`--color-chart-*` tokens and every chart follows.
