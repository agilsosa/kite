import {
  AlertTriangle,
  CircleCheck,
  LoaderCircle,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchProfile, saveProfile } from './api';
import { AppsSection } from './components/AppsSection';
import { FeaturesSection } from './components/FeaturesSection';
import { KiteMark } from './components/KiteMark';
import { ProfileSection } from './components/ProfileSection';
import { PublishPanel } from './components/PublishPanel';
import { Button } from './components/ui';
import { WebsitesSection } from './components/WebsitesSection';
import { buildPreview, editorFromDocument, editorToDraft } from './editor';
import type { EditorState } from './editor';
import { validateProfileDraft } from '../shared/profile';
import type { ProfileDocument } from '../shared/profile';

function describeError(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export default function App() {
  const [saved, setSaved] = useState<ProfileDocument | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchProfile()
      .then(({ profile }) => {
        if (!cancelled) {
          setSaved(profile);
          setEditor(editorFromDocument(profile));
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLoadError(
            describeError(cause, 'No se pudo cargar el perfil publicado.'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const baseline = useMemo(() => editorFromDocument(saved), [saved]);

  const dirty = useMemo(
    () =>
      editor !== null && JSON.stringify(editor) !== JSON.stringify(baseline),
    [editor, baseline],
  );

  const preview = useMemo(
    () =>
      editor ? buildPreview(editor, saved?.revision ?? 'pendiente') : null,
    [editor, saved?.revision],
  );

  const syncUrl = useMemo(
    () => new URL('/api/sync', window.location.origin).toString(),
    [],
  );

  const updateEditor = (patch: Partial<EditorState>) => {
    setEditor((current) => (current ? { ...current, ...patch } : current));
    setSaveError(null);
    setNotice(null);
  };

  const handleSave = async () => {
    if (!editor || saving) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setNotice(null);

    try {
      const profile = await saveProfile(
        validateProfileDraft(editorToDraft(editor)),
      );

      setSaved(profile);
      setEditor(editorFromDocument(profile));
      setNotice(
        'Perfil publicado. Los dispositivos lo aplicarán en la próxima sincronización.',
      );
    } catch (cause) {
      setSaveError(describeError(cause, 'No se pudo guardar el perfil.'));
    } finally {
      setSaving(false);
    }
  };

  const status = loading
    ? {
        label: 'Cargando…',
        className: 'bg-sky',
        icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" />,
      }
    : saving
      ? {
          label: 'Guardando…',
          className: 'bg-marigold',
          icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" />,
        }
      : loadError || saveError
        ? {
            label: 'Error',
            className: 'bg-coral text-white',
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
          }
        : dirty
          ? {
              label: 'Cambios sin guardar',
              className: 'bg-marigold',
              icon: <AlertTriangle className="h-3.5 w-3.5" />,
            }
          : saved
            ? {
                label: 'Perfil publicado',
                className: 'bg-leaf text-paper',
                icon: <CircleCheck className="h-3.5 w-3.5" />,
              }
            : {
                label: 'Sin publicar',
                className: 'bg-sky',
                icon: <AlertTriangle className="h-3.5 w-3.5" />,
              };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b-4 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <KiteMark className="h-12 w-12 shrink-0" />
            <div className="min-w-0">
              <p className="text-[0.65rem] font-black tracking-[0.28em] text-ink-soft uppercase">
                Kite Admin
              </p>
              <h1 className="truncate text-2xl leading-none font-black tracking-tight sm:text-3xl">
                Perfil del dispositivo
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 text-xs font-black ${status.className}`}
            >
              {status.icon}
              {status.label}
            </span>
            <Button disabled={!dirty || saving || loading} onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saving ? 'Guardando…' : 'Guardar y publicar'}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {loading ? (
          <div className="grid min-h-[50vh] place-items-center">
            <div className="flex items-center gap-3 rounded-[2rem] border-4 border-ink bg-paper px-6 py-5 shadow-kite">
              <LoaderCircle className="h-6 w-6 animate-spin" />
              <p className="text-lg font-black">Cargando el perfil…</p>
            </div>
          </div>
        ) : loadError ? (
          <div className="mx-auto max-w-xl rounded-[2rem] border-4 border-ink bg-paper p-6 shadow-kite">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-coral" />
              <div>
                <h2 className="text-2xl font-black">No se pudo cargar</h2>
                <p className="mt-2 font-semibold text-ink-soft">{loadError}</p>
              </div>
            </div>
            <Button
              className="mt-5"
              onClick={() => window.location.reload()}
              variant="secondary"
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </div>
        ) : editor ? (
          <>
            {saveError ? (
              <div
                className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-ink bg-coral p-4 text-white shadow-kite-sm"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="font-bold">
                  No se pudo guardar el perfil: {saveError}
                </p>
              </div>
            ) : null}

            {notice ? (
              <div
                className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-ink bg-leaf p-4 text-paper shadow-kite-sm"
                role="status"
              >
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="font-bold">{notice}</p>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
              <div className="flex min-w-0 flex-col gap-6">
                <ProfileSection
                  childName={editor.childName}
                  onChange={updateEditor}
                  revision={saved?.revision ?? null}
                  updatedAt={saved?.updatedAt ?? null}
                  volumeCap={editor.volumeCap}
                />

                <WebsitesSection
                  onChange={(allowedOrigins) =>
                    updateEditor({ allowedOrigins })
                  }
                  origins={editor.allowedOrigins}
                />

                <AppsSection
                  apps={editor.allowedApps}
                  onChange={(allowedApps) => updateEditor({ allowedApps })}
                />

                <FeaturesSection
                  onChange={(featuresText) => updateEditor({ featuresText })}
                  text={editor.featuresText}
                />
              </div>

              <aside className="flex flex-col gap-6 lg:sticky lg:top-28">
                <PublishPanel
                  dirty={dirty}
                  onSave={handleSave}
                  preview={preview}
                  saved={saved}
                  saving={saving}
                  syncUrl={syncUrl}
                />
              </aside>
            </div>
          </>
        ) : null}
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
        <p className="rounded-2xl border-2 border-dashed border-ink/20 bg-white/40 p-4 text-xs font-semibold text-ink-soft">
          Este panel todavía no tiene autenticación. Cualquiera con acceso a la
          URL puede cambiar el perfil, así que no lo publiques en Internet hasta
          añadirla.
        </p>
      </footer>
    </div>
  );
}
