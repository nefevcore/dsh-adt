# dsh-adt 审核结果与修复计划

> 生成于本轮审核 session(代码快照:plugin 0.3.1 / 35 工具 / 152 测试全绿)。
> 供下一个修复 session 直接引用执行——本文档自包含,不依赖原会话上下文。
> 编号规则:**H/M/L** = 缺陷审核(安全与正确性);**D** = DSH 插件规范符合性偏差。
> 修复完成后请更新本文档各条目状态,并在文末"验证基线"重跑确认。
>
> **进度:P0 批次(H1、H2、H3、M2)已修复** —— 158/158 测试通过(152 基线 + 6 新增回归),`pnpm typecheck` 零错误。各条目下"修复实况"注明实现与用例位置。
> **进度:P1 批次(M1、M3、M5、M6、M7、D2、D4)已修复** —— 166/166 测试通过(再 +8 回归;cli.test 净持平:重写 2 个默认源用例、新增 stripPresetRows 用例),`pnpm typecheck` 零错误。D2 的本机预设重生成与 `standingKeyFor` 实门验证并入 D3(P2)一并执行——本机现行 abap-adt 行指向本地 bundle,重生成会回退该定制,须与 bundle 重建同批处置。
> **进度:P2 批次(M4、M8、M9、D1、D3+D2 收尾、文档同步)已修复** —— 170/170 测试通过(再 +4 回归)+ `pnpm smoke` 全绿;`pnpm bundle` 重建并通过产物冒烟(`plugin active: 35 tools registered`、`inject: ["tools"]`);本机预设已用新 CLI 重生成(standard 源、剔除行)并重应用本地 bundle 行,`standingKeyFor('abap-adt')` 实门通过。**重启 DSH 后本机 ABAP 会话即运行修复版**。
> **进度:P3 批次(各低危清理)已完成** —— **192/192 测试通过**(再 +22 回归)。四大主题全部落地:上下文截断上限(execute 20k / dumps raw 8k / datapreview 500 行 / read 200k / diff 20k)、工具层清理(write 死赋值、objects 列表 1..50 上界、gate 阶段 404/405 降级为 skipped、sql 400 归因收窄、adt_object_versions 挂 enableTransports、export 逐条降级)、CLI `--from` 校验(缺值/路径逃逸均报错)、协议+mock 低危杂项约 30 项(逐组注记见下)。遗留项在各组注记中标明。
> **进度:P3 补遗(用户复核)** —— 补录计划遗漏的 **D5a listDumps `$query` 用户过滤插值**(M3 同款白名单,fail-closed)+ **D5 状态注记与原子写落地**(persist 改 tmp+rename,账本不再可能因半截文件被整体清零;跨会话 last-write-wins 保留为文档化接受项)。**194/194 测试通过**(+1 client.test 白名单、+1 LockLedger 原子写),bundle 已重建。
> **✅ 审核关闭(独立复核确认)** —— P3 补遗两处经原审核方独立验证:① `client.ts` listDumps 白名单 `[A-Za-z0-9_.-]` fail-closed(代码实读 + `client.test.ts:358` 三类拒绝用例 + `integration.test.ts:548` 引号路径);② `locks.ts:111-117` tmp+rename 原子替换(`reload.test.ts:88` 无残 file/重载一致)。基线 **194/194 全绿**、typecheck 零错误、bundle(11:19)新于全部源码(11:17)。**本计划全部条目关闭;后续工作见 `docs/code-cleanup-plan.md`(代码精简,行为不变)。**

## 审核方法与基线

- 范围:`packages/dsh-plugin-abap-adt`(插件本体)、`packages/adt-protocol`(协议客户端)、`packages/adt-mock`(模拟服务器)、`presets/abap-adt.example`、`scripts/bundle.mjs`、CI、本机部署实态(`~/.dsh`)。
- 方法:人工逐文件审查 + 3 个独立子代理分包审查(protocol / mock / 工具层)+ 运行时实证(`agentPresets.standingKeyFor` 挂载校验、bundle 导入契约测试)。
- 基线:`pnpm typecheck` 通过;`pnpm test` **152/152 通过**;grep 确认 35 个 `adt_*` 工具;本机 web profile 全局层无 abap 行(合规)。

---

## 第一部分:缺陷审核

### 高危(建议最先修)

#### H1. `packageName` hint 可绕过 `allowedPackages` 白名单 【项目自评 P0-4,一直未修】✅ 已修复(P0 批次)
- 位置:`packages/dsh-plugin-abap-adt/src/resolve.ts:153` — `if (hint && hint.trim().length > 0) return hint.trim().toUpperCase();`
- 影响:调用方(即被策略约束的 Agent 本身)传 `packageName: "$TMP"` 即可让实际位于非白名单包的对象通过 `assertObjectEditable`(`src/tools/common.ts:135` 用 hint 优先于后端搜索事实)。波及 `adt_delete_object`(objects.ts:221-225)、`adt_activate`(lifecycle.ts:122-128)、`adt_write_structure`(structure.ts:288-292)、write/edit/push 的 hint 路径。
- 修法:hint 降级为"搜索失败时的兜底";或 hint 与后端精确命中的包名不一致时拒绝(warn + deny)。`docs/agent-usage-review.md` §P0-4 已写明方案。
- 验收:新增单测——对象实际在 `ZOTHER` 包、hint 传 `$TMP`、allowedPackages=`Z*,$TMP` → 必须 `[POLICY]` 拒绝。
- **修复实况**:`resolvePackageName` 解析顺序改为 **后端精确命中 packageName > hint > 失败关闭**;模糊命中的包名不再被采用(那是别的对象的属性,属于错误归因)。后端查不到时 hint 仍作兜底(新建对象搜索索引滞后的场景不受影响)。回归用例:`agent_tools.test.ts` "H1: a packageName hint cannot spoof the package policy"(allowedPackages=$TMP 拒绝 + allowTransportableEdits=false 拒绝,两路 `[POLICY]` 断言;ZPACK_DEMO 即验收场景中的真实包)。

