import type { WebContents } from 'electron';
import type { KeyboardInput } from '../shared/types';

const SPECIAL_KEYS = new Set([
  'Backspace',
  'Enter',
  'Tab',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
]);

export function sendKeyboardInput(
  contents: WebContents,
  input: KeyboardInput,
): void {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Entrada de teclado no válida');
  }

  if (input.kind === 'char') {
    const characters = Array.from(input.key);

    if (characters.length !== 1 || /[\r\n]/.test(input.key)) {
      throw new Error('Carácter no válido');
    }

    contents.sendInputEvent({ type: 'char', keyCode: input.key });
    return;
  }

  if (!SPECIAL_KEYS.has(input.key)) {
    throw new Error('Tecla no válida');
  }

  contents.sendInputEvent({ type: 'keyDown', keyCode: input.key });
  contents.sendInputEvent({ type: 'keyUp', keyCode: input.key });
}
