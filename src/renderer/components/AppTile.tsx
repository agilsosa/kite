import { Button as BaseButton } from '@base-ui/react/button';
import type { PublicApp } from '../../shared/types';
import { AppIcon } from './AppIcon';

const TILE_COLORS = [
  'bg-marigold',
  'bg-sky',
  'bg-leaf text-paper',
  'bg-berry text-paper',
  'bg-coral text-white',
  'bg-[#f6bd60]',
];

interface AppTileProps {
  app: PublicApp;
  index: number;
  onLaunch: () => void;
}

export function AppTile({ app, index, onLaunch }: AppTileProps) {
  return (
    <BaseButton
      aria-label={`Abrir ${app.name}`}
      className={`group flex h-full min-h-44 w-full min-w-0 flex-col items-center justify-center gap-3 rounded-[2rem] border-4 border-ink p-5 text-center shadow-kite transition hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#173f35] active:translate-x-1 active:translate-y-1 active:shadow-none ${TILE_COLORS[index % TILE_COLORS.length]}`}
      onClick={onLaunch}
      type="button"
    >
      <AppIcon className="h-16 w-16" icon={app.icon} strokeWidth={1.9} />
      <span className="line-clamp-2 max-w-full text-2xl leading-tight font-black break-words">
        {app.name}
      </span>
    </BaseButton>
  );
}
