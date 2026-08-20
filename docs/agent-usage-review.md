# adt 工具盘点 · 行为分析 · Agent 使用优化方案

> 范围：`packages/dsh-plugin-abap-adt`（30 个 `adt_*` 工具）+ 底层 `adt-protocol` 客户端行为。
> 视角：把「调用方是 LLM Agent」作为一等约束来审视工具契约——调用链成本、上下文经济、失败可读性、误操作安全、长任务语义。
>
> **落地状态（2025 整理批次 1）**：✅ 已落地 —— §2.6/P0-2（目的地 typo fail-fast，`registry.require` 对未知名直接抛错）、P0-3（`unlocked` 如实反映 + 失败时保留锁账本条目）、§2.7-1（batch 单测对本地测试类回退全量 refs）、§2.7-2（batch 输出 `truncated` 提示）。代码结构同步整理：`source.ts` 拆为 `read.ts`/`write.ts`/`objects.ts`，共享参数与解析助手收敛到 `tools/common.ts`（下文 `src/tools/source.ts` 路径按此对应）。
>
> **落地状态（2025 评审批次 2，17 条意见全部处理）**：✅ P0-1 部分（edit 匹配硬化：去注释 + 歧义报错）、P0-4 未做（hint 信任保留，见下方说明）；§2.8（version_diff 去双全文）；新增：package_content 瘦身、search 包过滤/offset、DOMA/DTEL/TTYP 支持、read 行窗口、**移除 adt_release_transport**（人工决策）、export 强制对象清单、check 消息归属、preview kind 对齐类型码、get_transport 脱离传输号管控、unlock_all dryRun、**策略四开关改为全局默认 + per-destination `policy:` 覆盖**（工具按目标目的地断言）。工具数 30 → 29。对照表见 `docs/tool-reference.md` 末节。

---

## 1. 工具全景（30 个，按职责分组）

### 1.1 系统与连接（4，只读）

| 工具 | 关键输入 | 行为要点 | 策略 |
|---|---|---|---|
| `adt_list_destinations` | — | 逐个 ping 所有目的地，返回可达性 + 缓存状态 | 无 |
| `adt_system_info` | destination | discovery 解析：SID/release/ABAP Cloud/feature flags/服务数 | 无 |
| `adt_ping` | destination | 单目的地探测（认证+可达） | 无 |
| `adt_permissions` | — | 输出生效策略四开关 + 每项来源（config/env/default） | 无 |

### 1.2 搜索与浏览（3，只读）

| 工具 | 关键输入 | 行为要点 |
|---|---|---|
| `adt_search` | query, operation(quick/object/source), maxResults(≤100), objectType | 对象名+源码全文双通道；后端不支持 quickSearchSource 时降级并在 note 说明 |
| `adt_package_content` | packageName | 搜索带包过滤（max 500）→ nodestructure 回退；只列**直接成员** |
| `adt_where_used` | 对象引用 | usageReferences；404/405 时降级为 note + 替代建议（adt_search/package_content） |

### 1.3 对象源码 CRUD（5，全部过策略或锁链路）

| 工具 | 关键输入 | 行为要点 |
|---|---|---|
| `adt_read_object` | objectUri 或 name+type | 返回 uri/name/type/source/description/properties |
| `adt_write_object` | 对象引用 + source/sourceFile + unlock | **lock → 策略 → 写 → unlock** 原子链；CORRNR 不在白名单则回滚；失败路径必解锁 |
| `adt_edit_object` | 对象引用 + start/end + 替换块 + activate? | 锁定→读当前源→按行匹配替换一个块→写回→（可选）激活；end 可自动推导（METHOD/FORM/FUNCTION/MODULE） |
| `adt_create_object` | type(9 种枚举)+name+description+packageName | 类型专用集合端点；「HTTP 500 但对象已建」启发式识别；建后主动清理后端自动锁（lock/unlock 探测 + 账本兜底） |
| `adt_delete_object` | 对象引用 + packageName? | 现代 deletion 服务 → `_action=DELETE` 回退；成功后清锁账本 |

