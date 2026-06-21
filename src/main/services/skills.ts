/**
 * Project "skills": curated, app-building guidance modules the user can switch on
 * per project. A skill is a real GitHub Copilot CLI skill file at
 * `.agents/skills/<id>/SKILL.md` (the same convention the Rayfin CLI uses for its
 * own `rayfin` skill) — so enabling one genuinely changes what the agent builds.
 *
 * The Rayfin CLI owns skills it marks with `rayfin-managed: true` in frontmatter
 * (tracked in `rayfin/.lockfile.json`); those are shown locked and never touched
 * here. Our add-on skills are plain, unmanaged SKILL.md files the user toggles —
 * the CLI's agent-files manager only reconciles its own descriptors, so ours are
 * safe across `rayfin up` / `rayfin dev`.
 *
 * Each add/remove is committed (scoped to the skill folder) so the History view
 * shows it.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { run } from './exec'
import { findProject } from './store'
import type { SkillActionResult, SkillInfo } from '../../shared/ipc'

interface SkillDef {
  id: string
  title: string
  /** One-line description shown on the card. */
  description: string
  icon: string
  /** Frontmatter `description` — tells the agent when to apply the skill. */
  trigger: string
  /** Markdown guidance (the SKILL.md body). */
  body: string
}

/**
 * The add-on skill catalog. These are the skills the Skills tab offers to install.
 * Order here is the display order. The base Rayfin skill is NOT in this catalog —
 * it is the CLI-managed `.agents/skills/rayfin` skill, surfaced as a locked card.
 */
