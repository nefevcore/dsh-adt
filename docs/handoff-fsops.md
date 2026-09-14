# fs_ops 矩阵实施 — 交接文档（2026-09-14，第二 session 更新）

> 本文档承接 `docs/ddic-fsops-matrix-plan.md`（完整计划与验证证据表）与 `docs/ddic-fsops-matrix-research.md`（协议调研）。
> 本文档只记录「下一个 session 接手时需要立刻知道的事」：当前状态、关键决策判例、下一步任务与其入口。

---

## 1. 当前状态（一句话）

**4.1 全部完成（含真机验收）**：目录 pin = **40**，全仓 **334/334** 绿，真机回归
deloitte（EN）17/17 + impc-dev（ZH）17/17 + 两环境裸 wire 25/25 与 53/53 全绿；
impc-test 维持「策略拒绝 DDIC/RAP create」的能力画像（预期）。
下一步是 4.2 override 语义。

```
提交基线（本 session）：
  7a22627 docs(handoff): second-session state
  6ae52e8 feat(fs-ops): real-system create wire forms in client.createObject (4.1)
  41c7492 refactor(fs-ops)!: remove group-A CRUD tools from the registered catalog (40 tools)
  a63ed6a feat(fs-ops): type registry + fs matrix + four adt_object_* tools + strict mock profile
工作区干净（verify-create-real.mjs 待提交）。
```

## 2. 4.1e 真机验收结果（2026-09-14，第二 session）

新脚本 `scripts/verify-create-real.mjs`：走 **AdtClient**（不是裸 wire）对四个 P1/P3 新类型
（DCLS/DDLX/BDEF/SRVD）做 createObject→lock→writeSource→unlock→readSource→deleteObject 全链：

```
node scripts/verify-create-real.mjs <url> <client> <user> <pwd> [EN|ZH]
```

| 环境 | 结果 | 关键验证点 |
|---|---|---|
| deloitte-kic | 17/17 ✅ | CREATE_ROOT_ELEMENTS 四类型 + typed Accept 在真机通过 |
| impc-dev (ZH) | 17/17 ✅ | **language 参数化实证**（旧代码 EN 属性 vs ZH 登录 = 400，新代码过） |
| impc-test | create 全 409「不允许更改资源库对象」 | 预期能力画像：策略拒绝 ≠ wire 错误 |

同时重跑裸 wire 脚本确认无回归：deloitte p1 25/25 + p234 53/53；impc-dev（ZH）p1 25/25 + p234 53/53。

## 3. 4.1 已完成内容（代码面，本 session）

`packages/adt-protocol/src/client.ts`：
- `CREATE_ROOT_ELEMENTS` 表：16 个可创建类型的命名空间根（DCLS=`dcl:dclSource`、DDLX=`ddlxsources:ddlxSource`、
  BDEF/TABL/STRU=`blue:blueSource`、SRVD=`srvd:srvdSource`+body 属性 `srvd:srvdSourceType="S"`、DTEL=`blue:wbobj`、
  TTYP=`ttyp:tableType`、DOMA=`doma:domain`、MSAG=`mc:messageClass`、PROG/CLAS/INTF/FUNC 各自官方根）
- `createContentType` 修正：DDLS=`ddlSource+xml`（无 v2）、TTYP=单数 `tabletype.v1`、DCLS=`dclSource`（无 v1 后缀）、+DCLS/DDLX/BDEF/SRVD
- Accept：类型化集合发 `{自身CT}, */*`（裸 application/xml 在严格网关 406）；MSAG 保持 `application/xml, */*`
- language/masterLanguage 取 `destination.language`（impc ZH 实证：不匹配登录语言 = 400）

`endpoints.ts`：DDLS 改 `/ddic/ddl/sources`（两系统实证，`/ddls/sources` 404）；新增 DCLS=`/acm/dcl/sources`、
DDLX、BDEF=`/bo/behaviordefinitions`、SRVD=`/ddic/srvd/sources`；`AdtCreatableObjectType` 同步 +5（DOMA/DTEL/TTYP 也在类型中补全）。

`adt-core`：typeregistry/resolve.ts TYPE_MAP/crudmatrix 的 uriPrefix 与 createEndpoint 全部对齐实证拼写
（FUNC=`/functions/groups/`、BDEF=`/bo/behaviordefinitions/`、SRVD=`/ddic/srvd/sources/`、DCLS=`/acm/dcl/sources/`、DDLS=`/ddic/ddl/sources/`）。

`adt_create_object`（内部引擎）：新增可选 `source` 参数 = create→lock→writeSource→unlock 一步链（verify 实证序列）。

`adt-mock`：CREATE_COLLECTIONS/typeForCollection/uriFor/initialSourceFor/discovery 全部扩到新类型；
strict 门扩面（typed Accept 门 + 第七门：泛型 `adtcore:object`/`adtcore:objectReference` create body → 400，
带 body 重放 stub）。strict 测试 10 项（含 client.createObject 的 DCLS/DDLS/BDEF/SRVD 全链）。

## 4. 真实验证结论（已固化，勿重做）

三环境全链验证完成，证据表在计划文档头部：

