import { Popover } from '@base-ui/react/popover';
import { Slider } from '@base-ui/react/slider';
import { Switch } from '@base-ui/react/switch';
import { useEffect, useState } from 'react';
import type { VolumeState } from '../../shared/types';
import { VolumeIcon, VolumeMutedIcon } from './icons';
import { StatusPopover } from './StatusPopover';

interface VolumePopoverProps {
  volume: VolumeState;
  error: string | null;
  onOpen: () => void;
  onLevelCommit: (level: number) => void;
  onMutedChange: (muted: boolean) => void;
}

export function VolumePopover({
  volume,
  error,
  onOpen,
  onLevelCommit,
  onMutedChange,
}: VolumePopoverProps) {
  const [level, setLevel] = useState(volume.level);

  useEffect(() => {
    setLevel(volume.level);
  }, [volume.level]);

  const Icon = volume.muted ? VolumeMutedIcon : VolumeIcon;
  const max = Math.max(1, volume.cap);

  return (
    <StatusPopover
      ariaLabel={
        volume.muted
          ? 'El sonido está silenciado. Abrir los controles de sonido'
          : `El sonido está al ${volume.level} por ciento. Abrir los controles de sonido`
      }
      icon={<Icon className="h-6 w-6" />}
      onOpenChange={(open) => {
        if (open) {
          onOpen();
        }
      }}
      text={volume.muted ? 'Silenciado' : `${volume.level}%`}
    >
      <div className="flex items-center justify-between gap-3">
        <Popover.Title className="text-base font-black">Sonido</Popover.Title>
        <span className="rounded-full bg-marigold px-2.5 py-0.5 text-sm font-black">
          {level}%
        </span>
      </div>

      <Slider.Root
        className="mt-4 flex w-full flex-col"
        disabled={volume.cap === 0}
        max={max}
        min={0}
        onValueChange={setLevel}
        onValueCommitted={(value) => onLevelCommit(value)}
        step={1}
        value={level}
      >
        <Slider.Label className="sr-only">Volumen</Slider.Label>
        <Slider.Control className="flex h-8 w-full touch-none items-center">
          <Slider.Track className="relative h-2.5 w-full rounded-full bg-ink/15">
            <Slider.Indicator className="absolute h-full rounded-full bg-leaf" />
            <Slider.Thumb className="block h-6 w-6 rounded-full border-[3px] border-ink bg-paper shadow-kite-sm" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-white/60 px-3 py-2">
        <span className="text-sm font-extrabold">Silenciar</span>
        <Switch.Root
          aria-label="Silenciar el sonido"
          checked={volume.muted}
          className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-ink bg-paper transition data-[checked]:bg-coral"
          onCheckedChange={onMutedChange}
        >
          <Switch.Thumb className="block h-5 w-5 translate-x-1 rounded-full border-2 border-ink bg-marigold transition data-[checked]:translate-x-6 data-[checked]:bg-paper" />
        </Switch.Root>
      </div>

      {volume.cap < 100 ? (
        <p className="mt-2 text-xs font-bold text-ink-soft">
          Los adultos han limitado el volumen al {volume.cap}%.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-bold text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </StatusPopover>
  );
}