### 1.4 生命周期与检查（2）

| 工具 | 行为要点 |
|---|---|
| `adt_activate` | 批量激活；`transport` 显式传参；`checkOnly=true` 纯语法预审（**豁免策略**）；激活错误来自 HTTP 200 body 的 `chkl:messages`，带行号 |
| `adt_check` | checkruns 语法/一致性检查，不改状态，无策略 |

### 1.5 锁管理（2）

| 工具 | 行为要点 |
|---|---|
| `adt_lock_info` | 只读查锁（谁持有/传输号）；后端不暴露时 locked=null+note |
| `adt_unlock_all` | 重放**持久锁账本**（`~/.dsh/abap-adt-locks.json`，跨会话）+ 显式对象；有 handle 用 handle，无 handle 尝试裸 UNLOCK；失败项报「需 SM12」 |

### 1.6 测试与质量（4）

| 工具 | 行为要点 |
|---|---|
| `adt_run_unit_tests` | 异步 run：POST → 1.5s 轮询 → 300s 截止；旧后端走 legacy 同步路径；JUnit 解析到方法级 |
| `adt_run_atc` | 异步 run：2s 轮询 → 600s 截止；checkstyle/atcresult 双格式解析；返回 displayId 供复取 |
| `adt_list_atc_runs` | 列系统已存 ATC run（无过滤时默认当前用户） |
| `adt_get_atc_result` | 按 displayId 取完整结果（含豁免开关） |

### 1.7 批量与门禁（2，超集功能）

| 工具 | 行为要点 |
|---|---|
| `adt_batch_checks` | 整包 ATC（maxObjects 默认 50/cap 200）+ 单测聚合报告 |
| `adt_release_gate` | 语法+单测+ATC 三段，一次输出 go/no-go；单测跑**全部对象**（能覆盖类内本地测试类） |

### 1.8 传输与版本（5）

| 工具 | 行为要点 |
|---|---|
| `adt_list_transports` | 当前用户传输请求（可 allUsers/status 过滤）；**受 enableTransports 管控** |
| `adt_get_transport` | 单请求 + 对象清单；受 enableTransports + allowedTransports 管控 |
| `adt_release_transport` | 释放请求；不可逆；双重策略断言 |
| `adt_object_versions` | 版本历史 Atom feed（对象→传输号映射，无需加锁） |
| `adt_version_diff` | 版本间 unified diff（默认 最新版本 vs active）；自研 O(n) 行 diff |

### 1.9 本地化与数据（3，超集功能）

| 工具 | 行为要点 |
|---|---|
| `adt_export_objects` | 包/对象集 → 本地 `.abap`（abaplint 兼容命名）；走 ctx.fs 沙箱；逐对象失败继续 |
| `adt_local_check` | 目录递归扫 `.abap`，abaplint 离线检查；severity 过滤/maxFiles 500/maxIssues 300；`.abaplint.json` 发现链 |
| `adt_data_preview` | 表/CDS/自由 SQL；BTP 禁表预览；404/405 给替代路径提示 |

---

## 2. 工具行为深度分析

### 2.1 对象解析链（`resolve.ts: resolveObject`）——语义正确但有一处高危回退

解析顺序：`objectUri`（直接信任）> `name+type`（TYPE_MAP 有前缀则**按约定拼 URI，不验证存在性**）> `name`（搜索精确命中 > **hits[0] 模糊命中**）> 约定 URI 兜底。

**风险点（对可变更工具是高危）**：
- `exact ?? hits[0]`——名字拼错时（如 `ZCL_DEMO2` 不存在），搜索会拿第一个模糊命中（可能是 `ZCL_DEMO`）**静默替换目标对象**，随后 write/edit/delete 作用到错误对象上。对只读工具无害，对变更工具是事故源。
- TYPE_MAP 未覆盖的类型（如 DDIC 域、搜索类）回退到 `/sap/bc/adt/repository/objects/<name>` 这种通用 URI，最终以裸 404 形式失败，错误信息不指明「类型不支持」。

