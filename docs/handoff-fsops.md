# fs_ops 矩阵实施 — 交接文档（2026-09-14）

> 本文档承接 `docs/ddic-fsops-matrix-plan.md`（完整计划与验证证据表）与 `docs/ddic-fsops-matrix-research.md`（协议调研）。
> 本文档只记录「下一个 session 接手时需要立刻知道的事」：当前状态、关键决策判例、下一步任务与其入口。

---

## 1. 当前状态（一句话）

**A 组移除批次已执行完毕**：9 个 CRUD 世代工具已从注册目录下架（实现保留为四工具内部引擎），目录 pin = **40**，
全仓 **331/331** 绿。四工具 `adt_object_write/read/edit/delete` 是唯一 CRUD 面，矩阵/注册表/双档 mock/三环境真实验证全部就位。

```
最新提交基线：8206557（docs/readme pnpm 说明）——本 session 全部改动未提交，工作区脏
改动面：packages/adt-core（index/fsops/fsmatrix/typeregistry/selfcheck）、adt-protocol endpoints、
       adt-mock server（strict 档）、dsh-plugin cli.ts persona、docs×4、README、测试×5、scripts（保留 8 个）
```

## 2. 架构快照（接手即懂）

```
typeregistry.ts   类型注册表 = 单一事实源（29 行：P1×9 + P2×5 + P3×3 + P4×12 长尾）
    ↓ 派生（不可能漂移）
fsmatrix.ts       verb × type 矩阵投影（yes/no/planned/unverified + via 引擎名 + 诚实拒绝文案）
    ↓ 消费
tools/fsops.ts    四工具 = 门面。engines 表按 `${verb}:${via}` 路由到内部实现函数
    ↓ 路由目标
engineMap         assembleAdtTools 构建但【不注册】的 9 个旧工具实现
                  （read/write/objects/structure/packages 工具组——策略/OCC/锁链完整保留）
```

- 动词语义：**write = create-or-override**（空内容=占位）；edit = read-then-patch；read 无 name = 矩阵卡；delete 独立于 write/edit 格
- 已接线引擎：`read:structured|packageContent|source`、`edit:structured|source`、`write:source|structured|fields`（路由 create/write 实现函数）、`delete:delete`
- frameworkPending 引擎：`read:metadata`、`write:none`（SRVB binding / VIEW 元数据等待各自提交）
- 导出：`REMOVED_A_GROUP_TOOLS`（9 个已下架名，死引用测试的锚）、`CRUD_TO_FS_VERBS`（create→write, update→edit）

## 3. 真实验证结论（已固化，勿重做）

三环境全链验证完成，证据表在计划文档头部：

| 环境 | 结果 | 关键画像 |
|---|---|---|
| deloitte-kic (44304/100/EN) | P1 28/28 + P2-P4 53/53 | 严格 Accept 协商（裸 application/xml→406）；激活仅 compat `/activation`；`{uri}/lock` 404 只认 `?_action=LOCK&accessMode=MODIFY`；deletion body 须全路径 URI；全程 stateful + 稳定 connection-id |
| impc-dev (44300/110/ZH) | P1 25/25 + P2-P4 53/53 | **language/masterLanguage 属性必须匹配登录语言**（EN 在 ZH 系统→400）；MSAG URI 仅 `/messageclass/`（deloitte 是 `/msgclass/`，须 GET 探测自适应）；**messageclass create 残留自锁**且 LOCK 对已锁对象 403 不自刷新→RMW 前先无 handle UNLOCK；deletion 拒自闭合 `<del:transportNumber/>` |
| impc-test (44300/300/ZH) | 系统策略拒绝一切 DDIC/RAP create（409 不可更改客户端）；MSAG 全链通 | 能力画像的活例证：wire 相同、策略决定 write 可用性 |

