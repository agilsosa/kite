/**
 * Icons a parent can pick for a native app. Config stores a stable key, not a
 * character, so the renderer can draw it with a real icon set.
 */
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

/** Spanish labels used by the parent icon picker and screen readers. */
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

/**
 * Older Kite versions stored an emoji in the icon field. Keep those configs
 * working by mapping the emoji to the closest Lucide key.
 */
const LEGACY_ICONS: Record<string, AppIconKey> = {
  '\u{1F98A}': 'globe',
  '\u{1F9E9}': 'puzzle',
  '\u{1F3A8}': 'palette',
  '\u{1F3AE}': 'gamepad',
  '\u{1F4DA}': 'book',
  '\u{1F4D6}': 'book',
  '\u{1F3B5}': 'music',
  '\u{1F3AC}': 'film',
  '\u{1F4F7}': 'camera',
  '\u{1F5BC}': 'camera',
  '\u{1F310}': 'globe',
  '\u{1F680}': 'rocket',
  '\u{1F431}': 'cat',
  '\u{1F916}': 'bot',
  '\u{1F3C6}': 'trophy',
  '\u{26BD}': 'trophy',
  '\u{1F6E0}': 'wrench',
  '\u{2B50}': 'star',
  '\u{1F31F}': 'star',
  '\u{1F537}': 'shapes',
  '\u{2728}': 'sparkles',
  '\u{1F9ED}': 'compass',
  '\u{1F4C1}': 'folder',
};

export function isAppIconKey(value: string): value is AppIconKey {
  return (APP_ICON_KEYS as readonly string[]).includes(value);
}

/** Coerce a stored icon (key or legacy emoji) into a supported key. */
export function normalizeAppIcon(value: string | undefined): AppIconKey {
  if (value === undefined) {
    return DEFAULT_APP_ICON;
  }

  const trimmed = value.trim();

  if (isAppIconKey(trimmed)) {
    return trimmed;
  }

  // Strip the optional emoji variation selector before the lookup.
  const plain = trimmed.replace(/\uFE0F/gu, '');

  return LEGACY_ICONS[trimmed] ?? LEGACY_ICONS[plain] ?? DEFAULT_APP_ICON;
}
