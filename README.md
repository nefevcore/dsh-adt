# dsh-abap-adt — ABAP Development Tools for DeepSeek Harness

[![npm](https://img.shields.io/npm/v/@nefevcore/abap-adt-dsh-plugin?label=%40nefevcore%2Fabap-adt-dsh-plugin)](https://www.npmjs.com/package/@nefevcore/abap-adt-dsh-plugin)
[![license](https://img.shields.io/badge/license-MIT-green)](#许可证)
[![tests](https://img.shields.io/badge/tests-126-brightgreen)](#测试)
[![dsh plugin](https://img.shields.io/badge/dsh--plugin-listed-blue)](https://github.com/topics/dsh-plugin)

> **English** — Agent-native SAP ABAP access for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): a Cordis plugin that speaks the SAP ADT REST protocol directly (`/sap/bc/adt`; no SAP libraries, no IDE) and registers **34 `adt_*` tools** covering the full loop *search → read → edit → activate → unit test → ATC → transport → execute → error analysis*, plus agent-scale capabilities (protocol-level `$batch`, whole-package release gates, DDIC structured editors, local export, offline abaplint). Releasing a transport is deliberately a human decision and not exposed as a tool. Ships with a zero-config mock server, so you can try everything without an SAP system.

在 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 上直接访问 SAP ABAP 系统的插件与协议客户端。

本插件**直接实现 SAP ADT（ABAP Development Tools）REST 协议**（`/sap/bc/adt`），不依赖任何 SAP 闭源库，也无需任何 IDE（headless 运行）。AI 代理获得了一整套 `adt_*` 原生工具，可以自主完成搜索 → 阅读 → 修改 → 激活 → 测试 → 传输的完整开发闭环，并提供代理尺度的批量能力（整包质量报告、源码导出、离线检查、发布门禁）。

> 🔎 **找 DSH 插件？** 本仓库已打上 GitHub Topic [`dsh-plugin`](https://github.com/topics/dsh-plugin)（另见 [`deepseek-harness`](https://github.com/topics/deepseek-harness)）；npm 上检索关键词 `dsh-plugin` 也能找到本插件。

## 安装与更新

安装和更新只支持 **dsh CLI** 一种方式（要求 pnpm 在 PATH——`corepack enable` 或 `npm i -g pnpm`；缺失时 dsh 会明确报错）。三个包均已发布到 npm（`@nefevcore/abap-adt-protocol` 协议客户端、`@nefevcore/abap-adt-mock` 内置 mock、`@nefevcore/abap-adt-dsh-plugin` DSH 插件）：

```bash
# ① 安装（装进 web profile；仅安装，不自动加载）
dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin

# ② 生成按会话启用的 agent 预设（一次性；复制默认预设并追加插件行）
dsh plugin --profile web exec abap-adt-preset

# 更新到最新版（更新不会动你的预设与配置）
dsh plugin --profile web update @nefevcore/abap-adt-dsh-plugin

# 或锁定指定版本
dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin@0.2.0
```

**默认不加载，按会话启用（by design）**：包内不声明 `dsh.bundle`，安装只是把包放进 profile 的依赖里——`adt_*` 工具**只出现在用 `abap-adt` 预设创建的会话**，其他会话完全不受影响。安装时 dsh 会提示 `declares no dsh.bundle — installed as a plain dependency`，这正是预期行为。

②生成的预设：复制部署默认预设（`~/.dsh/settings.yaml` 的 `agent-presets.default`，通常是 `cordis`）到 `~/.dsh/.agent-presets/abap-adt/` 并追加插件行；支持 `--id/--from/--name/--force/--dry-run`。重启 DSH 后新建会话，在预设 chip 选「ABAP Development」即可。手工建预设的说明见 [`presets/abap-adt.example/`](presets/abap-adt.example/README.md)。

DSH 的 profile 由 pnpm 管理（`~/.dsh/profiles/web/` 下有 `pnpm-workspace.yaml`），**不要用 npm 装进 profile**（会生成 package-lock 并破坏 pnpm 布局）。**装/更新插件、新建预设后重启 DSH**；之后的配置变更走 DSH settings，免重启热生效。连接真实系统的 `destinations` 与权限开关配置在 `~/.dsh/settings.yaml` 的 `abap-adt:` 段（见下方「配置分层」）。

### 从 0.1.0 升级

0.2.0 改为**默认不加载**（全局层自动退场）且配置迁入 settings，升级后需做两件一次性操作：

```bash
# ① 更新（reconcile 会自动把插件移出全局 bundle 层——工具从默认会话消失是预期的）
dsh plugin --profile web update @nefevcore/abap-adt-dsh-plugin

# ② 重建预设（若 0.1.0 时代已手工建过 ~/.dsh/.agent-presets/abap-adt/，加 --force 覆盖）
dsh plugin --profile web exec abap-adt-preset --force
```

然后把 `~/.dsh/abap-adt.yml`（0.1.0 的外部配置文件，已废弃）的内容**整体缩进两格**并入 `~/.dsh/settings.yaml` 的 `abap-adt:` 段并删除旧文件（不迁会有 deprecation 告警；模板见 [`presets/abap-adt.example/settings-section.example`](presets/abap-adt.example/settings-section.example)）。最后重启 DSH,新会话选「ABAP Development」预设。

## 核心能力

- **代理原生工具**：34 个 `adt_*` 工具，AI 自主编排多步开发流程
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

连真实系统：在 `~/.dsh/settings.yaml` 增加 `abap-adt:` 段（保存即热生效，无需重启）：

```yaml
abap-adt:
  defaultDestination: dev
  destinations:
    - name: dev
      url: https://sap.example.com:443     # ABAP 前端的 HTTP(S) 地址
      client: '100'                        # 集团
      language: EN
      username: DEVELOPER
      passwordEnv: ADT_DEV_PASSWORD        # 从环境变量读密码（推荐）
      strictSSL: false                     # 自签名证书（SAP 内网常见）时必须关
```

### 配置分层（config layering）

配置走 **DSH settings**：插件把自身的配置 schema 注册为 `abap-adt` 命名空间，插件行的内联 config 是 composition base，`~/.dsh/settings.yaml` 的 `abap-adt:` 段是用户层——**保存即热生效**（目的地表与权限策略原地重建，无需重启 DSH）。生效值**就近覆盖**：

```
① schema 默认值                              （demo 开、8123、defaultDestination=demo、无目的地）
② 插件行内联 config                          （agent preset / cordis.patch.yml —— composition base）
③ 旧版独立文件 ~/.dsh/abap-adt.yml            （已废弃，仅迁移期兼容，出现即告警）
④ settings.yaml 的 abap-adt: 用户段           （用户覆盖层）
⑤ 显式 configFile（团队共享，最权威）          （路径可来自 ②-④ 任一层；~ 展开、相对路径锚定 dsh home）
⑥ SAP_* 环境变量                              （仅权限四开关，且仅在 ①-⑤ 均未设置时生效）
```

- `destinations` 跨层按名字合并：高层的同名条目覆盖低层，新名字追加——随包发布的 `destinations: []` 永远不会挡住其他层
- settings 段/共享文件写错键名会**明确报错**（含路径与未知键名）；显式指定的 `configFile` 不存在则告警并跳过该层
- 密码在 schema 中标记为 secret（settings 展示时自动脱敏）；解析优先级 `config.password` > `passwordEnv` 指定变量 > `ADT_<NAME>_PASSWORD` > `ADT_PASSWORD`。**切勿把密码明文写进任何配置。**
- 未挂载 settings 服务的精简 profile 自动降级：仅用插件行 config 解析，行为与组合时一致

认证说明：
- **on-prem 经典 ABAP**：Basic Auth（支持自签名证书时设 `strictSSL: false`）
- **ABAP Cloud (BTP)**：需要 JWT/服务键认证（本版本已预留 `auth` 类型扩展点，`'basic'` 之外可扩展 `'jwt'`）

## 权限管控（Permission Policy）

所有会**修改 SAP 系统状态**的工具（`adt_write_object` / `adt_create_object` / `adt_delete_object` / `adt_activate` / `adt_write_structure` / 传输工具族）在执行前都会经过**目标目的地**的权限策略（`src/policy.ts`），不满足即抛 `[POLICY]` 错误并指明具体规则。只读工具（搜索/读取/检查/测试/ATC/导出/查看传输请求/转储分析）不受限制——`allowedTransports` 只约束编辑类操作引用的传输号，读取任意请求详情不受该开关限制。两个高危能力各有独立开关：`adt_execute`（执行任意 ABAP，`allowExecution`）与 `adt_batch` 的写部分（`allowBatchWrites`，默认关）。

六个独立开关支持**全局默认 + 按目的地覆盖**：顶层键是全局默认，每个 destination 可用自己的 `policy:` 块逐键覆盖（如生产系统只读、开发系统放开）。全局键生效值优先级为 **settings 用户段/共享文件 > 插件行内联 config > `SAP_*` 环境变量 > 内置默认值**（详见上方「配置分层」）：

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

共 **126 项**（`pnpm test`，CI 发布前强制跑全量）：协议解析（XML/传输）、客户端 ↔ mock 端到端、权限策略、$batch/执行器/结构化编辑器/转储分析/版本比对/块编辑（含 2063 行真实生产语料回归）、abaplint 本地检查、版本 diff、发布门禁、配置分层。

## 路线图（可扩展方向）

- JWT/OAuth2（ABAP Cloud / BTP 服务键）认证支持——`auth` 类型扩展点已预留，目前仅 `'basic'`
- ABAP Debugger REST API 工具（断点/栈/变量）
- RAP 对象（BDEF/DDLX/SRVD）专项工具
- ATC 豁免/基线（exemptions）管理
- 应用日志（SLG1）/Gateway 错误日志读取工具

> 已落地（早期路线图项）：`adt_where_used`（影响分析）、`adt_data_preview`（CDS/SQL 数据预览，offset/length 行窗口）、`adt_object_versions` / `adt_version_diff`（版本历史与 diff）、`adt_lock_info` / `adt_unlock_all`（锁状态查询与残留锁清理）、`adt_list_dumps` / `adt_get_dump`（ST22 错误分析）、`adt_execute`（程序/类执行器）、`adt_read_structure` / `adt_write_structure`（DDIC 结构化编辑器）、`adt_batch`（协议级 $batch）。

## 许可证

MIT（本仓库代码）。协议知识参考社区开源实现与 SAP 公开文档；不包含 SAP 专有代码。注意 SAP Developer License 禁止将 SAP 材料用于 AI 训练——本插件是运行时集成工具，请合规使用。
