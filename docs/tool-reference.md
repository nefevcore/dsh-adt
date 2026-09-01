# adt_* 工具清单 — 入参 / 返回参考

> 覆盖 `@nefevcore/abap-adt-dsh-plugin` 当前注册的全部 **38 个工具**（`adt_release_transport` 已按评审意见移除：释放传输是人工决策，协议客户端能力保留但不暴露给 Agent；`adt_batch_checks` 已由协议级 `adt_batch` + `adt_release_gate` 取代）。
> 标记约定：🛡 = 经过**目标目的地**的权限策略校验；⏱ = 自定义超时；🔒 = 声明 `isConcurrencySafe`（可并发/只读）。
> 通用参数 `destination`（string，可省略 = 默认目的地）适用于除 `adt_local_check` / `adt_permissions` / `adt_list_destinations` / `adt_list_gui_connections` / `adt_create_destination` 外的所有工具，下表不再重复。
> 通用对象引用三元组：`objectUri`（精确 URI，优先）/ `name` / `type`（短码或 ADT 形式，如 CLAS 或 CLAS/OC）。
> 钳制原则：所有带上限的参数（maxResults/top/maxObjects…）被钳制时都会在输出 `note` 中说明，绝不静默。

---

## 1. 系统与连接（7）

### adt_list_destinations 🔒
枚举配置的全部 ADT 目的地并逐个 ping（含**会话工作区文件** `.dsh-abap-adt/destinations.yaml` 叠加后的完整视图）。
- **入参**：无。
- **返回**：`destinations[] { name, mock, ok, detail }`。

### adt_list_gui_connections 🔒
搜索**本机 SAP GUI（SAP Logon）连接列表**（`SAPUILandscape.xml` / `saplogon.ini`），用于把已有 GUI 连接导入为 ADT 目的地。用户口头要一个连接时先搜这里，把匹配项拿出来让用户挑；多词查询逐词 AND（"impc qas"）。`group` 类条目（消息服务器负载均衡）推不出单机 URL，需用户补 url。
**端口约定推导 + 实测验证**：GUI 条目只证明 DIAG 端口（`host:32nn`），`adtUrl`（端口约定 `https://host:443nn` / `http://host:80nn`）只是**未验证猜测**——实例号未必对应 ICM 端口、web dispatcher 可能走 443、saprouter 条目本机直连通常不通。因此默认对每个带 host 的匹配**探测**候选组合（`443<nn>` / `443` / `80<nn>` / `80`；无凭证 GET `/sap/bc/adt`，任何 HTTP 响应算可达，401 = ADT 存活的标准无凭证应答），返回 `probe.verifiedUrl`（真正应答的那个，可能与 adtUrl 不同——**导入以它为准**）或 `probe.detail`（全部不通时的逐候选原因与引导：VPN/防火墙/saprouter/需 web dispatcher url）。
- **入参**：`query`（可选，空 = 全列）；`limit`（默认 25，钳 1–100）；`probe`（默认 true）；`probeTimeoutMs`（单候选超时 ms，默认 2500，钳 250–10000）。
- **返回**：`available, sources[], connections[] { uuid, name, kind(direct|group|reference), systemId?, folder?, client?, user?, language?, host?, sysnr?, router?, adtUrl?(未验证猜测), httpUrl?, adtUrlNote?, probe? { reachable, verifiedUrl?, status?, detail, tried[] { url, ok, status?, detail } } }, truncated?`。无 GUI 时 `available: false` + 提示改走手工字段。

