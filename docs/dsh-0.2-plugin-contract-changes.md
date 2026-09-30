# DSH v0.2 插件契约变化报告

> **适用范围**：DSH（DeepSeek Harness）`0.1.2-rc.1` → `0.2.0-rc.2`，面向插件/预设作者。
> **证据来源**：dsh-abap-adt 0.12.1 迁移实操（本仓库，362 项测试全绿）+ 对 dsh 0.2.0-rc.2 安装内源码、类型声明与各包 README 的逐点核验。标注「文档依据」的条目引自 dsh 随包文档；其余均为运行时实测。
> **日期**：2026-09-30。

---

## 1. 摘要

v0.2 的核心方向：插件从「**命令式注册**」转向「**声明式组合**」。配置怎么被编辑、预设怎么被定义、插件怎么被安装，全部从"插件主动调用宿主 API"改为"插件声明数据、宿主统一驱动"。

| 契约面 | v0.1.x | v0.2.0 | 破坏性 |
|---|---|---|---|
| 预设（preset） | 目录 `~/.dsh/.agent-presets/<id>/`（`preset.yml` + `agent.cordis.yml`） | bundle patch 中的 `@deepseek-ai/dsh-agent-preset` 声明行 | **完全不兼容**：旧目录不再被读取 |
| 插件配置 / Settings | `ctx.settings.installSection(...)` 注册命名空间，用户层 `~/.dsh/settings.yaml` | Config schema 标记 `.volatile()`，表单由 schema 投影，持久化进 profile patch | **API 移除** |
| 配置热更新 | settings `onChange` 钩子 | `loader/volatile-update` 事件（Loader 原地提交） | 机制更换 |
| 安装 / 分发 | `dsh plugin add/update/exec`（带 reconcile 语义） | `plugin_manager` `install_bundle`（bundle 目录）；CLI 退化为 pnpm 透传 | CLI 语义层移除 |
| Host 插件导出 | `apply` / `inject` / `Config` | 不变 | 无 |
| 工具 / 凭证服务 | `ctx.tools.register` / `ctx.get('credentials')` | 不变 | 无 |

---

## 2. 预设契约（最大破坏性变更）

### 2.1 载体变化

- **v0.1**：预设是一个目录 `$DSH_HOME/.agent-presets/<id>/`，内含 `preset.yml`（显示名/描述/排序）与 `agent.cordis.yml`（插件行列表）。宿主扫描目录发现预设。
- **v0.2**：预设是 bundle patch 中的一条**声明行**，由 `@deepseek-ai/dsh-agent-preset` 插件挂载。旧目录**完全不被读取**——dsh 安装内也不再提供 `config/agent-presets` 源目录（v0.1 时代 `abap-adt-preset` CLI 的拷贝源，实测已不存在）。

### 2.2 声明行格式

```yaml
- insert:
    - id: preset-<id>                    # Loader 行 id 约定
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: <id>                          # 必填：小写字母/数字/连字符
        name: <显示名>                    # 可选
        description: <描述>               # 可选
        order: <排序>                     # 可选（shipped：standard=1/ptc=2/minimal=3/cordis=4）
        plugins:                          # 必填：Cordis entry 列表
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config: { ... }
          - id: <你的插件行>
            name: '<包名或相对路径>'
```

要点（本仓库实测）：

- `config` 是**整体替换**语义：覆盖已有声明行时要完整重述全部字段，不做深合并。
- `plugins` 里的行 `name` 支持相对路径，**以 patch 文件所在目录为锚点**解析——仓库检出内安装时可指向 `../../packages/<插件包>`，无需发布 npm。
- 基座选择：shipped `standard.patch.yml`（`@deepseek-ai/dsh-web-app` 包内）是完整编码代理且不含插件开发工具集，是自定义预设的推荐基底。

### 2.3 plugins 列表能力

- `cordis:group` + `group: true`：嵌套插件组（shipped standard 的 planning/compaction/delegation 都是这样组织的）。
- `isolate: { <service>: true }`：服务隔离域——同组插件与其消费者共享独立的服务实例（如 `planMode`、`workflowEngine`）。
- `disabled: !!js <表达式>`：挂载时求值的平台条件（如 `process.platform === 'win32'` 切换 bash/pwsh 工具行）。
- 预设声明的插件是**按会话挂载**的：只有选择该预设的会话加载这些行，全局会话不受影响（standing mount 跨会话共享一份激活）。

### 2.4 编辑与持久化

Web 预设编辑器保存的修改，以行为单位写进 **profile patch**（按 id 覆盖该声明行的 `config.plugins`），不再是手工编辑目录文件。

