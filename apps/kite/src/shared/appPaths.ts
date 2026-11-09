/**
 * Platform-specific executable paths for allow-listed apps.
 *
 * The remote configuration API can return one entry per operating system so a
 * single backend document works on both Linux and Windows kiosks. The client
 * resolves the entry for the OS it is running on; the legacy single `path`
 * field remains as a fallback.
 */
export type AppPlatform = 'linux' | 'windows' | 'macos';

export interface AppPlatformPaths {
  linux?: string;
  windows?: string;
  macos?: string;
}

export const APP_PLATFORM_LABELS: Record<AppPlatform, string> = {
  linux: 'Linux',
  windows: 'Windows',
  macos: 'macOS',
};

/** Maps a Node `process.platform` value to the configuration key. */
export function appPlatform(platform: string): AppPlatform | null {
  switch (platform) {
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    default:
      return null;
  }
}

export interface ResolvedAppPath {
  path: string;
  platform: AppPlatform | null;
}

/**
 * Picks the executable for the current OS. `paths` wins over the legacy
 * `path`, so a server can add per-OS entries without breaking older clients.
 */
export function pickAppPath(
  paths: AppPlatformPaths | null | undefined,
  legacyPath: string | undefined,
  platform: string,
): ResolvedAppPath | null {
  const key = appPlatform(platform);
  const platformPath = key ? paths?.[key]?.trim() : '';
  const trimmedLegacy = legacyPath?.trim() ?? '';

  if (platformPath) {
    return { path: platformPath, platform: key };
  }

  if (trimmedLegacy) {
    return { path: trimmedLegacy, platform: key };
  }

  return null;
}

/**
 * Mirrors `path.win32.isAbsolute`/`path.isAbsolute` without importing Node's
 * path module, so this helper also runs in renderer and test environments.
 */
export function isAbsoluteAppPath(value: string, platform: string): boolean {
  if (appPlatform(platform) === 'windows') {
    return (
      /^[A-Za-z]:[\\/]/.test(value) ||
      value.startsWith('\\\\') ||
      value.startsWith('\\') ||
      value.startsWith('/')
    );
  }

  return value.startsWith('/');
}
