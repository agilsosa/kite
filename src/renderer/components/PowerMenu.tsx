import { Menu } from '@base-ui/react/menu';
import type { PowerAction } from '../../shared/types';
import { PowerIcon } from './icons';

const itemClass =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-base font-extrabold text-ink transition outline-none select-none data-[highlighted]:bg-marigold/60';

interface PowerMenuProps {
  onSelect: (action: PowerAction) => void;
}

export function PowerMenu({ onSelect }: PowerMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-haspopup="menu"
        aria-label="Opciones de energía"
        className="flex h-full w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-transparent text-ink transition hover:border-ink/20 hover:bg-coral/20 data-[popup-open]:border-ink/20 data-[popup-open]:bg-coral/20 data-[popup-open]:outline-none"
        title="Opciones de energía"
      >
        <PowerIcon className="h-4 w-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          align="end"
          className="z-50"
          side="top"
          sideOffset={10}
        >
          <Menu.Popup className="w-60 origin-bottom-right rounded-[1.5rem] border-4 border-ink bg-paper p-2 shadow-kite transition duration-150 outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Menu.Item
              className={itemClass}
              onClick={() => onSelect('restart')}
            >
              Reiniciar el equipo
            </Menu.Item>
            <Menu.Item
              className={itemClass}
              onClick={() => onSelect('shutdown')}
            >
              Apagar el equipo
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