### 2.5 预设服务面（Host）

`agentPresets` 服务（运行时实测目录）：`register` / `list` / `resolve` / `mount` / `recompose` / `select` / `acquireScope` / `compositionInventory` 等。配套 `agent-preset-registry` 插件持有 `default` / `selectedDefault`（volatile 配置）。

---

## 3. 配置与 Settings 契约（第二破坏性变更）

### 3.1 移除面

v0.1 的接线方式：

```ts
ctx.inject(['settings'], (settingsCtx) => {
  settingsCtx.settings.installSection(ctx, 'my-ns', Config, config, {
    setSource: (current) => { source = current; },
    onChange: () => { void rebuild(); },
  });
});
```

v0.2 中 `settings` 服务**不再有 `installSection`**，现存方法仅 `configure` / `prepareDocument` / `describe` / `update` / `replace` / `mutate`（表单编辑入口）。`~/.dsh/settings.yaml` 被**一次性导入**（仅映射 shipped 的段，如 `ui-onboarding → ui-settings-general`）后改名为 `settings.yaml.imported`——自定义命名空间的段**不会**被导入，需自行迁移。

### 3.2 volatile 管线（替代机制，四步）

1. **schema 声明**：schemastery `z.object({...}).volatile()`。字段级（如 `apiKey: z.string().volatile()`）或根对象级均可；根级 volatile 由 cosmokit `volatileEntries` 显式支持（"including an empty path for a root reference"，文档依据）。
2. **表单投影**：settings 服务用 `volatileForm()` 从 schema 投影出可编辑表单，按 **Loader entry id** 寻址（id 在组合中唯一即可见）。非 volatile 字段不出现在表单里，普通配置仍走 Cordis 配置文件。
3. **写入路径**：表单保存 → config-editor → 验证完整候选值 → **原子写入当前 profile 的 Cordis patch**（行覆盖）。更高层（home patch / 命令行 overlay）已覆盖的写会被拒绝（文档依据）。
4. **更新提交**（cordis-plugin-loader `_commitVolatile`，源码核验）：
   - 配置 diff 走 `equalExceptVolatile`——volatile 字段位于固定对象路径，**仅 volatile 字段变化 ⇒ 不重挂载**；
   - Loader 解析新配置为候选，逐路径把新值**原地提交**进运行中 fiber 的引用（`updateVolatile`，引用对象不变、快照替换）；
   - 提交完成后向**该 fiber** 发 `loader/volatile-update` 事件，携带变更路径 `readonly (readonly string[])[]`；
   - 监听器抛错只记日志、不会使更新失败（值已提交）；
   - 普通字段变化 ⇒ 走常规重挂载（dispose + 重新 apply）。

### 3.3 消费方编程模型

`.volatile()` 在**类型上**把解析值变为 `Volatile<T>` 引用：`{ get(): 深冻结只读快照 }`。标准消费姿势（对照 dsh-llm-pi-ai 的 `config.providers.get()` 与本仓库实现）：

```ts
import type { Volatile } from '@deepseek-ai/cosmokit';

async function apply(ctx: Context, config: Volatile<MyConfig>) {
  // 持有引用；每次操作取一次快照；需要可变副本时 structuredClone
  const current = (): MyConfig => structuredClone(config.get()) as MyConfig;

  ctx.on('loader/volatile-update', () => { void rebuild(); });  // 值已提交，直接重读引用
}
```

- 快照是 `Object.freeze` 深冻结的普通对象：可安全读取/遍历/JSON 序列化，但**不可原地修改**。
- 引用识别是鸭子判断（cosmokit `isVolatile`：`'write' in value`），跨 ESM/CJS、跨包副本安全（源码注释明示设计意图）。

### 3.4 schema 约束

volatile 字段必须在**固定对象路径**上，且**不能嵌套在另一个 volatile 字段内**——违反时 schemastery 解析直接抛 `ValidationError`（源码核验）。另注意（loader README）：普通字段若每次解析都构造新的类实例（URL/Date/RegExp 之外按对象身份比较），即使值等价也会触发重挂载。

---

## 4. 安装与分发契约

