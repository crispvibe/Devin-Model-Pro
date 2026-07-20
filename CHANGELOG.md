# Changelog

## 2.4.20

- README 对比表修正：上游版本 Agent 能力改为"不支持"，移除平台行

## 2.4.19

- 文档安全：移除 README 和 CHANGELOG 中的上游域名引用，改为泛化描述

## 2.4.18

- README 更新：说明双模式（DevinLocal / Cascade）都支持，Mac + Windows 都支持，两种模式都支持子 Agent

## 2.4.17

- 修复 switchAccountMode 缺少 await 导致代理未完全启动就显示成功
- 代理重启失败现在会提示用户查看日志（不再误报成功）
- stopProxy 加错误处理
- deactivate 清理 setTimeout 避免扩展卸载后回调执行
- Cascade 模式补全 Windsurf 工具别名 passthrough（view_file/open_file/readFile 等）
- accountModeBadge 初始渲染改用模板变量（不再硬编码"未选择"）
- sidebar postMessage 加 try-catch 避免扩展关闭时静默失败

## 2.4.16

- 切换代理模式改为重启代理生效（不再重启窗口）

## 2.4.15

- 新增代理模式切换：DevinLocal（适用于 Devin Desktop）↔ Cascade（适用于 Windsurf IDE）
- UI 加模式切换卡片，切换后自动重启窗口生效
- Cascade 模式：保留 Cascade 身份 system prompt，不做 Windsurf→Devin 工具名转译
- DevinLocal 模式：行为不变（清洗 Cascade 身份，工具名归一化到 Devin 风格）

## 2.4.14

- 修复 subagentStart 会删除正在运行的 agent 的问题（改为只清理已完成）
- 修复在线更新 4xx 错误仍尝试其他镜像的问题（4xx 直接抛）

## 2.4.13

- Windows 适配 + 子 Agent 监控改进 + 在线更新修复（汇总发版）

## 2.4.12

- 启动后更新检查延迟从 10 秒改为 60 秒，等网络稳定再检查

## 2.4.11

- 修复在线更新 TLS 连接失败：
  - 加重试机制（3 次指数退避 1s/2s/4s），网络抖动自动重试
  - 加 GitHub 镜像 fallback（ghproxy.com、mirror.ghproxy.com），主 URL 失败后自动切镜像
  - 修复重定向 location 相对路径处理（用 new URL 转绝对路径）
  - 修复 downloadAndInstall 安装失败时 tmpPath 残留（改用 finally 清理）
  - 改进错误信息：区分 DNS 失败、TLS 重置、超时、连接拒绝，给用户具体建议

## 2.4.10

- 修复 Windows 证书安装 PowerShell 路径转义：用单引号字符串 + 数组形式 ArgumentList，路径含空格安全
- 修复证书安装提示文案平台判断：mac 显示"需要管理员权限"，Windows 显示"先尝试用户证书存储"

## 2.4.9

- Windows 证书安装适配：
  - isRootCATrusted 同时检查系统 Root store 和用户 Root store
  - installRootCA 加 3 级 fallback：用户 store（无需管理员）→ UAC 提权系统 store → 打开证书安装向导
  - 提示文案更新（Windows 先尝试用户存储，无需管理员权限）

## 2.4.8

- Windows 适配：
  - hybrid-server.js 硬编码 /tmp 改用 os.tmpdir()
  - extractWorkspacePath 支持 Windows 路径（C:\\path 或 C:/path）
  - subagent-executor.js shellQuote/toolGrep/toolFind/toolExec 平台适配（cmd.exe、rg.exe、Node 内置 find）
  - proxyManager.js spawn 加 shell:true（Windows 用 cmd.exe 解析 node）
  - patchManager.js 加 ProgramW6432/ProgramFiles(x86) 路径候选，进程名加 devin.exe/Devin Desktop.exe
- README 平台支持说明更新

## 2.4.7

- 子 Agent 监控加「清理」按钮，用户可手动清空所有 Agent 记录
- 修复 workspacePath 正则不支持路径含空格的问题
- 修复 pruneFinished 逻辑错误（判断总数而非已完成数）

## 2.4.6

- 修复子 Agent 监控只显示一个的问题：去掉 clearSubagents，并行执行所有子 Agent
- 子 Agent 完成后不再 5 秒自动删除，保留显示所有 Agent（超过 20 个自动清理最旧的）
- 子 Agent 图标改静态：运行中灰色圆环（无动画），完成 ✓，失败 ✗
- 子 Agent 卡片显示 turns 数

## 2.4.5

- 修复子 Agent 路径映射错误：从主 Agent system prompt 提取 workspace 路径，传给子 Agent 工具执行
  - grep/find/exec 默认用 workspace 路径作为 cwd，不再用代理进程目录
  - 子 Agent system prompt 注入 workspace 路径，LLM 知道项目位置用绝对路径
  - Claude 和 OpenAI/Codex 模型都生效

## 2.4.4

- Tab 重命名：「配置连接」→「模型选择」，「控制状态」→「设置」
- 修复 sidebar 晚于更新检查 ready 时红点丢失的问题（resolveWebviewView 补发缓存的更新结果）
- 删除冗余的 onView 激活事件（Devin Desktop 自动生成）

## 2.4.3

- 补丁备份加版本校验（sha256 manifest），客户端更新后不再用旧备份还原导致文件损坏
  - 还原时检测到客户端已更新，自动清理失效备份，提示用户重新安装补丁
  - 打补丁时检测到客户端已更新，清理旧备份重新备份当前文件再 patch
  - 前端补丁徽章显示「客户端已更新」红色提示
  - 自动启动时检测到客户端已更新，弹提示并自动重新创建备份安装补丁
- 修复改端口后补丁不更新 URL 的问题：URL 变化时还原原版后重新 patch
- 账号模式选择/切换改回 VSCode 系统弹窗，删自定义账号 modal
- 账号模式抽成独立卡片，放控制状态 Tab
- 更新弹窗简化：去更新日志块、进度条百分比文字、多余按钮
- modal 圆角改小，更新红点去 glow
- README 删在线更新板块

## 2.4.1

- 账号模式选择改成自定义弹窗 UI，不用 VSCode 系统弹窗
- 切换账号模式也用自定义弹窗，选完自动重启代理
- 修正切换模式提示文案

## 2.4.0

- 新增账号模式选择（Free / Pro），首次启动强制选择
  - Free 模式：只注入 swe-1-6 系列到第三方 API，swe-1-7 走官方
  - Pro 模式：只注入 swe-1-7 系列到第三方 API，swe-1-6 走官方
  - 侧栏控制状态 Tab 显示当前模式徽章，支持一键切换并自动重启代理
- 新增在线更新功能：从 GitHub Release 检查、下载 VSIX、自动安装、重载窗口
  - 启动后 10 秒静默检查，有新版给「检查更新」按钮加红点
  - 自定义弹窗 UI 显示版本号、更新日志、下载进度条
- README 按实际代码重写：和上游区别用表格列出（协议模式/Pro 用户/子 Agent/Agent 能力/模型管理）

## 2.3.0

- BYOK 本地子 Agent 执行带缓存，同一 tool_use 只跑一次
- 侧栏子 Agent 监控简化为任务卡片（运行中 spinner / 完成 ✓ / 失败 ✗）
- 移除多 IDE 窗口代理复用，简化为单窗口
