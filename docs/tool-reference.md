# adt_* 工具清单 — 入参 / 返回参考

> 覆盖 `@nefevcore/abap-adt-dsh-plugin` 当前注册的全部 **32 个工具**（`adt_release_transport` 已按评审意见移除：释放传输是人工决策，协议客户端能力保留但不暴露给 Agent；`adt_batch_checks` 已由协议级 `adt_batch` + `adt_release_gate` 取代；0.9.0 精简批次：9 个 CRUD 工具并入 `adt_object_*` 四件套，`adt_push_object` 并入 edit 的 `sourceFile`，文本元素读取并入 read 的 `part`，list/get 三对与调试器五件套各并为单工具——见 `docs/tool-consolidation-plan.md`）。
> 标记约定：🛡 = 经过**目标目的地**的权限策略校验；⏱ = 自定义超时；🔒 = 声明 `isConcurrencySafe`（可并发/只读）。
> 通用参数 `destination`（string，可省略 = 默认目的地）适用于除 `adt_local_check` / `adt_permissions` / `adt_list_destinations` / `adt_list_gui_connections` / `adt_create_destination` 外的所有工具，下表不再重复。
> 通用对象引用三元组：`objectUri`（精确 URI，优先）/ `name` / `type`（短码或 ADT 形式，如 CLAS 或 CLAS/OC）。
> 钳制原则：所有带上限的参数（maxResults/top/maxObjects…）被钳制时都会在输出 `note` 中说明，绝不静默。

---

## 1. 系统与连接（7）

> 自检/巡检也在本组：`adt_selfcheck` 对目的地做只读能力扫描。

### adt_list_destinations 🔒
枚举配置的全部 ADT 目的地并逐个 ping（含**会话工作区文件** `<会话工作区>/<宿主配置目录>/destinations.yaml`——DSH 为 `.dsh-abap-adt`，目录随宿主声明——叠加后的完整视图）。
- **入参**：无。
- **返回**：`destinations[] { name, mock, ok, detail }`。

### adt_list_gui_connections 🔒
搜索**本机 SAP GUI（SAP Logon）连接列表**（`SAPUILandscape.xml` / `saplogon.ini`），用于把已有 GUI 连接导入为 ADT 目的地。用户口头要一个连接时先搜这里，把匹配项拿出来让用户挑；多词查询逐词 AND（"impc qas"）。`group` 类条目（消息服务器负载均衡）推不出单机 URL，需用户补 url。
**端口约定推导 + 实测验证**：GUI 条目只证明 DIAG 端口（`host:32nn`），`adtUrl`（端口约定 `https://host:443nn` / `http://host:80nn`）只是**未验证猜测**——实例号未必对应 ICM 端口、web dispatcher 可能走 443、saprouter 条目本机直连通常不通。因此默认对每个带 host 的匹配**探测**候选组合（`443<nn>` / `443` / `80<nn>` / `80`；无凭证 GET `/sap/bc/adt`，任何 HTTP 响应算可达，401 = ADT 存活的标准无凭证应答），返回 `probe.verifiedUrl`（真正应答的那个，可能与 adtUrl 不同——**导入以它为准**）或 `probe.detail`（全部不通时的逐候选原因与引导：VPN/防火墙/saprouter/需 web dispatcher url）。
- **入参**：`query`（可选，空 = 全列）；`limit`（默认 25，钳 1–100）；`probe`（默认 true）；`probeTimeoutMs`（单候选超时 ms，默认 2500，钳 250–10000）。
- **返回**：`available, sources[], connections[] { uuid, name, kind(direct|group|reference), systemId?, folder?, client?, user?, language?, host?, sysnr?, router?, adtUrl?(未验证猜测), httpUrl?, adtUrlNote?, probe? { reachable, verifiedUrl?, status?, detail, tried[] { url, ok, status?, detail } } }, truncated?`。无 GUI 时 `available: false` + 提示改走手工字段。

