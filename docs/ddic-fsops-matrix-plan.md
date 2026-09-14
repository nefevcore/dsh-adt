# ABAP Dictionary fs_ops 矩阵 — 实施计划

> 状态：计划 v2（2026-09，按用户三项决策重构）。前置调研见
> [`docs/ddic-fsops-matrix-research.md`](ddic-fsops-matrix-research.md)（协议证据、类型全景、风险清单）。
>
> **A 组移除批次已执行（2026-09-14）**：九个 CRUD 世代工具（adt_crud / adt_create_object /
> adt_read_object / adt_read_structure / adt_write_object / adt_edit_object / adt_write_structure /
> adt_delete_object / adt_package_content）从注册目录下架，实现保留为四工具的**内部引擎**
> （`assembleAdtTools` 构建 engineMap 但不注册）。目录 50→**40**（非计划预估的 41：实际清单 36+4）。
> write/edit:source 引擎已接线（路由 owner 实现函数）；persona / agent-guide / tool-reference /
> README 全部改写为四工具心智模型；死引用 grep 测试进 CI（fsmatrix.test 'dead-reference sweep'）；
> `REMOVED_A_GROUP_TOOLS` / `CRUD_TO_FS_VERBS` 从 index 导出供迁移提示。全仓 331/331。
>
> **实施状态（框架已落地）**：`src/typeregistry.ts`（§3 注册表，29 行类型全量就位）、
> `src/fsmatrix.ts`（§4 矩阵投影：verb × type × status，非 yes 格带诚实文案）、
> `src/tools/fsops.ts`（§1 四工具骨架：无 name = 矩阵卡；read/edit-structured/delete 已路由 owner；
> write 引擎按提交切分落地前 frameworkPending 拒绝）。四工具与 CRUD 世代双注册（目录 50，
> 移除批次后 41）。测试：`test/fsmatrix.test.ts`（20 项：注册表不变量、矩阵纯投影、
> 协议 createByType ⊆ 注册表、诚实拒绝文案、owner 路由回路）。能力填充按 §9 提交切分推进。
>
> **P1 真实环境验证（2026-09-14，deloitte-kic / S4C 门户型系统，client 100）— 全链 28/28 证明**，
> 脚本 `scripts/verify-p1-real.mjs`（含探针 probe2-14 与清理脚本）。矩阵 ✅ 的诚实来源即此：
>
> | 类型 | create | read | edit(RMW) | activate | delete | 备注 |
> |---|---|---|---|---|---|---|
> | DOMA | ✅ 201 | ✅ 结构化 XML | ✅ lock+PUT | ✅ | ✅ | 无 DDL 源形态（404，符合版本门槛预期） |
> | DTEL | ✅ 201 | ✅ | ✅ | ✅ | ✅ | |
> | TTYP | ✅ 201 | ✅ | — | — | ✅ | |
> | TABL | ✅ 201 | ✅ DDL 源 | ✅ DDL PUT | ✅ | ✅ | 一步建表含激活亦通 |
> | DDLS | ✅ 201 | ✅ 源码 | ✅ 源 PUT | ✅ | ✅ | 依赖源表 prep 亦通 |
>
> **该后端的实证 wire 形态（能力画像 §3.5 的第一批真实数据）**：
> 1. **创建 body 形态**：DOMA=`doma:domain` 根（CT/Accept 均 `domains.v2`）；DTEL=`blue:wbobj` 载体（`wbobj/dictionary/dtel` 命名空间）；TTYP=`ttyp:tableType` 根 + CT **`tabletype.v1`（单数！）**；TABL=`blue:blueSource`；DDLS 端点 **`/ddic/ddl/sources`**（非 ddls/sources！）CT=`ddlSource`（无 v2 后缀）。
> 2. **严格 Accept 协商**：一切写/读都必须带类型专有媒体类型或 `*/*`；裸 `application/xml` 一律 406。source/main 读取仅接受 `*/*`（text/plain 与 source.v1 均被拒）。
> 3. **锁语义**：`POST {uri}?_action=LOCK&accessMode=MODIFY`（大写 LOCK；`{uri}/lock` 子路径 404），handle 在 `asx:values/LOCK_HANDLE`；PUT 带 `?lockHandle=`；解锁 `_action=UNLOCK`（大写）。
> 4. **stateful 会话纪律**：**从第一个 discovery 请求起全程带 `x-sap-adt-sessiontype: stateful` + 稳定 `sap-adt-connection-id`**；无状态阶段后突转 stateful 会开出 ANON sap-contextid，下一个请求即 "Service cannot be reached"。cookie jar 必须键值分离合并（整对存储重建时键翻倍毁会话）。
> 5. **激活路径**：`/activation`（compat 兼容路径）✅；`/repository/activation` 404（与 NW 7.4x 同型）。
> 6. **deletion**：body 内 **uri 必须全路径**（含 `/sap/bc/adt` 前缀），剥前缀即 500；`_action=DELETE` legacy 回退在此后端 404。
>
> **mock 双档位（2026-09-14 落地，反哺保真度）**：`createMockAdtServer({ profile })`——
> `legacy`（默认，demo 与既有测试语料）保持宽松形态；**`strict` 复刻 deloitte-kic 的六条实证形态**
> （严格 Accept 协商→406、`/repository/activation`→404 仅 compat 路径、`_action=DELETE`→404 走 deletion 服务
> （body 全路径校验，剥前缀 500）、LOCK 强制 `accessMode=MODIFY`（缺参 400）、stateful 会话纪律违规→ICM 错误页）。
> 测试 `packages/adt-mock/test/strict.test.ts`（8 项）：**实证 wire 形态全链通过 + 客户端旧形态如实失败**——
> mock 的绿从此意味着「真实网关会接受」。能力画像（§3.5）的 per-destination 探测落地后，CI 用 strict 档位
> 作为 deloitte 类后端的常驻替身。
>
> **P1 补齐 + P2 + P3 + P4 真实验证（2026-09-14 第二轮，脚本 `scripts/verify-p234-real.mjs`）— 53/53 证明**：
>
> | 类型 | 阶段 | 链条 | 结果 | 关键 wire 发现 |
> |---|---|---|---|---|
> | STRU | P1 | create→DDL读→DDL写→激活→删 | ✅ 全链 | 空 DDL 骨架 PUT 回去被源检查拒（须写有效结构 DDL） |
> | DCLS | P1 | create→read→delete | ✅ 全链 | 端点 `acm/dcl/sources`，CT `dclSource` |
> | DDLX | P1 | create→read→delete | ✅ 全链 | CT `ddic.ddlx.v1`，根 `ddlxsources:ddlxSource` |
> | TTYP | P1 | create→RMW→激活→删 | ✅ 补齐 | RMW 用 `tabletype.v1`（单数） |
> | DOMA_VALUE | P1 | 建域→写fixValues→回读→清空→删 | ✅ 全链 | **fixValues 必须嵌在 `content>valueInformation` 内**；外层块被静默丢弃（PUT 200 但不持久化） |
> | PROG/CLAS/INTF | P2 | create→写源→读→删 | ✅ 全链×3 | **创建必须用类型专有命名空间根**（`program:abapProgram`/`class:abapClass`/`intf:abapInterface`）；通用 objectReference 400 |
> | FUNC | P2 | create→写源→读→删 | ✅ 全链 | 集合与对象 URI 均为 `/functions/groups/{name}`（非 `/fugr`） |
> | BDEF | P3 | create→read→delete | ✅ 全链 | 端点 **`/bo/behaviordefinitions`**（非 ddic/bdef/sources），CT `blues.v1` |
> | SRVD | P3 | create→read→delete | ✅ 全链 | sourceType 是 **body 属性** `srvd:srvdSourceType="S"`（query 形态 400） |
> | SRVB | P3 | create(拒绝)→delete | 🟡 如实 | create 400（引用的 service definition 不存在——预期）；绑定全链需真 RAP 栈，引擎批次做 |
> | MSAG | P4 | create→read→RMW→delete | ✅ 全链 | 与 client.ts 现有形态一致 |
> | VIEW/SHLP | P4 | 只读探针 | ✅ 如实无面 | 无 ADT 服务（SE11 only，符合预期） |
> | TYPE | P4 | create 探针 | 🟡 如实 | 通用 body 400——专有形态未知，保持 unverified |
>
> **第二轮多环境验证（2026-09-14，impc-dev / impc-test，脚本同上 + `probe-env/18-21`）**：
>
> | 环境 | 结果 | 画像要点 |
> |---|---|---|
> | **impc-dev**（client 110，ZH，NW D01） | **P1 25/25 + P2-P4 53/53 全绿** | ① 创建/PUT body 的 `language/masterLanguage` 属性**必须匹配登录语言**（EN 对象在 ZH 系统被 400 ExceptionInvalidData 拒）② MSAG 对象 URI 仅 `/messageclass/`（deloitte 是 `/msgclass/`，需 GET 探测自适应）③ **messageclass create 残留自锁**且 LOCK 对已锁对象 403 不自刷新——RMW 前须先无 handle UNLOCK ④ deletion body 的 `<del:transportNumber/>` 自闭合被拒（须完整元素或省略）⑤ BDEF/SRVD/FUNC/DCLS 等全部端点与 deloitte 实证形态一致 |
> | **impc-test**（client 300，ZH） | **系统策略拒绝所有 DDIC/RAP create**（409「在此客户端中不允许更改资源库对象」）；MSAG 全链 ✅、只读探针 ✅ | 不可更改客户端（SCC4 语义）——**per-destination 能力画像（§3.5）的活例证**：同一 wire 形态，系统级策略决定 write 可用性；矩阵卡带 destination 时此环境 write 格应如实降级 |
>
> **跨三环境能力画像汇总（write 引擎的实现输入）**：deloitte-kic（严格协商+compat 激活+stateful 纪律）、impc-dev（语言匹配+锁前解锁+deletion 完整元素）、impc-test（只读客户端）。共性：锁/PUT/激活/删除的**实证 wire 形态在 deloitte 与 impc-dev 完全一致**（`?_action=LOCK&accessMode=MODIFY`、`?lockHandle=`、compat `/activation`、deletion 全路径 URI）——差异集中在**入口约束**（Accept/语言/策略），这正是画像层要吸收的。
>
> **用户决策**：
> 1. 目标是 **四个 `adt_fs` 工具**：`adt_object_write` / `adt_object_read` / `adt_object_edit` / `adt_object_delete`；
> 2. 四工具统一签名 `adt_object_*(type, name, args)`，**端点解析完全由工具层完成**（Agent 自己传端点效果很差）；
> 3. 矩阵分四阶段完善：①基础 DDIC 类型 ②程序与类 ③RAP ④剩余对象。

