# Agent 体验升级计划（源自 vsp / abap-mcp-adt-powerup 调研）

> **状态**：待实施。本文档是完整的实施规格——面向**下一个全新 session**，自包含、不依赖调研对话。
> **来源**：两个同类工具的深度调研（源码快照 + 笔记在 `.research/`，gitignored 但随工作区保留）：
> - **vsp** = [oisee/vibing-steampunk](https://github.com/oisee/vibing-steampunk)：Go 版 ADT→MCP，走"agent 智能"路线。快照 `.research/repos/vibing-steampunk-main/`，笔记 `.research/vsp_lessons.md`。
> - **abap-mcp** = [abap0917/abap-mcp-adt-main](https://github.com/abap0917/abap-mcp-adt-main)（`@babamba2/abap-mcp-adt-powerup`，fr0ster fork）：TS 版 MCP，走"企业分发+合规治理+对象广度"路线。快照 `.research/repos/abap-mcp-adt-main-main/`，笔记 `.research/abapmcp_lessons.md`。
> **注意**：abap-mcp 存在宣称与实现漂移（rate-limit 未实现、header-validator 零引用）——借鉴其任何机制前先 grep 其源码核实，本文引用的路径均已由子代理核实过。

## 下一 session 启动检查

1. 读本文档 + 两份笔记（`.research/vsp_lessons.md`、`.research/abapmcp_lessons.md`）。
2. 确认 `.research/repos/` 下两个快照存在（如被清理，重新下载即可，笔记已含关键数字）。
3. `pnpm test` 确认基线：**246 项全绿、38 个工具**（`agent_extras.test.ts` 的目录 pin 锁定）。
4. **纪律**：任何新增/删除工具必须同步更新——`agent_extras.test.ts` 的 38 计数 pin、`selfcheck.ts` 的 `UNPROBED_TOOLS`/`COVERED_TOOLS`、README 徽章（工具数+测试数）、`docs/tool-reference.md`。这四者是"发布数字锁定"机制（学自 vsp tools_parity_test + abap-mcp compactMatrix 单一事实源）。

---

## 一、本 session 已完成（勿重复实施）

| 能力 | 落点 | 说明 |
|---|---|---|
| 依赖契约序言 | `src/contextprologue.ts` + `adt_read_object {context, contextDeps}` | vsp ctxcomp 思路：优先级排序（超类/接口>签名类型>协作者>异常）、预算花在成功取回上、失败依赖可见 |
| 方法级 read/edit | `src/abap.ts`（findMethodBlocks 等）+ read/write 工具 `method` 参数 | 窗口按全源行号编址；edit 走完整 OCC 链 |
| 能力巡检 sweep | `src/tools/selfcheck.ts`（`adt_selfcheck`） | 只读、判定表（answered/empty/dead/absent/refused/broken/skipped）、交叉 oracle、unprobed 清单 |
| 截断纪律 | `common.ts`（showingOfTotal/showingUnknownTotal）+ dumps 多取一行 | 措辞单一来源防漂移 |
| 结构化类型路由守卫 | `read.ts`（MSAG/DOMA/DTEL/TTYP→read_structure，DEVC→package_content） | 与 read_structure 反向守卫对称 |
| Agent 指南 | `docs/agent-guide.md` | 限制先行（ABAP SQL 方言、写≠激活、OCC 契约等） |

## 二、待实施项（按优先级）

### P0-1 读侧敏感表黑名单（`blockedTables`）——合规读治理

**动机**：我们的 policy 只治写侧；agent 对生产系统跑 `adt_data_preview` 读 KNA1/BUT000/USR02 是真实合规风险。abap-mcp 的 `tableBlocklist.ts`（519 行）验证了形态。
**规格**：
- `AdtPolicy` 新增读侧开关：`blockedTablesProfile?: 'off' | 'minimal' | 'standard' | 'strict'`（默认 `off`——opt-in，不破坏现有用户）+ `blockedTables?: string[]`（自定义追加，glob `*` = `[A-Z0-9_]*`，大小写不敏感）+ `allowedTables?: string[]`（豁免，审计留痕）。
- 语义抄 abap-mcp：**deny 永不可放行**（返回 `[POLICY] blockedTables: <table> — <类别>: <理由>`，**不发任何 SAP 请求**）；分类理由必须给出（教育 agent 与人）。
- 实施点：`adt_data_preview` 的实体/sql 两条路径在发请求前解析目标表名（freestyle SQL 需要一个简单的 `FROM/JOIN <table>` 提取器）并过名单。
- 内建名单参考 abap-mcp 的分类（银行 BNKA/KNBK/LFBK/REGUH…、客户/供应商 PII KNA1/LFA1/BUT000…、地址 ADRC/ADR6、认证 USR02/RFCDES/AGR_1251、HR `PA*`/`HRP*`/`PCL*`、税务、审计日志、`Z*` PII 模式），按 minimal/standard/strict 三档分层。**写我们自己的表清单文件时按类别+tier+why 编目**（照它的 RawEntry 结构）。
- `adt_permissions` 输出与 `docs/agent-guide.md` 同步新增读侧策略说明。
**验收**：新增 `test/read_policy.test.ts`——standard 档下 preview KNA1 拒绝且 mock 服务器**零请求**（mock 计数或断言错误发生在请求前）；`off` 档不拦；豁免生效并带审计 note。
**参考**：`.research/repos/abap-mcp-adt-main-main/src/lib/policy/tableBlocklist.ts`；其审计走 stderr，我们走工具输出 note + logger。
**工作量**：S（1 个策略文件 + 1 个表名单文件 + datapreview 接线 + 测试）。

### P0-2 写侧环境分级（目的地 `profile: dev|qa|prd`）

**动机**：同一套六开关对 dev 和 prd 目的地需要不同严格度；abap-mcp 的 readonlyGuard 验证了"前缀+显式名单+分级"形态。
**规格**：
- 目的地配置加 `profile?: 'dev'|'qa'|'prd'`（默认 `dev`）。
- `dev`：现状语义。`qa`：`allowExecution` 默认收 false、`allowBatchWrites` 默认收 false（显式开仍可用）。`prd`：三者硬拒（配置显式开也拒，报错说明 prd 档限制）——**fail-closed 方向**，不做 prd 放行白名单（abap-mcp 的 QA allowlist 语义我们不需要）。
- `adt_permissions` 报告 profile 与生效结果。
**验收**：`test/policy.test.ts` 扩展——prd 档执行/批量写被拒且错误信息含 `profile: prd`。
**参考**：`.research/repos/abap-mcp-adt-main-main/src/lib/policy/readonlyGuard.ts`（核心十余行，形态参考即可，语义按上面简化）。
**工作量**：S。

### P0-3 工具描述 RAG 工程（38 个描述逐个审计）

**动机**：Cline/Cursor 类客户端用 embedding 检索选工具；描述动词前置（find/read/edit/create/activate/check…）+ 对象类型关键词富化（CLAS/TABL/DDLS/BDEF/SE11/ST22…）显著提高命中（abap-mcp CHANGELOG #20/#21 专门为此两轮优化）。
**规格**：逐个改 `src/tools/*.ts` 的 `description`：首句 = 动词开头的意图陈述；正文中枚举该工具适用的 ADT 类型码与 SAP 事务码别名（如 adt_get_dump 提 ST22、adt_run_atc 提 ATC/SLIN）。**不改行为，只改文案**——跑全量测试确认无描述断言破坏。
**验收**：全量测试绿；抽查 5 个描述含动词首句+类型码。
**工作量**：S（纯文案）。

### P0-4 agent-guide 增补两条工作流规范

- **写前 diff 展示**（学 abap-mcp CLAUDE.md 强制规则，我们作为推荐）：编辑前向用户展示 Before/After 差异块再落 SAP——加进 `docs/agent-guide.md` 的编辑决策树一节。
- **写前先 `adt_check`**：小改走 adt_edit_object 已内建检查；大改（write/push）前建议先 `adt_check`——与 vsp 的 check-before-lock 顺序一致（他们 2.42.0 专项修复过顺序：先 check 再 lock，避免语法错误时白占锁）。
**工作量**：XS（纯文档）。

### P0-5 核实首请求 CSRF 预热

**动机**：abap-mcp 在首个工具请求前 `connect()` 预取 CSRF/cookie，规避 SAP 首请求 403。**先核实**我们 adt-protocol 是否已处理（可能已有：client 懒初始化时取 token？）。
**动作**：读 `packages/adt-protocol/src/client.ts` 的 CSRF 生命周期；若首请求可能裸奔，在 client 构造/首个请求前预热。mock 与真实行为可能不同——用 quirk 测试形态覆盖。
**工作量**：核实 XS，修复 S。

### P1-1 Debugger 工具组（7 工具，标准 ADT REST，零服务端安装）

**动机**：roadmap 既有项。两家都验证了**纯标准 ADT REST 可行**（abap-mcp 7 工具直接可移植；vsp 进一步验证了有状态会话语义与各 release 坑）。
**规格**：
- 新增 `src/tools/debugger.ts`：`adt_debug_session`（listen/status/detach）、`adt_debug_breakpoint`（set/delete，对象名解析 URI）、`adt_debug_step`（into/over/return/continue/terminate）、`adt_debug_variables`（读）、`adt_debug_set_variable`（写——高危，policy 需新开关 `allowDebugVariables`）、`adt_debug_stack`。可合并为 3-4 个工具（action 路由参数），控制工具数。
- 端点：`/sap/bc/adt/debugger/listeners|debugger|breakpoints|stack`，`POST … method=getVariables` 等；**有状态会话**（`sap-contextid` cookie）——protocol 客户端需支持 stateful 会话（我们 write 链已有 stateful 基础，核实可复用）。
- **生命周期绑定 Fiber**（vsp 洞察：ADT 会话只能持一个 debug session，detach 后不能重 attach → 会话对象必须插件级单例，`ctx.effect` 注册 disposer 在插件卸载时 detach）。
- 已知坑（vsp 踩过，直接规避）：断点集合是 IDE 状态——GET 返回空体，客户端自持记录再读改写；7.50 无 `/debugger/stack` → dispatcher 兼容（按 vsp：探测一次每会话缓存）；外部断点需含 include 名；标准代码断点不触发是 SAP 行为（默认只停客户代码）。
- policy：新开关 `allowDebugger`（默认 false——调试持有会话并可能写变量，谨慎）。
- mock 支持：adt-mock 加最小 debugger 端点（listen→hit→stack→variables→step 状态机，够测工具层）。
**验收**：`test/debugger.test.ts` 对 mock 走完整循环（设断点→listen→命中→栈→变量→单步→detach）；policy 关闭时拒绝。
**参考**：`.research/repos/abap-mcp-adt-main-main/src/handlers/debugger/handleAbapDebug.ts`（7 工具，最直接的移植源）；vsp `.research/repos/vibing-steampunk-main/pkg/adt/debugger*.go`（坑与语义）；vsp README "The ABAP Debugger over RFC" 节（http-only 变体说明）。
**工作量**：M-L（协议层 stateful 会话 + mock 状态机 + 工具组 + 测试）。

### P1-2 TABL 带字段一步创建

**动机**：vsp `CreateTable` 验证了路径（用户上个 session 明确认可）；我们目前 TABL 只能占位创建，agent 建表后无字段写入路径。
**规格**：`adt_create_object` 的 `type: 'TABL'` 增加可选 `fields` 参数：`[{name, type: 'CHAR'|'NUMC'|'RAW'|'DEC'|'CURR'|'QUAN'|'INT…', length?, decimals?, isKey?, notNull?, description?}]` + `deliveryClass`（默认 A）+ `tableCategory`（默认 TRANSPARENT）。生成 DDIC 2.0 DDL（blueSource）：`@AbapCatalog.*` 注解 + `define table <name> { key client : abap.clnt not null; … }`（**自动 MANDT**），内建类型映射 `abap.char(n)` 等，POST `/sap/bc/adt/ddic/tables` 后写 source 并激活，一条龙。
**验收**：mock 加 `/ddic/tables` 创建+激活路径；测试断言生成的 DDL 含 MANDT/注解/字段；无 fields 时保持占位创建现状。
**参考**：`.research/repos/vibing-steampunk-main/pkg/adt/crud.go:1200-1414`（generateTableDDL + mapFieldType + blueSource XML，**已验证的实现，照抄语义**）。
**工作量**：M。**注意**：不要学 abap-mcp 的"字段级 JSON 只在 schema 里好看"——参数必须落到 DDL wire format（他们的反面教训）。

### P1-3 文本元素读取（标准 ADT，无 Z 组件）

**动机**：agent 改程序时常需要读写 selection texts/text symbols；读走标准端点即可。
**规格**：新工具 `adt_read_textelements`（PROG/REPT 都支持）：GET `/sap/bc/adt/programs/programs/<name>/source/symbols|selections|headings`（Accept 纯文本自定义格式），解析为结构化 JSON（ID/KEY/ENTRY/LENGTH）。写侧**暂缓**（abap-mcp 走 Z FM 批量；单条可试 ADT PUT 同端点——先在真实系统验证再定）。
**参考**：`.research/repos/abap-mcp-adt-main-main/src/lib/textElementsSource.ts`（自定义纯文本格式的双向序列化，**重点参考其格式解析**）；`abap/ZMCP_ADT_TEXTPOOL.abap`（WRITE_INACTIVE 暂存语义，将来做写侧时用）。
**工作量**：S-M（读）。

### P1-4 co-change 分析（传输共变）——vsp graph 的低成本切片

**动机**：`vsp graph co-change`（E070/E071 传输共变："什么通常一起变更"）只需我们已有的 transports 数据 + 查询，是分析套件里性价比最高的切片。
**规格**：新工具 `adt_cochange`：输入对象 → 查其历史传输（复用 listTransports/getTransport 数据面或加轻量查询）→ 聚合同请求共现对象 → 按共现次数排序输出（top N，默认 20，截断纪律话术）。
**参考**：`.research/repos/vibing-steampunk-main/docs/graph-guide.md`（co-change 一节：请求级折叠、按共享传输数排序）。
**工作量**：M（取决于 transport 数据面是否够用，可能需要 adt-protocol 加 E070/E071 查询——用 dataPreview 的 SQL 也行）。

### P2（按需启动，此处只记决策）

- **BTP/JWT/XSUAA/服务键认证**（roadmap 首位）：参考 abap-mcp 的 broker/stores/providers 分层 + `keychain:<service>/<account>` 引用 + 401/403 透明续期；我们 `auth` 扩展点已预留。**大项，独立规划**。
- **compat 能力探测升级**：`probe.ts` 从"URL 端口探测"升级为"按能力探测并给路由建议"（vsp `compat`：ATC/dumps/where-used 在各 release 的可用性矩阵；差异化探测结果落 registry 缓存）。
- **available_in 环境标注**：仅当支持多环境（cloud/ECC legacy）时做——工具描述/policy 标注环境适用性。
- **Compact CRUD 矩阵**：**决策规则**而非立即实施——将来新增对象类型长尾（RAP BDEF/SRVD/SRVB、屏幕、DDLX…）超过 ~5 类时，采用 `Handler verb × object_type` 矩阵 + 单一事实源文件（学 abap-mcp compactMatrix + vsp 通用工具教训），而不是继续加细粒度工具。
- **where-used 增强（WBCROSSGT 反向依赖）**：vsp graph 的 CROSS/WBCROSSGT 多跳 frontier 拉取算法可移植（经 RunQuery/dataPreview），服务影响分析。
- **dump 归因增强**：vsp 的 similar（相似聚类 ladder）与 correlate（与应用日志对时关联）——SLG1 日志读取是前置。

## 三、明确不采纳（决策记录，防反复讨论）

| 项 | 理由 |
|---|---|
| HTTP/SSE 多租户传输、Docker 分发、npm 包族拆分 | DSH 插件形态天然不需要（Cordis 单进程、preset 控面） |
| Lua 脚本引擎、YAML workflow | DSH 宿主已有 workflow/subagent/schedule 等价物 |
| 147/287 工具面、high/low 双轨 | vsp sweep 教训：工具面膨胀 → 死工具温床；我们 catalog pin + selfcheck 是防线 |
| ECC 桥接 Z 组件（ZMCP_ADT_*） | 与 vsp 结论一致：纯 ADT 优先；除非目标客户明确有 ECC 且 ADT 缺端点（届时参考 abap-mcp 的自举安装分发模式） |
| abap-mcp 的 rate-limit / header-validator | **宣称未实现**（子代理核实零引用），无借鉴对象 |
| WBCROSSGT 之外的 graph 全家（边界/死代码/影响图持久缓存） | 工程量大；先做 co-change 切片验证价值；缓存"建了不接线"是 vsp 的反面教训 |
| vsp 的 hyperfocused 单工具模式 | DSH 的 preset 机制已解决工具暴露控制 |

## 四、实施顺序建议

P0 全部（一个 session 可完成，合计 ~3-4 天当量）→ P1-1 Debugger（独立大项）→ P1-2/1-3（小项穿插）→ P1-4 → P2 按需。每项独立可交付、独立可测，无相互依赖（除 P1-1 依赖 protocol stateful 会话核实）。

---

*来源调研材料：`.research/vsp_lessons.md`、`.research/abapmcp_lessons.md`（详细机制与关键数字）、`.research/repos/` 两份源码快照。本文档由调研 session 生成于 2026-08，基线 246 测试 / 38 工具。*
