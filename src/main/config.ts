import { app } from 'electron';
import Store from 'electron-store';
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { hostname, userInfo } from 'node:os';
import path from 'node:path';
import { DEFAULT_APP_ICON, normalizeAppIcon } from '../shared/appIcons';
import type {
  AllowedApp,
  ConfigUpdate,
  JsonValue,
  KioskConfig,
  PublicConfig,
  SyncInfo,
  SyncResult,
} from '../shared/types';

const DEFAULT_CONFIG: KioskConfig = {
  childName: 'Amigo',
  allowedApps: [],
  sampleAppsVersion: 0,
  allowedOrigins: [],
  volumeCap: 70,
  parentPin: null,
  syncEndpoint: null,
  lastSyncedAt: null,
  syncRevision: null,
  remoteFeatures: null,
};

let store: Store<KioskConfig> | null = null;

function getEncryptionKey(): string {
  return createHash('sha256')
    .update(
      [
        app.getName(),
        app.getPath('userData'),
        hostname(),
        userInfo().username,
      ].join('|'),
    )
    .digest('hex');
}

const LEGACY_DEFAULT_ORIGINS = new Set([
  'https://pbskids.org',
  'https://kids.nationalgeographic.com',
  'https://www.starfall.com',
]);

const LEGACY_DEFAULT_APP_IDS = new Set(['firefox']);

export function getStore(): Store<KioskConfig> {
  store ??= new Store<KioskConfig>({
    name: 'kiosk-config',
    defaults: DEFAULT_CONFIG,
    encryptionKey: getEncryptionKey(),
  });

  if ((store.get('sampleAppsVersion') ?? 0) < 3) {
    // Older builds seeded sample websites and Firefox. Remove those seeds, but
    // leave anything a parent added afterwards untouched.
    store.set(
      'allowedOrigins',
      store
        .get('allowedOrigins')
        .filter((origin) => !LEGACY_DEFAULT_ORIGINS.has(origin)),
    );
    store.set(
      'allowedApps',
      store
        .get('allowedApps')
        .filter((app) => !LEGACY_DEFAULT_APP_IDS.has(app.id)),
    );
    store.set('sampleAppsVersion', 3);
  }

  // The Spanish UI replaced the old English default name.
  if (store.get('childName') === 'Friend') {
    store.set('childName', 'Amigo');
  }

  return store;
}

export function getConfig(): KioskConfig {
  return structuredClone(getStore().store);
}

export function getPublicConfig(): PublicConfig {
  const config = getConfig();

  return {
    childName: config.childName,
    allowedApps: config.allowedApps.map(({ id, name, icon }) => ({
      id,
      name,
      icon: normalizeAppIcon(icon),
    })),
    allowedOrigins: config.allowedOrigins,
    volumeCap: config.volumeCap,
    hasParentPin: config.parentPin !== null,
  };
}

export function getEditableApps(): AllowedApp[] {
  return getConfig().allowedApps.map((app) => ({
    ...app,
    icon: normalizeAppIcon(app.icon),
  }));
}

export function assertText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string') {
    throw new Error(`${field} debe ser texto`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new Error(`${field} debe tener entre 1 y ${maxLength} caracteres`);
  }

  return trimmed;
}

export function normalizeOrigin(value: unknown): string {
  const raw = assertText(value, 'La dirección del sitio web', 300);
  const url = new URL(raw);

  if (url.protocol !== 'https:') {
    throw new Error('Los sitios web deben usar HTTPS');
  }

  return url.origin;
}