### adt_create_destination
在**会话工作区**写 `.dsh-abap-adt/destinations.yaml` 创建/更新目的地（原子写、写后即热生效——下一次 `adt_*` 调用即可用）。两种模式：`guiUuid` 导入 GUI 连接（client/language/username 自动带出，`strictSSL` 默认 false）；或手工传 `name` + `url`。
**URL 探测（导入模式）**：URL 按 GUI 推导时（未显式传 `url`）默认实测候选组合（`443<nn>` / `443` / `80<nn>` / `80`，无凭证 GET，401 = 存活），用**第一个真正应答的** URL 落盘（可能与端口约定不同并在 notes 说明）；**没有任何候选展示可用 ADT 端点时拒绝创建**（不写文件），报逐候选原因与引导（VPN/防火墙；**saprouter 条目**：HTTP 无法走 GUI 的 saprouter——要 web dispatcher url 作为显式 `url` 传入）；`force: true` 可强制保存（标记 `urlVerified.ok=false`）。显式传入的 `url` 不探测（用 `ping` 验证）。
**ping 先行（`ping: true`）**：保存前先带凭证 ping。**连接级失败**（无 HTTP 状态码：网络/VPN 不通）同样拒绝保存（`force` 可覆盖）；**HTTP 级失败**（如 401——URL 已证存活）照常保存并提示修凭证/服务。
**写出的文件自带说明**：每个未指定的可配置项都以注释行（含默认值与用途，`passwordEnv` 按目的地名生成约定引用）一并写入，取消注释即可手工改配置；托管写入保留已设值并重新生成注释模板，不会把 schema 默认值物化成真实行。
**按目的地权限**：六个策略键 `enableTransports` / `allowedTransports` / `allowTransportableEdits` / `allowedPackages` / `allowExecution` / `allowBatchWrites` 可直接传入，写入该条目的 `policy:` 块；只覆盖显式传入的键，未传的沿用全局配置 / `SAP_*` 环境变量 / 内置默认（见 policy 表）。
**密码**：直接传 `password` —— 默认存入 **DSH 凭证文件** `~/.dsh/.credentials.yaml`（引用名 = `passwordEnv` 或约定 `ADT_<NAME>_PASSWORD`，destinations.yaml 只留引用不落明文）；未挂载凭证服务、或显式 `passwordInFile: true`、或凭证服务拒绝写入（同名环境变量遮蔽）时回退**明文写入文件**并附警告。不传 `password` 时可自行维护该引用（DSH 分层解析：进程环境变量 > 凭证文件 > `.env`，每次调用实时读取）。
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
- **返回**：`enableTransports, allowedTransports[], allowTransportableEdits, allowedPackages[], sources{}, defaults{}, perDestination{ <name>: {同前四项 + sources} }`。

### adt_selfcheck 🔒（能力巡检 sweep）
对一个目的地做**只读能力扫描**（绝不写、绝不执行代码）：对每个只读能力用一个探针对象实跑并给出判定——`answered / empty（真空，非故障）/ absent（后端无此服务，404/405）/ refused（策略拒绝）/ dead（返回空而独立 oracle 证明有内容——本工具存在的理由）/ broken（我们的错误）/ skipped（无探针输入）`。探针对象默认取搜索 `Z*` 的第一个类，也可显式传 `name`(+`type`)。
- **入参**：`name`/`type`（探针对象，可省略）；`packageName`（限定探针搜索）；destination。
- **返回**：`destination, probeObject, checks[] { capability, tool, verdict, detail }, summary{answered,empty,dead,absent,refused,broken,skipped}, unprobedTools[]（刻意不巡检的全部工具名——覆盖声明是清单不是空白）, note`。
- **oracle 交叉验证**：search↔read↔$batch↔package-content↔ping/system_info 两两独立印证——"搜索说对象存在而 read 说没有"即 `dead`。
- **用途**：新系统接入验证、插件升级后回归、"为什么某能力什么都不返回"的第一诊断。设计借鉴 vsp 的 sweep.go（"十个能力广告了、注册了、可达、但从未答对过——全是手工发现的"）。

## 2. 搜索与浏览（3）

### adt_search 🔒
对象名 + 源码全文双通道搜索，支持包过滤与分页。
- **入参**：`query`*（支持 `*` 通配）；`operation`（quickSearch* / objectSearch / quickSearchSource）；`packageName`（对象命中按包过滤；源码命中无包属性会被丢弃并 note 说明）；`maxResults`（默认 25，钳 1–100）；`offset`（跳过前 N 条，客户端分页）；`objectType`（如 CLAS/PROG/DDLS）。
- **返回**：`query, count, offset, note?, objects[] { objectName, description, type, uri, packageName?, … }, sources[] { objectName, type, uri, line, lineNumber? }`。
- 钳制/截断均写入 `note`（含「raise offset to N」提示下一页）。

### adt_package_content 🔒
列出包的**直接成员**（`$TMP` 为本地对象）。返回刻意精简：`name + type` 即可在其他工具中引用对象，uri/category 可推导、不再返回。
- **入参**：`packageName`*。
- **返回**：`packageName, count, objects[] { name, type }`。

### adt_where_used 🔒
影响分析：谁引用/依赖该对象。后端无 usageReferences（404/405）时降级为 note + 替代建议。
- **入参**：对象三元组；`enableAllTypes`（bool，默认 false；true 明显变慢）。
- **返回**：`objectUri, totalReferences, note?, references[] { name, type, uri, packageName?, responsible?, usageInformation? }`。

