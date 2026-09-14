# ABAP Dictionary fs_ops 矩阵重构 — 调研报告

> 状态：调研完成（2026-09）。本文是「完整 ABAP Dictionary CRUD 矩阵 + fs_ops 语义」重构的第一阶段交付物。
> 证据来源：本仓库源码；`.research/` 下四个参考仓库（mcp-abap-adt、abap-mcp-adt、vscode_abap_remote_fs、vibing-steampunk）；
> `.research/npm/package`（@mcp-abap-adt/adt-clients 编译产物）；fr0ster/mcp-abap-adt 的真实系统
> `docs/adt-discovery.xml`（S/4 系统完整 discovery 捕获）；abap-adt-api（GitHub master）；SAP 帮助门户。
> 结论分级：**[实证]** 多源验证 / **[单源]** 单一来源 / **[待验证]** 设计推断，实施前需真机确认。

---

## 1. 目标语义：fs_ops（write / read / edit）替代 CRUD

用户决策：矩阵不使用 create/update/read/delete 语义，而用 Agent 场景更常见的 **fs_ops** 语义
（对齐文件操作心智模型：`write` 新建或覆盖，`read` 后 `edit`）：

| fs_ops 动词 | 语义 | 对应现状工具链 | 备注 |
|---|---|---|---|
| **write** | 新建；`write + override` 时已存在则覆盖 | `adt_create_object`（+ 新 override 分支） | override = 存在时 lock → 全量写入（源码型 PUT source；结构化型 read-modify-write 全字段） |
| **read** | 读取（源码或结构化元数据），OCC 快照 | `adt_read_object` / `adt_read_structure` | 不变 |
| **edit** | **必须先 read**，再增量修改（OCC 哈希冲突链） | `adt_edit_object` / `adt_write_structure`（changes 补丁） | 语义与现状 update 相同，改名并强制 read 前置 |
| **delete** | 删除 | `adt_delete_object` | 保留（用户矩阵含删除列） |

关键映射决策（调研结论）：

1. **write 的 override 分支对结构化编辑器不是「从零构建 XML」**。abap-adt-api 的
   `setDomainProperties`/`setDataElementProperties`（objectcontents.ts，已核原文）就是从零构建全量 XML，
   会丢失 SAP 管理属性。本仓库 0.5.x 审计已确立 read-modify-write 补丁路线（structure.ts）。
   override 的正确语义 = **「先 GET 解析当前值，用户提供的字段全部覆盖，未提供的保留」**——
   即对用户可见字段是 override，对 SAP 管理字段是 round-trip。
2. **edit 强制 read 前置**与现有 OCC 契约天然一致（`adt_edit_object` 对「你读到的快照」做确定性匹配）。
   fs_ops 化主要是动词重命名 + 门面层校验「本地快照存在」，不是新机制。
3. 用户矩阵中的 **「域值（Domain Value）」单列一行**：ADT 协议里域值不是独立对象（无独立 URI/锁/传输），
   而是 DOMA 元数据 XML 的 `<doma:fixValues>` 块。单列一行的实现 = 矩阵行 `DOMA_VALUE` 路由到
   DOMA 结构化编辑器的 fixedValues 子面（write=全量替换，read=随 DOMA 读回，edit=补丁），
   或（新系统）DDL 源码中 fixed values 块的文本编辑。**[实证]** 两种 wire 形态都存在。

---

## 2. 现状盘点（本仓库）

### 2.1 矩阵与门面

- `packages/adt-core/src/crudmatrix.ts`：单一事实源，`Record<type, {create|read|update|delete → {tool, mode}}>`，
  13 行（CLAS/INTF/PROG/INCL/FUNC/DDLS/TABL/STRU/DOMA/DTEL/TTYP/MSAG/DEVC），四动词 create/read/update/delete。
- `tools/crud.ts`：`adt_crud {verb,type,…}` 门面 → 路由到 owner 工具原样执行（策略/OCC/持久化链不动，
  `routedTool` 回显）；无 verb 调用返回能力矩阵卡；不支持格给出定向指引（vsp 教训）。