#### H2. 变更类工具的模糊命中回退可改错对象 【项目自评 P0-1,一直未修】✅ 已修复(P0 批次)
- 位置:`packages/dsh-plugin-abap-adt/src/resolve.ts:115` — `const hit: AdtObjectSearchHit | undefined = exact ?? hits[0];`
- 影响:名字拼错(`ZCL_DEMO2` 不存在)时静默采用第一个模糊命中(`ZCL_DEMO`),write/edit/delete/push 随后作用于错误对象。且该错误对象无本地快照,OCC 冲突保护不生效。
- 修法:`resolveObject` 增加模式参数;变更类工具走 strict——无 `objectUri` 且搜索无精确命中时抛错并列出 top 候选(name/type/package),只读工具维持现状。
- 验收:单测——strict 模式下拼错名 + 存在模糊命中 → 报错列出候选而非解析成功。
- **修复实况**:`resolveObject`/`resolveObjects`/`resolveToolObject` 增加 `{ strict, toolName }` 选项;write/edit/push/delete/write_structure 与 **真实激活**(activate 非 checkOnly)走 strict——无 `objectUri` 且搜索无精确命中时抛错并列出 top 5 候选(name/type/package)或"无命中"提示,错误信息指明改传 `objectUri` 或精确 name+type。已知类型(name+type 走惯例 URI)与显式 `objectUri` 路径不变;只读工具(含 activate checkOnly)保持宽松回退。回归用例:`agent_tools.test.ts` "H2: mutating tools refuse fuzzy name resolution and list candidates instead"。

#### H3. AbortSignal 监听器泄漏(成功路径,注释与实现相反)✅ 已修复(P0 批次)
- 位置:`packages/adt-protocol/src/client.ts:295-301`。
- 问题:`signal.addEventListener('abort', ..., { once: true, signal: controller.signal })` 只在 controller 中止时移除监听;成功路径 `clearTimeout`(client.ts:329)后 controller 永不 abort,监听器**永久留在 caller signal 上**。DSH 会话级 signal 每请求累积一个监听器 + 闭包,Node 超 10 个告警 "Possible AbortSignal memory leak"。
- 修法:finally 中显式 `removeEventListener`,或 fetch 结束后无条件 `controller.abort()`(注意别影响已返回的 response 消费——推荐前者)。
- 验收:单测——同一 signal 发 N 个请求后 `signal.listenerCount('abort')` 不增长。
- **修复实况**:按推荐方案在 `finally` 中显式 `removeEventListener`(每 attempt 各自登记/拆除);与实现相反的旧注释一并改正。注:Node 24 的 `AbortSignal` 无 `listenerCount` 方法,验收等价实现为 `events.getEventListeners(signal, 'abort').length`。回归用例:新文件 `packages/adt-protocol/test/client.test.ts`(已加入根 `test` script)——25 次成功请求后监听数不增长、飞行中 abort 仍生效并清零监听、预中止 signal 不登记任何监听。

### 中危(安全)

#### M1. 绝对 URL 直通 + 无条件凭证(SSRF/凭证转发)✅ 已修复(P1 批次)
- 位置:`packages/adt-protocol/src/client.ts:223-226`(buildUrl 放行 `^https?://`)+ 277-283(无条件 `Authorization` + `Cookie`)。
- 影响:后端影响的 URI(版本 contentUri `client.ts:1206-1209`、被污染的搜索命中、公开的 `request()`)可把 Basic 凭据与会话 cookie 发往任意主机。重定向有 fetch 跨域剥离缓解,初始 URL 没有。
- 修法:origin 校验——绝对 URL 必须与 `destination.url` 同源,否则拒绝或降级为相对路径。
- **修复实况**:`buildUrl` 对绝对 URL 做 **origin 精确比对**(协议+主机+端口,`new URL().origin`;默认端口等价归一),不同源即抛 `AdtError`(fetch 发生之前,零请求零凭证外发);destination.url 本身非法 http(s) 时对绝对路径一律拒绝(fail-closed)。回归用例:`client.test.ts` "M1"(同源直通 + evil 域与同主机异端口拒绝 + 断言 wire 上从未出现非同源 URL)。

#### M2. `$batch` CRLF 头注入 + 禁止路径黑名单可绕过 ✅ 已修复(P0 批次)
- 位置:`packages/dsh-plugin-abap-adt/src/tools/batch.ts:40-44`(`validateBatchPart` 不剥 CR/LF)、`batch.ts:29-32`(FORBIDDEN_BATCH_PATHS 只拦 `/deletion/` 与 `/cts/transportrequests/<id>/release`)。
- 影响:`accept` 参数(**只读模式即可用**)注入 `application/xml\r\nX-Foo: bar` 可向 SAP 内嵌请求注入任意头;旧式删除拼写 `POST <uri>?_action=DELETE`(client.ts:1460 就在用)与 `%2F` 编码可绕过黑名单——与文件头"删除永远不可 batch"的意图不符。
- 修法:① `validateBatchPart` 剥离/拒绝 path、accept、contentType 中的控制字符;② 黑名单补充 `_action=DELETE`(query 形式)与 percent-decode 后再匹配;③ 黑名单匹配前先 decodeURIComponent。
- **修复实况**:① 拒绝(非剥离)path/accept/contentType 中的 C0+DEL 控制字符(`[\u0000-\u001F\u007F]`,fail-closed);② 新增黑名单 `[?&]_action=delete(?:&|$)`(旧式删除 query 拼写);③ 黑名单对 path 的**原始形态 + 逐轮 percent-decode 形态(≤3 轮,含双重编码)逐一匹配**。顺带:method 先规范化再进写开关判断(小写 `get` 不再误触 `allowBatchWrites` 断言;工具 schema 的 enum 本就在边界拦截,此为纵深防御)。回归用例:`agent_tools.test.ts` "M2: $batch rejects CRLF header injection and encoded forbidden paths"(accept/path/contentType 注入、明文与编码的 `_action=DELETE`、`%2F` 与 `%252F` 编码的 release 路径)。

