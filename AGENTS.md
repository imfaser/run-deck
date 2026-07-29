# AGENTS.md

## 项目概览

Tauri 2 桌面应用。前端：React 19 + Zustand + React Router + Tailwind CSS + shadcn/ui。后端：Rust (edition 2024)。

## 包管理器

项目使用 **pnpm** 作为包管理器。

```bash
# 安装依赖
pnpm install

# 添加依赖
pnpm add <package>

# 添加开发依赖
pnpm add -D <package>
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
src/                    # React 前端（TSX）
├── components/         # 组件
│   └── ui/            # shadcn/ui 组件
├── hooks/             # React hooks
├── lib/               # 工具函数
├── pages/             # 页面组件
├── routes/            # 路由布局
├── store/             # Zustand stores
├── services/          # 服务层
├── schemas/           # Zod schemas
└── db/                # 数据库
src-tauri/              # Tauri 外壳 — 仅 lib.rs + main.rs
crates/                 # 可复用 Rust 库
```

- `src/components/__tests__/` — Vitest 测试文件
- `src-tauri/` 禁止包含测试 — 链接太慢。可复用逻辑提取到 `crates/`
- 无法提取的 Tauri 依赖功能仍放 `src-tauri` — 由用户手动测试

## Rust 工作区

- `crates/` 中每个 crate 独立，有自己的测试（如 `crates/mcp/tests/`）
- 按 crate 运行测试：`cargo test -p <crate-name>`
- 根 `Cargo.toml` 定义共享依赖（`serde`、`serde_json`）和 clippy 规则
- `src-tauri` 通过 `path = "../crates/<name>"` 依赖工作区 crate

## 前端测试

- Vitest 配置：`vitest.config.ts`
- 环境：jsdom，globals 启用（无需 import `describe`/`it`/`expect`）
- 路径别名：`@` → `src/`
- 测试中必须 mock Tauri API — 见 https://tauri.app/zh-cn/develop/tests/mocking/

## 工具库规范

### ts-pattern（控制流）

项目中使用，替代 `if/else` 链和 `switch` 语句。

**导入：**

```ts
import { match, P } from 'ts-pattern';
```

**枚举/状态分支（最常用）：**

```ts
cursorStyle = match(state.value)
  .with('panning', () => 'grabbing')
  .with('spaceHeld', () => 'grab')
  .otherwise(() => 'default');
```

**对象解构 + P.select()：**

```ts
match(input)
  .with({ image: P.select('image'), stage: P.select('stage') },
    ({ image, stage }) => ({ ... }))
  .otherwise(() => input as CanvasDimensions);
```

**正则匹配：**

```ts
match(color)
  .with(P.string.regex(/^#?([a-f\d]{6})$/i), (hex) => ...)
  .with(P.string.regex(/rgba?\(\s*(\d+)/), (rgba) => ...)
  .otherwise(() => ({ r: 0, g: 150, b: 255 }));
```

**守卫函数：**

```ts
match(true)
  .with(
    P.when(() => date.isSame(now, 'day')),
    () => '今天'
  )
  .with(
    P.when(() => date.isSame(yesterday, 'day')),
    () => '昨天'
  )
  .otherwise(() => date.format('MM-DD'));
```

**非空检查：**

```ts
match(refs)
  .with(P.nonNullable, (r) => { ... })
  .otherwise(() => null);
```

### es-toolkit（数据转换）

替代 lodash，按需 tree-shake 导入单个函数。**禁止使用 lodash/lodash-es。**

```ts
import { clamp, cloneDeep } from 'es-toolkit';
```

### zod（运行时类型验证）

定义 schema → `z.infer` 生成类型 → 运行时验证。

```ts
// src/schemas/config.ts
export const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

// 服务边界验证
const data = await invoke<unknown>('get_config');
return ConfigSchema.parse(data); // 运行时校验
```

### 其他依赖

| 库        | 用途           |
| --------- | -------------- |
| `zod`     | 运行时类型验证 |
| `dayjs`   | 日期处理       |
| `dexie`   | IndexedDB 封装 |
| `echarts` | 图表库         |
| `rxjs`    | 响应式编程     |
| `mitt`    | 事件发射器     |

### ahooks（React hooks 工具箱）

替代 `@vueuse/core`，提供大量实用 hooks。**优先使用 ahooks，不要手写可复用逻辑。**

**核心 hooks：**

