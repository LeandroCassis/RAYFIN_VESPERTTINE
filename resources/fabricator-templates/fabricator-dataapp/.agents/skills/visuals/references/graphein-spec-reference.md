# Graphein spec reference

Every chart/table is one **`ChartSpec`** — a plain, JSON-serializable object (no
functions, colors, or callbacks). You author it and drop it into
`<ChartCard spec={…} />` or `<DataTableCard spec={…} />`. This file is the
field-by-field reference; the `visuals` SKILL has the workflow and recipes.

> Adapted for Graphein 0.3. The template depends on `graphein` from npm
> (`^0.3.0`). `validateSpec(spec)` (re-exported from `@/components/dashboard`)
> checks a spec against the real schema.

## The one rule

> Emit a single object with a `type`, a `data` array of flat records, and (for
> encoded visuals) an `encoding` that names the columns.

```jsonc
{
  "type": "bar",
  "data": [{ "quarter": "Q1", "revenue": 210 }, { "quarter": "Q2", "revenue": 245 }],
  "encoding": { "x": { "field": "quarter" }, "y": { "field": "revenue", "format": "$,d" } },
  "title": "Quarterly revenue"
}
```

## Shape data as a tidy table

Graphein expects **long/tidy** data: one row per observation, one column per
variable. The *same* table drives every chart — point different channels at
columns. To compare groups, add a `series` channel (`"series": { "field": "region" }`)
— don't pre-pivot into one column per group.

## App conventions (important)

- **Don't author `theme`.** `ChartCard` injects the app's CSS-token theme (brand
  accent + light/dark) automatically. Recolor via `src/global.css`, never per-spec
  hex. Setting `spec.theme` is a deliberate escape hatch only.
- **Don't set `dimensions`.** `ChartCard` sizes charts responsively; table/matrix
  specs get a fixed scrollable height.
- **Tables / pivots:** use `DataTableCard` with a Graphein `table` / `matrix` spec.
  Build tables with `toTable(result, { columns })`; author matrices over
  `toChartData(result)` rows.
- **Horizontal bars are not honored** in this version: `BarSpec` types an
  `orientation` field but the runtime ignores it (bars always render vertical).
  For ranked/top-N, sort rows by value and use a vertical bar.

## Common fields (`BaseSpec`)

Shared by all chart/table specs.

| Field | Type | Notes |
| --- | --- | --- |
| `data` | `Array<Record<string, unknown>>` | **Required.** Row-oriented records. |
| `title` | `string \| { text, subtitle?, align? }` | Chart title. |
| `legend` | `boolean \| { show?, position?, title? }` | `position`: `top \| right \| bottom \| left`. Auto by default. |
| `tooltip` | `boolean \| { show? }` | Hover tooltips, on by default. |
| `axes` | `{ x?: AxisConfig, y?: AxisConfig }` | Per-axis overrides (cartesian). |
| `animation` | `boolean \| { enabled?, duration?, easing? }` | Brief entrance on first render; honors `prefers-reduced-motion`. |
| `description` | `string` | Accessible alt text (auto-synthesized when omitted). |
| `params` | `SelectionParam[]` | Selections this visual publishes. |
| `highlight` | `HighlightConfig \| HighlightConfig[]` | Emphasize matching selection rows, dim the rest. |
| `filter` | `FilterClause[]` | Subset rows; clauses are ANDed. |

`AxisConfig`: `{ show?, title?, grid?, ticks?, tickValues?, format?, labels? }`.

## Encoding & `FieldDef`

Cartesian charts (`line`/`area`/`bar`/`scatter`) plus `pie`/`heatmap`/`funnel` map
columns onto channels via `encoding`.

| Channel | Used by | Purpose |
| --- | --- | --- |
| `x` | line, area, bar, scatter, heatmap | Horizontal position. |
| `y` | line, area, bar, scatter, heatmap | Vertical position. |
| `series` | line, area, bar | Split into multiple series (multi-line, grouped/stacked bars/areas). |
| `size` | scatter | Bubble radius. |
| `color` | heatmap, pie | Continuous color (heatmap) or slice category (pie). |
| `theta` | pie | Slice value. |
| `stage` | funnel | Ordered funnel stage. |
| `value` | funnel | Stage value. |