### adt_create_destination
在**会话工作区**写 `<宿主配置目录>/destinations.yaml`（DSH 为 `.dsh-abap-adt`；目录由宿主经 `HostProfile.workspaceConfigDir` 声明、注册表为存储权威）创建/更新目的地（原子写、写后即热生效——下一次 `adt_*` 调用即可用）。两种模式：`guiUuid` 导入 GUI 连接（client/language/username 自动带出，`strictSSL` 默认 false）；或手工传 `name` + `url`。
**URL 探测（导入模式）**：URL 按 GUI 推导时（未显式传 `url`）默认实测候选组合（`443<nn>` / `443` / `80<nn>` / `80`，无凭证 GET，401 = 存活），用**第一个真正应答的** URL 落盘（可能与端口约定不同并在 notes 说明）；**没有任何候选展示可用 ADT 端点时拒绝创建**（不写文件），报逐候选原因与引导（VPN/防火墙；**saprouter 条目**：HTTP 无法走 GUI 的 saprouter——要 web dispatcher url 作为显式 `url` 传入）；`force: true` 可强制保存（标记 `urlVerified.ok=false`）。显式传入的 `url` 不探测（用 `ping` 验证）。
**ping 先行（`ping: true`）**：保存前先带凭证 ping。**连接级失败**（无 HTTP 状态码：网络/VPN 不通）同样拒绝保存（`force` 可覆盖）；**HTTP 级失败**（如 401——URL 已证存活）照常保存并提示修凭证/服务。
**写出的文件自带说明**：每个未指定的可配置项都以注释行（含默认值与用途，`passwordEnv` 按目的地名生成约定引用）一并写入，取消注释即可手工改配置；托管写入保留已设值并重新生成注释模板，不会把 schema 默认值物化成真实行。
**按目的地权限**：六个策略键 `enableTransports` / `allowedTransports` / `allowTransportableEdits` / `allowedPackages` / `allowExecution` / `allowBatchWrites` 可直接传入，写入该条目的 `policy:` 块；只覆盖显式传入的键，未传的沿用全局配置 / `SAP_*` 环境变量 / 内置默认（见 policy 表）。
**密码**：直接传 `password` —— 默认存入**宿主凭证存储**（DSH 上即 `~/.dsh/.credentials.yaml`；引用名 = `passwordEnv` 或约定 `ADT_<NAME>_PASSWORD`，destinations.yaml 只留引用不落明文）；无凭证存储、或显式 `passwordInFile: true`、或凭证服务拒绝写入（同名环境变量遮蔽）时回退**明文写入文件**并附警告。不传 `password` 时可自行维护该引用（宿主分层解析——DSH：进程环境变量 > 凭证文件 > `.env`；无凭证存储的宿主仅环境变量；每次调用实时读取）。凭证相关文案（工具描述 / notes / hint / destinations.yaml 自文档注释）随宿主自适应：内核经 `ctx.get('host')` 声明缝识别环境（DSH 插件声明 dsh 档案，AgentChat 声明其加密存储，未声明宿主按能力推断并使用宿主中立措辞）。
- **入参**：`name?, url?, client?, language?, username?, password?, passwordEnv?, passwordInFile?, strictSSL?, timeoutMs?, enableTransports?, allowedTransports?, allowTransportableEdits?, allowedPackages?, allowExecution?, allowBatchWrites?, guiUuid?, probe?, probeTimeoutMs?, setDefault?, overwrite?, ping?, force?`。
- **返回**：`file, action(created|updated), destination{ ..., policy? }, setAsDefault, urlVerified? { ok, url?, status?, detail }, passwordStoredIn?(credential-store|file), importedFromGui?, shadowsGlobal, notes[], ping? { ok, detail }, hint`。
- 同名已存在时需 `overwrite: true`；同名全局配置会被工作区条目就近覆盖（`shadowsGlobal` 提示）。

### adt_system_info 🔒
读取目的地系统信息：SID、release、ABAP Cloud 标志、feature flags、广告服务数。
- **入参**：destination。
- **返回**：`destination, systemId, release, abapCloud, serviceCount, features{}, userName?, client?, language?`。

### adt_ping 🔒
探测单个目的地的可达性与认证（走 discovery 服务）。
- **入参**：destination。
- **返回**：`destination, ok, detail`。

### adt_permissions 🔒
策略自省：**全局默认 + 每个目的地的生效策略**（目的地 `policy:` 块逐键覆盖全局）及每项来源。
- **入参**：无。
- **返回**：`enableTransports, allowedTransports[], allowTransportableEdits, allowedPackages[], allowExecution, allowBatchWrites, allowDebugger, allowDebugVariables, profile(dev|qa|prd), blockedTablesProfile, blockedTables[], allowedTables[], sources{}, defaults{}, perDestination{ <name>: {同前 + sources} }`。
- **profile 语义**：目的地级 `profile: dev|qa|prd`（默认 dev）——qa 把 allowExecution/allowBatchWrites（qa 连 allowDebugger）**未显式配置时默认收 false**；prd 对执行/批量写/调试器**硬拒**（显式开也拒，报错含 `profile: prd`）。
- **读侧治理**：`blockedTablesProfile`（off/minimal/standard/strict，默认 off）+ `blockedTables[]`（自定义追加，`*` = `[A-Z0-9_]*`）+ `allowedTables[]`（豁免，审计留痕——工具输出 note + logger）。

### adt_selfcheck 🔒（能力巡检 sweep）
对一个目的地做**只读能力扫描**（绝不写、绝不执行代码）：对每个只读能力用一个探针对象实跑并给出判定——`answered / empty（真空，非故障）/ absent（后端无此服务，404/405）/ refused（策略拒绝）/ dead（返回空而独立 oracle 证明有内容——本工具存在的理由）/ broken（我们的错误）/ skipped（无探针输入）`。探针对象默认取搜索 `Z*` 的第一个类，也可显式传 `name`(+`type`)。
- **入参**：`name`/`type`（探针对象，可省略）；`packageName`（限定探针搜索）；destination。
- **返回**：`destination, probeObject, checks[] { capability, tool, verdict, detail }, summary{answered,empty,dead,absent,refused,broken,skipped}, unprobedTools[]（刻意不巡检的全部工具名——覆盖声明是清单不是空白）, note`。
- **oracle 交叉验证**：search↔read↔$batch↔package-content↔ping/system_info 两两独立印证——"搜索说对象存在而 read 说没有"即 `dead`。
- **用途**：新系统接入验证、插件升级后回归、"为什么某能力什么都不返回"的第一诊断。设计借鉴 vsp 的 sweep.go（"十个能力广告了、注册了、可达、但从未答对过——全是手工发现的"）。

## 2. 搜索与浏览（2）

