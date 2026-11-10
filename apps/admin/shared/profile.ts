/**
 * Profile contract shared by the admin UI and the Worker API.
 *
 * These rules mirror the validation Kite applies to a remote configuration
 * response, with one admin-only requirement: every app must provide both a
 * Linux and a Windows executable path so one profile can serve every kiosk.
 */

export const SCHEMA_VERSION = 1;

export const MAX_CHILD_NAME = 40;
export const MAX_ORIGINS = 50;
export const MAX_ORIGIN_LENGTH = 300;
export const MAX_APPS = 30;
export const MAX_ARGS = 10;
export const MAX_ARG_LENGTH = 200;
export const MAX_PATH_LENGTH = 1000;
export const MAX_FEATURES_BYTES = 64 * 1024;
export const MAX_FEATURES_DEPTH = 4;
export const MAX_FEATURES_KEYS = 50;

export const APP_ICON_KEYS = [
  'puzzle',
  'gamepad',
  'book',
  'palette',
  'music',
  'film',
  'camera',
  'flask',
  'globe',
  'rocket',
  'cat',
  'bot',
  'trophy',
  'wrench',
  'star',
  'shapes',
  'sparkles',
  'compass',
  'folder',
] as const;

export type AppIconKey = (typeof APP_ICON_KEYS)[number];

export const DEFAULT_APP_ICON: AppIconKey = 'puzzle';

const APP_ICON_KEY_SET = new Set<string>(APP_ICON_KEYS);

/** Spanish labels used by the icon picker and screen readers. */
export const APP_ICON_LABELS: Record<AppIconKey, string> = {
  puzzle: 'Rompecabezas',
  gamepad: 'Videojuego',
  book: 'Libro',
  palette: 'Dibujo',
  music: 'Música',
  film: 'Película',
  camera: 'Cámara',
  flask: 'Ciencia',
  globe: 'Navegador',
  rocket: 'Cohete',
  cat: 'Animal',
  bot: 'Robot',
  trophy: 'Deporte',
  wrench: 'Herramientas',
  star: 'Estrella',
  shapes: 'Formas',
  sparkles: 'Magia',
  compass: 'Explorar',
  folder: 'Archivos',
};

export function normalizeAppIcon(value: unknown): AppIconKey {
  return typeof value === 'string' && APP_ICON_KEY_SET.has(value)
    ? (value as AppIconKey)
    : DEFAULT_APP_ICON;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ProfileFeatures = { [key: string]: JsonValue };

export interface ProfileAppPaths {
  linux: string;
  windows: string;
  macos?: string;
}

export interface ProfileApp {
  id: string;
  name: string;
  icon: AppIconKey;
  paths: ProfileAppPaths;
  args: string[];
}

export interface ProfileDraft {
  childName: string;
  volumeCap: number;
  allowedOrigins: string[];
  allowedApps: ProfileApp[];
  features: ProfileFeatures | null;
}

export interface ProfileDocument extends ProfileDraft {
  schemaVersion: typeof SCHEMA_VERSION;
  revision: string;
  updatedAt: string;
}

export interface SyncPayload {
  schemaVersion: typeof SCHEMA_VERSION;
  revision: string;
  childName: string;
  volumeCap: number;
  allowedOrigins: string[];
  allowedApps: ProfileApp[];
  features?: ProfileFeatures;
}

export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileError';
  }
}

const APP_PLATFORMS = ['linux', 'windows', 'macos'] as const;
type AppPlatform = (typeof APP_PLATFORMS)[number];

const WINDOWS_PATH = /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/;
const APP_ID = /^[a-zA-Z0-9_-]{1,64}$/;

