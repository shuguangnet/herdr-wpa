# 移动端底部 dock

## Purpose

保证手机上的终端可视区、命令输入、发送与按键在日常使用中都可达：软键盘弹出时不遮住
输入框与发送，收起后终端立即恢复正确尺寸，安全区与横竖屏切换不产生半行或黑洞。

## ADDED Requirements

### Requirement: Dock keeps input and send reachable

移动端 SHALL 提供底部 dock，包含按键板入口、命令输入与发送控件。软键盘弹出时，输入框
与发送按钮 MUST 完整位于键盘上方；dock 高度变化 MUST NOT 把发送按钮移到可视区域之外。

#### Scenario: Open the keyboard

- **GIVEN** 操作者在手机上打开一个已连接的终端
- **WHEN** 操作者点击命令输入框并弹出软键盘
- **THEN** 输入框和发送按钮仍在键盘上方可见
- **AND** 终端内容不被 dock 与键盘同时压成零高度

#### Scenario: Compact viewport

- **GIVEN** 屏幕高度为 640px 的手机
- **WHEN** 按键板与键盘同时展开
- **THEN** 至少保留一行终端可见
- **AND** 输入框可滚动到可视区域，不被裁切

### Requirement: Keyboard inset drives layout

页面 MUST 通过 `visualViewport` 的 `resize`/`scroll` 维护键盘遮挡高度（CSS 变量
`--keyboard-inset`），并在键盘高度变化时触发终端 fit；`visualViewport` 不可用时 MUST
回退到窗口尺寸与 `focusin`/`focusout`，不得依赖单一事件导致 dock 卡在错误位置。

#### Scenario: Keyboard height changes

- **GIVEN** 软键盘已打开
- **WHEN** 操作者切换中英文输入法，键盘高度变化
- **THEN** dock 跟随变化后的高度重新定位
- **AND** 终端在稳定后收到一次新的 resize

#### Scenario: iOS Safari fallback

- **GIVEN** `visualViewport` 事件缺失或高度为 0
- **WHEN** 操作者聚焦输入框
- **THEN** dock 仍停在窗口底部安全区之上
- **AND** 不失焦、不反复抖动

### Requirement: Safe area and orientation

dock MUST 尊重 `env(safe-area-inset-bottom)` 与横屏左右安全区；横竖屏切换后 MUST
重新计算高度并 refit 终端，不允许出现横向滚动条或按键被 home indicator 覆盖。

#### Scenario: Rotate to landscape

- **WHEN** 操作者把手机横置
- **THEN** dock 高度与左右内边距按新方向重算
- **AND** 终端列数随之变化，不出现横向溢出

### Requirement: Terminal refit after dock changes

dock 展开/收起、键盘出现/消失、字体大小或控件缩放变化后，终端 MUST 在布局稳定后发送
一次 resize；连续变化 SHALL 合并为一次发送，避免 PTY 尺寸抖动。

#### Scenario: Collapse the key drawer

- **GIVEN** 按键板抽屉展开且终端尺寸已适配
- **WHEN** 操作者收起抽屉
- **THEN** 终端扩展到新高度并收到一次 resize
- **AND** 不会连续发送多次 resize

### Requirement: Touch target size

主要按钮的触控目标 MUST 不小于 40×40 CSS 像素（默认 44×44），并允许在设置中按
百分比缩放；缩放后 MUST 保持不重叠、不截断文字。

#### Scenario: Minimum targets

- **WHEN** 操作者使用默认缩放
- **THEN** 发送、按键板入口与方向键的命中区域均不小于 40px
- **AND** 相邻按钮之间至少保留 4px 间隙

### Requirement: Focus is preserved

点击按键、修饰符或发送 MUST NOT 收起软键盘或把焦点移出当前输入目标；只有显式聚焦
终端时才切换焦点。

#### Scenario: Tap a key while typing

- **GIVEN** 输入框已聚焦且软键盘打开
- **WHEN** 操作者点击按键板上的 Escape
- **THEN** Escape 被发送
- **AND** 输入框仍保持焦点，键盘不收起
