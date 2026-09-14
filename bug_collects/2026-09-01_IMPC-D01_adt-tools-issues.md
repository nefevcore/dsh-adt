# ADT 工具调用问题汇总 — IMPC D01（2026-09-01 会话）

- **环境**：`impc-dev`（D01 / client 110）、`impc-test`（D01 / client 300），同一实例 impcerpdev01.impc.com.cn:44300
- **业务上下文**：发票入账申请单（ZFSSC_TE_0030）+ 应付预付清账（ZSHFG_FI_QZGN）问题分析与修复，请求号 D01K966351
- **严重度**：★ 致命/阻断　★★ 影响效率（有规避）　★★★ 轻微/展示问题

---

## 1. adt_where_used

### 1.1 ★★ 后端不支持 usageReferences 服务，静默返回 0 引用
- **现象**：`adt_where_used` ZSHFIT_WLQZ5 / ZSHFIT_WLQZ5_LOG → `0 reference(s)`，附注 `where-used (usageReferences) is not available on this backend (HTTP 405)`
- **影响**：完全无法做影响面分析。本次分析靠用户人工在 SE11 查 where-used 提供清单（LZSHFG_FI_QZGNF02 / LZSHFG_FI_QZGNU07）才定位到代码
- **规避**：
  1. 请用户在 GUI（SE11/SE38 where-used）人工提供引用清单
  2. 通过业务配置表间接定位：`zwf_objtype` 的 `z_fm_execute` 字段给出工作流类型对应的处理函数（本次 1306 → ZFM_FSSC_WF_00030）
- **建议**：后端返回 405 时工具应显式报"能力缺失"，而不是输出一个看起来正常的 0 引用结果

## 2. adt_search

### 2.1 ★★ quickSearchSource / objectSearch 操作不被后端支持
- **现象**：`operation: quickSearchSource` → 结果附注 `search operation 'quickSearchSource' unsupported by this backend; results from quickSearch`；`objectSearch` 同样回落 quickSearch
- **影响**：无法按源码文本定位调用点（如搜 `ZSHFM_FI_QZGN_PDF` 的调用者），只能靠读代码顺藤摸瓜

### 2.2 ★★ 中文关键词搜索一律 0 hits
- **现象**：
  - 搜 `发票入账` → 0 hits（系统中 ZFM_FSSC_WF_00030 描述就是"发票入账申请"）
  - 搜 `预付转应付` → 0 hits（ZSHFM_FI_TRANSFER_YF 描述"预付转应付"）
- **原因**：quickSearch 的搜索索引（TREX/对象索引）对中文对象描述未建立或不分词
- **规避**：改用对象名通配符（`ZSHFG_FI_QZGN*`、`ZWF_OBJTYPE*`），或查配置表数据反查对象名

### 2.3 ★★ 搜索索引缺失：已激活对象搜不到
- **现象**：`ZTFI_YXPJDJYGX*` → 0 hits，但该表客观存在（DD02L 有记录 TABCLASS=TRANSP，且早前 data preview 查询成功返回过数据）
- **影响**：搜索结果不可信，可能误判"对象不存在"

### 2.4 ★★★ 不带通配符的精确名查询偶发 HTTP 400
- **现象**：`query: ZTFI_YXPJDJYGX`、`query: ZFM_YXJZ_UPLOAD_FILE` → HTTP 400；加通配符 `ZFM_YXJZ_UPLOAD*` 后成功
- **规避**：查询词一律带 `*` 通配符

## 3. adt_read_object

### 3.1 ★★ TABL/STRU 门禁判定混乱，透明表两个门都 406
- **现象**：
  - `ZSHFIS_FI_QZGN_PDF`（DDIC 结构）用 `type=TABL` → HTTP 406，换 `type=STRU` 成功 —— 合理
  - `ZTFI_YXPJDJYGX`（DD02L 确认 TABCLASS=TRANSP 透明表）`type=TABL` 和 `type=STRU` **均 406**："The message content is not acceptable"
