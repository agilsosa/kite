import { User } from 'lucide-react';
import { formatTimestamp } from '../format';
import { Field, inputClass, SectionCard } from './ui';

interface ProfileSectionProps {
  childName: string;
  volumeCap: number;
  revision: string | null;
  updatedAt: string | null;
  onChange: (patch: { childName?: string; volumeCap?: number }) => void;
}

export function ProfileSection({
  childName,
  volumeCap,
  revision,
  updatedAt,
  onChange,
}: ProfileSectionProps) {
  return (
    <SectionCard
      description="Estos valores reemplazan el nombre, el volumen y el perfil de cada dispositivo la próxima vez que sincronice."
      icon={<User className="h-5 w-5" />}
      title="Perfil del niño"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field hint="Entre 1 y 40 caracteres." label="Nombre del niño">
          <input
            className={inputClass}
            maxLength={40}
            onChange={(event) => onChange({ childName: event.target.value })}
            placeholder="Lucía"
            value={childName}
          />
        </Field>

        <Field
          hint="La genera el servidor cada vez que publicas."
          label="Revisión publicada"
        >
          <input
            className={`${inputClass} font-mono text-sm text-ink-soft`}
            readOnly
            value={revision ?? 'Se genera al publicar'}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-2xl border-2 border-ink/15 bg-white/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold">Límite de volumen</p>
            <p className="text-xs font-semibold text-ink-soft">
              El volumen máximo que Kite permite y el volumen inicial del
              perfil.
            </p>
          </div>
          <span className="rounded-full border-2 border-ink bg-marigold px-3 py-0.5 text-lg font-black shadow-kite-sm">
            {volumeCap}%
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <input
            aria-label="Límite de volumen"
            className="h-3 w-full cursor-pointer accent-marigold"
            max={100}
            min={0}
            onChange={(event) =>
              onChange({ volumeCap: Number(event.target.value) })
            }
            step={1}
            type="range"
            value={volumeCap}
          />
          <input
            aria-label="Límite de volumen exacto"
            className={`${inputClass} w-24 text-center`}
            max={100}
            min={0}
            onChange={(event) => {
              const next = Number(event.target.value);

              if (Number.isFinite(next)) {
                onChange({
                  volumeCap: Math.min(100, Math.max(0, Math.round(next))),
                });
              }
            }}
            type="number"
            value={volumeCap}
          />
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold text-ink-soft">
        Última publicación:{' '}
        <span className="font-black text-ink">
          {formatTimestamp(updatedAt)}
        </span>
      </p>
    </SectionCard>
  );
}
