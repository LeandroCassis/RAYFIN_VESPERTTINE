# Filter Strategy

Interactive reports let users filter data by selecting values. Where filtering happens — in DAX or in TypeScript — is a trade-off between query cost and interaction speed.

## Two Approaches

| Approach | How it works | Best when |
|---|---|---|
| **Widen the grain** | Include filter dimension as a group-by column, fetch all values upfront, filter client-side | Dimension is low-cardinality (a small set — roughly a few dozen values) and extra rows don't significantly increase result size |
| **Push filter to DAX** | Pass user's selection as a filter parameter, re-execute on each change | Dimension is high-cardinality (dates, customers) or including it forces expensive measure computation |

## Widen the Grain (client-side filtering)

Fetching data broken down by the filter dimension makes interactions instant — no server round-trip.

```dax
// Fetch data by region × category — filter by region client-side
EVALUATE
  SUMMARIZECOLUMNS(
    'Region'[Name],
    'Product'[Category],
    "Revenue", [Total Revenue]
  )
ORDER BY 'Region'[Name], 'Product'[Category]
```

```tsx
// TypeScript: instant client-side filtering, producing mapped chart rows
const rows = toChartData(data, {
  columns: { Region: "Region[Name]", Category: "Product[Category]", Revenue: "Revenue" },
});
const filteredRows = rows.filter(row => row.Region === selectedRegion);

<ChartCard
  title="Revenue by category"
  spec={{
    type: "bar",
    data: filteredRows,
    encoding: {
      x: { field: "Category", type: "nominal" },
      y: { field: "Revenue", type: "quantitative", format: "$,.0f" },
    },
  }}
/>
```

That direct `.filter(...)` is fine for a one-off lightweight control. For shared slicers, use the kit's filter-state foundation instead of hand-rolling the predicate in each visual: slicers write `FilterSelection`s into `useFilterState()`, and visuals apply the active selections to already-mapped rows with `applyFilters(rows, selections)` from `@/components/dashboard`.

```typescript
import { applyFilters, toChartData, useFilterState } from "@/components/dashboard";

const { selections } = useFilterState();
const rows = toChartData(data, {
  columns: { Region: "Region[Name]", Category: "Product[Category]", Revenue: "Revenue" },
});
const filteredRows = applyFilters(rows, selections);

// If your mapped row key differs from the model column's short name:
const filteredCustomRows = applyFilters(rows, selections, {
  fieldMap: { "Region[Name]": "regionName" },
});
```

For tables, apply the same selection model to `DataTable.rows` and pass the result to `DataTableCard`. Kit controls (`SegmentedControl` / `FilterChips`) can still own local React state for simple cases; use the slicer components for Power BI-style shared filter state. See the `visuals` skill's `references/slicers.md` for the full slicer catalog.

## Push Filter to DAX (server-side filtering)

When the filter dimension would make the query too expensive — e.g., a date column forcing measure computation across hundreds of dates — push the filter into DAX and re-execute on each change.

```dax
// Re-executed when selectedDate changes
DEFINE
  VAR _DateFilter = TREATAS({DATE(2024, 3, 15)}, 'Calendar'[Date])

EVALUATE
  SUMMARIZECOLUMNS(
    'Product'[Category],
    _DateFilter,
    "Revenue", [Total Revenue],
    "Units Sold", [Total Quantity]
  )
ORDER BY 'Product'[Category]
```

The query is lighter (computes for one date only), but each filter change requires a server round-trip.

The shared filter model works for the server-side path too. Use `toDaxFilters(selections)` from `@/components/dashboard` to convert active `FilterSelection`s into DAX fragments: categorical `in` selections become `TREATAS` variables for `SUMMARIZECOLUMNS`, while numeric/date ranges become predicate expressions you can wrap in `FILTER(...)`.

```typescript
import { toDaxFilters, type FilterSelection } from "@/components/dashboard";

const selections: Record<string, FilterSelection> = {
  "Product[Category]": {
    kind: "in",
    field: "Product[Category]",
    values: ["Bikes", "Accessories"],
  },
  "Calendar[Date]": {
    kind: "range",
    field: "Calendar[Date]",
    min: 20240101,
    max: 20240331,
    dataType: "date",
  },
};

const filters = toDaxFilters(selections);
```

`filters` contains:

```dax
// filters.defines
VAR __f_Category_1 = TREATAS({"Bikes", "Accessories"}, 'Product'[Category])

// filters.vars
__f_Category_1

// filters.predicates
'Calendar'[Date] >= DATE(2024, 1, 1) && 'Calendar'[Date] <= DATE(2024, 3, 31)
```

Splice those fragments into the query you re-execute:

```typescript
const datePredicate = filters.predicates.join(" && ") || "TRUE()";

const query = `
DEFINE
${filters.defines}
EVALUATE
  SUMMARIZECOLUMNS(
    'Product'[Category],
    ${filters.vars.join(",\n    ")}${filters.vars.length ? "," : ""}
    FILTER(ALL('Calendar'[Date]), ${datePredicate}),
    "Revenue", [Total Revenue]
  )
ORDER BY 'Product'[Category]
`;
```

For the slicer options themselves, prefer `useSlicerOptions({ connection, field })`. It issues the distinct-value `SUMMARIZECOLUMNS` + `TOPN` query and returns `{ options, isLoading, error }`, so you do not need to hand-write that query.

## Choosing the Right Approach

- **Dimension cardinality** — low (a small set, e.g., a few dozen values) favors widening; high (dates, customers) favors pushing
- **Measure cost** — cheap measures (SUM) tolerate wider grains; expensive measures (DISTINCTCOUNT) favor pushing
- **Interaction frequency** — rapid filter changes (date slider scrubbing) favor client-side from pre-fetched wider grain
- **Result set size** — estimate rows × columns; if widening multiplies beyond what the browser can hold, push instead
