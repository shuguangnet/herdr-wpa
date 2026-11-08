# Tasks

> 实现进度（2026-11-09）：1.x–7.x 与 8.1 已完成，`npm run check` 通过（510 个前端测试、162 个
> Rust 测试、lint 与构建）。8.2–8.4 需要真机（Android Chrome / iOS Safari）与读屏人工验收，
> 本机未执行，保持未勾选。勾选表示实现与自动化验证都已完成。

规划阶段保持未勾选；勾选表示实现与验证都已完成。范围与约束见 `design.md`。

## 1. 纯模块与数据模型

- [x] 1.1 新增 `web/src/mobileKeyBoard.ts`：7 列网格、跨格、1–4 步 chord、移动/缩放/
      换行、预设与布局码编解码；非法输入返回可读原因。
      验证：`npx vitest run src/mobileKeyBoard.test.ts` 覆盖边界、重叠、非法 chord、
      截断布局码与版本拒绝。
- [x] 1.2 新增 `web/src/mobileKeyBoardStore.ts`：`useSyncExternalStore` +
      localStorage（`herdr.mobileWeb.keyBoard.v1`），默认板不落盘，损坏回退。
      验证：store 单测模拟缺失/损坏/更高版本；`resetKeyBoard` 后 key 被删除。
- [x] 1.3 新增 `web/src/connectionPhase.ts`：由在线状态、快照错误类别、终端状态派生
      五态与文案 key。
      验证：表驱动单测覆盖 offline/daemon/attach-conflict/reconnecting/attached。

## 2. 按键板与 dock

- [x] 2.1 新增 `MobileKeyBoard.tsx`：CSS Grid 渲染、sticky 修饰符、press repeat、
      危险键就地二次确认、触觉脉冲。
      验证：组件测试断言点击发送字节、一次性修饰符清除、危险键首点不发送。
- [x] 2.2 新增 `MobileKeyBoardEditor.tsx` 与 `ChordBuilder.tsx`：增删键、拖拽/缩放/
      换行、编辑 chord、导入导出布局码。
      验证：组件测试覆盖保存后 store 更新、非法 chord 被拒、导入失败不改板。
- [x] 2.3 在 `TerminalView.tsx` 用新按键板替换固定快捷键条，保留“更多键/按键抽屉”
      入口；提供设置开关回退到旧快捷键条一个版本。
      验证：`TerminalView.mobileKeys.test.tsx` 通过；手工在窄屏点击 Esc/方向/Ctrl-C。
- [x] 2.4 把 `useHaptics.ts` 接入按键发送，设置项可关闭且尊重
      `prefers-reduced-motion`。
      验证：单测 mock `navigator.vibrate`；关闭后不调用。

## 3. 软键盘与视口

- [x] 3.1 新增 `useKeyboardInset.ts`：`visualViewport` resize/scroll + rAF 合并，
      回退 `focusin/focusout`，维护 `--keyboard-inset`。
      验证：单测用 mock visualViewport 断言变量更新与清理；手工在 iOS Safari 与
      Android Chrome 各验证一次。
- [x] 3.2 调整 `styles.css` dock 高度与安全区：底部
      `max(env(safe-area-inset-bottom), 8px)` + `--keyboard-inset`，横屏左右安全区。
      验证：横竖屏切换无横向滚动；键盘弹出时发送按钮完整可见。
- [x] 3.3 dock/抽屉/字体/缩放变化后复用 120ms 去抖的终端 resize，确认只发一次。
      验证：DevTools 记录 `/ws/terminal` 的 resize 帧数量；手工收起抽屉。
- [x] 3.4 触控目标 ≥40×40 与 4px 间隙审计，缩放百分比下不重叠。
      验证：新增 `mobileDockMetrics.test.ts` 断言 CSS 变量计算；小屏 360×640 手工检查。

## 4. 手势

- [x] 4.1 新增 `useMobileGesture.ts`（Pointer Events 状态机）：横向 pane/tab 切换、
      左缘返回、下拉刷新、目标排除与取消恢复。
      验证：单测覆盖阈值、方向判定、取消、输入框目标排除。
- [x] 4.2 在 `App.tsx` 紧凑布局接线，复用现有 `openMobileSidebar`/`history.back`
      语义，并添加设置开关（默认开）。
      验证：Android 返回键与边缘手势一致；关闭后横向拖动不切换。
- [x] 4.3 `prefers-reduced-motion` 下退化为无动画切换；桌面宽度不注册监听。
      验证：单测断言 matchMedia 分支；1200px 窗口手工验证无切换。

## 5. 连接反馈

- [x] 5.1 新增 `ConnectionStatusBar.tsx`：五态文案、离线横幅、重试按钮（防抖）。
      验证：组件测试断言文案与按钮禁用；连续点击只发一次请求。
- [x] 5.2 离线/不可达时禁用发送、Stage 与按键，保留草稿；恢复后不自动发送。
      验证：模拟 offline 事件后断言控件禁用、草稿保留。
- [x] 5.3 恢复路径：`online`/`visibilitychange`/桥恢复时重连并合并一次快照；
      给重连退避加抖动。
      验证：单测断言只刷新一次；手工切换飞行模式 30 秒后恢复。
- [x] 5.4 瞬态超时不清空快照与草稿。
      验证：单测模拟一次超时后成功，断言状态保留。

## 6. PWA 壳

- [x] 6.1 接入 `vite-plugin-pwa`（injectManifest）与 `web/src/sw.ts`：预缓存 shell、
      导航 fallback、不缓存 API/WS、版本化清理。
      验证：`npm run build:web` 产出 `sw.js` 与 manifest；离线冷启动手工验证。
- [x] 6.2 `main.tsx` 用 `virtual:pwa-register` 注册（无内联脚本），更新提示复用
      `overlays.tsx`。
      验证：CSP 控制台无内联脚本告警；修改构建后出现更新提示。
- [x] 6.3 Capacitor WebView 下 SW 不可用仍能启动；`docs/android.md` 补说明。
      验证：`npm run android:build:debug` + 真机/模拟器启动。

## 7. 设置与文档

- [x] 7.1 设置新增“Mobile”分组：按键板编辑入口、触觉开关、手势开关、dock 缩放。
      验证：`BackendSettingsDialog.test.tsx` 覆盖持久化与默认值。
- [x] 7.2 更新 `README.md`、`web/README.md`、`docs/android.md` 的移动端说明与截图。
      验证：文档命令与当前 CLI/设置一致，人工对照界面。
- [x] 7.3 增加 `CHANGELOG.md` 条目（Added/Changed），发布前补 PR 链接。

## 8. 验收

- [x] 8.1 `npm run check` 通过（lint、Vitest、Rust 测试、构建）。
- [ ] 8.2 真机 smoke：Android Chrome 与 iOS Safari 各验证按键板、键盘、手势、
      弱网恢复与 PWA 离线启动。
- [ ] 8.3 回归：桌面端快捷键、split、滚轮与终端选择行为无变化。
- [ ] 8.4 无障碍：读屏遍历按键板与状态条，焦点不丢失；危险键可取消。
