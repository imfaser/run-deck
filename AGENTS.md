# AGENTS.md

## 项目概览

Tauri 2 桌面应用。前端：Vue 3 + Pinia + Vue Router + Sass + Element Plus。后端：Rust (edition 2024)。

## 开发命令（justfile）

所有开发命令在 `justfile` 中定义。**禁止运行 `just dev` / `just dev-trace` / `just web-dev`** — 会阻塞终端。

| 任务                | 命令                             |
| ------------------- | -------------------------------- |
| 代码检查（ESLint）  | `just lint`                      |
| 自动修复            | `just lint-fix`                  |
| 格式化（Prettier）  | `just format`                    |
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

1. `just lint` — ESLint（via rtk）
2. `just format-check` — Prettier（via rtk）
3. `just test` — Vitest（via rtk）
4. `just web-build` — 前端构建验证
5. `cargo check` — Rust 类型检查
6. `cargo test` — Rust 单元测试（via rtk，按 crate 运行，见下文）

先运行自动修复（`just lint-fix`、`just format`），再手动修复。

## 项目结构

```
src/                    # Vue 前端（TS）
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
- `<tauri-*>` 自定义元素已在 vue 模板编译器中白名单

## 日志与可观测性

### 架构

```
前端 (TS)                后端 (Rust)
┌───────────────┐       ┌───────────────┐
│  logMessage() │─invoke─▶│ log_message() │──▶ logging! 宏
│  (cmd.ts)     │       │ (cmd/general.rs)      │
└───────────────┘       └───────────────┘
       │                       │
       ▼                       ▼
  前端过滤               flexi_logger
  (LOG_LEVEL_PRIORITY)   (dev: stdout / prod: 文件)
```

### 前端日志级别

| 级别    | 用途                          | 示例                                             |
| ------- | ----------------------------- | ------------------------------------------------ |
| `debug` | 内部状态追踪（最高频，~42处） | `[prev-mask] search start: slice=42`             |
| `info`  | 用户操作完成                  | `[volume] open /path/file.raw shape=100x100x100` |
| `warn`  | 可恢复的异常                  | `[recognize] no image in SAM3 result`            |
| `error` | 实际失败                      | `[keyframe-db] putKeyframe failed slice=3`       |

### 日志前缀规范

用 `[模块名]` 前缀标记日志来源，方便 `rg '\[模块名\]'` 过滤：

| 前缀                   | 用途                         |
| ---------------------- | ---------------------------- |
| `[keyframe-db]`        | Dexie IndexedDB 操作         |
| `[prev-mask]`          | 前序 mask 搜索、渲染、可见性 |
| `[recognize]`          | 单 slice AI 识别             |
| `[batchRecognize]`     | 批量识别                     |
| `[canvas]`             | Canvas 交互事件              |
| `[toolbar]`            | 工具栏按钮操作               |
| `[volume]`             | 卷打开/加载                  |
| `[slice]`              | Slice 加载                   |
| `[mask-render]`        | Mask 渲染                    |
| `[export]`             | Mask 卷导出                  |
| `[Vue error]`          | 全局 Vue 错误                |
| `[unhandledrejection]` | 全局异步错误                 |

### 前端调用方式

```ts
import { logMessage } from '@/services/cmd';

// 始终 await
await logMessage('debug', `[模块] 操作 detail=${value}`);
await logMessage('error', `[模块] 操作失败: ${e}`);
```

### Rust 端规范

```rust
// 宏：logging!(级别, Type::模块, 格式, 参数)
logging!(info, Type::Cmd, "open file {}", path);
logging!(error, Type::Mcp, "server start failed: {}", e);

