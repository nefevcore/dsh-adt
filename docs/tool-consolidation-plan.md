# 工具集精简计划（as-built）— 40 → 32（2026-09-14 落地，0.9.0 第二精简批次）

> 本文档是 `docs/ddic-fsops-matrix-plan.md`（A/B 组：40 个目录）之后的**第二精简批次**——
> C/D/E 三组门面合并。代码注释按本文件编组：**§4 = C 组（textelements）、§5 = D 组
> （list/get 三对）、§6 = E 组（调试器五合一）**。

## 0. 原则（沿用 fs_ops 迁移判例）

1. **只动门面，不动引擎**：合并方式 = 同一工具模块内按参数路由；被并工具的 execute
   逻辑以**内部引擎/分支**形式原样保留（同 A 组处置——"REMOVED"是名不再注册，不是代码删除）。
2. **死引用 pin 同步更新**：`REMOVED_C/D/E_GROUP_TOOLS` 常量（index.ts 导出）、
   fsmatrix.test 死引用扫描清单（覆盖 agent-guide / tool-reference / README）、
   agent_extras 目录计数、`scripts/count-tools.mjs` 观测值（40→32）。
3. **诚实合并**：单工具描述写明两种形态（无主键=列表/带主键=详情 或 action 枚举），
   参数 schema 按 action/主键条件必填（运行时校验 + 报错文案），钳制与 note 行为不变。
4. **行为等价**：门面重排不产生新 wire 形态，全部走既有协议客户端方法 → 真机回归不需要。
5. **一轮一验**：每组合并单独过测试；收口跑全仓 build+test+count。

## 1. 变更总表（as-built）

| 组 | 原工具 | 新形态 | 省 |
|---|---|---|---|
| C | adt_read_textelements | `adt_object_read {type:'PROG'\|'REPT', name, part:'textelements'}` | 1 |
| D | adt_list_atc_runs + adt_get_atc_result | `adt_atc_runs {displayId?}` | 1 |
| D | adt_list_dumps + adt_get_dump | `adt_dumps {dumpId?}` | 1 |
| D | adt_list_transports + adt_get_transport | `adt_transports {number?}` | 1 |
| E | adt_debug_session / breakpoint / step / inspect / set_variable | `adt_debug {action: 九选一}` | 4 |

40 − 8 = **32**（`node scripts/count-tools.mjs` 实测断言）。

## 2. 落选记录（评审结论存档）

- **ping 并入 system_info**：ping 是运维第一诊断步、参数面最小，保留独立名更利 agent 直觉；收益 1 不抵教学面损失。
- **object_versions 并入 version_diff**：发现与比对用途确有分野；diff 输出已带 `versions[]` 作发现入口。
- **check/activate**：checkrun（窄）vs preaudit（宽）语义区分是文档教学重点，`checkOnly` 只是激活的免落库形态。
- **run_unit_tests / run_atc vs release_gate**：gate 是编排+裁决出 verdict/summary，前两者出全明细。
- **lock_info / unlock_all**：数据面不同（后端锁状态 vs 插件锁账本重放）。
- **cochange**：agent 尺度便利（手工等价 = 十几次 versions+transport 扇出）。
- search / where_used / batch / export / local_check / execute / data_preview / selfcheck /
  permissions / destination 族：各管一摊，无折叠对象。

## 3. 实施顺序（实际执行序）

文档 → 调研 → E（debugger）→ D（atc_runs / dumps / transports）→ C（textelements）→
pin 更新 → 全仓验证 → 文档收口。每步 `node --test` 对应测试文件 + count 递减；
最终 `pnpm build && pnpm test`（334 项基线）+ count = 32。

## 4. C 组：textelements → `adt_object_read {part}`

- `src/tools/textelements.ts` 降级为**内部引擎**（头部注释更新），fsops read 路由层新增
  `part` 参数：默认 `'source'`（原行为），`'textelements'` 路由到 textelements 引擎
  （PROG/REPT 均可，type 归一化在引擎内完成）。
- `part:'textelements'` 仅 read 可用——write/edit/delete 传它 → 明确报错
  （"read-only face"），不静默降级。
- 这是 handoff-fsops.md §5.5 B 组残余的收尾（push→edit sourceFile 那半已在 A/B 批次完成）。

## 5. D 组：三对 list/get → 单工具（无主键=列表 / 带主键=详情）

