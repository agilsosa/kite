import { useEffect, useState } from 'react';

function isTextEntry(element: Element | null): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

export function useVirtualKeyboardActive(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const update = () => {
      setActive(isTextEntry(document.activeElement));
    };
    const handleFocusOut = () => {
      window.setTimeout(update, 0);
    };

    document.addEventListener('focusin', update);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return active;
}