**`FieldDef`** — `{ field, type?, aggregate?, title?, format?, scale? }`:

- `field` (**required**) — column name; dotted paths (`a.b`) read nested values.
- `type` — `quantitative | temporal | ordinal | nominal` (inferred when omitted).
- `format` — a [format hint](#format-mini-language) for labels/ticks/tooltips.
- `aggregate` — `sum | mean | avg | min | max | count | countDistinct | median |
  first | last` when grouping.

> **Temporal fields:** pass ISO strings (`"2024-01"`, `"2024-01-15"`) or epoch ms
> (JSON has no `Date`), and set `type: "temporal"` for a time axis.

## Selection model

A spec can publish or consume named selections:

```jsonc
{ "type": "bar", "data": rows,
  "params": [{ "name": "pick", "select": { "type": "point", "fields": ["region"] } }],
  "encoding": { "x": { "field": "region" }, "y": { "field": "revenue" } } }

{ "type": "line", "data": rows, "highlight": { "param": "pick" },
  "encoding": { "x": { "field": "month", "type": "temporal" },
                "y": { "field": "revenue" }, "series": { "field": "region" } } }
```

`SelectionParam = { name, select, value? }`. `select` is `{ type: "point" | "interval",
on?: "click" | "hover", fields?: string[], toggle?: boolean, empty?: "all" | "none" }`.
`fields` defaults to the chart's key channel. `filter` clauses can be `{ param }`,
`{ field, equals }`, `{ field, oneOf }`, `{ field, range: [min, max] }`, or
`{ field, contains }`.

Resolved values in the store are `point`, `set`, `range`, or `text` selections.
Use `createSelectionStore(initial?)` and pass the same store to linked
`ChartCard`s; see [interactions](interactions.md) for the app bridge into slicers
and DAX.

## Chart types

### line / area
`encoding`: requires `x`, `y`; optional `series`.
- line: `points?: boolean`, `area?: boolean`, `curve?`.
- area: `stack?: boolean` (totals; non-stacked areas overlap translucently), `curve?`.
- `curve`: `linear | monotone | step | stepBefore | stepAfter | catmullRom`.

### bar
`encoding`: requires `x`, `y`; optional `series`.
- `stack?: boolean` — stack series. Omit for side-by-side groups (the default when
  `series` is present and not stacked).
- `cornerRadius?: number`.
- `orientation` — **ignored in this version** (always vertical; see caveat above).

### scatter
`encoding`: requires `x`, `y`; optional `size` (bubble radius), `series` (colors
groups). Hover focuses the nearest point.

### pie
`encoding`: requires `theta` (value) + `color` (slice category).
- `donut?: boolean | number` — `true` for a default donut, or a `0..1` inner-radius
  ratio (e.g. `0.6`).
- `labels?: boolean | PieLabels` — `PieLabels = { show?, placement?: "inside" | "outside" | "auto", content?: "percent" | "value" | "category" | "category-percent" | "category-value", minShare?, connector?: "slice" | "muted" }`.

### heatmap
`encoding`: requires `x`, `y` (categories) + `color` (numeric measure).
- `scheme?` — sequential ramp: `blues | teal | viridis | magma | greys`.

### funnel
`encoding`: requires `stage` + `value`.
- `labels?: boolean`.
- `percent?: "first" | "previous"` — show retention vs first stage or previous stage.

```jsonc
{ "type": "funnel", "data": rows, "percent": "previous", "labels": true,
  "encoding": { "stage": { "field": "stage" }, "value": { "field": "users", "format": ",d" } } }
```

### table
A virtualized, sortable detail table.

```jsonc
{ "type": "table", "data": rows,
  "columns": [
    { "field": "account", "title": "Account", "sortable": true },
    { "field": "revenue", "title": "Revenue", "format": "$,.0f", "align": "right",
      "conditionalFormat": { "type": "bar", "showValue": true } }
  ],
  "totals": { "label": "Total" },
  "density": "compact" }
```

`TableColumn` supports `field`, `title`, `type`, `format`, `align`, `width`,
`conditionalFormat`, `prefix`, `suffix`, `negativeStyle`, `hidden`, `sortable`,
`wrap`, `group`, and `total`.

### matrix
A pivot/cross-tab over row, column, and value fields.

```jsonc
{ "type": "matrix", "data": rows,
  "rows": ["region"], "columns": ["quarter"],
  "values": [{ "field": "revenue", "op": "sum", "label": "Revenue", "format": "$,.0f",
                "conditionalFormat": { "type": "colorScale", "scheme": "teal" } }],
  "subtotals": true, "grandTotals": true }
```

`MatrixValueDef = { field, op, label?, format?, conditionalFormat?, prefix?, suffix?,
negativeStyle?, showAs? }`, with `showAs`: `value | percentOfRow |
percentOfColumn | percentOfTotal`.

### Also available (render via `ChartCard`)
`box` (distributions: `x` category, `y` raw observations, `whisker`), `sankey`
(flows: `source` + `target` + `value`), and `choropleth` (geography: a `geo`
FeatureCollection + `key` + `color`). See the library docs for these — most
dashboards won't need them.

## Conditional formatting

`ConditionalFormat` is one of:

- `{ type: "colorScale", scheme?, domain?, midpoint?, diverging?, target?: "background" | "text" }`
- `{ type: "bar", color?, negativeColor?, domain?, baseline?: "zero" | "min", showValue? }`
- `{ type: "icon", set?: "arrows" | "triangles" | "dots" | "trafficLights", rules?, position? }`
- `{ type: "rules", rules: ValueRule[] }`

`ValueRule = { when: "gt" | "gte" | "lt" | "lte" | "eq" | "ne" | "between", value, to?, background?, color?, weight?, icon? }`.

## Format mini-language

A small subset of d3-format (numbers) plus strftime-style dates.

**Numbers** — `[$][,][.precision][type]`:

| Hint | Input | Output |
| --- | --- | --- |
| `,d` | `1234567` | `1,234,567` |
| `.1f` | `3.14159` | `3.1` |
| `.0%` | `0.42` | `42%` |
| `$,.0f` | `5230` | `$5,230` |
| `.1s` | `1200` | `1.2k` |
| `.2s` | `1234567` | `1.2M` |

**Dates** — any hint containing `%` is a date pattern: `%Y` (2024), `%y` (24),
`%m` (01), `%d` (01), `%e` (1), `%B`/`%b` (January/Jan), `%a` (Mon), `%H`, `%M`,
`%p` (AM/PM), `%%` (literal `%`). Example: `%b %e, %Y` → `Jan 2, 2024`.

## Validation & gotchas

- **`encoding` is required** for `line`/`area`/`bar`/`scatter` (`x`+`y`), `pie`
  (`theta`+`color`), `heatmap` (`x`+`y`+`color`), and `funnel` (`stage`+`value`).
- **Field names must exist** in every `data` row (a typo silently drops the
  channel — run `validateSpec`).
- **Don't pre-pivot** — pass tidy rows and split with `series`.
- **Everything is plain JSON** — no functions, no DOM nodes, no `Date` objects.
- A spec with **empty `data`** makes `ChartCard` show its empty state — never ship
  placeholder rows.

## Lifecycle (for reference)

`ChartCard` (via the `Chart` wrapper) owns this; you rarely call it directly.

```ts
import { render, createSelectionStore } from "graphein";
const store = createSelectionStore();
const chart = render(el, spec, { store });
chart.on("selectionchange", (name, value) => console.log(name, value));
chart.getSelection("pick");
chart.setSelection("pick", null);
chart.clearSelection("pick");
chart.update(nextSpec);   // new data/config, same container
chart.resize();           // re-measure after a layout change
chart.destroy();          // teardown
```

When a render settles, Graphein sets `data-graphein-ready="true"` on the surface and
increments `window.__GRAPHEIN_READY` — handy for the Fabricator screenshot loop to
wait on.
