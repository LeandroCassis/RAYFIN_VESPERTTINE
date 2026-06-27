# When the kit lacks your chart — pick the closest Graphein type

There is **no custom-chart escape hatch** to maintain anymore: charts are Graphein
specs, and you compose them by choosing a `type` and an `encoding`. When a
visualization isn't an obvious built-in, don't hand-roll SVG — map it onto the
nearest Graphein type.

## Map the intent to a type

| You want… | Author this |
|---|---|
| Ranked / "top N" | `bar` (vertical), rows sorted by value (`topN`) |
| Progress to goal / actual vs target | two `bar` series (actual + target), or a `KpiCard` with `delta` |
| Gauge / single value vs max | `KpiCard` (value + delta) — or a one-row `bar` |
| Funnel / stage conversion | native `funnel` (`FunnelSpec`) |
| Combo (bars + line) | two charts stacked, or a `line` with `points` over the same `x` |
| Distribution / spread | `box` (raw observations per category) |
| Flow between nodes | `sankey` (`source` + `target` + `value`) |
| Values on a map | `choropleth` (`geo` FeatureCollection + `key` + `color`) |
| Cross-tab / pivot table | `matrix` spec (or `DataTableCard` with a `matrix` spec) |

`box`, `sankey`, `choropleth`, and `funnel` are valid Graphein types — author them
as a spec and drop them into `ChartCard` like any other (see the
[spec reference](graphein-spec-reference.md)).

## If a type genuinely doesn't exist

Graphein 0.3 has no radar, treemap, or waterfall. Options, in order:

1. **Re-express the question** with a supported type — a treemap is usually a
   ranked `bar`; a waterfall is often a running-total `bar` or `line`; a radar is a
   small-multiple of bars. This is almost always the right call.
2. **A simple bespoke React component** inside a `ChartCard` (children mode) for a
   truly one-off, non-charty visual (e.g. a custom progress list). Theme it from
   `src/global.css` tokens and `seriesColor` / `roleColor` so dark mode keeps
   working — never hardcode hex.

Don't rebuild a charting core. If you find yourself writing axis/scale math, step
back and pick a supported Graphein type instead.
