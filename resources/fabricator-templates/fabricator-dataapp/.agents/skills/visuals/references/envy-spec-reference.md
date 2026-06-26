# Envy spec reference

Every chart is one **`ChartSpec`** — a plain, JSON-serializable object (no
functions, colors, or callbacks). You author it and drop it into
`<ChartCard spec={…} />`. This file is the field-by-field reference; the `visuals`
SKILL has the workflow and recipes.

> Vendored + adapted from the Envy library's own agent docs for the version this
> template pins (`github:spatney/envy#v0.2.1`). `validateSpec(spec)` (re-exported
> from `@/components/dashboard`) checks a spec against the real schema.

## The one rule

> Emit a single object with a `type`, a `data` array of flat records, and (for
> cartesian charts) an `encoding` that names the columns.

```jsonc
{
  "type": "bar",
  "data": [{ "quarter": "Q1", "revenue": 210 }, { "quarter": "Q2", "revenue": 245 }],
  "encoding": { "x": { "field": "quarter" }, "y": { "field": "revenue", "format": "$,d" } },
  "title": "Quarterly revenue"
}
```

## Shape data as a tidy table

Envy expects **long/tidy** data: one row per observation, one column per variable.
The *same* table drives every chart — point different channels at columns. To
compare groups, add a `series` channel (`"series": { "field": "region" }`) — don't
pre-pivot into one column per group.

## App conventions (important)

- **Don't author `theme`.** `ChartCard` injects the app's CSS-token theme (brand
  accent + light/dark) automatically. Recolor via `src/global.css`, never per-spec
  hex. Setting `spec.theme` is a deliberate escape hatch only.
- **Don't set `dimensions`.** `ChartCard` sizes the chart responsively.
- **KPIs / tables / pivots:** prefer the React `KpiCard` and `DataTableCard`
  (Fabric `DataGrid`) over Envy's `kpi` / `table` / `matrix` types — they match
  the app's design system and DAX-mapping helpers. The Envy types still render via
  `ChartCard` if you need them.
- **Horizontal bars are not honored** in this version: `BarSpec` types an
  `orientation` field but the runtime ignores it (bars always render vertical).
  For ranked/top-N, sort rows by value and use a vertical bar.

## Common fields (`BaseSpec`)

Shared by all chart types.

| Field | Type | Notes |
| --- | --- | --- |
| `data` | `Array<Record<string, unknown>>` | **Required.** Row-oriented records. |
| `title` | `string \| { text, subtitle?, align? }` | Chart title. |
| `legend` | `boolean \| { show?, position?, title? }` | `position`: `top \| right \| bottom \| left`. Auto by default. |
| `tooltip` | `boolean \| { show? }` | Hover tooltips, on by default. |
| `axes` | `{ x?: AxisConfig, y?: AxisConfig }` | Per-axis overrides (cartesian). |
| `animation` | `boolean \| { enabled?, duration?, easing? }` | Brief entrance on first render; honors `prefers-reduced-motion`. |
| `description` | `string` | Accessible alt text (auto-synthesized when omitted). |

`AxisConfig`: `{ show?, title?, grid?, ticks?, tickValues?, format?, labels? }`.

## Encoding & `FieldDef`

Cartesian charts (`line`/`area`/`bar`/`scatter`) plus `pie`/`heatmap` map columns
onto channels via `encoding`.

| Channel | Used by | Purpose |
| --- | --- | --- |
| `x` | line, area, bar, scatter, heatmap | Horizontal position. |
| `y` | line, area, bar, scatter, heatmap | Vertical position. |
| `series` | line, area, bar | Split into multiple series (multi-line, grouped/stacked bars/areas). |
| `size` | scatter | Bubble radius. |
| `color` | heatmap, pie | Continuous color (heatmap) or slice category (pie). |
| `theta` | pie | Slice value. |

**`FieldDef`** — `{ field, type?, aggregate?, title?, format?, scale? }`:

- `field` (**required**) — column name; dotted paths (`a.b`) read nested values.
- `type` — `quantitative | temporal | ordinal | nominal` (inferred when omitted).
- `format` — a [format hint](#format-mini-language) for labels/ticks/tooltips.
- `aggregate` — `sum | mean | avg | min | max | count | countDistinct | median |
  first | last` when grouping.

> **Temporal fields:** pass ISO strings (`"2024-01"`, `"2024-01-15"`) or epoch ms
> (JSON has no `Date`), and set `type: "temporal"` for a time axis.

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
- `labels?: boolean` — value/percent labels (default `true`).

### heatmap
`encoding`: requires `x`, `y` (categories) + `color` (numeric measure).
- `scheme?` — sequential ramp: `blues | teal | viridis | magma | greys`.

### Also available (render via `ChartCard`)
`box` (distributions: `x` category, `y` raw observations, `whisker`),
`sankey` (flows: `source` + `target` + `value`), `choropleth` (geography: a `geo`
FeatureCollection + `key` + `color`). See the library docs for these — most
dashboards won't need them. For headline numbers, raw records, and cross-tabs,
prefer `KpiCard` / `DataTableCard` (see the `visuals` SKILL).

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
  (`theta`+`color`), and `heatmap` (`x`+`y`+`color`).
- **Field names must exist** in every `data` row (a typo silently drops the
  channel — run `validateSpec`).
- **Don't pre-pivot** — pass tidy rows and split with `series`.
- **Everything is plain JSON** — no functions, no DOM nodes, no `Date` objects.
- A spec with **empty `data`** makes `ChartCard` show its empty state — never ship
  placeholder rows.

## Lifecycle (for reference)

`ChartCard` (via the `Chart` wrapper) owns this; you rarely call it directly.

```ts
import { render } from "envy";
const chart = render(el, spec);
chart.update(nextSpec);   // new data/config, same container
chart.resize();           // re-measure after a layout change
chart.destroy();          // teardown
```

When a render settles, Envy sets `data-envy-ready="true"` on the surface and
increments `window.__ENVY_READY` — handy for the Fabricator screenshot loop to
wait on.