| 新工具 | 列表形态参数 | 详情形态参数 |
|---|---|---|
| `adt_atc_runs` | createdBy / ageMin / ageMax / central / active / sysId（子集后端忽略；400 自动回退无参数重试） | `displayId`* + includeExemptedFindings |
| `adt_dumps` | user / from / to / top / skip（满页判定多取一行） | `dumpId`* + view(default/summary/formatted) |
| `adt_transports` | allUsers / status（语义词→字母码翻译 + 400 回退 + 客户端兜底） | `number`*（任务→父请求解析，输出 requestedNumber+note） |

- 语义保留：ATC 的"P1–P4 以列表形态为准"、dumps 的满页判定、transports 的任务号映射。
- 策略不变：transports 整族 enableTransports 门；atc_runs / dumps 只读无门。

## 6. E 组：调试器五合一 `adt_debug {action}`

- 九个 action：`listen` / `status` / `detach` / `setBreakpoint` / `deleteBreakpoint` /
  `step` / `variables` / `stack` / `setVariable`（原五件套的所有 action 并集）。
- 参数按 action 条件必填（运行时校验 + 报错文案）：setBreakpoint 需对象三元组+line、
  deleteBreakpoint 需 id、step 需 step、variables 需非空名数组、setVariable 需 name+value。
- 策略断言：入口处 `assertDebuggerAllowed`（全 action）；`setVariable` 额外
  `assertDebugVariablesAllowed`（双 opt-in）。prd profile 硬拒整族（原语义）。
- 超时：整工具 300s（listen 服务端等待窗最长 240s + 网络余量）。
- 会话纪律不变：一个目的地一个调试会话、detach 后不可重 attach（DebuggerManager
  插件级身份）；断点外部作用域、标准代码断点常不触发的教学保留在描述里。

## 7. 验证（收口门）

- `pnpm build && pnpm test`：全仓 334 项基线（允许因门面删除调整断言数量）。
- `node scripts/count-tools.mjs` → `registered: 32`。
- 死引用扫描（fsmatrix.test）：agent-guide / tool-reference / README 不得出现
  C/D/E 组任何旧名（`\b` 词边界匹配）。
- agent_extras 目录计数与 persona 死引用断言（cli.test）随组更新。
- **真机验收**（2026-09-14/15，`scripts/verify-consolidation-real.mjs`，三环境各 19/19 ✅）：

  | 环境 | 结果 | 关键画像 |
  |---|---|---|
  | deloitte-kic (44304/100/EN) | 19/19 ✅ | ATC 闭环全通（run→列表→详情，counts 正确）；dumps 20 条+详情；transports CTO 视图为空（列表/详情诚实跳过，路由由仓内测试覆盖） |
  | impc-dev (44300/110/ZH) | 19/19 ✅ | **transports 详情形态补全**：单请求 33 items、allUsers 38 条、跨用户详情 15 items（任务级号照常解析）；ATC run 后列表不索引新 run（子集后端已知画像）但 displayId 详情复取正常 |
  | impc-test (44300/300/ZH) | 19/19 ✅ | 受限客户端（不可更改）下只读形态全部可用：ATC run 正常启动并复取、dumps/textelements 读取正常——write 受限不影响 D/C/E 门面（本批次零 write 面） |

  **附带修复**：合并曾把策略断言提到参数校验之前（坏参数先撞策略门、误导"要开权限"），
  已改为参数预校验 → 策略门 → 执行，分支内原校验保留为防御性双保险。

## 8. 迁移指引（`CONSOLIDATION_MIGRATION`，index.ts 导出）

旧名 → 新面（调用方拿旧名调过来时，错误信息携带此指针）：

```
adt_read_textelements        → adt_object_read {type:'PROG', name, part:'textelements'}
adt_list_atc_runs            → adt_atc_runs {createdBy?, ageMin?, …}
adt_get_atc_result           → adt_atc_runs {displayId}
adt_list_dumps               → adt_dumps {user?, from?, to?, top?, skip?}
adt_get_dump                 → adt_dumps {dumpId, view?}
adt_list_transports          → adt_transports {allUsers?, status?}
adt_get_transport            → adt_transports {number}
adt_debug_session            → adt_debug {action:'listen'|'status'|'detach'}
adt_debug_breakpoint         → adt_debug {action:'setBreakpoint'|'deleteBreakpoint'}
adt_debug_step               → adt_debug {action:'step', step}
adt_debug_inspect            → adt_debug {action:'variables'|'stack'}
adt_debug_set_variable       → adt_debug {action:'setVariable', name, value}
```
