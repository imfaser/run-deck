# AGENTS.md

## 项目概览

Tauri 2 桌面应用。前端：React 19 + Zustand + TanStack Router + Tailwind CSS + shadcn/ui。后端：Rust (edition 2024)。

## 包管理器

项目使用 **pnpm** 作为包管理器。

```bash
pnpm install              # 安装依赖
pnpm add <package>        # 添加依赖
pnpm add -D <package>     # 添加开发依赖
```

## 开发命令（justfile）

所有开发命令在 `justfile` 中定义。**禁止运行 `just dev` / `just dev-trace` / `just web-dev`** — 会阻塞终端。

| 任务                | 命令                             |
| ------------------- | -------------------------------- |
| 代码检查（oxlint）  | `just lint`                      |
| 自动修复            | `just lint-fix`                  |
| 格式化（oxfmt）     | `just format`                    |
| 格式检查            | `just format-check`              |
| 类型检查（TS+Rust） | `just typecheck`                 |
| 前端构建            | `just web-build`                 |
| 前端测试            | `just test`（运行 `vitest run`） |
| Rust 测试           | `just test-rust`                 |
| 全部测试            | `just test-all`                  |
| 构建                | `just build`                     |

如果 justfile 缺少需要的 recipe，可以添加 — 但提交前需用户确认。

## 质量门禁（顺序不可变）

代码变更必须按顺序通过所有门禁：

1. `just lint` — oxlint
2. `just format-check` — oxfmt
3. `just test` — Vitest
4. `just web-build` — 前端构建验证
5. `cargo check` — Rust 类型检查
6. `cargo test` — Rust 单元测试

先运行自动修复（`just lint-fix`、`just format`），再手动修复。

## 项目结构

```
src/
├── components/         # 组件
│   └── ui/            # shadcn/ui 组件
├── constants/          # 常量（labels.ts 等）
├── hooks/             # React hooks
├── lib/               # 工具函数
├── routes/            # TanStack Router 路由文件
├── store/             # Zustand stores
├── services/          # 服务层
├── schemas/           # Zod schemas
├── db/                # 数据库
├── router.tsx         # 路由实例 + 类型注册
└── routeTree.gen.ts   # 自动生成，勿手动编辑
src-tauri/              # Tauri 外壳 — 仅 lib.rs + main.rs
crates/                 # 可复用 Rust 库
```

- `src/routes/__tests__/` — Vitest 测试文件
- `src-tauri/` 禁止包含测试 — 链接太慢。可复用逻辑提取到 `crates/`

## TanStack Router 路由约定

使用文件路由，路由文件在 `src/routes/`。Vite 插件自动生成 `routeTree.gen.ts`。

### 文件命名规则

| 文件名              | 路由路径         | 说明                       |
| ------------------- | ---------------- | -------------------------- |
| `__root.tsx`        | —                | 根路由，包裹所有子路由     |
| `index.tsx`         | `/`              | 首页                       |
| `overview.tsx`      | `/overview`      | 基础路由                   |
| `posts.$postId.tsx` | `/posts/$postId` | 动态参数                   |
| `_layout.tsx`       | —                | 无路径布局路由（前缀 `_`） |
| `-component.tsx`    | —                | 排除自动生成（前缀 `-`）   |

### 添加新路由

1. 在 `src/routes/` 创建文件，导出 `Route`：

```tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/new-route')({
  component: NewRouteComponent,
});

function NewRouteComponent() {
  return <div>New Page</div>;
}
```

2. Vite 自动更新 `routeTree.gen.ts`
3. 使用 `useNavigate({ to: '/new-route' })` 导航

### 关键 API

```tsx
import { useNavigate, useLocation, Link, Outlet } from '@tanstack/react-router';
import { createFileRoute, createRootRoute } from '@tanstack/react-router';
```

## Rust 工作区

