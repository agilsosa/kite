# Kite Admin

Cloudflare Workers + Vite control plane for Kite. It stores one child profile
and publishes it through the remote configuration contract documented in
[`../kite/docs/REMOTE-CONFIG.md`](../kite/docs/REMOTE-CONFIG.md).

The admin panel is currently unauthenticated. Do not expose it publicly until
authentication is added.

## Stack

- Vite 8 with the Cloudflare Vite plugin
- React 19 for the admin interface
- Tailwind CSS v4 with the launcher's paper-and-ink theme
- Cloudflare Workers for the API, with static assets served by Workers Assets
- Workers KV for the single published profile

## Structure

```text
apps/admin
├── shared/profile.ts         Profile types, limits, and validation
├── src/                      React admin interface
│   ├── components/           Kite-styled editor sections
│   ├── api.ts                Fetch helpers
│   └── editor.ts             Editor state and payload preview
├── worker/index.ts           Worker API entry point
├── worker-configuration.d.ts Generated Worker types
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
npm run dev --workspace=kite-admin
npm run build --workspace=kite-admin
npm run deploy --workspace=kite-admin
```

## API

| Method | Path           | Purpose                                                             |
| ------ | -------------- | ------------------------------------------------------------------- |
| `GET`  | `/api/health`  | Service status plus whether a profile has been published.           |
| `GET`  | `/api/profile` | Returns the stored profile for the admin editor.                    |
| `PUT`  | `/api/profile` | Validates, stores, and republishes the profile with a new revision. |
| `GET`  | `/api/sync`    | Returns the profile in the exact shape Kite expects.                |

`GET /api/sync` returns `404` until the first profile is saved. It always sends
a complete profile: `schemaVersion`, `revision`, `childName`, `volumeCap`,
`allowedOrigins`, `allowedApps`, and `features` when present. `parentPin` is
intentionally omitted while authentication is disabled.

Every app must provide `paths.linux` and `paths.windows`; `paths.macos` is
optional. The Worker enforces the same limits as Kite: 40-character child name,
volume `0`–`100`, 50 websites, 30 apps, 10 arguments per app, and 64 KiB of
features JSON.

## Local development

```bash
npm run dev --workspace=kite-admin
```

The KV binding works in the local `workerd` instance even with the placeholder
namespace id checked into `wrangler.jsonc`.

## Deployment

1. Create the production KV namespace:

   ```bash
   npx wrangler kv namespace create PROFILE
   ```

2. Replace the placeholder `id` in `wrangler.jsonc` with the printed id.
3. Regenerate the Worker types and commit them:

   ```bash
   npm run cf-typegen --workspace=kite-admin
   ```

4. Deploy with `npm run deploy --workspace=kite-admin`.

Deployment requires a Cloudflare account and `wrangler login` (or a
`CLOUDFLARE_API_TOKEN` in CI).

## Security

Write access to `/api/profile` is equivalent to knowing every device's parent
PIN: it can add websites and native executables. Add authentication before
exposing this Worker on a public hostname.
