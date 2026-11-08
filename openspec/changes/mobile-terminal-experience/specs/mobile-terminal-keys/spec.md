# 移动端虚拟按键

## Purpose

让单手操作手机时能像在物理键盘上一样发送终端输入：常用键一键可达，组合键不必每次
从头拼装，键位可以按个人习惯重排并跨设备迁移，同时不破坏既有终端输入与桌面端行为。

## ADDED Requirements

### Requirement: Editable key board

移动端 SHALL 提供一个 7 列布局的按键板，单键可占用 1–3 列、1–2 行；整板行数 MUST
在 1–8 之间。按键板 MUST 持久保存在本设备，并按版本号校验；缺失、截断、未知版本或
单键非法的数据 SHALL 回退到默认板，不得抛异常或只恢复一半布局。

#### Scenario: Edit and keep a board

- **GIVEN** 操作者在手机上打开按键板编辑器
- **WHEN** 操作者新增一个两列宽的 `Ctrl-R` 键、移动一个方向键并保存
- **THEN** dock 立即按新布局渲染
- **AND** 重新打开页面后布局保持不变

#### Scenario: Corrupt storage falls back

- **GIVEN** `localStorage` 中的按键板 JSON 被手工改坏或来自更高版本
- **WHEN** 页面加载按键板
- **THEN** 使用默认板渲染，不出现空白 dock 或未捕获异常
- **AND** 不覆盖原值以外的其他偏好

### Requirement: Default board covers daily keys

默认按键板 SHALL 至少包含 Escape、Tab、Enter、Backspace、四个方向键、`Ctrl-C`、
`Ctrl-D` 与一个修饰符键；方向键 MUST 在首屏可直接触达，不需要打开二级面板。

#### Scenario: Arrow keys are one tap away

- **GIVEN** 操作者首次在手机上打开终端
- **WHEN** 操作者按默认板上的↑
- **THEN** 终端收到 `ESC [ A` 对应字节
- **AND** 不需要先展开“更多键”

### Requirement: Chord keys send ordered steps

单键 SHALL 支持 1–4 步 chord，每步最多三个修饰符加一个可打印字符或命名键；多步 chord
MUST 按声明顺序发送，且不得插入额外可打印字符。非法 chord（未知键名、重复修饰符、
超过步数上限）MUST 在保存时被拒绝并给出可读原因。

#### Scenario: tmux prefix then new window

- **GIVEN** 一个 chord 键保存了 `ctrl+b` 后 `c`
- **WHEN** 操作者点击该键
- **THEN** 终端依次收到 `\x02` 与 `c` 两个输入单元
- **AND** 两步之间不出现用户可见的额外换行或提示

#### Scenario: Invalid chord is refused

- **WHEN** 操作者在编辑器里输入 `ctrl+hyper+x` 或五步 chord 并保存
- **THEN** 保存被拒绝并显示具体原因
- **AND** 现有板与新键都保持不变

### Requirement: Sticky modifiers

按键板 MUST 提供 Ctrl、Alt、Shift 三个 sticky 修饰符，状态为关闭、一次性（arm）和
锁定（lock）。一次性状态在发送一个键后 MUST 自动清除；锁定状态 MUST 在再次点击或
关闭 dock 时清除，且当前状态在视觉与无障碍属性上可见。

#### Scenario: One-shot Ctrl

- **GIVEN** 操作者点一次 Ctrl，状态变为一次性
- **WHEN** 操作者点击 `r`
- **THEN** 终端收到 `Ctrl-R`
- **AND** Ctrl 状态回到关闭，下一次 `r` 是普通字符

#### Scenario: Locked modifier survives taps

- **GIVEN** 操作者把 Shift 切换为锁定
- **WHEN** 操作者连续点击 `a` 与 `b`
- **THEN** 终端收到两次带 Shift 的输入
- **AND** 再次点击 Shift 后状态清除

### Requirement: Dangerous keys are confirmed

`Ctrl-D`、`Ctrl-Z` 与用户标记为危险的键 MUST 在首次点击时显示可取消的确认（按钮或
就地二次确认），确认后才发送；键盘与读屏用户 MUST 能用 Enter/Escape 完成或取消。

#### Scenario: Ctrl-D needs a second action

- **WHEN** 操作者点击默认板上的 `Ctrl-D`
- **THEN** 终端不立即收到输入，而是显示确认
- **AND** 按 Escape 或点击取消后不发送任何字节

### Requirement: Press repeat and haptics

可重复键（方向键、Backspace、Space）SHALL 支持按住重复，首次延迟约 400ms、间隔约
60ms，并在指针离开、页面隐藏或网络断开时停止。支持 `navigator.vibrate` 的设备 SHALL
在按键发送时给出 8–12ms 触觉反馈；触觉 MUST 可关闭，并在
`prefers-reduced-motion: reduce` 下默认关闭。

#### Scenario: Hold an arrow

- **GIVEN** 终端已连接且页面可见
- **WHEN** 操作者按住↓超过 500ms
- **THEN** 终端收到多次方向输入
- **AND** 松手、切到后台或断开后不再继续发送

#### Scenario: Haptics off

- **GIVEN** 操作者在设置中关闭触觉反馈
- **WHEN** 操作者点击任意按键
- **THEN** 按键仍发送，但不调用 `navigator.vibrate`

### Requirement: Layout portability

按键板编辑 SHALL 支持导出与导入布局码，格式 MUST 带版本前缀并限制长度；导入非法、
超长或未知版本的布局码 MUST 被拒绝并保持当前板不变。

#### Scenario: Move a board to another phone

- **GIVEN** 操作者在手机上导出布局码
- **WHEN** 在另一台设备粘贴并导入
- **THEN** 新设备渲染相同键位
- **AND** 导入失败时不修改本地板

### Requirement: Accessible and non-disruptive

每个按键 MUST 有可读名称与按下状态；按键操作 MUST 不夺走终端或输入框的软键盘焦点。
按键板 MUST NOT 改变桌面端快捷键、桌面 split 交互或既有 `/ws/terminal` 输入格式。

#### Scenario: Screen reader names

- **WHEN** 读屏用户遍历按键板
- **THEN** 每个键读出名称、当前 sticky 修饰符状态与危险标记
- **AND** 发送后焦点仍停留在可继续输入的位置