---

## 1. 目标工具契约

四个工具是 **fs_ops 语义的门面**：`(type, name, args)` 进，按矩阵路由到 owner 工具执行，
owner 的完整链（策略/OCC/锁账本/写后回读/传输治理）原样继承，`routedTool` 回显实际执行者。

### 1.1 adt_object_write(type, name, args)

```text
type        必填  对象类型短码（矩阵行，如 DOMA/TABL/DDLS）
name        必填  对象名（ZMY_DOMAIN）
--- 通用 ---
destination / transport
description 必填* 新建时的短描述（override 改描述也走它）
packageName 必填* 新建时的目标包（$TMP 本地）
override    可选  false（默认）：已存在 → 明确报错并提示 override；
                  true：已存在 → 锁内覆盖（见 §2.1 override 语义）
activate    可选  DDIC/CDS 类型默认 true（write 即激活，沿用 TABL 一步建表语义）
--- 内容（按类型的编辑形态三选一，见 §3 注册表） ---
source      源码型：完整源码/DDL 文本（write 一步 create+写入+激活）
fields      TABL/STRU：字段清单一步流（沿用 generateTableDdl，自动 MANDT）
properties / fixedValues / labels   结构化型：技术属性/域值/标签
bindingType / serviceDefinition     SRVB（P3）：绑定形态参数
```

