import { app } from 'electron';
import { open, readdir, readFile, realpath, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import type {
  FileEntry,
  FileListing,
  FilePreview,
  FileRoot,
  FileRootId,
} from '../shared/types';

/**
 * Read-only browsing for the two folders children may look inside. The
 * renderer never passes a filesystem path: it sends a root id and a list of
 * path segments, and every resolved path is checked against the real location
 * of the root. Symlinks that point outside the root are ignored.
 */
const ROOTS = {
  documents: { label: 'Documentos', folder: 'Documents' },
  downloads: { label: 'Descargas', folder: 'Downloads' },
} satisfies Record<FileRootId, { label: string; folder: string }>;

const ROOT_IDS = Object.keys(ROOTS) as FileRootId[];

const MAX_SEGMENTS = 24;
const MAX_ENTRIES = 500;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_BYTES = 256 * 1024;

// Raster formats only: SVG is deliberately excluded because it can reference
// external content.
const IMAGE_MIME = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.bmp', 'image/bmp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon'],
]);

const TEXT_EXTENSIONS = new Set([
  '',
  '.txt',
  '.text',
  '.md',
  '.markdown',
  '.mdx',
  '.log',
  '.csv',
  '.tsv',
  '.json',
  '.jsonc',
  '.json5',
  '.xml',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.less',
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.yml',
  '.yaml',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.properties',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.bat',
  '.py',
  '.rb',
  '.pl',
  '.php',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.kts',
  '.swift',
  '.c',
  '.h',
  '.cc',
  '.cpp',
  '.cxx',
  '.hpp',
  '.cs',
  '.sql',
  '.graphql',
  '.gql',
  '.srt',
  '.vtt',
  '.tex',
]);

/** Our own user-facing failures, as opposed to filesystem errors. */
class FileError extends Error {}

function fail(message: string): never {
  throw new FileError(message);
}

/** Never forward raw filesystem errors: they contain absolute paths. */
function mapFailure(cause: unknown): Error {
  if (cause instanceof FileError) {
    return cause;
  }

  const code =
    typeof cause === 'object' && cause !== null && 'code' in cause
      ? String((cause as { code: unknown }).code)
      : '';

  if (code === 'ENOENT') {
    return new Error('Ese archivo o carpeta ya no está ahí.');
  }

  if (code === 'EACCES' || code === 'EPERM') {
    return new Error('Kite no tiene permiso para abrir eso.');
  }

  return new Error('No se pudo abrir ese archivo o carpeta.');
}

