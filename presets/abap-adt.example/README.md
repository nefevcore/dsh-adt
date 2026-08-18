# abap-adt agent preset 模板（可安全分享，不含任何密码/内网地址）

给同事配好的三件套。装好插件后（`dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin`，见仓库
[README](../../README.md#安装与更新)），按下面 3 步启用：

1. **建预设**：把官方 `cordis` 预设的 `agent.cordis.yml` 整份复制为
   `~/.dsh/.agent-presets/abap-adt/agent.cordis.yml`，再把
   [`agent.cordis.append.yml`](./agent.cordis.append.yml) 的内容追加到末尾
   （按注释把 `name` 改成实际的加载方式）。同目录放
   [`preset.yml`](./preset.yml)。

2. **建外部配置**：把 [`abap-adt.yml.example`](./abap-adt.yml.example)
   复制为 `~/.dsh/abap-adt.yml`，填自己的 destinations（密码走
   `passwordEnv` 环境变量）和权限管控开关。插件按
   `${DSH_HOME:-~/.dsh}/abap-adt.yml` 自动发现，预设文件一行都不用再动。

3. **重启 DSH**，新建会话时在预设 chip 选「ABAP Development」——只有该预设
   的会话才有 `adt_*` 工具。

## 为什么要拆两个文件

- `agent.cordis.yml` 是**整套工具的组合定义**（persona + 官方插件行），应保持
  稳定；destinations/权限是**环境信息**，随人随机器变。混在一起每次换系统
  都要改 300 多行的组合文件，且容易把密码带进去。
- 分层优先级：预设行内联 config > `~/.dsh/abap-adt.yml` > `SAP_*` 环境变量
  > 内置默认。`destinations` 按名字合并，预设里塞个别条目可以覆盖文件里的
  同名条目。
- 想换共享配置（比如团队统一一份）就在插件行写
  `configFile: '~/.dsh/abap-adt-team.yml'`。

> 该目录下的文件是模板，修改请复制出去改，不要在仓库里填真实系统信息。
