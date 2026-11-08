# 移动端 PWA 壳

## Purpose

让“添加到主屏幕”的手机应用在刷新、切后台和弱网时不像白屏网页：应用壳可以离线打开，
连接状态清楚，新版本可被发现并更新，同时不引入内联脚本或破坏现有 CSP。

## ADDED Requirements

### Requirement: App shell is cached

service worker SHALL 预缓存构建产物中的 app shell（HTML、JS、CSS、字体、图标与
manifest）。离线重新打开时 MUST 渲染应用壳与连接状态，不得显示浏览器默认离线页。

#### Scenario: Offline cold start

- **GIVEN** 用户已在线打开过一次应用并完成安装
- **WHEN** 设备无网络时从主屏幕启动
- **THEN** 应用壳加载并显示离线状态与重试入口
- **AND** 不显示未样式化的 HTML 或空白页

#### Scenario: Terminal data is not cached

- **WHEN** 离线打开应用
- **THEN** 不显示上一次会话的终端内容或快照数据
- **AND** 恢复连接后重新请求真实快照

### Requirement: Cache versioning and cleanup

缓存 MUST 带构建版本；激活新 service worker 后 SHALL 删除旧版本缓存，且 MUST NOT
让新旧资源混用导致白屏或模块加载失败。

#### Scenario: Upgrade with stale tabs

- **GIVEN** 一个旧版本标签仍打开
- **WHEN** 新版本 service worker 激活
- **THEN** 旧标签仍可继续使用已加载资源
- **AND** 刷新后完整使用新版本资源

### Requirement: Update prompt

检测到新版本时 SHALL 显示非阻塞的更新提示，提供“稍后”和“立即更新”；点击立即更新
MUST 在安全时机激活新 service worker 并重新加载，不得在终端输入过程中静默打断。

#### Scenario: Update while typing

- **GIVEN** 新版本已下载完成
- **WHEN** 操作者正在输入命令
- **THEN** 更新提示出现但不强制刷新
- **AND** 选择“稍后”后当前输入不丢失

### Requirement: CSP and registration constraints

service worker MUST 由同源外部脚本注册，MUST NOT 使用内联 `<script>`，且 MUST 兼容
现有 `Content-Security-Policy`。注册失败（例如不支持或权限被拒）MUST 让应用继续以普通
网页方式工作。

#### Scenario: Registration blocked

- **GIVEN** 浏览器禁用 service worker
- **WHEN** 应用启动
- **THEN** 应用正常加载并连接桥
- **AND** 不显示重复错误或阻断交互

### Requirement: Standalone presentation

`display: standalone` 时 MUST 正确应用安全区、主题色与横竖屏布局；Android Capacitor
壳中 MUST NOT 依赖 service worker 才能启动，二者可独立工作。

#### Scenario: Capacitor start

- **GIVEN** Android APK 内的 WebView 不支持或未启用 service worker
- **WHEN** 应用启动
- **THEN** 从打包资源加载界面并连接已配置桥
- **AND** 不出现等待 SW 的白屏

### Requirement: No background push

本能力 MUST NOT 引入推送通知、后台同步或静默轮询；应用在后台时停止定期快照，恢复
可见后再刷新。

#### Scenario: Background battery

- **GIVEN** 应用切到后台
- **WHEN** 三分钟内没有用户操作
- **THEN** 不产生周期性快照请求
- **AND** 回到前台后发起一次刷新