function createAppId(): string {
  const cryptoObject = (
    globalThis as {
      crypto?: { randomUUID?: () => string };
    }
  ).crypto;

  if (cryptoObject?.randomUUID) {
    return cryptoObject.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function fail(message: string): never {
  throw new ProfileError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown, message: string, maxLength: number): string {
  if (typeof value !== 'string') {
    fail(message);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > maxLength) {
    fail(message);
  }

  return trimmed;
}

function readOrigins(value: unknown): string[] {
  if (!Array.isArray(value)) {
    fail('Los sitios web permitidos deben ser una lista');
  }

  if (value.length > MAX_ORIGINS) {
    fail(`No se pueden enviar más de ${MAX_ORIGINS} sitios web`);
  }

  const origins = value.map((entry, index) => {
    const position = index + 1;
    const raw = readText(
      entry,
      `El sitio web en la posición ${position} no es válido: debe tener entre 1 y ${MAX_ORIGIN_LENGTH} caracteres`,
      MAX_ORIGIN_LENGTH,
    );

    let url: URL;

    try {
      url = new URL(raw);
    } catch {
      return fail(`El sitio web en la posición ${position} no es válido`);
    }

    if (url.protocol !== 'https:') {
      fail(
        `El sitio web en la posición ${position} no es válido: Los sitios web deben usar HTTPS`,
      );
    }

    return url.origin;
  });

  return [...new Set(origins)];
}

function readPath(
  value: unknown,
  name: string,
  label: string,
  platform: AppPlatform,
): string {
  if (value === undefined) {
    fail(`La aplicación "${name}" no tiene una ruta para ${label}`);
  }

  if (typeof value !== 'string') {
    fail(`La ruta de "${name}" para ${label} debe ser texto`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_PATH_LENGTH) {
    fail(
      `La ruta de "${name}" para ${label} debe tener entre 1 y ${MAX_PATH_LENGTH} caracteres`,
    );
  }

  if (platform === 'windows') {
    if (!WINDOWS_PATH.test(trimmed)) {
      fail(
        `La ruta de "${name}" para Windows debe ser una ruta completa, como C:\\Program Files\\App\\app.exe`,
      );
    }
  } else if (!trimmed.startsWith('/')) {
    fail(`La ruta de "${name}" para ${label} debe ser absoluta`);
  }

  return trimmed;
}

function readAppPaths(value: unknown, name: string): ProfileAppPaths {
  if (!isRecord(value)) {
    fail(`Las rutas de "${name}" deben ser un objeto`);
  }

  for (const key of Object.keys(value)) {
    if (!APP_PLATFORMS.includes(key as AppPlatform)) {
      fail(`Las rutas de "${name}" incluyen una plataforma no válida: ${key}`);
    }
  }

  const linux = readPath(value.linux, name, 'Linux', 'linux');
  const windows = readPath(value.windows, name, 'Windows', 'windows');
  const macos =
    value.macos === undefined || value.macos === ''
      ? undefined
      : readPath(value.macos, name, 'macOS', 'macos');

  return { linux, windows, ...(macos ? { macos } : {}) };
}

function readArgs(value: unknown, name: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_ARGS) {
    fail(`Los argumentos de "${name}" no son válidos`);
  }

  return value
    .map((entry) => {
      if (typeof entry !== 'string' || entry.length > MAX_ARG_LENGTH) {
        fail(`Los argumentos de "${name}" no son válidos`);
      }

      return entry.trim();
    })
    .filter((entry) => entry.length > 0);
}

function readApps(value: unknown): ProfileApp[] {
  if (!Array.isArray(value)) {
    fail('Las aplicaciones permitidas deben ser una lista');
  }

  if (value.length > MAX_APPS) {
    fail(`No se pueden enviar más de ${MAX_APPS} aplicaciones`);
  }

  const ids = new Set<string>();

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      fail('Las aplicaciones deben ser objetos');
    }

    const name = readText(
      entry.name,
      `El nombre de la aplicación en la posición ${index + 1} debe tener entre 1 y 40 caracteres`,
      40,
    );

    let id: string;

    if (entry.id === undefined || entry.id === null || entry.id === '') {
      id = createAppId();
    } else if (typeof entry.id === 'string' && APP_ID.test(entry.id)) {
      id = entry.id;
    } else {
      fail(`El id de la aplicación "${name}" no es válido`);
    }

    if (ids.has(id)) {
      fail(`La aplicación "${name}" usa un id repetido (${id})`);
    }

    ids.add(id);

    return {
      id,
      name,
      icon: normalizeAppIcon(entry.icon),
      paths: readAppPaths(entry.paths, name),
      args: readArgs(entry.args, name),
    };
  });
}

