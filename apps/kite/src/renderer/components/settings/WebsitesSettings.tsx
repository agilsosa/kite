import { Input } from '@base-ui/react/input';
import { Globe } from 'lucide-react';
import { useState } from 'react';
import { hostLabel } from '../../lib/format';
import { Button } from '../Button';
import { PlusIcon, TrashIcon } from '../icons';

interface WebsitesSettingsProps {
  origins: string[];
  onChange: (origins: string[]) => void;
}

const inputClass =
  'min-h-12 w-full rounded-xl border-2 border-ink/20 bg-white/70 px-3 font-semibold';

export function WebsitesSettings({ origins, onChange }: WebsitesSettingsProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addOrigin = () => {
    try {
      const url = new URL(value.trim());

      if (url.protocol !== 'https:') {
        setError('Usa una dirección segura https://.');
        return;
      }

      if (origins.includes(url.origin)) {
        setError('Ese sitio web ya está permitido.');
        return;
      }

      onChange([...origins, url.origin]);
      setValue('');
      setError(null);
    } catch {
      setError(
        'Escribe una dirección completa, por ejemplo https://pbskids.org.',
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {origins.length === 0 ? (
          <li className="rounded-2xl border-2 border-dashed border-ink/25 p-5 font-semibold text-ink-soft">
            Aún no hay sitios web. Añade uno de confianza abajo.
          </li>
        ) : (
          origins.map((origin) => (
            <li
              className="flex items-center gap-4 rounded-2xl border-2 border-ink/15 bg-white/50 p-4"
              key={origin}
            >
              <Globe
                aria-hidden="true"
                className="h-7 w-7 shrink-0"
                strokeWidth={2.1}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black">
                  {hostLabel(origin)}
                </span>
                <span className="block truncate text-sm font-semibold text-ink-soft">
                  {origin}
                </span>
              </span>
              <Button
                aria-label={`Eliminar ${hostLabel(origin)}`}
                className="h-12 w-12 shrink-0 p-0"
                onClick={() =>
                  onChange(origins.filter((entry) => entry !== origin))
                }
                variant="ghost"
              >
                <TrashIcon className="h-5 w-5" />
              </Button>
            </li>
          ))
        )}
      </ul>

      <div className="rounded-2xl border-2 border-ink/15 bg-white/40 p-4">
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          Sitio web permitido
          <Input
            className={inputClass}
            maxLength={300}
            onValueChange={setValue}
            placeholder="https://pbskids.org"
            value={value}
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={addOrigin} variant="secondary">
            <PlusIcon className="h-5 w-5" />
            Añadir sitio web
          </Button>
          {error ? (
            <p className="font-bold text-coral" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