## 3. 对象源码 CRUD（6）

### adt_read_object 🔒
读取对象源码 + 元数据。支持行窗口分页读取大对象。**默认同时在本地留全量快照**（`.adt-snapshots/<目的地>/…`，沙箱感知）+ sidecar 记录读取时刻的服务端内容哈希——这是冲突安全编辑的基础（edit 对快照匹配、push 校验后上传）。
- **入参**：对象三元组；`startLine`（1 起含，默认 1）；`endLine`（含，默认末行）；`snapshot`（默认 true；false 关闭本地快照）；**`method`**（方法级读取：只返回该 METHOD…ENDMETHOD. 块；窗口仍按全源行号编址，不能与 startLine/endLine 同用；未找到→错误列出该类全部方法名，多处定义（本地测试类同名）→错误列出各位置）；**`context`**（默认 false；true 时附加**依赖契约序言**）；**`contextDeps`**（序言契约数预算，默认 8，钳制 1–15）。
- **返回**：`uri, name, type, source（窗口内）, description?, properties{}, startLine, endLine, totalLines, method?, contextPrologue?, localCopy?（快照路径）, snapshotHash?（冲突校验基准哈希）`。全量读取（≤2000 行、非方法级）仍重放为行号化 read 卡片。
- **依赖契约序言**（`context: true`，借鉴 vsp ctxcomp）：从**所读片段**（方法级读取则仅该方法）提取依赖——超类/接口优先，其次签名类型、高频协作者、异常类；按预算并发拉取类/接口的**公共契约**（类只留 DEFINITION 的 PUBLIC SECTION，接口全文；单个契约 ≤80 行，序言总额 ≤24K 字符）。预算花在**成功取回**的契约上（解析失败只损失一次尝试不损失名额）；**解析失败的依赖原样列出**（看得见的缺口≠没有依赖）；函数模块调用只列调用次数（契约在函数组里）。方法级读取时序言随方法收窄。
- **include 解析**（impc-dev 实战）：`name+type=PROG` 传 include 名不再 404——PROG/INCL 族的按约定 URI 是二义的（`/programs/programs/` vs `/programs/includes/`），解析先做精确名搜索取真实 URI/type，搜索不可用才回落约定 URI。
- **路由守卫**：MSAG/DOMA/DTEL/TTYP 是结构化元数据（真实后端无 `/source/main`）→ 直接拒绝并指向 `adt_read_structure`；DEVC → 指向 `adt_package_content`。与 read_structure 的反向守卫（源码对象指向本工具）对称，杜绝"读到占位垃圾或 404 却不知该去哪"。

### adt_push_object 🛡⏱180s（pull→edit→push 的 push 半）
把本地编辑后的快照上传服务器，**上传前在持锁状态下做哈希校验**：服务端仍是快照基准状态 → 上传；被他人改过 → `[CONFLICT]` 拒绝且服务端不动，本地文件保留——重读、合并、再推。上传后**回读验证持久性**（见 adt_write_object 的 `persisted`）。
- **入参**：对象三元组；`packageName`；`path`（默认 = adt_read_object 建立的跟踪快照；自定义路径=无基准不校验）；`activate`；`transport`。
- **返回**：`uri, name, pushed, verified, localCopy, unlocked?, activated?, persisted?, warning?, transport?, transportSource?, activation?`。

### adt_write_object 🛡
整体替换对象源码，lock → write → unlock 自动完成，支持写后即激活。**存在快照时写前校验**（服务端与快照基准不符 → `[CONFLICT]` 拒绝）；写后从回读刷新快照并**验证持久性**。
- **入参**：对象三元组；`packageName`（策略提示）；`source` 或 `sourceFile`（二选一）；`unlock`（默认 true）；`activate`（默认 false，写后同调用内激活并返回 activation 结果）；`transport`（**指定修改计入的传输请求号**；省略时由后端在 lock 时决定——已在 open 请求中的对象留在原请求，否则自动新建 task）。
- **返回**：`uri, name, updated, unlocked?, activated?, persisted?, warning?, transport?, transportSource? ('user'|'auto'), activation? { success, message }`——`transport` 告诉你修改实际计入了哪个请求，`transportSource='auto'` 提醒这是后端自动分配（可能是新请求，下次可显式传 `transport` 控制）。
- **持久性验证**（impc-dev 实战新增）：写前 OCC 哈希只保护写前窗口；同账号另一会话在写后解锁时用旧缓冲区整存覆盖时，写会"成功"但被静默打回。写后回读与所写内容做容错比对（CRLF/行尾空白不算差异），不一致 → `persisted:false` + 醒目告警（重读重做、勿激活）；读失败 → `persisted:undefined` + 提示回读确认。
- **策略**：allowedPackages + allowTransportableEdits + CORRNR 的 allowedTransports 校验（显式传入与自动分配都校验），不匹配即回滚锁；unlock 失败时如实返回 `unlocked: false` 并保留锁账本条目。
- **传输语义**：显式 `transport` 经 PUT `?corrNr=` 精确生效（用户值优先于 lock 分配值，对齐官方编辑器行为）。

