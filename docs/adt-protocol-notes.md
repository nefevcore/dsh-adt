# ADT 协议技术笔记

> 本文档是 `@abap-adt/protocol` 客户端实现的事实依据，交叉验证自：
> - 生产级开源客户端：[`@mcp-abap-adt/adt-clients`](https://www.npmjs.com/package/@mcp-abap-adt/adt-clients)、[`abap-adt-api`](https://github.com/marcellourbani/abap-adt-api)（MIT）、[`vscode_abap_remote_fs`](https://github.com/marcellourbani/vscode_abap_remote_fs)（MIT）、[`abapify/adt-cli`](https://github.com/abapify/adt-cli)（MIT）
> - SAP 官方 BTP REST 文档：[ABAP Unit](https://help.sap.com/docs/btp/sap-business-technology-platform/executing-abap-unit-test-runs)、[ATC](https://help.sap.com/docs/btp/sap-business-technology-platform/executing-abap-test-cockpit-atc-check-runs)
> - 真实系统 discovery 捕获：[fr0ster/mcp-abap-adt docs/adt-discovery.xml](https://github.com/fr0ster/mcp-abap-adt/blob/main/docs/adt-discovery.xml)
>
> ADT 协议**没有官方公开规范**（见 [SAP Community 讨论](https://community.sap.com/t5/technology-q-a/looking-for-documentation-on-adt-abap-development-tools-api-endpoints/qaa-p/14218652)），社区以"抓包 + 客户端实现"为事实标准。原始调研材料保存在仓库 `.research/` 目录。

## 1. 基础

- 所有资源挂 `/sap/bc/adt/` 前缀；对象 URI 命名一律**小写**
- 子资源模式：`<uri>/source/main`（源码）、`<uri>/source/main/versions`（版本）、`<uri>/includes/<段>`（类段）、`<uri>/transport`
- 旧系统（BASIS ≤ 7.40）仅 `/sap/bc/adt/discovery`，现代系统 `/sap/bc/adt/core/discovery`

### 认证
| 方式 | 适用 | 要点 |
|---|---|---|
| Basic | on-prem | `Authorization: Basic b64(user:pass)` + `X-SAP-Client` 头或 `?sap-client=` 参数；Set-Cookie 建立会话 |
| JWT/OAuth2 | BTP ABAP Cloud | `Authorization: Bearer <jwt>`，token 过期需刷新 |

### CSRF 流程（所有写操作）
1. `GET /sap/bc/adt/core/discovery` + 头 `x-csrf-token: fetch`（Accept `application/atomsvc+xml`）
2. 响应头取 `x-csrf-token: <token>`，同时 Set-Cookie
3. 写请求带 `x-csrf-token` + `Cookie`
4. 403（含 "CSRF"）/ 401（写操作）→ 丢弃 token+cookie 重取重试一次

### 会话头
- `sap-adt-connection-id: <uuid>` — 所有请求
- `x-sap-adt-sessiontype: stateful` — 写链（锁定/激活/写入）；7.40 旧系统上会导致锁进会话内存（423），需可关闭
- `sap-adt-request-id` — 有状态会话中每请求唯一
- `sap-usercontext` cookie 会被服务端按系统默认客户端回写，客户端应强制覆盖为请求 client

## 2. 关键端点

### 系统信息
| 方法 | 路径 | 媒体类型 |
|---|---|---|
| GET | `/sap/bc/adt/core/discovery` | Accept `application/atomsvc+xml`（CSRF fetch 端点） |
| GET | `/sap/bc/adt/discovery` | 旧系统回退 |
| GET | `/sap/bc/adt/core/http/systeminformation` | `...core.http.systeminformation.v1+json` |
| GET | `/sap/bc/adt/ato/settings` | ATO 设置（云环境） |

### 对象 CRUD
| 方法 | 路径 | 媒体类型 | 用途 |
|---|---|---|---|
| POST | `/sap/bc/adt/oo/classes`（等类型集合） | CT `application/vnd.sap.adt.oo.classes.v4+xml` | 创建（`?package=ZTEST`、`?corrNr=`） |
| GET | `<对象URI>` | 对应对象媒体类型 | 读元数据（`?version=active\|inactive`） |
| GET | `<对象URI>/source/main` | Accept `text/plain` | 读源码 |
| PUT | `<对象URI>/source/main?lockHandle=<h>` | CT `text/plain; charset=utf-8` | 写源码（先锁定） |
| POST | `<对象URI>?_action=LOCK&accessMode=MODIFY` | `.../lock.result` | 锁定，响应 `asx:abap` → `LOCK_HANDLE`/`CORRNR` |
| POST | `<对象URI>?_action=UNLOCK&lockHandle=<h>` | 同上 | 解锁 |
| POST | `<对象URI>?_action=DELETE&deleteOption=deleteAndLocalVersions` | | 删除 |
| GET | `/sap/bc/adt/repository/nodestructure` | `...nodestructure.v1+xml` | 包树/结构浏览 |
| POST | `/sap/bc/adt/checkruns?reporters=abapCheckRun` | CT `checkobjects+xml` / Accept `checkmessages+xml` | 语法检查 |

### 激活
```
POST /sap/bc/adt/repository/activation?method=activate&preauditRequested=true
CT: application/vnd.sap.adt.activation+xml  Accept: application/xml
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="..." adtcore:name="..."/>
</adtcore:objectReferences>
```
**注意：激活错误在 HTTP 200 body 的 `<chkl:messages><msg type="E">` 中。**

### ABAP Unit（异步）
1. `POST /sap/bc/adt/abapunit/runs`（on-prem）/ `/sap/bc/adt/api/abapunit/runs`（BTP）— CT `...abapunit.run.v1+xml`，body `aunit:run` + `osl:objectSet`
2. `GET .../runs/{runId}?withLongPolling=true` — 轮询状态（`status`/`completed`）
3. `GET .../results/{runId}` — **JUnit XML**（`testsuites/testsuite/testcase` + `failure/error/skipped`）

### ATC（异步）
1. `POST /sap/bc/adt/atc/runs`（on-prem）/ `/sap/bc/adt/api/atc/runs`（BTP）— CT `...atc.run.parameters.v1+xml`，body `atc:runparameters` + `osl:objectSet`（`checkVariant` 属性）
2. `GET .../runs/{runId}` — 轮询（`state` / phases）
3. `GET .../results/{displayId}` — **checkstyle XML**（`checkstyle/file/error`，severity/line/source）

### 传输
- 列表：`GET /sap/bc/adt/cts/transportrequests?user=...&type=...` — Accept `transportorganizertree.v1+xml`
- 详情：`GET /sap/bc/adt/cts/transportrequests/{tr}` — `transportorganizer.v1+xml`
- 动作：`POST /sap/bc/adt/cts/transportrequests/{tr}/release`（release/check/import）
- 创建：`POST /sap/bc/adt/cts/transportrequests`（body `tm:root tm:useraction="newrequest"`）
- 旧系统（< 7.52）：`/sap/bc/cts/` 前缀

### 搜索
```
GET /sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=Z*&maxResults=25[&objectType=CLAS]
Accept: application/xml  →  <adtcore:objectReferences><adtcore:objectReference adtcore:name=... adtcore:uri=.../>
```

## 3. 错误格式

```xml
<exc:exception xmlns:exc="http://www.sap.com/adt/xml/exception" exc:type="...">
  <exc:message>...</exc:message>
  <exc:localizedMessage>...</exc:localizedMessage>
</exc:exception>
```
- 403 还可能是锁冲突（`ExceptionResourceNoAccess` "currently editing"）——此时不要清会话
- 412 = ETag 过期（元数据 PUT 后源码需先 GET 刷新再 PUT）
- 423 = 旧系统上 stateful 会话锁问题

## 4. 对象类型码（ADT registry）

| 对象 | 类型码 | 创建集合 |
|---|---|---|
| 类 | `CLAS/OC` | `/sap/bc/adt/oo/classes` |
| 接口 | `INTF/OI` | `/sap/bc/adt/oo/interfaces` |
| 程序 | `PROG/P` | `/sap/bc/adt/programs/programs` |
| include | `PROG/I` | |
| 函数组/模块 | `FUGR/F` / `FUGR/FF` | `/sap/bc/adt/fugr` |
| CDS 数据定义 | `DDLS/DF` | `/sap/bc/adt/ddls/sources` |
| 访问控制 | `DCLS/DL` | `/sap/bc/adt/dcls/sources` |
| 元数据扩展 | `DDLX/EX` | `/sap/bc/adt/ddlx/sources` |
| 行为定义 | `BDEF/BDO` | `/sap/bc/adt/bdef/sources` |
| 服务定义 | `SRVD/SRV` | `/sap/bc/adt/srvdef/sources` |
| 表/结构 | `TABL/DT` / `STRU/DT` | `/sap/bc/adt/ddic/tables|structures` |
| 消息类 | `MSAG/N` | `/sap/bc/adt/msgclass` |
| 包 | `DEVC/K` | `/sap/bc/adt/packages` |

## 5. ABAP Cloud vs 经典差异

| 维度 | 经典 | ABAP Cloud |
|---|---|---|
| 认证 | Basic | JWT（无 Basic） |
| discovery | `/discovery` → `/core/discovery` | 必须 `/core/discovery` |
| 对象 | 全部 | PROG 等经典对象不可用 |
| 单测 | `/sap/bc/adt/abapunit/runs` | `/sap/bc/adt/api/abapunit/runs` |
| ATC | `/sap/bc/adt/atc/runs` | `/sap/bc/adt/api/atc/runs` |
| 传输 | 传统 CTS | 软件组件 + release state 驱动 |

## 6. 实测补充（S/4HANA S4C 系统验证结论）

在真实 S/4HANA 系统（`sap-system: S4C`）上端到端验证后的经验值：

- **`operation=quickSearchSource` 和 `operation=objectSearch` 可能返回 HTTP 500**（搜索提供者受限时）。客户端会自动降级到 `quickSearch` 并通过 `note` 字段告知；此时全文搜索不可用、对象搜索仍可用。
- **`/sap/bc/adt/repository/nodestructure` 在加固系统上可能 405**。包成员列表优先用搜索 + `packageName` 过滤（`?query=*&packageName=ZPACK&maxResults=500`），nodestructure 仅作回退。
- **系统信息用 `/sap/bc/adt/core/http/systeminformation`**（JSON：`systemID`/`userName`/`client`/`language`）比 discovery feature 可靠；discovery 的 `feature` 元素在真实系统上经常没有。
- **自签名证书常见**（`CN=...pvt` 自签发）：`strictSSL: false` 时客户端通过 undici dispatcher 关闭校验（仅该目的地生效）。

## 7. 待验证项（勿在生产依赖）

- `?includeSupportPackageCompatibility` 参数
- `x-sap-login-with` 头
- 通用 `?feature=` 参数
- `/sap/bc/adt/repository/package_service`
- `/unit/discovery` 端点（不存在于任何来源）

## 参考

- 完整调研材料：本仓库 `.research/`（含社区仓库克隆、SAP 文档摘录、端点清单）
- [mcp-abap-adt](https://github.com/fr0ster/mcp-abap-adt)（MIT）— 端点/媒体类型最全的参考实现
- [vscode_abap_remote_fs](https://github.com/marcellourbani/vscode_abap_remote_fs)（MIT）— ADT 通信层 + 调试器
- [abap-adt-api](https://github.com/marcellourbani/abap-adt-api)（MIT）— 经典 TS 客户端
- [ADT Debugger API 调研](https://github.com/sangvucitek/MCP_SAP/blob/main/reports/2025-12-05-012-adt-debugger-api-deep-dive.md)
- [ADT 原生功能清单](https://github.com/oisee/vibing-steampunk/blob/main/reports/2025-12-05-005-native-adt-features-deep-dive.md)
