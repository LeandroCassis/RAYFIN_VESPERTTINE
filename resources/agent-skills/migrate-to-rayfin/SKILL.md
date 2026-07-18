---
name: migrate-to-rayfin
description: Convert a copied existing web application into a Microsoft Rayfin app. Use when a migration workspace contains `legacy-source/` and `.vesperttine/migration.json`, or when the user asks to assess, plan, or migrate a Lovable, Supabase, React, Vite, Next.js, or other non-Rayfin application to Rayfin without modifying the original source.
---

# Migrate an existing app to Rayfin

Work only in the migration workspace. Treat `legacy-source/` as a protected, read-only snapshot.
Never modify, delete, install dependencies inside, or commit from that directory. Implement the
Rayfin application in the workspace root.

## Phase 1: assess and plan

Remain in Plan mode until the user approves the plan. Perform read-only discovery first:

1. Read `.vesperttine/migration.json` and inventory `legacy-source/`.
2. Identify the framework, package manager, routes, UI system, build scripts, environment variables,
   authentication, database access, server functions, storage, realtime features, scheduled jobs,
   third-party integrations, tests, and deployment assumptions.
3. Inspect every schema or migration source. Record physical table and column names exactly,
   including case, singular/plural form, relationships, defaults, indexes, and authorization rules.
4. Compare each capability with stable Rayfin and Microsoft Fabric support. Use the project-managed
   Rayfin skill and current Rayfin documentation rather than guessing APIs.
5. Produce a task list grouped into application shell, data model, authentication/authorization,
   integrations, data migration, testing, and deployment readiness. Mark blockers, risky conversions,
   choices requiring user input, and features that have no stable Fabric equivalent.
6. Present the plan through the Plan approval flow. Do not edit implementation files before approval.

## Phase 2: migrate after approval

After approval, execute the accepted task list in small, verifiable steps:

1. Preserve the existing user experience unless the migration requires a documented change.
2. Use stable Rayfin SDK features supported on Fabric and MSSQL. Do not enable experimental features
   unless the user explicitly approves the tradeoff.
3. Preserve physical database names exactly. Do not apply English pluralization to existing names.
   When Rayfin name resolution would change a table name, register an explicit custom plural/source
   mapping and keep the GraphQL collection name separate from the physical SQL table name.
4. Replace Supabase or other backend runtime calls with Rayfin services deliberately. Preserve the
   original business identity and authorization model; do not make Rayfin's internal auth tables the
   application's source of roles or ownership.
5. Keep secrets out of source control. Create or update example environment files with variable names
   only, and ask for credentials only when a local test actually requires them.
6. Add reproducible data-migration scripts when data must move, but never execute a destructive or
   production data migration without explicit approval.
7. Keep `legacy-source/` unchanged so every migrated behavior can be compared with the snapshot.

## Phase 3: test locally

This migration workflow is an explicit exception to the editor's normal deploy-to-test guidance.
Before discussing Fabric deployment:

1. Install dependencies in the migrated workspace root.
2. Run available type checks, unit tests, lint, and the production build.
3. Start the supported local Rayfin development environment when available, verify health, and exercise
   the important user flows. If Docker, authentication, or a private image blocks local Rayfin, report
   the exact blocker and still complete all safe static and frontend tests.
4. Fix migration regressions and repeat the relevant checks.
5. Summarize what passed, what could not be exercised, remaining differences, and data-migration status.

Do not run `rayfin up` during assessment, implementation, or local validation. Once local testing is
complete, ask the user for the Microsoft Tenant/account, Fabric workspace ID or name, and desired app
name. Deployment is a separate, explicit user-approved step.