### adt_edit_object 🛡
只替换源码的一部分——**三模式**，与 DSH `edit` 同心智。**冲突安全（默认）**：存在本地快照（adt_read_object 建立）时，匹配跑在**你读到的快照**上（确定性，非对漂移文本的模糊匹配），且上传前在持锁状态下哈希校验服务端未变——他人改过 → `[CONFLICT]` 拒绝、服务端不动；重读后再改即恢复：
- **模式 1（推荐，精确编辑）：`oldText` + `newText`**。从刚读的 `adt_read_object` 输出**原样引用**要替换的文本（多行 OK、含尾注释 OK），给出替换文本。不唯一 → 错误列出全部位置，**多引上下文行即可消歧**（或 `occurrence`）；找不到 → 列最接近行，重读一次重试即收敛。多行引用按行匹配（剥注释/大小写/缩进容忍）。
- **模式 2（整块替换，省上下文）：`start`/`end` 块标记**。替换整个 METHOD/FORM 而无需引用其全文。裸闭合语句（ENDFORM./ENDIF./…）按**嵌套深度结构化解析**（2063 行语料 ENDFORM.×31/ENDIF.×59 下取对本块闭合）；同名重复行用 `occurrence`；按位置用 `startLine`/`endLine`（同时给 `start` 时校验该行防行号过期）。
- **模式 3（方法手术，类）：`method` + `newText`**。按方法名替换恰好一个 METHOD…ENDMETHOD. 块——只收发 ~30 行的新块，服务端取全类拼接、OCC 校验、推送同其他模式。多处同名（本地测试类）→ 错误列出各位置（改用模式 2）。不能与 oldText/start/end/startLine/endLine 同用。
- 也可**自己编辑本地快照文件**（路径见 read 输出 `localCopy`），再 `adt_push_object` 校验上传。
- start 匹配层级：①注释剥离子串 → ②去空白（引号内空格容差 `'BUKRS  '` vs `'BUKRS'`）→ ③原始行（可编辑注释掉的代码）。
- **入参**：对象三元组；`packageName`；模式 1（`oldText`/`newText`）/ 模式 2（`start`/`end`/`source`/`sourceFile`/`startLine`/`endLine`）/ 模式 3（`method`/`newText`）；共用 `occurrence`/`activate`/`transport`。
- **返回**：`uri, name, start, end, replaced, startLineNumber, endLineNumber, oldLines, newLines, matchMode ('structured'|'text'|'text-loose'|'text-raw'|'line-number'), occurrence?, unlocked?, activated?, persisted?, warning?, transport?, transportSource?, activation?`。
- **持久性验证**（impc-dev 实战新增）：写后回读验证（同 adt_write_object 的 `persisted`）。`persisted:false` = 并发编辑者（同账号另一会话的旧缓冲区）在写后覆盖了改动——**重读重做，勿激活**；多会话/共享账号环境下编辑后立即 `adt_read_object` 复核仍是最可靠的确认。
- **回退链**：无快照 → 对拉取的服务端源码匹配（旧行为）；结构化失败（起始行非块开头/深度失衡）→ 自动回退文本匹配，不会静默错编。
- **实测语料**：2063 行生产 include 回归（`test/fixtures/zfir_gxyh040_frm.abap`：中文注释、Mod 标记、宏、重复行、嵌套块）。

### adt_create_object 🛡
新建对象。支持的类型：CLAS / INTF / PROG / DDLS / TABL / STRU / **DOMA / DTEL / TTYP** / MSAG / FUNC / DEVC。
- **入参**：`type`*（12 种枚举）；`name`*；`description`*；`packageName`*（`$TMP` = 本地）；`transport`（需要传输时）。
- **返回**：`success, uri, name, type, messages[] { severity, text }`。
- **特殊**：后端 500-but-created 探测；建后锁卫生（自动锁无 handle 时记入锁账本）。