```ts
// 生命周期
import { useMount, useUnmount, useLatest } from 'ahooks';

// 稳定函数引用（替代 useCallback）
import { useMemoizedFn } from 'ahooks';
const handleClick = useMemoizedFn((id: string) => { ... });

// 本地存储
import { useLocalStorageState } from 'ahooks';
const [value, setValue] = useLocalStorageState('key', { defaultValue: 'dark' });

// Immer 状态（复杂嵌套对象必用）
import { useImmer } from 'use-immer';
const [state, setState] = useImmer({ nested: { count: 0 } });
setState(draft => { draft.nested.count += 1; });

// 防重复点击（Tauri invoke 必备）
import { useLockFn } from 'ahooks';
const handleSave = useLockFn(async () => {
  await invoke('save_config', { data });
});

// 防抖
import { useDebounceFn } from 'ahooks';
const { run } = useDebounceFn(handleSearch, { wait: 300 });

// 键盘监听
import { useKeyPress } from 'ahooks';
useKeyPress('ctrl+s', handleSave);

// 元素可见性
import { useInViewport } from 'ahooks';
const [inViewport] = useInViewport(ref);

// 剪贴板
import { useClipboard } from 'ahooks';
const { copy, copied } = useClipboard();

// 媒体查询
import { useMediaQuery } from 'ahooks';
const isMobile = useMediaQuery('(max-width: 768px)');
```

### ahooks 关键规则

**优先使用 ahooks，不要手写可复用逻辑。**

#### 替代手写 hooks

| 手写代码                           | ahooks 替代                              |
| ---------------------------------- | ---------------------------------------- |
| `useCallback`                      | `useMemoizedFn` — 稳定函数引用，永不变化 |
| `useState` + 复杂嵌套              | `useImmer` — 直接 mutate draft           |
| `useEffect` + setTimeout           | `useDebounceFn` / `useThrottleFn`        |
| `useEffect` + keydown              | `useKeyPress`                            |
| `useEffect` + localStorage         | `useLocalStorageState`                   |
| `useEffect` + resize               | `useWindowSize` / `useMediaQuery`        |
| `useEffect` + IntersectionObserver | `useInViewport`                          |
| `useEffect` + navigator.clipboard  | `useClipboard`                           |
| `useEffect` + mount 初始化         | `useMount`                               |
| 手动防重复点击 flag                | `useLockFn`                              |

#### 核心原则

- **useMemoizedFn 替代 useCallback**：不需要依赖数组，函数引用永远稳定
- **useMount 替代 useEffect + []**：语义更清晰，专门用于初始化
- **useImmer 替代展开运算符**：嵌套状态修改用 `draft.xxx = yyy` 而非 `{ ...state, nested: { ...state.nested, xxx: yyy } }`
- **useLockFn 替代手动 loading flag**：Tauri invoke 必备，防止重复提交

### foxact（轻量全局状态）

用 `createContextState` 管理多个小的全局原子状态（主题、加载、更新状态）。

```ts
import { createContextState } from 'foxact/create-context-state';

// 创建主题模式 Context
const [ThemeProvider, useThemeMode, useSetThemeMode] = createContextState<'light' | 'dark'>('light');

// 创建加载状态 Context
const [LoadingProvider, useLoading, useSetLoading] = createContextState<Set<string>>(new Set());

// 在 main.tsx 中嵌套 Provider
import { ComposeContextProvider } from 'foxact/compose-context-provider';

const contexts = [
  <ThemeProvider key="theme" />,
  <LoadingProvider key="loading" />,
];

<ComposeContextProvider contexts={contexts}>
  <App />
</ComposeContextProvider>
```

### SWR（数据获取缓存）

后端数据缓存层，替代 `@tanstack/vue-query`。

```ts
import useSWR, { mutate } from 'swr';

// 定义 fetcher
async function fetchConfig(): Promise<Config> {
  const data = await invoke<unknown>('get_config');
  return ConfigSchema.parse(data);
}

// 在组件中使用
function ConfigPanel() {
  const { data: config, isLoading, error } = useSWR(['config'], fetchConfig);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <div>{config?.appTitle}</div>;
}

// 修改后刷新
async function updateConfig(patch: Partial<Config>) {
  await invoke('update_config', { patch });
  mutate(['config']); // 触发所有使用该 key 的组件重新请求
}
```

### react-hook-form（表单管理）

MCP 表单 + 配置设置表单。

