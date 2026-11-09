import { Button as BaseButton } from '@base-ui/react/button';
import { Input } from '@base-ui/react/input';
import { Popover } from '@base-ui/react/popover';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { WifiNetwork, WifiStatus } from '../../shared/types';
import { errorMessage } from '../lib/format';
import { LockIcon, RefreshIcon, WifiIcon, WifiOffIcon } from './icons';
import { StatusPopover } from './StatusPopover';

interface WifiPopoverProps {
  status: WifiStatus;
  onChanged: () => void;
}

const iconButtonClass =
  'flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/20 bg-white/70 transition hover:bg-sky/40 disabled:opacity-40';

const primaryButtonClass =
  'min-h-9 rounded-lg border-2 border-ink bg-marigold px-3 text-sm font-extrabold shadow-[2px_2px_0_0_#173f35] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40';

const secondaryButtonClass =
  'min-h-9 rounded-lg border-2 border-ink/20 bg-white/70 px-3 text-sm font-bold transition hover:bg-ink/5';

/** node-wifi reports security as English identifiers. */
function securityLabel(security: string): string {
  return security === 'Open' ? 'Abierta' : security;
}

export function WifiPopover({ status, onChanged }: WifiPopoverProps) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(status);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [selected, setSelected] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'scan' | 'change' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(status);
  }, [status]);

  const scan = useCallback(async () => {
    setBusy('scan');
    setError(null);

    try {
      const [found, latest] = await Promise.all([
        window.api.wifi.scan(),
        window.api.wifi.status(),
      ]);
      setNetworks(found);
      setCurrent(latest);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);

    if (next) {
      setSelected(null);
      setPassword('');
      void scan();
    }
  };

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selected) {
      return;
    }

    setBusy('change');
    setError(null);

    try {
      await window.api.wifi.connect(
        selected.ssid,
        selected.security === 'Open' ? '' : password,
      );
      setPassword('');
      setSelected(null);
      await scan();
      onChanged();
      setOpen(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('change');
    setError(null);

    try {
      await window.api.wifi.disconnect();
      await scan();
      onChanged();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const ssid = current.connected ? current.ssid : null;
  const connected = ssid !== null;
  const StatusIcon = connected ? WifiIcon : WifiOffIcon;

  return (
    <StatusPopover
      ariaLabel={
        connected
          ? `Conectado a ${ssid}. Abrir los controles de Wi-Fi`
          : 'El Wi-Fi no está conectado. Abrir los controles de Wi-Fi'
      }
      className="w-80"
      icon={<StatusIcon className="h-6 w-6" />}
      onOpenChange={handleOpenChange}
      open={open}
      text={connected ? ssid : 'Sin conexión'}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Popover.Title className="text-base font-black">Wi-Fi</Popover.Title>
          <p className="truncate text-xs font-bold text-ink-soft">
            {connected ? 'Conectado' : 'Sin conexión'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <BaseButton
            aria-label="Buscar redes Wi-Fi"
            className={iconButtonClass}
            disabled={busy !== null}
            onClick={() => void scan()}
            type="button"
          >
            <RefreshIcon className="h-4 w-4" />
          </BaseButton>
          {connected ? (
            <BaseButton
              aria-label="Desconectar el Wi-Fi"
              className={iconButtonClass}
              disabled={busy !== null}
              onClick={() => void disconnect()}
              type="button"
            >
              <WifiOffIcon className="h-4 w-4" />
            </BaseButton>
          ) : null}
        </div>
      </div>

      <ul
        aria-label="Redes Wi-Fi"
        className="mt-3 flex max-h-52 flex-col gap-1 overflow-y-auto pr-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-ink/25 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
      >
        {busy === 'scan' && networks.length === 0 ? (
          <li className="rounded-xl border-2 border-dashed border-ink/20 px-3 py-2 text-sm font-semibold text-ink-soft">
            Buscando…
          </li>
        ) : null}

        {!busy && networks.length === 0 ? (
          <li className="rounded-xl border-2 border-dashed border-ink/20 px-3 py-2 text-sm font-semibold text-ink-soft">
            No se encontraron redes.
          </li>
        ) : null}

        {networks.map((network) => (
          <li key={network.ssid}>
            <BaseButton
              aria-pressed={selected?.ssid === network.ssid}
              className={`flex w-full items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left transition ${
                selected?.ssid === network.ssid
                  ? 'border-ink bg-marigold/50'
                  : 'border-ink/15 bg-white/50 hover:bg-sky/30'
              }`}
              onClick={() => {
                setSelected(network);
                setPassword('');
              }}
              type="button"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper">
                {network.security === 'Open' ? (
                  <WifiIcon className="h-4 w-4" />
                ) : (
                  <LockIcon className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">
                  {network.ssid}
                </span>
                <span className="block text-xs font-semibold text-ink-soft">
                  {network.signal}% · {securityLabel(network.security)}
                </span>
              </span>
              {network.connected ? (
                <span className="shrink-0 rounded-full bg-leaf px-2 py-0.5 text-xs font-extrabold text-paper">
                  Activa
                </span>
              ) : null}
            </BaseButton>
          </li>
        ))}
      </ul>

      {selected ? (
        <form
          className="mt-3 rounded-xl border-2 border-ink/15 bg-white/50 p-3"
          onSubmit={(event) => void connect(event)}
        >
          <p className="truncate text-sm font-black">
            Conectar a {selected.ssid}
          </p>
          {selected.security !== 'Open' ? (
            <Input
              aria-label="Contraseña de Wi-Fi"
              autoComplete="off"
              className="mt-2 min-h-9 w-full rounded-lg border-2 border-ink/20 bg-white px-2 text-sm font-semibold"
              maxLength={128}
              onValueChange={setPassword}
              placeholder="Contraseña"
              type="password"
              value={password}
            />
          ) : null}
          <div className="mt-2 flex gap-2">
            <BaseButton
              className={primaryButtonClass}
              disabled={busy !== null}
              type="submit"
            >
              {busy === 'change' ? 'Conectando…' : 'Conectar'}
            </BaseButton>
            <BaseButton
              className={secondaryButtonClass}
              onClick={() => {
                setSelected(null);
                setPassword('');
              }}
              type="button"
            >
              Cancelar
            </BaseButton>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-bold text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </StatusPopover>
  );
}
