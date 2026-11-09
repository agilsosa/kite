import { Input } from '@base-ui/react/input';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '../lib/format';
import { Button } from './Button';
import { Modal } from './Modal';

interface ParentGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasPin: boolean;
  onUnlocked: () => void;
}

const inputClass =
  'mt-2 min-h-14 w-full rounded-2xl border-2 border-ink bg-white/70 px-4 text-2xl font-black tracking-[0.35em]';

export function ParentGateDialog({
  open,
  onOpenChange,
  hasPin,
  onUnlocked,
}: ParentGateDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPin('');
      setConfirmation('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{4,8}$/.test(pin)) {
      setError('Usa un PIN de 4 a 8 dígitos.');
      return;
    }

    if (!hasPin && pin !== confirmation) {
      setError('Los dos PIN no coinciden.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (hasPin) {
        const unlocked = await window.api.parent.unlock(pin);

        if (!unlocked) {
          setError('Ese PIN no coincide.');
          return;
        }
      } else {
        await window.api.parent.setPin(pin);
      }

      onUnlocked();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const updatePin = (value: string) => {
    setPin(value.replace(/\D/g, '').slice(0, 8));
  };

  return (
    <Modal
      description={
        hasPin
          ? 'Introduce el PIN de adultos para cambiar las aplicaciones, los sitios web, el Wi-Fi o el límite de volumen.'
          : 'Crea un PIN de 4 a 8 dígitos. Guárdalo en un lugar seguro; se almacena cifrado.'
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            Cancelar
          </Button>
          <Button disabled={busy} form="parent-pin-form" type="submit">
            {busy ? 'Comprobando…' : hasPin ? 'Desbloquear' : 'Crear PIN'}
          </Button>
        </>
      }
      modal="trap-focus"
      onOpenChange={onOpenChange}
      open={open}
      title="Control de adultos"
    >
      <form
        className="flex flex-col gap-5"
        id="parent-pin-form"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="text-base font-extrabold" htmlFor="parent-pin">
            PIN
          </label>
          <Input
            aria-describedby={error ? 'parent-pin-error' : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="off"
            className={inputClass}
            id="parent-pin"
            inputMode="numeric"
            maxLength={8}
            onValueChange={updatePin}
            pattern="[0-9]*"
            type="password"
            value={pin}
          />
        </div>

        {!hasPin ? (
          <div>
            <label
              className="text-base font-extrabold"
              htmlFor="parent-pin-confirm"
            >
              Confirmar PIN
            </label>
            <Input
              autoComplete="off"
              className={inputClass}
              id="parent-pin-confirm"
              inputMode="numeric"
              maxLength={8}
              onValueChange={(value) =>
                setConfirmation(value.replace(/\D/g, '').slice(0, 8))
              }
              pattern="[0-9]*"
              type="password"
              value={confirmation}
            />
          </div>
        ) : null}

        {error ? (
          <p
            className="font-bold text-coral"
            id="parent-pin-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