```ts
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const McpServerSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

function McpServerForm({ onSubmit }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(McpServerSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      <Input {...register('url')} />
      {errors.url && <span>{errors.url.message}</span>}
      <Button type="submit">保存</Button>
    </form>
  );
}
```

### @xstate/react（状态机）

替代 `@xstate/vue`，迁移 canvasMachine + recognizeMachine。

```ts
import { useMachine } from '@xstate/react';
import { canvasMachine } from '@/machines/canvasMachine';

function Canvas() {
  const [state, send] = useMachine(canvasMachine);

  return (
    <div>
      <p>当前状态: {state.value}</p>
      {state.matches('idle') && <Button onClick={() => send('START')}>开始</Button>}
      {state.matches('drawing') && <CanvasContent />}
    </div>
  );
}
```

### react-konva（Canvas 渲染）

替代 `konva + vue-konva`，用于标注工具 2D 渲染。

```tsx
import { Stage, Layer, Rect, Circle } from 'react-konva';

function LabelCanvas({ annotations, onSelect }) {
  return (
    <Stage width={800} height={600}>
      <Layer>
        {annotations.map((ann) => (
          <Rect
            key={ann.id}
            x={ann.x}
            y={ann.y}
            width={ann.width}
            height={ann.height}
            stroke="blue"
            onClick={() => onSelect(ann.id)}
          />
        ))}
      </Layer>
    </Stage>
  );
}
```

### react-error-boundary（错误兜底）

路由/组件级错误兜底。

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h2>出错了</h2>
      <p>{error.message}</p>
      <Button onClick={resetErrorBoundary}>重试</Button>
    </div>
  );
}

// 在路由级别使用
<Route
  path="/label"
  element={
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <LabelPage />
    </ErrorBoundary>
  }
/>;
```

### nanoid（ID 生成）

唯一 ID 生成，用于任务、标注、MCP 服务器。

```ts
import { nanoid } from 'nanoid';

// 生成 ID
const id = nanoid(); // 'V1StGXR8_Z5jdHi6B-myT'
const shortId = nanoid(10); // 'IRFa-VaY2b'

// 在 schema 中使用
const AnnotationSchema = z.object({
  id: z.string().default(() => nanoid()),
  // ...
});
```

## 代码模式

### React Hooks 约定

- 命名：`use<PascalCase>.ts`
- 跨 store 复用：`.shared.ts` 后缀（如 `useLabelKeyboard.shared.ts`）
- 依赖注入：函数参数传入，不用 Context
- Options 接口：同文件定义（如 `UseRawRecognizeOpts`）

```ts
// 依赖注入示例
interface UseRawRecognizeOpts {
  store: LabelRawStore;
  onProgress?: (current: number, total: number) => void;
}

export function useRawRecognize(opts: UseRawRecognizeOpts) { ... }
```

### Zustand Store 约定

```ts
import { create } from 'zustand';

interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}));
```

**复杂嵌套状态用 immer：**

```ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface AppState {
  items: Item[];
  addItem: (item: Item) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    items: [],
    addItem: (item) =>
      set((state) => {
        state.items.push(item);
      }),
    updateItem: (id, patch) =>
      set((state) => {
        const item = state.items.find((i) => i.id === id);
        if (item) Object.assign(item, patch);
      }),
  }))
);
```

### 错误处理模式

**三层错误处理：**

```ts
try {
  await doSomething();
} catch (e) {
  // 1. 日志记录（必须）
  await logMessage('error', `[模块] 操作失败: ${e}`);

  // 2. 用户反馈（可选，面向用户的操作）
  // 使用 toast 或 alert

  // 3. 返回安全默认值或重新抛出
  return undefined;
}
```

**错误类型收窄：**

```ts
const msg = e instanceof Error ? e.message : String(e);
```

### 类型定义模式

Zod schema 定义类型，服务边界运行时验证：

```ts
// 1. 定义 schema
export const AnnotationSchema = z.object({ ... });
export type Annotation = z.infer<typeof AnnotationSchema>;

// 2. 服务中验证
export async function getAnnotations(): Promise<Annotation[]> {
  const data = await invoke<unknown>('get_annotations');
  return AnnotationSchema.array().parse(data);
}
```

### React 组件规范

#### 文件顺序

每个 `.tsx` 文件必须按以下顺序排列：

```tsx
// 1. 导入（第三方 → 内部）
import { useState, useEffect } from 'react';
import { useCounterStore } from '@/store/counter';
import { Button } from '@/components/ui/button';

