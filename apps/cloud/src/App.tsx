import { useEffect, useState } from 'react';

type HealthState = 'checking' | 'online' | 'offline';

interface HealthPayload {
  ok: boolean;
  service: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthState>('checking');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/health')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return (await response.json()) as HealthPayload;
      })
      .then((payload) => {
        if (!cancelled) {
          setHealth(payload.ok ? 'online' : 'offline');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealth('offline');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel =
    health === 'checking'
      ? 'Comprobando…'
      : health === 'online'
        ? 'API conectada'
        : 'API no disponible';

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-black/40">
        <p className="text-sm font-semibold tracking-[0.3em] text-cyan-300 uppercase">
          Kite Cloud
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">
          Administración de perfiles
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          Panel para publicar los perfiles que consumen los clientes de Kite.
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-sm text-slate-400">Estado del servicio</dt>
            <dd className="mt-1 flex items-center gap-2 text-lg font-bold">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  health === 'online'
                    ? 'bg-emerald-400'
                    : health === 'offline'
                      ? 'bg-rose-400'
                      : 'animate-pulse bg-amber-300'
                }`}
              />
              {statusLabel}
            </dd>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <dt className="text-sm text-slate-400">Versión del panel</dt>
            <dd className="mt-1 text-lg font-bold">0.0.0</dd>
          </div>
        </dl>

        <p className="mt-8 rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          El panel está vacío por ahora. Los formularios y la API de perfiles se
          añadirán en la siguiente iteración.
        </p>
      </section>
    </main>
  );
}
