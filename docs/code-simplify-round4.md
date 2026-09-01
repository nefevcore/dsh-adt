# dsh-adt 代码精简第 4 轮（全仓审查）✅

> 基线：workspace-layer 未提交改动树（237/237 绿，round 3 后新增 probe/workspace 测试）。
> 方法：机械扫描（`node .research/scan-cleanup.mjs`）+ 3 并发子代理分包审查
> （adt-protocol / 插件核心 / 插件 tools，重点覆盖未提交的 destinations+413、
> workspace+197、probe 新文件）+ 主会话自营 adt-mock 与 scripts。
> 收尾验证：`pnpm typecheck` 零错误、`pnpm test` **237/237（数量不减）**、
> `pnpm smoke` + smoke_plugin + smoke_settings + smoke_cancellation 全绿、
> `pnpm bundle` 重建且产物契约 `abap-adt ["tools"]`（apply/Config 完整）。

## 本轮判例（下轮直接援引）

1. **导出函数签名引用的类型不可收 export**：`declaration: true` 下，出现在任何导出
   函数签名（参数/返回类型）里的接口/类型别名，取消导出即 TS4060。机械扫描的
   "死导出"候选必须先过这一关——本轮因此**驳回** ProbeOptions、AtcFindingOutput、
   GateStage(Result)、CheckSeverity、LocalCheckOptions(Result)、DiffOp、
   ReplaceBlockOptions(Result) 九个；真收的只有纯函数体引用的三个
   （MAX_OBJECT_LIST、objectRefArgs、fsReaderFromCtx）。扫描器对 `export type *`
   星号再导出同样失明：adt-protocol/types.ts 六个候选全是发布包公共 API。
2. **路由表与 handler 的正则必须共享 const**：handler 里 `match![1]!` 非空断言的
   前提是两处正则永不漂移——这是 bug 藏身处，不是风格问题（round 3 判例的完成：
   剩余 9 组正则全部并源，含 datapreview/dump/programrun/classrun/unit/atc）。
3. **类型谓词代替布尔 helper**：`isAdtServiceUnavailable(error): error is AdtError`
   让 7 个调用点的补救消息仍能引用 `error.status`——收窄跟着谓词走，不需要
   调用方再 instanceof。structure.ts 的 406 变体语义不同，保持自有判断。
4. **schema 共享判例的门槛是 ≥5 行**：字节级相同且 ≥5 行的 schema 块才提共享
   const（本轮：ACTIVATE_AFTER_WRITE_PARAM、TRANSPORT_META_PROPERTIES、
   VERSION_FEED_META_PROPERTIES、PROBE_TIMEOUT_MS_PARAM）；3 行以下的
   atc_runs 元字段三连不提——const 声明本身就要 3 行，零净收益纯增间接。
5. **恒真守卫按调用链求证后删**：renderWorkspaceConfig 的 `record[key] !== undefined`
   在唯一调用链（write → toPlainConfig 双 JSON 往返）下恒真，删并留一行注释说明
   前提。判死依据是调用链事实，不是直觉。
6. **contextual typing 是行为的一部分（类型层）**：datapreview 的输出字面量从
   内联改为 helper 后失去上下文类型，泛型 `ReturnType<typeof pageRows>` 推成
   unknown[] 直接 TS2719——提取输出映射时参数类型必须显式钉死
   （`AdtDataPreview['rows']`），不能靠推断。

## 明确不做 / 遗留清单（下轮输入，带位置）

- **渲染不一致（需带断言置换，round 3 遗留延续）**：`tools/atc_runs.ts` 手搓
  ` — P1 …` 后缀应走 `atcAggregatesSuffix`；`tools/transports.ts` 列表行无
  description、详情行有且缺省时挂空 ` — `。零行为轮不做。
- **presentationMeta/presentResult 接缝零测试覆盖**：测试套件不碰该接缝；
  smoke_plugin.mjs 修剪后只覆盖 search/read 两工具的演示卡。补测试属功能轮。
- **policy 六开关表驱动**（round 3 判例延续）：resolve 级 env 非法值→source 保持
  'default' 的路径仍无测试（本轮子代理复查确认），显式写法继续可辩护。
- **behavior 观察（非精简项）**：client.ts metadataAccept FUGR 键 vs create 流程
  FUNC、parseUnitRunResult JUnit 全局计数器、listTransports retry 注释略过头
  （round 3 记录，均未变）。
- **client.ts:1238/1479 错误文本无 `ADT ` 前缀**：风格漂移确凿，修正需改错误
  文本（铁律禁止），等一次带测试置换的功能轮。
- **sapgui.ts:132 与 probe.ts:53 端口约定两处编码**：契约不同（2 派生对 vs
  4 候选去重），互推导牵强；仅当端口约定本身变化时才抽 `icmUrlFor`。
- **index.ts 4 行再导出（AdtRegistry/TYPE_MAP/AdtClient/createMockAdtServer）**：
   仓内零消费，但 index.ts 再导出即发布包公共面（判例 4 正向应用），不动。
- **上上轮"明确不做"清单（docs/code-cleanup-plan.md）继续有效**：mock PUT 不查锁、
  sessions/unitRuns/atcRunIds 单调增长、锁账本 last-write-wins、.adt-snapshots/
  竞争、atc_runs 分页、cli --force 语义。
- **未提交工作树**：本轮改动叠在 workspace-layer feature 的未提交树上，提交时
  建议与 feature 分开（`refactor(simplify): round 4 …`）。

## 本轮落地摘要（影响理解的显著变化）

- **adt-protocol**：findTextDeep 与 xml.ts child/children 的 `endsWith(':x')` 死
  分支（round 3 判例 3 延伸到导出助手——文档明示树名字域即契约）；msagNotFound
  谓词并源 1864/1904 六行守卫；parseAtcResultList 复用 parseAggregatesNode；
  lockResponseField 合并 parseLockHandle/parseLockTransport；3 处 no-op
  `?? undefined`；xml.ts 头注释 Clark 记法失实修正。
- **插件核心**：parseYamlDocument 并源 config/workspace 的 YAML try/parse/catch
  （错误文本字节不变）；renderWorkspaceConfig 恒真守卫删除；3 个死导出收 export。
- **插件 tools**：isAdtServiceUnavailable 类型谓词收敛 7 处 404/405 判定；
  trimmedArgStr 升 common.ts（lifecycle transport + destinations 并源）；
  ACTIVATE_AFTER_WRITE_PARAM / TRANSPORT_META_PROPERTIES /
  VERSION_FEED_META_PROPERTIES / PROBE_TIMEOUT_MS_PARAM 四组 schema 并源；
  datapreview 双路径 toOutput；search.ts 默认 clamp 走 clampWithNote（守
  `typeof === 'number'`，字符串不可静默接受）；destinations 的 exec?.signal
  规范化与 "exactly" 注释软化。
- **adt-mock**：9 组路由正则并源（判例 2）；ATC severity→priority 映射去重；
  hDumpsList 冗余 `[...DUMPS]` 拷贝；cli.ts host 双求值并一。
- **scripts**：smoke_plugin.mjs 剪除按已废弃演示接壁调用的死尾巴（58-67、
  76-86 行段——脚本曾在第 59 行崩溃，现完整跑通）+ 冗余 `searchTool &&` 守卫。
