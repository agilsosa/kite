import {
  BookOpen,
  Bot,
  Camera,
  Cat,
  Compass,
  Film,
  FlaskConical,
  FolderOpen,
  Gamepad2,
  Globe,
  Music,
  Palette,
  Puzzle,
  Rocket,
  Shapes,
  Sparkles,
  Star,
  Trophy,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { normalizeAppIcon } from '../../shared/appIcons';
import type { AppIconKey } from '../../shared/appIcons';

const ICONS: Record<AppIconKey, LucideIcon> = {
  puzzle: Puzzle,
  gamepad: Gamepad2,
  book: BookOpen,
  palette: Palette,
  music: Music,
  film: Film,
  camera: Camera,
  flask: FlaskConical,
  globe: Globe,
  rocket: Rocket,
  cat: Cat,
  bot: Bot,
  trophy: Trophy,
  wrench: Wrench,
  star: Star,
  shapes: Shapes,
  sparkles: Sparkles,
  compass: Compass,
  folder: FolderOpen,
};

interface AppIconProps {
  icon: string;
  className?: string;
  strokeWidth?: number;
}

/** Renders a configured app icon, including icons saved as legacy emoji. */
export function AppIcon({
  icon,
  className = 'h-6 w-6',
  strokeWidth = 2.2,
}: AppIconProps) {
  const Icon = ICONS[normalizeAppIcon(icon)];

  return (
    <Icon aria-hidden="true" className={className} strokeWidth={strokeWidth} />
  );
}