| 事项 | v0.2 契约 |
|---|---|
| 管理入口 | 宿主服务 `plugin_manager`（Web UI Plugins 面板 / agent 工具）；核心动作 `install_bundle`，target = bundle 包的**绝对目录** |
| bundle 定义 | `package.json` 声明 `dsh: { bundle: { patch: "./cordis.patch.yml" } }`；Host-only bundle 无需依赖/构建（两文件即成立） |
| 安装形态 | 以 `link:` 进入 profile 的 pnpm 工作区（实测 profile deps 记录 `link:<目录>`）；链接包版本号实时读取，改版本无需重装 |
| 结果判定 | 看返回的 `application: "applied"` 与 `warnings`，不看日志/进程；`list_plugins` 确认行状态（`enabled` + `fiberPhase: active`） |
| 热更新边界 | 新 bundle 安装可经 HMR 生效；**替换已装包的 JS 代码需重启**（模块代际缓存，文档依据） |
| peer 依赖 | **硬门禁**：不兼容的 DSH peer 依赖直接阻断安装与激活（文档依据；本仓库 `^0.1.2-rc.1` 不接受 `0.2.0-rc.2` 即此类） |
| CLI 现状 | `dsh plugin --profile <name> <pnpm-args...>` 退化为**裸 pnpm 透传**（实测 `--help`）；v0.1 的 `add/update/exec` reconcile 语义命令不复存在 |
| 自装保护 | 对已 `link:` 安装的 bundle 目录重复 `install_bundle` 会被 `ambiguous-install` 拒绝（实测），属预期安全拦截 |

---

## 5. Loader 与事件

**延续不变**：patch 方言（`insert` / 按 id 整体覆盖 / `cordis:group` 嵌套 / `isolate` / `!!js` 仅限 `config` 与 `disabled`）、行 `name` 相对路径锚定、`cordis:include`。

**新增事件**：

```ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    /** volatile 配置已提交进运行中 fiber（无重挂载）；仅发给 owning fiber，值在分发前已全部提交。 */
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
  }
}
```

插件包不必依赖 `cordis-plugin-loader`——在自己包内做同样的接口增强即可获得类型（本仓库做法）。

---

## 6. 保持不变的契约面

- **Host 插件导出形式**：`export function apply(ctx, config)` + 可选 `export const inject` / `export const Config`；资源注册走 `ctx.effect` / `ctx.on` 并返回清理函数。v0.2 完全沿用。
- **工具注册**：`ctx.tools.register({ name, description, parameters, execute, presentResult? })` 签名不变（含 PTC 呈现联合）。
- **凭证服务**：`ctx.get('credentials')` 的 `resolve/describe/set/unset` 及 `~/.dsh/.credentials.yaml` 分层（进程环境变量 > 凭证文件 > `.env`）不变——密码管理层零迁移成本。
- **可选服务注入模式**：`ctx.get('fs')` 逐调用解析、可选服务缺失时优雅降级的写法依旧成立。

---

## 7. 版本坐标与已知陷阱

### 7.1 依赖面对齐（dsh 0.2.0-rc.2 实测坐标）

| 包 | 版本 | 备注 |
|---|---|---|
| `@deepseek-ai/cordis` | 4.0.4 | peer 建议 `^4.0.4` |
| `@deepseek-ai/schemastery` | 3.18.4 | **`.volatile()` 首个可用线**；3.18.1 无此 API |
| `@deepseek-ai/cosmokit` | 1.8.5 | `Volatile<T>` / `isVolatile` / `volatileEntries` / `updateVolatile` |
| `@deepseek-ai/dsh-*` | 0.2.0-rc.2 | 全家 lockstep |

### 7.2 陷阱清单（本仓库实际踩到或规避）

1. **schemastery `^` 范围分裂**：pnpm 锁文件里可能同时存在 3.18.1 与 3.18.4。范围不收紧（`^3.0.0`）时，某个工作区包会链接到 3.18.1——出现"**类型检查通过、运行时 `volatile is not a function`**"的分裂。所有引用点统一 `^3.18.4`。
2. **不要在共享内核标记 volatile**：`.volatile()` 改变 `TypeT<>` 推导（变为 `Volatile<T>`），会把 volatile 词汇泄漏给所有宿主。正确做法：宿主中立内核保持普通 schema，在**宿主适配层**包装 `CoreConfig.volatile()`（本仓库 adt-core vs dsh-plugin 的分层）。
3. **声明可移植性（TS2742）**：包装后的 schema 需显式注解 `const Config: ReturnType<typeof CoreConfig.volatile> = CoreConfig.volatile();`，否则声明文件无法命名类型。
4. **`verbatimModuleSyntax` 下的类型导入**：`import { Context } from '@deepseek-ai/cordis'` 若仅作类型使用也要写 `import type`，否则运行时保留导入、在宿主外多加载一份 cordis 实例。
5. **值提交先于事件**：`loader/volatile-update` 到达时新值**已经**在引用里——监听器直接重读 `config.get()` 即可，不要缓存旧快照再"等同步"。
6. **快照不可变**：volatile 快照深冻结，任何想原地修改配置树的下游代码会抛错；需要可变数据用 `structuredClone`。

