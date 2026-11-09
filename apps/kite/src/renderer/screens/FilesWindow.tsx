import { Button as BaseButton } from '@base-ui/react/button';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Package,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FileEntry,
  FileListing,
  FilePreview,
  FileRoot,
  FileRootId,
} from '../../shared/types';
import { Button } from '../components/Button';
import { errorMessage } from '../lib/format';

const ROOT_ORDER: FileRootId[] = ['documents', 'downloads'];

const ROOT_META: Record<
  FileRootId,
  { label: string; icon: LucideIcon; hint: string }
> = {
  documents: {
    label: 'Documentos',
    icon: FolderOpen,
    hint: 'Notas e imágenes',
  },
  downloads: {
    label: 'Descargas',
    icon: Download,
    hint: 'Guardado de internet',
  },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function iconFor(entry: FileEntry): LucideIcon {
  if (entry.kind === 'folder') {
    return Folder;
  }

  if (entry.preview === 'image') {
    return ImageIcon;
  }

  return entry.preview === 'text' ? FileText : Package;
}

function PreviewBody({
  name,
  preview,
}: {
  name: string;
  preview: FilePreview;
}) {
  if (preview.kind === 'image') {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <img
          alt={`Vista previa de ${name}`}
          className="max-h-full max-w-full rounded-xl border-2 border-ink/10 object-contain"
          draggable={false}
          src={preview.dataUrl}
        />
      </div>
    );
  }

  if (preview.kind === 'text') {
    return (
      <>
        {preview.truncated ? (
          <p className="mb-3 rounded-xl border-2 border-marigold-deep/40 bg-marigold/30 px-3 py-2 text-xs font-bold text-ink-soft">
            Este archivo es largo, así que solo se muestra el principio.
          </p>
        ) : null}
        <pre className="font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">
          {preview.text || 'Este archivo está vacío.'}
        </pre>
      </>
    );
  }

  return (
    <p className="text-sm font-bold text-ink-soft">
      {preview.reason === 'too-large'
        ? 'Este archivo es demasiado grande para previsualizarlo.'
        : 'Kite no puede previsualizar este tipo de archivo.'}
    </p>
  );
}

