import { Popover } from '@base-ui/react/popover';
import type { ReactNode } from 'react';

const triggerClass =
  'flex min-h-14 items-center gap-2 rounded-full border-2 border-ink bg-paper px-4 py-2 text-base font-extrabold shadow-kite-sm transition hover:bg-marigold/40 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none data-[popup-open]:bg-marigold/60 data-[popup-open]:outline-none';

interface StatusPopoverProps {
  ariaLabel: string;
  icon: ReactNode;
  text: string;
  children: ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Small status button with a compact panel attached to it. */
export function StatusPopover({
  ariaLabel,
  icon,
  text,
  children,
  className = 'w-72',
  open,
  onOpenChange,
}: StatusPopoverProps) {
  return (
    <Popover.Root onOpenChange={onOpenChange} open={open}>
      <Popover.Trigger
        aria-label={ariaLabel}
        className={triggerClass}
        type="button"
      >
        {icon}
        <span className="max-w-36 truncate">{text}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" className="z-50" sideOffset={10}>
          <Popover.Popup
            className={`origin-top-right rounded-[1.5rem] border-4 border-ink bg-paper p-4 shadow-kite transition duration-150 outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 ${className}`}
            initialFocus={(openType) => openType === 'keyboard'}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
