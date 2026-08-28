# dsh-adt 代码精简方案(✅ 已全部执行)

> **执行状态:批次 0–4 全部完成**(2026 精简 session)。收尾验证:`pnpm typecheck` 零错误、`pnpm test` **194/194**、`pnpm smoke` 全绿、`pnpm bundle` 重建 + 产物契约(`abap-adt ["tools"]`、Config/apply 完整)。每批独立提交,各条目实况见各批次标题下的**实况**注记。
> 前置:缺陷审核与规范偏差已全部关闭(见 `docs/audit-fix-plan.md` ✅ 审核关闭)。
> 本方案只做**行为不变的精简**:删死代码、统一模式、修误导注释、仓库卫生。
> 铁律:任何条目不得改变工具行为/schema/协议线格式;每批完成后 `pnpm typecheck` 零错误、
> `pnpm test` **194/194 全绿(数量不减)**、`pnpm smoke` 全绿;涉插件代码的批次结束重建
> `pnpm bundle` 并确认产物契约 `inject: ["tools"]`。
> 本文档行号为当前工作树实测(2026/8/28 快照),执行时以就近搜索确认。

## 批次 0:先提交现状(必做,5 分钟) ✅

工作树有大量未提交修复 + 未跟踪文件,先固化再动手:

```
git add -A   # 含 docs/audit-fix-plan.md、docs/code-cleanup-plan.md、
             # packages/adt-protocol/test/client.test.ts、packages/adt-mock/test/*(若未跟踪)
git commit   # 建议信息: fix(audit): close H1-H3, M1-M9, D1-D6 + P3 sweeps (194 tests)
```

**实况**:按建议信息提交(118 文件);提交前复跑 typecheck / test / smoke 确认基线三绿。

## 批次 1:死代码与误导注释(纯删除/改注释,零行为) ✅

### adt-mock / server.ts(逐项已验证仍存在)
| 位置 | 内容 | 动作 |
|---|---|---|
| `:17` | `import { …, PACKAGES, … } from './data.js'` — server.ts 内未使用(仅 `index.ts:2` 从 data.js 再导出) | 从 server.ts 的 import 中移除 `PACKAGES`(index 再导出不动) |
| `:50` | `const NS_CHKRUN = …` 未引用 | 删 |
| `:88` | `lockAttr(state, obj)` 从未被调用(逻辑已内联在 `objectRefXml`) | 删 |
| `:295` | `isStateChanging(method)` 从未被调用(CSRRF 已按路由逐处强制) | 删 |
| `:1330` | `void marker;`(计算后压制) | 删计算与压制;若 marker 有诊断价值改为注释说明 |
| `Ctx.state` | 声明+填充但 `handle` 从未读取(经 opts 传递) | 验证后删字段(保留 handle 的第 3 参) |

### adt-protocol / client.ts + types.ts
| 位置 | 内容 | 动作 |
|---|---|---|
| `:167,173` | `insecureTlsDispatcher` 永不赋值——`if (insecureTlsDispatcher !== undefined)` 快路径是死代码 | 二选一:实现真正的单例缓存(await 后赋值再返回),或删变量与分支只留 `insecureTlsPromise`。推荐后者(最简) |
| `:480` 附近 | `throw … CSRF retry exhausted` 不可达(retry 仅 `attempt===0` 可 `continue`) | 删并把循环改为不产生"落到循环外"的类型路径(如 for 内 return/throw 全覆盖后用 `throw new Error('unreachable')` 兜底) |
| `:3152, :3170` | `endsWith(':request')` 死条件——xml.ts 解析时已剥前缀,`name` 永远是裸 local-name | 删每个 `|| xxx.endsWith(':request')` 分支,保留 `=== 'request'` |
| `:161-166` | docblock 声称 "process.getBuiltinModule (Node>=22.3)" 但实现是 `import('undici')` npm 包(已在 package.json 声明 `undici ^7.0.0`) | 重写注释为实情:npm `undici` 依赖、仅 `strictSSL:false` 目的地懒加载;顺带把 README/architecture 中"零依赖"措辞校正为"运行时仅 undici(懒加载)+ 可选 peer" |
| types.ts `:74` 附近 | `readObjectSource` 注释名与实际方法名 `readSource` 不符 | 改注释 |

