# 插件分享指南

本插件（dsh-abap-adt）有三种分发方式，按接收方环境复杂度从简到繁：

---

## 方式 1：单文件 bundle（最简单，推荐给同事快速试用）

**一条命令生成自包含的 ESM 单文件**（内联 ADT 协议客户端 + mock 服务器；`@deepseek-ai/*` 从接收方的 DSH profile 解析）：

```bash
pnpm bundle
# 产物: dist/dsh-plugin-abap-adt.bundle.mjs (约 1.2MB)
```

**接收方用法**（无需克隆仓库、无需构建）：

1. 把 `dsh-plugin-abap-adt.bundle.mjs` 放到任意目录（如 `C:\tools\`）
2. 编辑 `~\.dsh\profiles\web\cordis.patch.yml`，加入：

```yaml
- insert:
    - id: abap-adt
      name: 'file:///C:/tools/dsh-plugin-abap-adt.bundle.mjs'
      config:
        demo: true          # 免 SAP 系统体验
        defaultDestination: demo
        destinations:
          - name: dev
            url: https://你的SAP主机:端口
            client: '100'
            username: 用户名
            passwordEnv: ADT_DEV_PASSWORD   # 密码走环境变量
            strictSSL: false                # 自签名证书时
```

3. 重启 DSH（`dsh web`），新建会话即可使用全部 `adt_*` 工具。

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
# 然后按方式 1 的步骤 2 配置，name 指向本仓库的
# packages/dsh-plugin-abap-adt/lib/index.js
```

**推送前建议：**
- `.research/` 是调研素材（25MB），可选择性保留或移出（`git rm -r --cached .research`）
- `node_modules/`、`dist/`、`lib/` 已在 `.gitignore` 中
- **确认没有提交任何密码/服务器 IP**（本仓库已验证干净）

---

## 方式 3：npm 发布（最规范，接收方一条命令安装）

三个包按依赖顺序发布（pnpm 会自动把 `workspace:*` 转成实际版本号）：

```bash
# 1. 协议客户端
cd packages/adt-protocol && pnpm publish
# 2. mock 服务器
cd ../adt-mock && pnpm publish
# 3. 插件（声明了 dsh.bundle.patch，安装后自动成为 profile bundle 层）
cd ../dsh-plugin-abap-adt && pnpm publish
```

**接收方安装（无需克隆、无需构建）：**
```bash
# 要求 pnpm 在 PATH；相对路径会被锚定
cd ~/.dsh/profiles/web
pnpm add @abap-adt/dsh-plugin
# 自动加入 dsh.profile.bundles（因为包声明了 dsh.bundle.patch）
# 然后编辑 cordis.patch.yml 按需配置 destinations
```

**内网/公司场景**：可搭 [Verdaccio](https://verdaccio.org) 私有源，`pnpm publish --registry http://内网源`，同事 `--registry` 指向内网源安装。

---

## 接收方配置的注意点

- **密码绝不写进 yml**：用环境变量 `ADT_<目的地名>_PASSWORD` 或 `ADT_PASSWORD`（或 `passwordEnv` 字段指定变量名）
- **自签名证书**：SAP 内网系统常见 `CN=*.pvt` 自签证书，`strictSSL: false` 才能连
- **SAP 侧要求**：系统需激活 ICF 服务 `/sap/bc/adt`（SICF），用户需 ADT 相关角色；ABAP Cloud (BTP) 需 JWT 认证（本版本暂只支持 Basic）

## 版本更新

改代码后：
```bash
pnpm build            # 编译
pnpm test             # 19 项测试
pnpm bundle           # 重新生成单文件（方式 1 分发时）
```
**接收方加载的是文件 URL → 必须重启 DSH 才会加载新代码**（Node ESM 缓存钉住旧模块，HMR 只重跑配置）。