- 无内容调用 = 占位创建（保持现状语义），输出明示"占位，未写内容"。
- 返回：`{verb:'write', type, name, created|overridden, activated?, routedTool, …owner 原样输出}`。
- **不收 `objectUri`/端点参数**——这正是本工具的意义（见 §2 原则 1）。

### 1.2 adt_object_read(type, name, args)

```text
type/name   必填；省略 name 时返回当前能力矩阵卡（四个阶段各自的覆盖面）
version     active|inactive|saved|latest（透传 owner）
context     CLAS/INTF（P2）：依赖契约序言
method      CLAS/INTF（P2）：方法级读取（token 经济）
raw         结构化型（DOMA/DTEL/TTYP/MSAG）：附原始 wire XML（排障用）
```

- 源码型 → `adt_read_object`（建 OCC 快照，文件侧车 + baseHash）；
  结构化型 → `adt_read_structure`（typed JSON）；
  DEVC → `adt_package_content`；GUI-only 行（VIEW/SHLP，P4）→ 元数据只读（新 owner 面）。

### 1.3 adt_object_edit(type, name, args)

```text
type/name   必填
--- 源码型（OCC 链） ---
source / sourceFile   全量新源码（等价现 adt_write_object，但保留 OCC 校验）
mode: 'replace' | 'block' | 'method'   块/方法级手术（block: old/new 对；method: P2）
--- 结构化型 ---
properties / fixedValues / labels / messages / description   只补丁显式字段
--- 通用 ---
transport / packageName(hint) / activate（DDIC 默认 true）
```

- **源码型硬约束**：本地必须存在快照（`adt_object_read` 产物）；无快照 → 报错引导先 read
  （沿用 SnapshotConflictError 契约，服务端哈希不符 = 冲突拒绝）。
- **结构化型软约束**：无快照仅输出 note 提示先 read（RMW 的真基线是锁内 GET，安全性不依赖快照）。

### 1.4 adt_object_delete(type, name, args)

```text
type/name   transport   （其余无；不可逆语义保持）
```

- 矩阵 ❌ 格（GUI-only 的 write/edit）不影响 delete 通用性——由矩阵行单独标注 delete 可否。

---

## 2. 设计原则（沿用 + 新增）

1. **Agent 永不传端点**。`(type, name)` → 严格解析（现状 `resolveToolObject` 已具备：精确名搜索优先、
   约定 URI 回退、变更类 strict 模式）。四工具的 schema 里干脆**不出现** URI/端点参数。
2. **门面不二实现**：路由到 owner 工具，owner 带全链；矩阵与目录漂移 = 测试失败（沿用 0.6.0 决策）。
3. **矩阵单一事实源**：verb × type × owner × **编辑形态** × **激活语义**。`adt_object_*` 的
   type 枚举、args 合法性、错误指引文案全部从矩阵派生。
4. **诚实矩阵**：不支持的格显式失败 + 指出该类型支持什么 + GUI-only 格给出 SE11 指引。
5. **write = create-or-override，edit = read-then-patch**：见 §2.1。

### 2.1 动词语义规范（关键细节）