- `adt_create_object` 的类型枚举由矩阵派生（`crudCreatableTypes()`）——**矩阵扩展自动扩创建面**。
- 五道 parity 锁：矩阵 ↔ 协议 createByType ↔ 目录 pin ↔ tool-reference 表 ↔ selfcheck UNPROBED。

### 2.2 类型分面（现状）

| 面 | 类型 | 读/写通道 |
|---|---|---|
| 源码型（`/source/main`，text/plain） | CLAS/INTF/PROG/INCL/FUNC/DDLS/TABL/STRU | `adt_read_object`（快照+哈希）→ `adt_edit_object`/`adt_write_object`（锁内 PUT + 写后回读验证） |
| 结构化 XML 型（wbobj 媒体类型，read-modify-write 补丁） | DOMA/DTEL/TTYP/MSAG | `adt_read_structure` / `adt_write_structure`（lock → GET → patch 显式字段 → PUT → unlock） |
| 特例 | DEVC（读=包内容）、TABL 一步建表（fields → DDIC 2.0 DDL → 建完激活） | — |

### 2.3 治理链（任何 fs_ops 化不得绕过）

写侧：per-destination 策略（11 开关 + dev/qa/prd profile，prd 硬拒）→ 包白名单 → 传输策略
（assertExplicitTransport + 后端 CORRNR 回卷校验 + 违规回滚删除）→ 锁账本登记 → 写后回读 persisted 验证。
读侧：敏感表黑名单。这些链挂在 owner 工具上，门面路由原样继承——矩阵重构只动「行与动词」，不动链路。

---

## 3. ADT 协议能力全景（按编辑形态分类）

真实 S/4 系统 discovery（fr0ster 捕获，含 S/4 2023 家族）里 `/sap/bc/adt` 下 DDIC 相关服务全集，
按「内容怎么编辑」分四类（这是矩阵行实现路径的决定因素）：

### 3.1 源码型 DDL 对象（`…/sources` 集合 + `/source/main` + validation）**[实证]**

| 类型码 | 端点 | 媒体类型（create body） | 说明 |
|---|---|---|---|
| DDLS | `ddic/ddl/sources`（+`ddl/createstatements` 模板服务） | `vnd.sap.adt.ddlSource.v2+xml` | CDS 全家（见 §3.5） |
| DCLS | `acm/dcl/sources` | — | CDS 访问控制 |
| DDLX | `ddic/ddlx/sources` | `vnd.sap.adt.ddic.ddlx.v1+xml` | 元数据扩展 |
| DDLA | `ddic/ddla/sources` | — | 注解定义 |
| BDEF | `ddic/bdef/sources` | — | RAP 行为定义 |
| SRVD | `ddic/srvd/sources`（+`srvd/sourceTypes`/`srvd/services` 值帮助） | — | 服务定义（create 需 `srvd:srvdSourceType="S"`，abap-adt-api 实证） |
| **ENQU** | **`ddic/lockobjects/sources`** | `vnd.sap.adt.lockobjects.v1+xml`（enqudl 类别） | **锁对象是 DDL 源码型**；辅助服务 lockmodes/tables/adjustment/validation 齐备 |
| SRVB | `businessservices/bindings`（+bindingtypes：ODATA V2/ina1/sql1） | `srvb` XML | 服务绑定：创建需选 binding type + service definition，激活=publish（语义特殊） |

S/4 2023+ 新增长尾（discovery 实证存在，社区零支持）：DRAS（Aspect）、DRTY（Type）、
DRUL（Dependency Rule）、DSFD（标量函数定义）、DSFI（标量函数实现）、DTDC（Dynamic Cache）、DTEB（Entity Buffer）。
按既有 long-tail 规则：只加矩阵行 + 协议端点，不加细粒度工具。

### 3.2 结构化 XML 编辑器（wbobj properties 模板 + v2 媒体类型）**[实证]**

| 类型码 | 端点 | 媒体类型 | 现状 |
|---|---|---|---|
| DOMA | `ddic/domains` | `vnd.sap.adt.domains.v2+xml` | ✅ 已实现（含 fixValues） |
| DTEL | `ddic/dataelements`（+docu supplements/status） | `vnd.sap.adt.dataelements.v2+xml` | ✅ 已实现（含 labels；S/4 有 `blue:wbobj` 载体形态，已兼容） |
| TTYP | `ddic/tabletypes` | `vnd.sap.adt.tabletypes.v2+xml` | ✅ 已实现 |
| TABL/STRU | `ddic/tables` / `ddic/structures`（blueSource + parser/info） | blueSource → DDL 源码 | ✅ 已实现（源码路径 + 一步建表） |
| MSAG | `messageclass` | `mc.messageclass+xml` | ✅ 已实现 |

