import { Input } from '@base-ui/react/input';
import { Slider } from '@base-ui/react/slider';
import { Switch } from '@base-ui/react/switch';
import { useState } from 'react';
import { errorMessage } from '../../lib/format';
import { Button } from '../Button';
import { UpdatesSettings } from './UpdatesSettings';

interface DeviceSettingsProps {
  childName: string;
  volumeCap: number;
  childKeyboard: boolean;
  onChildNameChange: (name: string) => void;
  onVolumeCapChange: (cap: number) => void;
  onChildKeyboardChange: (enabled: boolean) => void;
}

const inputClass =
  'min-h-12 w-full rounded-xl border-2 border-ink/20 bg-white/70 px-3 font-semibold';

export function DeviceSettings({
  childName,
  volumeCap,
  childKeyboard,
  onChildNameChange,
  onVolumeCapChange,
  onChildKeyboardChange,
}: DeviceSettingsProps) {
  const [exitError, setExitError] = useState<string | null>(null);
  const [confirmingExit, setConfirmingExit] = useState(false);

  const exitKiosk = async () => {
    try {
      await window.api.system.quit();
    } catch (cause) {
      setExitError(errorMessage(cause));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-md flex-col gap-1 text-sm font-extrabold">
        Nombre del niño
        <Input
          className={inputClass}
          maxLength={40}
          onValueChange={onChildNameChange}
          value={childName}
        />
      </label>

      <div className="rounded-2xl border-2 border-ink/15 bg-white/40 p-4">
        <Slider.Root
          className="flex w-full flex-col gap-3"
          max={100}
          min={0}
          onValueChange={onVolumeCapChange}
          step={5}
          value={volumeCap}
        >
          <div className="flex items-center justify-between gap-4">
            <Slider.Label className="text-lg font-extrabold">
              Volumen máximo
            </Slider.Label>
            <Slider.Value className="rounded-full bg-marigold px-3 py-1 text-lg font-black" />
          </div>
          <Slider.Control className="flex h-14 w-full touch-none items-center">
            <Slider.Track className="relative h-5 w-full rounded-full bg-ink/15">
              <Slider.Indicator className="absolute h-full rounded-full bg-leaf" />
              <Slider.Thumb className="block h-11 w-11 rounded-full border-4 border-ink bg-paper shadow-kite-sm" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <p className="mt-3 text-sm font-semibold text-ink-soft">
          La pantalla de inicio del niño no puede subir el volumen por encima de
          este nivel.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-ink/15 bg-white/40 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold">Teclado en pantalla</h3>
            <p className="mt-1 max-w-md text-sm font-semibold text-ink-soft">
              Muestra un teclado táctil cuando se toca un campo de texto en Kite
              o en los sitios web. Actívalo en equipos sin teclado físico.
            </p>
          </div>
          <Switch.Root
            aria-label="Teclado en pantalla"
            checked={childKeyboard}
            className="relative mt-1 h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-ink bg-paper transition data-[checked]:bg-leaf"
            onCheckedChange={onChildKeyboardChange}
          >
            <Switch.Thumb className="block h-5 w-5 translate-x-1 rounded-full border-2 border-ink bg-marigold transition data-[checked]:translate-x-6 data-[checked]:bg-paper" />
          </Switch.Root>
        </div>
      </div>

      <UpdatesSettings />

      <section className="rounded-2xl border-2 border-coral/40 bg-coral/5 p-4">
        <h3 className="text-lg font-black">Salir del modo kiosco</h3>
        <p className="mt-1 max-w-xl text-sm font-semibold text-ink-soft">
          Úsalo solo en un equipo que estés configurando. Para un bloqueo
          completo todavía hace falta configurar el modo kiosco del sistema
          operativo.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setExitError(null);
            setConfirmingExit(true);
          }}
          variant="danger"
        >
          Salir del kiosco
        </Button>

        {confirmingExit ? (
          <div
            aria-label="Confirmar la salida del modo kiosco"
            className="mt-4 rounded-2xl border-2 border-coral bg-white/70 p-4"
            role="alertdialog"
          >
            <p className="font-black">¿Salir del modo kiosco ahora?</p>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              El equipo quedará desbloqueado hasta que se vuelva a iniciar Kite.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                onClick={() => setConfirmingExit(false)}
                variant="secondary"
              >
                Quedarme en el kiosco
              </Button>
              <Button onClick={() => void exitKiosk()} variant="danger">
                Salir ahora
              </Button>
            </div>
          </div>
        ) : null}

        {exitError ? (
          <p className="mt-3 font-bold text-coral" role="alert">
            {exitError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