**write（新建）**
- 源码型：`create → lock → PUT source → unlock → activate`（一步；TABL/STRU 的 fields 流并入）。
- 结构化型：`create 占位 → lock → GET → 应用用户字段 → PUT → unlock → activate`。
  内容为空则止步占位。
- 已存在且未 override：报错（列出类型支持的全部动词）。

**write + override（覆盖）**
- 源码型：`lock → （服务端哈希在写前校验，仅防同刻并发，不要求调用方 read）→ PUT 全量 → unlock → activate`。
  盲写允许（fs 语义），但并发保护仍在：哈希失配 → `[CONFLICT]` 拒绝并建议 read。
- 结构化型：override ≠ 从零构建 XML（abap-adt-api 路线，丢 SAP 管理属性，已否决）。语义 =
  **锁内 GET → 用户提供的字段全部覆盖（含 fixedValues/labels/messages 整块替换）→ 未提供字段保留 → PUT**。
- 删除性覆盖：`fixedValues: []` = 清空域值（整块替换的空集），不与"未提供"混淆。

**edit（修改，read 前置）**
- 源码型：OCC 快照匹配 → 锁内哈希校验 → 写 → 解锁 → 回读验证（persisted 标志，含同账号旧会话回写检测）。
- 结构化型：锁内 RMW 补丁（现 `adt_write_structure` 语义，改名词归位）。

**read / delete**：与现状同；read 额外为 edit 建立基线。

---

## 3. 类型注册表（端点解析核心，新 `src/typeregistry.ts`）

把现在分散的三处事实合并为单一注册表，四工具与矩阵都从它派生：

| 来源（现状） | 并入字段 |
|---|---|
| `resolve.ts TYPE_MAP` | adtType / uriPrefix / label（VIEW/BDEF/SRVD/DDLX/DCLS 条目已存在，直接复用） |
| `endpoints.ts createByType` | createCollection + create 媒体类型 + validationPath |
| `structure.ts KINDS` + 协议 `structure.ts` | structureKind + v2 媒体类型（结构化面） |

每行：`{ type, adtType, uriPrefix, label, phase, editMode: 'source'|'structured'|'binding'|'none',
sourcePath?（'/source/main' 形态）, structureKind?, createEndpoint?, createMediaType?, validationPath?,
activates: 'ddic'|'none'|'publish', subObjects?: ['fixedValues'…] }`

**版本维度字段（新增，见 §3.5）**：
`mediaTypeVersions: ['v2','v1']`（该类型已知的媒体类型版本，降序）、
`editForms: ['structured','ddlSource?']`（同类型的多种 wire 形态，`?` = 探测确认后启用）、
`minProfile?: 'legacy'|'modern'`（该行要求的最低后端档位）。

### 3.5 目的地能力画像（capability profile）——矩阵的运行时校准层

ADT 协议**分版本**，同一类型在不同后端有不同最高操作形态：

| 版本维度 | 形态 | 例子 |
|---|---|---|
| **媒体类型版本** | `vnd.sap.adt.*.vN` 后缀 | `domains.v2+xml`、`ddlSource.v2+xml` vs `ddlSource+xml`、`lockobjects.v1+xml` |
| **编辑形态** | 同类型两种 wire | DOMA/DTEL/TTYP：结构化 XML（老）vs DDL 源码（ABAP Cloud/2023+）；TABL/STRU：DDL 源码（现代）vs 无写面（最小后端） |
| **服务存在性** | 集合级 | ENQU/SRVB/DTDC… 服务在后端是否注册 |
| **能力面** | 类型级 | typestructure 返回每类型的 CAPABILITIES（create/delete/lock…） |
| **release 档位** | 语义差异 | 7.4x legacy（同步单测、兼容激活路径、MSAG 双拼写）vs 现代——现散落的 quirks 收拢为画像标志 |

**三层结构**：`typeregistry`（静态超集，随插件发布）→ **capability profile**（每目的地运行时探测，缓存于 AdtRegistry）→ **生效矩阵**（矩阵卡 / write·edit 路径选择 / selfcheck 报告）。

**探针集（全只读，按需懒探测）**：

| # | 探针 | 输出 | 成本 |
|---|---|---|---|
| P-1 | **discovery 解析增强**：全量收集每集合的多 `<app:accept>`、`category`、`templateLinks`（properties/source 模板） | 集合 → 可用媒体类型版本表 + 编辑形态声明 + 服务存在性 | **0**（复用现有 CSRF discovery 请求；现状 parseDiscovery 只取第一个 accept，需改为全量） |
| P-2 | **typestructure**：`POST /repository/typestructure` | 每类型 CAPABILITIES（SEU_ACTION 列表）——"该后端认为 X 可 create 吗"的权威答案 | 1 请求/目的地 |
| P-3 | **source 形态探测**：`GET <uri>/source/main` | DOMA/DTEL/TTYP/TABL 等的 DDL 源码形态可用与否（懒探测：首次触碰该类型时） | 每类型 1 次，缓存 |
| P-4 | **媒体类型协商**：discovery accepts 声明式取最高（v2>v1）；无声明 → Accept 列表 `"v2, v1"` 让服务端选（现状做法兜底）；406 → 降级重试一次 | 每类型的最高可用媒体类型版本 | 0（声明式）/ 1（兜底） |
| P-5 | **release 档位**：已有 `systemInfo`（JSON release → discovery feature 键回退链） | legacy/modern/2023+ 档位 | 已有 |

