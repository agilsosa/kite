import { app, net } from 'electron';
import type { AllowedApp, JsonValue, SyncResult } from '../shared/types';
import {
  applyRemoteState,
  assertText,
  normalizeApp,
  normalizeOrigin,
  setSyncEndpoint,
} from './config';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_FEATURES_BYTES = 64 * 1024;
const MAX_APPS = 30;
const MAX_ORIGINS = 50;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]'
  );
}

/**
 * Accept only HTTPS endpoints. Unpackaged development builds may use loopback
 * HTTP so a local test server works without a certificate.
 */
export function normalizeSyncEndpoint(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('La dirección de la API debe ser texto');
  }

  const raw = value.trim();

  if (raw.length === 0) {
    return null;
  }

  if (raw.length > 2048) {
    throw new Error('La dirección de la API es demasiado larga');
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error('La dirección de la API no es válida');
  }

  if (!url.hostname) {
    throw new Error('La dirección de la API no incluye un servidor');
  }

  if (url.username || url.password) {
    throw new Error('La dirección de la API no debe incluir credenciales');
  }

  const loopbackHttp =
    !app.isPackaged && url.protocol === 'http:' && isLoopbackHost(url.hostname);

  if (url.protocol !== 'https:' && !loopbackHttp) {
    throw new Error('La dirección de la API debe usar HTTPS');
  }

  url.hash = '';

  return url.toString();
}

function assertJsonValue(value: unknown, depth: number): void {
  if (depth > 4) {
    throw new Error('El campo features está anidado demasiado profundamente');
  }

  if (value === null || typeof value === 'boolean') {
    return;
  }

  if (typeof value === 'string') {
    if (value.length > 2000) {
      throw new Error('El campo features contiene un texto demasiado largo');
    }

    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('El campo features contiene un número no válido');
    }

    return;
  }

  if (Array.isArray(value)) {
    if (value.length > 50) {
      throw new Error('El campo features contiene una lista demasiado larga');
    }

    for (const entry of value) {
      assertJsonValue(entry, depth + 1);
    }

    return;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);

    if (keys.length > 50) {
      throw new Error('El campo features contiene demasiadas claves');
    }

    for (const key of keys) {
      if (key.length > 100 || FORBIDDEN_KEYS.has(key)) {
        throw new Error(
          `El campo features contiene una clave no válida: ${key}`,
        );
      }

      assertJsonValue(record[key], depth + 1);
    }

    return;
  }

  throw new Error('El campo features contiene un valor no válido');
}

interface ParsedRemoteState {
  childName: string;
  volumeCap: number;
  allowedOrigins: string[];
  allowedApps: AllowedApp[];
  revision: string | null;
  features: Record<string, JsonValue> | null;
  parentPin: string | null;
}