#### M3. SQL 插值 + freestyle SQL 无门控 ✅ 已修复(P1 批次)
- 位置:`packages/adt-protocol/src/client.ts:1162` — `` `SELECT * FROM ${name} UP TO ${top} ROWS` ``(实体预览回退路径,主路径有 encodeURIComponent 此路径没有);`packages/dsh-plugin-abap-adt/src/tools/datapreview.ts:146`(`sql` 原样下发,无 SELECT-only 预检、不受 `allowExecution` 门控)。
- 修法:`name` 做 `/^[A-Z0-9_\/]+$/i` 白名单校验后再拼接;工具层可加轻量 SELECT-only lint(拒绝非 SELECT 起头)。是否挂 `allowExecution` 开关可讨论(数据预览是只读能力,但 WHERE/JOIN 走私面存在)。
- **修复实况**:① 协议层 dataPreview 回退前对 `name` 做 `/^[A-Za-z0-9_/]+$/` 白名单,不过即抛 `AdtError`;② 工具层 `adt_data_preview` 的 `sql` 参数加 SELECT-only lint(`/^\s*select[\s(]/i`,非 SELECT 起头即拒,描述同步注明);③ **决策:不挂 `allowExecution` 门控**(数据预览为只读能力,SELECT lint 已封写面走私,后端 datapreview 服务本身只读),如需收紧留给后续讨论。回归用例:`client.test.ts` "M3"(SQL 回退拒绝 `t001; DROP TABLE`、`t001' OR '1'='1`,纯 DDIC 名不误伤)、`agent_tools.test.ts` "M3"(DELETE/UPDATE/GRANT 拒绝,SELECT 正常执行)。

#### M4. 结构化编辑器 regex 注入(静默数据损坏)✅ 已修复(P2 批次)
- 位置:`packages/adt-protocol/src/structure.ts:214、227-228、258、290-293、408-410` — 属性键/标签类型直接拼进 `new RegExp(...)`,所用 `escape()` 是 XML 转义不是 regex 转义。
- 影响:键名含 `.*` 或 `(` 时改错目标或抛错。
- 修法:拼进 RegExp 前做 regex 转义(`s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`)。
- **修复实况**:新增 `escapeRegExp()` 并应用于全部 6 处插值点(patchRootAttribute / elementRange open+close / patchElementText / removeAllElements / patchLabel——原 patchLabel 用的是 XML `escape()`)。**顺带发现并修复同族陈年 bug**:前缀捕获组 `((?:[\w.-]+):)` 本就含冒号,代码又追加一个 → 替换路径一直产出 `<doma::length>` 双冒号元素(解析器宽容所以往返测试从未察觉,但损坏 XML 会被 PUT 给真实后端);`patchElementText` 与 `patchLabel` 两处已改为直接使用捕获组。回归用例:`client.test.ts` "M4"(`sho.rtText` 不再误改 shortText、`sho(rtText` 不再抛 SyntaxError、合法键照常打补丁、`::` 双冒号零出现——DOMA length 往返同时覆盖)。

### 中危(正确性)

#### M5. demo 模式与 `ADT_MOCK_USER/PASSWORD` 环境变量脱节 ✅ 已修复(P1 批次)
- 位置:`packages/dsh-plugin-abap-adt/src/registry.ts:98-99、111-112`(mock 服务器用环境变量凭证)vs `registry.ts:129、136-137`(demo 客户端硬编码 `demo/demo`)。
- 影响:用户一设这些变量,demo 目的地全部 401。
- 修法:demo 客户端使用同一环境变量(缺省回落 demo/demo);或插件内不向 mock 传环境变量凭证(那对变量留给独立 mock CLI)。
- **修复实况**:按方案①——`startMock` 顶部一次性解析凭证对(`ADT_MOCK_USER || 'demo'` / `ADT_MOCK_PASSWORD || 'demo'`),mock 服务器与 demo destination/client **两侧共用同一对**,环境变量覆盖永不脱钩。回归用例:`reload.test.ts` "M5"(设 alice/wonderland 后 demo 客户端读取 ZCL_DEMO 成功,不再 401)。

#### M6. `adt_write_structure` 的锁对持久账本不可见 ✅ 已修复(P1 批次)
- 位置:`packages/dsh-plugin-abap-adt/src/tools/structure.ts:327` — 锁在协议客户端内部(`client.ts:1678` lock → 1706-1710 finally unlock),从未 `ledger.register`。
- 影响:崩溃残留的 EU510 锁 `adt_unlock_all` 无法发现——恰是账本要解决的场景。对照正确做法:`write.ts:677-682`。
- 修法:协议层 `writeStructure` 暴露 `onLocked(handle, transport)`(已有 `onLocked(assigned)` 钩子,扩展为带 handle),插件层 register/deregister。
- **修复实况**:① 协议层 `onLocked(assignedTransport, lockHandle)` 双参;`AdtStructureWriteResult` 新增 `unlocked?: boolean`(finally 解锁结果如实上报,失败不再被吞)。② 插件层 `onLocked` 先 `assertTransportUsage` 再 `ledger.register`(带 handle/transport,note='write_structure lock');成功且 `unlocked !== false` 时 `ledger.deregister`,错误路径与解锁失败保留条目(安全方向,交给 `adt_unlock_all` 兜底)。回归用例:`agent_tools.test.ts` "M6"(spy 账本断言 register(handle)→deregister 精确序列;真实账本干净写后无残留;策略违规时断言先于登记、锁被协议回滚、账本零条目)。

