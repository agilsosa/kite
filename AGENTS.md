# Kite monorepo conventions

## Layout

- `apps/kite` — the Electron kiosk launcher used on the child device. It has its
  own AGENTS.md with UI rules specific to the renderer.
- `apps/admin` — the Cloudflare Workers + Vite control plane that will publish
  the child profiles consumed by Kite's remote configuration sync.
- `packages/*` — shared TypeScript packages, when code needs to be reused by
  both apps.

## Tooling

- The repository is an npm workspaces monorepo managed by Turborepo.
- Run tasks from the repository root:
  - `npm run dev`
  - `npm run build`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run lint:fix`
  - `npm run clean`
- Target a single workspace with npm, for example
  `npm run dev --workspace=kite` or `npm run deploy --workspace=kite-admin`.
- Keep task descriptions in `turbo.json` up to date. They are read by agents and
  by people.
- Turborepo ships version-matched documentation in `node_modules/turbo/docs/`.
  Read `node_modules/turbo/docs/README.md` before changing `turbo.json`, task
  pipelines, caching, or workspace configuration.
- Prefer package-level scripts over root scripts that reach into an app's
  internals. Turborepo should orchestrate, not duplicate build logic.

## Cloudflare

- `apps/admin` uses the Cloudflare Vite plugin with a Worker entry in
  `worker/index.ts` and static assets in `src/`.
- Configure bindings in `apps/admin/wrangler.jsonc`. Do not edit the generated
  `dist/wrangler.json`.
- Regenerate worker types with `npm run cf-typegen --workspace=kite-admin`
  after changing bindings, and commit `worker-configuration.d.ts`.

## UI

- Both apps use Tailwind CSS v4 utility classes.
- Kite-specific renderer rules live in `apps/kite/AGENTS.md`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