function parseRemoteState(raw: unknown): ParsedRemoteState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('La API debe devolver un objeto JSON');
  }

  const candidate = raw as Record<string, unknown>;

  if (candidate.schemaVersion !== 1) {
    throw new Error(
      'La versión del formato de sincronización no es compatible. Se esperaba schemaVersion 1.',
    );
  }

  const childName = assertText(candidate.childName, 'El nombre del niño', 40);

  let parentPin: string | null = null;

  if (candidate.parentPin !== undefined) {
    parentPin = assertText(candidate.parentPin, 'El PIN de adultos', 8);

    if (!/^\d{4,8}$/.test(parentPin)) {
      throw new Error('El PIN de adultos debe tener de 4 a 8 dígitos');
    }
  }

  if (
    !Number.isInteger(candidate.volumeCap) ||
    (candidate.volumeCap as number) < 0 ||
    (candidate.volumeCap as number) > 100
  ) {
    throw new Error('El volumen máximo debe ser un entero de 0 a 100');
  }

  if (!Array.isArray(candidate.allowedOrigins)) {
    throw new Error('El campo allowedOrigins debe ser una lista');
  }

  if (candidate.allowedOrigins.length > MAX_ORIGINS) {
    throw new Error(`No se permiten más de ${MAX_ORIGINS} sitios web`);
  }

  const allowedOrigins = candidate.allowedOrigins.map((origin, index) => {
    try {
      return normalizeOrigin(origin);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'valor no válido';

      throw new Error(
        `El sitio web en la posición ${index + 1} no es válido: ${detail}`,
      );
    }
  });

  if (!Array.isArray(candidate.allowedApps)) {
    throw new Error('El campo allowedApps debe ser una lista');
  }

  if (candidate.allowedApps.length > MAX_APPS) {
    throw new Error(`No se permiten más de ${MAX_APPS} aplicaciones`);
  }

  const allowedApps = candidate.allowedApps.map((entry, index) => {
    try {
      if (typeof entry === 'object' && entry !== null && 'id' in entry) {
        const id = (entry as { id?: unknown }).id;

        if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
          throw new Error('El id debe usar solo letras, números, _ o -');
        }
      }

      return normalizeApp(entry);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'valor no válido';

      throw new Error(
        `La aplicación en la posición ${index + 1} no es válida: ${detail}`,
      );
    }
  });

  const seenIds = new Set<string>();

  for (const entry of allowedApps) {
    if (seenIds.has(entry.id)) {
      throw new Error(
        `La aplicación "${entry.name}" usa un id repetido (${entry.id})`,
      );
    }

    seenIds.add(entry.id);
  }

  let revision: string | null = null;

  if (candidate.revision !== undefined && candidate.revision !== null) {
    if (
      typeof candidate.revision !== 'string' &&
      typeof candidate.revision !== 'number'
    ) {
      throw new Error('El campo revision debe ser texto o un número');
    }

    revision = String(candidate.revision).trim();

    if (revision.length === 0 || revision.length > 100) {
      throw new Error('El campo revision debe tener entre 1 y 100 caracteres');
    }
  }

  let features: Record<string, JsonValue> | null = null;

  if (candidate.features !== undefined && candidate.features !== null) {
    if (
      typeof candidate.features !== 'object' ||
      Array.isArray(candidate.features)
    ) {
      throw new Error('El campo features debe ser un objeto');
    }

    assertJsonValue(candidate.features, 0);

    if (JSON.stringify(candidate.features).length > MAX_FEATURES_BYTES) {
      throw new Error('El campo features es demasiado grande');
    }

    features = candidate.features as Record<string, JsonValue>;
  }

  return {
    childName,
    volumeCap: candidate.volumeCap as number,
    allowedOrigins: [...new Set(allowedOrigins)],
    allowedApps,
    revision,
    features,
    parentPin,
  };
}

async function readLimitedText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));

  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error('La respuesta de la API es demasiado grande');
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      total += value.byteLength;

      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('La respuesta de la API es demasiado grande');
      }

      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The stream may already be cancelled or errored.
    }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
}

/**
 * Fetch the complete child configuration from the parent-configured endpoint
 * and replace the managed values atomically. A failed fetch or invalid payload
 * leaves the current configuration untouched.
 */
export async function syncFromEndpoint(
  rawEndpoint: unknown,
): Promise<SyncResult> {
  const endpoint = normalizeSyncEndpoint(rawEndpoint);

  if (!endpoint) {
    throw new Error('Introduce la dirección de la API');
  }

  // Keep the address even if the request fails so the parent can retry.
  setSyncEndpoint(endpoint);

  let response: Response;

  try {
    response = await net.fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'error de red';

    if (
      cause instanceof Error &&
      (cause.name === 'TimeoutError' || /timed? out/i.test(detail))
    ) {
      throw new Error('La API tardó demasiado en responder');
    }

    throw new Error(`No se pudo conectar con la API: ${detail}`);
  }

  // Redirects are followed automatically, so validate the final URL too.
  if (response.url) {
    normalizeSyncEndpoint(response.url);
  }

  if (!response.ok) {
    throw new Error(`La API respondió con HTTP ${response.status}`);
  }

  const text = await readLimitedText(response);
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('La API no devolvió JSON válido');
  }

  const state = parseRemoteState(raw);

  return applyRemoteState({ endpoint, ...state });
}
