# Highlight Queries — Aligned Subsets for Cross-Highlight Overlays

A cross-highlight overlay layers a bright "selected subset" on a dimmed baseline. The subset comes from a fresh DAX query scoped by the selection — not from filtering the baseline result client-side.

For how chart cards render multiple aligned series, see the visuals skill's [multi-data input](../../visuals/references/multi-data-input.md) reference. This page covers producing the subset table.

## When you need this

A chart renders two aligned series at the same axis grain (dimmed baseline + bright subset), and the bright series reflects React selection state from elsewhere on the page.

If the selection column is already projected in the chart rows and you only need to dim non-matching rows, derive that display state in TypeScript — no query needed.

## Re-aggregate, don't filter

The baseline and the subset are two separate queries. The subset query has:

- The **same grouping columns** as the baseline.
- The **same measure expressions** as the baseline.
- An **added filter** from the selection's predicates, via `CALCULATETABLE` + `TREATAS` / `KEEPFILTERS`.

Wrap the baseline aggregation in `CALCULATETABLE`:

```dax
// Baseline
EVALUATE
  SUMMARIZECOLUMNS('Product'[Category], "Sales", [Total Sales])
ORDER BY 'Product'[Category]
```

```dax
// Subset — selection: Rating ∈ {PG, PG-13}
EVALUATE
  CALCULATETABLE(
    SUMMARIZECOLUMNS('Product'[Category], "Sales", [Total Sales]),
    TREATAS({"PG", "PG-13"}, 'Movie'[Rating])
  )
ORDER BY 'Product'[Category]
```

The model re-evaluates `[Total Sales]` under the added filter. `Movie[Rating]` doesn't appear in the result; the chart doesn't project it.

## Match the baseline's row set

The two layers register by axis key. Every baseline row needs a counterpart in the subset, even when the selection matches no fact rows for that group.

`SUMMARIZECOLUMNS` drops groups where every measure is BLANK, which leaves gaps under baseline bars. Keep all rows one of two ways:

**Option A — coalesce the measure to zero:**

```dax
EVALUATE
  CALCULATETABLE(
    SUMMARIZECOLUMNS('Product'[Category], "Sales", COALESCE([Total Sales], 0)),
    TREATAS({"PG", "PG-13"}, 'Movie'[Rating])
  )
ORDER BY 'Product'[Category]
```

**Option B — left-join the baseline's group list** (use when zero is wrong, e.g. a ratio that must stay BLANK):

```dax
EVALUATE
  VAR Categories = SUMMARIZECOLUMNS('Product'[Category])
  VAR Filtered =
    CALCULATETABLE(
      SUMMARIZECOLUMNS('Product'[Category], "Sales", [Total Sales]),
      TREATAS({"PG", "PG-13"}, 'Movie'[Rating])
    )
  RETURN NATURALLEFTOUTERJOIN(Categories, Filtered)
ORDER BY 'Product'[Category]
```

## Build the filter from a selection

`DataPointSelection[]` is a disjunction (OR) of conjunctions (AND) of predicates:

- `SetPredicate` (`{ type: 'set', name, values }`) → `TREATAS(<values>, '<Table>'[<Column>])`.
- `RangePredicate` (`{ type: 'range', name, min, max }`) → `FILTER('<Table>', '<Table>'[<Column>] >= min && '<Table>'[<Column>] <= max)`.
- Multiple predicates in one selection → multiple filter arguments to the same `CALCULATETABLE` (AND).
- Multiple selections → `UNION` the per-selection filter tables inside one `KEEPFILTERS` argument (OR).

Assemble the query string in TypeScript and pass it to `useSemanticModelQuery`. Identical selections reuse the SDK's cache.

## Wiring it in the component

The host component holds React selection state, fetches the aligned subset, and maps the subset into a second series on each change. Render baseline alone when there is no selection, or baseline + highlighted series once a subset is fetched.

```tsx
function SalesByCategoryChart({ selectedRatings }: { selectedRatings: string[] }) {
  const all = useBaselineTable();
  const highlighted = useHighlightedTable(selectedRatings); // scoped CALCULATETABLE query; null when no selection

  const allRows = toChartData(all);
  const highlightedRows = toChartData(highlighted ?? undefined);
  const highlightedByCategory = new Map(highlightedRows.map(r => [r.Category, r.Sales]));
  const rows = allRows.flatMap(row => [
    { Category: row.Category, Layer: "All", Sales: row.Sales },
    { Category: row.Category, Layer: "Selected", Sales: highlightedByCategory.get(row.Category) ?? 0 },
  ]);

  return (
    <ChartCard
      spec={{
        type: "bar",
        data: rows,
        encoding: {
          x: { field: "Category", type: "nominal" },
          y: { field: "Sales", type: "quantitative", format: "$,.0f" },
          series: { field: "Layer" },
        },
      }}
    />
  );
}
```

`useHighlightedTable` builds the scoped query from React state (above) and runs it through `useSemanticModelQuery` — it does **not** filter `all` client-side. See the visuals [multi-data input](../../visuals/references/multi-data-input.md) reference for overlay patterns.

## Keep baseline and subset in sync

When the baseline query changes, keep the subset query in sync with it:

- Same grouping columns, same order.
- Same measure name and expression — the baseline and highlighted `encoding.series` categories must align.
- Same outer time / scope filters; the selection adds to them, it doesn't replace them.

Derive both from the same factory: the baseline query is the source; the subset query is `CALCULATETABLE(<baseline aggregation>, <selection predicates>)`.

## Anti-patterns

- ❌ **Filtering the baseline DataTable client-side.** Cannot re-aggregate measures, apply RLS, or resolve selections on unprojected columns. Wrong subtotals for any non-SUM measure (DISTINCTCOUNT, ratios, AVERAGEX, complex measures).
- ❌ **`FILTER('FactTable', …)` instead of `TREATAS` on the dimension column.** Targets the wrong table, ignores relationships, slower.
- ❌ **Letting `SUMMARIZECOLUMNS` drop empty groups.** Causes axis-key gaps. Use `COALESCE` or a left-join.
- ❌ **Changing grain or column shape in the subset query.** The series no longer share an axis.
- ❌ **`FORMAT()` in the subset query.** Stringified measures break shared series keys and numeric formatting. Return raw types.
