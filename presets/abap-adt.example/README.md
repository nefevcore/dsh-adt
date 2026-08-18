# abap-adt agent preset 模板（可安全分享，不含任何密码/内网地址）

给同事配好的三件套。装好插件后（`dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin`，见仓库
[README](../../README.md#安装与更新)），按下面 3 步启用：

1. **建预设**：把官方 `cordis` 预设的 `agent.cordis.yml` 整份复制为
   `~/.dsh/.agent-presets/abap-adt/agent.cordis.yml`，再把
   [`agent.cordis.append.yml`](./agent.cordis.append.yml) 的内容追加到末尾
   （按注释把 `name` 改成实际的加载方式）。同目录放
   [`preset.yml`](./preset.yml)。

2. **建用户配置**：把 [`settings-section.example`](./settings-section.example)
   的 `abap-adt:` 段合并进 `~/.dsh/settings.yaml`，填自己的 destinations
   （密码走 `passwordEnv` 环境变量）和权限管控开关。保存即热生效，预设文件
   一行都不用再动。

3. **重启 DSH**（首次启用预设需要），新建会话时在预设 chip 选
   「ABAP Development」——只有该预设的会话才有 `adt_*` 工具。之后改
   settings.yaml 里的 `abap-adt:` 段不再需要重启。

## 为什么要拆两个文件

- `agent.cordis.yml` 是**整套工具的组合定义**（persona + 官方插件行），应保持
  稳定；destinations/权限是**环境信息**，随人随机器变。混在一起每次换系统
  都要改 300 多行的组合文件，且容易把密码带进去。
- 分层优先级（DSH settings 规范）：settings 用户段（`~/.dsh/settings.yaml`
  的 `abap-adt:`）> 预设行内联 config > schema 默认值；权限四开关还可用
  `SAP_*` 环境变量兜底。`destinations` 跨层按名字合并，本机段覆盖预设同名
  条目、新名字追加。
- 想换共享配置（比如团队统一一份）就在任意层写
  `configFile: '~/.dsh/abap-adt-team.yml'`——显式共享文件最权威。

> 该目录下的文件是模板，修改请复制出去改，不要在仓库里填真实系统信息。
