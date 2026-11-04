import { useEffect, useState } from 'react';
import type { UpdateState } from '../../../shared/types';
import { errorMessage } from '../../lib/format';
import { Button } from '../Button';

const POLL_INTERVAL_MS = 2000;

function statusText(state: UpdateState): string {
  switch (state.phase) {
    case 'disabled':
      return 'La comprobación de actualizaciones no está disponible en esta versión de Kite.';
    case 'idle':
      return 'Kite buscará actualizaciones automáticamente.';
    case 'checking':
      return 'Buscando actualizaciones…';
    case 'available':
      return state.availableVersion
        ? `Hay una actualización disponible (v${state.availableVersion}). Descárgala desde la página de la versión e instálala manualmente.`
        : 'Hay una actualización disponible. Descárgala desde la página de la versión e instálala manualmente.';
    case 'downloading':
      return 'Hay una actualización disponible. Descargando en segundo plano…';
    case 'downloaded':
      return 'Actualización descargada. Puedes instalarla cuando quieras.';
    case 'up-to-date':
      return 'Kite está actualizado.';
    case 'error':
      return 'No se pudo comprobar la actualización.';
  }
}

export function UpdatesSettings() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmingInstall, setConfirmingInstall] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await window.api.update.status();

        if (!cancelled) {
          setState(next);
        }
      } catch {
        // The status poll is best effort; explicit actions report errors.
      }
    };

    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const check = async () => {
    setChecking(true);
    setError(null);

    try {
      setState(await window.api.update.check());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setChecking(false);
    }
  };

  const install = async () => {
    setInstalling(true);
    setError(null);

    try {
      await window.api.update.install();
    } catch (cause) {
      setError(errorMessage(cause));
      setInstalling(false);
    }
  };

  const openRelease = async () => {
    setError(null);

    try {
      await window.api.update.openRelease();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const busy =
    state?.phase === 'checking' || state?.phase === 'downloading' || checking;
  const supported = state !== null && state.phase !== 'disabled';

  return (
    <section className="rounded-2xl border-2 border-ink/15 bg-white/40 p-4">
      <h3 className="text-lg font-black">Actualizaciones</h3>
      <p className="mt-1 max-w-xl text-sm font-semibold text-ink-soft">
        En Windows, Kite descarga las actualizaciones en segundo plano y solo
        las instala cuando tú lo autorizas; las aplicaciones abiertas desde Kite
        se cerrarán durante la instalación. En Linux, Kite comprueba si hay una
        versión nueva y te enlaza a la página de la versión para instalarla
        manualmente.
      </p>

      <dl className="mt-4 grid gap-2 text-sm font-semibold sm:grid-cols-2">
        <div>
          <dt className="text-ink-soft">Versión instalada</dt>
          <dd className="font-black">{state?.currentVersion ?? '…'}</dd>
        </div>
        {state?.availableVersion ? (
          <div>
            <dt className="text-ink-soft">Versión disponible</dt>
            <dd className="font-black">{state.availableVersion}</dd>
          </div>
        ) : null}
      </dl>

      <p
        aria-live="polite"
        className={`mt-4 font-bold ${
          state?.phase === 'error' ? 'text-coral' : 'text-ink-soft'
        }`}
      >
        {state
          ? statusText(state)
          : 'Cargando el estado de las actualizaciones…'}
      </p>

      {state?.releaseUrl ? (
        <p className="mt-2 break-all text-sm font-semibold text-ink-soft">
          Página de la versión:{' '}
          <span className="font-mono">{state.releaseUrl}</span>
        </p>
      ) : null}

      {state?.error ? (
        <p className="mt-2 text-sm font-semibold text-coral" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          disabled={!supported || busy || state?.phase === 'downloaded'}
          onClick={() => void check()}
          variant="secondary"
        >
          {busy ? 'Comprobando…' : 'Buscar actualizaciones'}
        </Button>

        {state?.phase === 'available' ? (
          <Button onClick={() => void openRelease()}>
            Abrir página de la versión
          </Button>
        ) : null}

        {state?.phase === 'downloaded' && !confirmingInstall ? (
          <Button onClick={() => setConfirmingInstall(true)}>
            Reiniciar e instalar
          </Button>
        ) : null}
      </div>

      {state?.phase === 'downloaded' && confirmingInstall ? (
        <div
          aria-label="Confirmar la instalación de la actualización"
          className="mt-4 rounded-2xl border-2 border-marigold bg-white/70 p-4"
          role="alertdialog"
        >
          <p className="font-black">
            ¿Reiniciar Kite e instalar
            {state.availableVersion
              ? ` la versión ${state.availableVersion}`
              : ' la actualización'}
            ?
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            Guarda cualquier trabajo abierto. Kite se cerrará, se actualizará y
            volverá a abrirse.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={installing}
              onClick={() => setConfirmingInstall(false)}
              variant="secondary"
            >
              Ahora no
            </Button>
            <Button disabled={installing} onClick={() => void install()}>
              {installing ? 'Reiniciando…' : 'Reiniciar e instalar'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 font-bold text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
