# Kite app conventions

## UI

- Style all renderer UI with Tailwind CSS v4 utility classes.
- Keep `src/renderer/assets/index.css` limited to Tailwind imports, theme tokens, and base element styles.
- Prefer Base UI primitives from `@base-ui/react` for interactive components such as buttons, dialogs, menus, tabs, switches, and form controls.
- Wrap reusable Base UI primitives in `src/renderer/components/` and expose the project's Tailwind styling there.
- Presentational components with no Base UI equivalent may use semantic HTML elements.

## Packaging

- Electron Forge configuration lives in `forge.config.ts` and the Vite entry
  configs in this directory.
- Run `npm run package` or `npm run make` from this workspace, or use the root
  `kite:package` and `kite:make` aliases.
