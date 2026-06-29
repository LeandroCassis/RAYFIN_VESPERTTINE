# Dashboard

A lightweight **dashboarding** Rayfin app: build dashboards over **any data** —
inline/static arrays or a Power BI semantic model — with [Graphein](https://www.npmjs.com/package/graphein)
visuals. It deploys to Microsoft Fabric and opens in the embedded **Fabric view**.

Much smaller than the Data App: one `Dashboard` page, a tiny kit (`ChartCard` +
`KpiCard` + grid), no slicers/sidebars. The starter renders inline demo data with
no connection; swap in a semantic model when ready.

## Build & deploy
```bash
npm run build:fabric    # generate fabric config + tsc + vite build
npm run preview -- --spec hero.json   # render a Graphein spec headlessly → PNG + report
npm run lint
```

## Data
- **Inline/static:** edit `src/data/sample.ts` and pass arrays as `spec.data`.
- **Semantic model:** declare a connection in `fabric.yaml`, then query with
  `useSemanticModelQuery` + `toChartData`. See `AGENTS.md` and the
  `connect-semantic-model` skill. Never hand-edit `src/fabric.generated.ts`.

Theme via `src/global.css` tokens. See `AGENTS.md` for the kit + conventions.