- `crates/` 中每个 crate 独立，有自己的测试（如 `crates/mcp/tests/`）
- 按 crate 运行测试：`cargo test -p <crate-name>`
- 根 `Cargo.toml` 定义共享依赖和 clippy 规则
- `src-tauri` 通过 `path = "../crates/<name>"` 依赖工作区 crate

### Rust 错误处理

Tauri command 返回 `CmdResult<T>` = `Result<T, String>`。使用 `StringifyErr` trait 统一转换：

```rust
use super::{CmdResult, StringifyErr};

// ✓ 正确：使用 stringify_err()
let value = some_operation().stringify_err()?;

// ✗ 错误：不要用 map_err
let value = some_operation().map_err(|e| e.to_string())?;

// ✓ 需要额外上下文时用 map_err + format!
let value = some_operation().map_err(|e| format!("操作失败: {e}"))?;
```

### 全局状态管理

通过 `AppContext` 统一访问全局变量：

```rust
AppContext::app_handle()    → APP_HANDLE (手动 OnceLock)
AppContext::mcp_manager()   → MCP_MANAGER (手动 OnceLock)
AppContext::content_cache() → ContentCache::global() (singleton! 宏)
AppContext::config()        → Config::global() (OnceLock)
AppContext::global()        → is_exiting 状态 (singleton! 宏)
```

## 前端测试

- Vitest 配置：`vitest.config.ts`
- 环境：jsdom，globals 启用（无需 import `describe`/`it`/`expect`）
- 路径别名：`@` → `src/`
- 测试中必须 mock Tauri API — 见 https://tauri.app/zh-cn/develop/tests/mocking/

## 工具库速查

| 库                | 用途         | 关键点                                                         |
| ----------------- | ------------ | -------------------------------------------------------------- |
| `ts-pattern`      | 控制流       | `match(value).with(...).otherwise(...)`                        |
| `es-toolkit`      | 数据转换     | 替代 lodash，按需导入                                          |
| `zod`             | 运行时验证   | `z.infer<typeof Schema>` 生成类型                              |
| `ahooks`          | React hooks  | `useMemoizedFn`/`useLockFn`/`useMount` 优先                    |
| `foxact`          | 轻量全局状态 | `createContextState` 管理原子状态                              |
| `swr`             | 数据缓存     | `useSWR(key, fetcher)` + `mutate(key)` 刷新                    |
| `react-hook-form` | 表单         | `zodResolver` + `useForm`；渲染期用 `useWatch`，禁止 `watch()` |
| `@xstate/react`   | 状态机       | `useMachine` 复杂多步流程                                      |
| `react-konva`     | Canvas       | 标注工具 2D 渲染                                               |
| `nanoid`          | ID 生成      | `nanoid()` 唯一标识                                            |
| `dayjs`           | 日期         | 日期处理                                                       |
| `dexie`           | IndexedDB    | 本地数据库封装                                                 |
| `echarts`         | 图表         | 数据可视化                                                     |
| `rxjs`            | 响应式       | 异步流处理                                                     |
| `mitt`            | 事件         | 轻量事件发射器                                                 |

### ahooks 核心原则

- `useMemoizedFn` 替代 `useCallback` — 不需要依赖数组
- `useMount` 替代 `useEffect + []` — 语义更清晰
- `useImmer` 替代嵌套展开 — `draft.xxx = yyy`
- `useLockFn` 防并发 — 按钮点击/表单提交触发 async 操作时必用
- `useDebounceFn` / `useThrottleFn` — 替代 setTimeout

> **React Compiler 兜底 memo**：项目启用 React Compiler，自动处理 `useMemo`/`useCallback` 优化，**禁止手动添加**。但 `useLockFn` 不是 memo，Compiler 不会处理 — 忘了就裸奔。

### React Compiler 兼容性（react-hook-form）