// 2. Props 类型定义（如有）
interface MyComponentProps {
  visible: boolean;
  onClose: () => void;
}

// 3. 组件定义
export default function MyComponent({ visible, onClose }: MyComponentProps) {
  // 4. Store 实例化
  const count = useCounterStore((s) => s.count);

  // 5. 状态
  const [isLoading, setIsLoading] = useState(false);

  // 6. 副作用
  useEffect(() => { ... }, []);

  // 7. 事件处理
  const handleClick = () => { ... };

  // 8. 渲染
  return (
    <div>
      <Button onClick={handleClick}>Click me</Button>
    </div>
  );
}
```

#### 组件拆分原则

**React 中组件不复用时不要创建新文件，在同一文件内拆分为内部函数组件。**

```tsx
// ✅ 正确：内部组件拆分（不复用）
function TabBar({ tabs, onTabClick }: TabBarProps) {
  return <div>...</div>;
}

function WindowControls({ isMaximized }: WindowControlsProps) {
  return <div>...</div>;
}

export default function TitleBar() {
  return (
    <div>
      <TabBar />
      <WindowControls />
    </div>
  );
}

// ❌ 错误：不复用的组件拆成单独文件
// src/components/layout/TabBar.tsx
// src/components/layout/WindowControls.tsx
```

#### Props vs Store：何时用哪个

```
┌─────────────────────────────────────────────────────────────┐
│                  组件通信决策树                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  组件需要访问全局状态？                                       │
│  ├── 是 → 直接用 Store                                     │
│  │        （sibling 组件共享同一个 Store）                   │
│  │                                                          │
│  └── 否 → 是可复用的展示型组件？                             │
│           ├── 是 → Props + Callbacks                       │
│           │        （Dialog、Popup、通用卡片）               │
│           │                                                 │
│           └── 否 → 直接用 Store                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 组件通信方式速查

| 方式                  | 适用场景                 | 禁用场景                        |
| --------------------- | ------------------------ | ------------------------------- |
| **Store 直接访问**    | Sibling 组件共享状态     | 可复用组件（应保持 store 无关） |
| **Props + Callbacks** | 可复用展示型组件、Dialog | 超过 2 层的 prop drilling       |
| **Context**           | 主题/语言等全局配置      | 频繁更新的状态                  |

## 样式指南

项目使用 **Tailwind CSS 4** 进行样式管理。

### 基本规则

- 使用 Tailwind CSS 工具类进行样式编写
- 避免编写自定义 CSS，优先使用 Tailwind CSS
- 使用 `cn()` 函数合并类名（来自 `@/lib/utils`）

### cn() 函数

```ts
import { cn } from '@/lib/utils';

// 合并类名，自动处理冲突
<div className={cn('px-4 py-2', isActive && 'bg-primary text-primary-foreground')} />
```

### 暗色模式

使用 `.dark` 类名或 `prefers-color-scheme` 媒体查询。

## 代码规范

- oxlint：代码检查
- oxfmt：代码格式化
- TypeScript：严格模式，`noUnusedLocals`/`noUnusedParameters` 启用 — 未使用参数用 `_` 前缀

## UI 组件规范

**严禁自己造不必要组件，必须优先使用 shadcn/ui。**

