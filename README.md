# Devin Model Pro

Devin Desktop / Windsurf IDE 增强插件，按账号模式注入 SWE 模型到第三方 API，其他请求原样透传官方。
支持 DevinLocal 和 Cascade 两种代理模式，两种模式都支持子 Agent 本地执行。
适用于 macOS 和 Windows。
**完全开源** | 本地运行 | 无后端服务器

## 项目说明

这是一个 Devin Desktop / Windsurf IDE 的本地代理插件，按你选的账号模式把对应版本的 SWE 模型转发到你自己的 API Key，其他请求原样透传官方。

- **Free 模式**：只注入 swe-1-6 系列到第三方 API，swe-1-7 走官方
- **Pro 模式**：只注入 swe-1-7 系列到第三方 API，swe-1-6 走官方
- **DevinLocal 模式**：适用于 Devin Desktop，清洗 Cascade 身份指令，工具名归一化到 Devin 风格
- **Cascade 模式**：适用于 Windsurf IDE，保留 Cascade 身份和 Windsurf 原生工具名
- **子 Agent 本地执行**：两种模式都支持，主 Agent 派出的子 Agent 在本地跑 LLM 循环 + 工具执行，可以多个同时跑
- **两个协议**：Claude（Anthropic）和 OpenAI
- **节点 + 模型管理**：可配多个节点，每个节点一组 API 地址 + Key，节点下挂多个模型

记得点个 Star，后续有空会继续维护。

## 和上游的区别

