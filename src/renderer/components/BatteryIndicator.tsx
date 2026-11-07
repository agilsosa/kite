import type { BatteryStatus } from '../../shared/types';
import {
  BatteryChargingIcon,
  BatteryFullIcon,
  BatteryLowIcon,
  BatteryMediumIcon,
  BatteryWarningIcon,
} from './icons';

interface BatteryIndicatorProps {
  status: BatteryStatus;
}

/**
 * Compact battery pill for the top bar. Renders nothing on machines without a
 * battery, such as most desktops.
 */
export function BatteryIndicator({ status }: BatteryIndicatorProps) {
  if (status.level === null) {
    return null;
  }

  const level = status.level;
  const low = !status.charging && level <= 20;
  const Icon = status.charging
    ? BatteryChargingIcon
    : level >= 80
      ? BatteryFullIcon
      : level >= 40
        ? BatteryMediumIcon
        : level >= 20
          ? BatteryLowIcon
          : BatteryWarningIcon;
  const state = status.charging
    ? 'cargando'
    : low
      ? 'batería baja'
      : 'descargando';

  return (
    <div
      aria-label={`Batería al ${level}%, ${state}`}
      className={`flex min-h-14 items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-base font-extrabold shadow-kite-sm ${
        low ? 'bg-coral/20' : status.charging ? 'bg-leaf/25' : 'bg-paper'
      }`}
      role="img"
    >
      <Icon className="h-6 w-6" />
      <span>{level}%</span>
    </div>
  );
}
