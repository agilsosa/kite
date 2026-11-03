import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { CloseIcon } from './icons';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  modal?: boolean | 'trap-focus';
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  modal = true,
  className = '',
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-hidden p-4">
          <Dialog.Popup
            className={`relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border-4 border-ink bg-paper shadow-kite ${className}`.trim()}
          >
            <div className="shrink-0 border-b-2 border-ink/10 px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
              <Dialog.Title className="pr-12 text-3xl font-black tracking-tight sm:text-4xl">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 max-w-2xl text-base leading-relaxed text-ink-soft">
                {description}
              </Dialog.Description>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 [scrollbar-gutter:stable] sm:px-8">
              {children}
            </div>
            {footer ? (
              <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t-2 border-ink/10 px-6 py-4 sm:px-8">
                {footer}
              </div>
            ) : null}
            <Dialog.Close
              render={
                <Button
                  aria-label="Cerrar diálogo"
                  className="absolute top-3 right-3 z-10 h-12 w-12 rounded-full p-0!"
                  variant="ghost"
                />
              }
            >
              <CloseIcon className="h-6 w-6" />
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
