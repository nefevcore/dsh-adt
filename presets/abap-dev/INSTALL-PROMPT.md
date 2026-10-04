# 任务：安装「ABAP Development」agent 预设（DSH ≥ 0.2.0-rc.2）

> 使用方法（人类）：把本文件所在的**整个文件夹**发给同事。同事在 DSH 桌面应用里
> 用 **cordis（创造模式）预设**新建会话，把本文件内容整段粘贴给 Agent 即可。

---

我把这个文件夹里的三个文件安装成"ABAP Development" agent 预设。三个文件与本提示词在同一目录：

- `package.json` — 预设 bundle 清单（声明 `dsh.bundle.patch`）
- `cordis.patch.yml` — 预设声明（基于 standard 预设：ABAP 专属 persona + adt_* 工具行）
- `dsh-plugin-abap-adt.bundle.mjs` — 自包含插件（32 个 `adt_*` 工具 + 内置 demo mock 服务器）

请严格按以下步骤执行，**除第 4 步指定的那一行外，不要改动任何文件内容**（persona 文本必须逐字保留）：

1. 把三个文件（`package.json`、`cordis.patch.yml`、`dsh-plugin-abap-adt.bundle.mjs`）复制到稳定目录 `~/.dsh/abap-adt-preset/`（Windows 即 `%USERPROFILE%\.dsh\abap-adt-preset`；目录不存在则创建；不要留在下载/临时目录）。
2. 计算 mjs 文件的**绝对 file URL**：`file:///` + 该文件的绝对路径（正斜杠形式），例如 `file:///C:/Users/me/.dsh/abap-adt-preset/dsh-plugin-abap-adt.bundle.mjs`。
3. 编辑 `~/.dsh/abap-adt-preset/cordis.patch.yml`，找到 `id: abap-adt` 的行，把它的 `name:` 值（当前是作者的机器路径）**替换**为第 2 步算出的 file URL（保留引号与缩进）。其余内容一字不动。
4. 安装：调用 `plugin_manager { "action": "install_bundle", "target": "<~/.dsh/abap-adt-preset 的绝对路径>" }`，确认返回 `application: "applied"`。若报 `ambiguous-install`，说明该 profile 已装过，直接进入验证。
5. 验证：
   - `plugin_manager { "action": "list_plugins" }` 分页翻到末尾，应存在 `preset-abap-adt` 行且 `enabled: true`、`fiberPhase: "active"`；
   - （可选强验证）检查 8123 端口是否出现监听——demo mock 启动的信号；若 8123 被其他进程占用，内核会自动换随机端口，监听不到不代表失败，以行状态为准。
6. 向我报告结果，并提醒我：
   - **完全退出 DSH（含系统托盘）后重启** → 新建会话 → 预设 chip 选「ABAP Development」；
   - 连真实 SAP 系统：直接在会话里说"帮我建 xxx 的连接"（可从本机 SAP GUI 导入），或在工件区根目录建 `.dsh-abap-adt/destinations.yaml`；均保存即热生效。

## 已知约束（照做即可，勿自行变通）

- **预设插件行的解析锚点在 dsh 安装内部**（agent-preset registry 的上下文），不在 patch 文件旁——**相对路径必然失败**，第 3 步的绝对 file URL 是唯一可靠形式（已实测）。
- **预设按 profile 隔离**：本次安装只进入当前会话所在宿主的 profile。若我同时使用 `dsh web`（web profile），需要在**那个宿主的会话里**对同一目录再执行一次第 4 步。
- 插件配置（目的地 / 权限策略）不写在预设里：最近层是工作区 `<工作区>/.dsh-abap-adt/destinations.yaml`，全局层是 DSH Settings 的 Plugins 页 `abap-adt` 表单。
- `adt_*` 工具只出现在用「ABAP Development」预设创建的会话——其他会话不受影响，这是刻意设计。