**缓存与失效**：画像存 `AdtRegistry`（per destination），会话级缓存 + `refresh` 显式刷新参数；矩阵卡（`adt_object_read` 无 name + destination）触发该目的地全量校准；selfcheck 巡检把画像计入报告。

**写路径选择（版本协商的消费者）**——以 DOMA edit 为例：
1. 画像声明 DOMA 有 source 模板（discovery templateLink）**或** P-3 探测 200 → 走 DDL 源码路径（最高形态）；
2. 否则结构化 XML，媒体类型取画像最高版本（v2 > v1；无声明用协商兜底）；
3. 都不可用 → 矩阵格如实降级 ❌ + 指引（诚实矩阵原则同样适用于"该后端不支持"）。

TABL 同理：DDL 源码路径 404 的最小后端（如 impc-dev 类 profile）→ 如实报错（本仓库不实现 wbobj 表格 XML 写面，降级而非假装）。

**矩阵卡双形态**：带 destination → 生效矩阵（每格 `via: source | structured(v2) | binding` + 探测状态 probed/assumed/absent）；无 destination → 静态超集。
- 矩阵 parity 锁升级为：**注册表 ↔ 矩阵 ↔ 协议 createByType ↔ 目录 pin ↔ tool-reference ↔ mock 路由**
  （六道；mock 面加入锁是本计划新增，防"矩阵有行、mock 无面"的测试盲区）。

---

## 4. 目标矩阵（分期标注）

动词 write/read/edit/delete；write 均含 override 能力（除注明）。**P1…P4 = 用户四阶段**。

| 类型 | write | read | edit | delete | editMode | activates | 阶段 |
|---|---|---|---|---|---|---|---|
| DOMA 域 | ✅ | ✅ | ✅ | ✅ | structured（+DDL 源探测） | ddic | **P1** |
| DOMA_VALUE 域值 | ✅(fixedValues) | ✅(随域) | ✅ | ✅(清空) | structured 子面 | ddic | **P1** |
| DTEL 数据元素 | ✅ | ✅ | ✅ | ✅ | structured（+DDL 源探测） | ddic | **P1** |
| STRU 结构 | ✅(+fields) | ✅ | ✅ | ✅ | source（DDIC DDL） | ddic | **P1** |
| TABL 表 | ✅(+fields 一步) | ✅ | ✅ | ✅ | source | ddic | **P1** |
| TTYP 表类型 | ✅ | ✅ | ✅ | ✅ | structured（+DDL 源探测） | ddic | **P1** |
| DDLS CDS 视图（view/view entity/custom/projection/extend，sourceType 参数化） | ✅ | ✅ | ✅ | ✅ | source | ddic | **P1** |
| DCLS 访问控制 | ✅ | ✅ | ✅ | ✅ | source | ddic | **P1***（见 §5.1 说明） |
| DDLX 元数据扩展 | ✅ | ✅ | ✅ | ✅ | source | ddic | **P1*** |
| PROG 程序 / INCL | ✅ | ✅(+context) | ✅(+block) | ✅ | source | none | **P2** |
| CLAS 类 / INTF 接口 | ✅ | ✅(+context/method) | ✅(+method/block) | ✅ | source | none | **P2** |
| FUNC 函数组 | ✅ | ✅ | ✅ | ✅ | source（容器） | none | **P2** |
| BDEF 行为定义 | ✅ | ✅ | ✅ | ✅ | source | ddic | **P3** |
| SRVD 服务定义 | ✅ | ✅ | ✅ | ✅ | source | ddic | **P3** |
| SRVB 服务绑定 | ✅(+bindingType) | ✅ | 🟡(结构化) | ✅ | binding | **publish** | **P3** |
| MSAG 消息类 | ✅ | ✅ | ✅ | ✅ | structured | ddic | **P4** |
| ENQU 锁对象 | ✅ | ✅ | ✅ | ✅ | source（enqudl） | ddic | **P4**（待抓包） |
| VIEW 经典视图 | ❌(SE11) | ✅(元数据) | ❌ | 🟡(待验证) | none(只读) | — | **P4** |
| SHLP 搜索帮助 | ❌(SE11) | 🟡(待验证) | ❌ | 🟡(待验证) | none(只读) | — | **P4** |
| TYPE 类型组 | 🟡(待验证) | ✅ | ❓ | 🟡 | 待定 | — | **P4** |
| DEVC 包 | ✅ | ✅(包内容) | ❌(如实) | ✅ | — | — | **P4**（平移现状） |
| INDX 表索引（TABL 子对象） | ✅ | ✅ | ✅ | ✅ | source（blues） | ddic | **P4**（长尾可选） |
| S/4 2023 长尾（DRAS/DRTY/DRUL/DSFD/DSFI/DTDC/DTEB） | 长尾 | 长尾 | 长尾 | 长尾 | source | ddic | **P4**（按需） |

---

