---
name: query-design
description: >
  Separates DAX data-fetching from TypeScript presentation. Guides when to use
  DAX vs. TypeScript vs. the dashboard kit for aggregation, total rows,
  FORMAT(), SELECTCOLUMNS, BLANK handling, filtering, multi-grain queries,
  cross-filtering and cross-highlight subset/overlay queries, and format strings.
---

# Query Design — Separation of Data and Presentation

**DAX computes and fetches data. TypeScript maps it with `toChartData` / `toDataTable`. Chart cards and `DataTableCard` render it.**

Aggregate in DAX to the visual's grain — never fetch lower-grain rows to roll up client-side. Once at the visual's grain, TypeScript can derive simple totals (SUM, COUNT, MIN, MAX) from the already-fetched detail rows. When a visual layout changes, only the TypeScript mapping (`toChartData`) or the card props should change — not the DAX query.

## Fast path

Phase 1 — Hero slice (time to wow): default to one DAX query → one visual at the visual's grain.
Aggregate in DAX to exactly the grain the hero visual needs, render it, deploy, and review the running app.
Do not apply the full responsibility matrix, filter strategy, cross-filtering, or cross-highlighting before the first deploy.
Reach for those deeper patterns only when the user actually wants coordinated or interactive visuals.
Phase 2 — Breadth adds remaining visuals/KPIs with deploy + review every 1–2 additions.
Phase 3 — Polish handles multi-grain refinements, interaction behavior, formatting, and final audits.
Read deep references only when a specific design problem demands it; optimize time to wow first.

## Responsibility Matrix

| Concern | Owner |
|---|---|
| Semantic measures (SUM, DISTINCTCOUNT, etc.) | DAX |
| Filters and slicers | DAX or TypeScript ([see Filter Strategy](references/filter-strategy.md)) |
| Grouping grain (SUMMARIZECOLUMNS) | DAX |
| Time intelligence (YTD, YoY) | DAX |
| TopN / payload reduction | DAX |
| Deterministic row ordering (ORDER BY) | DAX (for debugging — not presentation sort) |
| Merging multiple result sets | TypeScript |
| Totals derivable from detail rows (SUM, COUNT, MIN, MAX) | TypeScript (roll up from already-fetched detail) |
| Totals NOT derivable from detail (DISTINCTCOUNT, ratios, AVERAGEX, complex measures) | DAX (separate summary query) |
| Filling dimension gaps | TypeScript (stitch dimension list into sparse results) |
| Reshaping (pivot, unpivot) | TypeScript |
| Column display names | `columnMetadata` in factory file |
| Number/date formatting | Charts: `valueFormat` / `xFormat`; tables: `columnMetadata.format` |
| User-facing sort order | TypeScript (sort the mapped array) / DataGrid `sort` |
| Decorative labels, icons | DataGrid `cellRenderer` or derived fields in `toChartData` mapping |
| Axis labels, legends, series colors | Chart card `xKey` + `series` (`label` / `color`) |

## Rules

### Must

- Aggregate in DAX to the visual's grain — never fetch lower-grain rows just to roll them up to that grain in TypeScript
- One grain per `.dax` file (one `EVALUATE` per file); separate grains → separate files + separate `useSemanticModelQuery` calls
- `ORDER BY` in DAX for stable, diffable results — not presentation sort
- Same filters/measures across related split-grain queries to prevent drift
- For totals from already-fetched detail rows: if the rollup is safe (SUM, COUNT, MIN, MAX), compute in TypeScript; otherwise (DISTINCTCOUNT, ratios, AVERAGEX, complex measures) issue a separate DAX summary query

### Prefer

- `SUMMARIZECOLUMNS` for grouped aggregation — it also drops BLANK-measure rows, keeping payloads small
- DAX's natural column names (`'Table'[Column]`, `[Measure]`) mapped via `columnMetadata.displayName`
- Raw typed values from DAX — format via chart `valueFormat` / `xFormat` or DataGrid `columnMetadata.format`, never `FORMAT()`
- Model-defined format strings (from `INFO.VIEW.MEASURES()`) over invented ones
- Multiple lightweight queries over one monolithic query
- User-facing sort in TypeScript / DataGrid — never re-query for sort

### Avoid

- `SELECTCOLUMNS` solely for renaming — use `columnMetadata.displayName` instead
- `UNION` to mix different grains (detail + total) — use separate queries
- `FORMAT()` in DAX — converts to text, breaks sorting and charting
- Converting BLANK to `0` / `""` / `"N/A"` in DAX — causes result-set explosion
- `CONCATENATEX`, `UNICHAR`, emoji prefixes — decorative text belongs in `cellRenderer` or a derived chart field
- Fetching all members of high-cardinality dimensions just to fill gaps