**重要 wire 端点修正（已进代码）**：FUNC=`/functions/groups`（非 /fugr，endpoints.ts 已改）、BDEF=`/bo/behaviordefinitions`、SRVD sourceType 是 **body 属性** `srvd:srvdSourceType="S"`（非 query）、DDLS=`/ddic/ddl/sources`、DOMA fixValues 必须嵌在 `content>valueInformation` 内（外层块 PUT 200 但**静默不持久化**）、PROG/CLAS/INTF 创建必须类型专有命名空间根（泛型 objectReference→400）。

**验证脚本**（可重复）：`scripts/verify-p1-real.mjs`、`scripts/verify-p234-real.mjs`（均已语言参数化：`node 脚本 <url> <client> <user> <pwd> [$TMP] [ZH]`）、`scripts/probe-env.mjs`、cleanup×4、`scripts/count-tools.mjs`。
凭证（用户提供的测试系统）：deloitte-kic = 180.167.68.213:44304/100/168013；impc-dev = impcerpdev01.impc.com.cn:44300/110/abap04；impc-test = 同 host/300/support-ppmr。密码见对话记录/用户。

**mock 双档位**：`createMockAdtServer({ profile: 'strict' })` 复刻 deloitte 六条实证形态（严格协商/compat 激活/LOCK 参数/全路径 deletion/stateful 纪律）；`legacy` 默认（demo 与旧测试语料）。`packages/adt-mock/test/strict.test.ts` 8 项锁定。

## 4. 下一步任务（按优先级）

### 4.1 【最高】write 引擎的真机 wire 修正
**问题**：`write:source|structured|fields` 路由到的 `adt_create_object` 实现里 `client.createObject` 的 body 是泛型 objectReference + 旧媒体类型——真机上全部 400（三环境实证）。mock 绿 ≠ 真机绿。
**任务**：把实证 body 形态修进 `packages/adt-protocol/src/client.ts` 的 `createObject`（类型专有命名空间根 + 正确 CT + language 参数化）。参照：
- 事实源：`verify-p234-real.mjs` 里各类型 create 成功的 body 字符串（全部实证）
- 类型→根元素/CT 对照：PROG=`program:abapProgram`、CLAS=`class:abapClass`(v4)、INTF=`intf:abapInterface`(v5)、FUNC=`group:abapFunctionGroup`(functions.groups.v3)、DOMA=`doma:domain`(domains.v2)、DTEL=`blue:wbobj`、TTYP=`ttyp:tableType`(**tabletype.v1 单数**)、TABL/STRU=`blue:blueSource`、DDLS=`ddl:ddlSource`(ddlSource 无 v2)、DCLS=`dcl:dclSource`、DDLX=`ddlxsources:ddlxSource`(ddic.ddlx.v1)、BDEF=`blue:blueSource`(blues.v1, `/bo/behaviordefinitions`)、SRVD=`srvd:srvdSource`(ddic.srvd.v1 + body 属性 sourceType="S")、MSAG=`mc:messageClass`(application/xml)
- 同时修 createObject 的 Accept（真机要类型专有 Accept 或 `*/*`，泛 application/xml 406）
- 锁：client.ts lock() 已带 accessMode=MODIFY（L813），无需改
- 完成后用 verify-p1/p234 脚本对三环境跑回归
**验收**：mock strict 档 + 真机 deloitte/impc-dev 双绿。

### 4.2 override 语义（write 的另一半）
计划 §2.1：write+override=true 的锁内覆盖（源码型盲写 + 服务端哈希防同刻并发；结构化型=锁内 GET→全字段覆盖 RMW，`fixedValues: []` = 清空不与"未提供"混淆）。engineMap 的 write 实现函数可复用 `lockedWritePipeline`（write.ts L238，未导出——需导出或复制）。

### 4.3 edit 的手术模式参数面（P2）
`mode:'block'|'method'` + oldText/newText/start/end/occurrence 透传（实现在 engineMap 的 edit 工具里，已有）——主要是 fsops schema 参数接线。

### 4.4 能力画像（§3.5，P1 承诺项）
parseDiscovery 全量 accepts + typestructure 探针 + source 形态懒探测 + AdtRegistry 画像缓存 + 矩阵卡双形态（带 destination=生效矩阵）。strict mock 就是画像的静态版。

