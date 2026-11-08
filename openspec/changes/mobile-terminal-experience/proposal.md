# Proposal

## Why

手机端目前可以连接、输入和查看终端，但实际使用时仍明显别扭：常用键位固定在
`TerminalView.tsx` 里（Esc、Tab、Ctrl-C、Ctrl-D、1、2、3），方向键与 Home/End 藏在
“更多键”二级面板；组合键要走“更多键 → 组合 → 选修饰符 → 选键 → Send”四到五步；
没有可自定义的按键板、没有状态明确的 sticky 修饰符、没有触觉反馈，也没有滑动切换
pane/tab 或边缘返回手势。弱网下页面不会解释“桥断了还是 daemon 不可用”，PWA 只有
manifest 而没有 service worker，重开时仍会回源加载全部资源。

同机 `collie` 项目的移动 PWA 已经验证了一套更顺手的做法：7 列可编辑按键板（跨格、
多步 chord、预设、导入导出）、按 agent 生效的 Ctrl 预设、软键盘感知的底部 dock、
长按与触觉、连接分层状态。本提案把这套交互迁移到 herdr-web 的能力边界内，而不是
复制它的协议或后端。

## What Changes

- 把固定快捷键条升级为**可编辑按键板**：7 列网格，单键可跨 1–3 列、1–2 行；每键
  可保存 1–4 步 chord（如 `ctrl+b` 后 `c`）；提供默认板与常用预设，支持复制/粘贴
  布局码在设备间迁移，状态存 `localStorage` 并做版本校验与损坏回退。
- 增加**sticky 修饰符**（Ctrl/Alt/Shift：关闭、一次性、锁定）与直接发送；危险键
  （`Ctrl-D`、`Ctrl-Z`）需要二次确认；按键长按重复保留，扩展到方向键与 Backspace。
- 增加**触觉反馈**（有 `navigator.vibrate` 时 8–12ms，可关闭），并保持
  `prefers-reduced-motion` 与无障碍语义。
- 重构底部 **dock**：快捷区、按键板抽屉、命令输入、上传与发送在软键盘弹出时保持
  可达；用 `visualViewport` 维护 `--keyboard-inset`，兼容 iOS Safari 与 Capacitor。
- 增加**移动端手势**：左右滑动切换同 space 的 pane/tab（可关）、从屏幕左缘右滑返回
  sidebar、下拉触发一次快照刷新；手势与终端文本选择、横向滚动互斥。
- 增加**连接分层反馈**：区分 bridge 不可达、Herdr daemon 不可用、终端 attach 冲突与
  正在重连；离线时禁用发送并明确提示，恢复后自动重连并补一次快照。
- 增加 **PWA 壳**：service worker 预缓存 app shell 与静态资源、离线打开显示壳与连接
  状态、新版本可用时提示更新；保持现有 CSP（不使用内联脚本注册 SW）。
- 移动端设置新增“按键板 / 手势 / 触觉 / dock 高度”分组，沿用现有 Display 与 Mobile
  设置的组织方式。

**非目标：**

- 不新增桥命令、不扩展 `/api/command` 白名单、不假设 Herdr 存在 `send_keys` 之类的
  API；所有按键仍是 `/ws/terminal` 上的输入字节。
- 不改变桥的无认证 LAN 安全模型，不引入前端 token 或 SSH 凭据。
- 不重做桌面端键盘快捷键，不改桌面 split 交互。
- 不实现推送通知、后台常驻或 Android 原生键盘；先覆盖浏览器与 Capacitor WebView。
- 不在本 change 内拆分 `App.tsx` 或 `web_bridge.rs` 的大文件结构。

## Capabilities

### New Capabilities

- `mobile-terminal-keys`：可编辑按键板、chord 语法、sticky 修饰符、危险键、重复与触觉。
- `mobile-terminal-dock`：底部 dock、软键盘与视口适配、安全区、输入与发送可达性。
- `mobile-navigation-gestures`：滑动切换 pane/tab、边缘返回、下拉刷新与冲突处理。
- `mobile-connection-feedback`：分层连接状态、离线保护、恢复与重连反馈。
- `mobile-pwa-shell`：service worker 预缓存、离线壳、更新提示与 standalone 约束。

### Modified Capabilities

无。仓库此前没有 OpenSpec 正式规格，本次是首次建立能力契约。

## Impact

- 前端主改动：`web/src/TerminalView.tsx`（dock 与按键板接线）、`web/src/App.tsx`
  （紧凑布局手势与设置入口）、`web/src/styles.css`（网格、安全区、键盘变量）。
- 新增模块：`web/src/mobileKeyBoard.ts`（纯数据与校验）、
  `web/src/mobileKeyBoardStore.ts`（版本化持久化）、`web/src/MobileKeyBoardEditor.tsx`、
  `web/src/ChordBuilder.tsx`、`web/src/useHaptics.ts`、`web/src/useKeyboardInset.ts`。
- 复用：`mobileTerminalControls.ts` 的特殊键与 `encodeMobileTerminalChord`、
  `mobileTerminalPrefs.ts` 的解析器模式、`MobileTerminalKeyButton.tsx` 的长按逻辑。
- PWA：`web/vite.config.ts`、`web/src/sw.ts`、`web/public/manifest.json`、`web/index.html`。
- 测试：新增 Vitest 单测（按键板解析/校验/布局码/手势状态机/键盘 inset），
  并在 `docs/android.md`、`web/README.md`、`README.md` 补移动端说明。
- 兼容性：旧浏览器与旧 bridge 保持可用；service worker 与手势均可关闭；数据损坏回退
  默认板。预计属于 MINOR 变更，发布时再决定版本号。
