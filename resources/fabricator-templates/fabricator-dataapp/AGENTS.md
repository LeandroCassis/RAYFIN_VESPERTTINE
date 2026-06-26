# Data App — agent guide

> **You're an agent** working on a React-based **Fabric Analytics** data app:
> connect a Power BI semantic model, query it with DAX, and build a dashboard by
> **composing a pre-built component kit** (custom D3/SVG charts + the Fabric
> `DataGrid`). This file is your top-level orientation.
>
> **Two things to internalize before writing code:**
> 1. **Compose, don't hand-write.** Pick components from the kit
>    (`src/components/dashboard/`) and pass them data. Hand-writing SVG/JSX or a
>    bespoke chart by hand is the slow, expensive path. The kit catalog is the
>    `visuals` skill — read it first.
> 2. **Ship fast, then iterate.** Follow the `build-workflow` skill: one real
>    hero tile → deploy → review → expand. Don't front-load schema discovery or
>    theming.
>
> **Agent context lives in `.agents/skills/`** (build-workflow, visuals,
> app-design, query-design, dax-authoring, schema-discovery, fabric-cli,
> fabric-sdk). Pull each skill in as its phase needs it — start at its **Fast
> path** and read deeper references only on demand.

---

## What this app is

A read-only analytics dashboard over a Power BI semantic model. It authenticates
through Fabric and renders **inside the Fabric portal shell** — it is meant to be
opened from a deployed Fabric workspace, not `localhost`. There is **no local
backend, dev server, or test harness**: you build, deploy to a Fabric test
workspace, and review the running app. In Rayfin Fabricator that deploy +
screenshot loop is fast and automatic — use it constantly.

> **Never ship mock/fake data or "under construction" tiles.** A tile with no
> data shows the kit's empty state. Real data or an honest empty/loading/error
> state — nothing in between.

---

## Architecture at a glance

```
Power BI semantic model (Fabric)
  └─→ DAX query (useSemanticModelQuery)
        └─→ map the result (toChartData / toDataTable)
              └─→ a kit component (chart card / DataTableCard / KpiCard)
```

- **DAX computes and fetches**, aggregated to the visual's grain.
- **TypeScript maps** the positional query result into the shape a card wants —
  `toChartData(result)` for charts (array of keyed row objects), or
  `toDataTable(result, columnMetadata)` for the DataGrid. Both accept the query
  result, a raw table, or `undefined` — no `status` check needed.
- **The kit renders.** Each card owns its theme, responsive sizing, axes,
  tooltip, legend, number/date formatting, dark mode, and loading/empty/error
  states.

`fabric.yaml` declares the semantic-model connection; `src/fabric.generated.ts`
is regenerated from it by `build:fabric` (`fabric-app-data generate`). Don't
hand-edit the generated file — edit `fabric.yaml`.

---

## Layout

```
.
├── AGENTS.md                       ← you are here
├── .agents/skills/                 ← build-workflow, visuals, app-design,
│                                     query-design, dax-authoring, schema-discovery, …
├── fabric.yaml                     ← Fabric data connections (semantic model profiles)
├── rayfin/rayfin.yml               ← Fabric service config (auth + static hosting)
├── src/
│   ├── App.tsx                     ← your dashboard (ships a kit-composed starter)
│   ├── main.tsx                    ← entry: fonts, theme, auth provider, auth gate
│   ├── global.css                  ← design system: tokens, palette, fonts, dark mode
│   ├── components/dashboard/       ← THE KIT — cards, charts, layout, controls, states
│   ├── hooks/
│   │   ├── use-semantic-model-query.ts   ← run a DAX query → { data, isLoading, error }
│   │   ├── use-theme.ts / theme.context.ts
│   │   └── use-auth.tsx / auth.context.ts
│   ├── lib/
│   │   ├── to-chart-data.ts        ← query result → chart row objects
│   │   ├── to-data-table.ts        ← query result → DataGrid DataTable
│   │   ├── chartTokens.ts          ← chart color / theme helpers
│   │   ├── format.ts               ← number / date / percent formatters
│   │   ├── use-css-theme.ts        ← CSS-derived theme for the DataGrid
│   │   └── utils.ts                ← cn()
│   └── services/                   ← Fabric auth wiring
└── package.json
```

The kit is exported from one barrel: **`@/components/dashboard`** (components +
types + the `format` / `chartTokens` / `toChartData` / `toDataTable` helpers,
plus slicer/filter helpers).

---

## Quick commands