### 2.2 写路径与锁（`write.ts`、`locks.ts`）——整体扎实，`unlocked` 标志有一处失真 ✅ 已修

写链路：`lock → ledger.register → assertTransportUsage(CORRNR) → write → unlock → ledger.deregister`；任何异常都回滚锁。持久账本 + `adt_unlock_all` + `unlockBestEffort`（无 handle 裸 UNLOCK）这组设计能兜住「进程死亡/创建自动锁」两类残留，是明显强于社区实现的点。

**行为瑕疵**：
- `adt_write_object`：`unlock(...).catch(() => undefined)` 后**无条件** `unlocked=true` 且 `ledger.deregister`——unlock 实际失败时，输出谎报已解锁、账本条目被删（之后 `adt_unlock_all` 也不再重试该对象）。
- `adt_edit_object` 的 finally 块同样把 `unlocked` 硬置 true（虽然 released=false 时保留了账本条目，比 write 好）。

### 2.3 块编辑（`adt_edit_object`）——设计初衷很好，匹配算法偏宽松

匹配是「归一化（小写+压缩空白）后的**行内子串包含**」：
- **注释行可命中**：`" METHOD chat_audit.` / `* METHOD chat_audit.` 归一化后仍包含 startKey，块边界可能落在注释上。
- **前缀歧义**：start=`METHOD get` 会先命中 `METHOD get_name`；多个同名/前缀方法时无唯一性校验，静默选第一个。
- 这些在人类编辑里少见，但 Agent 生成的 start 串更容易踩中；一旦错块，写回的是「错误的整对象源码」，代价被放大。

### 2.4 权限策略（`policy.ts`）——fail-closed 框架好，hint 信任是旁路

四开关（enableTransports / allowedTransports / allowTransportableEdits / allowedPackages）+ config>env>default 解析 + `[POLICY]` 错误带规则名 + `adt_permissions` 自省，这套「Agent 先读围栏再干活」的思路是对的。后端 lock 自动分配的 CORRNR 也纳入 allowedTransports 校验、不匹配即回滚，考虑得很细。

**旁路**：`resolvePackageName` **无条件信任调用方传入的 `packageName` hint**。当 allowedPackages 收紧（如只允许 `Z*`）而目标对象实际在别的包时，Agent（或被污染的上下文）只要传一个白名单内的包名即可通过 `assertEditAllowed`。包名校验只对「新建」用显式参数是合理的，对「已存在对象」应以后端搜索命中的包名为准、hint 仅作回退。

另外 `adt_list_transports`（只读）受 enableTransports=false 一并拒绝——README 已声明为预期（「传输工具族」），但从 Agent 视角，「关传输」同时丧失了*查看*能力，会制造「为什么列表是空的/报错」的困惑，建议至少在错误信息里说明这是策略而非故障。

### 2.5 异步长任务（Unit/ATC）——阻塞式整段等待

客户端内部完成了提交→轮询→取结果（Unit 1.5s/300s，ATC 2s/600s），对 Agent 是单次同步调用：
- 无法中途取消（`exec.signal` 只在 `adt_export_objects` 的写文件里用到，轮询循环不感知）。
- 无进度反馈，大包 ATC 可能阻塞数分钟，Agent 侧只能干等或超时重试（重试会再起一个 run，后端结果堆积）。
- `timeoutMs` 协议层有参数，工具层没暴露。
- 反例是 `adt_run_atc` 返回 `displayId` + `adt_get_atc_result` 复取——这个「产物可寻址」模式已经存在，只是 run 本身不拆分。

### 2.6 目的地选择（`registry.require`）——typo 静默回退 default ✅ 已修（未知名直接抛错并列出可用目的地）