### adt_search 🔒
对象名 + 源码全文双通道搜索，支持包过滤与分页。
- **入参**：`query`*（支持 `*` 通配）；`operation`（quickSearch* / objectSearch / quickSearchSource）；`packageName`（对象命中按包过滤；源码命中无包属性会被丢弃并 note 说明）；`maxResults`（默认 25，钳 1–100）；`offset`（跳过前 N 条，客户端分页）；`objectType`（如 CLAS/PROG/DDLS）。
- **返回**：`query, count, offset, note?, objects[] { objectName, description, type, uri, packageName?, … }, sources[] { objectName, type, uri, line, lineNumber? }`。
- 钳制/截断均写入 `note`（含「raise offset to N」提示下一页）。

> 包成员清单（A 组并入）= `adt_object_read {type:"DEVC", name}`——列出包的直接成员（`$TMP` 为本地对象），返回刻意精简为 `{name, type}`。

### adt_where_used 🔒
影响分析：谁引用/依赖该对象。后端无 usageReferences（404/405）时降级为 note + 替代建议。
- **入参**：对象三元组；`enableAllTypes`（bool，默认 false；true 明显变慢）。
- **返回**：`objectUri, totalReferences, note?, references[] { name, type, uri, packageName?, responsible?, usageInformation? }`。

## 3. 对象 CRUD — fs_ops 四工具（4）

> A 组处置（0.9.0）：原 9 个 CRUD 工具（read/write/edit_object、create/delete_object、read/write_structure、package_content、crud 门面）已并为下面四个工具的内部引擎——签名统一 `(type, name)`，**端点由工具层解析，永不传 URI**。

### adt_object_read 🔒
读对象：源码型 → 源码 + 本地 OCC 快照（sidecar 记录服务端内容哈希，冲突安全编辑的基础）；结构化型（DOMA/DTEL/TTYP/MSAG）→ typed JSON；DEVC → 包成员清单。**省略 name → 能力矩阵卡**（各类型 write/read/edit/delete 支持面）。**`part:"textelements"`（PROG/REPT，C 组并入）**：读程序的文本元素——TEXTPOOL 形状（I 文本符号/键 001…、S 选择文本、H 列表标题），行结构 ID/KEY/ENTRY/LENGTH；主程序名（include 的文本元素挂主程序）；全空时 note 提示程序未定义或后端不暴露；写侧暂缓（PUT 格式未真机验证，用 SE32/SE38）。
- **入参**：`type`*（短码，矩阵行）；`name`；`part`（'source' 默认 | 'textelements'）；`startLine`/`endLine`（行窗口）；`snapshot`（默认 true）；`method`（方法级读取：只返回该 METHOD…ENDMETHOD. 块，行号仍按全源编址）；`context`（默认 false；true 附加依赖契约序言——超类/接口优先，预算内并发拉公共契约）；`raw`（结构化型附原始 wire XML）。
- **返回**：源码型 `uri, name, type, source, totalLines, localCopy?, snapshotHash?, contextPrologue?`；结构化型 `kind, name, properties{}/messages[]/fixedValues[]/labels{}`；包 `objects[]`；文本元素 `program, elements[] {id, key, entry, length?}, counts {symbols, selections, headings}, note?`。全量读取（≤2000 行）重放为行号化 read 卡片。

### adt_object_write 🛡
create-or-override：`type + name + description/packageName + 内容`一步建好。无内容 = 占位创建。DDIC/CDS 类型默认写后即激活。
- **入参**：`type`*；`name`*；`description`*（新建）；`packageName`*（新建，`$TMP` 本地）；`transport`；`override`（false 默认：已存在 → 报错提示 override；true：锁内覆盖）；`activate`；内容按类型三选一——源码型 `source`（完整源码/DDL）；TABL/STRU `fields[]`（一步 DDL 流：`{name*, type*, length?, decimals?, isKey?, notNull?, description?}`，自动 MANDT 键与注解，建+写+激活一条龙）；结构化型 `properties/fixedValues/labels`。
- **返回**：`verb:'write', type, created|overridden, activated?, …引擎原样输出`。

### adt_object_edit 🛡
改**已存在**对象（read-then-patch）。源码型要求先 read 建 OCC 基线（服务端哈希不符 = `[CONFLICT]` 拒绝）；结构化型锁内 RMW 补丁（只改显式提供的字段，SAP 管理属性全量保留）。
- **入参**：`type`*；`name`*；源码型 `source`/`sourceFile`（全量新源码）或手术参数（`mode:'block'|'method'`——oldText/newText 精确替换、start/end 整块、method 方法级，P2 参数面）；结构化型 `properties{}`/`fixedValues[]`（DOMA 全量替换，`[]` 清空）/`labels{}`/`messages[]`（MSAG 全量替换）/`description`；`activate`（DDIC 默认 true）；`transport`。
- **返回**：`verb:'edit', type, …引擎原样输出`（源码型含 `persisted` 持久性验证——false = 同账号旧会话回写覆盖，重读重做勿激活）。

### adt_object_delete 🛡
删除对象（不可逆；现代 deletion 服务 + legacy 回退）。delete 与 write/edit 格独立——GUI-only 类型仍可能可删，矩阵按行标注。
- **入参**：`type`*；`name`*；`transport`。
- **返回**：`verb:'delete', type, deleted, transport?`。
- **矩阵拒绝**：未支持格（如 VIEW 的 write/edit）按矩阵文案如实报错并指出该类型支持什么（SE11 指引），绝不静默降级。