`useForm()` 返回的 `.watch()` 被编译器内置注册表（`babel-plugin-react-compiler` 的 `defaultModuleTypeProvider`）标记为 known-incompatible。渲染期调用 `form.watch(...)` 会让编译器**跳过整个文件**，build 日志出现 `Skipped: <file> Use of incompatible library`，该文件失去自动 memo。

```tsx
// ✗ 错误：渲染期调用 watch() → 编译器跳过整个文件
<Switch checked={form.watch('enabled')} ... />

// ✓ 正确：useWatch hook 订阅（不在不兼容注册表，编译器正常 memo）
const enabled = useWatch({ control: form.control, name: 'enabled' });
<Switch checked={enabled} ... />
```

- **升级 react-hook-form 无法消除 bailout**（注册表在编译器侧），必须换 `useWatch`
- `formState` 是 Proxy，渲染期读取**先解构**（`const { errors } = form.formState`），避免短路表达式导致订阅缺失
- `getValues()` 只用于事件回调/effect，禁止作为渲染期响应式输入
- 相关讨论：react-hook-form 官方 Discussion #12524

### es-toolkit / ts-pattern 类型坑

- `omit(obj, [key])` 在 `Record<string, X>` 上会丢失索引签名，返回类型坍缩为 `{}`，再索引赋值会报错 → 显式注解：`const newMcp: Record<string, X> = omit(config.mcp, [name])`
- `fromPairs` 只在 `es-toolkit/compat` 子路径，主入口 `es-toolkit` 不含（`compact`/`omit` 在主入口）
- ts-pattern selector 返回的字面量会拓宽为 `string` → 窄联合类型赋值需 `as const`：`.with('Running', () => 'default' as const)`
- ts-pattern `P.string` 回调参数类型是 `string` 而非字面量联合 → 需显式枚举：`.with('Starting', 'Running', 'Stopped', (s) => s)`

## 代码模式

### React Hooks 约定

- 命名：`use<PascalCase>.ts`
- 跨 store 复用：`.shared.ts` 后缀
- 依赖注入：函数参数传入，不用 Context
- Options 接口：同文件定义

### Zustand Store

```ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// 简单状态
export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));

// 复杂嵌套用 immer
export const useAppStore = create<AppState>()(
  immer((set) => ({
    items: [],
    addItem: (item) =>
      set((state) => {
        state.items.push(item);
      }),
  }))
);
```

### 错误处理

```ts
try {
  await doSomething();
} catch (e) {
  await logMessage('error', `[模块] 操作失败: ${e}`);
  const msg = e instanceof Error ? e.message : String(e);
  return undefined;
}
```

### 类型定义

Zod schema 定义类型，服务边界运行时验证：

```ts
export const AnnotationSchema = z.object({ ... });
export type Annotation = z.infer<typeof AnnotationSchema>;

// 服务中验证
const data = await invoke<unknown>('get_annotations');
return AnnotationSchema.array().parse(data);
```

### 中文字符串管理

所有中文字符串集中管理在 `src/constants/labels.ts`，禁止在组件中硬编码中文。

```ts
// src/constants/labels.ts
export const LABELS = {
  nav: { overview: '导航', config: '配置' },
  mcpServer: { name: '名称', enabled: '启用' },
  mcpForm: {
    added: (name: string) => `已添加服务器「${name}」`,
  },
  common: { save: '保存', cancel: '取消' },
  validation: { nameRequired: '名称不能为空' },
} as const;

// 组件中使用
import { LABELS } from '@/constants/labels';
<h1>{LABELS.nav.overview}</h1>
toast.success(LABELS.mcpForm.added(name));
```

- 静态字符串：`LABELS.nav.overview`
- 动态文案：用函数 `LABELS.mcpForm.added(name)`
- Zod 验证消息：`z.string().min(1, LABELS.validation.nameRequired)`
- 测试断言：`expect(() => schema.parse(...)).toThrow(LABELS.validation.xxx)`

## React 组件规范