`name && destinations.has(name) ? name : this.defaultName`：传了不存在的目的地名**不报错**，直接落到 defaultDestination。对只读工具是麻烦（读到错误系统还以为成功了），对 write/delete/release 是事故（typo `dve` → 落到 `dev` 或 `demo`）。Agent 传参手滑的概率不低，这里应当 fail-fast。

### 2.7 批量语义——三处不一致/盲区

1. **`adt_batch_checks` 的单测选择是错的**：过滤条件 `name 含 ~TEST 或 ltcl_ 前缀` 作用在**包成员名**上，而 ABAP 单测的主流形态是「生产类内部的本地测试类（FOR TESTING）」，成员名就是 `ZCL_FOO`。结果 batch 报告里 unit 恒为 0 测试；而 `adt_release_gate` 对全部 refs 跑单测，才是对的。两者还互相矛盾。
2. **maxObjects 截断无提示**：`members.slice(0, maxObjects)` 静默截断，输出只有 `analyzed` 数，不告诉 Agent「包里其实有 300 个对象，只查了 50 个」——门禁结论可能是假阴性。
3. **`resolveObjects` 一票否决**：批量工具（activate/check/unit/atc）里一个坏条目导致整次调用失败。Agent 对「部分成功+失败清单」的利用率远高于「全有或全无」。

### 2.8 输出体积——两类上下文浪费

- `adt_version_diff` 的结构化输出同时携带 `from.source`、`to.source` **两份全文** + diff + 版本列表；render 只显示 diff。Agent 消费结构化输出，等于每次 diff 白白吃两份完整源码进上下文。
- `adt_data_preview` 的 render 把每一行都拼进文本（top 上限 5000），大结果集会打出巨量文本；结构化 rows 同样全量返回。
- `adt_search` 每条命中带 10 个字段（masterLanguage/responsible/changedAt/…），多数场景用不上。

### 2.9 值得保留的亮点（Agent 视角）

- **`adt_permissions` 自省** + `[POLICY]` 错误点名规则：Agent 能自适应而不是反复撞墙。
- **displayId 产物寻址**（ATC run）+ `sourceFile`（本地文件替代内联大源码）：都在省 token / 支持长流程。
- **降级带指引**（where-used/versions/datapreview 的 404/405 → note + 替代路径；create 的 500-but-created 探测）：错误信息可执行。
- **激活错误带行号/错误码**：直接支撑「激活失败→edit_object 修复」闭环。
- **锁账本跨会话 + unlock_all**：把 SAP 最恶性的「SM12 残留锁」自动化了。
- **mock demo 目的地**：Agent 工具链可在零 SAP 环境下回归。

---

## 3. Agent 使用角度的优化方案

按优先级分四档：P0 = 正确性/安全（建议尽快），P1 = 调用链与上下文成本（收益最大），P2 = 长任务与一致性，P3 = 体验增强。

### P0-1 模糊命中防护：变更类工具禁止 hits[0] 回退
- **改法**：`resolveObject` 增加模式参数；write/edit/delete/activate 走 `strict` 模式——无 objectUri、搜索无精确命中时抛错并列出 top 候选（`candidates: [{name,type,package}]`），让 Agent 二次确认。只读工具维持现状。
- **位置**：`src/resolve.ts` + `src/tools/write.ts`/`objects.ts`/`lifecycle.ts`。
- **收益**：消灭「改错对象」这一最贵的事故类别。

### P0-2 目的地 typo 不再静默回退 ✅ 已落地
- **改法**：`registry.require(name)`：`name` 已提供但不存在 → 直接抛错并列出可用目的地；仅 `name` 缺省时才用 default。
- **位置**：`src/registry.ts`。
- **收益**：一行改动，杜绝跨系统误操作。

### P0-3 `unlocked` 标志与账本一致性 ✅ 已落地
- **改法**：write/edit 的 unlock 结果如实反映：`released=false` 时 `unlocked:false`、**保留**账本条目（edit 已保留，write 需修），错误信息提示下一步 `adt_unlock_all`。
- **位置**：`src/tools/write.ts`（writeObject 的 unlock 分支）。