## 5. 分阶段任务分解

### 5.1 阶段一：基础 DDIC 类型 + 工具框架（最大批次，一次立起骨架）

**A. 矩阵与注册表**
1. `src/crudmatrix.ts` → `src/fsmatrix.ts`：动词 `write|read|edit|delete`；`CrudCell` → `FsCell`
   `{tool, mode, override: boolean, activates}`；行顺序按 §4；DEVC 平移。
2. 新 `src/typeregistry.ts`（§3），`resolve.ts`/`endpoints.ts`/`structure.ts` 的常量改为从注册表派生
   （对外导出保持兼容一个版本）。
3. DDLS sourceType 参数化：`adt_object_write {type:'DDLS', args.sourceType?: 'viewEntity'|'view'|'customEntity'|'extendView'…}`
   → create properties `ddlSourceTypes`（骨架模板取 `ddl/createstatements` 服务或内置模板）。

**B. 四工具**（新 `tools/fsops.ts`）
1. `adt_object_write`：分派表 create/override/内容形态/激活；TABL/STRU fields 一步流复用 `createTable`
   （STRU 增加无 MANDT/交付类变体）；结构化 override 的"全字段覆盖 RMW"（新协议方法
   `writeStructureFull` 或 `writeStructure` 加 `fullReplace` 语义，逐字段实现）。
2. `adt_object_read`：无 name → 矩阵卡；DEVC 特例路由。
3. `adt_object_edit`：源码型透传 `adt_edit_object`（含 block 模式）；结构化型透传 `adt_write_structure`。
4. `adt_object_delete`：透传 + 矩阵 delete 可否校验。
5. 全部：verb×type 未支持 → `fsUnsupportedMessage`（列出该类型支持动词 + SE11 指引）。

**C. DOMA_VALUE 行**
- `type:'DOMA_VALUE'`（别名 `DOMA.FIXVALUES`）路由到 DOMA 面的 fixedValues 子集：
  write=整块替换、read=随 DOMA、edit=补丁、delete=清空。

**D. 协议层**
- 结构化 override/DDL 源探测；`validation` 端点接线（write 前名称/包预检，失败原样透传）。
- DCLS/DDLX 创建端点（`acm/dcl/sources`、`ddic/ddlx/sources`）+ createByType 扩充。
- **能力画像模块（§3.5）**：parseDiscovery 增强（全量 accepts/categories/templateLinks）+
  typestructure 探测 + source 形态懒探测 + AdtRegistry 画像缓存；write/edit 路径按画像选形态与媒体类型版本。

**E. mock**：doma/dtel/ttyp 的 source/main 探测面（可开关模拟新旧系统）、dcls/ddlx/ddls sourceType、
  validation 端点、DOMA_VALUE 路由、override 冲突场景（写中哈希失配）；
  **版本档位模拟**——mock 增加 legacy/modern 两档（legacy：无 DDL 源、discovery 只声明 v1 媒体类型、
  typestructure 缺 BDEF/SRVD 能力），测试版本协商与回退分支。

**F. 测试与文档**：parity 六道锁重 pin；四工具逐类型 write/read/edit/delete 回路测试（mock）；
  agent-guide「四工具优先」章节；tool-reference 矩阵表换 fs_ops 版；README 徽章/计数。

> **P1 范围（已确认）**：DCLS/DDLX 并入 P1——与 DDLS 同机制（源码型、端点实证），边际成本≈0，
> 且"域→数据元素→表→CDS 视图→访问控制/注解扩展"是同一条建模链。P1 共 9 个类型行（含 DOMA_VALUE）。

### 5.2 阶段二：程序与类

1. `context`/`method`/`block` args 面（透传既有高级流——它们已在 owner 里，P2 主要是门面参数化 + schema 文档）。
2. INCL 解析（精确名搜索，现 resolve 已处理 PROG/P vs PROG/I）；FUNC 容器语义（FUGR/F vs FUGR/FF，
   矩阵两行或一行两态——倾向一行 FUNC=函数组 + `functionModule` 子参数，P2 时定）。
3. write 的 source 一步流对 PROG/CLAS 的 activate 语义：`activates:'none'` → 返回 syntax-check 建议而非激活。
4. 测试：方法级/块级编辑回路；mock 已有 OO 面，补门面用例。

### 5.3 阶段三：RAP

1. BDEF/SRVD：源码型，注册表加行即通（端点实证：`ddic/bdef/sources`、`ddic/srvd/sources` + sourceType="S"）。
2. SRVB 专用流（最重的特殊形态）：
   - write：bindingtype 值帮助（`businessservices/bindings/bindingtypes`：ODATA V2/ina1/sql1）→
     create（`srvb` XML，service definition 引用）→ activate=publish；
   - read：binding XML + 状态；edit：结构化补丁（bindng 服务定义/版本）。
   - 参考 @mcp-abap-adt/adt-clients 的 service_binding handler 组，但走自己的 read-modify-write 路线。
3. 测试：mock 增加 businessservices/bindings 面（bindingtypes 枚举 + publish 语义）。

### 5.4 阶段四：剩余对象

