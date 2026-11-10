import {
  buildSyncPayload,
  ProfileError,
  SCHEMA_VERSION,
  validateProfileDraft,
} from '../shared/profile';
import type { ProfileDocument } from '../shared/profile';

const PROFILE_KEY = 'profile';
const MAX_BODY_BYTES = 256 * 1024;

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...JSON_HEADERS, ...init.headers },
  });
}

function error(message: string, status: number): Response {
  return json({ error: message }, { status });
}

async function readProfile(env: Env): Promise<ProfileDocument | null> {
  const stored = await env.PROFILE.get(PROFILE_KEY, 'json');

  return stored ? (stored as ProfileDocument) : null;
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();

  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new ProfileError('El perfil supera el tamaño máximo de 256 KiB');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ProfileError('El cuerpo de la petición no es JSON válido');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      if (request.method !== 'GET') {
        return error('Método no permitido', 405);
      }

      try {
        const profile = await readProfile(env);

        return json({
          ok: true,
          service: 'kite-admin',
          hasProfile: profile !== null,
        });
      } catch {
        return json({
          ok: true,
          service: 'kite-admin',
          hasProfile: false,
          kvAvailable: false,
        });
      }
    }

    if (url.pathname === '/api/profile') {
      if (request.method === 'GET') {
        try {
          return json({ profile: await readProfile(env) });
        } catch (cause) {
          console.error('No se pudo leer el perfil', cause);
          return error('No se pudo leer el perfil publicado', 500);
        }
      }

      if (request.method === 'PUT') {
        try {
          const draft = validateProfileDraft(await readBody(request));
          const now = new Date().toISOString();
          const profile: ProfileDocument = {
            ...draft,
            schemaVersion: SCHEMA_VERSION,
            revision: now,
            updatedAt: now,
          };

          await env.PROFILE.put(PROFILE_KEY, JSON.stringify(profile));

          return json({ profile });
        } catch (cause) {
          if (cause instanceof ProfileError) {
            return error(cause.message, 400);
          }

          console.error('No se pudo guardar el perfil', cause);
          return error('No se pudo guardar el perfil', 500);
        }
      }

      return error('Método no permitido', 405);
    }

    if (url.pathname === '/api/sync') {
      if (request.method !== 'GET') {
        return error('Método no permitido', 405);
      }

      try {
        const profile = await readProfile(env);

        if (!profile) {
          return error('Todavía no hay un perfil publicado', 404);
        }

        return new Response(
          JSON.stringify(buildSyncPayload(profile, profile.revision)),
          {
            headers: {
              ...JSON_HEADERS,
              'cache-control': 'no-store',
            },
          },
        );
      } catch (cause) {
        console.error('No se pudo servir el perfil', cause);
        return error('No se pudo servir el perfil', 500);
      }
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
