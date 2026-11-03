import { Input } from '@base-ui/react/input';
import { useEffect, useState } from 'react';
import type { SyncInfo, SyncResult } from '../../../shared/types';
import { errorMessage } from '../../lib/format';
import { Button } from '../Button';
import { RefreshIcon } from '../icons';

interface SyncSettingsProps {
  onApplied: (result: SyncResult) => void;
}

const inputClass =
  'min-h-12 w-full rounded-xl border-2 border-ink/20 bg-white/70 px-3 font-semibold';

function formatSyncDate(timestamp: number | null): string {
  if (timestamp === null) {
    return 'Nunca';
  }

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export function SyncSettings({ onApplied }: SyncSettingsProps) {
  const [endpoint, setEndpoint] = useState('');
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    window.api.sync
      .status()
      .then((next) => {
        if (!cancelled) {
          setInfo(next);
          setEndpoint(next.endpoint ?? '');
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(errorMessage(cause));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const apply = async () => {
    setSyncing(true);
    setError(null);
    setDone(null);

    try {
      const result = await window.api.sync.apply(endpoint);
      setInfo(result.info);
      setEndpoint(result.info.endpoint ?? '');
      onApplied(result);
      setDone('Datos actualizados desde el servidor.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border-2 border-ink/15 bg-white/40 p-4">
        <h3 className="text-lg font-black">Configuración desde el servidor</h3>
        <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-soft">
          La API debe devolver el estado completo del perfil. Al actualizar se
          reemplazan el nombre, el volumen máximo, las aplicaciones y los sitios
          web actuales. El PIN de adultos no cambia.
        </p>

        <div className="mt-4 rounded-xl border-2 border-marigold bg-marigold/20 p-3 text-sm font-semibold">
          Los cambios que no hayas guardado en las otras pestañas se perderán.
        </div>

        <label className="mt-4 flex flex-col gap-1 text-sm font-extrabold">
          Dirección de la API
          <Input
            className={inputClass}
            disabled={syncing}
            maxLength={2048}
            onValueChange={(value) => {
              setEndpoint(value);
              setDone(null);
              setError(null);
            }}
            placeholder="https://ejemplo.com/kite.json"
            value={endpoint}
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            disabled={loading || syncing || endpoint.trim().length === 0}
            onClick={() => void apply()}
          >
            <RefreshIcon
              className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`.trim()}
            />
            {syncing ? 'Actualizando…' : 'Actualizar desde el servidor'}
          </Button>
        </div>

        <dl className="mt-4 grid gap-2 text-sm font-semibold sm:grid-cols-2">
          <div>
            <dt className="text-ink-soft">Última sincronización</dt>
            <dd className="font-black">
              {formatSyncDate(info?.lastSyncedAt ?? null)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft">Revisión del servidor</dt>
            <dd className="break-words font-black">{info?.revision ?? '—'}</dd>
          </div>
        </dl>

        {done ? (
          <p className="mt-3 font-bold text-leaf" role="status">
            {done}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 font-bold text-coral" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border-2 border-ink/15 bg-white/40 p-4">
        <h3 className="text-lg font-black">Formato esperado</h3>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          La respuesta debe ser un objeto JSON con estos campos:
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm font-semibold">
          <li>
            <code className="rounded bg-ink/10 px-1.5 py-0.5 font-black">
              schemaVersion
            </code>{' '}
            — debe ser <span className="font-black">1</span>.
          </li>
          <li>
            <code className="rounded bg-ink/10 px-1.5 py-0.5 font-black">
              childName
            </code>{' '}
            — nombre visible del niño.
          </li>
          <li>
            <code className="rounded bg-ink/10 px-1.5 py-0.5 font-black">
              volumeCap
            </code>{' '}
            — volumen máximo, entero de 0 a 100.
          </li>
          <li>
            <code className="rounded bg-ink/10 px-1.5 py-0.5 font-black">
              allowedOrigins
            </code>{' '}
            — lista de sitios HTTPS.
          </li>
          <li>
            <code className="rounded bg-ink/10 px-1.5 py-0.5 font-black">
              allowedApps
            </code>{' '}
            — lista de aplicaciones con nombre, ruta e icono.
          </li>
          <li>
            <code className="rounded bg-ink/10 px-1.5 py-0.5 font-black">
              features
            </code>{' '}
            — opcional, reservado para funciones futuras.
          </li>
        </ul>
        <p className="mt-3 text-sm font-semibold text-ink-soft">
          Se puede añadir <span className="font-black">revision</span> para
          identificar la versión de los datos. Consulta la documentación de
          sincronización para ver el ejemplo completo.
        </p>
      </section>
    </div>
  );
}
