# Data App

Fabric-authenticated React + Vite app wired for Rayfin data, tuned for the
**Rayfin Fabricator** deploy-to-test workflow. Add an entity in `rayfin/data/`
and the SDK gives you a typed GraphQL client — then deploy to Fabric to try it.

> This is a Fabricator template: there is **no local backend, dev server, or
> test harness**. You build your app and deploy it to a Fabric test workspace —
> the Fabricator agent does this for you and validates the running app in its
> built-in browser.

## Getting started

In Fabricator, just describe what you want to build. To deploy from the CLI:

```bash
npm run rayfin:up
```

## Project structure

```text
├── rayfin/
│   ├── rayfin.yml          # Fabric service configuration
│   └── data/
│       └── schema.ts       # Data schema (empty — add your entities here)
├── src/
│   ├── main.tsx            # Entry point + Rayfin client bootstrap
│   ├── App.tsx             # Routes and auth gate
│   ├── hooks/
│   │   └── AuthContext.tsx # React context wrapping the auth helpers
│   ├── components/
│   │   └── AuthPage.tsx    # Sign-in UI
│   ├── pages/
│   │   └── HomePage.tsx    # Post-auth landing page
│   └── services/
│       ├── IAuthService.ts        # Auth service contract + AuthUser type
│       ├── RayfinAuthService.ts   # Fabric brokered auth
│       ├── rayfinClient.ts        # Typed Rayfin client singleton
│       └── bootstrap.ts           # Reads env, builds the auth service
└── package.json
```

## Adding a data model

Create entity files in `rayfin/data/` using decorators:

```typescript
import { entity, uuid, text, date } from '@microsoft/rayfin-core';

@entity()
export class Item {
  @uuid() id!: string;
  @text() title!: string;
  @date() createdAt!: Date;
}
```

Then update `rayfin/data/schema.ts` and enable `data` in `rayfin/rayfin.yml`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Production build |
| `npm run build:fabric` | Build for Fabric deployment (entrypoint for `rayfin up`) |
| `npm run lint` | Lint with ESLint |
| `npm run rayfin:up` | Deploy the app to a Fabric test workspace |