function isInsideRoot(rootReal: string, targetReal: string): boolean {
  const relative = path.relative(rootReal, targetReal);

  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

/**
 * Electron reports `$HOME` for Documents/Downloads when the XDG user-dirs
 * file cannot be found (for example when XDG_CONFIG_HOME points at a custom
 * directory). Never use the home directory as a root: fall back to the XDG
 * entry or the conventional folder inside the home directory.
 */
async function readLinuxUserDir(folder: FileRootId): Promise<string | null> {
  const home = app.getPath('home');
  const configHome =
    process.env['XDG_CONFIG_HOME'] ?? path.join(home, '.config');
  const key = folder === 'documents' ? 'XDG_DOCUMENTS_DIR' : 'XDG_DOWNLOAD_DIR';

  try {
    const contents = await readFile(
      path.join(configHome, 'user-dirs.dirs'),
      'utf8',
    );
    const line = contents
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${key}=`));

    if (!line) {
      return null;
    }

    const value = line
      .slice(line.indexOf('=') + 1)
      .trim()
      .replace(/^"/u, '')
      .replace(/"$/u, '');

    if (value === '$HOME') {
      return home;
    }

    if (value.startsWith('$HOME/')) {
      return path.join(home, value.slice('$HOME/'.length));
    }

    return path.isAbsolute(value) ? value : null;
  } catch {
    return null;
  }
}

async function resolveRootPath(folder: FileRootId): Promise<string> {
  const home = path.resolve(app.getPath('home'));
  const configured = path.resolve(app.getPath(folder));

  if (configured !== home) {
    return configured;
  }

  if (process.platform === 'linux') {
    const xdg = await readLinuxUserDir(folder);

    if (xdg !== null && path.resolve(xdg) !== home) {
      return path.resolve(xdg);
    }
  }

  return path.join(home, ROOTS[folder].folder);
}

function parseRoot(value: unknown): FileRootId {
  if (value === 'documents' || value === 'downloads') {
    return value;
  }

  fail('Carpeta desconocida.');
}

function parseSegments(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_SEGMENTS) {
    fail('Esa ruta de carpeta no es válida.');
  }

  const segments: string[] = [];

  for (const segment of value) {
    if (
      typeof segment !== 'string' ||
      segment.length === 0 ||
      segment.length > 255 ||
      // Hidden entries are not listed, so they are not reachable either.
      segment.startsWith('.') ||
      segment.includes('/') ||
      segment.includes('\\') ||
      segment.includes('\0')
    ) {
      fail('Esa ruta de carpeta no es válida.');
    }

    segments.push(segment);
  }

  return segments;
}

async function resolveInsideRoot(
  rootId: FileRootId,
  segments: string[],
): Promise<{ rootReal: string; targetReal: string }> {
  const rootReal = await realpath(await resolveRootPath(rootId));
  const target =
    segments.length === 0 ? rootReal : path.join(rootReal, ...segments);
  const targetReal = await realpath(target);

  if (!isInsideRoot(rootReal, targetReal)) {
    fail('Ese archivo está fuera de las carpetas que Kite puede abrir.');
  }

  return { rootReal, targetReal };
}

function previewKind(name: string): FileEntry['preview'] {
  const extension = path.extname(name).toLowerCase();

  if (IMAGE_MIME.has(extension)) {
    return 'image';
  }

  return TEXT_EXTENSIONS.has(extension) ? 'text' : 'none';
}

async function readEntry(
  rootReal: string,
  directory: string,
  dirent: Dirent,
): Promise<FileEntry | null> {
  const entryPath = path.join(directory, dirent.name);

  try {
    if (dirent.isSymbolicLink()) {
      const linkReal = await realpath(entryPath);

      if (!isInsideRoot(rootReal, linkReal)) {
        return null;
      }
    }

    const info = await stat(entryPath);

    if (info.isDirectory()) {
      return {
        name: dirent.name,
        kind: 'folder',
        size: 0,
        modified: info.mtimeMs,
        preview: 'none',
      };
    }

    if (info.isFile()) {
      return {
        name: dirent.name,
        kind: 'file',
        size: info.size,
        modified: info.mtimeMs,
        preview: previewKind(dirent.name),
      };
    }

    return null;
  } catch {
    // Entries can vanish or be unreadable between readdir and stat.
    return null;
  }
}

export async function getFileRoots(): Promise<FileRoot[]> {
  return Promise.all(
    ROOT_IDS.map(async (id) => {
      const definition = ROOTS[id];

      try {
        const info = await stat(await resolveRootPath(id));

        return { id, label: definition.label, available: info.isDirectory() };
      } catch {
        return { id, label: definition.label, available: false };
      }
    }),
  );
}

export async function listFileFolder(
  rootId: unknown,
  rawSegments: unknown,
): Promise<FileListing> {
  try {
    const id = parseRoot(rootId);
    const segments = parseSegments(rawSegments);
    const { rootReal, targetReal } = await resolveInsideRoot(id, segments);
    const info = await stat(targetReal);

    if (!info.isDirectory()) {
      fail('Eso no es una carpeta.');
    }

    const dirents = (await readdir(targetReal, { withFileTypes: true })).filter(
      (dirent) => !dirent.name.startsWith('.'),
    );
    const visible = dirents
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      )
      .slice(0, MAX_ENTRIES);
    const entries = (
      await Promise.all(
        visible.map((dirent) => readEntry(rootReal, targetReal, dirent)),
      )
    ).filter((entry): entry is FileEntry => entry !== null);

    entries.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'folder' ? -1 : 1;
      }

      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    return {
      root: id,
      label: ROOTS[id].label,
      path: segments,
      entries,
      truncated: visible.length < dirents.length,
    };
  } catch (cause) {
    throw mapFailure(cause);
  }
}

export async function readFilePreview(
  rootId: unknown,
  rawSegments: unknown,
): Promise<FilePreview> {
  try {
    const id = parseRoot(rootId);
    const segments = parseSegments(rawSegments);

    if (segments.length === 0) {
      fail('Elige un archivo para previsualizar.');
    }

    const { targetReal } = await resolveInsideRoot(id, segments);
    const info = await stat(targetReal);

    if (!info.isFile()) {
      fail('Eso no es un archivo.');
    }

    const extension = path.extname(targetReal).toLowerCase();
    const imageMime = IMAGE_MIME.get(extension);

    if (imageMime) {
      if (info.size > MAX_IMAGE_BYTES) {
        return { kind: 'none', reason: 'too-large' };
      }

      const data = await readFile(targetReal);

      return {
        kind: 'image',
        mime: imageMime,
        dataUrl: `data:${imageMime};base64,${data.toString('base64')}`,
        size: info.size,
      };
    }

    if (!TEXT_EXTENSIONS.has(extension)) {
      return { kind: 'none', reason: 'unsupported' };
    }

    const handle = await open(targetReal, 'r');

    try {
      const length = Math.min(info.size, MAX_TEXT_BYTES);
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, 0);
      const content = buffer.subarray(0, bytesRead);

      if (content.includes(0)) {
        return { kind: 'none', reason: 'unsupported' };
      }

      return {
        kind: 'text',
        text: content.toString('utf8').replace(/^\uFEFF/u, ''),
        size: info.size,
        truncated: info.size > bytesRead,
      };
    } finally {
      await handle.close();
    }
  } catch (cause) {
    throw mapFailure(cause);
  }
}