1. **MSAG/DEVC 平移**（现矩阵行直接换动词归属，工作量≈0，放在首批也可——按用户阶段表放 P4）。
2. **ENQU**：前置任务 = ADT Eclipse 抓包新建锁对象（create body + `define lock object` 语法 +
   lockmodes 辅助服务用法）；然后源码型加行（推断 wire：`vnd.sap.adt.lockobjects.v1+xml`）。
3. **VIEW/SHLP 只读行**：元数据 XML 读取 owner（GET 对象 URI，Accept 待真机确认）；delete 走通用
   deletion 服务做真机验证，失败则矩阵格如实 ❌；write/edit 格文案指向 SE11/SE16。
4. **TYPE 类型组**：`ddic/typegroups` 创建能力真机验证后定行。
5. **INDX 索引**（可选）：`ddic/db/indexes/{name}/source/main` blueSource 面，作为 TABL 子对象
   （`adt_object_write {type:'TABL_INDEX', name:'ZTAB~001'}` 或 `args.indexName`——P4 时定形态）。
6. 长尾行按 long-tail 规则（只加注册表行 + 端点，不加工具）。

---

## 6. 工具处置清单（46 工具全景 → 四工具超集收缩）

**架构变化**：owner 从"注册工具"降级为**内部实现模块**——四工具不再路由到注册表里的 owner 工具，
而是直接调用同一实现函数（策略/OCC/锁账本/写后回读链随函数走，"门面不二实现"保证不变）。
`routedTool` 回显字段改为 `via`（内部引擎名，如 `source` / `structured` / `fields` / `binding`）。

### 6.1 A 组：P1 直接移除（9 个）——四工具严格超集

| 移除工具 | 被谁吸收 | 吸收方式 |
|---|---|---|
| `adt_crud` | 四工具整体 | 已决；矩阵卡由 `adt_object_read`(无 name) 接管 |
| `adt_create_object` | `adt_object_write` | type+name+description/packageName/transport+内容；fields 一步流、占位创建语义原样 |
| `adt_read_object` | `adt_object_read` | version/context/method/行窗口参数全部进 args |
| `adt_read_structure` | `adt_object_read` | type=DOMA/DTEL/TTYP/MSAG 自动路由结构化面 |
| `adt_write_object` | `adt_object_edit` | `{source}` 全量替换 + OCC 链 |
| `adt_edit_object` | `adt_object_edit` | `{mode:'block'\|'method', oldText/newText, start/end}` 手术参数进 args |
| `adt_write_structure` | `adt_object_edit` | `{properties/fixedValues/labels/messages}` 补丁 |
| `adt_delete_object` | `adt_object_delete` | type+name+transport |
| `adt_package_content` | `adt_object_read` | `{type:'DEVC'}` |

### 6.2 B 组：可吸收（2 个）——随 P2 评估移除

| 工具 | 吸收方式 | 时机 |
|---|---|---|
| `adt_push_object` | `adt_object_edit {sourceFile}`（read→本地改快照文件→edit；OCC 基线同一 sidecar） | P2（PROG/CLAS 批，文件流主战场） |
| `adt_read_textelements` | `adt_object_read {type:'PROG', part:'textelements'}` | P2 顺带 |

### 6.3 C 组：保留（35 个）——非 CRUD 动词，各有独立职责

- **生命周期/质量**：`adt_activate`（**列表**激活：主程序+include 一次传齐——write 的 activate 是单对象标志，两者语义不同）、`adt_check`
- **搜索/导航**：`adt_search`、`adt_where_used`
- **分析**：`adt_cochange`、`adt_selfcheck`
- **版本**：`adt_object_versions`、`adt_version_diff`
- **传输**：`adt_list_transports`、`adt_get_transport`、`adt_release_gate`
- **锁管理**：`adt_lock_info`、`adt_unlock_all`（锁生命周期 ≠ 对象 CRUD）
- **数据**：`adt_data_preview`
- **执行/排障**：`adt_execute`、`adt_list_dumps`、`adt_get_dump`
- **调试器**：`adt_debug_session/breakpoint/step/inspect/set_variable`（5）
- **测试/ATC**：`adt_run_unit_tests`、`adt_run_atc`、`adt_list_atc_runs`、`adt_get_atc_result`（4）
- **批量/本地**：`adt_batch`（$batch 只读扇出）、`adt_export_objects`、`adt_local_check`
- **目的地/系统**：`adt_list_destinations`、`adt_create_destination`、`adt_list_gui_connections`、`adt_system_info`、`adt_ping`、`adt_permissions`（6）

计数：9 + 2 + 35 = 46 ✓。**工具数演进：46 →（P1：−9 +4）→ 41 →（P2：−2）→ 39**。

### 6.4 移除的死引用同步面（P1 批次必须全改）