## 4. 激活与语法（2）

### adt_check 🔒
语法检查（不激活）。多对象时逐对象跑 checkrun，**每条消息带 objectName 归属**。
- **入参**：`objects`*（数组，每项 `{objectUri}` 或 `{name, type}`——name 与 objectUri 二选一，schema 已放开）。
- **返回**：`success, messages[] { objectName, severity, text, line?, code? }, hints[]`。
- **范围警告**（描述/输出 hints 均携带）：**check 通过 ≠ 激活通过**——激活 preaudit 范围更宽（跨对象一致性、主程序+include 联合检查、双重声明等只在激活时发现）。把 PASS 当「无本地语法错误」，不要当「就绪」。

### adt_activate 🛡
激活对象；语法错误在 HTTP 200 body 的 chkl:messages 中返回。
- **入参**：`objects`*（同上，可带 `packageName` 提示）；`transport`；`checkOnly`（默认 false = 仅预审计不落库，免策略）。
- **返回**：`success, items[] { name, type, status, message?, errors[] { text, line?, code? } }, hints[]`。
- **⚠ include 级联**（Agent 实测反馈）：**PROG 主程序 / FUGR 激活成功 ≠ 程序完整激活**——多数后端不级联激活其 include（TOP/SCR 等），工具只报告请求对象本身的结果。做法：**把主对象和全部 include 一起放进 `objects` 一次提交**（本工具天然支持批量），存疑时用 `adt_version_diff`（saved vs active）复核残余非激活对象。成功激活 PROG/FUGR 时输出会带此提示。
- **激活失败时**：hints 提示 `adt_check` 通过不是激活会过的依据（preaudit 范围更宽），错误带行号/错误码，修复后将**全部相关对象**一起重新激活。

## 5. 测试与 ATC（3）

### adt_run_unit_tests ⏱330s
运行 ABAP Unit（提交→轮询→JUnit 解析在客户端内完成）。
- **入参**：`objects`*。
- **返回**：`success, overall, total, passed, failed, skipped, errors, durationMs, classes[] { className, status, tests[] { methodName, status, durationMs, message? } }`。

### adt_run_atc ⏱660s
对给定对象启动新 ATC run。run 会**落库**（在 adt_atc_runs 可见，工具触发的通常叫 "External Request + 时间戳"）；`durationMs` 为客户端实测整个 start→轮询→取结果的墙钟时间。
- **入参**：`objects`*；`variant`（string）。
- **返回**：`clean, findings[] { checkTitle, severity, message, objectName, uri?（该行所属对象的 URI——常为 include 而 objectName 是主程序）, line?, check? }, counts { INFO, WARNING, ERROR, CRITICAL, CATASTROPHIC }, durationMs, variant?, displayId?, title?, checkVariant?, aggregates?`。
- **位置映射**（impc-dev 实战）：后端把程序全部 finding 挂在**主程序名**下而 `line` 是 include 内行号——先看每条 finding 的 `uri` 再跳行；权威 P1–P4 汇总以 `adt_atc_runs` 为准。

### adt_atc_runs 🔒（D 组合并：list + detail 一体）
ATC run 自省，**单工具两形**：**无 `displayId`** = 列系统上已存的 run（display id、创建者、时间戳、状态、P1–P4 汇总）；**带 `displayId`** = 取该 run 的完整结果（findings 带严重度、检查项、源位置，可含豁免项）。
- **入参**：`displayId`（给出 = 详情形）；`includeExemptedFindings`（详情形，默认 false）；list 形过滤器：`createdBy`、`ageMin`/`ageMax`（天）、`central`、`active`、`sysId`。
- **返回**：list 形 `count, runs[] { displayId, title?, checkVariant?, createdAt?, createdBy?, status?, kind?, aggregates?, attributes{} }`；detail 形 `displayIdResult, title?, checkVariant?, clean, findings[]（含 uri?）, counts{}, aggregates?（结果体缺失时按 finding priority 推导）, durationMs, rawXml?`。
- **后端差异**：多数要求至少一个过滤条件（缺省发当前用户），**子集实现只接受无参数查询**（任何过滤参数 400）——被拒的过滤自动回退无参数重试。
- **P1–P4 汇总以 list 形为准**（impc-dev 实战：单结果体不带 aggregates，明细里 P1–P4 恒 0）。

## 6. 传输与版本（4）

> **已移除 `adt_release_transport`**：释放传输不可逆且需要人工判断（导入顺序/窗口/缓冲区状态），Agent 应把一切准备到「可释放的请求」，最后一步留给人。协议客户端 `releaseTransport()` 保留。

### adt_object_versions 🔒
对象版本历史（Atom feed），每版本带其落入的传输号/任务。
- **入参**：对象三元组。
- **返回**：`objectUri, versions[] { versionId, author?, updatedAt?, title?, transportRequest?, transportDescription? }`。

