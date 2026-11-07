import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  Delete,
  Lock,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { ComponentProps } from 'react';

type LucideComponent = typeof ArrowLeft;
type IconProps = ComponentProps<LucideComponent>;

/** Project-wide defaults for the small functional icons in Kite. */
function styled(Icon: LucideComponent) {
  function KiteIcon(props: IconProps) {
    return <Icon aria-hidden="true" strokeWidth={2.4} {...props} />;
  }

  return KiteIcon;
}

export const VolumeIcon = styled(Volume2);
export const VolumeMutedIcon = styled(VolumeX);
export const WifiIcon = styled(Wifi);
export const WifiOffIcon = styled(WifiOff);
export const LockIcon = styled(Lock);
export const BackspaceIcon = styled(Delete);
export const ArrowLeftIcon = styled(ArrowLeft);
export const ArrowRightIcon = styled(ArrowRight);
export const PlusIcon = styled(Plus);
export const TrashIcon = styled(Trash2);
export const RefreshIcon = styled(RefreshCw);
export const CloseIcon = styled(X);
export const PowerIcon = styled(Power);
export const BatteryChargingIcon = styled(BatteryCharging);
export const BatteryFullIcon = styled(BatteryFull);
export const BatteryMediumIcon = styled(BatteryMedium);
export const BatteryLowIcon = styled(BatteryLow);
export const BatteryWarningIcon = styled(BatteryWarning);
