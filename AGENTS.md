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
| Frontend tests        | `just test` (runs `vitest run`) |
| Build                 | `just build`                    |

If a justfile recipe is missing for your scenario, add it — but request user review before committing.

## Quality Gates (order matters)

Code changes must pass all gates in sequence:

1. `just lint` — ESLint
2. `just format-check` — Prettier
3. `just test` — Vitest
4. `cargo check` — Rust type check
5. `cargo test` — Rust unit tests (run per-crate, see below)

Run auto-fix first (`just lint-fix`, `just format`) before manual fixes.

## Project Structure

```
src/                    # Vue frontend (TS)
src-tauri/              # Tauri shell — lib.rs + main.rs only
crates/                 # Reusable Rust libraries (currently empty, add here)
```

- `src/components/__tests__/` — Vitest test files
- `src-tauri/` must NOT contain tests — linking is too slow. Extract reusable logic into `crates/`.
- Tauri-dependent features that can't be extracted still go in `src-tauri` — user tests those manually.

## Rust Crates

- Each crate in `crates/` is independent with its own tests (e.g. `crates/log/tests/`)
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

| Directory       | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `abstracts/`    | Variables, mixins, functions (no CSS output)       |
| `base/`         | Reset, typography, global utilities                |
| `components/`   | Business component styles (Element Plus overrides) |
| `layout/`       | App shell: header, sidebar, panels                 |
| `themes/`       | Light/dark theme variable overrides                |
| `element-plus/` | Deep customization of Element Plus components      |

Entry point: `src/styles/main.scss` — the only file imported by the app.

Rules:

- Use modern SCSS syntax (no `@import`, use `@use`/`@forward`)
- Variable names must not conflict with Vue component props
- Create directories/files only when the feature requires them
- 使用tauri的时候必须基于`https://tauri.app/llms.txt`中的文档需要使用webfetch来获取文档

## Code Conventions

- Prettier: semi, single quotes, trailing comma es5, 100 width, LF, vue script/style indented
- ESLint: `_` prefix suppresses unused vars (`argsIgnorePattern: '^_'`), `vue/multi-word-component-names` off
- TS: strict mode, `noUnusedLocals`/`noUnusedParameters` enabled — prefix unused params with `_`
- Prefer `webfetch` for fetching external docs when investigating issues
