# dsh-abap-adt — ABAP Development Tools for DeepSeek Harness

[![npm](https://img.shields.io/npm/v/@nefevcore/abap-adt-dsh-plugin?label=%40nefevcore%2Fabap-adt-dsh-plugin)](https://www.npmjs.com/package/@nefevcore/abap-adt-dsh-plugin)
[![license](https://img.shields.io/badge/license-MIT-green)](#许可证)
[![tests](https://img.shields.io/badge/tests-288-brightgreen)](#测试)
[![dsh plugin](https://img.shields.io/badge/dsh--plugin-listed-blue)](https://github.com/topics/dsh-plugin)

> **English** — Agent-native SAP ABAP access for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): a Cordis plugin that speaks the SAP ADT REST protocol directly (`/sap/bc/adt`; no SAP libraries, no IDE) and registers **46 `adt_*` tools** covering the full loop *search → read → edit → activate → unit test → ATC → transport → execute → debug → error analysis*, plus agent-scale capabilities (protocol-level `$batch`, whole-package release gates, DDIC structured editors, one-step table creation from field lists, conflict-checked local snapshots, local export, offline abaplint, method-level read/edit, dependency-contract context prologues, a read-only capability sweep, transport co-change analysis) and conversational destination management (create connections from the local SAP GUI list by just chatting). Governance is two-sided: write-side per-destination policy knobs with dev/qa/prd environment profiles, read-side sensitive-table blocklists for data preview. Releasing a transport is deliberately a human decision and not exposed as a tool. Ships with a zero-config mock server, so you can try everything without an SAP system. Agent-facing usage guide with the critical limitations first: [docs/agent-guide.md](docs/agent-guide.md).

在 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 上直接访问 SAP ABAP 系统的插件与协议客户端。

本插件**直接实现 SAP ADT（ABAP Development Tools）REST 协议**（`/sap/bc/adt`），不依赖任何 SAP 闭源库，也无需任何 IDE（headless 运行）。AI 代理获得了一整套 `adt_*` 原生工具，可以自主完成搜索 → 阅读 → 修改 → 激活 → 测试 → 传输的完整开发闭环，并提供代理尺度的批量能力（整包质量报告、源码导出、离线检查、发布门禁）。

> 🔎 **找 DSH 插件？** 本仓库已打上 GitHub Topic [`dsh-plugin`](https://github.com/topics/dsh-plugin)（另见 [`deepseek-harness`](https://github.com/topics/deepseek-harness)）；npm 上检索关键词 `dsh-plugin` 也能找到本插件。

## 安装与更新

安装和更新只支持 **dsh CLI** 一种方式（要求 pnpm 在 PATH——`corepack enable` 或 `npm i -g pnpm`；缺失时 dsh 会明确报错）。四个包均已发布到 npm（`@nefevcore/abap-adt-protocol` 协议客户端、`@nefevcore/abap-adt-mock` 内置 mock、`@nefevcore/abap-adt-core` 纯内核、`@nefevcore/abap-adt-dsh-plugin` DSH 宿主适配）：

```bash
# ① 安装（装进 web profile；仅安装，不自动加载）
dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin

# ② 生成按会话启用的 agent 预设（一次性；复制 standard 预设、追加插件行、剔除 tool-cordis/skill-filesystem 行，并把 persona 替换为 ABAP 专属人设——含工具指引/开发流程/传输请求纪律：修改前向用户要请求号）
dsh plugin --profile web exec abap-adt-preset

# 更新到最新版（更新不会动你的预设与配置）
dsh plugin --profile web update @nefevcore/abap-adt-dsh-plugin

# 或锁定指定版本
dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin@0.2.0
```

**默认不加载，按会话启用（by design）**：包内不声明 `dsh.bundle`，安装只是把包放进 profile 的依赖里——`adt_*` 工具**只出现在用 `abap-adt` 预设创建的会话**，其他会话完全不受影响。安装时 dsh 会提示 `declares no dsh.bundle — installed as a plain dependency`，这正是预期行为。

### 架构：纯内核 + 宿主适配（多宿主共用一份引擎）

0.7.0 起仓库分为**纯内核**与**宿主适配**两层：

- **`@nefevcore/abap-adt-core`（纯内核）**——全部 46 个 `adt_*` 工具、目的地注册表、双向治理策略、OCC 快照、锁账本、调试器会话、配置分层。零 DSH 依赖，主入口 `assembleAdtTools(deps, host)` 聚合工具目录（参数已是标准 JSON Schema），并导出 `AdtRegistry` / `LockLedger` / `DebuggerManager` / `composeLayers` / `deepCompact` 等全部引擎件。宿主适配三个结构化缝（定义在内核 `src/tooldef.ts`）：

  - `ToolHost.get('fs')` → `AdtFileSystem`（快照/导出/本地检查的文件面；DSH 的 dsh-fs 服务结构兼容，其他宿主给小适配器）
  - `ToolHost.get('credentials')` → 密码引用解析缝（`ADT_<NAME>_PASSWORD` 词汇）
  - `ToolHost.get('host')` → 宿主环境声明缝（内核 `src/hostprofile.ts`）：宿主声明身份与凭证存储词汇，凭证相关文案/引导随宿主自适应；未声明按能力推断、措辞宿主中立。`workspaceConfigDir` 字段声明**工作区 destinations 目录**（存储权威 = `AdtRegistry.create({ hostProfile })`，DSH 声明 `.dsh-abap-adt`，其他宿主可用自己的目录，如 AgentChat 数据根下的 `.agentchat/abap-adt`；未声明默认 `.dsh-abap-adt`，既有工作区不受影响）
  - 执行上下文 `exec.signal` + `exec.agent.session.header.cwd`（per-call 工作区锚点）

- **`@nefevcore/abap-adt-dsh-plugin`（DSH 宿主适配）**——`abap-adt` settings 命名空间（`~/.dsh/settings.yaml` 热更）+ DSH 工具注册边界（lossless-JSON 消毒）+ `abap-adt-preset` CLI；内核 API 全量 re-export，存量消费者无感。

- **AgentChat 内置行 `ac-sap-adt`**（[AgentChat 仓库](https://github.com/nefevcore/AgentChat) `src/ac-sap-adt/`）——第二宿主适配：46 工具带 `sap-adt` 能力标签门禁（Agent tags 显式授予才可见）；fs 缝 = 数据根子树内的 node:fs 适配器，credentials 缝 = 加密凭据存储；依赖 `@nefevcore/abap-adt-core`（semver），demo 目的地同样开箱即用。

  （0.6.0 曾以 dsh-plugin 包的 `./agent` 子路径过渡；0.7.0 起独立成包。）

②生成的预设：复制 `standard` 预设（完整编码代理、不含插件开发工具集）到 `~/.dsh/.agent-presets/abap-adt/`，追加插件行、剔除源里可能携带的 `tool-cordis` / `skill-filesystem` 行，并**将 persona 替换为 ABAP 专属人设**（常用工具使用指引、开发流程指引，以及传输请求纪律：修改前必须向用户索取请求号并显式传 `transport`，绝不省略让后端自行建任务；释放传输保持人工决策）。刻意不复制部署默认预设——默认为 `cordis` 时会带入 `tool-cordis`（其 Host Cordis inspect provider 与活动 cordis 会话冲突），需要时 `--from` 可覆盖。支持 `--id/--from/--name/--force/--dry-run`。重启 DSH 后新建会话，在预设 chip 选「ABAP Development」即可。手工建预设的说明见 [`presets/abap-adt.example/`](presets/abap-adt.example/README.md)。

DSH 的 profile 由 pnpm 管理（`~/.dsh/profiles/web/` 下有 `pnpm-workspace.yaml`），**不要用 npm 装进 profile**（会生成 package-lock 并破坏 pnpm 布局）。**装/更新插件、新建预设后重启 DSH**；之后的配置变更免重启热生效——连接真实系统的 `destinations` 推荐放**工作区配置** `<工作区>/.dsh-abap-adt/destinations.yaml`（对话式创建见下），全局兜底/权限开关配置在 `~/.dsh/settings.yaml` 的 `abap-adt:` 段（见下方「配置分层」）。

### 从 0.1.0 升级

#### 0.7.1（宿主自适应密钥管理 + destinations 目录随宿主声明）

修复"非 DSH 宿主被引导去编辑永远不会被读取的 `~/.dsh/...` 文件"的问题，并把工作区 destinations 目录变为宿主可声明：

- **宿主环境检测缝（内核 `src/hostprofile.ts`）**：新可选服务 `ctx.get('host')` 返回 `HostProfile`（身份 / 凭证存储词汇 / 密码引用解析链 / 全局配置层提示）。`adt_create_destination` 的工具与参数描述、结果 notes/hint、destinations.yaml 自文档注释与文件头全部按当前宿主措辞——DSH 输出与 0.7.0 **逐字节一致**（测试锁定）；未声明宿主按能力推断（挂了凭证服务 → 通用"host credential store"；没挂 → 只引导环境变量），无凭证存储时明文回退的警告会指明 `ADT_<NAME>_PASSWORD` 环境变量这条路。
- **`HostProfile.workspaceConfigDir`**：宿主声明工作区 destinations 目录（`<cwd>/<dir>/destinations.yaml`）。存储权威 = `AdtRegistry.create(config, { hostProfile })`；未声明默认 `.dsh-abap-adt`（DSH 显式声明同名，既有工作区零变化）。`workspaceConfigCandidates/Path` 增加 `configDir` 参数，注册表新增 `workspaceConfigDir` getter，工具描述如实报告本宿主目录。
- 消费方升级：DSH 用户照旧 `dsh plugin --profile web update @nefevcore/abap-adt-dsh-plugin`（无需重建预设）；AgentChat 等其他宿主在适配层声明自己的档案（`ctx.get('host')` 门面 + `AdtRegistry.create` 各一处）即可获得自己的凭证存储措辞与目录。
- 测试 288 → **300**（新增 `hostprofile.test.ts`：声明/推断/中立/只读存储/目录迁移五类路径）。

#### 0.6.0（治理 + 调试器 + 对象能力，P0/P1 全量落地）

源自 [`docs/agent-experience-upgrade-plan.md`](docs/agent-experience-upgrade-plan.md) 的完整实施批次：

- **读侧敏感表黑名单（P0-1）**：`blockedTablesProfile`（off/minimal/standard/strict，默认 off——opt-in）+ `blockedTables` 自定义追加 + `allowedTables` 豁免（审计 note + logger）。`adt_data_preview` 两条路径**发请求前**解析目标表（SQL 走 FROM/JOIN 提取器）过目录——命中即 `[POLICY] blockedTables: <表> — <类别>: <理由>`，**零 SAP 请求**，deny 无逐调用豁免。目录按类别+tier+why 编目（银行/客户供应商 PII/地址/认证/HR/税务 ⊂ 交易单据 ⊂ 审计日志/通信/`Z*`）。
- **写侧环境分级（P0-2）**：目的地 `profile: dev|qa|prd`（默认 dev）——qa 把 execution/batchWrites（及 debugger）未显式配置时默认收 false；prd **硬拒**三者（显式开也拒，报错含 `profile: prd`，fail-closed 无 prd 白名单）。
- **工具描述 RAG 工程（P0-3）**：全部工具描述动词前置 + ADT 类型码（CLAS/TABL/DDLS…）与事务码别名（ST22/SE16/SE10/SA38/ATC/SAUNIT…）富化——面向 Cline/Cursor 类 embedding 检索选工具的客户端。
- **CSRF 预热核实（P0-5）**：已核实首写请求**不裸奔**（token 探针先于任何非 GET 请求发出、缓存复用、403 失效重探重试一次）——`quirks.test.ts` 两个测试锁定该顺序。
- **Debugger 工具组（P1-1）**：5 个 `adt_debug_*` 工具（session listen/status/detach、breakpoint set/delete、step F5–F8/terminate、inspect variables/stack、set_variable）走**标准 ADT REST 调试器**（`/sap/bc/adt/debugger/*`，零服务端安装）。会话身份插件级持有（一个 ADT 会话一个调试会话、detach 不可重 attach——插件卸载自动 detach）；`/debugger/stack` 7.50 缺失探测缓存；策略 `allowDebugger`（默认 false）+ 变量写入双重 opt-in `allowDebugVariables`；prd 硬拒。
- **TABL 带字段一步创建（P1-2）**：`adt_create_object {type: TABL, fields: [...]}` → DDIC 2.0 DDL（自动 MANDT、`@AbapCatalog.*` 注解、内建类型映射）→ blueSource 创建 → 锁内写 → **激活**一条龙，输出回显生成的 DDL；空 fields 数组报错不静默；无 fields 保持占位创建。
- **文本元素读取（P1-3）**：`adt_read_textelements`（PROG/REPT）——标准端点读文本符号/选择文本/列表标题，TEXTPOOL 形状（ID/KEY/ENTRY/LENGTH）；写侧待真实系统验证 PUT 格式后开放。
- **co-change 分析（P1-4）**：`adt_cochange`——输入对象 → 版本历史传输号 → 请求条目展开 → 按共享传输数排序共现对象（截断纪律：top/maxTransports 钳制均写 note；输入无版本 feed 可见列出）。
- **agent-guide 增补（P0-4）**：写前 Before/After diff 展示义务、大改先 `adt_check` 再写（check→lock→write→activate 顺序）；读侧治理与 profile 说明。
- **Compact CRUD 门面（P2 提前落地，用户决策）**：`src/crudmatrix.ts` 单一事实源（verb × 13 类型 × 归属工具）驱动一切——`adt_crud {verb, type, …}` 门面按矩阵路由到**专用工具**原样执行（owner 的策略/OCC/持久化链原封不动，`routedTool` 回显实际执行者；无 verb 调用返回能力矩阵卡；不支持的 verb×type 列出该类型支持什么）；`adt_create_object` 类型枚举由矩阵派生；parity 测试锁定 矩阵 ↔ 协议 createByType ↔ 目录 ↔ tool-reference 矩阵表（第五道发布数字锁）。**长尾规则生效**：将来 BDEF/SRVD/SRVB/屏幕/DDLX 超过 ~5 类时只加矩阵行 + 协议端点，不再加细粒度工具。
- 测试 246 → **288**；工具 38 → **46**（目录 pin / selfcheck UNPROBED / README 徽章 / tool-reference + **CRUD 矩阵表** 五处同步）。

#### 0.5.0（安全修复 + 代理体验双批次，首个包含下述 0.4.0 内容的发布版）

**A. 安全与保真度修复**——0.4.0 审计批次首次随本版发布（原 0.4.0 号未发布，内容完整包含在此）：策略绕过三类修复（包名 hint 不可欺骗白名单、拼错名绝不模糊回退、`$batch` 头注入/编码路径封死）、SSRF 凭证转发封堵、SQL/`$query` 插值白名单、响应 body 超时覆盖、锁账本原子写与 `adt_write_structure` 锁登记、导出路径消毒、fs 降级真实生效、上下文炸弹全线上限、mock 保真度约 30 项；另含 MSAG URI 双拼写 404 重试、传输/版本工具 schema 富化与服务缺失回退、工作区 destinations 文件**自文档化**（未设置的每个选项以注释行写出默认值与用途）。

**B. 代理体验批次**（源自 vsp / abap-mcp-adt-powerup 同类工具调研，详见 [`docs/agent-experience-upgrade-plan.md`](docs/agent-experience-upgrade-plan.md)）：
- **方法级读写**：`adt_read_object` / `adt_edit_object` 新增 `method` 参数——只收发一个 METHOD 块（编辑走完整 OCC 冲突链）
- **依赖契约序言**：`adt_read_object {context: true}` 一次读取带回所用类/接口的公共契约（超类/接口优先；解析失败的依赖原样列出）
- **能力巡检**：新工具 `adt_selfcheck`（第 38 个）——只读扫描判定 answered/empty/dead/absent/broken，交叉 oracle 验证，未巡检工具显式列出
- **截断纪律**：dumps 等列表"多取一行"区分满页与还有更多；截断话术单一来源
- **路由守卫**：`adt_read_object` 对 MSAG/DOMA/DTEL/TTYP 直接指向 `adt_read_structure`、DEVC 指向 `adt_package_content`
- **面向 AI 的指南** [`docs/agent-guide.md`](docs/agent-guide.md)（限制先行：ABAP SQL 方言、写≠激活、OCC 契约等）
- 测试 222 → **246**；工具 37 → **38**（目录计数已由测试锁定，漂移即测试失败）

升级命令同 0.2.0 的两步（update + 重建预设）。

#### 0.4.0（未单独发布）

安全与保真度审计批次（全量缺陷审核关闭，详见 [`docs/audit-fix-plan.md`](docs/audit-fix-plan.md)）——**0.4.0 版本号从未发布，全部内容随 0.5.0 一并上线**（细目见上方 0.5.0 的 A 节）。

#### 0.2.0（默认不加载 + 配置迁 settings）

0.2.0 改为**默认不加载**（全局层自动退场）且配置迁入 settings，升级后需做两件一次性操作：

```bash
# ① 更新（reconcile 会自动把插件移出全局 bundle 层——工具从默认会话消失是预期的）
dsh plugin --profile web update @nefevcore/abap-adt-dsh-plugin

# ② 重建预设（若 0.1.0 时代已手工建过 ~/.dsh/.agent-presets/abap-adt/，加 --force 覆盖）
dsh plugin --profile web exec abap-adt-preset --force
```

然后把 `~/.dsh/abap-adt.yml`（0.1.0 的外部配置文件，已废弃）的内容**整体缩进两格**并入 `~/.dsh/settings.yaml` 的 `abap-adt:` 段并删除旧文件（不迁会有 deprecation 告警；模板见 [`presets/abap-adt.example/settings-section.example`](presets/abap-adt.example/settings-section.example)）。最后重启 DSH,新会话选「ABAP Development」预设。

## 核心能力

- **代理原生工具**：46 个 `adt_*` 工具，AI 自主编排多步开发流程
- **双向治理**：写侧 per-destination 策略（11 开关 + dev/qa/prd profile——prd 硬拒执行/批量写/调试器）；读侧敏感表黑名单（三档目录，deny 零请求拒绝，豁免审计留痕）
- **ABAP 调试器（零安装）**：`adt_debug_*` 五件套走标准 ADT REST——断点/监听/单步/栈/变量（写值双重 opt-in）
- **TABL 一步建表**：fields 字段清单 → DDIC 2.0 DDL → 创建+激活一条龙（自动 MANDT）
- **文本元素 / 协变分析**：`adt_read_textelements`（TEXTPOOL 形状读文本符号/选择文本/标题）；`adt_cochange`（传输共变排回归范围）
- **方法级读写（token 经济）**：`adt_read_object`/`adt_edit_object` 带 `method` 参数——只收发一个 METHOD 块（~30 行而非全类），窗口仍按全源行号编址；编辑走完整 OCC 冲突链
- **依赖契约序言**：`adt_read_object {context: true}` 一次读取带回所用类/接口的**公共契约**（超类/接口优先，预算花在成功取回的契约上；解析失败的依赖原样列出——看得见的缺口≠没有依赖）
- **能力巡检（sweep）**：`adt_selfcheck` 对目的地做只读能力扫描，判定 answered/empty/dead/absent/broken——`dead` = 返回空而独立 oracle（search↔read↔$batch 交叉印证）证明有内容；报告列出全部刻意不巡检的工具（覆盖声明是清单不是空白）
- **对话式建连接**：`adt_create_destination` / `adt_list_gui_connections` —— 直接说"帮我建 impc 的连接"，代理搜索本机 SAP GUI 连接列表让你挑（或问你要 url/账号），一条对话写好**工作区配置文件** `<工作区>/<宿主配置目录>/destinations.yaml`（目录随宿主声明，DSH 为 `.dsh-abap-adt`）；密码默认存入**宿主凭证存储**（DSH 上即 `~/.dsh/.credentials.yaml`，配置只留引用），下一次调用即生效
- **冲突安全编辑（OCC）**：`adt_read_object` 默认在本地留对象快照（含服务端内容哈希）；`adt_edit_object` 对**你读到的快照**做确定性匹配，上传前在持锁状态下哈希校验服务端未变——他人改动 → `[CONFLICT]` 显式拒绝而非静默错配；也可直接编辑本地快照文件后用 `adt_push_object` 校验上传（pull→edit→push）
- **错误分析**：`adt_list_dumps` / `adt_get_dump` 直接读取 ABAP 短转储（ST22）做排障闭环
- **代码执行**：`adt_execute` 运行可执行程序 / `if_oo_adt_classrun` 类并取回控制台输出
- **结构化编辑器**：`adt_read_structure` / `adt_write_structure` 元数据级读写消息类（MSAG）/域（DOMA）/数据元素（DTEL）/表类型（TTYP）
- **协议级 $batch**：`adt_batch` 一次 HTTP 往返打包多个 ADT 请求（默认只读 GET 扇出；写部分需显式开关）
- **传输查询**：`adt_list_transports` / `adt_get_transport`（释放传输是人工决策，刻意不提供工具）
- **本地版本化**：`adt_export_objects` 把对象源码落盘为 `.abap` 文件（显式对象清单；git 化/备份/离线评审）
- **本地静态检查**：`adt_local_check` 导出源码后离线跑 abaplint（语法 + lint），验证通过再一次性推送 SAP
- **全链路自动化**：search → read → write → activate → test → transport 由 AI 一条龙完成
- **工作流编排**：可配合 DSH 的 `workflow`/`subagent` 做大规模多目标分析
- **定时任务**：可配合 `dsh-schedule` 做夜间 ATC/质量巡检
- **零配置 demo 模式**：内置 mock ADT 服务器，无需任何 SAP 系统即可端到端体验

## 快速开始

完成上方 ①② 并重启 DSH，新建会话选择「ABAP Development」预设。插件默认 `demo: true`（进程内 mock ADT 服务器，`demo` 目的地）。直接对代理说：

> 列出 ADT 目的地 → 搜索 ZCL_DEMO → 读取其源码 → 修改它 → 激活 → 跑它的单元测试和 ATC → 用 adt_package_content 拿到对象清单 → 导出这些对象到本地 → 本地静态检查导出的源码

连真实系统（推荐）：**工作区配置 + 对话式创建**。每个项目工作区自带一份 `.dsh-abap-adt/destinations.yaml`（与代码一起进 git/评审），直接对代理说：

> 帮我创建 impc 的连接配置

代理会先调 `adt_list_gui_connections` 搜索**本机 SAP GUI（SAP Logon）**的连接列表——找得到就把匹配项（名称 / SID / 集团 / 推导 URL）列出来让你挑，挑定后 `adt_create_destination` 从 GUI 条目导入（集团/语言/用户自动带出，URL 按 SAP 端口约定 `https://<host>:443<nn>` 推导）；本机没有 GUI 或想手填时，代理会问你要 `url / client / username`，然后用显式字段创建。密码也直接说：默认存进宿主凭证存储（DSH 上即 `~/.dsh/.credentials.yaml`；引用名 `ADT_<目的地名大写>_PASSWORD` 或 `passwordEnv` 指定，destinations.yaml 只留引用不落明文）；也可以自己维护该凭证文件或环境变量。**密钥管理按宿主自适应**：内核通过声明式检测缝 `ctx.get('host')`（内核 `src/hostprofile.ts`）识别运行环境——DSH 插件声明 dsh 档案（凭证文件词汇 + 分层链），AgentChat 行声明自己的加密凭据存储，未声明的宿主按能力推断（挂了凭证服务 → 通用宿主存储措辞；没挂 → 只引导环境变量，绝不让你去编辑不存在的 `~/.dsh/...` 文件），明文回退仅在无凭证存储时出现并附警告。

手写也行——在工作区根目录建 `.dsh-abap-adt/destinations.yaml`（保存即热生效，无需重启）：

```yaml
defaultDestination: dev
destinations:
  - name: dev
    url: https://sap.example.com:44301    # ABAP 前端的 HTTP(S) 地址
    client: '100'                        # 集团
    language: EN
    username: DEVELOPER
    passwordEnv: ADT_DEV_PASSWORD        # 从环境变量读密码（推荐）
    strictSSL: false                     # 自签名证书（SAP 内网常见）时必须关
```

> 工作区文件是**本会话工作区私有的最近覆盖层**：同名目的地覆盖全局配置，`defaultDestination` / 权限键就近生效。全局共享配置（所有工作区通用的兜底目的地、权限策略）仍走 `~/.dsh/settings.yaml` 的 `abap-adt:` 段（见下方「配置分层」）。

### 配置分层（config layering）

配置分**全局层（DSH settings）**与**工作区层**两段：插件把自身的配置 schema 注册为 `abap-adt` 命名空间，插件行的内联 config 是 composition base，`~/.dsh/settings.yaml` 的 `abap-adt:` 段是用户层——**保存即热生效**（目的地表与权限策略原地重建，无需重启 DSH）。工作区层是**每次工具调用时**按会话工作目录叠加的（预设挂载跨会话共享，所以按调用就近解析）。生效值**就近覆盖**：

```
① schema 默认值                              （demo 开、8123、defaultDestination=demo、无目的地）
② 插件行内联 config                          （agent preset / cordis.patch.yml —— composition base）
③ 旧版独立文件 ~/.dsh/abap-adt.yml            （已废弃，仅迁移期兼容，出现即告警）
④ settings.yaml 的 abap-adt: 用户段           （全局用户覆盖层）
⑤ 显式 configFile（团队共享）                  （路径可来自 ②-④ 任一层；~ 展开、相对路径锚定 dsh home）
⑥ 工作区文件 <会话工作区>/<宿主配置目录>/destinations.yaml（DSH 为 .dsh-abap-adt，目录随宿主声明，未声明默认 .dsh-abap-adt）
                                             （最近层：同名目的地覆盖以上全部、可设 defaultDestination
                                              与权限键；按调用热生效，adt_create_destination 写这里）
⑦ SAP_* 环境变量                              （仅权限六开关，且仅在 ①-⑥ 均未设置时生效）
```

- `destinations` 跨层按名字合并：高层的同名条目覆盖低层，新名字追加——随包发布的 `destinations: []` 永远不会挡住其他层
- settings 段/共享文件/工作区文件写错键名会**明确报错**（含路径与未知键名）；显式指定的 `configFile` 不存在则告警并跳过该层
- 工作区层只认 `destinations` / `defaultDestination` / 权限六开关（`demo`、`demoPort`、`configFile` 属全局层）；文件格式与其他层完全一致，也可含按目的地的 `policy:` 块
- 密码在 schema 中标记为 secret（settings 展示时自动脱敏）；解析优先级 `config.password` > `passwordEnv` 指定的**凭证引用**（宿主按层解析——DSH：进程环境变量 > `~/.dsh/.credentials.yaml` 凭证文件 > `.env`；其他宿主为其自己的存储，未挂凭证服务时仅环境变量；每次工具调用实时解析，改完即生效）> `ADT_PASSWORD`。**切勿把密码明文写进任何配置**——对话里直接把密码告诉代理即可：`adt_create_destination` 会把它存进宿主凭证存储（DSH 上即 `~/.dsh/.credentials.yaml`），destinations.yaml 只留 `passwordEnv` 引用；仅在无凭证存储或显式 `passwordInFile: true` 时才明文落盘（避免提交该文件；工具结果 note 与 destinations.yaml 自文档注释都会按当前宿主写明去路与解析链）
- 未挂载 settings 服务或 dsh-fs 的精简 profile 自动降级：仅用插件行 config 解析，行为与组合时一致；文件系统能力（源码快照 / export / push / `sourceFile` / 本地检查）缺失时明确报错，其余 `adt_*` 工具不受影响

认证说明：
- **on-prem 经典 ABAP**：Basic Auth（支持自签名证书时设 `strictSSL: false`）
- **ABAP Cloud (BTP)**：需要 JWT/服务键认证（本版本已预留 `auth` 类型扩展点，`'basic'` 之外可扩展 `'jwt'`）

## 权限管控（Permission Policy）

所有会**修改 SAP 系统状态**的工具（`adt_write_object` / `adt_create_object` / `adt_delete_object` / `adt_activate` / `adt_write_structure` / 传输工具族）在执行前都会经过**目标目的地**的权限策略（`src/policy.ts`），不满足即抛 `[POLICY]` 错误并指明具体规则。只读工具（搜索/读取/检查/测试/ATC/导出/查看传输请求/转储分析）不受限制——`allowedTransports` 只约束编辑类操作引用的传输号，读取任意请求详情不受该开关限制。两个高危能力各有独立开关：`adt_execute`（执行任意 ABAP，`allowExecution`）与 `adt_batch` 的写部分（`allowBatchWrites`，默认关）。

六个独立开关支持**全局默认 + 按目的地覆盖**：顶层键是全局默认，每个 destination 可用自己的 `policy:` 块逐键覆盖（如生产系统只读、开发系统放开）。全局键生效值优先级为 **工作区文件 > settings 用户段/共享文件 > 插件行内联 config > `SAP_*` 环境变量 > 内置默认值**（详见上方「配置分层」；工作区文件的顶层权限键只作用于该文件中的目的地）：

| 开关 | config 键 | 环境变量 | 默认 | 含义 |
|---|---|---|---|---|
| 传输开关 | `enableTransports` | `SAP_ENABLE_TRANSPORTS` | `true` | `false` 时传输工具族、显式 `transport` 参数、以及可传输包的一切编辑（隐式产生传输内容）全部拒绝 |
| 允许的传输号 | `allowedTransports` | `SAP_ALLOWED_TRANSPORTS` | `*` | 逗号分隔 glob（如 `D01K96*`）。既约束显式传入的传输号，也约束后端在 lock 时自动分配的 CORRNR——不匹配则回滚（解锁）并拒绝 |
| 可传输编辑 | `allowTransportableEdits` | `SAP_ALLOW_TRANSPORTABLE_EDITS` | `true` | `false` 时只允许编辑 `$TMP`（本地对象）中的对象 |
| 允许的包 | `allowedPackages` | `SAP_ALLOWED_PACKAGES` | `*` | 逗号分隔 glob（如 `Z*,$TMP`），只有白名单内的包可被编辑；`*` = 全部 |
| 代码执行 | `allowExecution` | `SAP_ALLOW_EXECUTION` | `true` | `false` 时 `adt_execute`（运行程序/类，可任意改系统状态）被拒绝——只读目的地的总闸 |
| batch 写部分 | `allowBatchWrites` | `SAP_ALLOW_BATCH_WRITES` | `false` | `adt_batch` 默认只做只读 GET 扇出；开启后才允许 POST/PUT 内嵌请求（通用写无法逐对象校验策略，专用写工具仍是受管控路径；传输释放/删除路径永远禁止） |

按目的地覆盖示例（settings.yaml）：

```yaml
abap-adt:
  allowedPackages: 'Z*,$TMP'        # 全局默认
  destinations:
    - name: prd
      policy:
        enableTransports: false      # prd：禁用传输 + 只许 $TMP
        allowedPackages: '$TMP'
```

要点：

- **变更工具的传输选择**：`adt_write_object` / `adt_edit_object` / `adt_delete_object` / `adt_write_structure` 均接受 `transport` 参数——显式指定时修改**精确计入该请求**（PUT `?corrNr=`，用户值优先于 lock 分配值，对齐官方 ADT 编辑器行为）；省略时由后端在 lock 时决定（已在 open 请求中的对象留在原请求，否则自动新建 task/request）。输出带 `transport` + `transportSource`（`'user'|'auto'`），自动分配时明确提示，避免改动悄悄计入新建的请求。
- 包校验对**新建**用显式 `packageName`；对**已存在对象**（write/delete/activate）优先取调用方传入的 `packageName`，否则通过搜索精确命中解析包名；无法确定包名时**失败关闭**（拒绝并提示补传 `packageName`）。
- `$TMP` 不被隐式放行——白名单是权威的，需要本地对象就把 `$TMP` 写进 `allowedPackages`。
- 环境变量示例：`SAP_ENABLE_TRANSPORTS=true SAP_ALLOWED_TRANSPORTS='D01K96*' SAP_ALLOW_TRANSPORTABLE_EDITS=true SAP_ALLOWED_PACKAGES='Z*,$TMP'`。
- 用 `adt_permissions` 查看全局默认**和每个目的地的生效策略**及每个开关的来源（config/env/default）。
- 注意：demo 目的地的 mock 传输号（`S4HK900001` 等）通常不在 `allowedTransports` 白名单内，因此 demo 上对可传输对象的写入/激活会被策略拒绝——纯演示时把 `allowedTransports` 设为 `*`，或只做只读演示。

## 协议实现要点（与真实 SAP 兼容）

基于对生产级开源客户端的交叉验证（[`@mcp-abap-adt/adt-clients`](https://www.npmjs.com/package/@mcp-abap-adt/adt-clients)、[`abap-adt-api`](https://github.com/marcellourbani/abap-adt-api)、[`vscode_abap_remote_fs`](https://github.com/marcellourbani/vscode_abap_remote_fs)）与 SAP 官方 BTP REST 文档：

- **认证**：Basic Auth + `sap-adt-connection-id`（UUID）头；CSRF 通过 `GET /sap/bc/adt/core/discovery` + `x-csrf-token: fetch` 握手；写操作自动带 token，403/401 时重置会话重试一次
- **会话**：cookie 自动管理；`sap-usercontext` 强制覆盖为请求的 client；写链（lock→PUT→unlock）发送 `x-sap-adt-sessiontype: stateful`
- **锁**：`POST {uri}?_action=LOCK&accessMode=MODIFY` → 解析 `asx:abap` 响应取 `LOCK_HANDLE` / `CORRNR`；解锁 `?_action=UNLOCK&lockHandle=`
- **源码**：读 `GET {uri}/source/main`（Accept `text/plain`）；写 `PUT {uri}/source/main?lockHandle=...&corrNr=...`（CT `text/plain; charset=utf-8`）；对不支持 `/source/main` 的后端回退到对象 URI
- **激活**：`POST /sap/bc/adt/repository/activation?method=activate&preauditRequested=true`，body 为 `adtcore:objectReferences`；**激活错误在 HTTP 200 body 的 `chkl:messages` 中**（type="E"）
- **语法检查**：`POST /sap/bc/adt/checkruns?reporters=abapCheckRun`（`chkrun:checkObjectList`）
- **ABAP Unit**：`POST /sap/bc/adt/abapunit/runs`（`aunit:run` + OSL objectSet）→ 轮询状态 → `GET /sap/bc/adt/abapunit/results/{id}`（JUnit XML）
- **ATC**：`POST /sap/bc/adt/atc/runs`（`atc:runparameters`）→ 轮询 → `GET /sap/bc/adt/atc/results/{displayId}`（checkstyle XML）
- **传输**：`/sap/bc/adt/cts/transportrequests`（列表/详情/release）
- **创建**：类型专用集合端点（`/sap/bc/adt/oo/classes` 等）+ 命名空间元数据 XML + `package` 查询参数，201 + `Location` 头
- **搜索**：`/sap/bc/adt/repository/informationsystem/search?operation=...&query=...&maxResults=...`
- **包内容**：`/sap/bc/adt/repository/nodestructure?parent_name=DEVC/K&parent_type=DEVC/K`
- **转储（ST22）**：`GET /sap/bc/adt/runtime/dumps`（Atom feed，`$query` 用户过滤 + `from/to` 时间范围 + `$top/$skip` 分页）；详情 `GET /runtime/dump/{id}`（结构化 XML）/`/summary`（HTML）/`/formatted`（纯文本）
- **执行**：`POST /sap/bc/adt/programs/programrun/{name}`（可执行程序）与 `POST /sap/bc/adt/oo/classrun/{name}`（`if_oo_adt_classrun` 类），控制台输出以 `text/plain` 返回
- **$batch**：`POST /sap/bc/adt/$batch`（`multipart/mixed; boundary=…`），每部分 `application/http` 内嵌完整 HTTP 请求（`GET/POST/PUT <path> HTTP/1.1`），响应为逐部分内嵌 HTTP 响应；CSRF 仅在外层校验一次，`sap-client/sap-language` 自动附加到内层路径
- **结构化编辑器**：MSAG `application/vnd.sap.adt.mc.messageclass+xml`（`mc:messages`/`mc:deletedmessages` 增删）、DOMA `…domains.v2+xml`（`doma:content/typeInformation` + `doma:fixValues`）、DTEL `…dataelements.v2+xml`（`dtel:typeKind/typeName/dataType` + `dtel:labels`）、TTYP `…tabletypes.v2+xml`（`ttyp:typeKind/typeName/accessType` + key）；写入走 read-modify-write（lock → GET 原文 → 只补丁显式字段 → PUT → unlock），SAP 管理的属性全量保留

详见 [docs/adt-protocol-notes.md](docs/adt-protocol-notes.md)。

## 测试

共 **288 项**（`pnpm test`，CI 发布前强制跑全量）：协议解析（XML/传输）、客户端 ↔ mock 端到端、权限策略（含读侧黑名单与环境分级 profile）、$batch/执行器/结构化编辑器/转储分析/版本比对/块编辑（含 2063 行真实生产语料回归）/快照冲突控制、abaplint 本地检查、版本 diff、发布门禁、配置分层、**密码分层解析**（明文 > DSH 凭证服务 > 进程环境变量）、**工作区配置层**（叠加合并/默认目的地/权限键/客户端复用/原子写）、**SAP GUI 连接发现**（SAPUILandscape.xml 解析：直连/引用/负载均衡/Include/经典 ini 回退/多词搜索）与 **adt_create_destination 工具流**（GUI 导入/手工创建/覆盖保护/密码入凭证文件或明文回退）、**真实后端 quirk 回归**（`quirks.test.ts`：传输状态码翻译与 400 回退、ATC 过滤回退与 P1–P4 推导、include 位置映射、release 多键回退、**CSRF 预热顺序锁定**——源自 impc-dev/D01 实战反馈）、**方法级读写 + 依赖契约序言 + 能力巡检**（`agent_extras.test.ts`：方法块定位/依赖提取排序/契约抽取的纯函数测试，方法窗口编址、序言"失败依赖可见"纪律、方法手术走 OCC 流水线、`adt_selfcheck` 判定表与 **发布目录计数锁定**——目录数漂移时测试先于文档失败）、**读侧治理与环境分级**（`read_policy.test.ts`：standard 档 KNA1 零请求拒绝、off 档不拦、豁免审计 note、SQL FROM/JOIN 提取）、**调试器全链路**（`debugger.test.ts`：断点→listen 命中→栈→变量→单步→写值→detach 对 mock 走完整循环 + 三档策略门）、**TABL 一步建表 + 文本元素 + co-change**（DDL 生成纯函数、blueSource 流激活验证、三子源解析、共变排序与截断纪律）。

## 路线图（可扩展方向）

> **完整的分级实施计划**（含规格、验收标准、参考实现路径）见 [`docs/agent-experience-upgrade-plan.md`](docs/agent-experience-upgrade-plan.md)——源自对 vsp（vibing-steampunk）与 abap-mcp-adt-powerup 两个同类工具的深度调研，P0 项（读侧敏感表黑名单、目的地环境分级、工具描述 RAG 工程、CSRF 预热核实）已排定。

- JWT/OAuth2（ABAP Cloud / BTP 服务键）认证支持——`auth` 类型扩展点已预留，目前仅 `'basic'`
- ABAP Debugger REST API 工具（断点/栈/变量）——升级计划 P1-1，标准 ADT REST 零服务端安装路径已验证
- TABL 带字段一步创建（DDIC DDL）——升级计划 P1-2
- 文本元素读取（标准 ADT 端点）——升级计划 P1-3
- RAP 对象（BDEF/DDLX/SRVD）专项工具
- ATC 豁免/基线（exemptions）管理
- 应用日志（SLG1）/Gateway 错误日志读取工具

> 已落地（早期路线图项）：`adt_where_used`（影响分析）、`adt_data_preview`（CDS/SQL 数据预览，offset/length 行窗口）、`adt_object_versions` / `adt_version_diff`（版本历史与 diff）、`adt_lock_info` / `adt_unlock_all`（锁状态查询与残留锁清理）、`adt_list_dumps` / `adt_get_dump`（ST22 错误分析）、`adt_execute`（程序/类执行器）、`adt_read_structure` / `adt_write_structure`（DDIC 结构化编辑器）、`adt_batch`（协议级 $batch）。

## 许可证

MIT（本仓库代码）。协议知识参考社区开源实现与 SAP 公开文档；不包含 SAP 专有代码。注意 SAP Developer License 禁止将 SAP 材料用于 AI 训练——本插件是运行时集成工具，请合规使用。