**重要补充 [单源→实证临界]**：DOMA/DTEL/TTYP 在 ABAP Cloud / 新 S/4 上**另有 DDIC DDL 源码形态**
（`/ddic/domains/{name}/source/main`；@mcp-abap-adt/adt-clients 的 typeInfo.js 在真实系统读取该路径；
SAP ABAP Cloud 关键字文档存在 `ddic-ddl-define-domain`、`ddic-ddl-define-table-type` 页面）。
fr0ster 的 discovery 捕获里 domains **没有** source 模板 → 该能力有版本门槛。设计上矩阵一格双实现：
优先探测 `/source/main`，404 回退结构化 XML（与 TABL 的 DDL 源码路径同一模式）。

### 3.3 表单/server-driven 型（`$schema`/`$configuration` JSON + blues.v1）**[实证]**

| 对象 | 端点 | 备注 |
|---|---|---|
| 索引（INDX，TABL 子对象） | `ddic/db/indexes`（tabldti；**有 `/source/main` 与 properties 模板**，JSON formatter） | 索引可源码化编辑 |
| 扩展索引 | `ddic/extensionindexes`（xinxdtx） | append 场景 |
| 技术表设置 | `ddic/db/settings`（`table.settings.v2+xml` + dataClass/size/keyFields 值帮助） | TABL 子面 |
| DESD（逻辑外部 schema） | `ddic/desd` | 长尾 |

### 3.4 GUI-only（无 REST 编辑服务；部分可只读）**[实证]**

| 对象 | 证据 | 矩阵结论 |
|---|---|---|
| **经典 SE11 视图**（数据库/投影/维护/帮助视图） | discovery 的 `ddic/views` 挂在 **"ABAP External Views"** workspace、`app:accept` 为**空**、无模板链接——是外部视图（HANA），不是 SE11 视图；vscode_abap_remote_fs 将 VIEW/DV 标为 `gui_objects: "better"`（GUI 维护更好），仅以元数据 XML 只读呈现 | **read（元数据）+ delete 可做；write/edit 如实标 —**（引导 SE11/SAP GUI） |
| **SHLP 搜索帮助** | discovery 全文无 `ddic/searchhelps`（IAM 的 searchhelp 是授权对象另一回事） | 同上：read（元数据 XML）[待验证 Accept 细节] + delete [待验证]；write/edit — |
| 视图簇（view cluster） | 无任何服务 | 全列 — |
| TYPE 类型组 | discovery **有** `ddic/typegroups` + validation **[实证]**；abap-adt-api 未纳入创建注册表 | 待验证创建；倾向 read/delete 先行 |
| append 结构 | 不在 discovery ddic 列表（adt-clients 有 appendStructure family） | 待验证 |

### 3.5 CDS 家族细分（DDLS sourceTypeUse）**[实证]**

DDLS 创建时的 `ddlSourceTypes`/sourceTypeUse 决定实体形态：View Entity（`define view entity`，现代默认）、
View（经典 CDS）、Custom Entity、Abstract Entity、Projection View（VPOR 另说）、Extend View（扩展，
同一 `ddic/ddl/sources` 集合 + extendView 标志）。用户矩阵「CDS（Domain）」一行按此拆解：
- on-prem 主力 = DDLS（源码型，全动词）；
- 「CDS 域」若指 ABAP Cloud 的 `define domain` → 已并入 §3.2 的 DOMA 双形态说明。

### 3.6 值帮助类通用服务（对所有 write 有用）**[实证]**

每类 `…/validation`（名称/包预检，POST，abap-adt-api `validateNewObject` 模式）；
`ddic/ddl/createstatements`（DDL 骨架模板）；`repository/typestructure`（POST，返回后端全部对象类型与
CAPABILITIES——**权威的可创建面探测**，可作为运行时矩阵校准/降级依据）。

