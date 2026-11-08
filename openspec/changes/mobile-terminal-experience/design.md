# Design

## Context

本设计基于对 herdr-wpa 现有移动端代码的静态检查，以及对同机 `collie` 项目移动 PWA
交互的阅读。参考项目只提供交互与数据模型思路，不复制其协议、后端或依赖。

现状（已验证）：

- `web/src/TerminalView.tsx` 在 `data-mobile-controls` 下渲染固定快捷键条：
  Esc、Tab、`C-c`、`C-d`、`1`、`2`、`3`，外加上传、Stage、更多键与终端键盘按钮。
- “更多键”展开 `DIRECT_TERMINAL_KEYS` 与 `MORE_TERMINAL_KEYS`（方向、Home/End、
  Delete、PageUp/PageDown），并提供组合键 composer（Ctrl/Shift/Alt + 特殊键或可打印键）。
- `MobileTerminalKeyButton.tsx` 已实现按住重复、指针离开取消、页面隐藏取消。
- `mobileTerminalPrefs.ts` 管触屏 tap 目标、长按行为、端点超时、键盘隐藏 refit、
  命令输入展开与 Enter 行为。
- 紧凑布局（≤820px）用 sidebar/detail 两屏，`showSplit = !isCompactLayout`。
- `manifest.json` 已声明 `standalone`，但没有 service worker；静态资源由桥的
  `ServeDir` + 缓存头提供。
- 桥只暴露白名单命令；终端按键经 `/ws/terminal` 的输入帧发送，没有 `send_keys` API。

参考项目（collie）已验证的交互：

- `lib/key-board.ts`：7 列网格、跨格、1–4 步 chord、五个预设、布局码导入导出、
  版本化 schema 与严格校验。
- `lib/key-board-store.ts`：`useSyncExternalStore` + localStorage，默认板不落盘。
- `components/key-board-editor.tsx` + `chord-builder`：拖拽/缩放/换行、chord 编辑。
- `lib/operator-keys.ts`：按 agent 展示 Ctrl 预设（`Ctrl C/D/U/R/L/Z`，危险标记）。
- `components/composer.tsx`：底部 dock + `keys` 抽屉，按键与输入、附件、Send 同居。
- `hooks/use-keyboard.ts`、`use-connection-lost.ts`：软键盘与连接分层处理。

## Goals / Non-Goals

**Goals:**

- 常用键一键可达，组合键最多两次点击完成（arm 修饰符 + 目标键）。
- 键位可按个人习惯重排、跨格、跨设备迁移，且损坏时安全回退。
- dock 在软键盘、安全区与横竖屏下都可达，不遮挡终端输入。
- 弱网与切后台可解释、可恢复，不丢草稿、不误清空快照。
- PWA 壳可离线打开、可更新，且不破坏 CSP。

**Non-Goals:**

- 不新增桥命令或改变终端输入线格式。
- 不做推送、后台同步、原生键盘或 Android 原生 UI。
- 不重排桌面端布局与快捷键。
- 不在本 change 内拆分 `App.tsx` / `web_bridge.rs`；如需拆分另立 change。

## Decisions

### 1. 按键板是纯数据，编码仍走现有函数

新增 `mobileKeyBoard.ts`（纯模块，无 React / 无 storage）：

- `BOARD_COLS = 7`，`MIN_ROWS = 1`，`MAX_ROWS = 8`，`MAX_STEPS = 4`。
- 键类型：`mod`（ctrl/alt/shift，sticky）与 `chord`（`steps: string[]`，`label?`，
  `w?: 1|2|3`，`h?: 1|2`）。
- `cells` 按行优先存储；非锚点格为 `null`；`owners()` 计算覆盖关系。
- 移动/缩放/换行/删除都校验边界与重叠；不自动挤开其他键，唯一例外是同尺寸交换。
- chord 解析复用现有命名键表（`MOBILE_TERMINAL_SPECIAL_KEYS` 的 name）与
  `mobileTerminalPrintableKey`；编码仍调用 `encodeMobileTerminalChord`。
- 布局码：`herdr-keys:1:` + 受限 JSON，长度上限 4096；未知版本或非法内容整包拒绝。

理由：编码/协议只有一个来源，按键板只是“发送什么”的数据；避免第二套终端输入逻辑。

### 2. 持久化用 useSyncExternalStore，默认板不落盘

`mobileKeyBoardStore.ts` 仿照 `commandDrafts.ts` 与 collie 的 store：

- 单个 localStorage key（`herdr.mobileWeb.keyBoard.v1`）。
- 启动读取 → 校验 → 失败回退默认板，并把非法值视为“无选择”，不覆盖其他偏好。
- 与默认板相同时删除 key，保持升级默认板的能力。
- `resetKeyBoard()` 暴露给设置页。

理由：无需 Provider，dock 与编辑器共享同一值；与项目现有 `useSyncExternalStore` 习惯一致。

### 3. Sticky 修饰符状态保存在 dock 内部

`{ mods: Set<"ctrl"|"alt"|"shift">, lock: Set<...> }`，一次性状态在发送后清空；锁定
状态在再次点击、关闭抽屉或切换 pane 时清空。编码时与 chord step 的修饰符合并、去重。

理由：修饰符是“下一次输入”的临时状态，不应持久化，也不应进入 App 全局状态。

### 4. 多步 chord 顺序发送，必要时插入短间隔

`onInput(step1)` → `onInput(step2)`，同一事件循环内顺序发送；对 `ctrl+b` 前缀类
场景可选 8ms 间隔（常量，不暴露 UI）。不为 chord 增加新的桥消息。

