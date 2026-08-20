# adt_* 工具清单 — 入参 / 返回参考

> 覆盖 `@nefevcore/abap-adt-dsh-plugin` 当前注册的全部 **34 个工具**（`adt_release_transport` 已按评审意见移除：释放传输是人工决策，协议客户端能力保留但不暴露给 Agent；`adt_batch_checks` 已由协议级 `adt_batch` + `adt_release_gate` 取代）。
> 标记约定：🛡 = 经过**目标目的地**的权限策略校验；⏱ = 自定义超时；🔒 = 声明 `isConcurrencySafe`（可并发/只读）。
> 通用参数 `destination`（string，可省略 = 默认目的地）适用于除 `adt_local_check` / `adt_permissions` / `adt_list_destinations` 外的所有工具，下表不再重复。
> 通用对象引用三元组：`objectUri`（精确 URI，优先）/ `name` / `type`（短码或 ADT 形式，如 CLAS 或 CLAS/OC）。
> 钳制原则：所有带上限的参数（maxResults/top/maxObjects…）被钳制时都会在输出 `note` 中说明，绝不静默。

---

## 1. 系统与连接（4）

### adt_list_destinations 🔒
枚举配置的全部 ADT 目的地并逐个 ping。
- **入参**：无。
- **返回**：`destinations[] { name, mock, ok, detail }`。

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

## 3. 对象源码 CRUD（5）

### adt_read_object 🔒
读取对象源码 + 元数据。支持行窗口分页读取大对象。
- **入参**：对象三元组；`startLine`（1 起含，默认 1）；`endLine`（含，默认末行）。
- **返回**：`uri, name, type, source（窗口内）, description?, properties{}, startLine, endLine, totalLines`。全量读取（≤2000 行）仍重放为行号化 read 卡片。

### adt_write_object 🛡
整体替换对象源码，lock → write → unlock 自动完成，支持写后即激活。
- **入参**：对象三元组；`packageName`（策略提示）；`source` 或 `sourceFile`（二选一）；`unlock`（默认 true）；`activate`（默认 false，写后同调用内激活并返回 activation 结果）；`transport`（**指定修改计入的传输请求号**；省略时由后端在 lock 时决定——已在 open 请求中的对象留在原请求，否则自动新建 task）。
- **返回**：`uri, name, updated, unlocked?, activated?, transport?, transportSource? ('user'|'auto'), activation? { success, message }`——`transport` 告诉你修改实际计入了哪个请求，`transportSource='auto'` 提醒这是后端自动分配（可能是新请求，下次可显式传 `transport` 控制）。
- **策略**：allowedPackages + allowTransportableEdits + CORRNR 的 allowedTransports 校验（显式传入与自动分配都校验），不匹配即回滚锁；unlock 失败时如实返回 `unlocked: false` 并保留锁账本条目。
- **传输语义**：显式 `transport` 经 PUT `?corrNr=` 精确生效（用户值优先于 lock 分配值，对齐官方编辑器行为）。

### adt_edit_object 🛡
只替换源码中的**一个块**。匹配语义对齐 DSH `edit` 工具：标记与**去注释后**的行做大小写不敏感子串匹配，**歧义标记（多候选行）直接报错并列出候选行号**，绝不静默取第一个。
- **入参**：对象三元组；`packageName`；`start`*（起始行标记）；`end`（结束行标记，METHOD/FORM/FUNCTION/MODULE 可自动推导）；`source`/`sourceFile`（替换块全文）；`activate`（默认 false）；`transport`（指定修改计入的请求号，语义同 adt_write_object）。
- **返回**：`uri, name, start, end, replaced, startLineNumber, endLineNumber, oldLines, newLines, unlocked?, activated?, transport?, transportSource?, activation?`（返回实际命中的行号便于核对）。

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
对给定对象启动新 ATC run。
- **入参**：`objects`*；`variant`（string）。
- **返回**：`clean, findings[] { checkTitle, severity, message, objectName, line?, check? }, counts { INFO, WARNING, ERROR, CRITICAL, CATASTROPHIC }, durationMs, variant?, displayId?, title?, checkVariant?, aggregates?`。

### adt_list_atc_runs 🔒
列出系统上已存的 ATC run（后端要求至少一个过滤条件，缺省 = 当前用户）。
- **入参**：`createdBy`、`ageMin`、`ageMax`（天）、`central`、`active`、`sysId`。
- **返回**：`count, runs[] { displayId, title?, checkVariant?, createdAt?, createdBy?, status?, kind?, aggregates?, attributes{} }`。

### adt_get_atc_result 🔒
按 displayId 复取一条已存 ATC 结果。
- **入参**：`displayId`*；`includeExemptedFindings`（默认 false）。
- **返回**：`displayId, title?, checkVariant?, clean, findings[], counts{}, aggregates?, durationMs, rawXml?`。

## 6. 传输与版本（3 + 1 移除）

> **已移除 `adt_release_transport`**：释放传输不可逆且需要人工判断（导入顺序/窗口/缓冲区状态），Agent 应把一切准备到「可释放的请求」，最后一步留给人。协议客户端 `releaseTransport()` 保留。

### adt_object_versions 🔒
对象版本历史（Atom feed），每版本带其落入的传输号/任务。
- **入参**：对象三元组。
- **返回**：`objectUri, versions[] { versionId, author?, updatedAt?, title?, transportRequest?, transportDescription? }`。

### adt_list_transports 🔒
列当前用户的传输请求。
- **入参**：`allUsers`（默认 false）；`status`（默认 all；`modifiable`=未释放（别名 D）/ `released`（别名 R/L）/ 其他值透传后端）。
- **返回**：`transports[] { number, description, status, category, owner, system, client, modifiable, target?, items?[] }`。
- **策略**：仅受 enableTransports（传输族开关）约束。

### adt_get_transport 🔒
单个传输请求详情（含条目）。**只读，不再受 allowedTransports 约束**（传输号管控只针对编辑类操作）。
- **入参**：`number`*。
- **返回**：`number, description, status, category, owner, system, client, modifiable, items[] { name, type, action, description? }`。

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

## 8. 批量与门禁（3）

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

### adt_get_dump 🔒
读单个转储详情（id 来自 adt_list_dumps）。
- **入参**：`dumpId`*；`view`（default=结构化分节 / summary=HTML / formatted=纯文本分析视图）。
- **返回**：`id, view, title?, sections[] { name, value }, raw?`。

## 8b. 结构化编辑器（2）

### adt_read_structure 🔒
读 DDIC 对象的**结构化元数据**（这些对象没有 `/source/main` 源码，`adt_read_object` 不适用）：消息类（MSAG）/ 域（DOMA）/ 数据元素（DTEL）/ 表类型（TTYP）。
- **入参**：对象三元组；`kind`（枚举，默认按类型码推导）。
- **返回**：`kind, name, description?, packageName?` + 按类型：MSAG `messages[]`；DOMA `properties{} + fixedValues[]`；DTEL `properties{} + labels{}`；TTYP `properties{}`。

### adt_write_structure
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
