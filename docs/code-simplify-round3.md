# dsh-adt 代码精简第 3 轮（全仓审查）✅

> 生成于 round 3 精简 session（基线：workspace-layer feature commit 后的绿树）。
> 方法：机械扫描（死导出/堆叠 docblock/重复窗口，`node .research/scan-cleanup.mjs`）
> + 3 个并发子代理分包审查（adt-protocol / 插件核心 / 插件 tools）+ 主会话自营
> adt-mock 与 scripts。全部候选逐条裁决后落地。
> 收尾验证：`pnpm typecheck` 零错误、`pnpm test` **222/222（数量不减）**、
> `pnpm smoke` 全绿、`pnpm bundle` 重建且产物契约 `abap-adt ["tools"]`。
> 提交：`refactor(simplify): round 3 — full-repo three-agent pass`（105 文件，+665/-990）。

## 本轮判例（下轮直接援引）

1. **schema 逐字重复才可合并**：两个工具的参数/输出 schema 字面量字节级相同 → 提为共享 const
   （KIND_PARAM、STRUCTURE_DATA_PROPERTIES、TRANSPORT_ITEM_SCHEMA）；描述文本有差 → 各自保留。
2. **渲染文本是行为**：render 输出格式不一致（atc_runs 聚合后缀、transports 列表/详情行）不属
   零行为精简，改了就是改行为——记入遗留，等一次带测试置换的功能轮。
3. **xml.ts 已剥命名空间前缀**：节点名只可能是裸 local-name，`endsWith(':xxx')` 分支按死代码删
   （继 round 1 的 `endsWith(':request')` 判例）。
4. **导出面即契约**：包的公共面 = index.ts 再导出；文件内自用 + 无外部引用的 export 关键字按冗余
   收掉（round 2 判例重申，本轮 17 个）。`import('./x.js').Type` 动态类型导入也算引用。
5. **单实现抽象就地内联**：helper 只有调用方所在文件知道它 → 挪到调用方文件私有
   （activationSummary/transportSourceOf 从 common.ts 挪进 write.ts）。
6. **谓词语义分歧不动**：workspaceConfigPath(existsSync) vs store.existingPath(statSync.isFile)
   在"候选路径是目录"的病态输入下行为不同——统一需语义决策，零行为轮不做。

## 明确不做 / 遗留清单（下轮输入，带位置）

- **渲染不一致（需带断言置换）**：`tools/atc_runs.ts:91` 手搓 ` — P1 …` 后缀，应走
  `atcAggregatesSuffix`；`tools/transports.ts` 列表行无 description、详情行有且缺省时挂空 ` — `。
- **behavior 观察（子代理发现，非精简项）**：`adt-protocol/src/client.ts` metadataAccept 以
  `FUGR` 为键而 create 流程发 `FUNC`（FUNC 对象拿不到类型化 Accept）；parseUnitRunResult 的
  JUnit 分支用全局计数器推每类状态；listTransports "retry unfiltered" 注释只丢 status、
  user/type 仍在（注释略过头）。
- **测试助手重复**：`adt-protocol/test/{client,quirks,transports}.test.ts` 各自复制
  recordingFetch/xml 助手——可提 test/helpers.ts，本轮未做（低价值）。
- **policy 六开关解析块**（`policy.ts` resolve）：可表驱动收敛 ~26 行，但 env 非法值→
  source 保持 'default' 的簿记细节在 fail-closed 核心区，显式写法可辩护——除非 env-miss
  路径有测试覆盖，否则保持现状。
- **杂项**：`tools/lifecycle.ts:129` 对 transport 参数重造 trim 语义（与 optStr 的 `' '` 处理不同）；
  `tools/search.ts:179` 手搓默认 clamp 对象；system/destinations 手写 Math.min/max 无 note
  （补 note 即改 wire 契约）。workspaceConfigPath 谓词统一（见判例 6）。
- 上一轮"明确不做"清单（`docs/code-cleanup-plan.md`）继续有效：mock `/source/main` PUT 不查锁、
  sessions/unitRuns/atcRunIds 单调增长、锁账本 last-write-wins、`.adt-snapshots/` 竞争、
  atc_runs 分页、cli `--force` 语义。

## 本轮落地摘要（影响理解的显著变化）

- **adt-protocol**：msagAltUri / oslSets / runConsole / quickRetry 四个去重 helper；死代码八处
  （ABAP_CLOUD 析句、emptyAggregates、lastIndex 无效赋值、DOCTYPE 死守卫、ATC 属性形态第二循环、
  前缀拼写分支、variant 死参）；DTEL_LABEL_ELEMENTS 单一来源；unlockBestEffort 文档纠偏。
- **插件核心**：POLICY_KEYS 规范键序（三份手维护清单并源）；registry/workspace 的编辑残渣与
  死分支；sapCommonDir；config 陈旧 docblock；17 个无用 export。
- **插件 tools**：write/edit/push 收尾三连抄 → postWriteStatus；structure/transports/datapreview
  的 schema 与分页去重；batch/local/gate/destinations/whereused 小项。
- **adt-mock**：路由表正则三处内联重复 → CREATE_COLLECTIONS/TRANSPORT_RE/objectPath。
- **scripts**：删除孤儿 smoke.mjs（包改名后即坏、零引用）；smoke_settings 死赋值。
