# 架构

```
┌────────────────────────────────────────────────────────────┐
│  DeepSeek Harness (dsh web profile)                        │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ @abap-adt/dsh-plugin (Cordis 插件)                    │  │
│  │  ├─ Config (schemastery)                             │  │
│  │  ├─ AdtRegistry ── 多目的地注册表                     │  │
│  │  │   ├─ demo → 进程内 Mock ADT 服务器 (node:http)    │  │
│  │  │   └─ dev/prod → AdtClient ×N                      │  │
│  │  └─ ctx.tools.register(17 × adt_* 工具)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                │
│                    adt_* 工具调用                           │
└───────────────────────────┼────────────────────────────────┘
                            │ HTTPS / HTTP
                            ▼
              ┌───────────────────────────┐
              │  SAP ABAP 前端服务器       │
              │  /sap/bc/adt/* (ADT REST) │
              └───────────────────────────┘
```

## 分层

### 1. `@abap-adt/protocol` — 协议客户端（零依赖，纯 Node）
- `AdtClient`：单目的地 HTTP 客户端。封装认证（Basic）、CSRF 握手与重试、会话 cookie 管理（含 `sap-usercontext` 强制覆盖）、`sap-adt-connection-id` / stateful 会话头
- 高层操作：discover / systemInfo / search / readSource / writeSource / lock / unlock / updateSource / activate / check / runUnitTests（异步轮询）/ runAtc（异步轮询）/ transports / packageContent / createObject / deleteObject / ping
- `xml.ts`：为 ADT XML 载荷优化的零依赖解析器（命名空间剥离、CDATA、实体）

### 2. `@abap-adt/mock` — 内存版 ADT 服务器
- 实现协议子集：AtomPub discovery、通配符搜索、`_action=LOCK/UNLOCK`、`/source/main` 读写、激活（HTTP 200 内嵌 `chkl:messages` 错误）、checkruns、ABAP Unit 异步 run（JUnit 结果）、ATC 异步 run（checkstyle 结果）、传输请求、类型专用创建集合、nodestructure
- 带示例对象库（类/接口/程序/CDS + 单测与 ATC 数据），支持 Basic auth 校验与 CSRF 强制

### 3. `@abap-adt/dsh-plugin` — DSH (Cordis) 插件
- `cordis.patch.yml` 声明 `dsh.bundle.patch`；安装后自动成为 profile bundle 层
- `apply(ctx, config)`：构建 registry → 注册全部工具 → 返回 fiber disposer（卸载时关闭 mock）
- 工具按职责分文件（system/search/source/lifecycle/testing/transport/packages/batch），统一通过 `defineTool` 声明参数/输出 schema 与 render

## 关键设计决策

1. **直接实现协议，而非桥接 VS Code**：不依赖 IDE 或 SAP 闭源库，可 headless 运行，天然支持批量与自动化
2. **零配置 demo**：插件内置 mock 服务器，开箱即用；真实系统通过 `destinations` 配置接入
3. **异步 run 流程**：ABAP Unit / ATC 都是"提交 → 轮询 → 取结果"，客户端完整实现轮询循环与超时
4. **协议正确性优先**：错误处理覆盖 ADT 特有语义（激活错误在 200 body、exc:exception 错误体、403 CSRF/锁冲突区分、412 ETag）
5. **沙箱感知**：导出工具走 `ctx.fs` 服务，遵守 DSH 文件沙箱策略

## 超集功能（Beyond VS Code ADT）

| 工具 | 价值 |
|---|---|
| `adt_batch_checks` | 一次调用对整个开发包跑 ATC + ABAP Unit，产出聚合质量报告——VS Code 只能逐对象操作 |
| `adt_export_objects` | 把包/对象集源码落盘为 `.abap` 文件，支持 git 版本化、离线评审、备份 |
| 全链路自动化 | 代理可自主串联 search→read→write→activate→test→transport，无需人工点击 |
| DSH 生态协同 | 与 workflow/subagent/schedule 组合：多系统批量分析、夜间质量巡检、AI 代码评审流水线 |
