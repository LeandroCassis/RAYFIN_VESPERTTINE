---
name: app-design
description: >
  Use when building or modifying the app layout, 
  creating UI components, or making any visual design decisions. 
  Ensures consistency, accessibility, and a polished, unique app.
---

# App Design

Your job is to build cohesive, distinctive apps — not just correct ones. Add character through intentional design decisions — typography pairing, color emphasis, spatial rhythm, and a clear visual point of view.

## Fast path

Optimize **time to wow**: ship a working vertical slice fast, then iterate via deploy + review. In **Phase 1 — Hero slice (time to wow)**, use a clean default look quickly and move on: get ONE compelling, real visual wired to live data on screen and deployed.

For that first slice, pick one characterful `--font-heading` plus a complementary `--font-base`, loaded via Google Fonts in `index.html`; set `--color-primary` and `--radius` in `src/global.css`; then get back to the hero visual. Do NOT perfect theming in Phase 1.

After the hero slice is running, continue with **Phase 2 — Breadth** by adding remaining visuals/KPIs, deploying and reviewing every 1–2. Use **Phase 3 — Polish** for theme/typography refinement, loading/empty/error states, edge-case correctness, and final audits.

Deploy early and often — never one final deploy. Deploy and review the running app (Fabricator handles deploy + screenshots for you), read deep references only when a specific problem demands it, and never block the first deploy on exhaustive discovery or perfect theming.

The deep theming workflow, reference files, and Final Audit below are for Phase 2/3 polish — don't do them before the first deploy.

## Aesthetic Direction

Before building, quickly decide the app's tone in one word and its signature detail — the one thing someone notices first — but do not let this block the first deploy. A clean default is fine for Phase 1; deepen the aesthetic direction in the polish pass. These two choices guide every decision that follows. Pick a tone that is specific and bold, not safe or generic. Examples like editorial, geometric, organic, industrial, playful, or minimal are starting points — don't limit yourself to these. Invent a direction that fits the app's purpose.

Then match your execution to your direction — a maximalist direction needs layered effects and rich detail in the code; a minimalist direction needs precise spacing, restraint, and careful typography. Elegance comes from committing to the direction fully, not from adding more.

### Typography

Pick fonts that set the app's character — this is one of the strongest signals of intentional design. At minimum choose a characterful `--font-heading` paired with a complementary `--font-base`, ideally from the same foundry or design family. Update `--font-monospace` and `--font-numeric` if necessary. Avoid generic defaults like Arial, Inter, or Roboto.

Load fonts via Google Fonts (or another CDN) as `<link>` tags in `index.html`, then update the font family tokens in the `@theme` block of `global.css`.

### Theming Workflow

Start by customizing `src/global.css` — this is the single source of truth for the app's visual identity. Every component uses these tokens, so setting them first means the entire UI shifts together.

1. **Colors**: Update the semantic color tokens (`--color-primary`, `--color-background`, `--color-card`, `--color-border`, etc.) in both the `@theme` block and the `.dark` override to match the aesthetic direction. The defaults are neutral blue/grey — make them yours.
2. **Radius**: Adjust `--radius` (the base radius) and the radius scale to match the tone — sharp/geometric (lower values), soft/rounded (higher values), or pill-shaped (`--radius-circular`).
3. **Fonts**: Update the font family tokens as described in the Typography section above.
4. **Then build components.** Focus component-level styling on layout, spacing, and element-specific details — not re-specifying colors and radii that the tokens already handle.
5. **Selective overrides last.** After the base theme is in place, inspect and adjust individual components that need to deviate — an accent-colored card border, a button with a unique hover effect, etc.

---

Keep these principles in mind:
- Use semantic color tokens so surfaces, text, and borders adapt correctly to light and dark mode.
- Maintain sufficient contrast between text and backgrounds.
- The recommended minimum text size is `text-200`. 
- Keep spacing consistent — use the spacing tokens from the theme rather than arbitrary values.
- Ensure all interactive elements are keyboard-accessible with visible focus indicators and appropriate disabled states.

Read these reference files on demand during Phase 2–3 iteration, when refining a specific element — they include "Make it yours" prompts that tie back to the aesthetic direction above:
- [UI Style Recipes](references/ui-style-recipes.md) — per-element styling guidance for buttons, cards, inputs, dialogs, tabs, tooltips, tables, and more.
- [Visual Style Recipes](references/visual-style-recipes.md) — chart theming, Vega-Lite config, dark mode chart support, and mark-specific styling.

---

## App Layout

These are good defaults for app structure. Adapt them to the specific app's needs.

### Page Structure

- The app layout should fill the viewport.
- On wide screens, constrain the content width so it doesn't stretch uncomfortably. Use responsive breakpoints or multi-column layouts to make good use of available space.