export function normalizeApp(value: unknown): AllowedApp {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Las aplicaciones deben ser objetos');
  }

  const candidate = value as Partial<AllowedApp>;
  const name = assertText(candidate.name, 'El nombre de la aplicación', 40);
  const icon = assertText(
    candidate.icon ?? DEFAULT_APP_ICON,
    'El icono de la aplicación',
    32,
  );
  const rawPath = assertText(candidate.path, 'La ruta de la aplicación', 1000);

  if (!path.isAbsolute(rawPath)) {
    throw new Error(`La ruta de "${name}" debe ser absoluta`);
  }

  const args = candidate.args ?? [];

  if (
    !Array.isArray(args) ||
    args.length > 10 ||
    args.some((arg) => typeof arg !== 'string' || arg.length > 200)
  ) {
    throw new Error(`Los argumentos de "${name}" no son válidos`);
  }

  return {
    id:
      typeof candidate.id === 'string' &&
      /^[a-zA-Z0-9_-]{1,64}$/.test(candidate.id)
        ? candidate.id
        : randomUUID(),
    name,
    icon: normalizeAppIcon(icon),
    path: rawPath,
    ...(args.length > 0 ? { args: args.map((arg) => arg.trim()) } : {}),
  };
}

export function updateConfig(update: ConfigUpdate): PublicConfig {
  if (typeof update !== 'object' || update === null) {
    throw new Error('La actualización de la configuración no es válida');
  }

  const next: Partial<KioskConfig> = {};

  if (update.childName !== undefined) {
    next.childName = assertText(update.childName, 'El nombre del niño', 40);
  }

  if (update.volumeCap !== undefined) {
    if (
      !Number.isInteger(update.volumeCap) ||
      update.volumeCap < 0 ||
      update.volumeCap > 100
    ) {
      throw new Error('El límite de volumen debe ser un entero de 0 a 100');
    }

    next.volumeCap = update.volumeCap;
  }

  if (update.allowedApps !== undefined) {
    if (!Array.isArray(update.allowedApps)) {
      throw new Error('Las aplicaciones permitidas deben ser una lista');
    }

    next.allowedApps = update.allowedApps.map(normalizeApp).slice(0, 30);
  }

  if (update.allowedOrigins !== undefined) {
    if (!Array.isArray(update.allowedOrigins)) {
      throw new Error('Los sitios web permitidos deben ser una lista');
    }

    next.allowedOrigins = [
      ...new Set(update.allowedOrigins.map(normalizeOrigin)),
    ].slice(0, 50);
  }

  const target = getStore();
  target.store = { ...target.store, ...next };

  return getPublicConfig();
}

export interface RemoteState {
  endpoint: string;
  childName: string;
  volumeCap: number;
  allowedApps: AllowedApp[];
  allowedOrigins: string[];
  revision: string | null;
  features: Record<string, JsonValue> | null;
}

export function getSyncInfo(): SyncInfo {
  const config = getConfig();

  return {
    endpoint: config.syncEndpoint ?? null,
    lastSyncedAt: config.lastSyncedAt ?? null,
    revision: config.syncRevision ?? null,
  };
}

export function setSyncEndpoint(endpoint: string | null): SyncInfo {
  const target = getStore();
  target.set('syncEndpoint', endpoint);

  return getSyncInfo();
}

/**
 * Replace every parent-managed value with the state returned by the sync
 * endpoint. The parent PIN and internal migration markers are never touched.
 */
export function applyRemoteState(state: RemoteState): SyncResult {
  const target = getStore();

  target.store = {
    ...target.store,
    childName: state.childName,
    volumeCap: state.volumeCap,
    allowedApps: state.allowedApps,
    allowedOrigins: state.allowedOrigins,
    syncEndpoint: state.endpoint,
    lastSyncedAt: Date.now(),
    syncRevision: state.revision,
    remoteFeatures: state.features,
  };

  return {
    info: getSyncInfo(),
    config: getPublicConfig(),
    apps: getEditableApps(),
  };
}

export function hasParentPin(): boolean {
  return getStore().get('parentPin') !== null;
}

export function setParentPin(pin: string): void {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('El PIN debe tener de 4 a 8 dígitos');
  }

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 64).toString('hex');

  getStore().set('parentPin', { salt, hash });
}

export function verifyParentPin(pin: string): boolean {
  const record = getStore().get('parentPin');

  if (record === null || !/^\d{4,8}$/.test(pin)) {
    return false;
  }

  const candidate = scryptSync(pin, record.salt, 64);
  const expected = Buffer.from(record.hash, 'hex');

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
