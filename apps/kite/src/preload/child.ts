import { ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import { isTextEntry } from '../shared/textEntry';

/**
 * Runs only inside child web windows. It never exposes an API to the page: it
 * just tells the main process when a text field gains or loses focus so Kite
 * can show its on-screen keyboard.
 */
let lastReported: boolean | null = null;

function reportFocus(force = false): void {
  const focused = isTextEntry(document.activeElement);

  // `force` is used when the page re-taps the field that already has focus:
  // no `focusin` fires, but the keyboard may have been hidden by **Ocultar**.
  if (focused === lastReported && !(force && focused)) {
    return;
  }

  lastReported = focused;
  ipcRenderer.send(IPC.childTextFocus, focused);
}

function scheduleReport(): void {
  // `focusout` runs before the next element receives focus, so wait one tick
  // and read `document.activeElement` instead of trusting the event target.
  window.setTimeout(reportFocus, 0);
}

document.addEventListener('focusin', scheduleReport, true);
document.addEventListener('focusout', scheduleReport, true);
document.addEventListener(
  'pointerdown',
  (event) => {
    if (event.target instanceof Element && isTextEntry(event.target)) {
      // Tapping an already focused field does not dispatch `focusin`.
      window.setTimeout(() => reportFocus(true), 0);
    }
  },
  true,
);
window.addEventListener('pageshow', scheduleReport);

// A navigation destroys the document without a reliable focusout.
window.addEventListener('pagehide', () => {
  if (lastReported) {
    lastReported = false;
    ipcRenderer.send(IPC.childTextFocus, false);
  }
});

// The keyboard overlays the bottom of the window, so bring the focused field
// above it instead of leaving the caret hidden behind the keys.
ipcRenderer.on(IPC.keyboardReveal, () => {
  const element = document.activeElement;

  if (!(element instanceof HTMLElement) || !isTextEntry(element)) {
    return;
  }

  const rect = element.getBoundingClientRect();

  if (rect.bottom > window.innerHeight * 0.6) {
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
});
