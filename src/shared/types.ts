export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * The JSON document returned by the parent-configured sync endpoint.
 *
 * `features` is reserved for future server-driven settings. This version stores
 * it but does not act on it, so newer payloads can add capabilities without
 * breaking older clients.
 */
export interface RemoteConfigPayload {
  schemaVersion: 1;
  revision?: string | number;
  childName: string;
  volumeCap: number;
  allowedOrigins: string[];
  allowedApps: RemoteApp[];
  features?: Record<string, JsonValue>;
  parentPin?: string;
}

export interface RemoteApp {
  id?: string;
  name: string;
  icon?: string;
  path: string;
  args?: string[];
}

export interface PublicApp {
  id: string;
  name: string;
  icon: string;
}

export interface AllowedApp extends PublicApp {
  path: string;
  args?: string[];
}

export interface PinRecord {
  salt: string;
  hash: string;
}

export interface KioskConfig {
  childName: string;
  allowedApps: AllowedApp[];
  sampleAppsVersion?: number;
  allowedOrigins: string[];
  volumeCap: number;
  parentPin: PinRecord | null;
  syncEndpoint: string | null;
  lastSyncedAt: number | null;
  syncRevision: string | null;
  remoteFeatures: Record<string, JsonValue> | null;
}

export interface PublicConfig {
  childName: string;
  allowedApps: PublicApp[];
  allowedOrigins: string[];
  volumeCap: number;
  hasParentPin: boolean;
}

export interface ConfigUpdate {
  childName?: string;
  allowedApps?: AllowedApp[];
  allowedOrigins?: string[];
  volumeCap?: number;
}

export interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
  connected: boolean;
}

export interface WifiStatus {
  connected: boolean;
  ssid: string | null;
}

export interface VolumeState {
  level: number;
  muted: boolean;
  cap: number;
}

export interface ParentStatus {
  hasPin: boolean;
  unlocked: boolean;
}

export type UpdatePhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string;
  availableVersion: string | null;
  checkedAt: number | null;
  error: string | null;
}

export interface SyncInfo {
  endpoint: string | null;
  lastSyncedAt: number | null;
  revision: string | null;
}

export interface SyncResult {
  info: SyncInfo;
  config: PublicConfig;
  apps: AllowedApp[];
  pinUpdated: boolean;
}

export type PowerAction = 'restart' | 'shutdown';

export type FileRootId = 'documents' | 'downloads';

export interface FileRoot {
  id: FileRootId;
  label: string;
  available: boolean;
}

export interface FileEntry {
  name: string;
  kind: 'file' | 'folder';
  size: number;
  modified: number;
  preview: 'image' | 'text' | 'none';
}

export interface FileListing {
  root: FileRootId;
  label: string;
  path: string[];
  entries: FileEntry[];
  truncated: boolean;
}

export type FilePreview =
  | { kind: 'image'; mime: string; dataUrl: string; size: number }
  | { kind: 'text'; text: string; size: number; truncated: boolean }
  | { kind: 'none'; reason: 'unsupported' | 'too-large' };

export interface TaskbarItem {
  id: string;
  kind: 'app' | 'website' | 'files';
  title: string;
  icon: string;
  active: boolean;
}

export interface KeyboardInput {
  key: string;
  kind: 'char' | 'key';
}

export interface KiteApi {
  config: {
    get: () => Promise<PublicConfig>;
    getEditableApps: () => Promise<AllowedApp[]>;
    update: (update: ConfigUpdate) => Promise<PublicConfig>;
  };
  apps: {
    launch: (appId: string) => Promise<void>;
  };
  web: {
    open: (url: string) => Promise<void>;
    closeAll: () => Promise<void>;
  };
  files: {
    roots: () => Promise<FileRoot[]>;
    list: (root: FileRootId, path: string[]) => Promise<FileListing>;
    read: (root: FileRootId, path: string[]) => Promise<FilePreview>;
    open: () => Promise<void>;
    close: () => Promise<void>;
  };
  wifi: {
    scan: () => Promise<WifiNetwork[]>;
    connect: (ssid: string, password: string) => Promise<void>;
    disconnect: () => Promise<void>;
    status: () => Promise<WifiStatus>;
  };
  volume: {
    get: () => Promise<VolumeState>;
    set: (level: number) => Promise<VolumeState>;
    mute: (muted: boolean) => Promise<VolumeState>;
  };
  keyboard: {
    send: (input: KeyboardInput) => Promise<void>;
  };
  parent: {
    status: () => Promise<ParentStatus>;
    setPin: (pin: string) => Promise<void>;
    unlock: (pin: string) => Promise<boolean>;
    lock: () => Promise<void>;
  };
  update: {
    status: () => Promise<UpdateState>;
    check: () => Promise<UpdateState>;
    install: () => Promise<void>;
  };
  sync: {
    status: () => Promise<SyncInfo>;
    apply: (endpoint: string) => Promise<SyncResult>;
  };
  system: {
    version: () => Promise<string>;
    home: () => Promise<void>;
    quit: () => Promise<void>;
    power: (action: PowerAction) => Promise<void>;
  };
  taskbar: {
    list: () => Promise<TaskbarItem[]>;
    activate: (id: string) => Promise<void>;
    home: () => Promise<void>;
  };
}