- **影响**：无法读取该表字段定义
- **规避**：freestyle SQL 查 DDIC 系统表：`SELECT fieldname, datatype, leng FROM dd03l WHERE tabname = '...'`（实测有效）

### 3.2 ★★ 函数组 include / 主程序按 PROG 名直读 404
- **现象**：
  - `name: LZSHFG_FI_QZGNF02, type: PROG` → 404 `Resource PROGRAM LZSHFG_FI_QZGNF02 does not exist`
  - `name: SAPLZSHFG_FI_QZGN, type: PROG`（函数组主程序）→ 404
- **正确姿势**：必须走函数组 URI：`/sap/bc/adt/functions/groups/<fugr小写>/includes/<include小写>`；read/edit/check/activate/version_diff 全链路都要用 URI
- **建议**：name+type=PROG 对 `LZ*`/`SAPL*` 命名模式可自动换算成函数组 URI（命名规则是确定性的：`L<FUGR>Uxx/Fxx` → `<fugr>`）

### 3.3 ★★★ include 对象被标注为 "(Class)"
- **现象**：读取 `lzshfg_fi_qzgnf02` 返回头显示 `lzshfg_fi_qzgnf02 (Class)`，实际是函数组 include（REPS）
- 纯展示问题，不影响功能

## 4. adt_edit_object

### 4.1 ★★ FUGR include 用 name+type=PROG 触发 403
- **现象**：`name: LZSHFG_FI_QZGNF02, type: PROG` → HTTP 403 `这一语法是不能用于对象名称`（LOCK 接口拒绝该对象名形态）
- **规避**：改用 `objectUri`（函数组 includes 路径）

### 4.2 ★★ [POLICY] 解析不出包名，要求显式 packageName
- **现象**：用 objectUri 编辑成功路径上又报 `[POLICY] cannot determine the package of lzshfg_fi_qzgnf02 ... pass packageName explicitly or read the object first` —— 尽管本会话早前已用同一 URI read 过该对象
- **规避**：显式传 `packageName: ZFICODEV`
- **建议**：read 建立的上下文（URI→包名映射）应在同会话 edit 时复用

## 5. adt_activate

### 5.1 ★★ main+include 组合激活报"主程序未锁请求"
- **现象**：`adt_activate [ZFSSC_TE_0030(PROG), ZFSSC_TE_0030_FRM, ZFSSC_TE_0030_F02]` + transport=D01K966351 → 失败：`Resource ZFSSC_TE_0030 REPS is not locked in a transport request`
- **原因**：本次只修改了两个 include（已记录进请求），主程序本身无修改、未锁入请求；激活器要求列表内所有对象都在请求里
- **规避**：只提交有修改且已入请求的对象（单独激活两个 include 即成功）
- **建议**：工具可在激活前预检"哪些对象未锁入指定请求"并分开报告

### 5.2 ★★★ ACTIVATION SUCCESSFUL 却输出大量 "ERROR:" 前缀消息
- **现象**：激活成功，但消息列表几十条 `ERROR: Use the associated entity "BSIK_VIEW"` / `ERROR: The primary key ... is ignored` 等，且对象归属列为空（`[]: MESSAGE`）
- **原因**：这些是存量代码的 lint/检查警告（severity 展示失真，warning 被标 ERROR），不是激活错误
- **影响**：成功/失败判定依赖第一行总开关，细节消息易造成误读；无对象归属无法定位
- **建议**：消息应携带对象名与真实 severity

## 6. adt_data_preview

### 6.1 ★★ 表"找不到"间歇性出现（DDIC 元数据不稳定）
- **现象**：`ZTFI_YXPJDJYGX` 在本会话**早期**（impc-test）freestyle 查询成功返回数据；**后期**同表在 110/300 两个 client、SQL 与 name+kind（TABL/STRU）两种模式全部报 `找不到 'ZTFI_YXPJDJYGX'`
- **影响**：数据取证结果可重复性受损，需在结论前多模式交叉验证
- **规避**：换 freestyle SQL / name+kind 互验；或查 DD02L/DD03L 确认对象存在性

