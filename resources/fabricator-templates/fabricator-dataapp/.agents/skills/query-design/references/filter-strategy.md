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

```typescript
// TypeScript: instant client-side filtering, producing mapped chart rows
const rows = toChartData(data, {
  columns: { Region: "Region[Name]", Category: "Product[Category]", Revenue: "Revenue" },
});
const filteredRows = rows.filter(row => row.Region === selectedRegion);

<BarChartCard
  title="Revenue by category"
  data={filteredRows}
  xKey="Category"
  series={[{ key: "Revenue", color: "chart-1" }]}
  valueFormat="currency"
/>
```

For tables, filter the `DataTable.rows` array and pass the result to `DataTableCard`. Kit controls (`SegmentedControl` / `FilterChips`) own the selected value in React state; they do not change the DAX query unless you choose the server-side path.

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

## Choosing the Right Approach

- **Dimension cardinality** — low (a small set, e.g., a few dozen values) favors widening; high (dates, customers) favors pushing
- **Measure cost** — cheap measures (SUM) tolerate wider grains; expensive measures (DISTINCTCOUNT) favor pushing
- **Interaction frequency** — rapid filter changes (date slider scrubbing) favor client-side from pre-fetched wider grain
- **Result set size** — estimate rows × columns; if widening multiplies beyond what the browser can hold, push instead
