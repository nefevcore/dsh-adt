# dsh-abap-adt — ABAP Development Tools for DeepSeek Harness

在 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 上直接访问 SAP ABAP 系统的插件与协议客户端。

本插件**直接实现 SAP ADT（ABAP Development Tools）REST 协议**（`/sap/bc/adt`），不依赖任何 SAP 闭源库，也不需要 VS Code / Eclipse。AI 代理获得了一整套 `adt_*` 原生工具，可以自主完成搜索 → 阅读 → 修改 → 激活 → 测试 → 传输的完整开发闭环，并提供了超越 VS Code ADT 交互式工作流的批量能力。

## 为什么比 VS Code ADT 更强

| 能力 | VS Code ADT 扩展 | 本插件 (dsh-abap-adt) |
|---|---|---|
| 使用方式 | 交互式 IDE，人工逐对象操作 | **代理原生**：AI 自主编排多步开发流程 |
| 批量代码分析 | 无（单对象 ATC） | `adt_batch_checks`：一次对整个包的 ATC + ABAP Unit 聚合质量报告 |
| 传输自动化 | 手动右键操作 | `adt_list_transports` / `adt_get_transport` / `adt_release_transport` |
| 本地版本化 | 仅虚拟文件系统 | `adt_export_objects`：把对象源码落盘为 `.abap` 文件（git 化/备份/离线评审） |
| 全链路自动化 | 无 | search → read → write → activate → test → transport 由 AI 一条龙完成 |
| 工作流编排 | 无 | 可配合 DSH 的 `workflow`/`subagent` 做大规模多目标分析 |
| 定时任务 | 无 | 可配合 `dsh-schedule` 做夜间 ATC/质量巡检 |
| 上手门槛 | 需要配 VS Code + 扩展 | **零配置 demo 模式**：内置 mock ADT 服务器，无需任何 SAP 系统即可端到端体验 |

## 项目结构

```
adt/
├── packages/
│   ├── adt-protocol/            # @abap-adt/protocol — 纯 TS 的 ADT 协议客户端
│   │   └── src/
│   │       ├── client.ts        # AdtClient：认证/CSRF/session/搜索/源码/激活/单测/ATC/传输
│   │       ├── endpoints.ts     # 端点与媒体类型目录
│   │       ├── xml.ts           # 零依赖 XML 解析器（ADT 载荷专用）
│   │       └── types.ts         # 协议类型
│   ├── adt-mock/                # @abap-adt/mock — 内存版 ADT 服务器（测试/demo）
│   │   └── src/
│   │       ├── server.ts        # Mock 端点实现（发现/搜索/锁/激活/单测/ATC/传输/创建）
│   │       ├── data.ts          # 示例对象（类/接口/程序/CDS/单测/ATC 数据）
│   │       └── cli.ts           # 独立启动：pnpm mock
│   └── dsh-plugin-abap-adt/     # @abap-adt/dsh-plugin — DSH (Cordis) 插件
│       ├── cordis.patch.yml     # bundle 层声明（dsh.bundle.patch）
│       └── src/
│           ├── index.ts         # 插件入口：注册 17 个 adt_* 工具
│           ├── config.ts        # schemastery 配置 schema
│           ├── registry.ts      # 多目的地注册表 + demo mock 生命周期
│           ├── resolve.ts       # 对象名/类型 → ADT URI 解析
│           └── tools/           # 工具实现（system/search/source/lifecycle/testing/transport/packages/batch）
├── docs/                        # 文档（协议笔记、架构、SAP 连接指南）
└── .research/                   # 协议调研原始资料（社区仓库克隆与笔记）
```

## 工具清单（17 个 `adt_*` 工具）

**系统与连接**
- `adt_list_destinations` — 列出已配置的 SAP 目标及连通性
- `adt_system_info` — 系统 ID / 版本 / ABAP Cloud 状态 / feature flags
- `adt_ping` — 可达性与认证探测

**搜索与浏览**
- `adt_search` — 对象搜索 + 源码全文搜索（quickSearch / objectSearch / quickSearchSource）
- `adt_package_content` — 包的直接成员列表

**对象操作**
- `adt_read_object` — 读取对象源码与元数据
- `adt_write_object` — 锁定 → 写入 → 解锁 原子更新
- `adt_create_object` — 创建类/接口/程序/CDS/表/结构/消息类/函数组/包（`$TMP` 免传输）
- `adt_delete_object` — 删除对象
- `adt_activate` — 激活（支持传输号、check-only 预审）
- `adt_check` — 语法/一致性检查（check run，不激活）

