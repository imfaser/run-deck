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

1. `just lint` — ESLint (via rtk)
2. `just format-check` — Prettier (via rtk)
3. `just test` — Vitest (via rtk)
4. `just web-build` — Frontend build verification
5. `cargo check` — Rust type check
6. `cargo test` — Rust unit tests (via rtk, run per-crate, see below)

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

## UI 组件规范

**严禁自己造不必要组件，必须优先使用 Element Plus。**

检查流程：

1. 写 UI 前先查 [Element Plus 文档](https://element-plus.org/zh-CN/component/) 是否有对应组件
2. 有 → 直接用，不造轮子
3. 没有 → 说明具体理由再自建

Element Plus 常用组件速查：

| 场景        | 组件                                            |
| ----------- | ----------------------------------------------- |
| 选项卡/分段 | `el-segmented`, `el-tabs`                       |
| 弹窗        | `el-dialog`, `el-drawer`                        |
| 表单        | `el-form`, `el-input`, `el-select`, `el-switch` |
| 表格        | `el-table`                                      |
| 列表        | `el-list`, `el-empty`                           |
| 反馈        | `el-message`, `el-notification`, `elMessageBox` |
| 布局        | `el-container`, `el-aside`, `el-main`           |

## Element Plus 踩坑与经验

### 主题定制

**必须用 SCSS 变量编译时覆盖，纯 CSS 变量不够。**

1. 创建 `src/styles/element/index.scss`：

```scss
@forward 'element-plus/theme-chalk/src/common/var.scss' with (
  $colors: (
    'primary': (
      'base': #6366f1,
    ),
    'success': (
      'base': #22c55e,
    ),
    // ...
  )
);
```

2. `vite.config.ts` 配置：

```ts
css: {
  preprocessorOptions: {
    scss: {
      api: 'modern-compiler',
      additionalData: `@use "@/styles/element/index.scss" as *;`,
    },
  },
},
```

3. `unplugin-vue-components` resolver 加 `importStyle: 'sass'`：

```ts
ElementPlusResolver({ importStyle: 'sass' });
```

4. **改完必须重启 dev server**，SCSS 配置热更新不生效。

### 暗色模式 CSS 变量

在 `[data-theme='dark']` 中覆盖 Element Plus CSS 变量，关键变量名：

| 变量                      | 作用                               |
| ------------------------- | ---------------------------------- |
| `--el-bg-color`           | 主背景                             |
| `--el-bg-color-page`      | 页面背景                           |
| `--el-bg-color-overlay`   | 弹出层（select 下拉、popper）背景  |
| `--el-fill-color-blank`   | 输入框/空白背景                    |
| `--el-fill-color-light`   | hover 背景                         |
| `--el-fill-color-lighter` | 表格斑马纹行背景                   |
| `--el-text-color-primary` | 主文字                             |
| `--el-text-color-regular` | 常规文字                           |
| `--el-border-color`       | 边框                               |
| `--el-card-bg-color`      | 卡片背景                           |
| `--el-table-*`            | 表格系列（bg/header/hover/border） |

**常见坑：**

- select/dropdown/popper 渲染在 `<body>` 上，用 `--el-bg-color-overlay` 不是 `--el-bg-color`
- 表格斑马纹用 `--el-fill-color-lighter`，不是 `--el-table-tr-bg-color`

### 布局组件

用 `el-container` / `el-aside` / `el-main` 做侧边栏+内容区布局：

- `el-aside` 默认 `overflow: auto`（需设 height）
- `el-main` 默认 `overflow: auto`
- 两侧各自独立滚动，互不干扰

不要手写 `position: fixed` + `margin-left`，维护成本高且容易出 bug。

### 按需导入

项目用 `unplugin-vue-components` + `ElementPlusResolver` 自动导入。新增组件直接在模板中使用 `<el-xxx>`，无需手动 import。JS API（如 `ElMessage`、`ElMessageBox`）需手动 import：

```ts
import { ElMessage, ElMessageBox } from 'element-plus';
```