| 位置 | 内容 |
|---|---|
| `dsh-plugin src/cli.ts` PERSONA_ROW | persona 大段引用 `adt_read_object/adt_edit_object/adt_write_object/adt_push_object/adt_create_object/adt_delete_object/adt_write_structure/adt_read_structure/adt_package_content/adt_crud` → **整段重写为四工具心智模型**（新建=write、改=先 read 再 edit、覆盖=write+override、文件流=read→本地改→edit{sourceFile}） |
| `dsh-plugin test/cli.test.ts` | 工具清单 pin 更新（41） |
| README（主仓 + dsh-plugin） | 工具计数徽章、能力清单段落、"从 0.1.0 升级"迁移注记（新旧动词对照表） |
| `docs/agent-guide.md` | 读写章节按四工具重写 |
| `docs/tool-reference.md` | 矩阵表换 fs_ops 版 + 移除工具条目删除 |
| selfcheck UNPROBED 清单、adt-core 目录 pin 测试 | 随目录同步 |

### 6.5 兼容与迁移（其余项）

| 项 | 处置 |
|---|---|
| owner 工具 | A 组全部从注册目录移除；实现函数保留为内部模块（四工具的引擎） |
| 旧动词/旧工具名调用 | 报错信息带新旧对照（`adt_create_object` → `adt_object_write`；`verb:create` → write、`update` → edit） |
| parity 锁 | 升级为六道（+mock 路由锁），对象从"注册工具"改为"内部注册表"，P1 重 pin |
| 预设/persona | 见 §6.4；既有用户需重建预设（`dsh plugin exec abap-adt-preset --force`，发版说明标注） |

## 7. 风险与开放问题（承接调研报告）

| # | 风险/开放点 | 缓解 | 影响阶段 |
|---|---|---|---|
| 1 | ENQU create body/DDL 语法无开源参照 | 真机抓包为 P4 前置任务；抓不到则行降级为 ❌+指引 | P4 |
| 2 | DOMA/DTEL/TTYP DDL 源 release 门槛未知 | **已缓解（§3.5）**：能力画像运行时探测 + 结构化回退，不做版本硬编码；selfcheck 报告能力 | P1 |
| 3 | SRVB publish≠activate 的状态机 | P3 单独批次；bindingtypes 服务枚举驱动 | P3 |
| 4 | VIEW/SHLP 元数据读取 Accept 头 | P4 真机验证；失败格如实 ❌ | P4 |
| 5 | override 盲写与服务端并发 | 写前哈希校验保留；失配报 `[CONFLICT]`（不静默覆盖） | P1 |
| 8 | discovery 声明与实际能力偏差（服务列了但加固后端 405/404，或反之——impc-dev nodestructure 405 先例） | 探针双轨：discovery 声明 + 实调探测（P-3 source 形态、写路径 406/404 降级重试一次）；画像标注 probed/assumed 区分置信度 | P1 |
| 6 | 动词迁移破坏存量 agent 习惯 | 迁移注记 + 错误信息里给新旧对照 | 全局 |
| 7 | 结构化 override 的"全字段覆盖"边界（哪些字段算用户可见） | P1 定字段清单（description/properties/fixedValues/labels/messages 全量；包引用/负责人等 SAP 管理字段不可覆盖） | P1 |

## 8. 验收标准

- **P1 出口**：四工具在 mock 上对 9 个 P1 类型（含 DOMA_VALUE）完成 write(新/override)/read/edit/delete
  全回路测试；矩阵卡（静态 + 带目的地的生效两种形态）、parity 六锁、agent-guide、README 全部就位；
  **能力画像**：mock 两档（legacy/modern）下的版本协商/回退分支测试全绿，selfcheck 报告含画像；
  真实系统冒烟（S4C/impc-dev）至少 DOMA/DTEL/TABL/DDLS 各一条 write→read→edit→activate→delete 链
  （顺带验证真实 discovery 解析出的画像）。
- **每阶段出口**：该阶段矩阵行全部有 mock 回路测试 + selfcheck 列入巡检 + tool-reference 行更新；
  ❌/🟡 格的报错文案有测试锁定（诚实矩阵不回退）。
- **全局**：工具目录 pin = **41**（P1 后）；P2 出口 = 39；无"矩阵有行、工具无路由、mock 无面"的悬空状态（六锁保证）；
  全仓（含预设 persona）无已移除工具名的死引用（grep 校验进 CI 测试）。

## 9. 建议的提交切分（P1 内部）

1. `fsmatrix.ts` + `typeregistry.ts`（含版本维度字段）+ parity 测试重 pin（无行为变化）
2. **能力画像**：parseDiscovery 增强 + typestructure/source/媒体类型探针 + AdtRegistry 缓存 + 矩阵卡双形态
3. 四工具骨架 + 内部路由（owner 实现函数化，暂双注册）+ 目录/计数
4. write 的 override 与内容分派（源码型/结构化型/fields，按画像选形态）+ 协议扩充（DCLS/DDLX 端点、validation 接线）
5. DOMA_VALUE + DDLS sourceType 参数化（画像驱动的 DDL 源路径）
6. mock 扩充（含 legacy/modern 两档）+ 全回路测试
7. **移除批次**：A 组 9 工具下架 + persona/agent-guide/tool-reference/README/死引用 grep 测试 + 目录 pin 41

P2–P4 各自独立可发版，互不阻塞；P3 的 BDEF/SRVD 可在 P2 完成前提前（与 P2 无耦合，若你急用 RAP）。