**测试与质量**
- `adt_run_unit_tests` — ABAP Unit（异步 run 流程，JUnit 结果解析）
- `adt_run_atc` — ABAP Test Cockpit（异步 run，checkstyle 结果解析）
- `adt_batch_checks` — **超集功能**：整包 ATC + 单测聚合质量报告

**传输**
- `adt_list_transports` / `adt_get_transport` / `adt_release_transport`

**本地化**
- `adt_export_objects` — **超集功能**：对象源码导出到本地目录（沙箱感知）

## 快速开始

### 1. 构建

```bash
corepack pnpm install --registry https://registry.npmmirror.com   # 国内镜像
corepack pnpm build
corepack pnpm test        # 18 个协议/集成测试（客户端 ↔ mock 端到端）
```

### 2. 加载到 DSH web profile

插件已注册到 `C:\Users\xiaofeng\.dsh\profiles\web\cordis.patch.yml`（file URL 直连本仓库构建产物）。

> ⚠️ **插件代码变更后必须重启 DSH**（`scripts/restart-dsh-web.ps1` 或重新执行 `npx @deepseek-ai/dsh web`）。HMR 只能重跑配置、不能更新已缓存的库模块——本插件以 file URL 加载，Node 的 ESM 缓存会钉住 `@abap-adt/protocol`、`@abap-adt/mock` 与 `tools/*` 的旧代码。**不要**依赖"改配置热更新代码"。

如需正式安装（pnpm 依赖解析），在 profile 目录执行：

```bash
# 从本仓库根目录执行（相对路径会被锚定到当前目录）
corepack pnpm --dir ~/.dsh/profiles/web add link:C:/Users/xiaofeng/Documents/Dev/WorkDev/adt/packages/dsh-plugin-abap-adt
# 或通过 dsh CLI（要求 pnpm 在 PATH）
dsh plugin --profile web add link:C:/Users/xiaofeng/Documents/Dev/WorkDev/adt/packages/dsh-plugin-abap-adt
```

### 3. 体验（零 SAP 系统）

插件默认 `demo: true`：进程内启动 mock ADT 服务器并注册 `demo` 目的地。直接对代理说：

> 列出 ADT 目的地 → 搜索 ZCL_DEMO → 读取其源码 → 修改它 → 激活 → 跑它的单元测试和 ATC → 导出整个 ZPACK_DEMO 包到本地

### 4. 连接真实 SAP 系统

编辑 profile 的 `cordis.patch.yml`，在 `destinations` 增加条目：

```yaml
- id: abap-adt
  name: 'file:///C:/.../dsh-plugin-abap-adt/lib/index.js'
  config:
    demo: false
    defaultDestination: dev
    destinations:
      - name: dev
        url: https://sap.example.com:443     # ABAP 前端的 HTTP(S) 地址
        client: '100'                        # 集团
        language: EN
        username: DEVELOPER
        passwordEnv: ADT_DEV_PASSWORD        # 从环境变量读密码（推荐）
```

密码解析优先级：`config.password` > `passwordEnv` 指定变量 > `ADT_<NAME>_PASSWORD` > `ADT_PASSWORD`。**切勿把密码写进配置文件。**

认证说明：
- **on-prem 经典 ABAP**：Basic Auth（支持自签名证书时设 `strictSSL: false`）
- **ABAP Cloud (BTP)**：需要 JWT/服务键认证（本版本已预留 `auth` 类型扩展点，`'basic'` 之外可扩展 `'jwt'`）

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

详见 [docs/adt-protocol-notes.md](docs/adt-protocol-notes.md)。

## 测试

- `packages/adt-protocol/test/xml.test.ts` — XML 解析器单测
- `packages/adt-mock/test/integration.test.ts` — 客户端 ↔ mock 端到端（认证失败/发现/搜索/读/写/锁/激活/检查/单测/ATC/传输/包/创建/删除，18 项全绿）

## 路线图（可扩展方向）

- JWT/OAuth2（ABAP Cloud）认证支持
- where-used / 依赖分析工具
- ABAP Debugger REST API 工具（断点/栈/变量）
- 数据预览（Data Preview）SQL 查询工具
- 对象结构 / 版本历史（versions）工具
- RAP 对象（BDEF/DDLX/SRVD）专项工具

## 许可证

MIT（本仓库代码）。协议知识参考社区开源实现与 SAP 公开文档；不包含 SAP 专有代码。注意 SAP Developer License 禁止将 SAP 材料用于 AI 训练——本插件是运行时集成工具，请合规使用。
