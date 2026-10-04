# ABAP Development 预设 bundle（DSH ≥ 0.2.0）

本目录是一个可安装的 DSH **预设 bundle**：`package.json` 声明 `dsh.bundle.patch`，
`cordis.patch.yml` 插入一条 `@deepseek-ai/dsh-agent-preset` 声明行（`preset-abap-adt`）。

预设内容（基于 shipped `standard` 预设——完整编码代理、不含插件开发工具集）：

- **persona 替换为 ABAP 专属人设**：常用工具使用指引、开发流程指引
  （prepare → request → DDIC → code → check/activate → test → release-ready），
  以及传输请求纪律——修改前必须向用户索取请求号并显式传 `transport`，
  绝不省略让后端自行建任务；释放传输保持人工决策。
- **剔除 `skill-filesystem` 行**（ABAP 会话用不上的插件开发机械，沿承审计 D2 结论）。
- **末尾追加 `abap-adt` 插件行**：只有本预设的会话加载 `adt_*` 工具；
  其他会话（standard/ptc/minimal/cordis）完全不受影响。

## 安装（仓库检出内）

```bash
# 1. 构建插件包（预设行以绝对 file URL 指向 <仓库>/packages/dsh-plugin-abap-adt/lib/index.js）
pnpm install && pnpm build

# 2. 安装 bundle —— 让代理执行，或用 Web UI 的 Plugins 面板从目录安装
#    plugin_manager { action: "install_bundle", target: "<本目录绝对路径>" }

# 3. 重启 DSH，新建会话时在预设 chip 选「ABAP Development」
```

> ⚠️ **预设插件行的解析锚点在 dsh 安装内**（agent-preset registry 的上下文），
> 不在 本 patch 文件旁——相对路径行**无法**用于预设 plugins 列表。行名必须是
> 自足的**绝对 file URL**（如本仓库的 `cordis.patch.yml` 所写）；**换检出路径时
> 改 `abap-adt` 行的 `name`**。该行始终加载当前 `pnpm build` 产物——改代码后
> 重新 `pnpm build`，重启会话宿主即生效。

安装结果以返回的 `application: "applied"` 为准；`plugin_manager list_plugins`
应出现 `preset-abap-adt` 行（`enabled: true, fiberPhase: active`）。

从 npm 使用（0.12.1 发布后）：把 `cordis.patch.yml` 里 `abap-adt` 行的
`name` 从 file URL 改成 `'@nefevcore/abap-adt-dsh-plugin'`（要求该包已安装在
解析可达的位置）再安装。

## 配置放哪里

连接与权限配置**不写在预设里**（预设文件保持稳定，换系统/改权限只动配置层）：

- **工作区**（推荐，随项目进 git）：
  `<工作区>/.dsh-abap-adt/destinations.yaml` —— 也可直接在对话里让代理调
  `adt_create_destination` 创建（支持从本机 SAP GUI 连接列表导入）。
  模板见 [destinations.example](./destinations.example)。
- **全局兜底 / 权限开关**：`abap-adt` 条目的 volatile 配置——DSH Settings
  Plugins 页的 `abap-adt` 表单（写入当前 profile 的 patch 覆盖），或直接改
  预设行 `config:`。保存即热生效（Loader 原地提交 + 插件重建目的地表）。
- **团队共享一份**：任意层写 `configFile: '~/.dsh/abap-adt-team.yml'`，
  文件格式同 [destinations.example](./destinations.example)。

分层优先级与密码（凭证存储）说明见仓库主 README 的「配置分层」一节。
