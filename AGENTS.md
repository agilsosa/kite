# Kite project conventions

## UI

- Style all renderer UI with Tailwind CSS v4 utility classes.
- Keep `src/renderer/assets/index.css` limited to Tailwind imports, theme tokens, and base element styles.
- Prefer Base UI primitives from `@base-ui/react` for interactive components such as buttons, dialogs, menus, tabs, switches, and form controls.
- Wrap reusable Base UI primitives in `src/renderer/components/` and expose the project's Tailwind styling there.
- Presentational components with no Base UI equivalent may use semantic HTML elements.
