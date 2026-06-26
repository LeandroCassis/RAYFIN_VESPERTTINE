# Coordinated interactions (Tableau-like)

Coordinated interactions are built on the same shared filter state as slicers.
Wrap the page in `FilterStateProvider`, then use chart clicks, slicers, and
drilldown together.

```tsx
import { FilterStateProvider } from "@/components/dashboard";

<FilterStateProvider>
  <DashboardCards />
</FilterStateProvider>
```

## Click-to-cross-filter + cross-highlight

`useCrossFilter(field)` returns `{ selectedKeys, onSelect, dimUnselected }`.
Spread it onto an interactive cartesian chart card.

```tsx
import { BarChartCard, ChartCard, useCrossFilter, useFilterState } from "@/components/dashboard";

function CrossFilterCard({ regionRevenue }: { regionRevenue: Array<Record<string, unknown>> }) {
  const cross = useCrossFilter("Region[Region]");
  const { clearAll, isActive } = useFilterState();

  return (
    <ChartCard
      title="Click a bar to cross-filter"
      subtitle="Selecting a mark dims the rest and drives shared filter state"
      action={isActive ? <button type="button" onClick={clearAll}>Clear</button> : null}
    >
      <BarChartCard
        data={regionRevenue}
        xKey="region"
        series={[{ key: "revenue", label: "Revenue", color: "chart-1" }]}
        valueFormat="currency"
        horizontal
        showLegend={false}
        {...cross}
      />
      <p className="mt-2 font-mono text-xs text-foreground-muted">
        selected: {cross.selectedKeys.length ? cross.selectedKeys.join(", ") : "—"}
      </p>
    </ChartCard>
  );
}
```

The mark contract is:

```ts
interface MarkInteraction {
  selectedKeys?: ReadonlyArray<string | number>;
  onSelect?: (value: string | number) => void;
  dimUnselected?: boolean;
}
```

Chart internals use `markOpacity(value, interaction)` so selected marks stay
vivid and unselected marks dim to `0.26`. `isInteractive(interaction)` checks
for `onSelect` to enable pointer affordances.

As of this source, the public chart cards that accept `MarkInteraction` are the
cartesian cards backed by `CartesianChart`: `LineChartCard`, `AreaChartCard`,
and `BarChartCard`. `DonutChartCard` and `ScatterChartCard` have hover tooltips
but do not expose `selectedKeys` / `onSelect` props in their card APIs.

## Drill-down

`useDrilldown(id, levels)` coordinates a path and field filters:

```ts
const drill = useDrilldown("geo", [
  { field: "Geography[Region]", xKey: "region" },
  { field: "Geography[City]", xKey: "city" },
]);

drill.level;       // zero-based current level
drill.current;     // current DrilldownLevel
drill.field;       // current model field
drill.xKey;        // row key, default fieldShortName(field)
drill.path;        // values drilled into
drill.canDrillUp;
drill.drillInto("West");
drill.drillUp();
drill.drillTo(0);
```

Pair it with `DrilldownBreadcrumb`:

```tsx
import { BarChartCard, ChartCard, DrilldownBreadcrumb, useDrilldown } from "@/components/dashboard";

function DrilldownCard({ regionRevenue, cityByRegion }: {
  regionRevenue: Array<Record<string, unknown>>;
  cityByRegion: Record<string, Array<{ city: string; revenue: number }>>;
}) {
  const drill = useDrilldown("gallery-geo", [
    { field: "Geography[Region]", xKey: "region" },
    { field: "Geography[City]", xKey: "city" },
  ]);
  const atRoot = drill.level === 0;
  const region = drill.path.length ? String(drill.path[0]) : undefined;
  const data = atRoot ? regionRevenue : region ? (cityByRegion[region] ?? []) : [];

  return (
    <ChartCard
      title="Click a bar to drill down"
      subtitle="Region → city; the breadcrumb climbs back up"
      action={drill.canDrillUp ? <button type="button" onClick={drill.drillUp}>Back</button> : null}
    >
      <DrilldownBreadcrumb drilldown={drill} rootLabel="All regions" className="mb-3" />
      <BarChartCard
        data={data}
        xKey={atRoot ? "region" : "city"}
        series={[{ key: "revenue", label: "Revenue", color: "chart-2" }]}
        valueFormat="currency"
        horizontal
        showLegend={false}
        onSelect={atRoot ? (value) => drill.drillInto(value) : undefined}
      />
    </ChartCard>
  );
}
```

`DrilldownBreadcrumb` props:

```ts
{
  drilldown: DrilldownApi;
  rootLabel?: React.ReactNode; // default "All"
  formatValue?: (value: string | number, level: number) => React.ReactNode;
  className?: string;
}
```

`drillInto` sets an `"in"` filter for the current level and advances the path.
`drillUp` clears the last completed level's filter. `drillTo(level)` jumps to an
absolute level and clears deeper filters.

## Combine slicers + chart clicks

Slicers and chart clicks both write `selections`, so they compose naturally.
Use `applyFilters(rows, selections, { fieldMap })` for client-side rows, or
`toDaxFilters(selections)` to rebuild a server-side query.

```tsx
import { BarChartCard, DropdownSlicer, FilterBar, applyFilters, useCrossFilter, useFilterState } from "@/components/dashboard";

const cross = useCrossFilter("Geography[Region]");
const { selections } = useFilterState();
const filteredRows = applyFilters(rows, selections, {
  fieldMap: { "Geography[Region]": "region", "Product[Category]": "category" },
});

<>
  <FilterBar>
    <DropdownSlicer label="Category" field="Product[Category]" options={categoryOptions} />
  </FilterBar>
  <BarChartCard data={filteredRows} xKey="region" series={[{ key: "revenue" }]} {...cross} />
</>;
```