### adt_transports 🔒（D 组合并：list + detail 一体）
传输请求（CTO, Transport Organizer / SE10 / SE09）。**单工具两形**：**无 `number`** = 当前用户的请求列表（number、status、category、owner、可含 items）；**带 `number`** = 该请求详情（含条目清单）。
- **入参**：`number`（给出 = 详情形，如 S4HK900001）；list 形：`allUsers`（默认 false）、`status`（默认 all；`modifiable`=未释放（别名 D）/ `released`（别名 R/L）/ 其他值透传后端）。
- **返回**：list 形 `transports[] { number, description, status, category, owner, system, client, modifiable, target?, items?[] }`；detail 形 `number, requestedNumber?（请求的是任务号且被解析到父请求时）, note?（任务→父请求映射提示）, description, status, category, owner, system, client, modifiable, items[] { name, type, action, description? }`。
- **状态过滤**（impc-dev 实战）：语义词**先翻译成后端字母码**（`modifiable`→`D`、`released`→`R`）再发（原样透传会匹配 0 行）；后端 400 拒绝 `status` 参数时自动去参重试 + 客户端侧过滤兜底。结论前仍建议与 detail 形 / `adt_object_versions` 交叉验证。
- **任务号语义**（impc-dev 实战）：版本历史（adt_object_versions）记录的是**任务级**号码；传任务号查询时真实 CTO 后端返回**父请求**——比对返回的 `number` 与所传号码，后续操作用父号。
- **策略**：仅受 enableTransports（传输族开关）约束——两分支都只读，请求号本身不受 allowedTransports 管控。

### adt_version_diff 🔒
两版本对比。**默认 = saved vs active**——saved 是当前源码（存在 inactive 版时即 inactive），active 是最后一次激活的版本（`?version=active`）：**恰好是「已保存但尚未激活」的改动**，写后/激活后复核残余非激活对象（含 PROG 的 include）就用它。**只返回 unified diff + 标签 + 版本列表，不携带两侧全文**（上下文经济）。
- **入参**：对象三元组；`versionFrom`（版本号 id、`saved` 或 `active`，默认 `saved`）；`versionTo`（同上，默认 `active`）——历史版本 id 来自 `adt_object_versions` 或本工具 `versions` 输出。
- **返回**：`objectUri, identical, pendingChanges?（仅默认比对时：true = 有未激活改动）, fromLabel, toLabel, diff, versions[]`。
- **修正记录**：旧版默认取版本 feed 的第一条当作「最新版」并误把普通读取当 active——真实后端 feed 顺序不保证、有 inactive 版时普通读取返回 saved,导致比对双方都不对（如取到最老的 00000 且恒报 identical）。现两侧语义显式化。

## 7. 锁（2）

### adt_lock_info 🔒
查对象锁状态（只读，绝不加锁）。
- **入参**：对象三元组。
- **返回**：`objectUri, locked?, lockedBy?, transport?, note?`（后端不暴露时 locked=null + note）。

### adt_unlock_all
清理残留编辑锁：重放插件持久锁账本（跨会话）+ 显式 `objects`；支持 **dryRun**。
- **入参**：`objects`（数组，可省 = 账本全量）；`dryRun`（默认 false；true 时只列候选锁、不做任何 ERP 解锁调用——候选清单纯本地可得，无需后端支持）。
- **返回**：`destination, dryRun?, attempted, released[] { objectUri, note? }, failed[] { objectUri, reason }, remainingLedger`（dryRun 时 candidates 全部列在 failed 里并标注 "dry run"）。

## 8. 批量与门禁（4）

### adt_batch ⏱180s
协议级 `$batch`：多个 ADT 请求打包进**一次 HTTP 往返**（`POST /sap/bc/adt/$batch`，multipart 内嵌 HTTP）。代理尺度的只读扇出（一次拉 20 个对象源码 / 元数据+版本+锁状态）。
- **入参**：`requests`*（数组，≤50；每项 `{method: GET|POST|PUT, path*, body?, contentType?, accept?}`，path 必须以 `/sap/bc/adt/` 开头）；`allowWrites`（默认 false）。
- **返回**：`requested, ok, failed, note?, parts[] { index, status, statusText, contentType?, chars, truncated?, body }`（body >4000 字符截断并写 note）。
- **策略**：GET 部分始终可用；POST/PUT 需 `allowWrites: true` **且**目的地策略 `allowBatchWrites`（默认关——通用内嵌写无法逐对象校验）；传输释放 / 删除服务路径**永远禁止**（指向专用工具）。
- **语义**：替代已移除的 `adt_batch_checks`——整包质量报告用 `adt_release_gate`（ packageName 全量），任意组合用本工具。

### adt_export_objects ⏱600s
对象源码导出为本地 `.abap` 文件（abaplint 兼容命名）。**只接受显式对象清单**（不再支持整包导出）——先用 `adt_object_read {type:"DEVC"}` / `adt_search` 建清单，导什么一目了然。
- **入参**：`objects`*（数组，每项 `{name*, type?}`）；`targetDir`*（绝对路径）；`maxObjects`（默认 100，钳 1–500）。
- **返回**：`targetDir, exported, failed, truncated?, note?, files[] { name, path, chars? }`。

### adt_local_check ⏱300s
离线 abaplint 静态检查（无 destination，纯本地）。
- **入参**：`dir`*（绝对路径，递归）；`configPath`（默认 `<dir>/.abaplint.json`，再缺省内置默认）；`severity`（Error/Warning/Info，默认 Warning）；`maxFiles`（默认 500）；`maxIssues`（默认 300）。
- **返回**：`dir, filesScanned, filesSkipped, truncated?, issuesTotal, reported, clean, counts{}, config { source, ruleCount }, issues[]`。