export function FilesWindow() {
  const [roots, setRoots] = useState<FileRoot[] | null>(null);
  const [rootsError, setRootsError] = useState<string | null>(null);
  const [root, setRoot] = useState<FileRootId>('documents');
  const [segments, setSegments] = useState<string[]>([]);
  const [listing, setListing] = useState<FileListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const previewRequest = useRef(0);

  useEffect(() => {
    document.title = 'Archivos';
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void window.api.files.close();
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    let active = true;

    void window.api.files
      .roots()
      .then((next) => {
        if (active) {
          setRoots(next);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setRoots([]);
          setRootsError(errorMessage(cause));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const available =
    roots?.find((entry) => entry.id === root)?.available ?? null;

  useEffect(() => {
    if (roots === null) {
      return;
    }

    let active = true;

    previewRequest.current += 1;
    setSelected(null);
    setPreview(null);
    setPreviewError(null);
    setListing(null);

    if (roots.find((entry) => entry.id === root)?.available !== true) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    void window.api.files
      .list(root, segments)
      .then((next) => {
        if (active) {
          setListing(next);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(errorMessage(cause));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [roots, root, segments, reloadToken]);

  const openEntry = useCallback(
    (entry: FileEntry) => {
      if (entry.kind === 'folder') {
        setSegments((current) => [...current, entry.name]);
        return;
      }

      const request = previewRequest.current + 1;
      previewRequest.current = request;
      setSelected(entry);
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(true);

      void window.api.files
        .read(root, [...segments, entry.name])
        .then((next) => {
          if (previewRequest.current === request) {
            setPreview(next);
            setPreviewLoading(false);
          }
        })
        .catch((cause: unknown) => {
          if (previewRequest.current === request) {
            setPreviewError(errorMessage(cause));
            setPreviewLoading(false);
          }
        });
    },
    [root, segments],
  );

  const openRoot = useCallback(
    (next: FileRootId) => {
      setSegments([]);

      if (next !== root) {
        setRoot(next);
      }
    },
    [root],
  );

  const goBack = useCallback(() => {
    setSegments((current) => current.slice(0, -1));
  }, []);

  const goToDepth = useCallback((depth: number) => {
    setSegments((current) => current.slice(0, depth));
  }, []);

  const rootLabel = ROOT_META[root].label;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-paper text-ink">
      <header className="flex shrink-0 items-center gap-3 border-b-4 border-ink/10 px-5 py-3">
        <FolderOpen
          aria-hidden="true"
          className="h-8 w-8 text-coral"
          strokeWidth={2.1}
        />
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-black">Archivos</h1>
          <p className="text-xs font-bold text-ink-soft">
            Documentos y Descargas
          </p>
        </div>
        <BaseButton
          aria-label="Cerrar Archivos y volver al inicio"
          className="ml-auto inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 border-ink bg-paper px-4 py-2 text-sm font-extrabold shadow-kite-sm transition hover:bg-marigold/40 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          onClick={() => void window.api.files.close()}
          type="button"
        >
          <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
          Cerrar
        </BaseButton>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <nav
          aria-label="Carpetas"
          className="flex w-56 shrink-0 flex-col gap-2 rounded-[1.75rem] border-4 border-ink bg-paper p-2 shadow-kite-sm"
        >
          <p className="px-2 pt-1 text-[11px] font-black tracking-wider text-ink-soft uppercase">
            Carpetas
          </p>
          {ROOT_ORDER.map((id) => {
            const meta = ROOT_META[id];
            const RootIcon = meta.icon;
            const isActive = id === root;
            const isAvailable =
              roots?.find((entry) => entry.id === id)?.available ?? null;

            return (
              <BaseButton
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Mostrar ${meta.label}`}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border-2 px-2.5 py-2.5 text-left transition ${
                  isActive
                    ? 'border-ink bg-marigold/40'
                    : 'border-transparent hover:border-ink/20 hover:bg-white/70'
                }`}
                key={id}
                onClick={() => openRoot(id)}
                type="button"
              >
                <RootIcon
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0"
                  strokeWidth={2.2}
                />
                <span className="min-w-0">
                  <span className="block truncate text-base leading-tight font-black">
                    {meta.label}
                  </span>
                  <span className="block text-[11px] leading-snug font-bold text-ink-soft">
                    {isAvailable === false
                      ? 'No está en este equipo'
                      : meta.hint}
                  </span>
                </span>
              </BaseButton>
            );
          })}

          <p className="mt-auto px-2 pb-1 text-[11px] leading-snug font-bold text-ink-soft/80">
            Solo lectura. Aquí no se puede cambiar nada.
          </p>
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2">
            {segments.length > 0 ? (
              <BaseButton
                aria-label="Volver a la carpeta anterior"
                className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 border-ink bg-paper px-3 py-1.5 text-sm font-extrabold shadow-kite-sm transition hover:bg-marigold/40 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                onClick={goBack}
                type="button"
              >
                <ArrowLeft
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={2.4}
                />
                Atrás
              </BaseButton>
            ) : null}

            <nav
              aria-label="Ruta de carpetas"
              className="flex min-w-0 flex-wrap items-center gap-1 text-sm font-bold"
            >
              <BaseButton
                className="cursor-pointer rounded-lg px-2 py-1 hover:bg-white/70"
                onClick={() => goToDepth(0)}
                type="button"
              >
                {rootLabel}
              </BaseButton>
              {segments.map((segment, index) => (
                <span
                  className="flex min-w-0 items-center gap-1"
                  key={`${segment}-${index}`}
                >
                  <span aria-hidden="true" className="text-ink-soft/60">
                    /
                  </span>
                  <BaseButton
                    className="max-w-56 cursor-pointer truncate rounded-lg px-2 py-1 hover:bg-white/70"
                    onClick={() => goToDepth(index + 1)}
                    type="button"
                  >
                    {segment}
                  </BaseButton>
                </span>
              ))}
            </nav>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
            <section
              aria-label={`Archivos en ${rootLabel}`}
              className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border-4 border-ink bg-paper shadow-kite-sm"
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {rootsError ? (
                  <p className="p-4 text-sm font-bold text-coral" role="alert">
                    {rootsError}
                  </p>
                ) : available === false ? (
                  <div className="flex flex-col items-start gap-2 p-4">
                    <p className="text-lg font-black">
                      {rootLabel} no está en este equipo
                    </p>
                    <p className="text-sm font-bold text-ink-soft">
                      Pide a un adulto que compruebe que la carpeta existe. Aún
                      puedes mirar en la otra carpeta.
                    </p>
                  </div>
                ) : loading ? (
                  <p
                    className="p-4 text-sm font-bold text-ink-soft"
                    role="status"
                  >
                    Buscando en {rootLabel}…
                  </p>
                ) : error ? (
                  <div className="flex flex-col items-start gap-3 p-4">
                    <p className="text-sm font-bold text-coral" role="alert">
                      {error}
                    </p>
                    <Button
                      className="min-h-10 px-4 py-2 text-sm"
                      onClick={() => setReloadToken((token) => token + 1)}
                      variant="secondary"
                    >
                      Reintentar
                    </Button>
                  </div>
                ) : listing && listing.entries.length === 0 ? (
                  <p className="p-4 text-sm font-bold text-ink-soft">
                    Esta carpeta está vacía.
                  </p>
                ) : (
                  <ul className="flex list-none flex-col gap-1">
                    {listing?.entries.map((entry) => {
                      const EntryIcon = iconFor(entry);
                      const isSelected =
                        entry.kind === 'file' && selected?.name === entry.name;

                      return (
                        <li key={entry.name}>
                          <BaseButton
                            aria-current={isSelected ? 'true' : undefined}
                            aria-label={
                              entry.kind === 'folder'
                                ? `Abrir carpeta ${entry.name}`
                                : `Previsualizar ${entry.name}`
                            }
                            className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition ${
                              isSelected
                                ? 'border-ink bg-marigold/30'
                                : 'border-transparent hover:border-ink/20 hover:bg-white/70'
                            }`}
                            onClick={() => openEntry(entry)}
                            type="button"
                          >
                            <EntryIcon
                              aria-hidden="true"
                              className="h-6 w-6 shrink-0"
                              strokeWidth={2.1}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-base font-extrabold">
                                {entry.name}
                              </span>
                              <span className="block text-xs font-bold text-ink-soft">
                                {entry.kind === 'folder'
                                  ? 'Carpeta'
                                  : `${formatSize(entry.size)} · ${formatDate(entry.modified)}`}
                              </span>
                            </span>
                            {entry.kind === 'folder' ? (
                              <ChevronRight
                                aria-hidden="true"
                                className="h-5 w-5 shrink-0 text-ink-soft"
                                strokeWidth={2.4}
                              />
                            ) : null}
                          </BaseButton>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {listing?.truncated ? (
                <p className="shrink-0 border-t-2 border-ink/10 px-4 py-2 text-xs font-bold text-ink-soft">
                  Mostrando los primeros {listing.entries.length} elementos.
                </p>
              ) : null}
            </section>

            <aside
              aria-label="Vista previa"
              className="flex min-h-0 w-full flex-col overflow-hidden rounded-[1.75rem] border-4 border-ink bg-white/70 shadow-kite-sm md:w-[38%]"
            >
              {selected ? (
                <>
                  <header className="shrink-0 border-b-2 border-ink/10 px-4 py-3">
                    <p
                      className="truncate text-lg font-black"
                      title={selected.name}
                    >
                      {selected.name}
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-ink-soft">
                      {formatSize(selected.size)} ·{' '}
                      {formatDate(selected.modified)}
                    </p>
                  </header>
                  <div className="min-h-0 flex-1 overflow-auto p-4">
                    {previewLoading ? (
                      <p
                        className="text-sm font-bold text-ink-soft"
                        role="status"
                      >
                        Abriendo…
                      </p>
                    ) : previewError ? (
                      <p className="text-sm font-bold text-coral" role="alert">
                        {previewError}
                      </p>
                    ) : preview ? (
                      <PreviewBody name={selected.name} preview={preview} />
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center p-6 text-center">
                  <div>
                    <ImageIcon
                      aria-hidden="true"
                      className="mx-auto h-12 w-12 text-ink-soft/60"
                      strokeWidth={1.8}
                    />
                    <p className="mt-3 text-sm font-bold text-ink-soft">
                      Elige una imagen o una nota y aparecerá aquí.
                    </p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
