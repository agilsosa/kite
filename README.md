# Kite

Kite is a monorepo for a kiosk-locked desktop launcher and the cloud service
that manages its child profiles.

## Projects

| Workspace    | Package      | Description                                                                               |
| ------------ | ------------ | ----------------------------------------------------------------------------------------- |
| `apps/kite`  | `kite`       | Electron launcher for the child device. See [`apps/kite/README.md`](apps/kite/README.md). |
| `apps/cloud` | `kite-cloud` | Cloudflare Workers + Vite control plane that will publish profiles for remote sync.       |

Shared code can live under `packages/*` when both apps need it.

## Requirements

- Node.js 22 or newer
- npm 10 or newer (the repository pins npm 12.2.1 via `packageManager`)

## Setup

```bash
npm install
```

## Development

Run every app's development task in parallel:

```bash
npm run dev
```

Or start one workspace:

```bash
npm run dev --workspace=kite
npm run dev --workspace=kite-cloud
```

## Checks

```bash
npm run typecheck
npm run lint
```

## Build

```bash
npm run build
```

`apps/kite` packages the Electron app with Electron Forge. `apps/cloud` builds
the Worker bundle and static assets into `dist/`.

## Kiosk app

The Electron app is documented in [`apps/kite/README.md`](apps/kite/README.md),
including packaging, releases, the remote configuration contract, and the
acceptance checklist.

## Cloud control plane

The Cloudflare app is documented in
[`apps/cloud/README.md`](apps/cloud/README.md).

Turborepo caches task results locally. Use `npx turbo run <task>` to target a
pipeline, or npm's `--workspace` flag to target a single package.

## Agent skills

Agent skills are stored in `.agents/skills/` and tracked by
`skills-lock.json`. The Turborepo skill was installed with:

```bash
npx skills add vercel/turborepo
```

It points agents at the documentation bundled with the installed `turbo`
package, so guidance always matches the pinned version.
