import { Braces, CircleCheck } from 'lucide-react';
import { useMemo } from 'react';
import { parseFeaturesJson } from '../../shared/profile';
import { SectionCard } from './ui';

interface FeaturesSectionProps {
  text: string;
  onChange: (text: string) => void;
}

const PLACEHOLDER = `{
  "bedtime": {
    "enabled": true,
    "start": "20:30",
    "end": "07:00"
  }
}`;

export function FeaturesSection({ text, onChange }: FeaturesSectionProps) {
  const error = useMemo(() => {
    try {
      parseFeaturesJson(text);
      return null;
    } catch (cause) {
      return cause instanceof Error
        ? cause.message
        : 'Las funciones avanzadas no son válidas.';
    }
  }, [text]);

  return (
    <SectionCard
      description="Opcional. Kite guarda este objeto sin interpretarlo todavía, pero las versiones futuras podrán leer funciones con nombre propio."
      icon={<Braces className="h-5 w-5" />}
      title="Funciones avanzadas"
    >
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        <span>JSON de funciones</span>
        <textarea
          className="min-h-52 w-full rounded-2xl border-2 border-ink/20 bg-white/70 p-4 font-mono text-sm leading-relaxed font-semibold text-ink placeholder:text-ink-soft/55"
          onChange={(event) => onChange(event.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          value={text}
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {error ? (
          <p className="text-sm font-bold text-coral" role="alert">
            {error}
          </p>
        ) : text.trim() === '' ? (
          <p className="text-xs font-semibold text-ink-soft">
            Sin funciones avanzadas. El perfil se publicará sin el campo
            features.
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-leaf">
            <CircleCheck className="h-4 w-4" />
            JSON válido
          </p>
        )}
      </div>
    </SectionCard>
  );
}