### adt_release_gate ⏱1200s
发布前质量门禁：syntax + unit + ATC 三段一次跑完，给出 go / no-go。
- **入参**：`packageName` 或 `objects[] { name*, type? }`；`stages`（默认全部）；`variant`；`maxObjects`（默认 100，钳 1–500）。
- **返回**：`objectCount, truncated?, note?, verdict ('go'|'no-go'), stages[] { stage, pass, summary }`（截断时 note 明示「verdict 只覆盖前 N 个对象」）。

## 8a. 执行与错误分析（3）

### adt_execute ⏱330s
在目标系统上运行 ABAP 并取回控制台输出——写→激活→执行→观察 的行为验证闭环。
- **入参**：`kind`*（`PROG`=可执行程序，F8 等价物；`CLAS`=实现 `if_oo_adt_classrun` 的类，跑 `main( )`）；`name`*。
- **返回**：`kind, name, status, output, outputLines`。
- **策略**：`allowExecution`（默认开；只读目的地的总闸——任意 ABAP 都可能改库）。

### adt_dumps 🔒（D 组合并：list + detail 一体）
ABAP 短转储（ST22）读取，**单工具两形**：**无 `dumpId`** = 转储列表（feed）；**带 `dumpId`** = 单个转储详情（结构化分节/HTML 概览/纯文本分析视图）。
- **入参**：`dumpId`（给出 = 详情形，来自 list 形的 id）；`view`（default=结构化分节 / summary=HTML / formatted=纯文本分析视图）；list 形：`user`（按会话用户过滤）、`from`/`to`（YYYYMMDD 或 YYYYMMDDHHMMSS，服务端过滤）、`top`（默认 20，钳 1–100）、`skip`。
- **返回**：list 形 `count, note?, dumps[] { id, title, category?, user?, updatedAt? }`；detail 形 `id, view, title?, sections[] { name, value }, raw?`。
- **满页判定（多取一行）**：list 形实际请求 `top+1` 行——多出一行即说明"还有更多"，note 写 `showing N, and there may be more; raise top, or page with skip=… / narrow by user / from / to`；恰好 N 行与"N 行还有更多"区分开，不编造总数。

## 8c. 文本元素（并入 read 的 part）

> **C 组处置（0.9.0）**：文本元素读取已并入 `adt_object_read {part:"textelements"}`——见 §3 的 adt_object_read 条目。

## 8d. 协变分析（1）

### adt_cochange 🔒
传输共变分析（"什么通常一起变更"——vsp graph 的低成本切片）：读每个输入对象的版本历史取其传输号，展开这些请求的条目清单，按**共享传输数**排序共现对象。改前评估回归范围/评审清单。
- **入参**：`objects`*（1..10 项，`{name*, type?}`）；`top`（默认 20，钳 1–50）；`maxTransports`（展开的传输数上限，默认 30，钳 1–50——超出截断并在 note 说明）。
- **返回**：`inputs[], coChanges[] { name, type?, sharedTransports, transports[], description? }, analyzedTransports[], totalCandidates, note?`。
- **数据面**：版本 feed + 传输条目（同 adt_object_versions / adt_transports 的单请求形态），无 E070/E071 SQL；局限——保存历史未记录传输的对象不可见（新对象、他系统纯传输）。
- **策略**：enableTransports 门（版本 feed 泄漏传输号，同 adt_object_versions）。

## 9. 数据预览（1）

### adt_data_preview 🔒
读表 / CDS 视图行数据，或跑 freestyle SELECT（SE16/SE16N 式数据浏览器）。`kind` 枚举**与其他工具的类型码完全一致**（TABL/VIEW/STRU/DDLS，对齐 ADT URI 命名空间 /ddic/tables、/ddic/views、/ddic/structures、/ddls），模型无需切换命名体系。
- **入参**：`name`（大写实体名）+ `kind`（enum TABL/VIEW/STRU/DDLS，默认 TABL），或 `sql`（二选一）；`length`（行数窗口，默认 100，钳 1–5000；旧别名 `top`）；`offset`（跳过前 N 行——行范围 = offset..offset+length，客户端分页，SQL 路径同样生效）；`associations: true`（列出 CDS 视图的 association：名称/目标/基数）；`association: '_Name'`（跟随一条 association，返回关联目标行——CDS 场景的后端侧 JOIN）。
- **返回**：`source, name, offset, totalRows, note?, queryExecutionTime?, columns[] { name, type, description?, length? }, rows[], rawXml?`；SQL 编译路径 `source` 为 `sql (compiled)`，note 携带执行的每条生成语句与保真度说明。
- **方言自适应（sql-lint）**：DESC/ASC→DESCENDING/ASCENDING、尾部 LIMIT/OFFSET→length/offset 参数、`alias.col`→`alias~col`、`<>`→`!=`、聚合括号 padding、超 255 字符行软换行——每次改写记入 note。硬拒（解析器级）：OR+LIKE、多 LIKE、UNION/INTERSECT/EXCEPT、双引号标识符、多语句。
- **客户端编译（sql-compiler）**：JOIN（INNER/LEFT）/聚合/GROUP BY/HAVING/IN(SELECT) 自动降级为「每表单查 + 谓词下推 + 本地哈希连接/聚合」——小集合精确，超出行上限近似（note 标明被截断的表）。
- ABAP Cloud 阻止直连 DB 表（CDS/SQL 可用）；无 datapreview 服务的 profile 给明确错误。
- **读侧治理（blockedTables）**：目的地启用 `blockedTablesProfile` 后，两条路径都在**发请求前**解析目标表（SQL 走 FROM/JOIN 提取器，编译路径在生成每条子查询前对原始 SQL 全量检查）并过敏感表目录——命中即 `[POLICY] blockedTables: <表> — <类别>: <理由>` 拒绝（**零请求**，deny 无豁免通道）；`allowedTables` 豁免的读取照常并带审计 note。目录分层：minimal（银行/客户供应商 PII/地址/认证/HR/税务）⊂ standard（+交易单据等受保护业务数据）⊂ strict（+审计日志/通信工作流/`Z*` 命名空间）。