### 文件顺序

```tsx
// 1. 导入（第三方 → 内部）
import { useState } from 'react';
import { useCounterStore } from '@/store/counter';
import { Button } from '@/components/ui/button';

// 2. Props 类型
interface MyComponentProps {
  visible: boolean;
}

// 3. 组件
export default function MyComponent({ visible }: MyComponentProps) {
  // 4. Store
  const count = useCounterStore((s) => s.count);
  // 5. 状态
  const [isLoading, setIsLoading] = useState(false);
  // 6. 副作用
  // 7. 事件处理
  // 8. 渲染
  return <div>...</div>;
}
```

### 组件拆分

- **不复用时不要创建新文件**，在同文件内拆分为内部函数组件
- Props vs Store：可复用展示组件用 Props，sibling 共享状态用 Store

## 样式指南

- 使用 Tailwind CSS 4 工具类
- 用 `cn()` 合并类名（`@/lib/utils`），禁止模板字符串三元
- 用 `cva()` 定义组件变体（如 Button variant），不要手写 if/switch
- 语义色：`bg-primary`、`text-muted-foreground`，禁止 `bg-blue-500`
- 用 `gap-*` 替代 `space-*`，`size-*` 替代 `w-* h-*`
- 用 `truncate` 替代 `overflow-hidden text-ellipsis`

### cn / cva 使用原则

```tsx
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// cn: 合并类名，处理冲突
<div className={cn('base-class', isActive && 'active-class', className)} />;

// cva: 定义组件变体
const buttonVariants = cva('inline-flex items-center justify-center', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      outline: 'border border-input bg-transparent',
    },
    size: {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-sm',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

// 使用
<button className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), className)} />;
```

- **必要时使用**：组件有 2+ 变体组合 → 用 cva；简单条件类 → 用 cn 即可
- **禁止**：手动拼接模板字符串做条件判断

## UI 组件规范

**严禁自己造不必要组件，必须优先使用 shadcn/ui。**

shadcn/ui 组件位于 `src/components/ui/`：

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
```

### 关键规则

- **Items 必须在 Group 内**：`SelectItem` → `SelectGroup`
- **Dialog/Sheet/Drawer 必须有 Title**
- **Button 无 isPending**：用 `Spinner` + `data-icon` + `disabled`
- **Button 内图标用 data-icon**：`data-icon="inline-start"`
- **用 cn() 合并类名**：禁止模板字符串三元

## Skills 指引

项目中 `.opencode/skills/` 下有大量技能参考。使用 opencode 时可通过 `/skill <name>` 加载。

| 场景            | Skill                            | 用途                          |
| --------------- | -------------------------------- | ----------------------------- |
| 代码质量        | `clean-code`                     | SRP/DRY/KISS/YAGNI 原则       |
| React 组件      | `composition-patterns`           | 复合组件、render props        |
| React 性能      | `vercel-react-best-practices`    | 消除 waterfall、bundle 优化   |
| TanStack Router | `tanstack-router-best-practices` | 文件路由、类型安全、数据加载  |
| React 动画      | `react-view-transitions`         | View Transition API           |
| Zustand         | `zustand`                        | stores、selectors、middleware |
| XState          | `xstate`                         | 状态机，复杂多步流程          |
| Zod             | `zod`                            | 运行时验证、transforms        |
| TypeScript      | `typescript-coder`               | 泛型、条件类型、配置          |
| Tailwind        | `tailwindcss`                    | v4 工具类、响应式、暗色模式   |
| Vite            | `vite`                           | 配置、插件 API、SSR           |
| Vitest          | `vitest`                         | 测试 API、mock、覆盖率        |
| shadcn          | `shadcn`                         | 组件规则：样式、组合、变体    |
| UI 审查         | `web-design-guidelines`          | Web Interface Guidelines      |
| pnpm            | `pnpm`                           | 命令、配置、工作区            |