shadcn/ui 组件位于 `src/components/ui/`，使用方式：

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>标题</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>点击</Button>
      </CardContent>
    </Card>
  );
}
```

shadcn/ui 常用组件速查：

| 场景   | 组件                                             |
| ------ | ------------------------------------------------ |
| 按钮   | `Button`                                         |
| 卡片   | `Card`, `CardContent`, `CardHeader`, `CardTitle` |
| 徽章   | `Badge`                                          |
| 警告   | `Alert`, `AlertTitle`, `AlertDescription`        |
| 弹窗   | `Dialog`, `DialogContent`, `DialogHeader`        |
| 输入框 | `Input`                                          |
| 文本域 | `Textarea`                                       |
| 分隔线 | `Separator`                                      |
| 标签页 | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |

### shadcn/ui 关键规则

**严禁自己造不必要组件，必须优先使用 shadcn/ui。**

#### 样式规则

- **语义色**：用 `bg-primary`、`text-muted-foreground` 等语义变量，禁止 `bg-blue-500`
- **内置变体优先**：用 `variant="outline"` 而非手写样式
- **className 只用于布局**：`max-w-md`、`mx-auto`、`mt-4`，不覆盖组件颜色/字体
- **用 gap-\* 替代 space-\***：`flex flex-col gap-4` 而非 `space-y-4`
- **用 size-\* 替代 w-\* h-\***：`size-10` 而非 `w-10 h-10`
- **用 truncate**：而非 `overflow-hidden text-ellipsis whitespace-nowrap`
- **用 cn() 合并类名**：禁止模板字符串三元表达式
- **禁止手动 dark: 覆盖**：用语义 token（`bg-background`）

#### 组件组合规则

- **Items 必须在 Group 内**：`SelectItem` → `SelectGroup`，`DropdownMenuItem` → `DropdownMenuGroup`
- **用 asChild/render 做自定义触发器**：Base UI 用 `render`，Radix 用 `asChild`
- **Dialog/Sheet/Drawer 必须有 Title**：`DialogTitle`、`SheetTitle`、`DrawerTitle`
- **完整 Card 组合**：`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`
- **Button 无 isPending/isLoading**：用 `Spinner` + `data-icon` + `disabled`
- **TabsTrigger 必须在 TabsList 内**
- **用 Separator 替代 `<hr>` 或 border div**
- **用 Skeleton 替代 `animate-pulse` div**
- **用 Badge 替代自定义 span**

#### 图标规则

- **Button 内的图标用 data-icon**：`data-icon="inline-start"` 或 `data-icon="inline-end"`
- **禁止组件内图标手动加 size 类**：组件通过 CSS 管理图标大小
- **图标作为对象传递**：`icon={CheckIcon}`，不是字符串查找

## Skills 指引

项目中 `.opencode/skills/` 和 `~/.config/opencode/skills/` 下有大量技能参考。使用 opencode 时可通过 `/skill <name>` 加载。

### 按场景速查

| 场景                  | Skill                     | 用途                                                              |
| --------------------- | ------------------------- | ----------------------------------------------------------------- |
| 代码质量              | `clean-code`              | 简洁直接的编码标准，SRP/DRY/KISS/YAGNI 原则                       |
| React 组件组合        | `composition-patterns`    | 复合组件、render props、context providers，避免 boolean prop 泛滥 |
| React 性能优化        | `react-best-practices`    | Vercel 70 条规则：消除 waterfall、bundle 优化、渲染性能           |
| React Router 数据模式 | `react-router-data-mode`  | createBrowserRouter、loader/action、pending UI                    |
| React 视图过渡动画    | `react-view-transitions`  | View Transition API、共享元素、Suspense reveal、方向导航          |
| Zustand 状态管理      | `zustand`                 | Zustand stores、selectors、middleware (persist/devtools/immer)    |
| XState 状态机         | `xstate`                  | XState 状态机，防止不可能状态，适合复杂多步流程                   |
| Zod Schema            | `zod`                     | Zod v4 运行时验证、safeParse、transforms、v3→v4 迁移              |
| TypeScript            | `typescript-coder`        | TS 基础、迁移策略、泛型、条件类型、配置                           |
| 样式                  | `tailwindcss`             | Tailwind CSS v4 工具类、响应式、暗色模式、动画                    |
| 构建工具              | `vite`                    | Vite 8 配置、插件 API、SSR、Rolldown 迁移                         |
| 测试                  | `vitest`                  | Vitest 5.x 测试 API、mock、快照、覆盖率、基准测试                 |
| UI 组件               | `shadcn`                  | shadcn/ui 组件规则：样式、组合、图标、变体                        |
| UI 设计审查           | `web-design-guidelines`   | 检查 UI 代码是否符合 Web Interface Guidelines                     |
| 包管理                | `pnpm`                    | pnpm 10.x/11.x 命令、配置、工作区、依赖管理                       |
| OpenSpec 探索         | `openspec-explore`        | 探索模式，思考伙伴，调查问题，澄清需求                            |
| OpenSpec 提案         | `openspec-propose`        | 一步创建变更提案，生成 proposal/design/tasks                      |
| OpenSpec 实施         | `openspec-apply-change`   | 按 tasks.md 逐步实现变更                                          |
| OpenSpec 归档         | `openspec-archive-change` | 完成后归档变更，可选同步 specs                                    |
| OpenSpec 同步         | `openspec-sync-specs`     | 将 delta specs 智能合并到主 specs                                 |
