# Dashboard — agent guide

> **You're an agent** building a lightweight **dashboarding** app. Get data
> (inline/static **or** a Power BI semantic model), author **Graphein chart
> specs**, and drop them into a tiny kit (`ChartCard`, `KpiCard`, `Stat`). This is
> deliberately small — no slicers, selection bridges, or sidebars. Start here.

## Two rules
1. **Author a spec, don't hand-write a chart.** A chart is one JSON `ChartSpec`
   (the `graphein` package) passed to `<ChartCard spec={…} />`. Don't hand-write
   SVG/JSX or wire another chart lib.
2. **Ship fast.** Build one tile → preview headless → let Fabricator auto-deploy →
   iterate. The app opens in the embedded **Fabric view** by default.

## Data: any source
Tiles work with **no connection**: pass an inline array as `spec.data` (see
`src/data/sample.ts`). To go live, query a semantic model and map the rows:

```tsx
const { data, isLoading, error } = useSemanticModelQuery({ connection: "sales", query: dax });
const rows = toChartData(data); // [{ Month:"Jan", Revenue:84200 }, …]
<ChartCard title="Revenue" loading={isLoading} error={error}
  spec={{ type:"line", data: rows, encoding:{ x:{field:"Month",type:"ordinal"}, y:{field:"Revenue",format:"$,.0f"} } }} />
```

`fabric.yaml` declares the connection; `build:fabric` regenerates
`src/fabric.generated.ts`. **Never hand-edit the generated file.** See the
`connect-semantic-model` skill for the fabric.yaml how-to.

## The kit (one barrel: `@/components/dashboard`)
`PageShell` · `DashboardGrid` + `Tile size="…"` · `StatStrip` + `Stat` ·
`ChartCard` (renders any spec) · `KpiCard` · `ThemeToggle` · `toChartData` ·
`type ChartSpec`. `hero` tiles need `className="h-full"` on the card.

## Commands
- `npm run preview -- --spec hero.json` — render a spec headlessly → PNG + report.
- `npm run build:fabric` / `npm run lint`.

## Theme = tokens
`src/global.css` is the single source of truth (teal accent, `--color-chart-1..10`).
Don't put `theme`/hex in a spec — `ChartCard` bridges the app theme; recolor by
editing tokens. Never ship fake data: real data, or the card's empty state.

## Skills
- `dashboarding` — build a dashboard end-to-end + spec recipes.
- `connect-semantic-model` — wire a model into `fabric.yaml`.
- `validate-headless` — preview a spec vs data before deploy.