理由：Herdr 端按字节流解析，连续发送与快速键入等价；8ms 仅用于避免 tmux 前缀与
后续字符被合并成一个 paste。

### 5. dock 布局由 CSS 变量驱动

- 新增 `--keyboard-inset`（由 `useKeyboardInset` 写入 `document.documentElement`）。
- dock 高度 = 内容高度 + `max(env(safe-area-inset-bottom), 8px)` + `--keyboard-inset`。
- 键盘/抽屉/字体/缩放变化后调用现有 `resizeTerminal`，由 `TerminalView` 的 120ms
  去抖合并为一次 PTY resize（上一轮已实现）。
- `visualViewport` 缺失时回退到 `window.innerHeight` 与 `focusin/focusout`。

理由：CSS 变量让 dock、终端和 overlay 共用同一偏移，避免 JS 直接改多个元素。

### 6. 手势用 Pointer Events 状态机，先判冲突再判方向

- 只在 `isCompactLayout && isTouchInput` 且目标不在 `input/textarea/[data-gesture-ignore]`
  、选择手柄、滚动容器内时启动。
- 记录起点、主指针、`pointerType`；超过 12px 才决定方向；横向阈值
  `max(48, width * 0.15)`。
- 手势期间 `setPointerCapture`，取消时恢复选择与滚动，不发送终端输入。
- 左缘 24px 内右滑走现有 `history.back()` 等价路径（复用 `openMobileSidebar`）。
- 下拉刷新仅在详情页滚动顶部且纵向位移 > 64px 时触发，带一次性锁。

理由：与终端文本选择、长按菜单、滚动共用 Pointer Events 时，必须先排除目标区域，
否则会出现“选字变成切 pane”。

### 7. 连接状态由单一派生函数计算

新增 `connectionPhase.ts`（纯函数）输入：`navigator.onLine`、桥快照加载状态、
最近一次 `/api/snapshot` 错误类别（网络/HTTP/协议/daemon）、终端 `connectionState`、
`reconnecting` 标志。输出五态与文案 key。

桥侧已有 `close_message` 与协议不匹配错误；前端按错误文本/状态映射到 `daemon-unavailable`，
其余网络失败映射到 `bridge-unreachable`。文案与重试入口集中在状态条组件。

理由：状态分散在 App 与 TerminalView，单一派生函数可单测，避免每处各写一套文案。

### 8. PWA 用 vite-plugin-pwa 的 injectManifest + 手写 SW

- `web/vite.config.ts` 增加 `VitePWA({ strategies: "injectManifest", srcDir: "src",
  filename: "sw.ts", injectRegister: false })`。
- `main.tsx` 用 `virtual:pwa-register` 注册，保持 CSP 无内联脚本。
- `sw.ts` 预缓存 build 产物（HTML/JS/CSS/字体/图标/manifest），导航请求走
  shell fallback，不做 API/WS 缓存。
- `registerType: "prompt"`，用现有 `overlays.tsx` 的对话框样式提示更新。
- Capacitor 壳：SW 注册失败不影响启动；`capacitor.config.ts` 不做改动。

理由：与 collie 相同的 CSP 兼容路径；API 与 WebSocket 永不缓存，避免陈旧终端状态。

### 9. 触觉反馈

`useHaptics()` 提供 `pulse()`：仅在用户开启、`navigator.vibrate` 存在、
`matchMedia("(prefers-reduced-motion: reduce)")` 不匹配时调用 `navigator.vibrate(10)`；
iOS Safari 不支持则静默跳过。

## Risks / Trade-offs

- **手势与文本选择冲突**：用目标区域排除 + 12px 方向判定降低误触；若仍有问题，
  默认关闭手势，只保留按键板。
- **`visualViewport` 差异**：iOS Safari 在键盘动画期间高度抖动，需要 rAF 合并；
  极端情况下 dock 可能短暂跳动，可通过 80ms 尾随稳定。
- **SW 缓存陈旧**：只在 `skipWaiting` 后切换版本；API/WS 不缓存；离线壳不显示旧终端内容。
- **内存与渲染**：按键板 7×8 最多 56 格，网格渲染成本低；编辑器只在小屏打开。
- **测试覆盖**：现有 Vitest 可覆盖纯模块与组件；真实软键盘与 iOS 行为需要人工
  smoke（写入 tasks 验收项），不虚构自动化覆盖。

## Migration Plan

1. 先落地纯模块（`mobileKeyBoard.ts`、`connectionPhase.ts`）与单测，不接线 UI。
2. 加 store 与设置持久化，默认板与现有快捷键条行为一致（回退开关）。
3. 用新按键板替换固定快捷键条，保留“更多键”作为抽屉入口；旧行为可由设置恢复。
4. 接入 `useKeyboardInset` 与 dock CSS 变量，逐项验证 iOS/Android。
5. 加入手势（默认开启，可关）。
6. 最后接 PWA（SW 注册失败不影响其余功能）。

每一步都能独立回退；发布按 MINOR 处理。

## Open Questions

- 危险键的确认方式：就地二次点击还是弹层？（建议就地二次点击，避免额外弹层）
- 是否需要按 agent 类型切换预设（collie 的做法）？herdr-web 已有 `agent` 字段，
  可先做静态预设，后续再按 agent 过滤。
- 是否把按键板布局存到桥（跨设备同步）？本 change 只做本地 + 布局码导入导出，
  避免在无认证桥上存储个人配置。
