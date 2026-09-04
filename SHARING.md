# 插件分享指南

本插件（dsh-abap-adt）有三种分发方式，按接收方环境复杂度从简到繁：

---

## 方式 1：单文件 bundle（最简单，推荐给同事快速试用）

**一条命令生成自包含的 ESM 单文件**（内联 ADT 协议客户端 + mock 服务器；`@deepseek-ai/*` 从接收方的 DSH profile 解析）：

```bash
pnpm bundle
# 产物: dist/dsh-plugin-abap-adt.bundle.mjs（约 5.8MB，内联 ADT 协议 + mock + abaplint）
```

**接收方用法**（无需克隆仓库、无需构建）：

1. 把 `dsh-plugin-abap-adt.bundle.mjs` 放到任意目录（如 `C:\tools\`）
2. **推荐：装成 agent preset（按会话启用，不影响其他工作区）**——按仓库里的模板 [`presets/abap-adt.example/`](presets/abap-adt.example/README.md) 三步走：
   - 官方 `cordis` 预设的 `agent.cordis.yml` **完整复制**为 `~\.dsh\.agent-presets\abap-adt\agent.cordis.yml`，末尾追加插件行（同目录 `agent.cordis.append.yml`，`name` 指向 bundle 文件）：

   ```yaml
   # 追加在官方 cordis 预设所有行之后
   - id: abap-adt
     name: 'file:///C:/tools/dsh-plugin-abap-adt.bundle.mjs'
     config:
       demo: true          # 免 SAP 系统体验
     # destinations / 权限管控放 ~/.dsh/settings.yaml 的 abap-adt: 段（下一步），预设行不用再动
   ```

   - 把模板 [`settings-section.example`](presets/abap-adt.example/settings-section.example) 的 `abap-adt:` 段合并进 `~\.dsh\settings.yaml`，填真实系统（保存即热生效，无需重启）：

   ```yaml
   # ~/.dsh/settings.yaml 的 abap-adt: 段
   abap-adt:
     defaultDestination: dev
     destinations:
       - name: dev
         url: https://你的SAP主机:端口
         client: '100'
         username: 用户名
         passwordEnv: ADT_DEV_PASSWORD   # 密码走环境变量
         strictSSL: false                # 自签名证书时
   ```

   - 同目录放模板里的 `preset.yml`（显示名）

3. 重启 DSH（`dsh web`）；新建会话时在工作区旁的预设 chip 选该预设，即可使用全部 `adt_*` 工具。

> `cordis.patch.yml` 的 `- insert:` 插入机制已废弃，全局（所有会话）加载不再是受支持方式——启用统一走上面的 agent preset 行（按会话），见根 README「安装与更新」。

> 配置分层（就近覆盖）：`~\.dsh\settings.yaml` 的 `abap-adt:` 段 > 插件行内联 config > `SAP_*` 环境变量（仅权限六开关兜底）> 内置默认；旧版独立文件 `~\.dsh\abap-adt.yml` 已废弃。`destinations` 跨层按名字合并，settings 同名条目覆盖内联。详见主 README「配置分层」。

> 注意：接收方的 profile 里必须已有 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`（标准 dsh profile 自带）。

---

## 方式 2：Git 仓库（适合长期维护/多人协作）

```bash
git remote add origin https://github.com/<你>/dsh-abap-adt.git   # 或 Gitee
git push -u origin main
```

**接收方：**
```bash
git clone <repo-url>
cd dsh-abap-adt
corepack pnpm install --registry https://registry.npmmirror.com
corepack pnpm build
# 然后按方式 1 的步骤 2 配置（agent preset 方式），name 指向本仓库的
# packages/dsh-plugin-abap-adt/lib/index.js
```

**推送前须知（本仓库已清理）：**
- `.research/` 调研素材（25MB）已 untrack 并列入 `.gitignore`，新克隆不含该目录
- `node_modules/`、`dist/` 已在 `.gitignore` 中
- **新增脚本严禁硬编码密码/服务器 IP——一律走环境变量**（如 `ADT_URL`、`ADT_<目的地名>_PASSWORD`）；推送前确认没有夹带真实凭证

---

## 方式 3：npm 发布（最规范，接收方两条命令安装启用）

四个包按依赖顺序发布：`@nefevcore/abap-adt-protocol` → `abap-adt-mock` → `abap-adt-core` → `abap-adt-dsh-plugin`（0.7.0 内核拆分后 core 是第四个包；插件包**刻意不声明** `dsh.bundle`——安装只是进 profile 依赖、不自动加载，须用 `abap-adt-preset` CLI 生成预设按会话启用，见根 README「安装与更新」）。

### 发版流程：推 `v*` 标签，Actions 自动发布

发布动作只有一条——把标签推上 GitHub。`publish.yml`（Trusted Publishing / OIDC，免 token 免 2FA）自动跑 install → test → pack（`workspace:*` 自动替换为实际版本号）→ 按依赖顺序发布四包。前置步骤：