---

## 4. 差距分析 → 目标矩阵草案

动词列改为 **write / read / edit / delete**（write 支持 `override`）。现状 ✅；🟡 需小改；🆕 需新增；❌ 不支持（如实标注+指引）。

| 类型（Data Type） | write | read | edit | delete | 实现路径与把握 |
|---|---|---|---|---|---|
| 域 DOMA | 🟡（create→write + override 分支） | ✅ | ✅（改名词） | ✅ | 结构化 XML；新系统可探测 DDL 源 |
| 域值 DOMA fixedValues | 🆕（=write DOMA 的 fixedValues 全量） | 🟡（随 DOMA read） | ✅（现 changes.fixedValues） | 🟡（清空=写空列表） | 矩阵行路由到 DOMA 编辑器子面 [实证 wire] |
| 数据元素 DTEL | 🟡 | ✅ | ✅ | ✅ | 同 DOMA |
| 表 TABL | ✅（一步建表即 write+fields） | ✅ | ✅ | ✅ | 源码型（DDIC 2.0 DDL） |
| 结构 STRU | 🟡 | ✅ | ✅ | ✅ | 源码型 |
| 表类型 TTYP | 🟡 | ✅ | ✅ | ✅ | 结构化 XML；DDL 源探测同 DOMA |
| 索引 INDX | 🆕 | 🆕 | 🆕 | 🆕 | blueSource 源码型（db/indexes/{name}/source/main）[实证端点，wire 待验证] |
| 经典视图 VIEW | ❌（SE11） | 🆕（元数据 XML） | ❌ | 🆕（通用 deletion 服务） | 只读行 [单源] |
| 锁对象 ENQU | 🆕 | 🆕 | 🆕 | 🆕 | **源码型（enqudl）**，端点+validation 齐备 [实证]；create body/DDL 语法待抓包 |
| 搜索帮助 SHLP | ❌（SE11） | 🆕（元数据，待验证） | ❌ | 🆕（待验证） | GUI-only |
| CDS 视图 DDLS（含 view entity/custom/projection/extend） | ✅（+sourceTypeUse 参数化） | ✅ | ✅ | ✅ | 源码型 [实证] |
| CDS 访问控制 DCLS | 🆕 | 🆕 | 🆕 | 🆕 | 源码型（acm/dcl/sources） |
| CDS 元数据扩展 DDLX | 🆕 | 🆕 | 🆕 | 🆕 | 源码型 |
| 行为定义 BDEF | 🆕 | 🆕 | 🆕 | 🆕 | 源码型 |
| 服务定义 SRVD | 🆕 | 🆕 | 🆕 | 🆕 | 源码型（sourceType="S"） |
| 服务绑定 SRVB | 🆕（需 bindingtype+service） | 🆕（XML 元数据） | 🟡（结构化） | 🆕 | 激活=publish 语义特殊 |
| 消息类 MSAG | 🟡 | ✅ | ✅ | ✅ | 结构化 XML |
| 包 DEVC | ✅ | ✅ | ❌（如实） | ✅ | 不变 |
| 类型组 TYPE | 🆕? | 🆕 | ❓ | 🆕? | typegroups 服务存在，创建待验证 |
| S/4 2023 长尾（DRAS/DRTY/DRUL/DSFD/DSFI/DTDC/DTEB） | 长尾 | 长尾 | 长尾 | 长尾 | 只加矩阵行+端点（long-tail 规则） |

**矩阵的诚实性原则不变**：不支持格必须显式失败并给出替代指引（SE11/GUI 路径），绝不静默假装成功。

---

## 5. 主要风险与待验证项（实施前清单）

1. **ENQU 的创建 body 与 DDL 语法** **[待验证]**：discovery 证明服务存在（vnd.sap.adt.lockobjects.v1+xml、
   properties 模板含 corrNr/lockHandle/_action），但无开源客户端实现 ENQU 创建（mcp-abap-adt 无 handler）。
   需真机抓包（ADT Eclipse 新建锁对象）确认 create body 与 `define lock object` 源码语法。