Don't default to the same layout every time. The structure should serve the aesthetic direction — a sidebar + main content split, a full-width single column, a multi-panel master-detail, an asymmetric split, or something else entirely. These are starting points, not an exhaustive list. Invent a layout that fits the app's purpose and tone.

The header/toolbar is part of the design language — not every app needs a traditional fixed header. Consider alternatives: a floating command bar, a compact inline toolbar, a branded banner, a collapsible drawer, a minimal top-right action cluster, or no header at all if the content speaks for itself.

### Container Sizing

`VegaVisual` and other content components fill their container — the **container controls their dimensions**. Without constraints, charts and content stretch to the full viewport width, which produces squished, unreadable visuals on wide screens.

- **Constrain the dashboard wrapper, not individual charts.** Apply a max-width to the outermost content wrapper that holds the dashboard. This single constraint keeps the entire layout proportional on wide monitors. If the app lacks an outer wrapper, create one.
- **Do not constrain individual chart containers.** Let the wrapper width plus grid columns determine each chart's size naturally.
- If the user explicitly requests full-width charts, confirm the design choice before proceeding.

### Dashboard Grid

- Start mobile-first and scale up columns with responsive breakpoints.
- Support mixed-size cards via span utilities.

Avoid uniform grids where every card is the same size — they look like a spreadsheet. Vary card spans to create visual hierarchy: a wide chart spanning two columns next to a tall narrow KPI panel, or a full-width table below a row of smaller cards. Let the data importance guide which elements get more space.

### Loading, Empty & Error States

Every component that depends on async data should handle all three states:

| State | What to show |
|---|---|
| **Loading** | A skeleton placeholder matching the shape of the expected content |
| **Empty** | A centered muted message explaining no data is available |
| **Error** | A destructive-styled banner with the error message |

### Dark Mode

Include a light/dark mode toggle in the app header or toolbar. Use the `useAppTheme` hook from `@/hooks/use-theme` to read and toggle the theme.

---

## Coding Conventions

- **Styling**: Tailwind CSS v4 utility classes for all styling. Theme colors are defined as CSS custom properties in `src/global.css` using `@theme`. Use Tailwind classes directly in JSX.
- **Theming**: Light/dark color tokens defined in `src/global.css` via CSS custom properties. Dark mode uses the `.dark` class on the root `html` element, auto-detected via `prefers-color-scheme`, `data-appearance` attribute, or `.dark` class. The `useAppTheme` hook in `src/hooks/use-theme.ts` manages the toggle.
- **CSS class merging**: Use `cn()` from `@/lib/utils` (powered by `clsx` + `tailwind-merge`) to conditionally combine Tailwind class names.
- **Icons**: Lucide React for UI icons.
- **UI Components**: Use Radix primitives with Tailwind CSS styling for all interactive elements — buttons, inputs, dialogs, menus, tabs, etc.

### UI Token Rules

All styling must use the design tokens defined in `src/global.css` via Tailwind utility classes. Never hardcode raw color values, pixel sizes, or font stacks — raw values are only permitted in `global.css` where the tokens are defined. Refer to `global.css` for available tokens, their values, and expected usage.

Examples:
- `bg-primary text-primary-foreground` — not `bg-blue-600 text-white`
- `text-300` — not `text-sm` or `text-[14px]`
- `p-l gap-m` — not `p-4`, `gap-3`, `p-spacing-l`, or `gap-spacing-m`
- `font-semibold` — not `font-[600]`
- `rounded-xl` — not `rounded-[8px]`
- `icon-size-200` — not `w-4 h-4`

**`cn()` and tailwind-merge conflicts:** `tailwind-merge` treats `text-*` utilities as one conflict group. In `cn()`, combining text size and text color with ambiguous `text-*` classes can drop one class. Prefer explicit length syntax for font size (e.g., `text-[length:var(--text-300)]`) when combining with text color classes inside `cn()`. If classes are static and not merged, `text-300 text-foreground` is acceptable.

**Form element font inheritance:** Native form controls may not inherit the page font family by default. Ensure base styles in `global.css` set `font-family: inherit` for `select`, `input`, `textarea`, and `button`.

---

## Final Audit

Treat this as a Phase 3 polish-pass activity after the dashboard is built, deployed, and reviewed — not before the first deploy.

After assembling a layout, audit each element in its actual context — not in isolation. A component may look correct on its own but break the visual rhythm of the page. Check: Is every text legible? Are labels proportional to their controls? Are toolbar rows aligned on a shared edge? Do charts fill their containers? Do repeated elements (badges in tables, icons in lists) maintain appropriate visual weight for their density? Fix anything that fails.