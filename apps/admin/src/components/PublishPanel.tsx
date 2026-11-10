import {
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  FileJson,
  Save,
  UploadCloud,
} from 'lucide-react';
import { useState } from 'react';
import type { ProfileDocument, SyncPayload } from '../../shared/profile';
import { formatTimestamp } from '../format';
import { Button, inputClass, SectionCard } from './ui';

interface PublishPanelProps {
  saved: ProfileDocument | null;
  preview: SyncPayload | null;
  syncUrl: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}

export function PublishPanel({
  saved,
  preview,
  syncUrl,
  dirty,
  saving,
  onSave,
}: PublishPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(syncUrl);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <>
      <SectionCard
        description="La URL que los dispositivos leen al pulsar «Actualizar desde el servidor»."
        icon={<UploadCloud className="h-5 w-5" />}
        title="Publicación"
      >
        <dl className="grid gap-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink/15 bg-white/40 px-4 py-3">
            <dt className="text-sm font-extrabold">Estado</dt>
            <dd>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-xs font-black ${
                  saved ? 'bg-leaf text-paper' : 'bg-sky'
                }`}
              >
                {saved ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <CircleAlert className="h-3.5 w-3.5" />
                )}
                {saved ? 'Publicado' : 'Sin publicar'}
              </span>
            </dd>
          </div>

          <div className="rounded-2xl border-2 border-ink/15 bg-white/40 px-4 py-3">
            <dt className="text-sm font-extrabold">Formato</dt>
            <dd className="mt-1 font-mono text-xs font-semibold text-ink-soft">
              schemaVersion 1
            </dd>
          </div>

          <div className="rounded-2xl border-2 border-ink/15 bg-white/40 px-4 py-3">
            <dt className="text-sm font-extrabold">Revisión</dt>
            <dd className="mt-1 truncate font-mono text-xs font-semibold text-ink-soft">
              {saved?.revision ?? 'Se genera al publicar'}
            </dd>
          </div>

          <div className="rounded-2xl border-2 border-ink/15 bg-white/40 px-4 py-3">
            <dt className="text-sm font-extrabold">Última publicación</dt>
            <dd className="mt-1 text-sm font-semibold text-ink-soft">
              {formatTimestamp(saved?.updatedAt ?? null)}
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <p className="text-sm font-extrabold">URL de sincronización</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              aria-label="URL de sincronización"
              className={`${inputClass} font-mono text-xs`}
              readOnly
              value={syncUrl}
            />
            <Button
              aria-label="Copiar la URL de sincronización"
              onClick={copyUrl}
              size="icon"
              variant="secondary"
            >
              {copyState === 'copied' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          {copyState === 'copied' ? (
            <p className="mt-1.5 text-xs font-bold text-leaf">
              Copiada al portapapeles.
            </p>
          ) : copyState === 'error' ? (
            <p className="mt-1.5 text-xs font-bold text-coral">
              No se pudo copiar. Selecciona la URL manualmente.
            </p>
          ) : null}
          {saved ? (
            <a
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-ink-soft underline underline-offset-4 hover:text-ink"
              href={syncUrl}
              rel="noreferrer"
              target="_blank"
            >
              Abrir el JSON publicado
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>

        <Button
          className="mt-5 w-full"
          disabled={!dirty || saving}
          onClick={onSave}
        >
          <Save className="h-4 w-4" />
          {saving
            ? 'Guardando…'
            : dirty
              ? 'Guardar y publicar'
              : 'Todo publicado'}
        </Button>

        {dirty ? (
          <p className="mt-2 text-xs font-semibold text-ink-soft">
            Hay cambios sin publicar. Los dispositivos seguirán viendo la
            revisión anterior hasta que guardes.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        description="Lo que recibirá Kite en la próxima sincronización."
        icon={<FileJson className="h-5 w-5" />}
        title="Vista previa del JSON"
      >
        {preview ? (
          <pre className="max-h-[30rem] overflow-auto rounded-2xl border-2 border-ink/20 bg-ink p-4 text-xs leading-relaxed text-paper">
            <code>{JSON.stringify(preview, null, 2)}</code>
          </pre>
        ) : (
          <p className="rounded-2xl border-2 border-dashed border-coral/50 bg-coral/10 p-4 text-sm font-bold text-coral">
            Completa los campos obligatorios para ver la vista previa.
          </p>
        )}

        <p className="mt-3 text-xs font-semibold text-ink-soft">
          {dirty && preview
            ? 'La revisión mostrada es la última publicada; se regenerará al guardar. '
            : ''}
          parentPin se omite mientras la autenticación esté desactivada. Cada
          guardado genera una revisión nueva.
        </p>
      </SectionCard>
    </>
  );
}