2. **DOMA/DTEL/TTYP 的 DDL 源码门槛**：ABAP Cloud 关键字文档 + adt-clients 实读证明存在；on-prem 的
   最低 release（2023 FPS?）未确认。方案：能力探测（404 回退）而非版本硬编码——与既有 selfcheck 哲学一致。
3. **SRVB 的 write/edit 语义**：bindingtype 值帮助、ODATA V2 vs ina1/sql1、publish≠activate。
   mcp-abap-adt 有完整 handler 组可参考，但建议 P1 单独批次。
4. **经典视图/SHLP 只读 wire**：vscode_abap_remote_fs 把它们当 `AbapXml`（扩展名 .view.xml/.shlp.xml）经
   对象 URI 读取；具体 Accept 头需真机确认（很可能是 GET 对象 URI 默认 XML）。deletion 通用服务对 GUI-only
   类型是否可用同样待验证。
5. **override 语义与 OCC 的交互**：override 覆盖也应在锁内做哈希校验（写前服务端未变），但**不要求**
   调用方先 read（语义上 override 允许盲写）。需明确：override 时服务端哈希比对失败 → 报冲突而非静默覆盖
   （与「编辑成功但被同账号旧会话回写」的实战教训一致）。
6. **mock 扩展面**：lockobjects/sources、acm/dcl/sources、ddlx/bdef/srvd/sources、businessservices/bindings、
   typegroups、views 元数据读取 —— mock 是 CI 的全部真相，每个新矩阵行都要有 mock 对应面。
7. **动词迁移的兼容策略**：`adt_crud` 的 verb 枚举 create/read/update/delete → write/read/edit/delete。
   既有 agent-guide/tool-reference/selfcheck/parity 测试五处同步；建议保留旧动词作为别名过渡一个版本
   （response 里回显规范动词），或直接切换并升级主版本号——需用户决策。

## 6. 建议实施分期

- **P0（核心面）**：动词语义切换（write/read/edit/delete + override）+ DOMA_VALUE 行 + DEVC 不变项；
  write 的 override 分支（源码型 + 结构化型）；矩阵/门面/文档/parity 全量重锁。
- **P0.5（源码型新行，端点已实证、模式与 DDLS 同构）**：DCLS / DDLX / BDEF / SRVD（+ DDLS sourceTypeUse
  参数化）；mock 对应集合；ENQU 待抓包后并入本批。
- **P1（特殊形态）**：SRVB（binding 流）；INDX（索引，TABL 子对象）；DOMA/DTEL/TTYP 的 DDL 源探测与回退。
- **P2（如实只读行）**：VIEW / SHLP / TYPE 的 read（+ 可行则 delete）；GUI-only 格的定向指引文案。
- **长尾**：S/4 2023 家族按 long-tail 规则随需求追加。

---

## 附：证据索引

| 结论 | 来源 |
|---|---|
| ENQU 源码型服务 | `.research/repos/mcp-abap-adt-main/docs/adt-discovery.xml` L2792–2805, L5030–5047 |
| 索引/表设置/外部视图/2023 家族服务 | 同上 L2375–2433, L2524–2756, L5128–5139 |
| 创建注册表（DDLS/DCLS/DDLX/DDLA/SRVD/SRVB/AUTH/SUSO…） | abap-adt-api `src/api/objectcreator.ts`（GitHub master 实读） |
| DOMA/DTEL 结构化 XML wire | abap-adt-api `objectcontents.ts`；本仓库 `adt-protocol/src/structure.ts` |
| domain/tabletype DDL 源 | @mcp-abap-adt/adt-clients `dist/core/shared/typeInfo.js`；SAP ABAP Cloud 关键字文档 `ddic-ddl-define-domain`/`define-table-type` 页存在 |
| VIEW/SHLP/ENQU GUI 倾向 | vscode_abap_remote_fs `modules/abapObject/src/registry.ts`（gui_objects 标注） |
| 能力矩阵（Get View/SearchHelp/LockObject 支持） | vibing-steampunk `reports/adt-capability-matrix.md` §1 |
| typestructure 探测服务 | abap-adt-api `objectcreator.ts` `loadTypes()` |
| BDEF/SRVD/SRVB 端点 | @mcp-abap-adt/adt-clients `dist/utils/activationUtils.js`；mcp-abap-adt handler 目录 |
