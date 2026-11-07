import type {
  BatteryStatus,
  VolumeState,
  WifiStatus,
} from '../../shared/types';
import { BatteryIndicator } from './BatteryIndicator';
import { VolumePopover } from './VolumePopover';
import { WifiPopover } from './WifiPopover';

interface TopBarProps {
  battery: BatteryStatus;
  childName: string;
  volume: VolumeState;
  volumeError: string | null;
  wifi: WifiStatus;
  onRefreshVolume: () => void;
  onRefreshWifi: () => void;
  onSetVolume: (level: number) => void;
  onMute: (muted: boolean) => void;
}

export function TopBar({
  battery,
  childName,
  volume,
  volumeError,
  wifi,
  onRefreshVolume,
  onRefreshWifi,
  onSetVolume,
  onMute,
}: TopBarProps) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-lg font-bold text-ink-soft">Hola de nuevo</p>
        <h1 className="text-4xl leading-none font-black tracking-tight sm:text-6xl">
          ¡Hola, {childName}!
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <VolumePopover
          error={volumeError}
          onLevelCommit={onSetVolume}
          onMutedChange={onMute}
          onOpen={onRefreshVolume}
          volume={volume}
        />

        <WifiPopover onChanged={onRefreshWifi} status={wifi} />

        <BatteryIndicator status={battery} />
      </div>
    </header>
  );
}