// 命令错误类型：Result<T, String>
pub type CmdResult<T = ()> = Result<T, String>;
```

`Type` 枚举标记日志来源：`Cmd`, `Setup`, `System`, `Config`, `Frontend`, `File`, `Mcp`

### 日志分析工具

日志文件位置：`.app/logs/*_latest.log`

#### 快速诊断命令（rg）

```bash
# 1. 只看 ERROR/WARN，过滤掉 INFO/DEBUG 噪音
rg -i '\b(ERROR|WARN)\b' .app/logs/*_latest.log

# 2. 按模块过滤（比如只看 MCP 相关）
rg 'mcp::server' .app/logs/*_latest.log

# 3. 时间窗口截取
rg '2026-07-26 13:51' .app/logs/*_latest.log

# 4. 统计各级别日志数量，先对整体有个判断
rg -c '\bINFO\b' .app/logs/*_latest.log
rg -c '\bDEBUG\b' .app/logs/*_latest.log
rg -c '\bWARN\b' .app/logs/*_latest.log
rg -c '\bERROR\b' .app/logs/*_latest.log

# 5. 按模块统计日志分布（PowerShell 配合 rg）
[System.IO.File]::ReadAllText(".app/logs/*_latest.log") -split "`n" |
  Select-String -Pattern '\[(\w+::\w+|\w+)\]' |
  ForEach-Object { $_.Matches[0].Groups[1].Value } |
  Group-Object | Sort-Object Count -Descending | Format-Table Count, Name -AutoSize

# 6. 去重：把动态部分（时间戳、PID等）归一化后统计重复模板
# 适合 MCP 启动日志这种"模板固定、参数变化"的场景
[System.IO.File]::ReadAllText(".app/logs/*_latest.log") -split "`n" |
  ForEach-Object { $_ -replace '\d{2}:\d{2}:\d{2}\.\d+', 'TS' } |
  Group-Object | Sort-Object Count -Descending |
  Select-Object -First 15 | Format-Table Count, Name -AutoSize -Wrap

# 7. 查找潜在问题（failed/error/timeout/refused）
rg -i 'failed|error|timeout|refused' .app/logs/*_latest.log
```

#### 分析流程

1. **先统计级别分布** — 判断整体健康度（ERROR=0, WARN=0 为佳）
2. **按模块聚合** — 定位热点模块
3. **去重分析** — 识别重复模板（如 MCP 启动、prev-mask 渲染）
4. **时间窗口** — 聚焦问题发生时段
5. **关键词搜索** — 定位具体错误

## 工具库规范

### ts-pattern（控制流）

项目中 19 个文件使用，替代 `if/else` 链和 `switch` 语句。

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

| 函数        | 用途         | 示例文件                  |
| ----------- | ------------ | ------------------------- |
| `clamp`     | 限制数值范围 | `LabelRawCanvas.vue`      |
| `cloneDeep` | 深拷贝       | `label-raw.ts`            |
| `sortBy`    | 排序         | `label-raw.ts`            |
| `debounce`  | 防抖         | `label-raw.ts`            |
| `keyBy`     | 按键索引     | `worktime.ts`             |
| `flatMap`   | 扁平化映射   | `useCanvasAnnotations.ts` |

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

Schema 文件：`src/schemas/annotation.ts`, `config.ts`, `worktime.ts`, `sam3.ts`

### 其他依赖

| 库                       | 用途                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `@vueuse/core`           | Vue 响应式辅助（`useEventListener`, `useResizeObserver`, `useDark`） |
| `@tanstack/vue-query`    | 服务端状态管理（`useQuery`, `useMutation`）                          |
| `dayjs`                  | 日期处理（仅 worktime 模块）                                         |
| `konva` / `vue-konva`    | Canvas 渲染引擎                                                      |
| `xstate` / `@xstate/vue` | 状态机（canvas 交互、识别流程）                                      |
| `dexie`                  | IndexedDB 封装（label-raw 持久化）                                   |

## 代码模式

### Composable 约定

- 命名：`use<PascalCase>.ts`
- 跨 store 复用：`.shared.ts` 后缀（如 `useLabelKeyboard.shared.ts`）
- 依赖注入：函数参数传入，不用 `inject/provide`
- Options 接口：同文件定义（如 `UseRawRecognizeOpts`）
- 动态导入 element-plus 避免副作用

```ts
// 依赖注入示例
interface UseRawRecognizeOpts {
  store: LabelRawStore;
  onProgress?: (current: number, total: number) => void;
}

export function useRawRecognize(opts: UseRawRecognizeOpts) { ... }
```

### Store 约定

全部使用 Composition API（setup function）风格：

```ts
export const useLabelRawStore = defineStore('label-raw', () => {
  // ─── 状态 ──────────────────────────────────────
  const foo = ref<T>(initialValue);

  // ─── 计算属性 ───────────────────────────────────
  const derived = computed(() => ...);

  // ─── 操作 ──────────────────────────────────────
  function doSomething() { ... }

  return { foo, derived, doSomething };
});
```

共享逻辑通过工厂函数复用：

```ts
const sharedActions = createAnnotationActions({ mode, tool, objects, ... });
return { ...sharedActions };
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
  ElMessage.error('操作失败');

  // 3. 返回安全默认值或重新抛出
  return undefined;
}
```

**错误类型收窄：**

```ts
const msg = e instanceof Error ? e.message : String(e);
```

**用户确认对话框：**

```ts
try {
  await ElMessageBox.confirm('确定删除？', '提示');
} catch {
  // 用户取消，静默处理
}
```

**全局错误边界（main.ts）：**

```ts
app.config.errorHandler = (err) => {
  ElMessage.error(msg); // 用户可见
  console.error('[Vue error]', err); // 开发调试
  logMessage('error', `[Vue error] ${msg}`); // 后端日志
};
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

Store 导出领域类型，Service 重导出便于消费。

### Vue 组件规范

#### 文件顺序

每个 `.vue` 文件必须按以下顺序排列：

```vue
<script setup lang="ts">
  // 1. 导入（第三方 → 内部）
  // 2. Props/Emits 定义
  // 3. Store 实例化
  // 4. Refs 和 Computed
  // 5. 函数
  // 6. Watch 和生命周期
</script>

<template>
  <!-- 模板 -->
</template>

<style scoped lang="scss">
  /* 样式 */