### 6.2 ★★★ freestyle SQL 对系统 DDIC 表的列集受限
- **现象**：
  - `SELECT sqlview FROM dd02l` → `Unknown column name "SQLVIEW"`（底层表有该列，预览通道走受限投影）
  - `FROM dd03ltt` → `找不到 'DD03LTT'`（DDIC 内部结构非透明表；报错文案有误导性，应报"非查询对象"）
- **规避**：DD03L（字段定义）、DD02L（表清单，不含 sqlview 列）实测可查

### 6.3 ★★ 会话认证过期表现不一致（ping 正常 / 数据预览 401）
- **现象**：会话尾段 `impc-dev`、`impc-test` 的 freestyle SQL 连续 HTTP 401（Unauthorized），但同一时刻 `adt_ping` 两个目标均 OK（discovery 端点可达）
- **推论**：ping 走 discovery（可能匿名/缓存），data preview 需要有效登录会话；会话过期后工具间状态不一致，且无自动重登
- **规避**：将依赖查询尽量安排在会话前段；关键事实交叉验证；必要时重建 destination 刷新凭据

## 7. adt_batch

### 7.1 ★ $batch 服务后端未部署
- **现象**：`adt_batch`（仅 GET 只读部分）→ `$batch is not available on destination 'impc-dev' (HTTP 404) — this backend does not deploy the ADT $batch service`
- **影响**：无法批量扇出只读请求，所有读取只能串行
- **规避**：无；只能接受串行调用开销

## 8. adt_create_destination / adt_ping（首日环境搭建）

### 8.1 ★★ 企业内部 CA 系统的 ping 报错误导（fetch failed 只提示 VPN/saprouter）
- **现象**：manual 模式创建 `impc-dev`/`impc-test`，`ping: true` → 拒绝保存：`ping cannot reach ...: fetch failed. The system may be unreachable without VPN, or only reachable via the GUI saprouter`
- **实际根因**：服务器证书由企业内部 CA 签发，Windows 信任但 Node.js（strictSSL 默认 true）不信任 → TLS 握手失败。端点实际存活（HTTP 401）
- **诊断方法**：PowerShell `Invoke-WebRequest` 带/不带 `-SkipCertificateCheck` 对比；两者都 401 即证明端点活着、证书是 Windows 信任链
- **规避**：`strictSSL: false` 重建（内网 SAP 系统常规做法，GUI 导入模式同为该默认）
- **建议**：报错文案应增加"TLS 证书验证失败"这一常见分支的提示（如建议先做无凭据 curl/PS 探测区分网络不通与证书不信任）

---

## 附：本会话验证有效的替代手法（备忘）

| 需求 | 因工具受限采用的替代方案 |
|---|---|
| where-used | 用户 SE11 人工清单 + `zwf_objtype.z_fm_execute` 配置数据反查处理函数 |
| 全文搜调用方 | 读入口 FM → SUBMIT 程序名 → include 链人工追踪；grep 本地 spill 文件定位 `CALL FUNCTION`/`PERFORM` 调用点 |
| 读表字段定义 | `SELECT fieldname, datatype, leng FROM dd03l WHERE tabname = '...'` |
| 验证对象存在性 | 查 `dd02l`（TABCLASS）；搜索 0 hits 不可作为不存在依据 |
| 超大对象（8737 行） | adt_read_object 截断后自动落 spill 文件 → 本地 read/grep 分段处理 |
| 内网 CA 证书 | PowerShell 双模式探测（带/不带给定证书校验）判定端点活性后再建 destination |

## 附：问题与后端能力关联猜测

D01 后端多个 REST 能力缺失（usageReferences、quickSearchSource、$batch、搜索索引不全、部分 DDIC 读取 406）集中出现，疑似同一层面的服务部署/版本缺口；升级或补装 ADT 后端补丁可能一次性缓解第 1、2.1、7 类问题。