```bash
# ① 四包 lockstep bump：packages/*/package.json 的 version 一起改。
#    漏改任何一个，CI 会打出旧版本号的 tarball 并撞
#    "cannot publish over previously published version"（0.7.0 发版时踩过）
# ② README「从 0.1.0 升级」下补一节该版本说明（仓库惯例）
# ③ 本地验证 + 提交：显式列出改动路径，不要 git add -A
#    （工作区常有 bug_collects/ 等不入库的本地草稿）
pnpm test                                          # build + 全量测试，全绿才继续
git add README.md docs packages && git commit -m "feat(...): v0.7.2 — <一句话>"
# ④ 打标签推送（标签触发 CI）
git tag v0.7.2 && git push origin main v0.7.2
# ⑤ 核验：CI 约 3–5 分钟，四包按依赖顺序陆续可见
npm view @nefevcore/abap-adt-protocol version      # 四个包各查一次，都应等于新版本号
npm view @nefevcore/abap-adt-dsh-plugin version
```

版本号约定（0.x 阶段）：修复 + 小幅加性变更 → 补丁号（如 0.7.1 宿主自适应密钥管理批次）；成体系的功能批次 → 次号（0.6.0 治理+调试器、0.7.0 内核拆分）。破坏性变更在 README 升级说明里显著标注迁移步骤。

### github.com 推不上去时（网络阻断）

CI 发布的唯一前提是 tag 推上 GitHub；直连超时 / SSL reset 时：

- **优先挂重试循环等恢复**——间歇性阻断常见（v0.7.1 发版时连挂三次后自行恢复，重试循环第 1 次即成功）。`ssh.github.com:443` 通常仍可达，但本机未配 SSH 密钥时走不了。
- **不要转手动 `npm publish`**：账号开了 2FA，本地直发会被 EOTP（一次性验证码）拦住；即便发成功，之后补推 tag 时 CI 还会撞已发布版本。Trusted Publishing 正是为免掉这些而设——等网络恢复推 tag 即可。

> 前提（各包一次性配置）：npmjs.com 包页面 → Settings → **Trusted Publishing** 添加 `nefevcore / dsh-adt / publish.yml`（environment 留空）——只在包已存在时可配，所以**任何新包的第一次发布必须手动一次**（v0.1.0 首发即此情形）。

**接收方安装（无需克隆、无需构建）：**
```bash
# 要求 pnpm 在 PATH（dsh CLI 内部即 pnpm）
dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin
dsh plugin --profile web exec abap-adt-preset   # 生成按会话启用的预设；装完不自动加载
```

重启 DSH 后新建会话、在预设 chip 选「ABAP Development」即可用（demo 目的地）。要接真实系统/设权限：把 [`presets/abap-adt.example/settings-section.example`](presets/abap-adt.example/settings-section.example) 的 `abap-adt:` 段合并进 `~/.dsh/settings.yaml` 填好即可（保存即热生效）。**注意：`dsh plugin add` 只装依赖、不创建预设**——预设由 `exec abap-adt-preset` 生成；手工定制按方式 1 的 preset 模板来。

> 注意：包不声明 `dsh.bundle`，装进 profile 只是依赖，**不会全局加载**——`adt_*` 工具只出现在用该预设创建的会话（按会话隔离是刻意设计）。

**内网/公司场景**：可搭 [Verdaccio](https://verdaccio.org) 私有源，`pnpm publish --registry http://内网源`，同事 `--registry` 指向内网源安装。

---

## 接收方配置的注意点

- **密码绝不写进 yml**：用环境变量 `ADT_<目的地名>_PASSWORD` 或 `ADT_PASSWORD`（或 `passwordEnv` 字段指定变量名）
- **自签名证书**：SAP 内网系统常见 `CN=*.pvt` 自签证书，`strictSSL: false` 才能连
- **SAP 侧要求**：系统需激活 ICF 服务 `/sap/bc/adt`（SICF），用户需 ADT 相关角色；ABAP Cloud (BTP) 需 JWT 认证（本版本暂只支持 Basic）

## 可发现性（GitHub Topics / npm 关键词）

让插件能被 [github.com/topics/dsh-plugin](https://github.com/topics/dsh-plugin) 收录——Topics 是**仓库级设置**，不在代码里，仓库建好后设置一次即可（GitHub 网页端：仓库页右侧 About ⚙️ gear → Topics，或 gh CLI 一条命令）：

```bash
gh repo edit nefevcore/dsh-adt --add-topic \
  dsh-plugin,deepseek-harness,dsh,deepseek,abap,sap,sap-abap,adt,abap-development-tools,ai-agent,agent-tools,cordis,abaplint
```

配套（已在代码里，随下次发版生效）：

- `packages/*/package.json` 的 `keywords` 均含 `dsh-plugin` / `deepseek-harness` 等 —— npm 搜索 `dsh-plugin` 可命中
- README 顶部 badge + 「找 DSH 插件？」入口链到 topic 页

> topics 全小写、最多 20 个；上面这组兼顾 DSH 生态（`dsh-plugin`、`deepseek-harness`）与 SAP 领域词（`abap`、`adt`、`sap-abap`），从 topic 页和 GitHub 搜索两侧都能进。

## 版本更新

改代码后（走方式 3 发 npm 的完整流程见上方「发版流程」）：
```bash
pnpm build            # 编译
pnpm test             # 全量测试（随版本增长，当前 300 项）
pnpm bundle           # 重新生成单文件（方式 1 分发时）
```
**接收方加载的是文件 URL → 必须重启 DSH 才会加载新代码**（Node ESM 缓存钉住旧模块，HMR 只重跑配置）。