本项目 fork 自 [ycx932436/devin-byok-bridge](https://github.com/ycx932436/devin-byok-bridge)，并参考了 [jornlin/devin-byok-plus](https://github.com/jornlin/devin-byok-plus)。

感谢原作者 [@ycx932436](https://github.com/ycx932436) 打下的基础，开创了 Devin Desktop 本地代理的先河。也感谢 [@jornlin](https://github.com/jornlin) 的持续维护。

上游两个版本都是基于旧版 Windsurf 的 Cascade 模式做的，和本插件的核心区别：

| 对比项 | 上游版本 | 本插件 |
|--------|----------|--------|
| 协议模式 | 仅 Cascade | DevinLocal + Cascade 双模式可切换 |
| Pro 用户 | 只能二选一，全官方或全第三方 | 按账号模式分流，官方和第三方可以一起用 |
| 子 Agent | 不支持 | 两种模式都支持本地执行，支持多个并发 |
| Agent 能力 | Cascade 子集 | DevinLocal 全部 + Cascade 兼容 |
| 模型管理 | 槽位 | 节点 + 模型 |
| 平台 | 主要 Mac | Mac + Windows |

## 安装

在 Devin Desktop / VS Code 中：

1. `Ctrl+Shift+P` → **Extensions: Install Extension from Location...**
2. 克隆或下载本仓库，选择仓库根目录

若已打包 VSIX，也可用 **Install from VSIX...**。

## 快速开始

1. 点击左侧 **Devin Model Pro** 图标打开控制面板
2. 首次启动会弹窗让你选账号模式（Free / Pro），决定注入哪个 SWE 版本
3. 在 **模型选择** Tab 点 **+ 节点** 添加一个节点，填第三方 API 的地址和 Key
4. 选中节点后点 **拉取** 加载模型列表，选你要用的模型
5. （可选）从 **Protocol** 下拉手动选 anthropic / openai，空值自动按模型名识别
6. 点顶部 **启动** 按钮
7. 在 **设置** Tab 点 **安装补丁**，把 Devin 内部 API 指向本代理
8. 重载窗口生效

> 配置字段输入后自动保存，不用手动点保存按钮。

## 使用教程

侧栏第三个 Tab **使用教程** 里有完整操作流程，主要几步：

![使用教程 Tab 效果](media/tutorial.png)

1. **代理模式**：侧栏设置 Tab 选 DevinLocal 或 Cascade。DevinLocal 适用于 Devin Desktop，Cascade 适用于 Windsurf IDE。切换后自动重启代理生效。两种模式都支持子 Agent。
2. **运行模式**：DevinLocal 模式在 Devin 输入框底部把模式切到 DevinLocal；Cascade 模式在 Windsurf IDE 里正常使用。Free 账号和 Pro 账号都能用。
3. **账号模式**：首次启动强制选 Free 或 Pro，决定注入哪个 SWE 版本：
   - Free：只注入 `swe-1-6` / `swe-1-6-medium` / `swe-1-6-fast` / `swe1.6` / `swe-1.6`
   - Pro：只注入 `swe-1-7` / `swe-1-7-medium` / `swe-1-7-max`
   - 没注入的 SWE 版本走官方
4. **填配置**：在模型选择 Tab 点 + 节点添加一个节点，填第三方 API 的地址和 Key，选中节点后点拉取加载模型列表，选你要用的模型。
5. **装补丁**：在设置 Tab 点安装补丁，把 Devin 内部 API 指向本代理。装完重载窗口生效。
6. **启动代理**：点顶部启动按钮。运行后日志显示在设置 Tab。

## 工作原理

代理拦截 Devin Desktop / Windsurf IDE 发出的请求，按代理模式、账号模式和模型名分流：

- **DevinLocal 模式**：适用于 Devin Desktop，清洗 Cascade 身份指令，工具名归一化到 Devin 风格（`read_file` → `read`）
- **Cascade 模式**：适用于 Windsurf IDE，保留 Cascade 身份和 Windsurf 原生工具名（`read_file` / `grep_search` 等原样回传）
- **Free 账号**：`swe-1-6` 系列走你配置的第三方 API，`swe-1-7` 系列走官方
- **Pro 账号**：`swe-1-7` 系列走你配置的第三方 API，`swe-1-6` 系列走官方
- **其他所有请求**（官方 Claude / GPT / 搜索 / Embeddings 等）→ 原样透传官方

这样官方模型走官方额度，只有你选的 SWE 版本走你自己的 Key，两个版本可以共存。

## 账号模式

首次启动代理会强制弹窗选 Free 或 Pro，选择后存到本地，之后可以改。

- **Free**：注入 swe-1-6 系列，Free 账号用第三方跑 1.6（swe-1-7 走官方，Free 账号无官方额度会失败，用 1.6 即可）
- **Pro**：注入 swe-1-7 系列，Pro 账号用第三方跑新版本，官方额度留着跑其他模型（swe-1-6 走官方）

切换方式：
- 侧栏设置 Tab 显示当前模式徽章，点「切换」按钮改模式，自动重启代理
- 命令面板搜「Devin Model Pro: 切换账号模式」

## 代理模式

侧栏设置 Tab 可切换代理模式，决定拦截哪个上游域名：

- **DevinLocal**（默认）：适用于 Devin Desktop。清洗 Cascade 身份指令，工具名归一化到 Devin 风格
- **Cascade**：适用于 Windsurf IDE。保留 Cascade 身份和 Windsurf 原生工具名

两种模式都支持子 Agent 本地执行。切换后自动重启代理生效，代理没运行时下次启动生效。

切换方式：
- 侧栏设置 Tab 点「切换代理模式」按钮
- 命令面板搜「Devin Model Pro: 切换代理模式」

## 子 Agent

Devin 主 Agent 派出的子 Agent 会在本地执行，跑一个 LLM 循环 + 工具调用，复用主 Agent 的工具定义和你的模型配置。DevinLocal 和 Cascade 两种模式都支持。

- **subagent_explore**：只读探索模式，用 grep / glob / read / web_search
- **subagent_general**：完整工具访问，能读写文件、跑命令
- 支持多个子 Agent 同时跑
- 子 Agent 结果会回传给主 Agent

## 节点与模型

用节点 + 模型方式管理第三方 API。一个节点 = 一组 API 地址 + Key，节点下可以挂多个模型。

- 点 **+ 节点** 添加节点，填 Base URL 和 API Key
- 选中节点后点 **拉取** 从该节点加载可用模型列表
- 选要用的模型，Devin 发请求时按模型名识别走哪个节点
- 可配多个节点，分别指向不同网关或不同厂商

## 思考强度

切换模型后下拉选项按厂商自动变化，档位 `low` / `medium` / `high` / `xhigh` / `max`。

- Claude 新模型走自适应思考 + effort 参数
- Claude 旧模型走固定思考预算
- GPT 走 `reasoning.effort`，默认用 Responses API，不支持时自动回退到 Chat Completions
- Claude 多轮历史里没签名的思考块默认会被剔除，避免报 `signature: Field required`

## 系统提示词清洗

DevinLocal 模式下代理会自动清理 Devin 发来的系统提示词里的伪造身份指令，包括：

- "You are Cascade..."
- "driven by Cognition's SWE-x.x..."
- "If asked who you are, answer Cascade..."

避免第三方模型被误导成 Cascade 身份。Cascade 模式下保留原样不清洗。

## 平台支持

- **Mac**：原生支持，作者 anna 在 Mac 上开发和测试
- **Windows**：已完整适配，包括补丁路径查找（ProgramW6432/ProgramFiles x86）、进程管理（taskkill/netstat/wmic）、证书安装（certutil，优先装到用户证书存储无需管理员权限）、子 Agent 工具执行（cmd.exe/Node 内置 find）、路径处理（os.tmpdir）
- **Linux**：未测试，理论可用

两种代理模式（DevinLocal / Cascade）在 Mac 和 Windows 上都支持。

## 环境变量

插件会自动写入 `proxy-scripts/.env`（已被 `.gitignore` 排除，不会上传）。想手动改参考 `proxy-scripts/.env.example`。

节点配置（n = 1..4，按节点顺序）：

```
BYOKn_ANTHROPIC_API_HOST=
BYOKn_ANTHROPIC_API_KEY=
BYOKn_OPENAI_API_HOST=
BYOKn_OPENAI_API_KEY=
BYOKn_OPENAI_SERVICE_TIER=    # fast 或空，OpenAI 优先级通道
BYOKn_MODEL=
BYOKn_THINKING_EFFORT=        # low | medium | high | xhigh | max
BYOKn_PROTOCOL=               # anthropic | openai | 空（自动识别）
```

通用：

```
HYBRID_PORT=3006              # 聊天代理端口
INFERENCE_PORT=3001           # 补全代理端口
MAX_TOKENS=64000
ADMIN_TOKEN=                  # 可选，设了之后改配置要带这个 token
```

可选：

- `STRIP_UNSIGNED_THINKING=false` — 保留没签名的 Claude 思考块
- `GATEWAY_CAPABILITY_TTL_MS=3600000` — 网关能力缓存时间
- `VOYAGE_API_KEY=` — Embeddings 走 Voyage 时需要
- `PROMPT_CACHE_ENABLED=true` — Prompt Cache 总开关
- `ANTHROPIC_PROMPT_CACHE=true` — Claude 请求打缓存断点
- `OPENAI_PROMPT_CACHE=observe` — GPT 前缀缓存模式

## 打包

```bash
npm run build
npm run package
```

生成 `devin-model-pro-{version}.vsix`，拖进 Devin Desktop 或 `code --install-extension` 安装。

## 已知限制

- 代码补全只走 Anthropic 通道，暂不支持 GPT 补全
- GPT 没有独立的 Devin 入口，要在节点模型里选 GPT 模型
- 你的 API 网关要支持对应接口：Claude `/v1/messages`；GPT 优先 `/v1/responses`，不支持时回退 `/v1/chat/completions`

## 常见问题

**补丁失效**：Devin Desktop 更新后重新安装补丁并重载窗口。

**端口占用**：改代理端口后重启代理。

**启动失败**：检查 Node.js、API Key、侧栏日志。

**模型列表加载失败**：检查 Key、余额、网络，确认网关兼容。

**思考无效果**：确认强度没选关闭，Claude 新模型要网关支持自适应思考。

**Bedrock 报 `signature: Field required`**：历史消息里有没有签名的思考块，默认会自动剔除；还失败就新开对话。

**GPT 报 `convert_request_failed`**：网关不支持 `/v1/responses`，代理会自动回退；还失败就在高级路由里手动设 OpenAI API Path。

## 免责声明

本项目仅供学习和研究使用，不得用于商业用途。

- **风险自负**：使用本工具产生的一切后果由使用者自行承担
- **无担保**：本项目按"原样"提供，不提供任何明示或暗示的担保
- **无关联**：本项目与 Devin / Cognition / Codeium / Windsurf 官方无任何隶属或授权关系
- **合规风险**：使用本工具可能违反 Devin / Codeium 的服务条款，请自行评估风险
- **数据安全**：本工具不收集任何用户数据，API Key 和配置仅存储在本机

「安装补丁」会直接修改 Devin Desktop 内置 `extension.js`，IDE 升级后补丁可能失效，安装前会自动备份原文件（`.devin-bak`）。

本地代理默认监听 `127.0.0.1`，请勿把端口暴露到公网。

## License

MIT License