### adt_delete_object 🛡
删除对象（现代 deletion 服务 + legacy `_action` 回退）。**不可逆**。
- **入参**：对象三元组；`packageName`；`transport`（删除计入的请求号，语义同 adt_write_object）。
- **返回**：`uri, deleted, transport?`。

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

## 5. 测试与 ATC（4）

### adt_run_unit_tests ⏱330s
运行 ABAP Unit（提交→轮询→JUnit 解析在客户端内完成）。
- **入参**：`objects`*。
- **返回**：`success, overall, total, passed, failed, skipped, errors, durationMs, classes[] { className, status, tests[] { methodName, status, durationMs, message? } }`。

### adt_run_atc ⏱660s
对给定对象启动新 ATC run。run 会**落库**（在 adt_list_atc_runs 可见，工具触发的通常叫 "External Request + 时间戳"）；`durationMs` 为客户端实测整个 start→轮询→取结果的墙钟时间。
- **入参**：`objects`*；`variant`（string）。
- **返回**：`clean, findings[] { checkTitle, severity, message, objectName, uri?（该行所属对象的 URI——常为 include 而 objectName 是主程序）, line?, check? }, counts { INFO, WARNING, ERROR, CRITICAL, CATASTROPHIC }, durationMs, variant?, displayId?, title?, checkVariant?, aggregates?`。
- **位置映射**（impc-dev 实战）：后端把程序全部 finding 挂在**主程序名**下而 `line` 是 include 内行号——先看每条 finding 的 `uri` 再跳行；权威 P1–P4 汇总以 `adt_list_atc_runs` 为准。

### adt_list_atc_runs 🔒
列出系统上已存的 ATC run。后端差异大：多数要求至少一个过滤条件（缺省发当前用户），**子集实现只接受无参数查询**（任何过滤参数 400）——被拒的过滤自动回退无参数重试。
- **入参**：`createdBy`、`ageMin`、`ageMax`（天）、`central`、`active`、`sysId`（子集后端忽略）。
- **返回**：`count, runs[] { displayId, title?, checkVariant?, createdAt?, createdBy?, status?, kind?, aggregates?, attributes{} }`。
- **P1–P4 汇总以本工具为准**（impc-dev 实战：单结果体不带 aggregates，明细里 P1–P4 恒 0）。

### adt_get_atc_result 🔒
按 displayId 复取一条已存 ATC 结果。
- **入参**：`displayId`*；`includeExemptedFindings`（默认 false）。
- **返回**：`displayId, title?, checkVariant?, clean, findings[]（含 uri?）, counts{}, aggregates?（结果体缺失时按 finding priority 推导）, durationMs, rawXml?`。

## 6. 传输与版本（4）

> **已移除 `adt_release_transport`**：释放传输不可逆且需要人工判断（导入顺序/窗口/缓冲区状态），Agent 应把一切准备到「可释放的请求」，最后一步留给人。协议客户端 `releaseTransport()` 保留。

### adt_object_versions 🔒
对象版本历史（Atom feed），每版本带其落入的传输号/任务。
- **入参**：对象三元组。
- **返回**：`objectUri, versions[] { versionId, author?, updatedAt?, title?, transportRequest?, transportDescription? }`。

### adt_list_transports 🔒
列当前用户的传输请求。
- **入参**：`allUsers`（默认 false）；`status`（默认 all；`modifiable`=未释放（别名 D）/ `released`（别名 R/L）/ 其他值透传后端）。
- **返回**：`transports[] { number, description, status, category, owner, system, client, modifiable, target?, items?[] }`。
- **状态过滤**（impc-dev 实战）：语义词**先翻译成后端字母码**（`modifiable`→`D`、`released`→`R`）再发（原样透传会匹配 0 行）；后端 400 拒绝 `status` 参数时自动去参重试 + 客户端侧过滤兜底。结论前仍建议与 `adt_get_transport` / `adt_object_versions` 交叉验证。
- **策略**：仅受 enableTransports（传输族开关）约束。

