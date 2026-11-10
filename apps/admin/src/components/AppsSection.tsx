import { Plus, Trash2, X } from 'lucide-react';
import {
  APP_ICON_KEYS,
  APP_ICON_LABELS,
  DEFAULT_APP_ICON,
  MAX_APPS,
  MAX_ARGS,
  MAX_ARG_LENGTH,
  MAX_PATH_LENGTH,
} from '../../shared/profile';
import type { AppIconKey, ProfileApp } from '../../shared/profile';
import { AppIcon } from './AppIcon';
import { Button, CountBadge, inputClass, SectionCard } from './ui';

interface AppsSectionProps {
  apps: ProfileApp[];
  onChange: (apps: ProfileApp[]) => void;
}

function createAppId(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return `app-${globalThis.crypto.randomUUID()}`;
  }

  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createApp(): ProfileApp {
  return {
    id: createAppId(),
    name: '',
    icon: DEFAULT_APP_ICON,
    paths: { linux: '', windows: '', macos: '' },
    args: [],
  };
}

export function AppsSection({ apps, onChange }: AppsSectionProps) {
  const updateApp = (id: string, patch: Partial<ProfileApp>) => {
    onChange(apps.map((app) => (app.id === id ? { ...app, ...patch } : app)));
  };

  const updatePath = (
    id: string,
    platform: 'linux' | 'windows' | 'macos',
    value: string,
  ) => {
    onChange(
      apps.map((app) =>
        app.id === id
          ? { ...app, paths: { ...app.paths, [platform]: value } }
          : app,
      ),
    );
  };

  const updateArg = (id: string, index: number, value: string) => {
    onChange(
      apps.map((app) =>
        app.id === id
          ? {
              ...app,
              args: app.args.map((arg, argIndex) =>
                argIndex === index ? value : arg,
              ),
            }
          : app,
      ),
    );
  };

  const addArg = (id: string) => {
    onChange(
      apps.map((app) =>
        app.id === id && app.args.length < MAX_ARGS
          ? { ...app, args: [...app.args, ''] }
          : app,
      ),
    );
  };

  const removeArg = (id: string, index: number) => {
    onChange(
      apps.map((app) =>
        app.id === id
          ? {
              ...app,
              args: app.args.filter((_, argIndex) => argIndex !== index),
            }
          : app,
      ),
    );
  };

  return (
    <SectionCard
      action={
        <div className="flex items-center gap-2">
          <CountBadge>
            {apps.length}/{MAX_APPS}
          </CountBadge>
          <Button
            disabled={apps.length >= MAX_APPS}
            onClick={() => onChange([...apps, createApp()])}
            variant="secondary"
          >
            <Plus className="h-4 w-4" />
            Añadir app
          </Button>
        </div>
      }
      description="Cada aplicación necesita su ruta de Linux y de Windows. macOS es opcional; Kite solo lee la ruta del sistema donde se ejecuta."
      icon={<AppIcon className="h-5 w-5" icon="gamepad" />}
      title="Aplicaciones permitidas"
    >
      <div className="flex flex-col gap-4">
        {apps.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-ink/25 p-5 font-semibold text-ink-soft">
            Aún no hay aplicaciones nativas. Añade una y completa sus rutas para
            Linux y Windows.
          </p>
        ) : (
          apps.map((app, index) => (
            <article
              className="rounded-[1.75rem] border-2 border-ink/20 bg-white/40 p-4"
              key={app.id}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-marigold shadow-kite-sm">
                  <AppIcon className="h-7 w-7" icon={app.icon} />
                </span>

                <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-extrabold">
                  <span>Aplicación {index + 1}</span>
                  <input
                    aria-label={`Nombre de la aplicación ${index + 1}`}
                    className={inputClass}
                    maxLength={40}
                    onChange={(event) =>
                      updateApp(app.id, { name: event.target.value })
                    }
                    placeholder="Firefox"
                    value={app.name}
                  />
                  <span className="truncate font-mono text-[0.68rem] font-semibold text-ink-soft">
                    id: {app.id}
                  </span>
                </label>

                <Button
                  aria-label={`Eliminar la aplicación ${index + 1}`}
                  onClick={() =>
                    onChange(apps.filter((entry) => entry.id !== app.id))
                  }
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>

              <div className="mt-4">
                <p className="text-sm font-extrabold">Icono</p>
                <div
                  aria-label={`Icono de la aplicación ${index + 1}`}
                  className="mt-2 flex flex-wrap gap-2"
                  role="radiogroup"
                >
                  {APP_ICON_KEYS.map((key) => (
                    <button
                      aria-checked={app.icon === key}
                      aria-label={APP_ICON_LABELS[key]}
                      className={`grid h-10 w-10 cursor-pointer place-items-center rounded-xl border-2 transition ${
                        app.icon === key
                          ? 'border-ink bg-marigold shadow-kite-sm'
                          : 'border-ink/20 bg-white/70 hover:bg-sky/40'
                      }`}
                      key={key}
                      onClick={() =>
                        updateApp(app.id, { icon: key as AppIconKey })
                      }
                      role="radio"
                      type="button"
                    >
                      <AppIcon className="h-5 w-5" icon={key} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-extrabold">
                  <span>Ruta en Linux</span>
                  <input
                    aria-label={`Ruta de ${app.name || 'la aplicación'} en Linux`}
                    className={`${inputClass} font-mono text-sm`}
                    maxLength={MAX_PATH_LENGTH}
                    onChange={(event) =>
                      updatePath(app.id, 'linux', event.target.value)
                    }
                    placeholder="/usr/bin/firefox"
                    value={app.paths.linux}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-extrabold">
                  <span>Ruta en Windows</span>
                  <input
                    aria-label={`Ruta de ${app.name || 'la aplicación'} en Windows`}
                    className={`${inputClass} font-mono text-sm`}
                    maxLength={MAX_PATH_LENGTH}
                    onChange={(event) =>
                      updatePath(app.id, 'windows', event.target.value)
                    }
                    placeholder="C:\Program Files\Mozilla Firefox\firefox.exe"
                    value={app.paths.windows}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-extrabold md:col-span-2">
                  <span>
                    Ruta en macOS{' '}
                    <span className="text-xs font-semibold text-ink-soft">
                      (opcional)
                    </span>
                  </span>
                  <input
                    aria-label={`Ruta de ${app.name || 'la aplicación'} en macOS`}
                    className={`${inputClass} font-mono text-sm`}
                    maxLength={MAX_PATH_LENGTH}
                    onChange={(event) =>
                      updatePath(app.id, 'macos', event.target.value)
                    }
                    placeholder="/Applications/Firefox.app/Contents/MacOS/firefox"
                    value={app.paths.macos ?? ''}
                  />
                </label>
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold">Argumentos</p>
                    <p className="text-xs font-semibold text-ink-soft">
                      Hasta {MAX_ARGS} argumentos por aplicación.
                    </p>
                  </div>
                  <Button
                    disabled={app.args.length >= MAX_ARGS}
                    onClick={() => addArg(app.id)}
                    variant="ghost"
                  >
                    <Plus className="h-4 w-4" />
                    Añadir argumento
                  </Button>
                </div>

                {app.args.length === 0 ? (
                  <p className="mt-2 rounded-xl border-2 border-dashed border-ink/20 p-3 text-sm font-semibold text-ink-soft">
                    Sin argumentos.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {app.args.map((arg, argIndex) => (
                      <li
                        className="flex items-center gap-2"
                        key={`${app.id}-arg-${argIndex}`}
                      >
                        <input
                          aria-label={`Argumento ${argIndex + 1} de ${app.name || 'la aplicación'}`}
                          className={`${inputClass} font-mono text-sm`}
                          maxLength={MAX_ARG_LENGTH}
                          onChange={(event) =>
                            updateArg(app.id, argIndex, event.target.value)
                          }
                          placeholder="--kiosk"
                          value={arg}
                        />
                        <Button
                          aria-label={`Quitar el argumento ${argIndex + 1}`}
                          onClick={() => removeArg(app.id, argIndex)}
                          size="icon"
                          variant="ghost"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </SectionCard>
  );
}