#### M7. `adt_create_object` 不校验后端自动分配的传输号 ✅ 已修复(P1 批次)
- 位置:`packages/dsh-plugin-abap-adt/src/tools/objects.ts:151`(`lock()` 返回的 transport 被丢弃);`packages/adt-protocol/src/client.ts:1410-1414`(createObject 也不读 CORRNR)。
- 影响:省略 `transport` 时后端可把新对象记入 `allowedTransports` 白名单外的请求,无断言无回退——与 `policy.ts` 头注释的承诺不符(write_structure 经 `onLocked`→`assertTransportUsage` 有此保护,create 没有)。
- 修法:createObject 解析响应中的 CORRNR 并返回;工具层过 `assertTransportUsage`,不匹配则删除已建对象并报错(或至少拒绝并提示)。
- **修复实况**:① 协议层 `createObject` 从响应解析 CORRNR(属性 `adtcore:corrNr="…"` 与元素 `<transportNumber>/<corrNr>/<trkorr>` 两种拼写),`AdtCreateObjectResult` 新增 `transport`(显式传入优先)。② 工具层对 `lock 返回的 CORRNR ?? 响应 CORRNR ?? 显式 transport` 跑 `assertTransportUsage`;违规即**回滚:登记账本(handle 备查)→ 尽力 deleteObject → 在原 AdtPolicyError 消息上追加清理结果**后抛出。③ mock 保真度配套:create 端点尊重 corrNr 参数、非 $TMP 包自动分配 MOCKK 任务并写入响应(`objectRefXml` 带 `adtcore:corrNr`);lock 仅对非 $TMP 对象编造并**持久化** CORRNR($TMP 恒空)——对齐真实后端"对象归属请求"模型。回归用例:`client.test.ts` "M7"(属性/元素拼写解析、显式 transport 优先)、`agent_tools.test.ts` "M7"(allowedTransports=S4HK* 时 MOCKK 自动分配被 `[POLICY]` 拒绝且对象确已删除;显式允许号通过;$TMP 无传输;默认策略正常)。

#### M8. 请求超时只覆盖响应头不覆盖 body ✅ 已修复(P2 批次)
- 位置:`packages/adt-protocol/src/client.ts:335、355` — `response.text()` 在 `finally { clearTimeout(timer) }` 之后执行。
- 影响:慢速 body 可拖到 undici 默认 300s bodyTimeout,无视 `timeoutMs`;所有轮询循环与 `discover()` 受影响。
- 修法:把 body 读取纳入同一 AbortController 时窗(先 `clearTimeout` 前读取,或读取时再挂一个同超时的 controller)。
- **修复实况**:按"同一时窗"方案——timer 与 caller-signal 链接**保持武装直到 body 消费完毕**(统一 `cleanup()` 在 body 读取的 finally、错误路径与 CSRF 重试 continue 前执行)。语义微调:成功路径 body 读取失败(含超时)现在**如实抛错**(原先 `.catch(() => '')` 会把 200 + 网络中断静默成空源——与低危项"readSource 404 变空源"同族的静默面);错误路径 body 读取失败仍降级为空错误体(HTTP 状态是更有用的信号)。回归用例:`client.test.ts` "M8"(headers 即回、body 永不 settle → 40ms 后 `timed out after 40 ms … response body`,不再挂 300s)。

#### M9. 导出命名空间对象逃出 targetDir ✅ 已修复(P2 批次)
- 位置:`packages/dsh-plugin-abap-adt/src/tools/batch.ts:76`(exportFileName 用 `ref.name` 原样)+ 330(`fs.resolve(fileName, { cwd: targetDir })`)。
- 影响:`/NS/ZCL_X` 生成前导 `/` 的文件名,按绝对路径解析,写出导出目录(沙箱策略可能兜住,但目标本身错了)。
- 修法:文件名消毒——`/` → `_`(或 URL 编码);顺带修 `files[].path` 只报裸文件名不报解析路径的问题。
- **修复实况**:`exportFileName` 对对象名做 `[^A-Za-z0-9._-]+ → '_'` 消毒(`/NS/ZCL_X` → `_NS_ZCL_X.clas.abap`,普通名不受影响,全异常字符回落 `object`);`files[].path` 改报 **fs 解析后的 `displayPath`**(绝对/工作区相对由后端决定),`name` 仍为消毒后文件名。回归用例:`agent_tools.test.ts` "M9"(mock 建 `/NS/ZCL_DEMO` 后导出:文件名消毒、路径在 targetDir 内、内容确实写到该路径;普通名 `ZCL_DEMO.clas.abap` 同步断言解析路径)。

### 低危(择要,按包分组)

