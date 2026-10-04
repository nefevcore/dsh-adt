# 任务：安装「ABAP Development」agent 预设（DSH ≥ 0.2.0-rc.2）

> 使用方法（人类）：在 DSH 桌面应用用 **cordis（创造模式）预设**新建会话，
> 把本文件内容整段粘贴给 Agent。前提：机器上有 node/npm 且能访问 npm 源
> （`npm -v` 可用）。

---

请帮我安装 ABAP 开发插件并配置「ABAP Development」agent 预设。资源全部从 npm 获取（包 `@nefevcore/abap-adt-dsh-plugin`，当前 `^0.12.1`）。严格按以下步骤执行，**除第 5 步指定的那一行外，不要改动任何文件内容**（persona 文本必须逐字保留）：

1. 前置检查：`npm -v` 可用（不可用则停止并告诉我）。创建目录 `~/.dsh/abap-adt-preset/`（Windows 即 `%USERPROFILE%\.dsh\abap-adt-preset`）。
2. 在该目录写入 `package.json`，内容原样如下（单行 JSON）：
   `{ "name": "abap-adt-preset-local", "private": true, "type": "module", "dsh": { "bundle": { "patch": "./cordis.patch.yml" } } }`
3. 安装插件（npm 会连依赖一起装进该目录的 `node_modules/`）：
   `npm install --prefix <~/.dsh/abap-adt-preset 的绝对路径> @nefevcore/abap-adt-dsh-plugin@^0.12.1`
4. 复制预设声明：把 `~/.dsh/abap-adt-preset/node_modules/@nefevcore/abap-adt-dsh-plugin/preset/cordis.patch.yml` 复制为 `~/.dsh/abap-adt-preset/cordis.patch.yml`。
5. 改写插件行：编辑该文件中 `id: abap-adt` 的行，把 `name:` 值替换为插件入口的**绝对 file URL**——`file:///` + `~/.dsh/abap-adt-preset/node_modules/@nefevcore/abap-adt-dsh-plugin/lib/index.js` 的绝对路径（正斜杠形式）。保留引号与缩进，其余内容一字不动。
6. 安装 bundle：调用 `plugin_manager { "action": "install_bundle", "target": "<~/.dsh/abap-adt-preset 的绝对路径>" }`，确认返回 `application: "applied"`（若报 `ambiguous-install`，说明该 profile 已装过，直接进入验证）。
7. 验证：
   - `plugin_manager { "action": "list_plugins" }` 分页翻到末尾，应存在 `preset-abap-adt` 行且 `enabled: true`、`fiberPhase: "active"`；
   - （可选强验证）8123 端口出现监听 = demo mock 已启动；若 8123 被其他进程占用，插件会自动换随机端口，监听不到不代表失败，以行状态为准。
8. 向我报告结果，并提醒我：
   - **完全退出 DSH（含系统托盘）后重启** → 新建会话 → 预设 chip 选「ABAP Development」；
   - 连真实 SAP 系统：直接在会话里说"帮我建 xxx 的连接"（可从本机 SAP GUI 导入），或在工件区根目录建 `.dsh-abap-adt/destinations.yaml`；均保存即热生效。

## 已知约束（照做即可，勿自行变通）

- **预设插件行的解析锚点在 dsh 安装内部**（agent-preset registry 的上下文），不在 patch 文件旁——**相对路径必然失败**，第 5 步的绝对 file URL 是唯一可靠形式（已实测验证）。
- **预设按 profile 隔离**：本次安装只进入当前会话所在宿主的 profile。若我同时使用 `dsh web`（web profile），需要在**那个宿主的会话里**对同一目录再执行一次第 6 步。
- 插件配置（目的地 / 权限策略）不写在预设里：最近层是工作区 `<工作区>/.dsh-abap-adt/destinations.yaml`，全局层是 DSH Settings 的 Plugins 页 `abap-adt` 表单，均保存即热生效。
- `adt_*` 工具只出现在用「ABAP Development」预设创建的会话——其他会话不受影响，这是刻意设计。
- 以后更新：重跑第 3 步（`npm install ... @latest`）并完全重启 DSH 即可，预设无需重建。