### P0-4 `packageName` hint 不应覆盖后端事实
- **改法**：`resolvePackageName` 顺序改为：搜索精确命中的 `packageName` > hint > 失败关闭。hint 仅在后端查不到时兜底（并在输出里注明「包名来自调用方」）。可顺带在 hint 与后端命中不一致时打 warning。
- **位置**：`src/resolve.ts`。
- **收益**：堵住 allowedPackages 旁路，策略才有权威性。

### P1-5 变更调用链合并：write/edit 内联 activate + check
- **现状**：Agent 标准链路是 read → write → activate → unit/atc，至少 4 次往返；任何一步断掉就留下「已写未激活」的中间态（后端不可运行、别人看到脏版本）。
- **改法**：`adt_write_object` 增加 `activate?: boolean`（edit 已有）；进一步加 `verify?: 'check'|'unit'|'atc'|'gate'`——写入+激活后自动跑校验并把**激活错误行号/测试失败**合并进同一次输出。等价于把 `adt_release_gate` 变成写路径的可选尾缀，而不是让 Agent 自己记得去调。
- **收益**：往返 4→1；「写了忘激活」类中间态从流程上消失。

### P1-6 `transport: "auto"` 自动挂请求
- **现状**：可传输包激活必须传 transport，Agent 得先 `adt_list_transports(status=modifiable)` 再人工挑一个（还得判断对象是否已在某个请求里，必要时 `adt_object_versions` 反查）。
- **改法**：`adt_activate`/`adt_write_object` 支持 `transport:"auto"`：优先「已包含该对象的 open 请求」→ 次选「用户最新 modifiable 请求」→ 无则报错并给建议。锁定时后端自动分配的 CORRNR 本来就会被采纳，把这条路径显式化即可。
- **收益**：省 1–2 次探查调用，且避免 Agent 挑错请求。

### P1-7 补 `adt_create_transport`（新工具）
- **现状**：能列/看/释放传输请求，但**不能新建**——真实系统上开新工作流的第一步就断，只能靠后端 lock 自动分配或人工 SE01。
- **改法**：协议端点 `POST /sap/bc/adt/cts/transportrequests`（创建 request/task），工具参数：type(K/W)、description、target；过 enableTransports + allowedTransports 策略。

### P1-8 批量工具改为「部分成功」语义
- **改法**：`resolveObjects` 返回 `{resolved, failed:[{input, reason}]}`；activate/check/unit/atc 对 resolved 继续执行，输出带 `skipped` 清单。默认失败占比超阈值（如 >50%）才整体报错，阈值可参数化。
- **收益**：Agent 一次拿到「哪些成功哪些需要修」，迭代环更短。

### P1-9 `adt_version_diff` 瘦身
- **改法**：默认只返回 `diff` + 两侧 label/版本元数据；`includeSources?: boolean` 才带全文（评审场景再开）。顺带 `from`/`to` 加 `chars`/`lines` 计数字段。

### P1-10 `adt_read_object` 支持分段/大纲
- **改法**：加可选 `section?: {from,to}`（行区间）或 `outline?: boolean`（只回 `METHOD/FORM/…` 清单+行号）。大类/长程序（几千行）是 Agent 上下文的隐形杀手；outline 还能让 edit_object 的 start/end 选择更准。
- **收益**：读-改闭环的 token 成本大幅下降。

### P1-11 结果集输出分级裁剪
- `adt_data_preview`：render 只打前 N 行（如 20）+「…共 X 行」；结构化 rows 保留全量或加 `maxRowsInOutput`。
- `adt_search`：命中字段按需裁剪（`verbose?: boolean`），默认只带 name/type/uri/package/description。
- ATC/单测 findings：按对象分组 + 每对象 top-N + 总计数（count 字段已有，列表截断加 `maxFindings` 参数并提示剩余数）。

