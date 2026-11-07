/**
 * Input types that never open a text keyboard. Shared by Kite's own renderer
 * and the child-window preload so both behave the same.
 */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isTextEntry(element: Element | null): boolean {
  if (element instanceof HTMLInputElement) {
    return (
      !NON_TEXT_INPUT_TYPES.has(element.type) &&
      !element.disabled &&
      !element.readOnly
    );
  }

  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  return element instanceof HTMLElement && element.isContentEditable;
}
