import { Button as BaseButton } from '@base-ui/react/button';
import { Input } from '@base-ui/react/input';
import { useState } from 'react';
import {
  APP_ICON_KEYS,
  APP_ICON_LABELS,
  DEFAULT_APP_ICON,
} from '../../../shared/appIcons';
import type { AppIconKey } from '../../../shared/appIcons';
import type { AllowedApp } from '../../../shared/types';
import { AppIcon } from '../AppIcon';
import { Button } from '../Button';
import { PlusIcon, TrashIcon } from '../icons';

interface AppsSettingsProps {
  apps: AllowedApp[];
  onChange: (apps: AllowedApp[]) => void;
}

const inputClass =
  'min-h-12 w-full rounded-xl border-2 border-ink/20 bg-white/70 px-3 font-semibold';

function createId() {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AppsSettings({ apps, onChange }: AppsSettingsProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [icon, setIcon] = useState<AppIconKey>(DEFAULT_APP_ICON);
  const [error, setError] = useState<string | null>(null);

  const addApp = () => {
    const trimmedName = name.trim();
    const trimmedPath = path.trim();

    if (!trimmedName) {
      setError('Ponle un nombre a la aplicación.');
      return;
    }

    if (!/^(?:[a-zA-Z]:[\\/]|\/)/.test(trimmedPath)) {
      setError(
        'Usa una ruta completa a la aplicación, empezando por / o por una letra de unidad.',
      );
      return;
    }

    onChange([
      ...apps,
      {
        id: createId(),
        name: trimmedName,
        icon,
        path: trimmedPath,
      },
    ]);
    setName('');
    setPath('');
    setIcon(DEFAULT_APP_ICON);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {apps.length === 0 ? (
          <li className="rounded-2xl border-2 border-dashed border-ink/25 p-5 font-semibold text-ink-soft">
            Aún no hay aplicaciones. Añade una abajo y aparecerá en la pantalla
            de inicio.
          </li>
        ) : (
          apps.map((app) => (
            <li
              className="flex items-center gap-4 rounded-2xl border-2 border-ink/15 bg-white/50 p-4"
              key={app.id}
            >
              <AppIcon className="h-9 w-9 shrink-0" icon={app.icon} />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black">{app.name}</span>
                <span className="block truncate text-sm font-semibold text-ink-soft">
                  {app.path}
                </span>
              </span>
              <Button
                aria-label={`Eliminar ${app.name}`}
                className="h-12 w-12 shrink-0 p-0"
                onClick={() =>
                  onChange(apps.filter((entry) => entry.id !== app.id))
                }
                variant="ghost"
              >
                <TrashIcon className="h-5 w-5" />
              </Button>
            </li>
          ))
        )}
      </ul>

      <fieldset className="rounded-2xl border-2 border-ink/15 bg-white/40 p-4">
        <legend className="px-2 text-lg font-black">
          Añadir una aplicación
        </legend>
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          Nombre
          <Input
            className={inputClass}
            maxLength={40}
            onValueChange={setName}
            placeholder="Dibujar"
            value={name}
          />
        </label>

        <div className="mt-4 flex flex-col gap-1">
          <p className="text-sm font-extrabold">Icono</p>
          <div
            aria-label="Icono de la aplicación"
            className="flex flex-wrap gap-2"
            role="radiogroup"
          >
            {APP_ICON_KEYS.map((key) => (
              <BaseButton
                aria-checked={icon === key}
                aria-label={APP_ICON_LABELS[key]}
                className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-2 transition ${
                  icon === key
                    ? 'border-ink bg-marigold shadow-kite-sm'
                    : 'border-ink/20 bg-white/70 hover:bg-sky/40'
                }`}
                key={key}
                onClick={() => setIcon(key)}
                role="radio"
                type="button"
              >
                <AppIcon className="h-5 w-5" icon={key} />
              </BaseButton>
            ))}
          </div>
        </div>

        <label className="mt-4 flex flex-col gap-1 text-sm font-extrabold">
          Ruta completa de la aplicación
          <Input
            className={inputClass}
            maxLength={1000}
            onValueChange={setPath}
            placeholder="/Applications/KidsDraw.app"
            value={path}
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={addApp} variant="secondary">
            <PlusIcon className="h-5 w-5" />
            Añadir aplicación
          </Button>
          {error ? (
            <p className="font-bold text-coral" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </fieldset>
    </div>
  );
}
