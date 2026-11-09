import { Button as BaseButton } from '@base-ui/react/button';
import { Globe } from 'lucide-react';
import { hostLabel } from '../lib/format';

interface WebTileProps {
  origin: string;
  onOpen: () => void;
}

export function WebTile({ origin, onOpen }: WebTileProps) {
  const host = hostLabel(origin);

  return (
    <BaseButton
      aria-label={`Abrir ${host}`}
      className="flex h-full min-h-32 w-full min-w-0 flex-col items-start justify-between gap-4 rounded-[1.75rem] border-4 border-ink bg-paper p-5 text-left shadow-kite-sm transition hover:-translate-y-1 hover:bg-sky/40 active:translate-x-1 active:translate-y-1 active:shadow-none"
      onClick={onOpen}
      type="button"
    >
      <Globe aria-hidden="true" className="h-9 w-9" strokeWidth={2.1} />
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink-soft">Sitio web</span>
        <span className="line-clamp-2 block text-xl leading-tight font-black break-all">
          {host}
        </span>
      </span>
    </BaseButton>
  );
}
