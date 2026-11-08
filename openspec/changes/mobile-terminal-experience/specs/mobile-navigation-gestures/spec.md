# 移动端导航手势

## Purpose

减少手机上反复点开侧栏与列表的操作：用横向滑动在 pane/tab 之间移动，用边缘手势回到
space 列表，并在需要时用下拉手势主动刷新快照，同时不与终端文本选择、横向滚动和
系统返回手势打架。

## ADDED Requirements

### Requirement: Swipe between panes and tabs

紧凑布局下，终端区域的横向滑动 SHALL 切换到相邻 pane 或 tab；切换阈值 MUST 为屏宽的
15% 或 48px（取较大者），并在达到阈值前提供跟手位移反馈。滑动 MUST 可被设置关闭，
关闭后不注册横向手势监听。

#### Scenario: Next pane

- **GIVEN** 当前 space 有两个以上 pane，且手势已启用
- **WHEN** 操作者从终端中部向左滑动超过阈值
- **THEN** 选择下一个 pane 并同步 pane selection
- **AND** 终端输入焦点仍留在可继续输入的位置

#### Scenario: Gesture disabled

- **GIVEN** 操作者关闭横向切换手势
- **WHEN** 操作者在终端上横向拖动
- **THEN** 不发生 pane/tab 切换
- **AND** 终端自身的横向滚动或选择行为不受影响

### Requirement: Edge swipe returns to the list

从屏幕左缘 24px 内开始的右滑 SHALL 打开 sidebar/space 列表；在列表页从右缘左滑 MAY
返回详情页。手势 MUST 使用浏览器返回栈等价行为（`history.back` 或同等状态），使得
Android 系统返回键与手势结果一致。

#### Scenario: Back to spaces

- **GIVEN** 操作者位于手机详情页
- **WHEN** 操作者从屏幕左缘向右滑动
- **THEN** 显示 space 列表，且浏览器历史增加或回退一致的条目
- **AND** 按 Android 返回键不会直接离开应用

### Requirement: Pull to refresh

详情页纵向在顶部下拉 SHALL 触发一次即时快照刷新，并显示进行中与完成状态；刷新期间
MUST NOT 重复触发，失败时 MUST 显示可读错误而不是静默回弹。

#### Scenario: Refresh fails

- **GIVEN** 桥当前不可达
- **WHEN** 操作者下拉刷新
- **THEN** 显示连接错误提示
- **AND** 恢复网络后不自动堆积多次刷新

### Requirement: Gestures never steal terminal input

手势识别 MUST 与终端文本选择、长按菜单、滚动和软键盘输入互斥：指针落在选择手柄、
滚动区内容、输入框或按键板上时 MUST NOT 开始导航手势。手势取消时 MUST 恢复原状态且
不发送任何终端输入。

#### Scenario: Drag a selection handle

- **GIVEN** 操作者正在拖动手柄选择终端文本
- **WHEN** 拖动跨过横向阈值
- **THEN** 不切换 pane
- **AND** 选择范围按原手势更新

### Requirement: Motion respects preferences

手势动画 MUST 在 `prefers-reduced-motion: reduce` 下退化为无动画的即时切换；动画期间
MUST 不阻塞终端输入与输出渲染。

#### Scenario: Reduced motion

- **GIVEN** 系统开启减少动态效果
- **WHEN** 操作者完成一次滑动切换
- **THEN** pane 立即切换，无滑动过渡动画
- **AND** 终端继续正常刷新

### Requirement: Desktop unaffected

宽度大于 820px 或精确指针设备 MUST NOT 注册移动端手势；桌面 split、快捷键与滚轮行为
保持现状。

#### Scenario: Desktop wheel scroll

- **GIVEN** 桌面浏览器窗口宽度 1200px
- **WHEN** 操作者横向滚动触控板
- **THEN** 不触发 pane/tab 切换
