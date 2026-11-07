import { useEffect } from 'react';
import { VirtualKeyboard } from '../components/VirtualKeyboard';

/**
 * Renderer root for the small always-on-top window that hosts the on-screen
 * keyboard over child web windows. It never shows Kite's home screen.
 */
export function KeyboardWindow() {
  useEffect(() => {
    let frame = 0;
    let timer = 0;

    const measure = () => {
      const keyboard = document.getElementById('kite-keyboard');

      if (!keyboard) {
        return;
      }

      const height = Math.ceil(keyboard.getBoundingClientRect().height);

      if (height > 0) {
        void window.api.keyboard.resize(height);
      }
    };

    frame = window.requestAnimationFrame(measure);
    // Re-measure once the web font is applied; the window then fits exactly.
    timer = window.setTimeout(measure, 400);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="h-full w-full overflow-hidden bg-paper">
      <VirtualKeyboard standalone />
    </div>
  );
}
