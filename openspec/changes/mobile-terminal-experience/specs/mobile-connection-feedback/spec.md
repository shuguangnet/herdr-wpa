# 移动端连接反馈

## Purpose

手机网络会频繁抖动、切后台、换 Wi-Fi。用户需要一眼看出当前是“手机没网”“桥不可达”
还是“Herdr 没运行”，并要求应用在恢复后自动回到可用状态，而不是让人反复刷新或重连。

## ADDED Requirements

### Requirement: Layered connection state

界面 MUST 区分并显示至少五种状态：`offline`（设备无网络）、`bridge-unreachable`
（HTTP/WS 无法连接桥）、`daemon-unavailable`（桥在，但 Herdr socket 不存在、协议不匹配
或版本过低）、`terminal-attached`（正常）与 `reconnecting`（正在重试）。状态文案
MUST 说明下一步可采取的动作。

#### Scenario: Daemon is not running

- **GIVEN** 手机能访问桥的静态页面
- **WHEN** `/api/snapshot` 返回上游错误且桥报告 daemon 不可用
- **THEN** 显示“Herdr 未运行或协议不匹配”，而不是“网络错误”
- **AND** 提供重试按钮与桥地址提示

#### Scenario: Phone lost Wi-Fi

- **GIVEN** 页面已连接
- **WHEN** 设备离线事件触发
- **THEN** 立即显示离线横幅
- **AND** 不把桥配置或已保存的会话当作失败原因

### Requirement: Offline input protection

离线或桥不可达时，发送、Stage 与按键输入 MUST 被禁用并保持草稿文本；恢复后草稿 MUST
仍在，且 MUST NOT 自动发送。

#### Scenario: Draft survives a tunnel

- **GIVEN** 操作者在输入框写了半条命令
- **WHEN** 手机短暂进入无网络状态再恢复
- **THEN** 草稿文本仍在输入框
- **AND** 恢复后没有任何自动发送

### Requirement: Automatic recovery

网络恢复、页面重新可见、桥重新可达时，应用 SHALL 自动重新建立事件与终端连接，并在
连接稳定后请求一次快照；重试 MUST 使用有上限的指数退避并加入抖动，避免多标签同时
重连打爆桥。

#### Scenario: Background then foreground

- **GIVEN** 应用在后台超过一分钟
- **WHEN** 操作者回到前台
- **THEN** 终端与事件连接恢复
- **AND** 快照刷新不超过一次（可合并），界面不闪烁

#### Scenario: Multiple tabs reconnect

- **GIVEN** 同一手机打开两个 herdr-web 标签
- **WHEN** 网络同时恢复
- **THEN** 两个标签的重连尝试在时间上错开
- **AND** 桥的日志没有连续的重连风暴

### Requirement: No destructive state flapping

单次请求超时或一次 WebSocket 关闭 MUST NOT 清空已加载的工作区、草稿或按键板；只有
明确的会话消失或连接键变化才 SHALL 重置对应状态。

#### Scenario: One transient timeout

- **GIVEN** 已加载 space 列表与草稿
- **WHEN** 一次 `/api/snapshot` 超时后下一次成功
- **THEN** 界面保持原数据，只短暂显示“正在重连”
- **AND** 草稿与按键板不丢失

### Requirement: Retry is explicit and debounced

手动重试按钮 MUST 在请求进行中禁用，并在完成后恢复；连续点击 MUST NOT 产生并发请求。

#### Scenario: Double tap retry

- **WHEN** 操作者快速点击重试两次
- **THEN** 只发起一次有效重连/快照请求
- **AND** 按钮在请求期间显示进行中状态
