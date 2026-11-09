# Kite Cloud

Cloudflare Workers + Vite control plane for Kite. It will store and publish the
child profiles that Kite clients fetch through the remote configuration sync
documented in
[`../kite/docs/REMOTE-CONFIG.md`](../kite/docs/REMOTE-CONFIG.md).

## Stack

- Vite 8 with the Cloudflare Vite plugin
- React 19 for the admin interface
- Tailwind CSS v4
- Cloudflare Workers for the API, with static assets served by Workers Assets

## Structure

```text
apps/cloud
├── src/                 React admin interface
├── worker/              Worker API entry point
├── worker-configuration.d.ts  Generated Worker types
├── vite.config.ts
└── wrangler.jsonc
```

## Commands

Run from this directory, or use the root aliases.

```bash
npm run dev         # Vite dev server with the Worker in workerd
npm run build       # Type-check and build to dist/
npm run preview     # Build and preview through the Workers runtime
npm run deploy      # Build and deploy with Wrangler
npm run cf-typegen  # Regenerate worker-configuration.d.ts
```

From the repository root:

```bash
npm run dev --workspace=kite-cloud
npm run build --workspace=kite-cloud
npm run deploy --workspace=kite-cloud
```

## API

| Method | Path          | Response                                  |
| ------ | ------------- | ----------------------------------------- |
| `GET`  | `/api/health` | `{ "ok": true, "service": "kite-cloud" }` |

## Configuration

Bindings and routes belong in `wrangler.jsonc`. After changing bindings run
`npm run cf-typegen` and commit the updated `worker-configuration.d.ts`.

Deployment requires a Cloudflare account and `wrangler login` (or a
`CLOUDFLARE_API_TOKEN` in CI). No deployment is configured yet.