**adt-protocol / client.ts** ✅ P3 已修(除注明的 3 项):357 unreachable CSRF-exhausted throw(保留为类型收尾,不可达路径,配合 341-346 的掩盖修复已无害);~~341-346 重试 ensureCsrfToken 抛错掩盖原始 401/403~~(已修:刷新失败组合进原始状态错误);~~1756-1776 sleep() 用原始 DOMException 拒绝~~(已修:恒以 AdtError 拒绝);~~393-399 discover 不带 sap-client~~(已修:baseQuery 随行);~~574-592+2051-2063 readSource 裸 URI 回退可把 404 变空源成功~~(已修:裸 URI 回退仅接受含 code 节点的响应,否则按失败处理);~~2332/2343/2373 extractRunId 可捕获十六进制主机名片段~~(已修:UUID 优先 → 16+ hex → 带词边界守卫的兜底);~~1637 boundary 正则不认引号~~(已修:`boundary="?…"?`);~~604-609 writeSource 对已含 `?` 的 URI 拼出双 `?`~~(已修:拆分既有 query 合并);~~1937 TABL/DTEL/TTYP/MSAG/DEVC 默认创建命名空间错误~~(已修:未知类型不再重复声明 `xmlns:adtcore` 到伪造 URI);~~types.ts:448 PACK 枚举无端点必失败~~(已删,包创建走 DEVC);~~1415-1420 createObject 200 内错误信封被忽略~~(已修:200+E/A 消息 → success:false + messages);~~2242+2265 parseActivationResult 全局 E 消息把所有对象标 ERROR~~(已修:对象自身 status/消息优先,全局 E 只影响无自报对象);~~1242-1243/1284-1286 getObjectLock 吞掉非 AdtError~~(已修:非 AdtError 转为 note 返回;探测路径感知 caller abort);~~cookie jar 无过期处理~~(已修:解析 Max-Age/Expires,过期即弃);~~219 destination.url 不校验 http(s)~~(已修:构造器 fail-fast);~~186 normalizeUri 前缀误判~~(已修:`/sap/bc/adt` 段边界判定)。**遗留**:sleep 的调用方契约已对齐但 `sleep` 未单测;`atc_runs` 列表仍无分页(低价值,留待需要时加)。

**adt-protocol / xml.ts** ✅ P3 全修:~~189-197 越界码点 fromCodePoint 抛 RangeError~~(已修:非法码点降级 U+FFFD,合法范围精确放行);~~79-158 递归深度无上限~~(已修:MAX_DEPTH=500 明确报错);~~60-69 DOCTYPE 扫描不认引号~~(已修:引号内 `>` 不终止扫描)。用例:`xml.test.ts` 三条新回归。

**adt-protocol / structure.ts** ✅ P3 已修:~~314-337 MSAG 补丁 `<mc:deletedmessages>` 无法被 removeAllElements 匹配~~(已修:写入前同时清除 `messages` 与 `deletedmessages` 两种块,陈年删除块不再残留合并)。用例:`client.test.ts` "MSAG patches never leave stale deletedmessages blocks"。

**插件工具层** ✅ P3 已修(除注明的 3 项):~~write.ts:726 catch 路径 unlocked = true 死赋值~~(已删);~~common.ts:45 OBJECTS_PARAM 无 maxItems~~(已修:`requireObjectList` 强制 1..50,空列表报错,activate/check/unit/atc 四处接入);上下文炸弹全部设限——~~execute.ts:74 程序输出无截断~~(20k + `outputTruncated`)、~~dumps.ts:184 ST22 raw 整传~~(8k + `rawTruncated`)、~~datapreview.ts:139 行上限 5000~~(降为 500)、~~read.ts 全量读无字符上限~~(200k + note 指引窗口读)、~~versions.ts 完全分叉 diff 双侧全文~~(20k + note);~~gate.ts:116 单阶段 404/405 裸错~~(已修:阶段降级为 `skipped`,不否决 verdict,渲染标 SKIPPED);~~batch.ts:317-319 export 先全量解析再 slice~~(已修:逐条解析+读取,坏条目自身 FAILED,其余照常导出;files[].path 已随 M9 修);~~datapreview.ts:124 sql 模式任意 400 误归因 mandt~~(已修:仅后端消息匹配 mandt/cross-client 时才改写);~~transports.ts:55-81 adt_object_versions 无门控~~(已修:`assertTransportsEnabled`);~~batch.ts:166 小写 method~~(已随 P0/M2 修复)。**遗留**:execute 的 20k 截断与 read 的 200k 截断因 mock 无巨型载荷未加专测(逻辑为纯截断+note);atc_runs 列表无分页(同上)。

**cli.ts** ✅ P3 部分修:~~149-151 `--from` 缺值静默回落~~(已修:缺值/非 `[a-z0-9][a-z0-9-]*` 一律报错)~~214 `--from ../..` 可逃出官方预设目录~~(已随同一条 id 正则修复)。**遗留**:`--force` 整目录替换仍只提醒 abap-adt 行定制(其余手工定制无提醒、无备份——预设本就是生成物,重新生成语义如此,接受现状)。

**adt-mock(保真度)** ✅ P3 已修(除注明的 4 项):~~server.ts:781 锁竞争盲视~~(已修:他人锁 → 403,自己重锁可刷新);~~790 unlock 不校验 handle~~(已修:错误 handle → 403,无 handle 清理路径保留);~~966-974 未知 Unit run id 伪造绿灯~~(已修:status/result 均按 404);~~1139/1143 ATC URI 对 PROG 硬编码 /oo/classes/~~(已修:按对象类型生成 URI);~~690-707 传输 release 无方法守卫~~(已修:非 POST → 405);~~多处读端点不校验方法~~(已修:discovery/search/where-used/datapreview×2/nodestructure/transports 列表均限 GET);~~458 dumps $query 引号值过滤失效~~(已修:剥引号后比对);~~379 maxResults 无 NaN 守卫~~(已修:非正有限数回落默认 25);~~readBody 无上限~~(已修:1MB,超限 413);~~close() 吞错不 closeAllConnections~~(已修:closeAllConnections + 错误上抛,调用方均已 .catch)。安全项:~~CORS 加开关或文档明示~~(已做:`cors` 选项 + CLI `ADT_MOCK_CORS=0` + MockAdtOptions 安全注释;默认仍开以兼容 demo 用法)。~~EADDRINUSE 使 CLI 裸崩~~(已修:友好报错 + 指引换端口)。**遗留**:结构化 PUT 查锁而 /source/main PUT 不查(刻意保留——$batch 内嵌写与既有流程不带 handle,收紧会破坏;真后端经 stateful 会话另有语义);sessions/unitRuns/atcRunIds 单调增长(进程内测试服务器生命周期,无泄漏后果);畸形 XML 静默存为源码(低价值);880 行 handle 函数拆路由表(重构非缺陷)。