### dsh-plugin-abap-adt
- `src/snapshots.ts` `writeText(target, source, undefined, undefined)` 两个位置实参——具名注释或改用 options 形参(若 fs API 支持),纯可读性。
- `src/dsh.d.ts`:fs 已改 `ctx.get` 可选消费,模块增强保留(类型声明仍正确);仅在文件头补一句"运行时可选,见 index.ts"。

## 批次 2:mock `handle()` 路由表化(~880 行函数) ✅

`server.ts` 的 `handle()` 是顺序 if 路由的巨型函数;P3 修的方法守卫是逐路由手工加的,新路由容易漏。

1. 抽出路由表:`Array<{ method: 'GET'|'POST'|'PUT'|'DELETE'|Array, match(pathname): params|undefined, handler(ctx): Promise<void> }>`,`handle()` 归约为:preflight → auth → 会话/CSRF 令牌发放 → 表匹配 → 未命中 404。
2. 方法守卫与"写需 CSRF"由表声明统一强制(替代散落的 `req.method !== 'GET'` 判断);保持现有状态码不变(**逐条对照 integration.test.ts,不许漂移**)。
3. 顺带三小项:
   - 激活路径 `findObject(...) ?? findObjectByName(...)` 在 items.map 与 hasError.some 各解析一次 → 解析一次复用;
   - `cli.ts` 打印硬编码 `127.0.0.1` → 打印实际 `host`(ADT_MOCK_HOST 生效时不再误导);
   - 状态浅拷贝 `{...o}` 共享嵌套 `unit/atcFindings` → 构造时深拷贝(或 `Object.freeze` + 文档),消除未来误共享坑。

## 批次 3:插件工具层一致性 ✅

1. **writeObject 锁模式统一**:`write.ts` 的 `adt_write_object` 用 try/catch(成功路径 unlock 在 try 内、catch 再 unlock 回滚),而 `adt_edit_object`/`adt_push_object` 用 try/finally。统一为 finally 模式,但保住语义差异:**出错时无论 `unlock` 参数一律回滚解锁;成功时仅在 `unlock!==false` 解锁**。改造后跑全量 `agent_tools.test.ts`(写链用例密集)。
   **实况**:`adt_write_object` 改为 `succeeded` 标志 + finally(错误必回滚解锁、成功按参数、解锁失败保留账本条目——三条语义逐条对照原实现保持);全量测试通过。
2. **timeoutMs 审计**:各工具超时(push/batch/write_structure 180s、execute 330s、unit 330s、atc 660s、write/edit 无显式)在 `docs/tool-reference.md` ⏱ 标记处汇总核对;缺显式的补齐或统一默认,注释一句话写明"为何是 Client 截止 +30s"之类依据。
   **实况**:9 处自定义超时全部补一行依据注释(execute/unit 330s、atc 660s、batch/export 180s/600s、gate 1200s、local 300s、push/write_structure 180s);write/edit 维持无显式(单链路客户端截止已覆盖,加显式上限反而改行为);tool-reference.md 补标 `adt_push_object`/`adt_write_structure` 的 ⏱180s(此前文档漏标)。
3. `registry.startMock` 的 EADDRINUSE 双服务器舞步可简化为"先试 0 端口探测→listen 或直接随机端口"一种路径(可选,现逻辑正确但绕)。
   **实况**:改为同一 server 实例 `listen(0)` 重试(删除第二台一次性服务器与 `if (!this.mockServer)` 条目舞步)。

## 批次 4:仓库与发版卫生 ✅

1. **lib/ 声明文件残缺**:提交的 `lib/` 里 `.d.ts` 只有一半(index/config/registry/resolve 有,dsh/locks/policy/snapshots 与多数 tools 无)。二选一:
   - 推荐:修 tsconfig 使声明完整发射(消费者类型受益),重建后提交;
   - 或:`lib/` 移出 git,CI/发布时构建(publish.yml 需加 build 步骤)。
   **实况**:按推荐路径——tsconfig 恢复声明发射(继承 base 的 `declaration: true`),TS2742(`Config` 推断类型引用 cosmokit)以显式声明 `@deepseek-ai/cosmokit` 直接依赖解决(本就是 cordis 传递依赖,运行时零新增);lib 30 js ↔ 30 d.ts 完整配对,无孤儿残留。