### 4.5 P1 收尾杂项
- DOMA_VALUE 虚拟行路由（fixedValues 子面；write=整块替换/delete=清空——形态已在 verify 脚本实证）
- DDLS sourceType 参数化（viewEntity/view/...）
- INCL write（P2 命名空间语义）
- 真机残留检查脚本跑一遍（`cleanup-final.mjs` 等按环境跑，只删 Z 前缀探针对象）

### 4.6 B 组（P2）
`adt_push_object` → `edit {sourceFile}`；`adt_read_textelements` → `read {type:'PROG', part:'textelements'}`。目录 40→38。

## 5. 判例与红线（踩过的坑，勿重踩）

1. **mock 绿 ≠ 真机绿**——一切 wire 结论以 verify 脚本对真机的实证为准（这是本次全部工作的方法论核心）
2. **CRLF**：仓库文件多为 CRLF，PowerShell 里 `` `n `` 匹配 LF 的 replace 不生效——用 `edit` 工具或 `[regex]` 显式 `\r?\n`
3. **块注释里不能写 `*/` 字面量**（如 `` `*/*` ``）——会提前闭合注释导致 TS 语法错误，改写为「wildcard Accept」等文字
4. **node -e 内联脚本带中文/复杂引号在 PowerShell 下易碎**——写成 .mjs 文件再跑
5. **测试间偶发 fetch failed**：多为旧 lib 未重编译（`pnpm build` 后稳定）；单独 --test-name-pattern 跑通过≠通过，全文件跑为准
6. **目录 pin 是 40 不是计划的 41**：实际清单 36 专用 + 4 fs 工具（计划预估时把 debugger 组少数了一个）
7. **persona 死引用断言**：`'adt_read_object '`（带尾空格）是为避开 `adt_object_read` 的子串误报
8. **SAP_SESSIONID 与 Basic auth 并存**：stateful 会话开过后再发无 stateful 头的变更请求 = ICM 会话死（"Service cannot be reached"）——这是 strict mock 的第 5 条 gate 的来源
9. **deletion body**：URI 必须全路径 `/sap/bc/adt/...`（剥前缀→500）；impc 拒自闭合 transportNumber
10. **别人系统上的对象**：impc 系统里有大量他人 Z 对象（ZSP_*/ZFG_*/ZTAB_CUSTOMER 等），清理脚本只删本会话前缀（见 `cleanup-final.mjs` 的 mine 正则与 `cleanup-round2.mjs` 的精确清单模式）

## 6. 测试与命令速查

```
pnpm build                 # 全仓构建（改 TS 后必跑，防旧 lib 假绿/假红）
pnpm test                  # 全仓 331 项（~2-3 分钟）
node --test packages/adt-core/test/fsmatrix.test.ts      # fs 矩阵 22 项（含死引用扫描）
node --test packages/adt-mock/test/strict.test.ts        # strict 档 8 项
node scripts/count-tools.mjs                             # 目录计数（应为 40）
node scripts/verify-p1-real.mjs <url> <client> <user> <pwd> '$TMP' [ZH]    # P1 真机回归
node scripts/verify-p234-real.mjs <url> <client> <user> <pwd> '$TMP' [ZH]  # P2-P4 真机回归
```

pin 锚点：agent_extras 目录 40；cli.test persona 死引用断言；fsmatrix 死引用文档扫描；crudmatrix 反向 pin（CRUD 表不得回归）。

## 7. 未提交

本 session 全部改动在工作区（git status 大量 M/??）。建议下个 session 开始时先 `git add -A && git commit` 分两个提交：
1. `feat(fs-ops): type registry + fs matrix + four adt_object_* tools + strict mock profile + three-environment real verification`（core 内容）
2. `refactor(fs-ops)!: remove group-A CRUD tools from the registered catalog (40 tools); persona/docs migrated`（下架批次——breaking change，发版说明需带新旧动词对照表）