**文档漂移** ~~`docs/architecture.md`(写"30 × 工具"、引用已废弃的 `cordis.patch.yml`);`.github/workflows/publish.yml`(注释"141 例",实际 152);`scripts/bundle.mjs:7`(指导指向 `cordis.patch.yml`,应为预设行)~~ **已随 P2/文档同步修复**:architecture.md 改 35 工具、预设行启用机制、H1 后的包名解析顺序与 strict 解析、可选 fs 措辞;publish.yml 注释去掉硬编码用例数;bundle.mjs 注释指向预设行。

---

## 第二部分:DSH 插件规范符合性审核

依据技能 `cordis-plugin-development` 与 `editing-cordis-compositions`。

### 符合项(修复时**不要破坏**)

| 规范 | 实现 |
|---|---|
| 不发布 Cordis 服务 → 预设行可裸放,无需 isolate realm | 全库无 `ctx.provide`/`Service` 子类,只消费 |
| 可选服务 `ctx.get` + 缺失处理 | `ctx.get('sandboxPolicy')`(batch.ts:299)教科书式 |
| 副作用随 fiber 回收 | apply 返回 disposer;tools.register 与 settings 注册均 fiber 域 |
| 活数据纪律 | 工具输出全为自有 JSON + `deepCompact` 边界;无活对象序列化 |
| Host-only 平面选择 | 无 UI 需求;工具卡走 dsh-tools render;`isConcurrencySafe` 按只读声明 |
| 预设结构 | 目录 + agent.cordis.yml + preset.yml(name+description),skills 随目录复制 |
| 复制官方而非改官方 | CLI 只读 config/agent-presets,只写用户根;id 正则防穿越 |
| settings 命名空间与脱敏 | `abap-adt` kebab-case;password `role('secret')`;`installSettingsSection` 用法与 dsh-settings 契约逐字一致 |
| 全局层干净 | 不声明 `dsh.bundle`;web profile cordis.yml 无 abap 行;仅预设会话加载 |
| 工具加载契约 | 实测 bundle 导入:name/inject/apply/Config 完整 |

### 偏差项

#### D1【中】`fs` 硬 inject 与"精简 profile 降级"承诺矛盾 ✅ 已修复(P2 批次)
- 位置:`packages/dsh-plugin-abap-adt/src/index.ts:42` — `inject: ['tools', 'fs']`。
- 问题:无 dsh-fs 的 profile 上该行永远 waiting,35 个工具全不可用(含不需 fs 的纯只读工具);README 却声称精简 profile 自动降级(settings 确实可选,fs 是硬门)。代码里遍布 `if (!ctx.fs)` 防御分支——硬 inject 下是死代码,暴露意图与声明不一致。技能规范:"不要仅为避免 undefined 检查而滥用 inject"。
- 修法(二选一):① 改 `ctx.get('fs')` 让降级真实成立(防御分支已写好,read 快照/export/push 会优雅降级);② 保留硬依赖,修正 README 措辞并删除死分支。**推荐 ①**。
- **修复实况**:按方案①——`inject` 收窄为 `['tools']`(fs 不再阻塞插件加载);全部 `ctx.fs` / `ctx?.fs` 读取点(snapshots.ts 的 load/save、read.ts 快照、write.ts sourceFile/持久化校验/push、batch.ts export、local.ts 本地检查)改为**逐调用 `ctx.get('fs')`** 并处理缺失——防御分支从死代码变为真实降级路径;`dsh.d.ts` 注释同步(类型声明保留,使 `ctx.get('fs')` 有类型);README 降级条款补充 fs 语义;`scripts/smoke-tools.mjs` 的 ctx 假件同步。bundle 产物实测 `inject: ["tools"]`。回归用例:`agent_tools.test.ts` "D1"(无 fs 时 read 正常且 `localCopy` 缺席、export/push 明确报"requires the dsh filesystem service");D4 用例中的 `apply()` 同时证明无 fs 服务时 35 工具照常注册。

#### D2【中】生成器默认拷贝部署默认预设(本机=cordis),拖入插件创作工具集,且无法通过规定验收门 ✅ 已修复(P1 批次,代码侧;本机重生成并入 D3)
- 位置:`packages/dsh-plugin-abap-adt/src/cli.ts:201`(`--from` 缺省取 `agent-presets.default`)。
- 运行时实证(本机,`standingKeyFor` 三组对照):
  - `standingKeyFor('abap-adt')` → **失败**:`tool-cordis: Host Cordis inspect provider "Service" is already registered`(与活动 cordis 会话撞名);
  - `standingKeyFor('cordis')`(官方源)→ 通过;`standingKeyFor('anchored-standard')`(standard 拷贝,无 tool-cordis)→ 通过;
  - 两份组合文件 tool-cordis 行**逐字相同** → 差异在挂载机制:拷贝进新 scope 后 inspect provider 注册冲突。
