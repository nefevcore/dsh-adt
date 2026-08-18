# 插件分享指南

本插件（dsh-abap-adt）有三种分发方式，按接收方环境复杂度从简到繁：

---

## 方式 1：单文件 bundle（最简单，推荐给同事快速试用）

**一条命令生成自包含的 ESM 单文件**（内联 ADT 协议客户端 + mock 服务器；`@deepseek-ai/*` 从接收方的 DSH profile 解析）：

```bash
pnpm bundle
# 产物: dist/dsh-plugin-abap-adt.bundle.mjs（约 5.6MB，内联 ADT 协议 + mock + abaplint）
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
     # destinations / 权限管控放 ~/.dsh/abap-adt.yml（下一步），预设行不用再动
   ```

   - 复制 `abap-adt.yml.example` 为 `~\.dsh\abap-adt.yml`，填真实系统（插件自动发现该文件）：

   ```yaml
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

> 想要**全局**（所有会话）生效的话，把插件行放进 `~\.dsh\profiles\web\cordis.patch.yml` 的 `- insert:` 列表即可（外部配置文件 `~\.dsh\abap-adt.yml` 照常生效），两种方式二选一。

> 配置分层（就近覆盖）：插件行内联 config > `~\.dsh\abap-adt.yml` > `SAP_*` 环境变量 > 内置默认；`destinations` 按名字合并，内联同名覆盖文件条目。详见主 README「配置分层」。

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

**推送前建议：**
- `.research/` 是调研素材（25MB），可选择性保留或移出（`git rm -r --cached .research`）
- `node_modules/`、`dist/`、`lib/` 已在 `.gitignore` 中
- **确认没有提交任何密码/服务器 IP**（本仓库已验证干净）

---

## 方式 3：npm 发布（最规范，接收方一条命令安装）

三个包（`@nefevcore/abap-adt-protocol` → `abap-adt-mock` → `abap-adt-dsh-plugin`，声明了 dsh.bundle.patch，安装后自动成为 profile bundle 层）。

**首发（v0.1.0）已手动完成**；之后的发版全部走 CI 自动（GitHub Actions Trusted Publishing / OIDC，免 token 免 2FA）：

```bash
# 1. 同时 bump 三个 packages/*/package.json 的 version
# 2. 提交 + 打标签 + 推送
git add -A && git commit -m "chore(release): v0.1.1"
git tag v0.1.1 && git push origin main v0.1.1
# 3. Actions 自动：install → test(86) → pack（workspace:* 自动替换为实际版本号）→ 按依赖顺序发布
```

> 前提（各包一次性配置）：npmjs.com 包页面 → Settings → **Trusted Publishing** 添加 `nefevcore / dsh-adt / publish.yml`（environment 留空）——只在包已存在时可配，所以**任何新包的第一次发布必须手动一次**。

**接收方安装（无需克隆、无需构建）：**
```bash
# 要求 pnpm 在 PATH；相对路径会被锚定
cd ~/.dsh/profiles/web
pnpm add @nefevcore/abap-adt-dsh-plugin
# 自动加入 dsh.profile.bundles（因为包声明了 dsh.bundle.patch）→ 全局已可用（demo 模式）
```

装完即可用（demo 目的地）。要接真实系统/设权限：把 [`presets/abap-adt.example/abap-adt.yml.example`](presets/abap-adt.example/abap-adt.yml.example) 复制为 `~/.dsh/abap-adt.yml` 填好即可（自动发现）。**注意：npm 安装不会创建任何 agent 预设**——想按会话隔离，按方式 1 的 preset 模板配置。

> 注意：方式 3 装进 profile 是**全局**生效（所有会话）。想按会话/工作区隔离，请用方式 1 的 agent preset 方案。

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

改代码后：
```bash
pnpm build            # 编译
pnpm test             # 86 项测试
pnpm bundle           # 重新生成单文件（方式 1 分发时）
```
**接收方加载的是文件 URL → 必须重启 DSH 才会加载新代码**（Node ESM 缓存钉住旧模块，HMR 只重跑配置）。