## Decision Flowchart

```
Need to add something to the query result?
  |-- Calculation / aggregation / filter?
  |     -> DAX (measures, CALCULATE, SUMMARIZECOLUMNS)
  |-- Interactive filter the user controls?
  |     -> Low-cardinality: widen grain, filter mapped rows in TypeScript
  |     -> High-cardinality: push filter to DAX, re-query
  |-- Merging datasets or adding synthetic rows?
  |     -> Charts: pass multiple series to one chart card, or merge result sets in TypeScript before mapping
  |     -> Grids: append rows in TypeScript, style via cellRenderer
  |-- Renaming a column for display?
  |     -> columnMetadata in the factory file (displayName)
  |-- Formatting, labeling, or visual styling?
  |     -> Chart card props (valueFormat / xFormat / series) or DataGrid cellRenderer
  |-- Decorating values (icons, status badges, null placeholders)?
  |     -> DataGrid cellRenderer or derived fields in toChartData mapping
  |-- Not sure?
        -> Does it change what the data *means* (filter, measure, grain)? -> DAX
           Does it change only how data is *rendered* (labels, icons, layout)? -> TypeScript / chart card props / DataGrid cellRenderer
           Still unclear? -> Read the relevant reference above
```

## Interactivity

Reports coordinate multiple visuals: a selection in one changes what the others show. Kit charts coordinate through React state. Two distinct behaviors have different data work behind them:

- **Cross-filtering** — a kit control (`SegmentedControl` / `FilterChips`) or click handler updates React state, which constrains the data shown in another visual. The target shows *less*. Applying that constraint is a cost/cardinality tradeoff — widen the grain and filter already-fetched mapped rows client-side, or push the filter into DAX and re-query with `useSemanticModelQuery`. See [Filter strategy](references/filter-strategy.md).
- **Cross-highlighting** — React state identifies the selected subset to emphasize *within* another visual while the full context stays visible. The target keeps its baseline (dimmed) and draws the selected subset bright on top as a second `series` (or a second area/line) in one chart card, or as two stacked cards. The subset is a separate aggregation aligned to the baseline's grouping, measures, and row set — not a client-side filter of the baseline. See [Highlight queries](references/highlight-queries.md).

For chart overlays, merge aligned result sets in TypeScript into one row array before passing `data` and `series` to `LineChartCard` / `AreaChartCard` / `BarChartCard`; see the visuals skill's [multi-data input](../visuals/references/multi-data-input.md) reference. Fabric `DataGrid` still supports row interaction when needed.

## Reference Materials

Read these when working on a specific topic:

- **[Anti-patterns and corrections](references/anti-patterns.md)** — Open when reviewing a query that uses `UNION` for totals, `FORMAT()`, `SELECTCOLUMNS` for renaming, `CONCATENATEX`/emoji decoration, BLANK-to-`0` conversion, or `GENERATE`/`CROSSJOIN` for gap-filling.
- **[Multi-grain patterns](references/multi-grain-patterns.md)** — Open when a single visualization needs data at two grains (e.g., bars + grand-total reference line, region detail + total row, monthly trend + YTD).
- **[Filter strategy](references/filter-strategy.md)** — Open when adding a user-controlled filter or implementing cross-filtering, and deciding whether to widen the grain (filter client-side) or push the filter into DAX (re-query on each change).
- **[Highlight queries](references/highlight-queries.md)** — Open when writing the "selected subset" overlay query for a cross-highlight visual: an aligned `CALCULATETABLE` / `TREATAS` query whose rows match the baseline.
- **[Format strings](references/format-strings.md)** — Open when picking a `columnMetadata.format` value, when a measure has a dynamic format string, or when formatting needs to drive a chart card's `valueFormat` / `xFormat`.

## Integration with Sibling Skills

- **[schema-discovery](../schema-discovery/SKILL.md)** — Schema exploration; discover tables, columns, and relationships before writing queries.
- **[dax-authoring](../dax-authoring/SKILL.md)** — DAX syntax, query patterns, and testing workflow. Apply this skill's principles when deciding what DAX should compute.
- **[visuals](../visuals/SKILL.md)** — The dashboard kit catalog (chart cards + DataGrid). Push formatting/labels into card props (`valueFormat` / `series`) or DataGrid `columnMetadata`, not DAX.