function checkJsonValue(value: unknown, depth: number): void {
  if (depth > MAX_FEATURES_DEPTH) {
    fail(
      `Las funciones avanzadas superan la profundidad máxima de ${MAX_FEATURES_DEPTH} niveles`,
    );
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail('Las funciones avanzadas contienen un número no válido');
    }

    return;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_FEATURES_KEYS) {
      fail(
        `Las funciones avanzadas no pueden tener más de ${MAX_FEATURES_KEYS} elementos por lista`,
      );
    }

    for (const entry of value) {
      checkJsonValue(entry, depth + 1);
    }

    return;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);

    if (keys.length > MAX_FEATURES_KEYS) {
      fail(
        `Las funciones avanzadas no pueden tener más de ${MAX_FEATURES_KEYS} claves por objeto`,
      );
    }

    for (const key of keys) {
      checkJsonValue(value[key], depth + 1);
    }

    return;
  }

  fail('Las funciones avanzadas contienen un valor no válido');
}

function readFeatures(value: unknown): ProfileFeatures | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    fail('Las funciones avanzadas deben ser un objeto JSON');
  }

  checkJsonValue(value, 1);

  const size = new TextEncoder().encode(JSON.stringify(value)).length;

  if (size > MAX_FEATURES_BYTES) {
    fail(
      `Las funciones avanzadas superan el tamaño máximo de ${MAX_FEATURES_BYTES / 1024} KiB`,
    );
  }

  return value as ProfileFeatures;
}

/** Validate and normalize an editable profile before it is stored. */
export function validateProfileDraft(value: unknown): ProfileDraft {
  if (!isRecord(value)) {
    fail('El perfil no es válido');
  }

  const childName = readText(
    value.childName,
    `El nombre del niño debe tener entre 1 y ${MAX_CHILD_NAME} caracteres`,
    MAX_CHILD_NAME,
  );

  const volumeCap = value.volumeCap;

  if (
    typeof volumeCap !== 'number' ||
    !Number.isInteger(volumeCap) ||
    volumeCap < 0 ||
    volumeCap > 100
  ) {
    fail('El límite de volumen debe ser un entero de 0 a 100');
  }

  return {
    childName,
    volumeCap,
    allowedOrigins: readOrigins(value.allowedOrigins),
    allowedApps: readApps(value.allowedApps),
    features: readFeatures(value.features),
  };
}

/** Parse the JSON textarea used by the advanced features editor. */
export function parseFeaturesJson(text: string): ProfileFeatures | null {
  if (text.trim() === '') {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    fail('Las funciones avanzadas no son JSON válido');
  }

  return readFeatures(parsed);
}

/** Build the exact JSON body Kite's remote configuration endpoint returns. */
export function buildSyncPayload(
  draft: ProfileDraft,
  revision: string,
): SyncPayload {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision,
    childName: draft.childName,
    volumeCap: draft.volumeCap,
    allowedOrigins: draft.allowedOrigins,
    allowedApps: draft.allowedApps.map((app) => ({
      id: app.id,
      name: app.name,
      icon: app.icon,
      paths: {
        linux: app.paths.linux,
        windows: app.paths.windows,
        ...(app.paths.macos ? { macos: app.paths.macos } : {}),
      },
      args: app.args,
    })),
    ...(draft.features ? { features: draft.features } : {}),
  };
}

export function createEmptyProfileDraft(): ProfileDraft {
  return {
    childName: 'Amigo',
    volumeCap: 70,
    allowedOrigins: [],
    allowedApps: [],
    features: null,
  };
}

export function documentToDraft(document: ProfileDocument): ProfileDraft {
  return {
    childName: document.childName,
    volumeCap: document.volumeCap,
    allowedOrigins: [...document.allowedOrigins],
    allowedApps: document.allowedApps.map((app) => ({
      ...app,
      paths: { ...app.paths },
      args: [...app.args],
    })),
    features: document.features
      ? (structuredClone(document.features) as ProfileFeatures)
      : null,
  };
}
