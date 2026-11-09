# Remote configuration API

Parents can refresh Kite's child profile from an HTTPS JSON endpoint. The
endpoint is configured in **Ajustes de adultos → Sincronización** and is only
available after unlocking the parent PIN.

Kite is a client only. This document defines the response contract; it does not
describe a server implementation.

## Request

Kite sends a `GET` request when the parent presses **Actualizar desde el
servidor**.

| Item               | Value                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| Method             | `GET`                                                                            |
| `Accept`           | `application/json`                                                               |
| Timeout            | 10 seconds                                                                       |
| Maximum response   | 256 KiB                                                                          |
| Authentication     | None in this version                                                             |
| Cache              | `no-store`                                                                       |
| Redirects          | Followed; the final URL must also be allowed                                     |
| HTTPS              | Required in packaged builds                                                      |
| HTTP               | Loopback only in unpackaged development builds (`localhost`, `127.0.0.1`, `::1`) |
| Credentials in URL | Rejected                                                                         |

The endpoint should return `200 OK` and a UTF-8 JSON object. Any other status is
reported in the parent UI and leaves the current configuration unchanged.

## Full-state semantics

A successful response **replaces every parent-managed value**:

- `childName`
- `volumeCap`
- `allowedOrigins`
- `allowedApps`
- `features`
- `parentPin` (only when the response includes it; otherwise the current PIN
  is kept)

The sample-app migration marker and internal application state are never
changed by the response. If validation fails, nothing is applied; the previous
configuration stays in place. The endpoint itself is stored as soon as it is
valid so the parent can retry after a network error.

Because this is a full-state replacement, the server must always send every
required field, including empty lists. It is not a patch or merge API.
`parentPin` is the only optional value that is replaced rather than cleared
when omitted, so a server that does not manage PINs keeps working unchanged.

## Response shape

```json
{
  "schemaVersion": 1,
  "revision": "2026-11-01T12:00:00Z",
  "childName": "Lucía",
  "parentPin": "4821",
  "volumeCap": 45,
  "allowedOrigins": ["https://pbskids.org", "https://www.starfall.com"],
  "allowedApps": [
    {
      "id": "firefox",
      "name": "Firefox",
      "icon": "globe",
      "paths": {
        "linux": "/usr/bin/firefox",
        "windows": "C:\\Program Files\\Mozilla Firefox\\firefox.exe"
      },
      "args": []
    },
    {
      "id": "drawing",
      "name": "Dibujar",
      "icon": "palette",
      "paths": {
        "linux": "/usr/bin/drawing",
        "windows": "C:\\Program Files\\Drawing\\drawing.exe"
      }
    }
  ],
  "features": {
    "bedtime": {
      "enabled": true,
      "start": "20:30",
      "end": "07:00"
    }
  }
}
```

A machine-readable schema is in
[`remote-config.schema.json`](remote-config.schema.json). A copy of the example
is in [`remote-config.example.json`](remote-config.example.json).

## Fields

| Field            | Type             | Required | Rules                                                                                                                                                               |
| ---------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`  | integer          | Yes      | Must be `1`. A different value is rejected as incompatible.                                                                                                         |
| `revision`       | string or number | No       | 1–100 characters after trimming. Stored and shown in parent settings. Useful for cache busting and support.                                                         |
| `childName`      | string           | Yes      | 1–40 characters after trimming.                                                                                                                                     |
| `parentPin`      | string           | No       | 4–8 digits, for example `"4821"`. When present, Kite hashes it locally with a fresh salt and replaces the current adult PIN. When omitted, the current PIN is kept. |
| `volumeCap`      | integer          | Yes      | `0`–`100`. This is the maximum volume Kite allows and the profile's volume setting. Kite has no separate startup volume.                                            |
| `allowedOrigins` | string[]         | Yes      | At most 50. Each value must be an `https://` URL; Kite stores only its origin, for example `https://example.com`. Duplicates are removed.                           |
| `allowedApps`    | object[]         | Yes      | At most 30. See the app fields below.                                                                                                                               |
| `features`       | object           | No       | Reserved for future server-driven features. Stored unchanged by this version. Maximum 64 KiB, nesting depth 4, 50 keys per object, 50 items per array.              |

Unknown **top-level** fields are ignored, so a newer server can add metadata
without breaking older clients. Add actual settings that Kite should act on
under `features`; this version stores that object but does not interpret it.

### App fields