```bash
npm run build:fabric    # fabric-app-data generate + tsc + vite build (deploy entrypoint)
npm run lint            # ESLint
npm run rayfin:up       # deploy the app to a Fabric test workspace
```

There is no meaningful `npm run dev` workflow — outside the Fabric embed the app
has no auth host and KPIs render error tiles. Deploy and review instead.

---

## Conventions you'll hit

### Compose from the kit (the main cost lever)
Pick a component and pass data. The two-step flow is always: **fetch** with
`useSemanticModelQuery` → **map** with `toChartData` / `toDataTable` → **pass**
`data` + `loading` + `error` to a card. Don't pre-render skeletons/empty states
yourself; the cards do it. Build a custom chart only via the documented escape
hatch — compose it on the kit's chart core (`ChartFrame` + `d3-scale` + theme
helpers) when nothing in the kit fits.

### Formatting & color live in the component layer
Emit raw typed numbers from DAX (never `FORMAT()` to text). Format with a card's
`valueFormat` / `xFormat`, or a DataGrid column's `format`. Color series with
chart tokens (`"chart-1"`…`"chart-6"`) or semantic roles, never raw hex — so dark
mode keeps working. See the `visuals` skill's `formatting.md`.

### Theming is token-driven
`src/global.css` is the single source of truth: a semantic palette,
`--color-chart-1..6`, display/sans/mono fonts, a radius scale, dark-mode
overrides under `.dark`. The accent is one swappable family
(`--color-primary` + `--color-chart-1` + `--color-brand` + `--color-ring`).
Restyle by editing tokens, not by hardcoding values in components.

### Connection IDs have one source
Edit `fabric.yaml`; let `build:fabric` regenerate `src/fabric.generated.ts`.
Never hand-edit the generated file.

---

## If you're asked to…

| Task | Start here |
|---|---|
| Build a dashboard from scratch | `build-workflow` skill (ship one hero tile, then iterate) |
| Add a chart / KPI / table | `visuals` skill (kit catalog) — pick a card, pass mapped data |
| Find a metric / explore the model | `schema-discovery` skill, then `dax-authoring` |
| Write or fix a DAX query | `dax-authoring` + `query-design` skills |
| Decide DAX vs. TypeScript for a transform | `query-design` skill (responsibility matrix) |
| Make it look stunning / theme it | `app-design` skill + edit `src/global.css` tokens |
| Add a lightweight filter / segmented control | `visuals` skill (Controls) — own the value in React state |
| Add Power BI-style slicers (shared filter state) | `visuals` skill → **Slicers & shared filter state** (`FilterStateProvider` + `FilterBar`/`DropdownSlicer`/…) |
| Make charts cross-filter / cross-highlight on click | `visuals` skill → **Coordinated interactions** (`useCrossFilter`) |
| Add drill-down (click a bar to go deeper) | `visuals` skill → **Coordinated interactions** (`useDrilldown` + `DrilldownBreadcrumb`) |
| Preview/validate visuals locally without Fabric | run the dev-only component gallery (`npm run gallery`) |
| Overlay a different-unit trend (bar + line) | `visuals` skill → `ComboChartCard` (dual axis) |
| Show a metric vs. target (gauge / progress) | `visuals` skill → `GaugeCard` / `BulletChartCard` |
| Vary card sizes / non-uniform layout | `visuals` skill → `BentoGrid` / `BentoItem` |
| Pivot a long result into multi-series | `visuals` skill → `pivotChartData` |
| Build a chart the kit lacks (radar/treemap/…) | `visuals` skill → **Escape hatch** (custom chart core inside `ChartCard`) |
| Wire/connect a semantic model | `fabric-cli` + `fabric-sdk` skills; edit `fabric.yaml` |
| Deploy to test | `npm run rayfin:up` (or let Fabricator deploy + screenshot) |

---

## Pointers, not duplication

- **`.agents/skills/build-workflow/SKILL.md`** — START HERE; the fast,
  iterative "time to wow" loop that orchestrates the other skills.
- **`.agents/skills/visuals/SKILL.md`** — the kit catalog: every component with
  props + a copy-paste snippet, the two-step data flow, formatting/color,
  slicers + coordinated interactions, and the custom-chart escape hatch.
- **`.agents/skills/query-design/SKILL.md`** — what belongs in DAX vs.
  TypeScript vs. the kit.
- **`.agents/skills/app-design/SKILL.md`** — aesthetic direction, typography,
  layout, and the Final Audit.

If your task is purely UI, this file + the `visuals` skill are enough. If you're
touching DAX or data wiring, read `query-design` and `dax-authoring` first.
