import { Button as BaseButton } from '@base-ui/react/button';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { KeyboardInput } from '../../shared/types';
import { useVirtualKeyboardActive } from '../hooks/useVirtualKeyboardActive';
import { ArrowUp } from 'lucide-react';
import { BackspaceIcon } from './icons';

const LETTER_ROWS = [
  '1234567890',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
] as const;
const SYMBOL_ROW = ['-', '_', '.', '@', "'", '!', '?', '/'] as const;

interface KeyboardKeyProps {
  children: ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
  wide?: boolean;
}

function KeyboardKey({
  children,
  label,
  onPress,
  active = false,
  wide = false,
}: KeyboardKeyProps) {
  return (
    <BaseButton
      aria-label={label}
      aria-pressed={active || undefined}
      className={`flex h-12 min-w-0 items-center justify-center rounded-xl border-2 border-ink px-2 text-lg font-black shadow-[2px_2px_0_0_#173f35] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${wide ? 'flex-[2]' : 'flex-1'} ${active ? 'bg-marigold' : 'bg-paper hover:bg-sky/50'}`}
      onClick={onPress}
      onPointerDown={(event) => event.preventDefault()}
      type="button"
    >
      {children}
    </BaseButton>
  );
}

export function VirtualKeyboard() {
  const active = useVirtualKeyboardActive();
  const [shift, setShift] = useState(false);

  useEffect(() => {
    if (!active) {
      setShift(false);
    }
  }, [active]);

  if (!active) {
    return null;
  }

  const send = (input: KeyboardInput) => {
    void window.api.keyboard.send(input);
  };

  const sendCharacter = (character: string) => {
    send({ key: shift ? character.toUpperCase() : character, kind: 'char' });

    if (shift) {
      setShift(false);
    }
  };

  const sendSpecial = (key: string) => {
    send({ key, kind: 'key' });
  };

  return (
    <div
      aria-label="Teclado en pantalla"
      className="fixed inset-x-0 bottom-0 z-[100] mx-auto flex w-full max-w-5xl flex-col gap-2 border-4 border-ink bg-paper/95 p-3 shadow-[0_-6px_0_0_#173f35] backdrop-blur-sm"
      role="group"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-extrabold text-ink-soft">Teclado</p>
        <BaseButton
          className="rounded-full border-2 border-ink bg-paper px-3 py-1 text-sm font-extrabold shadow-[2px_2px_0_0_#173f35]"
          onClick={() => {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
          }}
          onPointerDown={(event) => event.preventDefault()}
          type="button"
        >
          Ocultar
        </BaseButton>
      </div>

      {LETTER_ROWS.map((row, rowIndex) => (
        <div className="flex gap-1.5" key={row}>
          {rowIndex === 3 ? (
            <KeyboardKey
              active={shift}
              label="Mayúsculas"
              onPress={() => setShift((value) => !value)}
            >
              <ArrowUp
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2.6}
              />
            </KeyboardKey>
          ) : null}
          {Array.from(row).map((character) => (
            <KeyboardKey
              key={character}
              label={character}
              onPress={() => sendCharacter(character)}
            >
              {shift ? character.toUpperCase() : character}
            </KeyboardKey>
          ))}
          {rowIndex === 3 ? (
            <KeyboardKey
              label="Borrar"
              onPress={() => sendSpecial('Backspace')}
            >
              <BackspaceIcon className="h-6 w-6" />
            </KeyboardKey>
          ) : null}
        </div>
      ))}

      <div className="flex gap-1.5">
        {SYMBOL_ROW.map((character) => (
          <KeyboardKey
            key={character}
            label={character}
            onPress={() => sendCharacter(character)}
          >
            {character}
          </KeyboardKey>
        ))}
      </div>

      <div className="flex gap-1.5">
        <KeyboardKey label="Espacio" onPress={() => sendCharacter(' ')} wide>
          Espacio
        </KeyboardKey>
        <KeyboardKey label="Intro" onPress={() => sendSpecial('Enter')} wide>
          Intro
        </KeyboardKey>
      </div>
    </div>
  );
}
