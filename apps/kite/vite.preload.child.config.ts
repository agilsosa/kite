import { defineConfig } from 'vite';

// The child-window preload is separate from Kite's own preload: pages loaded
// in a child window must never see the `window.api` bridge.
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'child-preload.cjs',
      },
    },
  },
});