</style>
```

#### Script 内部顺序

```ts
// 1. 第三方导入
import { ref, computed, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';

// 2. 内部导入
import { useLabelRawStore } from '@/stores/label-raw';
import { logMessage } from '@/services/cmd';
import { useCanvasAnnotations } from '@/composables/useCanvasAnnotations';

// 3. Props/Emits（如有）
const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ confirm: [name: string] }>();

// 4. Store 实例化
const store = useLabelRawStore();

// 5. Refs
const containerRef = ref<HTMLDivElement | null>(null);
const isLoading = ref(false);

// 6. Computed
const hasVolume = computed(() => store.hasVolume);

// 7. 函数
async function handleClick() { ... }

// 8. Watch / Lifecycle
watch(() => store.currentIndex, () => { ... });
```

#### Store vs Props：何时用哪个

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
│           ├── 是 → Props + Emits                           │
│           │        （Dialog、Popup、通用卡片）               │
│           │                                                 │
│           └── 否 → 是适配器/桥接组件？                      │
│                    ├── 是 → Store + Props/Emits            │
│                    │        （读 Store，转 props 给子组件）  │
│                    └── 否 → 直接用 Store                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**三种典型场景：**

| 场景                 | 方式                | 示例                                                           |
| -------------------- | ------------------- | -------------------------------------------------------------- |
| Sibling 组件共享状态 | 直接用 Store        | `LabelRawCanvas` + `LabelRawToolbar` 共享 `useLabelRawStore()` |
| 可复用展示型组件     | Props + Emits       | `ObjectNameDialog` 接收 `visible`，emit `confirm`/`cancel`     |
| 适配器桥接组件       | Store → Props/Emits | `LabelRawNameDialogHandler` 读 Store，转 props 给 Dialog       |

#### 避免 Props/Emits 地狱：适配器模式

**反面教材（Props 地狱）：**

```
Page
├── Parent（props: objects, selectedId, onUpdate, onConfirm...）
│   ├── Child1（props: objects, selectedId, onUpdate...）  ← 逐层透传
│   │   └── Child2（props: objects, selectedId...）       ← 继续透传
```

**项目实践（Store-as-bus）：**

```
label-raw.vue（页面）
├── LabelRawToolbar         ← 直接读 Store
├── LabelRawCanvas          ← 直接读 Store
├── LabelRawSliceSlider     ← 直接读 Store
├── LabelRawKeyframePanel   ← 直接读 Store
└── LabelRawNameDialogHandler  ← 适配器（见下文）
    ├── ObjectNameDialog       ← Props/Emits，不触碰 Store
    └── ObjectSelectDialog     ← Props/Emits，不触碰 Store
