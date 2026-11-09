import { Button as BaseButton } from '@base-ui/react/button';
import { Origami } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PowerAction, TaskbarItem } from '../shared/types';
import { AppIcon } from './components/AppIcon';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { PowerMenu } from './components/PowerMenu';
import { useAppVersion } from './hooks/useAppVersion';
import { useMultiPress } from './hooks/useMultiPress';
import { errorMessage } from './lib/format';

const REFRESH_MS = 500;

const itemBase =
  'flex h-full min-w-0 max-w-44 shrink-0 items-center gap-1.5 rounded-lg border-2 px-2.5 text-sm font-extrabold transition';

const itemIdle =
  'border-transparent text-ink hover:border-ink/20 hover:bg-white/70';

const itemActive = 'border-ink bg-marigold shadow-[2px_2px_0_0_#173f35]';

function timeLabel(date: Date) {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Taskbar({ onRequestParent }: { onRequestParent: () => void }) {
  const [items, setItems] = useState<TaskbarItem[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [powerAction, setPowerAction] = useState<PowerAction | null>(null);
  const [powerError, setPowerError] = useState<string | null>(null);
  const version = useAppVersion();
  const versionPress = useMultiPress(onRequestParent, 2);

  const requestPower = useCallback((action: PowerAction) => {
    setPowerError(null);
    setPowerAction(action);
  }, []);

  const confirmPower = useCallback(() => {
    if (powerAction === null) {
      return;
    }

    setPowerError(null);
    void window.api.system
      .power(powerAction)
      .then(() => setPowerAction(null))
      .catch((cause: unknown) => setPowerError(errorMessage(cause)));
  }, [powerAction]);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      void window.api.taskbar
        .list()
        .then((next) => {
          if (active) {
            setItems(next);
          }
        })
        .catch(() => {
          // Keep the last known list; the next poll retries.
        });
    };

    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 20_000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <nav
      aria-label="Barra de tareas"
      className="flex h-13 w-full shrink-0 items-stretch gap-1.5 overflow-hidden border-t border-ink/10 bg-sky-soft px-1.5 py-1 text-ink"
    >
      <BaseButton
        aria-label="Ir al inicio de Kite"
        className="flex h-full shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-2 border-transparent px-2 text-sm font-black transition hover:border-ink/20 hover:bg-white/70"
        onClick={() => void window.api.taskbar.home()}
        title="Inicio de Kite"
        type="button"
      >
        <Origami
          aria-hidden="true"
          className="h-5 w-5 text-coral"
          strokeWidth={2.1}
        />
        <span className="hidden sm:inline">Kite</span>
      </BaseButton>

      <span aria-hidden="true" className="w-px shrink-0 bg-ink/15" />

      <div
        aria-label="Aplicaciones abiertas"
        className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
      >
        {items.length === 0 ? (
          <p className="flex items-center px-2 text-sm font-bold text-ink">
            No hay nada abierto
          </p>
        ) : (
          items.map((item) => (
            <BaseButton
              aria-label={`Cambiar a ${item.title}`}
              className={`${itemBase} ${item.active ? itemActive : itemIdle}`}
              key={item.id}
              onClick={() => {
                void window.api.taskbar.activate(item.id).catch(() => {
                  // The next poll removes stale entries.
                });
              }}
              title={item.title}
              type="button"
            >
              <AppIcon className="h-4 w-4 shrink-0" icon={item.icon} />
              <span className="truncate">{item.title}</span>
            </BaseButton>
          ))
        )}
      </div>

      <BaseButton
        {...versionPress}
        aria-label={
          version ? `Versión de Kite ${version}` : 'Versión de Kite desconocida'
        }
        className="flex h-full shrink-0 cursor-default items-center rounded-lg px-2 text-xs font-black text-ink select-none"
        title={version ? `kite v${version}` : 'kite'}
        type="button"
      >
        kite{version ? ` v${version}` : ''}
      </BaseButton>

      <time
        className="flex shrink-0 items-center px-1.5 text-sm font-black text-ink tabular-nums"
        dateTime={now.toISOString()}
      >
        {timeLabel(now)}
      </time>

      <PowerMenu onSelect={requestPower} />

      <Modal
        description={
          powerAction === 'restart'
            ? 'Kite se cerrará y el equipo se reiniciará.'
            : 'Kite se cerrará y el equipo se apagará.'
        }
        footer={
          <>
            <Button onClick={() => setPowerAction(null)} variant="ghost">
              Cancelar
            </Button>
            <Button onClick={confirmPower} variant="danger">
              {powerAction === 'restart' ? 'Reiniciar' : 'Apagar'}
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) {
            setPowerAction(null);
            setPowerError(null);
          }
        }}
        open={powerAction !== null}
        title={
          powerAction === 'restart'
            ? '¿Reiniciar el equipo?'
            : '¿Apagar el equipo?'
        }
      >
        <p className="text-base font-bold text-ink-soft">
          Pide permiso a un adulto primero: todo lo que esté abierto se cerrará.
        </p>
        {powerError ? (
          <p className="mt-3 font-bold text-coral" role="alert">
            {powerError}
          </p>
        ) : null}
      </Modal>
    </nav>
  );
}