---

## 10. 调试器（1）— 标准 ADT REST，零服务端安装

> 经 `/sap/bc/adt/debugger/*`（新式 ABAP 调试器），**策略总闸 `allowDebugger`（默认 false）**——调试持有有状态会话并可能停掉生产进程；prd profile 目的地硬拒。会话身份（terminalId/ideId）是**插件级**状态（src/debugger.ts）：一个 ADT 会话只能持一个调试会话，detach 后不能重 attach（重 listen 用全新身份）；插件卸载时自动 detach 全部监听器。断点为外部作用域（对目标用户生效）；标准代码断点常不触发（SAP 默认只停客户代码）。

### adt_debug 🛡⏱300s（E 组合并：五件套 → 单工具九动作）
ABAP 代码在线调试闭环，**一个工具九个 action**。先 `setBreakpoint`，触发代码路径后 `listen`（长轮询等命中）；停止期间：`variables` 读变量值、`stack` 读调用栈（BASIS < ~7.51 无 `/debugger/stack` 端点——探测一次后本地回答 `unavailable` + 说明）、`step` 单步推进；`status` 查会话与后端监听器状态；`deleteBreakpoint` 按 id 删断点；**务必以 `detach` 收尾**——一个目的地一个调试会话，detach 后不可重 attach（重新 listen 用全新身份）。
- **入参**：`action`*（listen/status/detach/setBreakpoint/deleteBreakpoint/step/variables/stack/setVariable）；`username`（调试目标用户，默认目的地用户——外部断点对该用户生效）；`timeoutSeconds`（listen 等待窗 1–240s，默认 30，空响应 = 窗内无命中、监听器保持注册）。
- **action 专属参数**：setBreakpoint：`objectUri` 或 `name`+`type`（自动补 `/source/main`）+ `line`*（1 起行号）；deleteBreakpoint：`id`*（setBreakpoint 返回的断点号）；step：`step`*（stepInto= F5 / stepOver= F6 / stepReturn= F7 / stepContinue= F8 跑到下个断点 / terminateDebuggee 终止调试进程）；variables：`variables`*（非空大写名数组）；setVariable：`name`*（大写变量名）+ `value`*（ABAP 字面量文本）。
- **返回**：`action, destination` + 按动作：`hit?, timedOut?, conflict?, debuggee? { id, program, include, line, user, kind, … }, session?, backendListeners?, detached?, breakpoints?[] { id, uri, line, kind }, deleted?, result { step, debugSessionId?, program?, include?, line?, isSteppingPossible?, isTerminationPossible?, isDebuggeeChanged?, reachedBreakpoints[] }, variables?[] { name, value?, declaredTypeName?, readOnly? }, stack? { entries[] { stackPosition, programName, includeName, line, … }, cursorIndex?, unavailable?, note? }, note`。
- **`setVariable`（高危）双重 opt-in**：`allowDebugger` **且** `allowDebugVariables`（均默认 false）；只读变量被后端拒绝。

---

## 11. fs_ops 能力矩阵（`adt_object_read` 无 name 时同款输出）

**单一事实源**：矩阵由 `src/typeregistry.ts`（类型注册表）派生到 `src/fsmatrix.ts`，`fsmatrix.test.ts` 锁定注册表 ↔ 矩阵 ↔ 协议目录 ↔ 文档一致。动词：write（create-or-override，空内容=占位）/ read / edit（read-then-patch）/ delete。✅ = 引擎已接线；P# = 计划中阶段；✗ = 拒绝（GUI-only，SE11 指引）；? = 待真机验证。**诚实矩阵**：不支持格报错并指出该类型支持什么，绝不静默降级。