```

**适配器模式示例（`LabelRawNameDialogHandler.vue`）：**

```vue
<script setup lang="ts">
  // 适配器：读 Store，转 Props/Emits 给展示型组件
  import { useLabelRawStore } from '@/stores/label-raw';
  import ObjectNameDialog from '@/components/label/ObjectNameDialog.vue';
  import ObjectSelectDialog from '@/components/label/ObjectSelectDialog.vue';

  const store = useLabelRawStore();

  // 把 Store 操作包装成 Dialog 的 emit 回调
  function handleConfirmName(name: string) {
    const pending = store.pendingAnnotation;
    if (!pending) return;
    const obj = store.addObject(name);
    // ... 执行 Store 操作
    store.showNameDialog = false;
  }
</script>

<template>
  <!-- 展示型组件只接收 Props，不触碰 Store -->
  <ObjectNameDialog
    :visible="store.showNameDialog"
    @confirm="handleConfirmName"
    @cancel="handleCancelName"
  />
</template>
```

**展示型组件（`ObjectNameDialog.vue`）：**

```vue
<script setup lang="ts">
  // 纯展示：只用 Props/Emits，不导入任何 Store
  const props = defineProps<{ visible: boolean }>();
  const emit = defineEmits<{
    confirm: [name: string];
    cancel: [];
  }>();

  const inputName = ref('');
  function handleConfirm() {
    emit('confirm', inputName.value);
  }
</script>
```

#### 组件通信方式速查

| 方式                    | 适用场景                 | 禁用场景                        |
| ----------------------- | ------------------------ | ------------------------------- |
| **Store 直接访问**      | Sibling 组件共享状态     | 可复用组件（应保持 store 无关） |
| **Props/Emits**         | 可复用展示型组件、Dialog | 超过 2 层的 prop drilling       |
| **defineExpose**        | 父组件需调用子组件方法   | 能用 Store 触发的场景           |
| **Composable 依赖注入** | 复用逻辑需要外部状态     | 替代 `inject/provide`           |
| **provide/inject**      | ❌ 禁止使用              | —                               |
| **Event Bus**           | ❌ 禁止使用              | —                               |

#### defineExpose 使用

当 Store 模式不适用，父组件需要直接调用子组件方法时：

```vue
<!-- 子组件 -->
<script setup lang="ts">
  function fitToImage() { ... }
  defineExpose({ fitToImage });
</script>
```

```ts
// 父组件
const canvasRef = ref<InstanceType<typeof LabelRawCanvas>>();
canvasRef.value?.fitToImage();
```

## SCSS 样式指南

按需创建 `src/styles/` 下的目录结构：

- `abstracts/` — 变量、函数、mixin、占位符
- `base/` — 重置、排版、动画
- `components/` — 组件级样式
- `layout/` — 网格、头部、底部
- `pages/` — 页面级样式（最小化）
- `themes/` — 亮/暗主题管理
- `vendors/` — 第三方覆盖

入口：`src/styles/main.scss` — 应用唯一导入的样式文件。

规则：

- 使用现代 SCSS 语法（禁止 `@import`，用 `@use`/`@forward`）
- 变量名不得与 Vue 组件 props 冲突
- 按需创建目录/文件，不要提前创建

## Tauri 特性

- 使用 Tauri API 时，用 webfetch 获取文档 `https://tauri.app/llms.txt`
- Vue Router 使用文件路由 — 参考 vue-router-skilld 获取最新模式
- Vite 开发服务器端口 6917（`vite.config.ts`）