- 影响:(a) 每个 ABAP 会话额外获得 cordis_* 动态插件工具与插件创作技能——扩大信任面;(b) `editing-cordis-compositions` 把 `standingKeyFor` 定为预设最终验收门,此预设形状不可通过;技能指明 "`standard` is the usual source"。
- 修法(任选):① 默认 `--from standard`;② 生成时剔除 `tool-cordis` 与 `skill-filesystem` 行(ABAP 会话用不上插件创作工具);③ 至少在 README/CLI 输出文档化此限制。**推荐 ①+②**。
- **修复实况**:①+② 落地——`defaultSourcePresetId()` 恒返回 `standard`(不再读 settings.yaml 的部署默认,杜绝本机 cordis 场景);新增 `stripPresetRows()` 在生成时**外科手术式剔除**顶层 `tool-cordis` 与 `skill-filesystem` 行(只动顶层行+其缩进续行,注释与嵌套行保留,幂等;`--from cordis` 显式覆盖时同样剔除,保证任何来源都可过 standing-mount 门);CLI 头注释/help/输出同步更新并报告剔除清单。回归用例:`cli.test.ts` "defaultSourcePresetId"(恒 standard)、"stripPresetRows"(剔除含续行、嵌套不动、幂等、`tool-cordis-extra` 不误伤)、"main: generates from standard by default…"(默认源 standard + skill-filesystem 被剔除 + `--from cordis` 时两行剔除)。**本机收尾已随 P2/D3 完成**——用仓库新 CLI 重生成预设(源 standard、剔除 skill-filesystem)、重应用本地 bundle 行定制,`standingKeyFor('abap-adt')` 实门验证通过(见 D3)。

#### D3【中·本机运维】部署漂移(含 D2 的本机重生成 + 实门验证)✅ 已完成(P2 批次)
- 本机 `~/.dsh/.agent-presets/abap-adt/agent.cordis.yml` 的 abap-adt 行指向本地 bundle(v0.3.0、29 工具、当日 10:28 构建),源码 15:00 后又改、仓库现为 0.3.1/35 工具——**当前机器 ABAP 会话跑的是过期代码**。
- 处置:`pnpm bundle` 重建后重启 DSH;或把 `name` 改回 `@nefevcore/abap-adt-dsh-plugin`(npm 版)。
- **P1 后补充**:修复批次已改源码(P0+P1),本机 bundle 落后更多;执行本项时应顺带完成 D2 收尾——用新生成器重生成预设(`dsh plugin --profile web exec abap-adt-preset --force`,默认源 standard、剔除 tool-cordis/skill-filesystem)并重应用本地 bundle 行定制(或改用 npm 名),然后在有活动 cordis 会话的 host 里 `standingKeyFor('abap-adt')` 验证通过。
- **执行实况(P2,按方案 A 本地 bundle)**:① `pnpm bundle` 重建(含 P0+P1+P2 全部修复),bundle 冒烟:导出契约完整(Config/apply/inject/name)、`inject: ["tools"]`(D1 可见于产物)、**`plugin active: 35 tools registered`** 且全部 `adt_*`。② 用仓库 CLI(`node packages/dsh-plugin-abap-adt/lib/cli.js --force`)重生成预设:源 `standard`、剔除 `skill-filesystem`、定制提醒如实输出;行内不再有 `tool-cordis`/`skill-filesystem`,skills 目录为空(两个插件创作技能只随 cordis 预设走,standard 本就不带)。③ 重应用本地 bundle 行定制并在行上方注释说明再生成时的注意点。④ **实门验证通过**:动态插件探针 `inject: ['agentPresets']` → `standingKeyFor('abap-adt')` 在本 host(存在活动 cordis 会话)上正常返回,无 inspect provider 冲突——即 D2 验收门。**待用户动作:重启 DSH 后 ABAP 会话即跑上 0.3.1+ 修复版(35 工具)**;npm 发版后可把行名换回 `@nefevcore/abap-adt-dsh-plugin`。