const CATALOG: SkillDef[] = [
  {
    id: 'buttery-animations',
    title: 'Buttery-smooth animations',
    description: 'Add tasteful, performant motion — transitions, springs and micro-interactions.',
    icon: '✨',
    trigger:
      'Use when building or refining any UI to add smooth, performant motion. Triggers: animation, transition, motion, micro-interaction, hover, spring, easing, fade, slide, reveal, prefers-reduced-motion, 60fps, keyframes',
    body: `Make the app feel alive with smooth, tasteful motion:
- Animate state changes (mount/unmount, list add/remove, route changes) instead of snapping.
- Prefer GPU-friendly \`transform\` and \`opacity\`; avoid animating layout properties (width,
  height, top/left) that cause reflow. Target a steady 60fps.
- Use natural easing — ease-out for entrances, spring-like curves for interactive elements.
  Keep durations short (120–300ms); never block the user waiting on an animation.
- Add subtle micro-interactions: hover/press feedback on buttons, gentle focus rings.
- Always respect \`prefers-reduced-motion\`: drop to instant/opacity-only when the user asks.`
  },
  {
    id: 'polished-ui',
    title: 'Polished, modern UI',
    description: 'A clean, consistent visual style with good spacing, type and color.',
    icon: '🎨',
    trigger:
      'Use when creating or styling UI to give it a clean, modern, consistent look. Triggers: design, styling, CSS, layout, spacing, typography, color, theme, dark mode, light mode, design tokens, components, visual polish',
    body: `Give the app a clean, modern, consistent look:
- Use a consistent spacing scale (4/8px rhythm), a clear type hierarchy and generous whitespace.
- Establish reusable design tokens (colors, radius, shadows) instead of one-off values; keep a
  single accent color and use it sparingly for primary actions.
- Flat and modern: subtle borders and soft shadows over heavy gradients; align elements to a grid.
- Support both light and dark themes with accessible contrast in each.
- Keep components visually consistent — buttons, inputs and cards should share sizing and shape.`
  },
  {
    id: 'responsive-layout',
    title: 'Responsive on every screen',
    description: 'Layouts that adapt cleanly from mobile to large desktop.',
    icon: '📱',
    trigger:
      'Use when building layouts so they adapt to any screen size. Triggers: responsive, mobile, tablet, desktop, breakpoint, media query, flexbox, grid, fluid layout, viewport, small screen, overflow',
    body: `Make the UI work on any screen size:
- Design mobile-first, then enhance for larger viewports with sensible breakpoints.
- Use fluid layouts (flexbox/grid, %/fr, min/max, clamp()) rather than fixed pixel widths.
- Ensure tap targets are at least 44px and content never overflows or requires horizontal scroll.
- Collapse multi-column layouts into a single column on small screens; keep key actions reachable.
- Test the important flows at narrow (~375px) and wide (~1440px) widths.`
  },
  {
    id: 'accessibility',
    title: 'Accessible to everyone',
    description: 'Semantic, keyboard-friendly UI that works with screen readers.',
    icon: '♿',
    trigger:
      'Use when building UI to make it usable by everyone, including assistive tech. Triggers: accessibility, a11y, ARIA, screen reader, keyboard navigation, focus, semantic HTML, alt text, contrast, WCAG, labels, tab order',
    body: `Build the app to be usable by everyone:
- Use semantic HTML (button, nav, main, label, headings in order) before reaching for ARIA.
- Every interactive element must be keyboard reachable and operable, with a visible focus state.
- Label all form controls; associate errors with their inputs via aria-describedby.
- Provide alt text for meaningful images and aria-labels for icon-only buttons.
- Meet WCAG AA color contrast (4.5:1 for text); never rely on color alone to convey meaning.`
  },
  {
    id: 'loading-empty-states',
    title: 'Great loading & empty states',
    description: 'Skeletons, spinners and friendly empty/error states everywhere data loads.',
    icon: '⏳',
    trigger:
      'Use when fetching or mutating data to handle every async state gracefully. Triggers: loading, spinner, skeleton, empty state, error state, retry, async, fetch, pending, optimistic update, no data, placeholder',
    body: `Handle every async state gracefully:
- Show a loading indicator (skeleton placeholders preferred over spinners) while data fetches.
- Design friendly empty states with a short explanation and a clear primary action ("Add your
  first item") instead of a blank screen.
- Show concise, recoverable error states with a retry option; never leave the user stuck.
- Use optimistic updates for quick actions where safe, reconciling once the server responds.
- Disable buttons and show progress while a submit is in flight to prevent double submits.`
  },
  {
    id: 'friendly-forms',
    title: 'Friendly forms & validation',
    description: 'Clear inputs, inline validation and helpful, human error messages.',
    icon: '📝',
    trigger:
      'Use when building forms or data entry to make them clear and forgiving. Triggers: form, input, validation, error message, required field, submit, field, placeholder, autofocus, helper text, data entry',
    body: `Make data entry painless:
- Validate inline as the user goes and on submit; show errors next to the field, in plain language.
- Write helpful messages ("Enter a date in the future") rather than codes; suggest how to fix it.
- Use the right input types/keyboards, sensible defaults, placeholders and autofocus on the first field.
- Keep forms short; group related fields and explain anything non-obvious with helper text.
- Preserve the user's input on error and confirm success clearly after submit.`
  },
  {
    id: 'data-viz',
    title: 'Beautiful charts & dashboards',
    description: 'Turn your Rayfin data into clear, attractive charts and summaries.',
    icon: '📊',
    trigger:
      'Use when presenting data, metrics or dashboards. Triggers: chart, graph, dashboard, visualization, KPI, metric, line chart, bar chart, donut, analytics, summary card, data viz, trends',
    body: `Visualize the app's data well (it lives in Rayfin's data service):
- Pick the right chart for the question: trends over time → line, comparisons → bar,
  parts of a whole → donut (sparingly). Avoid 3D and chart junk.
- Lead with the headline numbers (KPIs/summary cards), then the supporting charts.
- Use clear axis labels, readable tick counts, accessible colors and tooltips on hover.
- Keep charts responsive and show a tidy empty state when there's no data yet.
- Aggregate/query data through Rayfin rather than pulling everything to the client.`
  }
]

/** Friendly presentation for known CLI-managed (locked) skills found on disk. */
const MANAGED_PRESENTATION: Record<string, { title: string; description: string; icon: string }> = {
  rayfin: {
    title: 'Rayfin essentials',
    description: 'Core Rayfin knowledge, conventions and CLI usage. Managed by Rayfin — always on.',
    icon: '◆'
  },
  'rayfin-functions': {
    title: 'Rayfin Functions',
    description: 'Guidance for building Rayfin serverless functions. Managed by Rayfin.',
    icon: 'λ'
  }
}

/** The Fabricator operating contract written to `.github/copilot-instructions.md`. */
const AGENT_INSTRUCTIONS = `# Rayfin Fabricator — agent guidance

This is a **Rayfin app** (a Microsoft Fabric Backend-as-a-Service app). You are the
coding agent running inside **Rayfin Fabricator**, a desktop app that drives you plus the
Rayfin CLI to build and deploy this app.

## Rules
- **Make the requested code changes only.** Edit files to implement what the user asks.
- **Do NOT run \`rayfin up\` or otherwise deploy.** Rayfin Fabricator runs the full
  \`rayfin up\` automatically after your changes and shows the deployed app in its preview.
- Do **not** start dev servers or run the app locally — it is only ever run via deploy.
- Keep the project building; prefer small, correct changes.
- Only use what Rayfin natively provides (data, auth, file storage, functions, static
  hosting). Do **not** add external services like payment processors or email senders.
- Detailed Rayfin SDK/CLI guidance lives in the \`rayfin\` skill (\`.agents/skills/rayfin\`);
  additional enabled skills live alongside it under \`.agents/skills/\`.

When you finish editing, briefly summarize what you changed — Rayfin Fabricator handles the deploy.
`