2. **README 徽章与计数**:badge `tests-152` → `194`;正文"共 152 项"同步;如发版再顺带升 `tests-194`。 **实况**:badge 与正文均已改 194。
3. **版本与发版**:本批含安全修复(H1/H2/M1/M2/M3),建议 bump `0.3.1 → 0.4.0`(三包同步),README"从 0.1.0 升级"节后补 0.4.0 变更摘要(引 audit-fix-plan),打 `v0.4.0` 标签走 Trusted Publishing;发版后把本机预设 `name` 从本地 bundle 切回 `@nefevcore/abap-adt-dsh-plugin`(audit D3 注记里的"option B")。
   **实况**:三包已 bump 0.4.0,README 补 0.4.0 变更摘要;**打 `v0.4.0` 标签与推送(触发 Trusted Publishing)留给维护者手动执行**;发版后预设切回 npm 名(D3 option B)同此。
4. **docs/agent-usage-review.md** 头部仍写"30 个工具"——加一行"历史评审存档,工具数与落地状态以 tool-reference.md 为准",不重写正文。 **实况**:头部存档注记已加。
5. (可选)bundle 6MB 主要来自内联 `@abaplint/core`:`local.ts` 改 `await import('@abaplint/core')` 懒加载可显著瘦身主包;注意 esbuild `--splitting` 或保持单文件+动态 import 的可行性,若无收益即放弃,不做激进改造。
   **实况**:**放弃**(按预案"若无收益即放弃"):esbuild 单文件 bundle 会把动态 import 内联,不引入 `--splitting`(改变产物为多文件)就没有运行时收益,不做激进改造。

## 明确不做(审核已接受的遗留,勿"顺手修")

- mock `/source/main` PUT 不查锁(刻意,`$batch` 内嵌写兼容);sessions/unitRuns/atcRunIds 单调增长(进程内测试生命周期);畸形 XML 静默存源码。
- 锁账本跨会话 last-write-wins(D5 接受项);`.adt-snapshots/` 竞争(失败方向安全)。
- `atc_runs` 列表分页(低价值);cli `--force` 整目录替换语义。
- client.ts `sleep` 单测、execute/read 截断专测(P3 遗留注记,可在本方案批次 1/3 顺手补,非必须)。

## 验收清单(每批 + 收尾)

```bash
pnpm typecheck && pnpm test && pnpm smoke
pnpm bundle && node --input-type=module -e "import('file:///…/dist/dsh-plugin-abap-adt.bundle.mjs').then(m=>console.log(m.name, JSON.stringify(m.inject)))"
# 期望:abap-adt ["tools"];35 tools registered(冒烟日志)
```

批次 2 完成后额外跑一次 mock 直连(`pnpm mock` + 手工 discovery/search/LOCK 往返),确认路由表化无行为漂移。**实况**:直连冒烟通过(discovery/search 200、release GET 405、POST 无 CSRF 403、未知路径 404)。全部批次完成后更新本文档各条状态,并(若发版)按 publish.yml 流程打标签。

## 收尾实况(2026 精简 session)

- 每批一个提交:`fix(audit): …`(批次 0)、`refactor(cleanup): batch 1 …`、`refactor(mock): batch 2 …`、`refactor(tools): batch 3 …`、`chore(release): batch 4 …`。
- 收尾复验:`pnpm typecheck` 零错误、`pnpm test` 194/194、`pnpm smoke` 全绿、`pnpm bundle` 重建(5.8MB)并验证产物契约(`abap-adt ["tools"]`、Config/apply 完整)。
- **未做(留维护者)**:打 `v0.4.0` 标签并推送触发 Trusted Publishing;发版后本机预设行切回 `@nefevcore/abap-adt-dsh-plugin`;重启 DSH 使本机 ABAP 会话用上新 bundle。