## 代码规范

- Prettier：分号、单引号、尾逗号 es5、100 宽度、LF、vue script/style 缩进
- ESLint：`_` 前缀抑制未使用变量（`argsIgnorePattern: '^_'`），`vue/multi-word-component-names` 关闭
- TypeScript：严格模式，`noUnusedLocals`/`noUnusedParameters` 启用 — 未使用参数用 `_` 前缀

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

## Skills 指引

项目中 `.opencode/skills/` 和 `~/.config/opencode/skills/` 下有大量技能参考。使用 opencode 时可通过 `/skill <name>` 加载。

### 按场景速查

| 场景              | Skill                         | 用途                                                |
| ----------------- | ----------------------------- | --------------------------------------------------- |
| 写 Vue 组件       | `vue`                         | Composition API、`<script setup>`、响应式、生命周期 |
| 写 Pinia Store    | `pinia`                       | setup-style store、`storeToRefs`、插件、组合        |
| 写测试            | `vitest`                      | 测试 API、mock、快照、覆盖率、环境配置              |
| 定义 Zod Schema   | `zod`                         | `z.object`、`z.infer`、`safeParse`、v4 最佳实践     |
| 找工具函数        | `es-toolkit-recommend`        | 推荐最合适的 es-toolkit 函数                        |
| 写 SCSS           | `scss-best-practices`         | 7-1 架构、BEM 命名、`@use`/`@forward`               |
| Vue Router        | `vue-router-best-practices`   | 路由守卫、导航、路由组件生命周期                    |
| VueUse            | `vueuse-functions`            | `useEventListener`、`useResizeObserver` 等          |
| Vite 配置         | `vite`                        | 插件 API、SSR、Rolldown 迁移                        |
| 测试 Vue 组件     | `vue-testing-best-practices`  | Vue Test Utils、组件测试、mock 模式                 |
| 全局错误处理      | `vue-debug-guides`            | 运行时错误、异步失败、SSR/hydration                 |
| UI 设计规范       | `web-design-guidelines`       | 无障碍、UX 审查、设计最佳实践                       |
| 暗色模式          | `antfu-design`                | UnoCSS、语义化 token、双主题                        |
| 响应式 Composable | `create-adaptable-composable` | MaybeRef 输入、toValue() 规范化                     |
| 探索需求          | `openspec-explore`            | 需求澄清、架构探索                                  |
| 提案设计          | `openspec-propose`            | 生成 proposal + design + specs + tasks              |
| 执行任务          | `openspec-apply-change`       | 按 tasks.md 逐步实现                                |

### Skills 分类

**核心框架：**

- `vue` — Vue 3 核心
- `pinia` — 状态管理
- `vue-router-best-practices` / `vue-router-skilld` — 路由
- `vitest` — 单元测试
- `vue-testing-best-practices` — 组件测试

**工具库：**

- `es-toolkit-recommend` / `es-toolkit-guide` — 数据转换
- `zod` — 运行时验证
- `vueuse-functions` — Vue 响应式辅助

**样式：**

- `scss-best-practices` — SCSS 规范
- `antfu-design` — 设计系统
- `web-design-guidelines` — UI/UX 审查

**构建工具：**

- `vite` — 构建配置
- `tsdown` — 库打包
- `turborepo` — Monorepo 构建
- `pnpm` — 包管理

**OpenSpec 工作流：**

- `openspec-explore` — 探索阶段
- `openspec-propose` — 提案阶段
- `openspec-apply-change` — 实现阶段
- `openspec-archive-change` — 归档阶段
- `openspec-sync-specs` — 规格同步

**其他框架参考：**

- `nuxt` — Nuxt 全栈框架
- `nitro` — 服务器工具包
- `vitepress` — 文档站
- `slidev` — 演示文稿
- `unocss` — 原子化 CSS

**技能管理：**

- `skill-creator` — 创建/修改 skill
- `clarify-before-explore` — 需求澄清
- `pua` — 强制高质量解决问题