---

## 8. 本仓库（dsh-abap-adt 0.12.1）迁移对照

| 变更点 | 位置 | 说明 |
|---|---|---|
| settings 接线移除 → volatile 事件 | `packages/dsh-plugin-abap-adt/src/index.ts` | 删 `ctx.inject(['settings'])` + `installSection`；改为 `ctx.on('loader/volatile-update')` + 引用快照重建注册表；D4 销毁竞态防护保留 |
| Config volatile 包装 | 同上 | `const Config = CoreConfig.volatile()`（宿主层包装，内核保持中立） |
| 预设 bundle | `presets/abap-dev/`（`package.json` + `cordis.patch.yml`） | `preset-abap-adt` 声明行：standard 基底 + ABAP persona + `abap-adt` 插件行（相对路径锚定） |
| CLI 移除 | 删除 `src/cli.ts` / `bin` 字段 / `test/cli.test.ts` | 机制（拷贝 `config/agent-presets` + 写 `.agent-presets`）在 v0.2 完全失效 |
| 依赖对齐 | 各 `package.json` | cordis `^4.0.4`；schemastery `^3.18.4`；cosmokit `^1.8.5`；dsh-tools `^0.2.0-rc.2`；移除 dsh-settings peer |
| 测试 | `test/reload.test.ts` | volatile 接线正/负用例（提交后原地重建 / 销毁竞态 D4），362 项全绿 |
| 遗留清理 | `~/.dsh/.agent-presets/abap-adt/` 删除 | 迁移完成后按规范清理死目录 |

## 9. 通用迁移检查清单（其他插件作者适用）

1. [ ] peer 依赖对齐 `cordis ^4.0.4`、`dsh-* ^0.2.0`；删除 `dsh-settings` 运行依赖（如仅用其类型，改自带增强）
2. [ ] 配置：schema 决定哪些字段热更——在宿主适配层 `.volatile()` 包装；插件 `apply` 的 config 参数类型改为 `Volatile<Config>`；订阅 `loader/volatile-update` 重建状态；保留销毁竞态防护（先置 disposed 标志再排空队列）
3. [ ] 曾用 `settings.yaml` 命名空间的配置：迁入插件行 `config:` / profile patch / 团队 `configFile`（旧文件不会被自动导入）
4. [ ] 预设：目录式改 bundle 声明行；以 shipped `standard.patch.yml` 为基底；插件行可用相对路径锚定仓库检出
5. [ ] 分发文档：`dsh plugin add/exec` 流程改写为 `install_bundle`；说明重启边界（装新 bundle 可 HMR，换包代码需重启）
6. [ ] 版本陷阱自查：schemastery/cosmokit 范围收紧；`import type`；TS2742 注解
7. [ ] 全量测试 + 在真实 profile 安装验证（`application: "applied"` + `list_plugins` 行状态 + 新会话实际选择预设）

## 10. 证据索引

| 结论 | 核验方式 |
|---|---|
| `.agent-presets` 不再被读取 / `config/agent-presets` 不存在 | dsh 安装目录实测 + dsh-agent-preset 技能文档 |
| settings 服务方法面（无 `installSection`） | `cordis_inspect` Service 目录（运行时） |
| settings.yaml 一次性导入并改名 `.imported` | dsh-settings README + 本机 `~/.dsh/settings.yaml.imported` 实存 |
| `_commitVolatile` 流程 / 事件契约 / 监听器容错 | `cordis-plugin-loader` `src/config/entry.ts` 源码 |
| `equalExceptVolatile` 语义 / 重挂载边界 | cordis-plugin-loader README |
| `Volatile<T>` 形态 / 深冻结 / 跨副本识别 | cosmokit `lib/index.js` + `lib/types/volatile.d.ts` 源码 |
| `.volatile()` 类型变换与嵌套限制 | schemastery 3.18.4 `src/index.ts` 源码 |
| 声明行格式 / patch 方言 / 相对路径锚定 | dsh-web-app `presets/*.patch.yml` + 本仓库 `presets/abap-dev` 实装并挂载成功 |
| `install_bundle` 行为 / `ambiguous-install` / `link:` 安装 / `application` 字段 | 本机 web profile 实际安装与 `list_plugins` 验证 |
| CLI 退化为 pnpm 透传 | `dsh --help` / `dsh plugin --help` 实测 |
| schemastery `^` 范围分裂陷阱 | 本仓库迁移实测（运行时 `volatile is not a function` 后修复） |