| Field   | Type     | Required  | Rules                                                                                                             |
| ------- | -------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`    | string   | No        | 1–64 characters from `A–Z`, `a–z`, `0–9`, `_`, `-`. Must be unique when provided. If omitted, Kite generates one. |
| `name`  | string   | Yes       | 1–40 characters after trimming.                                                                                   |
| `icon`  | string   | No        | One of the icon keys below. Unknown values fall back to `puzzle`.                                                 |
| `paths` | object   | See below | Executable path per operating system. See [Per-OS app paths](#per-os-app-paths).                                  |
| `path`  | string   | See below | Legacy single executable path, used only when `paths` has no entry for the current OS. At most 1000 characters.   |
| `args`  | string[] | No        | At most 10 arguments, each at most 200 characters.                                                                |

Each app must provide either `paths` or the legacy `path`. When `paths` is
present, its entry for the current operating system wins over `path`.

Valid icon keys:

```text
puzzle, gamepad, book, palette, music, film, camera, flask, globe, rocket,
cat, bot, trophy, wrench, star, shapes, sparkles, compass, folder
```

### Per-OS app paths

`paths` is an object keyed by operating system so one backend document works on
every kiosk, without the server knowing which device is syncing:

```json
{
  "name": "Firefox",
  "paths": {
    "linux": "/usr/bin/firefox",
    "windows": "C:\\Program Files\\Mozilla Firefox\\firefox.exe"
  }
}
```

Supported keys are `linux`, `windows`, and `macos`. Each value is an absolute
path of at most 1000 characters:

- `linux` and `macos` must start with `/`.
- `windows` must be a drive path such as `C:\Program Files\App\app.exe` or a
  UNC path such as `\\server\share\app.exe`.

Only the entry for the operating system Kite is running on is read. The other
entries are optional, so a Linux-only or Windows-only deployment can send just
that one key. If `paths` has no entry for the current OS, Kite falls back to the
legacy `path` field; if neither is available the sync fails with:

```text
La aplicación "Firefox" no tiene una ruta para Linux
```

Use `paths` for new integrations. `path` remains supported for older servers
and for profiles that only target one OS. Unknown keys inside `paths` are
rejected rather than ignored:

```text
Las rutas de "Firefox" incluyen una plataforma no válida: darwin
```

Paths are still machine-specific. Return paths that exist on the target kiosk,
or return different profiles per device/site from the server side.

## Future features

`features` is the extension point. It is an arbitrary JSON object with the size
and nesting limits above, and Kite currently persists it without acting on it.
A future Kite version can start reading a namespaced key, for example:

```json
{
  "features": {
    "schedule": {
      "weekdayStart": "08:00",
      "weekdayEnd": "20:00"
    },
    "allowedContacts": []
  }
}
```

Keep feature names namespaced and treat missing keys as disabled/empty so older
clients remain compatible. Do not use `features` for values that this version
already validates, such as `childName` or `volumeCap`.

## Validation and errors

All validation happens before anything is written. The parent sees a Spanish
error for the first problem found, for example:

- `La dirección de la API debe usar HTTPS`
- `La API respondió con HTTP 404`
- `La API no devolvió JSON válido`
- `La versión del formato de sincronización no es compatible. Se esperaba schemaVersion 1.`
- `El PIN de adultos debe tener de 4 a 8 dígitos`
- `El sitio web en la posición 2 no es válido: Los sitios web deben usar HTTPS`
- `La aplicación "Firefox" usa un id repetido (firefox)`
- `La aplicación "Firefox" no tiene una ruta para Linux`
- `Las rutas de "Firefox" deben ser un objeto`
- `Las rutas de "Firefox" incluyen una plataforma no válida: darwin`

Limits are enforced, not truncated: sending 31 apps or 51 websites is an error
rather than silently dropping the extras.

## Trust model

The endpoint is configured by a parent, so Kite treats its response as trusted
configuration. It can add websites and native executables to the child's
allow-list and, when `parentPin` is present, replace the adult PIN. Protect the
endpoint and the server that serves it:

- Use HTTPS with a valid certificate.
- Do not let the response be editable by the child or an untrusted party.
- Use a stable, versioned URL and return only JSON.
- Treat write access to the endpoint as equivalent to knowing the adult PIN.
- Do not log PIN values, and avoid serving them from a URL the child can reach.
- Kite does not sign or verify the response, and it does not authenticate to
  the endpoint in this version.

## Testing

The endpoint must be reachable from the kiosk machine, not just from a browser
on another computer.

From the parent settings, open **Sincronización**, enter the URL, and press
**Actualizar desde el servidor**. A successful sync shows the server revision
and the sync time, and updates the other settings tabs.

For development, a local server may use HTTP on loopback when Kite is running
unpackaged:

```bash
python3 -m http.server 8000 --directory /tmp/kite-config
```

Then use `http://localhost:8000/config.json` as the endpoint. A packaged build
requires HTTPS.

A quick contract check:

```bash
curl -fsS https://example.com/kite.json | jq .
```

Confirm that every app has a valid route for the operating system of the target
kiosk (`paths.linux`, `paths.windows`, or `paths.macos`) and that every icon is
valid before pointing a production kiosk at the endpoint.