const SKILLS_REL = join('.agents', 'skills')
const INSTRUCTIONS_REL = join('.github', 'copilot-instructions.md')
const LEGACY_MANIFEST_REL = join('.github', 'rayfin-skills.json')
const GENERATED_MARKER = 'Generated by Rayfin Fabricator'

function byId(id: string): SkillDef | undefined {
  return CATALOG.find((s) => s.id === id)
}

/** Minimal frontmatter read: the YAML block between the leading `---` fences. */
function frontmatter(raw: string): string | null {
  const text = raw.startsWith('\ufeff') ? raw.slice(1) : raw
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return m ? m[1] : null
}

/** True when a SKILL.md is CLI-managed (`rayfin-managed: true` sigil). */
function isManaged(raw: string): boolean {
  const fm = frontmatter(raw)
  return fm ? /^\s*rayfin-managed:\s*true\s*$/m.test(fm) : false
}

/** Build a SKILL.md file body for one of our add-on skills. */
function renderSkillFile(def: SkillDef): string {
  return (
    `---\n` +
    `name: ${def.id}\n` +
    `description: "${def.trigger.replace(/"/g, "'")}"\n` +
    `metadata:\n` +
    `  author: Rayfin Fabricator\n` +
    `  version: 1.0.0\n` +
    `---\n` +
    `# ${def.title}\n\n` +
    def.body.trim() +
    '\n'
  )
}

interface OnDisk {
  managed: boolean
}

/** Read installed skills: id → { managed } for every `.agents/skills/<id>/SKILL.md`. */
function readInstalled(dir: string): Map<string, OnDisk> {
  const out = new Map<string, OnDisk>()
  const root = join(dir, SKILLS_REL)
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return out
  }
  for (const name of entries) {
    const file = join(root, name, 'SKILL.md')
    try {
      const raw = readFileSync(file, 'utf8')
      out.set(name, { managed: isManaged(raw) })
    } catch {
      /* not a skill dir */
    }
  }
  return out
}

function presentationFor(id: string): { title: string; description: string; icon: string } {
  if (MANAGED_PRESENTATION[id]) return MANAGED_PRESENTATION[id]
  const def = byId(id)
  if (def) return { title: def.title, description: def.description, icon: def.icon }
  // Unknown custom skill found on disk — present it generically.
  const title = id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return { title, description: 'A custom skill in this project.', icon: '🧩' }
}

/** Compose the project's skill list: locked managed skills, catalog add-ons, then extras. */
function buildList(dir: string): SkillInfo[] {
  const installed = readInstalled(dir)
  const list: SkillInfo[] = []
  const used = new Set<string>()

  // 1) CLI-managed (locked) skills first, in a stable, friendly order.
  const managedOrder = ['rayfin', 'rayfin-functions']
  const managedIds = [
    ...managedOrder.filter((id) => installed.get(id)?.managed),
    ...[...installed.entries()]
      .filter(([id, d]) => d.managed && !managedOrder.includes(id))
      .map(([id]) => id)
  ]
  for (const id of managedIds) {
    const p = presentationFor(id)
    list.push({ id, title: p.title, description: p.description, icon: p.icon, base: true, active: true })
    used.add(id)
  }

  // 2) Our curated add-on catalog (active when installed and unmanaged).
  for (const def of CATALOG) {
    if (used.has(def.id)) continue
    const onDisk = installed.get(def.id)
    list.push({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      base: false,
      active: Boolean(onDisk && !onDisk.managed)
    })
    used.add(def.id)
  }

  // 3) Any other installed unmanaged skills (e.g. agent-authored) — shown, removable.
  for (const [id, d] of installed) {
    if (used.has(id) || d.managed) continue
    const p = presentationFor(id)
    list.push({ id, title: p.title, description: p.description, icon: p.icon, base: false, active: true })
  }

  return list
}

/**
 * Ensure the Fabricator operating contract exists and clean up any artifacts from
 * the earlier (manifest-based) skills implementation. Best-effort. Called on
 * scaffold/open.
 */
export function ensureProjectSkills(dir: string): void {
  try {
    ensureAgentInstructions(dir)
    migrateLegacyManifest(dir)
  } catch {
    /* best-effort — the deploy loop still works without it */
  }
}

