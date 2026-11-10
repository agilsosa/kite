import type { ProfileDocument, ProfileDraft } from '../shared/profile';

interface ProfileResponse {
  profile: ProfileDocument | null;
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }

  return fallback;
}

export async function fetchProfile(): Promise<ProfileResponse> {
  const response = await fetch('/api/profile', {
    headers: { accept: 'application/json' },
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      messageFromPayload(
        payload,
        `No se pudo cargar el perfil (HTTP ${response.status})`,
      ),
    );
  }

  return payload as ProfileResponse;
}

export async function saveProfile(
  draft: ProfileDraft,
): Promise<ProfileDocument> {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(draft),
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      messageFromPayload(
        payload,
        `No se pudo guardar el perfil (HTTP ${response.status})`,
      ),
    );
  }

  if (typeof payload === 'object' && payload !== null && 'profile' in payload) {
    return payload.profile as ProfileDocument;
  }

  throw new Error('El servidor no devolvió el perfil guardado');
}
