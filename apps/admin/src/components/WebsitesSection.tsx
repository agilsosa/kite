import { ExternalLink, Globe, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { MAX_ORIGINS } from '../../shared/profile';
import { Button, CountBadge, inputClass, SectionCard } from './ui';

interface WebsitesSectionProps {
  origins: string[];
  onChange: (origins: string[]) => void;
}

function normalizeOrigin(value: string): string {
  const trimmed = value.trim();

  if (trimmed === '') {
    throw new Error('Escribe una dirección web.');
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      'La dirección no es válida. Usa una URL completa, por ejemplo https://pbskids.org.',
    );
  }

  if (url.protocol !== 'https:') {
    throw new Error('Los sitios web deben usar HTTPS.');
  }

  return url.origin;
}

export function WebsitesSection({ origins, onChange }: WebsitesSectionProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addOrigin = () => {
    try {
      const origin = normalizeOrigin(value);

      if (origins.includes(origin)) {
        setError('Ese sitio ya está en la lista.');
        return;
      }

      if (origins.length >= MAX_ORIGINS) {
        setError(`No puedes añadir más de ${MAX_ORIGINS} sitios web.`);
        return;
      }

      onChange([...origins, origin]);
      setValue('');
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo añadir el sitio.',
      );
    }
  };

  return (
    <SectionCard
      action={
        <CountBadge>
          {origins.length}/{MAX_ORIGINS}
        </CountBadge>
      }
      description="Solo se permiten direcciones HTTPS. Kite guarda el origen, así que las rutas y los parámetros se descartan."
      icon={<Globe className="h-5 w-5" />}
      title="Sitios web permitidos"
    >
      <ul className="flex flex-col gap-2">
        {origins.length === 0 ? (
          <li className="rounded-2xl border-2 border-dashed border-ink/25 p-5 font-semibold text-ink-soft">
            Aún no hay sitios web. Añade uno abajo para que aparezca en la
            pantalla de inicio.
          </li>
        ) : (
          origins.map((origin, index) => (
            <li
              className="flex items-center gap-3 rounded-2xl border-2 border-ink/15 bg-white/50 p-3"
              key={origin}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-ink/20 bg-sky/40 text-sm font-black">
                {index + 1}
              </span>
              <a
                className="min-w-0 flex-1 truncate font-bold underline-offset-4 hover:underline"
                href={origin}
                rel="noreferrer"
                target="_blank"
              >
                {origin}
              </a>
              <ExternalLink className="hidden h-4 w-4 shrink-0 text-ink-soft sm:block" />
              <Button
                aria-label={`Quitar ${origin}`}
                onClick={() =>
                  onChange(origins.filter((entry) => entry !== origin))
                }
                size="icon"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))
        )}
      </ul>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          addOrigin();
        }}
      >
        <input
          aria-label="Nueva dirección web"
          className={inputClass}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="https://pbskids.org"
          type="url"
          value={value}
        />
        <Button type="submit" variant="secondary">
          <Plus className="h-4 w-4" />
          Añadir sitio
        </Button>
      </form>

      {error ? (
        <p className="mt-2 text-sm font-bold text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </SectionCard>
  );
}
