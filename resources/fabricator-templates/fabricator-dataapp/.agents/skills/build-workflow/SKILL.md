---
name: build-workflow
description: >
  START HERE when building, modifying, or iterating on a data app or dashboard.
  Defines the fast, iterative "time to wow" workflow: ship one real hero visual
  first, deploy and review it, then expand breadth and polish. Orchestrates the
  schema-discovery, dax-authoring, query-design, visuals, and app-design skills
  so you don't front-load all of them.
---

# Build Workflow — Ship fast, then iterate

Optimize **time to wow**: the time until the user sees a real, compelling result
running in the deployed app. Build a thin vertical slice, get it on screen, then
iterate. Do **not** front-load exhaustive schema discovery, perfect DAX, or
perfect theming before anything is visible — that is the slowest possible path.

> The deployed app is your feedback loop. In Rayfin Fabricator, deploying and
> screenshotting the running app is fast and automatic — use it constantly
> instead of perfecting code in the dark.

## The loop

**Edit → deploy → review the running app → refine.** Keep each loop small. One
reviewed change beats a big-bang build every time.

## Phases

### Phase 1 — Hero slice (time to wow)

Get ONE compelling, real visual wired to live data, on screen and deployed — as
fast as possible.

1. **Minimum schema scan** — discover just enough to find one compelling metric:
   one scope probe + the one or two tables/measures behind your hero visual.
   Don't enumerate the whole model. (→ `schema-discovery`: Fast path)
2. **One hero query** — write a single DAX query at the visual's grain,
   quick-test it once, ship it. (→ `dax-authoring` + `query-design`: Fast path)
3. **One hero visual** — render it with a single kit component (a `KpiCard`,
   `LineChartCard`/`BarChartCard`, or `DataTableCard`) fed that query — pass the
   mapped data, don't hand-write chart code. (→ `visuals`: Fast path)
4. **Sensible default theme** — pick a characterful font pairing + a primary
   color and move on. Do **not** perfect theming yet. (→ `app-design`: Fast path)
5. **Drop the hero tile into `src/App.tsx`** — replace the starter placeholder
   grid with your hero visual, then **deploy + review**.

Stop and look at the deployed result before going further.

### Phase 2 — Breadth

Add the rest of what the user asked for — more KPIs, charts, a grid, filters.
**Deploy + review every 1–2 additions**, not once at the end. Pull in
interactivity (cross-filtering / cross-highlighting) only when the user actually
needs it. (→ `query-design`, `visuals`)

### Phase 3 — Polish

Now refine, driven by what the running app actually shows:

- Theme/typography depth, layout rhythm, and the `app-design` **Final Audit**.
- Loading / empty / error states for every async visual.
- Edge-case DAX correctness, number/date formatting, dark mode.

(→ `app-design`, `query-design`, and `dax-authoring` reference files — read on demand.)

## Rules

- **Deploy early and often.** Never batch all work into one final deploy. The
  first deploy is the Phase 1 hero slice.
- **One reviewed change at a time.** Small loops surface problems immediately.
- **Read references lazily.** The sibling skills carry deep references (DAX
  patterns, visual recipes, style recipes). Open them only when a specific
  problem demands it — not as upfront reading.
- **Don't gold-plate Phase 1.** Exhaustive discovery and perfect theming are
  Phase 3 concerns; they must never block the first deploy.

## Skill read order

Don't load every skill upfront. Pull each one in as its phase needs it, and stop
at its **Fast path** section until you genuinely need more.

| When | Skill | How much |
|---|---|---|
| Phase 1 — find a metric | `schema-discovery` | Fast path only |
| Phase 1 — write the hero query | `dax-authoring` + `query-design` | Fast path only |
| Phase 1 — render it | `visuals` | Fast path only |
| Phase 1 — quick default look | `app-design` | Fast path only |
| Phase 2 — breadth & interactivity | `query-design`, `visuals` | deeper sections |
| Phase 3 — polish & correctness | `app-design`, `dax-authoring`, `query-design` | references, on demand |
| Connections / data plumbing | `fabric-cli`, `fabric-sdk` | only if not already wired |
