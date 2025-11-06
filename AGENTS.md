# Repository Guidelines

## Project Structure & Module Organization
- Entry: `src/main.tsx` (Vite) renders the devtools UI.
- Devtools core: `src/devtools/` (`bridge.ts`, `path.ts`) passes state/snapshots to the UI.
- Valtio plugin: `src/lib/insectorPlugin.ts` exposes `createDevtoolsPlugin()` and injects `globalThis.__VALTIO_DEVTOOLS_EDIT__` for in-place edits.
- UI: `src/views/` (e.g., `ValtioInspect.tsx`) and `src/components/` for reusable widgets.
- Shared: `src/utils/`, `src/types.ts`; Static: `public/`; HTML shell: `index.html`.

## Build, Test, and Development Commands
- Dev: `pnpm dev` (or `npm run dev`) — start Vite with HMR.
- Build: `pnpm build` — output to `dist/`.
- Preview: `pnpm preview` — serve the production build.
- Lint: `npx eslint .` — per `eslint.config.js`.
- Format: `pnpm dlx @biomejs/biome check --write .` — apply Biome rules.

## Coding Style & Naming Conventions
- Stack: TypeScript + React, ES modules.
- Formatting: Biome (tabs, width 100, double quotes, trailing commas, semicolons as needed).
- Linting: ESLint + React Hooks; avoid `any` in app code (Biome linter enforces `noExplicitAny`).
- Naming: components `PascalCase.tsx`; utilities and devtools modules `camelCase.ts` (e.g., `bridge.ts`).

## Testing Guidelines
- No runner configured yet. Prefer Vitest (+ jsdom) and React Testing Library when adding tests.
- Co-locate tests as `*.test.ts(x)` or under `src/__tests__/`.
- Unit-test `src/devtools/path.ts` (e.g., `root.todos[0].text` round-trips) and `bridge.ts` eventing; UI tests for critical flows only.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat(devtools): edit path support`, `fix(plugin): avoid null root`).
- PRs: include summary, linked issues (`Closes #123`), repro steps, and UI screenshots.
- Validation: run devtools locally; verify editing via `devtoolsBridge.edit("root.user.name", "Bob")` updates the UI/state.

## Architecture Notes
- Flow: Valtio proxies + `createDevtoolsPlugin()` → plugin hooks collect changes → `devtoolsBridge.ingestState/Snaps` → UI subscribes and renders.
- Edit API: path strings use `root.foo.bar` and array indices like `root.todos[0].done`.