### adt_get_transport 🔒
单个传输请求详情（含条目）。**只读，不再受 allowedTransports 约束**（传输号管控只针对编辑类操作）。
- **入参**：`number`*。
- **返回**：`number, requestedNumber?（请求的是任务号且被解析到父请求时）, note?（任务→父请求映射提示）, description, status, category, owner, system, client, modifiable, items[] { name, type, action, description? }`。
- **任务号语义**（impc-dev 实战）：版本历史（adt_object_versions）记录的是**任务级**号码；传任务号查询时真实 CTO 后端返回**父请求**——比对返回的 `number` 与所传号码，后续操作用父号。

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
对象源码导出为本地 `.abap` 文件（abaplint 兼容命名）。**只接受显式对象清单**（不再支持整包导出）——先用 `adt_package_content` / `adt_search` 建清单，导什么一目了然。
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

### adt_list_dumps 🔒
列 ABAP 短转储（ST22 feed）。运行/测试报运行时错误后定位 dump。
- **入参**：`user`；`from`/`to`（YYYYMMDD 或 YYYYMMDDHHMMSS，服务端过滤）；`top`（默认 20，钳 1–100）；`skip`。
- **返回**：`count, note?, dumps[] { id, title, category?, user?, updatedAt? }`。
- **满页判定（多取一行）**：实际请求 `top+1` 行——多出一行即说明"还有更多"，note 写 `showing N, and there may be more; raise top, or page with skip=… / narrow by user / from / to`；恰好 N 行与"N 行还有更多"区分开，不编造总数。

### adt_get_dump 🔒
读单个转储详情（id 来自 adt_list_dumps）。
- **入参**：`dumpId`*；`view`（default=结构化分节 / summary=HTML / formatted=纯文本分析视图）。
- **返回**：`id, view, title?, sections[] { name, value }, raw?`。

## 8b. 结构化编辑器（2）

### adt_read_structure 🔒
读 DDIC 对象的**结构化元数据**（这些对象没有 `/source/main` 源码，`adt_read_object` 不适用）：消息类（MSAG）/ 域（DOMA）/ 数据元素（DTEL）/ 表类型（TTYP）。
- **入参**：对象三元组；`kind`（枚举，默认按类型码推导）。
- **返回**：`kind, name, description?, packageName?` + 按类型：MSAG `messages[]`；DOMA `properties{} + fixedValues[]`；DTEL `properties{} + labels{}`；TTYP `properties{}`。

### adt_write_structure 🛡⏱180s
改 DDIC 对象的结构化元数据——read-modify-write：lock → GET 原文 → **只补丁显式提供的字段** → PUT → unlock（SAP 管理属性全量保留）。与所有编辑工具同策略（包白名单 + 传输管控含 CORRNR 回滚）。
- **入参**：对象三元组；`kind`；按类型提供 `description` / `messages[]`（MSAG 全量替换，缺号即删）/ `properties{}`（DOMA/DTEL/TTYP 局部补丁）/ `fixedValues[]`（DOMA 全量替换）/ `labels{}`（DTEL 局部补丁）；`transport`；`packageName`（策略 hint）。
- **返回**：`name, kind, changed[]（应用的字段）, transport?, data（写后生效结构）`。

## 9. 数据预览（1）

### adt_data_preview 🔒
读表 / CDS 视图行数据，或跑 freestyle SELECT。`kind` 枚举**与其他工具的类型码完全一致**（TABL/VIEW/STRU/DDLS，对齐 ADT URI 命名空间 /ddic/tables、/ddic/views、/ddic/structures、/ddls），模型无需切换命名体系。
- **入参**：`name`（大写实体名）+ `kind`（enum TABL/VIEW/STRU/DDLS，默认 TABL），或 `sql`（二选一）；`length`（行数窗口，默认 100，钳 1–5000；旧别名 `top`）；`offset`（跳过前 N 行——行范围 = offset..offset+length，客户端分页，SQL 路径同样生效）。
- **返回**：`source, name, offset, totalRows, note?, queryExecutionTime?, columns[] { name, type, description?, length? }, rows[], rawXml?`。
- ABAP Cloud 阻止直连 DB 表（CDS/SQL 可用）；无 datapreview 服务的 profile 给明确错误。

---

## 附：权限策略的 per-destination 语义

六个开关（enableTransports / allowedTransports / allowTransportableEdits / allowedPackages / allowExecution / allowBatchWrites）：
- **顶层**（settings `abap-adt:` 段或插件行 config）= 全局默认；
- 每个 destination 的 `policy:` 块**逐键覆盖**全局（如 prd 禁传输 + 只许 $TMP + 禁执行，dev 放开）；
- `SAP_*` 环境变量只参与全局层的兜底解析；
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
