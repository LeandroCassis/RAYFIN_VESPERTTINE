# Multi-Grain Patterns

When a component needs data at multiple grains (e.g., region detail + grand total, monthly trend + YTD), use separate `.dax` files and separate hook calls.

## Contents

- [File Organization](#file-organization) — `.dax` + `.ts` layout per visualization
- [Component Wiring](#component-wiring) — two hook calls → mapped chart rows or `DataTable`s
- [Rendering in chart cards](#rendering-in-chart-cards) — pass multiple `series` or `referenceLines`
- [Rendering in DataGrid (total row via cellRenderer)](#rendering-in-datagrid-total-row-via-cellrenderer) — styled grand total row
- [Consistency Rule](#consistency-rule) — shared filters, measures, scope across split-grain queries

## File Organization

```
src/queries/sales/
├── revenue-by-region.dax          # Detail grain
├── revenue-by-region.ts           # Factory: returns detailQuery + columnMetadata
├── revenue-total.dax              # Summary grain (single-row total)
├── revenue-total.ts               # Factory: returns totalQuery (no spec needed)
└── index.ts
```

## Component Wiring

```typescript
// Two hook calls. Both factories target the same model, so the two
// connection objects are equivalent — we destructure both (factory signature
// requires it) but use one for both hooks.
const { connection, query: detailQuery, columnMetadata: detailMeta } = revenueByRegion();
const { connection: _summaryConn, query: totalQuery, columnMetadata: totalMeta } = revenueTotal();

const detail = useSemanticModelQuery({ connection, query: detailQuery });
const summary = useSemanticModelQuery({ connection, query: totalQuery });

const detailRows = toChartData(detail.data, {
  columns: { Region: "Region[Name]", Revenue: "Revenue" },
});
const summaryRows = toChartData(summary.data, {
  columns: { Revenue: "Revenue" },
});

// For DataGrid rendering instead, use toDataTable(detail.data, detailMeta)
// and toDataTable(summary.data, totalMeta).
```

## Rendering in chart cards

Pass mapped rows to a chart card. Use `referenceLines` for summary values such as average, target, or grand total; use multiple `series` when the second query is aligned to the same x-axis grain.

```tsx
const grandTotal = summaryRows[0]?.Revenue as number | undefined;

<BarChartCard
  title="Revenue by region"
  data={detailRows}
  xKey="Region"
  series={[{ key: "Revenue", label: "Revenue", color: "chart-1" }]}
  valueFormat="currency"
  referenceLines={grandTotal == null ? undefined : [{ y: grandTotal, label: "Grand total" }]}
/>
```

For overlays such as cross-highlighting, merge the aligned result sets in TypeScript into one row array, then pass baseline and subset as two `series` to one `LineChartCard` / `AreaChartCard` / `BarChartCard`. See the visuals skill's [multi-data input](../../visuals/references/multi-data-input.md) reference.

## Rendering in DataGrid (total row via cellRenderer)

Append the summary as a styled total row using `cellRenderer` to visually distinguish it:

```tsx
const grandTotal = summaryTable.rows[0];
const totalRow: Row = {
  _id: "grand-total",
  [detailTable.columns[0].name]: "Grand Total",
  ...Object.fromEntries(
    detailTable.columns.slice(1).map((col, i) => [col.name, grandTotal[i + 1]])
  ),
};

const columns: GridColumnDef[] = detailTable.columns.map(col => ({
  id: col.name,
  header: col.displayName ?? col.name,
  cellRenderer: (value, row) =>
    row._id === "grand-total"
      ? <span className="font-semibold">{formatValue(value, col.format)}</span>
      : undefined, // fall back to default formatting
}));

<DataGrid
  columns={columns}
  data={[...detailTable.rows.map(toRow), totalRow]}
  theme={theme}
/>
```

## Consistency Rule

When splitting a visualization across multiple queries, all queries must share the same semantic contract:

- Same measure definitions (use `DEFINE MEASURE` identically, or rely on shared model measures)
- Same filter scope (time window, slicer values)
- Only the grouping grain changes between queries

This prevents the detail and summary from silently drifting apart.