/** Write `.github/copilot-instructions.md`, healing the old generated variant. */
function ensureAgentInstructions(dir: string): void {
  const file = join(dir, INSTRUCTIONS_REL)
  let existing: string | null = null
  try {
    existing = readFileSync(file, 'utf8')
  } catch {
    /* absent */
  }
  // Write when absent, or overwrite the earlier auto-generated (skills-inlined) file.
  if (existing !== null && !existing.includes(GENERATED_MARKER)) return
  const ghDir = join(dir, '.github')
  if (!existsSync(ghDir)) mkdirSync(ghDir, { recursive: true })
  writeFileSync(file, AGENT_INSTRUCTIONS, 'utf8')
}

/**
 * Migrate the earlier `.github/rayfin-skills.json` manifest: re-create any active
 * add-on skills as real `.agents/skills/<id>/SKILL.md` files, then remove the
 * stray manifest so the project uses the on-disk convention going forward.
 */
function migrateLegacyManifest(dir: string): void {
  const manifestPath = join(dir, LEGACY_MANIFEST_REL)
  let raw: string
  try {
    raw = readFileSync(manifestPath, 'utf8')
  } catch {
    return
  }
  try {
    const parsed = JSON.parse(raw) as { active?: string[] }
    const installed = readInstalled(dir)
    for (const id of parsed.active ?? []) {
      const def = byId(id)
      if (def && !installed.has(id)) writeSkillFile(dir, def)
    }
  } catch {
    /* ignore a malformed manifest */
  }
  try {
    rmSync(manifestPath, { force: true })
  } catch {
    /* best-effort */
  }
}

function writeSkillFile(dir: string, def: SkillDef): void {
  const skillDir = join(dir, SKILLS_REL, def.id)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'SKILL.md'), renderSkillFile(def), 'utf8')
}

/** The project's skill list (locked managed skills + add-on catalog + extras). */
export function listSkills(projectId: string): SkillInfo[] {
  const project = findProject(projectId)
  if (!project) return []
  return buildList(project.path)
}

/** Ensure a local git identity exists so commits don't fail on a fresh machine. */
async function ensureGitIdentity(dir: string): Promise<void> {
  const email = await run('git', ['config', 'user.email'], { cwd: dir, timeout: 15_000 })
  if (!email.stdout.trim()) {
    await run('git', ['config', 'user.email', 'fabricator@rayfin.local'], { cwd: dir, timeout: 15_000 })
    await run('git', ['config', 'user.name', 'Rayfin Fabricator'], { cwd: dir, timeout: 15_000 })
  }
}

/**
 * Turn a skill on or off for a project: create or delete its
 * `.agents/skills/<id>/SKILL.md` and commit just that folder. CLI-managed
 * (locked) skills cannot be removed.
 */
export async function setSkill(
  projectId: string,
  skillId: string,
  active: boolean
): Promise<SkillActionResult> {
  const project = findProject(projectId)
  if (!project) return { ok: false, error: 'Project not found.', skills: [] }

  const dir = project.path
  const installed = readInstalled(dir)
  const onDisk = installed.get(skillId)

  const def = byId(skillId)
  if (active) {
    if (!def) return { ok: false, error: 'Unknown skill.', skills: buildList(dir) }
    if (onDisk?.managed) {
      return { ok: false, error: 'That skill is managed by Rayfin.', skills: buildList(dir) }
    }
  } else {
    if (onDisk?.managed) {
      return {
        ok: false,
        error: "That skill is managed by Rayfin and can't be removed.",
        skills: buildList(dir)
      }
    }
    if (!onDisk) return { ok: true, skills: buildList(dir) }
  }

  const skillDirRel = join(SKILLS_REL, skillId)
  let title = skillId
  try {
    if (active && def) {
      title = def.title
      writeSkillFile(dir, def)
    } else {
      title = presentationFor(skillId).title
      rmSync(join(dir, skillDirRel), { recursive: true, force: true })
    }
  } catch (err) {
    return { ok: false, error: `Could not update skills: ${String(err)}`, skills: buildList(dir) }
  }

  // Commit just the skill folder (best-effort) so the change shows in History.
  try {
    await ensureGitIdentity(dir)
    await run('git', ['add', '-A', '--', skillDirRel], { cwd: dir, timeout: 30_000 })
    const message = `${active ? 'Add' : 'Remove'} skill: ${title}`
    await run('git', ['commit', '-m', message, '--', skillDirRel], { cwd: dir, timeout: 30_000 })
  } catch {
    /* best-effort — the files are written even if the commit fails */
  }

  return { ok: true, skills: buildList(dir) }
}
