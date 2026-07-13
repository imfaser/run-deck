# AGENTS.md

## Project Overview

Tauri 2 desktop app. Frontend: Vue 3 + Pinia + Vue Router + Sass + Element Plus. Backend: Rust (edition 2024).

## Commands (justfile)

All dev commands live in `justfile`. **NEVER run `just dev` / `just dev-trace` / `just web-dev`** — they block the terminal.

| Task                  | Command                         |
| --------------------- | ------------------------------- |
| Lint (ESLint)         | `just lint`                     |
| Auto-fix lint         | `just lint-fix`                 |
| Format (Prettier)     | `just format`                   |
| Format check          | `just format-check`             |
| Typecheck (TS + Rust) | `just typecheck`                |
| Frontend build        | `just web-build`                |
| Frontend tests        | `just test` (runs `vitest run`) |
| Rust tests            | `just test-rust`                |
| All tests             | `just test-all`                 |
| Build                 | `just build`                    |

If a justfile recipe is missing for your scenario, add it — but request user review before committing.

## Quality Gates (order matters)

Code changes must pass all gates in sequence:

1. `just lint` — ESLint
2. `just format-check` — Prettier
3. `just test` — Vitest
4. `just web-build` — Frontend build verification
5. `cargo check` — Rust type check
6. `cargo test` — Rust unit tests (run per-crate, see below)

Run auto-fix first (`just lint-fix`, `just format`) before manual fixes.

## Project Structure

```
src/                    # Vue frontend (TS)
src-tauri/              # Tauri shell — lib.rs + main.rs only
crates/                 # Reusable Rust libraries
```

- `src/components/__tests__/` — Vitest test files
- `src-tauri/` must NOT contain tests — linking is too slow. Extract reusable logic into `crates/`.
- Tauri-dependent features that can't be extracted still go in `src-tauri` — user tests those manually.

## Rust Crates

- Each crate in `crates/` is independent with its own tests (e.g. `crates/mcp/tests/`)
- Run tests per-crate: `cargo test -p <crate-name>`
- Workspace root `Cargo.toml` defines shared deps (`serde`, `serde_json`) and clippy lints
- `src-tauri` depends on workspace crates via `path = "../crates/<name>"`

## Frontend Testing

- Vitest config: `vitest.config.ts`
- Environment: jsdom, globals enabled (no need to import `describe`/`it`/`expect`)
- Path alias: `@` → `src/`
- Tauri API must be mocked in tests — see https://tauri.app/zh-cn/develop/tests/mocking/
- `<tauri-*>` custom elements are whitelisted in vue template compiler

## SCSS Style Guide

Follow this directory structure under `src/styles/` (create on demand, not eagerly):

- `abstracts/` — variables, functions, mixins, placeholders
- `base/` — reset, typography, animations
- `components/` — component-level styles
- `layout/` — grid, header, footer
- `pages/` — page-level styles (minimal)
- `themes/` — light/dark theme management
- `vendors/` — third-party overrides

Entry point: `src/styles/main.scss` — the only file imported by the app.

Rules:

- Use modern SCSS syntax (no `@import`, use `@use`/`@forward`)
- Variable names must not conflict with Vue component props
- Create directories/files only when the feature requires them

## Tauri-Specific

- When working with Tauri APIs, fetch docs from `https://tauri.app/llms.txt` using webfetch
- Vue Router uses file-based routing — see vue-router-skilld for latest patterns
- Vite dev server runs on port 6917 (`vite.config.ts`)

## Code Conventions

- Prettier: semi, single quotes, trailing comma es5, 100 width, LF, vue script/style indented
- ESLint: `_` prefix suppresses unused vars (`argsIgnorePattern: '^_'`), `vue/multi-word-component-names` off
- TS: strict mode, `noUnusedLocals`/`noUnusedParameters` enabled — prefix unused params with `_`