#### D4【低】dispose 后排队 rebuild 可复活已处置 registry ✅ 已修复(P1 批次)
- 位置:`packages/dsh-plugin-abap-adt/src/index.ts:107-109` — settings `onChange → void rebuild()`,rebuild 链为排队 Promise。
- 问题:卸载与变更竞争时,`registry.reload()` 在已 dispose 的 registry 上**重启 demo mock**,无 disposer 管辖(泄漏监听器直至进程退出)。
- 修法:disposed 标志守卫(dispose 置位,rebuild 开头检查)。
- **修复实况**:双保险——① `disposed` 标志:disposer **先同步置位**再 await `rebuildChain`(排队中的 rebuild 任务开头检查即跳过,同步置位保证任何后排微任务都能看到);随后才 `registry.dispose()`。② disposer 变为 async 并等待在飞的 rebuild 结束后再拆除,彻底封死"reload 与 dispose 交错"。回归用例:`reload.test.ts` "D4"(fake ctx 驱动 apply():settings attach 的 rebuild#1、demo 翻转的 rebuild#2、卸载后迟到变更 rebuild#3 全部不得产生任何 `config applied` 日志/registry 复活)。

#### D5【低】跨会话共享文件无并发保护 ✅ 部分修复(P3 补遗:原子写已落地;last-write-wins 保留为已文档化的接受项)
- 锁账本 `~/.dsh/storages/abap-adt-locks.json` 多会话并发写 last-write-wins(丢条目);`.adt-snapshots/` 共享工作区 + 同目的地时同样竞争(失败方向安全:伪 [CONFLICT] 而非静默覆盖)。
- 修法(可选):账本写入走原子写(tmp+rename,已有);或接受现状并文档化。
- **P3 补遗实况**:① `persist()` 已改为 **tmp + rename 原子替换**——原先裸 `writeFileSync` 在崩溃时可留下半截文件,下次加载 `JSON.parse` 失败会把整个账本静默清零(比丢条目更糟)。用例:`reload.test.ts` "LockLedger: persist is atomic …"(JSON 完整、无 `.tmp` 残留、重载一致)。② 跨会话 last-write-wins 丢条目**保留为接受项**:多 DSH 会话并发写同一账本的窗口极窄,丢失方向是"少一个可清理条目"(residual 锁需 SM12 手工处理),不影响正确性;真正的修复需要文件锁或单写者进程,收益不成比例。`.adt-snapshots/` 竞争维持现状(失败方向安全,见上)。

#### D5a【低·计划遗漏补录】listDumps 用户过滤原样插值进 `$query` 表达式 ✅ 已修复(P3 补遗)
- 位置:`packages/adt-protocol/src/client.ts` listDumps — `` `and( equals( user, ${options.user.trim()} ) )` ``。原审查报告有此条,整合进本文档时遗漏,致 P3 首轮未修(计划维护者的责任,已补录)。
- 影响:含 `)` / `,` / 引号的用户值可改变过滤谓词;只读、低危。
- **修复实况**:与 M3 同款 fail-closed 白名单——用户名仅允许 `[A-Za-z0-9_.-]`,否则抛 `AdtError`(保持实地验证过的**不带引号**线上格式,白名单后该值不可能携带表达式元字符)。用例:`client.test.ts` "listDumps user filter is whitelisted"(`)`/`,`/引号拒绝、纯用户名照常构造)、`integration.test.ts` 引号 `$query` 直连端点验证 mock 引号剥离保真 + 客户端侧拒绝。

#### D6【低】`scripts/bundle.mjs:7` 注释仍指 `cordis.patch.yml`(0.1.0 时代机制,现应指向预设行)。✅ 已修复(P2 批次,注释改为指向预设行插件行 `name`)

**信息项**:CLI 用 `cpSync` 而非 `agentPresets.copy()` —— CLI 是进程外 bin,服务不可达;自建复制实现了 copy() 的关键保证(id 校验、preset.yml 重写),合理。协议客户端库内原生 setTimeout/fetch 不受 timer 服务纪律约束(该纪律针对插件层 Cordis 代码)。

---

## 第三部分:修复计划(建议顺序)

| 批次 | 条目 | 说明 |
|---|---|---|
| **P0 立即** ✅ 已完成 | H1、H2、H3、M2 | 三个策略/资源高危 + batch 注入。均为小改动,可各补单测 |
| **P1 短期** ✅ 已完成 | M1、M3、M5、M6、M7、D2、D4 | 凭证转发、SQL 白名单、demo 凭证联动、锁账本覆盖 create/write_structure、生成器默认源 |
| **P2 择机** ✅ 已完成 | M4、M8、M9、D1、D3、文档同步 | regex 转义(连带双冒号陈年 bug)、body 超时、导出路径消毒、fs 改可选、重建 bundle + 预设重生成 + standingKeyFor 实门通过、architecture.md/publish.yml/bundle.mjs 同步 |
| **P3 清理** ✅ 已完成 | 各低危 | 上下文截断上限(五处)、工具层清理(六项)、cli --from 校验、协议+mock 低危杂项约 30 项;遗留项见各组注记 |

### 每批验收

1. `pnpm typecheck` 零错误;`pnpm test` 全绿(基线 152,修复应伴随新增回归用例,数量只增不减)。**P0 后 158/158;P1 后 166/166;P2 后 170/170;P3 后 192/192;P3 补遗后 194/194**(+3 `xml.test.ts`、+8 `client.test.ts` P3 组(含 listDumps 白名单)、+7 `integration.test.ts`(mock)、+4 `agent_tools.test.ts` P3 组、+1 `gate.test.ts` skipped 语义、+1 `reload.test.ts` LockLedger 原子写;cli/gate 断言加固)。`pnpm smoke` 全绿。
2. P0/P1 涉及策略的条目:在 `test/policy.test.ts` / `test/agent_tools.test.ts` 补对应用例。(P0 的 H1/H2/M2 用例均在 `agent_tools.test.ts`;H3/M1/M3/M4/M7-协议/M8 为协议层,在 `adt-protocol/test/client.test.ts`。)
3. D2 完成后:重新生成预设(`dsh plugin --profile web exec abap-adt-preset --force`)并在**存在活动 cordis 会话的 host** 里 `standingKeyFor('abap-adt')` 应通过(或按所选方案不再包含 tool-cordis 行)。✅ **P2 已验证**:新 CLI 重生成(源 standard、剔除行、重应用本地 bundle 行),动态插件探针 `standingKeyFor('abap-adt')` 在本 host 正常返回。
4. D3:重建 bundle 后确认预设行加载的版本号 = 包版本(日志 `plugin active: 35 tools registered`)。✅ **P2 已验证**:bundle 冒烟输出 `inject: ["tools"]` 与 `plugin active: 35 tools registered`(全部 adt_*);**用户重启 DSH 后生效**。

### 值得保持的设计(修复时勿动)

按目的地策略叠加 + 调用时读取(热 reload 即时生效);OCC 快照哈希 + 持锁校验 + 写后持久性验证;跨会话持久锁账本 + `adt_unlock_all`;`adt_batch` 默认 GET-only 双开关;传输释放刻意不暴露;`deepCompact` 注册边界;404/405 降级带替代动作的错误文案;mock 的 127.0.0.1 默认绑定与 EADDRINUSE 随机端口回退;npm Trusted Publishing CI。