| 环境 | 结果 | 关键画像 |
|---|---|---|
| deloitte-kic (44304/100/EN) | P1 28/28 + P2-P4 53/53 | 严格 Accept 协商（裸 application/xml→406）；激活仅 compat `/activation`；`{uri}/lock` 404 只认 `?_action=LOCK&accessMode=MODIFY`；deletion body 须全路径 URI；全程 stateful + 稳定 connection-id |
| impc-dev (44300/110/ZH) | P1 25/25 + P2-P4 53/53 | **language/masterLanguage 属性必须匹配登录语言**（EN 在 ZH 系统→400）；MSAG URI 仅 `/messageclass/`（deloitte 是 `/msgclass/`，须 GET 探测自适应）；**messageclass create 残留自锁**且 LOCK 对已锁对象 403 不自刷新→RMW 前先无 handle UNLOCK；deletion 拒自闭合 `<del:transportNumber/>` |
| impc-test (44300/300/ZH) | 系统策略拒绝一切 DDIC/RAP create（409 不可更改客户端）；MSAG 全链通 | 能力画像的活例证：wire 相同、策略决定 write 可用性 |

**验证脚本**（可重复）：`scripts/verify-p1-real.mjs`、`scripts/verify-p234-real.mjs`（均已语言参数化：`node 脚本 <url> <client> <user> <pwd> [$TMP] [ZH]`）、`scripts/probe-env.mjs`、cleanup×4、`scripts/count-tools.mjs`。
凭证（用户提供的测试系统）：deloitte-kic = 180.167.68.213:44304/100/168013；impc-dev = impcerpdev01.impc.com.cn:44300/110/abap04；impc-test = 同 host/300/support-ppmr。密码见对话记录/用户。

**mock 双档位**：`createMockAdtServer({ profile: 'strict' })` 复刻 deloitte 七条实证形态（严格协商/compat 激活/LOCK 参数/全路径 deletion/stateful 纪律/泛型 body 拒绝）；`legacy` 默认（demo 与旧测试语料）。`packages/adt-mock/test/strict.test.ts` 10 项锁定。

## 5. 下一步任务（按优先级）

### 5.1 【最高】4.2 override 语义（write 的另一半）
计划 §2.1：write+override=true 的锁内覆盖（源码型盲写 + 服务端哈希防同刻并发；结构化型=锁内 GET→全字段覆盖 RMW，`fixedValues: []` = 清空不与"未提供"混淆）。engineMap 的 write 实现函数可复用 `lockedWritePipeline`（write.ts L238，未导出——需导出或复制）。

### 5.2 edit 的手术模式参数面（P2）
`mode:'block'|'method'` + oldText/newText/start/end/occurrence 透传（实现在 engineMap 的 edit 工具里，已有）——主要是 fsops schema 参数接线。

### 5.3 能力画像（§3.5，P1 承诺项）
parseDiscovery 全量 accepts + typestructure 探针 + source 形态懒探测 + AdtRegistry 画像缓存 + 矩阵卡双形态（带 destination=生效矩阵）。strict mock 就是画像的静态版。

### 5.4 P1 收尾杂项
- DOMA_VALUE 虚拟行路由（fixedValues 子面；write=整块替换/delete=清空——形态已在 verify 脚本实证）
- DDLS sourceType 参数化（viewEntity/view/...）
- INCL write（P2 命名空间语义）
- 真机残留检查脚本跑一遍（`cleanup-final.mjs` 等按环境跑，只删 Z 前缀探针对象）

### 5.5 B 组（P2）
`adt_push_object` → `edit {sourceFile}`；`adt_read_textelements` → `read {type:'PROG', part:'textelements'}`。目录 40→38。

## 6. 判例与红线（踩过的坑，勿重踩）

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
11. **strict create 门消费了请求 body**：门内 `readBody` 后必须用重放 stub（`replayReq`）传给路由 handler，否则 handler 读到空 body（本 session 踩过：初版直接调不存在的 dispatch 函数）
12. **mock 的 MSAG 对象 URI 是 `/msgclass/`，impc 真机只有 `/messageclass/`**：跨系统 MSAG 操作需要 GET 探测自适应（当前 client 未做，MSAG read/edit 在 impc 上会 404——5.3 画像工作的一部分）
13. **脚本导入用编译产物**：scripts/*.mjs 引 adt-protocol 要用 `../packages/adt-protocol/lib/index.js`（src 是 .ts，直接引报 ERR_MODULE_NOT_FOUND）

## 7. 测试与命令速查

```
pnpm build                 # 全仓构建（改 TS 后必跑，防旧 lib 假绿/假红）
pnpm test                  # 全仓 334 项（~1 分钟）
node --test packages/adt-core/test/fsmatrix.test.ts      # fs 矩阵 23 项（含死引用扫描）
node --test packages/adt-mock/test/strict.test.ts        # strict 档 10 项
node scripts/count-tools.mjs                             # 目录计数（应为 40）
node scripts/verify-p1-real.mjs <url> <client> <user> <pwd> '$TMP' [ZH]    # P1 真机回归（裸 wire）
node scripts/verify-p234-real.mjs <url> <client> <user> <pwd> '$TMP' [ZH]  # P2-P4 真机回归（裸 wire）
node scripts/verify-create-real.mjs <url> <client> <user> <pwd> [EN|ZH]   # 新 client wire 形态（AdtClient 全链）
```

pin 锚点：agent_extras 目录 40；cli.test persona 死引用断言；fsmatrix 死引用文档扫描；crudmatrix 反向 pin（CRUD 表不得回归；createByType 键 = crudCreatableTypes 全等）。

## 8. 已全部提交

首个 session 的存量改动已按计划分两笔提交（`a63ed6a` 内容 + `41c7492` 下架批次 breaking change），
本 session 的 4.1 wire 修正（`6ae52e8`）与 4.1e 真机验收（`verify-create-real.mjs` + 三环境结果表）已收尾。
工作区干净，随时可发版或继续 4.2（override 语义）。

## 附：架构快照（不变）

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