### P2-12 长任务：可取消 + 可拆分
- 近期：`adt_run_unit_tests`/`adt_run_atc` 暴露 `timeoutMs` 参数；轮询循环感知 `exec.signal`（abort 时尽力终止轮询并说明后端 run 是否继续）。
- 远期：仿 ATC displayId 模式，提供 `start(返回 runId) / status / result` 三件套（或 start + 自动 poll 的混合开关 `wait?: boolean`），供 workflow/subagent 编排并行检查多个包。

### P2-13 修 `adt_batch_checks` 的单测盲区 + 截断提示
- 单测对象集与 gate 统一：对全部 `CLAS/PROG` 成员跑（本地测试类会随之执行）；过滤逻辑仅用于「额外标注哪些是独立测试对象」。
- `analyzed < 包成员总数` 时输出 `truncated:true, totalMembers:N`，并在 render 里显式警告「门禁结论仅覆盖 N/M 对象」。

### P2-14 activate 的 N 次包名搜索缓存
- `resolvePackageName` 对同一对象在一次调用内只查一次（Map 缓存）；activate 批量 N 对象时从 N 次搜索降为至多 N 次（去重后更少）。若对象来自 `adt_package_content`，可在 ref 上捎带 packageName 透传，减为 0 次额外搜索。

### P2-15 工具描述补充「何时用/替代关系」
Agent 选错工具的常见点，在 description 里各加一句：
- `adt_edit_object`：「改一个方法/块时**优先于** adt_write_object（整对象上传）」。
- `adt_check` vs `adt_activate(checkOnly)`：两者关系（后者属激活预审链路）。
- `adt_batch_checks` vs `adt_release_gate`：巡检 vs 发布门禁。
- `adt_local_check` 的前置条件（先 export）已写清，保持。
- `adt_search.objectType` 收敛为 enum（TYPE_MAP 键），减少非法取值。

### P3-16 输出内嵌「下一步提示」
- 变更类工具输出统一加 `hints: string[]`（机器可读），例如 write 后 `["call adt_activate to activate ZCL_FOO", "run adt_check first if unsure"]`；release_transport 前提示 `adt_release_gate`。让新手 Agent 无需记住 SOP。

### P3-17 `adt_delete_object` 二次确认参数
- 加 `confirm?: boolean`（或要求传 `expectedVersion`）；默认缺省时仅返回「将删除 X（包 Y，被 N 处引用，见 where_used）」的预览。策略层之外再给一道防误删闸。

### P3-18 demo 目的地的策略摩擦
- demo mock 的传输号（S4HK900001…）不在默认 allowedTransports 白名单内，纯演示也会被拒（README 已提醒）。可在检测到目的地为 mock 时自动放宽 allowedTransports 匹配（或 demo 配置默认 `allowedTransports:'*'`），降低首次体验挫败。

### P3-19 包树遍历
- `adt_package_content` 加 `recursive?: boolean / depth`：把 nodestructure 的子包递归展开，Agent 做「整个包树导出/巡检」不必自己递归调用。

---

## 4. 落地顺序建议

| 阶段 | 内容 | 工作量 |
|---|---|---|
| 第一批（行为修正） | P0-1/2/3/4 + P2-13（batch 单测盲区、截断提示） | 小，纯插件层，补单测即可 |
| 第二批（链路合并） | P1-5（activate/verify 内联）、P1-6（transport auto）、P1-8（部分成功） | 中，改工具 execute + 输出 schema |
| 第三批（上下文经济） | P1-9/10/11 | 小-中，注意输出 schema 向后兼容（新增可选字段） |
| 第四批（长任务/生态） | P2-12、P1-7、P3-16/17/19 | 中-大，涉及协议层 |

验收口径：每项都以「Agent 完成一次标准闭环（定位→读→改→激活→测试→传输）的调用次数 / token 消耗 / 失败恢复步骤数」衡量，配合 mock 集成测试（现有 21 项端到端用例扩展）。