| type | write | read | edit | delete | editMode | activates | phase |
|---|---|---|---|---|---|---|---|
| DOMA | ✅ structured | ✅ structured | ✅ structured | ✅ delete | structured | ddic | P1 |
| DOMA_VALUE | P1 | P1 | P1 | P1 | structured | ddic | P1 |
| DTEL | ✅ structured | ✅ structured | ✅ structured | ✅ delete | structured | ddic | P1 |
| STRU | ✅ source | ✅ source | ✅ source | ✅ delete | source | ddic | P1 |
| TABL | ✅ source | ✅ source | ✅ source | ✅ delete | source | ddic | P1 |
| TTYP | ✅ structured | ✅ structured | ✅ structured | ✅ delete | structured | ddic | P1 |
| DDLS | ✅ source | ✅ source | ✅ source | ✅ delete | source | ddic | P1 |
| DCLS | ✅ source | ✅ source | ✅ source | ✅ delete | source | ddic | P1 |
| DDLX | ✅ source | ✅ source | ✅ source | ✅ delete | source | ddic | P1 |
| PROG | ✅ source | ✅ source | ✅ source | ✅ delete | source | none | P2 |
| INCL | P2 | ✅ source | ✅ source | ✅ delete | source | none | P2 |
| CLAS | ✅ source | ✅ source | ✅ source | ✅ delete | source | none | P2 |
| INTF | ✅ source | ✅ source | ✅ source | ✅ delete | source | none | P2 |
| FUNC | ✅ source | ✅ source | ✅ source | ✅ delete | source | none | P2 |
| BDEF | ✅ source | ✅ source | ✅ source | ✅ delete | source | ddic | P3 |
| SRVD | ✅ source | ✅ source | ✅ source | ✅ delete | source | ddic | P3 |
| SRVB | P3 | P3 | P3 | P3 | binding | publish | P3 |
| MSAG | ✅ structured | ✅ structured | ✅ structured | ✅ delete | structured | ddic | P4 |
| DEVC | ✅ none | ✅ packageContent | ✗ | ✅ delete | none | none | P4 |
| ENQU | ? | P4 | ? | P4 | source | ddic | P4 |
| VIEW | ✗ (SE11) | P4 | ✗ (SE11) | ? | none | none | P4 |
| SHLP | ✗ (SE11) | ? | ✗ (SE11) | ? | none | none | P4 |
| TYPE | ? | P4 | ? | P4 | source | none | P4 |
| INDX | P4 | P4 | P4 | P4 | source | ddic | P4 |
| DRAS..DTEB（S/4 2023 长尾） | P4 | P4 | P4 | P4 | source | ddic | P4 |

**真实验证状态**（docs/ddic-fsops-matrix-plan.md 头部验证表）：deloitte-kic 与 impc-dev 上 13 类型全链实证通过；impc-test 为不可更改客户端（write 按画像降级）。P# 未落地格调用即按矩阵文案拒绝。
## 附：权限策略的 per-destination 语义

十一个开关（enableTransports / allowedTransports / allowTransportableEdits / allowedPackages / allowExecution / allowBatchWrites / **blockedTablesProfile / blockedTables / allowedTables** / **allowDebugger / allowDebugVariables**）+ 目的地级 **profile（dev|qa|prd）**：
- **顶层**（settings `abap-adt:` 段或插件行 config）= 全局默认；
- 每个 destination 的 `policy:` 块**逐键覆盖**全局（如 prd 禁传输 + 只许 $TMP + 禁执行 + strict 读侧，dev 放开）；
- 目的地级 `profile`（policy 块外、与 url 平级）：dev = 原语义；qa = allowExecution/allowBatchWrites/allowDebugger 未显式配置时默认 false（显式开仍可用）；prd = 三者**硬拒**（显式开也拒）；
- `SAP_*` 环境变量只参与全局层的兜底解析（新增 SAP_BLOCKED_TABLES_PROFILE / SAP_BLOCKED_TABLES / SAP_ALLOWED_TABLES / SAP_ALLOW_DEBUGGER / SAP_ALLOW_DEBUG_VARIABLES）；
- 每个编辑类/执行类工具按**调用目标目的地**的策略断言（写 dev 用 dev 的策略，写 prd 用 prd 的策略）；
- `adt_permissions` 输出全局默认 + perDestination 全量快照。

向后兼容：原有顶层四键写法完全不变即生效（作为全局默认）。

## 附：本轮评审落地对照

| # | 意见 | 落地 |
|---|---|---|
| 1 | package_content 返回太多 | 精简为 `{name, type}` + count |
| 2 | search 增加维度 | `packageName` 过滤（后端透传 + 客户端兜底） |
| 3 | CRUD 支持 Domain/Element 等 | TYPE_MAP + create 端点 + mock 支持 DOMA/DTEL/TTYP |
| 4 | read 分窗读取 | `startLine`/`endLine` + `totalLines` |
| 5 | release_transport 风险大 | 工具移除（客户端能力保留） |
| 6 | export 强制对象清单 | `objects`* 必填，packageName 已删 |
| 7 | withCoverage 死参数 | 已删 |
| 8 | objects 数组 name 必填矛盾 | name 改可选（objectUri 或 name 二选一） |
| 9 | write 补 activate | `activate` 参数 + activation 输出 |
| 10 | version_diff 只回 diff | fromLabel/toLabel + diff（去双全文） |
| 11 | 钳制不静默 + 分页 | search/preview 增加 offset；全工具钳制写 note；read 行窗口 |
| 12 | check 消息无归属 | 逐对象 checkrun，messages 带 objectName |
| 13 | preview kind 命名 | 对齐类型码 TABL/VIEW/STRU/DDLS（同 ADT URI 语义） |
| 14 | get_transport 误管控 | 只读不再受 allowedTransports 约束 |
| 15 | unlock_all dryRun | 已加（候选清单纯本地，无需 ERP 支持） |
| 16 | edit 匹配复用 dsh edit | 工具不能互调；改为采纳其语义：去注释匹配 + 歧义报错 + 命中行号回显 |
| 17 | 策略应为 per-destination | 全局默认 + destination `policy:` 块逐键覆盖，工具按目标目的地断言 |
