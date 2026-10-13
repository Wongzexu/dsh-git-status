# DSH 0.1.0-rc.6 → 0.2.0-rc.2 升级提案

> 状态：**提案待确认**，未执行任何升级动作。
> 调研日期：2026-10-13 · 调研方式：解包两个版本的 npm tarball 逐项对照（证据为文件路径 / 包内代码，非猜测）

## 一、现状（实测）

| 项 | 值 |
| --- | --- |
| 已装版本 | `@deepseek-ai/dsh` **0.1.0-rc.6**（2026-08-13 发布） |
| 安装形态 | 全局 npm 包 `~/.npm-global/lib/node_modules/@deepseek-ai/dsh`，**无源码树**（无 `apps/` `packages/` `src/`） |
| 安装时间 | 2026-08-14 10:23（包内所有文件同一时间戳＝解包产物） |
| 运行进程 | `node .../bin/dsh web`，PID 22176，2026-10-13 10:21 启动，监听 `127.0.0.1:3080` |
| 构建监听 | **无**（无 vite/esbuild/rollup/tsc/pnpm watch 进程） |
| 前端 | 预构建静态产物 `dsh-web-frontend/dist/`，由 host 直接托管 |
| 自更新机制 | **无**（`lib/*.js` 内无 update-notifier / latest-version / upgrade 逻辑） |
| npm 最新 | `latest` = **0.2.0-rc.2**（2026-09-29）· `alpha` = 0.2.1-alpha.2（2026-10-09） |

结论：当前 DSH 是**静态发布版的冻结安装**，不会自动更新；落后约 2 个月、跨一个大版本（0.1 → 0.2）。

**唯一的"实时"部分是配置文件**：0.1 的 `dsh-settings-file` 用 chokidar 监听 `~/.dsh/settings.yaml`（`watch: config.watch ?? true`），手改即热生效。

## 二、升级的风险点（隔离试跑后已重新定级）

> **2026-10-13 试跑结论已并入本节**：环境 `~/dsh02/{home,prefix}` + 0.2.0-rc.2 + 端口 3099。完整实测记录见 [dsh-0.2-trial-runbook.md](./dsh-0.2-trial-runbook.md)。
> 一句话：**0.2 自带版本护栏，风险比静态分析预估的低得多；三个自定义插件实测无需改动即可用。**

### ✅ 已关闭：`dsh-client-runtime` 被删除（原 B1）

0.2 确实删了该包（npm 止于 `0.1.1-rc.2`，boot 图 `runtimeInBoot: false`），而你的三个插件都在 `dsh.client.inject` 里声明它。**试跑实测：boot 无报错、插件正常进图、DOM 正常挂载、自造路由正常应答** ⇒ 悬空 inject 确认为**无害的声明残留**，不再是升级前置条件（清理与否随意）。

### ⚠️ 唯一必须动手：`vision-router` 版本不兼容（原 B3，且 0.2 会自己拦下来）

**0.2 有内建版本护栏**：启动时校验 peer，不兼容的 bundle **优雅跳过并打印精确放行命令**，而不是崩溃：

```
dsh: skipping profile bundle "dsh-vision-router": Plugin dsh-vision-router@1.7.1 is incompatible
with dsh 0.2.0-rc.2: peerDependencies {...}. ... grant the exact-version exemption with
`dsh plugin allow-version` ... Exact-version exemption: not active.
```

- 这从"装上才发现崩"变成了"明确跳过 + 指引"，风险显著下降。
- 但**不升就少功能**：vision-router 会整个不加载。正确做法是升到 `>=2.3.0`（推荐 `latest` = **3.0.3**）。
- `^1.7.1` 的 caret 上界是 `<2.0.0`，**只可能刷到 1.7.7，永远到不了 3.x**，必须手改版本号。
- 支持 0.2.x 的**首个**版本是 `2.2.6`（2026-09-28）；`2.3.0`（2026-10-01）起收窄为 `>=0.2.0-rc.2 <0.3.0-0`；`3.0.0` 起才摘掉 `dsh-client-runtime`。
- 3.0.3 已逐项核实**可作为升级目标**：三个 DSH peer（`dsh-llm-deepseek` / `dsh-storage-domain` / `dsh-anonymous-user-id`）在 0.2.0-rc.2 均存在；`dsh.bundle.patch` 机制保留；设置命名空间仍是 `'vision-router'`（你的 `onboardingSeen` 可沿用，3.0.3 另外新增 `-mode` 等子命名空间）。
- 试跑实测：护栏拦下 1.7.1 时**只跳过它，其余插件与整个应用照常启动**——不会连带失败。

- npm 上该包只有 11 个版本，止于 `0.1.1-rc.2`；`0.2.0-rc.2` 返回 **HTTP 404**。
- 0.2 前端 bundle（`dsh-web-frontend/dist/assets/index-*.js`）中 `"@deepseek-ai/dsh-client-runtime"` 注册数为 **0**。
- 而下列本地插件的 `package.json → dsh.client.inject` 全部声明了它：

| 插件 | 本地版本 | `dsh.client.inject` 中的 runtime | 性质 |
| --- | --- | --- | --- |
| `dsh-vision-router` | 1.7.1 | ✅ | 第三方（npm） |
| `@wongzexu/dsh-git-status` | 1.0.0 | ✅ | **本仓库（开发版 link）** |
| `dsh-companion` | 0.1.1 | ✅ | 本地 link |
| `@dsh-external/dsh-navbar` | 0.3.0 | ✅ | github `vlln/dsh-navbar#main` |

**好消息（已核实，比初版判断更乐观）**：这些插件只是"声明"依赖，**并未实际调用** client-runtime 的 API（`grep` 客户端产物与源码均无 `SlotRegistry`/`runtime` 消费）；而且 0.2 的加载器**对悬空 inject 是静默跳过而非抛错**——`dsh-client-modules/lib/client.js` 的 `arriveGraphRow()`：

```js
for (const packageName of row.inject) {
  const dependency = this.graphRows.get(packageName);
  if (dependency !== void 0) await this.arriveDependency(row.id, dependency, [], visited);
}   // ← 图里没有该 id 就什么都不做，不 throw
```

⇒ 悬空 inject 的后果是**"该声明失效"而非"启动失败"**，属可接受残余风险（仍建议按 0.2 实际模块 id 修正，见阶段 2）。

插件真正依赖的契约在 0.2 均保留：

- 0.2 前端 boot 仍要求 `window.__ModuleLoader__`（`web boot: window.__ModuleLoader__ bootstrap facade is missing`），`dsh-client-modules` 仍以 `window.__ModuleLoader__.load({id, factory})` 注册 —— 与本仓库 `scripts/build-client.js` 的契约**一致**。
- 面板锚点 `data-chat-flow` 在 0.2 仍存在：该属性从 `dsh-client-ui-conversation` 迁到 `@deepseek-ai/dsh-client-ui-chat@0.2.0-rc.2`（24 处），空值形态一致（均为 `data-chat-flow: ""`），故 `document.querySelector('[data-chat-flow=""]')` 仍可命中。
- 插件 node half 声明的 `webServer` / `workspaceRegistry` / `sessions` 三个服务，0.2 中均仍在（`dsh-host-webserver: super(ctx,"webServer")`、`dsh-workspace: super(ctx,"workspaceRegistry")`）。

### B2 `~/.dsh/settings.yaml` 在 0.2 被废弃：启动时自动改名迁移

0.2 的 `dsh-settings` 含 `importLegacyDocument()`，在 Loader 收敛后执行：

```js
const path = join(profile.home, "settings.yaml");
if (!existsSync(path)) return;
const imported = `${path}.imported`;
await rename(path, imported);          // ← 先改名，再做一次性导入
const sections = parse(await readFile(imported, "utf8"));
for (const [section, values] of Object.entries(sections ?? {})) {
  const ns = LEGACY_SECTION_ENTRIES[section] ?? section;
  try { await this.update(ns, values); }
  catch (error) { /* 只 warn，该段留在 .imported 里 */ }
}
```

配套映射表（`LEGACY_SECTION_ENTRIES`）：

```js
{ "ui-developer-tools": "ui-settings",
  "ui-onboarding":      "ui-settings-general",
  shell: process.platform === "win32" ? "pwsh-sandbox" : "bash-sandbox" }
```

对你的 `~/.dsh/settings.yaml` 逐段影响（每段均已按 0.2 的实际 bundle 条目核对）：

| 现有段 | 0.2 行为 | 风险 |
| --- | --- | --- |
| `ui-onboarding` | 映射到 `ui-settings-general` | 低 |
| `llm-pi-ai`（opencode-go / apiKeyEnv） | 原样按同名牌导入 | 中（键未变，该 entry 仍在 `dsh-base` 内，待实跑确认） |
| `agent-default-model` | 原样导入；`dsh-base@0.2.0-rc.2` 的 `cordis.patch.yml:82` 仍是 `- id: agent-default-model` → `@deepseek-ai/dsh-agent-default-model`，schema 仍为 `provider`/`model`/`reasoningEffort` | **低（已核实）** |
| `vision-router`（onboardingSeen） | 原样导入，但由第三方插件提供 → **插件不加载则该段导入失败** | 中 |
| `llm-deepseek`（models: deepseek-v4-pro / deepseek-flash） | **键名仍为 `llm-deepseek`**：0.2 的 `dsh-base/cordis.patch.yml:525` 是 `- id: llm-deepseek` → 包名换成 `@deepseek-ai/dsh-llm-deepseek-api-key`（另加 `- id: llm-deepseek-account`）。`models: z.array(catalogModel)` 与 `contextWindow` 字段仍在（该 schema 仍由 `@deepseek-ai/dsh-llm-deepseek` 的 `deepSeekConfigFields` 提供） | **低（已核实）** |

> ⚠️ 曾担心的"`llm-deepseek` 被拆分导致 models 配置丢失"：**不成立**。0.2 只是把包拆成 `-account` / `-api-key`（`dsh-llm-deepseek` 本体降为共享 schema 库），**条目 id 保持 `llm-deepseek` 不变**，你的自定义模型清单可原样迁移。

**回滚副作用（关键）**：`settings.yaml` 被改名成 `settings.yaml.imported` 后，若降级回 0.1，旧版本读不到它 → 表现为**所有设置丢失**（模型、vision-router onboarding、onboarding 状态）。可用备份一次性还原。

### B4 `@deepseek-ai/dsh-settings-file` 在 0.2 不存在（HTTP 404）

设置改由 `dsh-settings` + `configEditor` 统一管：编辑写入 **profile patch 文档**（试跑实测确认，见下）。含义：**0.2 不再监听 `~/.dsh/settings.yaml`**，那个"改文件即热生效"的便利在 0.2 由 profile 层的设置界面/文件取代。

## 三、兼容性小结

| 面向 | 0.1.0-rc.6 | 0.2.0-rc.2 | 判定 |
| --- | --- | --- | --- |
| `__ModuleLoader__.load({id, factory})` | 有 | 有（`dsh-client-modules`） | ✅ 客户端代码可复用 |
| `webServer` / `workspaceRegistry` / `sessions` | 有 | 有（同名 `super(ctx, …)`） | ✅ node half 可复用（试跑实测路由正常应答） |
| `dsh-client-runtime` | 有 | **删** | ✅ 悬空 inject **实测无害**（已关闭） |
| `~/.dsh/settings.yaml` | 主配置 + watch | **废弃 + 自动改名迁移** | ⚠️ 迁移有回滚陷阱；4/5 段实测成功 |
| `dsh-settings-file` | 有 | **删** | ℹ️ 行为变更（改由 configEditor 管） |
| 会话数据（`session.jsonl.zstd`） | **格式 v0** | **格式 v4**，内置 v0→v4 冻结迁移链 | ⚠️ 可读并自动迁移，但**落盘文件名分代**，降级后新数据读不到（见七·2） |
| `~/.dsh/storages/*.json` | 有 | 同在 | ✅ |
| profile 机制（`cordis.yml` + `cordis.patch.yml` + `dsh.profile.bundles` + `link:` 依赖） | 有 | 保留 | ✅ 迁移成本低 |
| 依赖声明风格 | `^0.1.0-rc.6` 浮动 | **精确固定 `0.2.0-rc.2`** | ℹ️ 混装风险更低 |
| 包结构 | 含 `config/`（agent-presets） | **只发 `lib/**`**；presets 改由包提供 | ✅ 试跑正常启动，无阻断 |
| node | v24.16.0（本机） | 两个版本均未声明 `engines` | ✅ 无阻断 |

会话数据兼容性（两轮验证 + 试跑，结论已修正）：键名层面两版无差异（0.2 只是把落盘拆到 `worker.cjs`），但**底层有格式版本**——0.2 是 **v4**，内置 `v0-to-v1` → `v3-to-v4` 完整冻结迁移链，v0 codec 明确认识 `seedLength` 并映射为 `isSeeded`。本机 44 个会话全为 **v0 命名形态**；试跑实例自建会话后生成的是 **`session.v4.jsonl.zstd`**（实测）。⇒ 升级后旧会话可读并自动迁移到 v4；但降级风险见第七节。

## 四、0.2 带来的新能力（与你的使用相关的部分）

依赖集合：runtime 依赖 **61 → 82**（其中 `dsh-*` 74 个，全部精确钉到 `0.2.0-rc.2`），新增 23 个、移除 2 个（`cordis-plugin-hmr` → `dsh-hmr`；`dsh-workflow-worker-thread` → `dsh-workflow-ptc`）。新增里对你可能有实际价值的：

| 能力 | 包 | 一句话 |
| --- | --- | --- |
| **插件可视化管理** | `dsh-plugin-manager` | Web 侧边栏与 agent 工具共用的插件/组合包管理：启停条目、选装 bundle、安装删除外部 bundle |
| **会话内标注交付物** | `dsh-tool-present` | `present` 工具：声明交付的最终文件（含 shell 命令创建的），记录路径不复制内容；已进默认 Web 组合（`presets/standard.patch.yml`） |
| **Office 文档处理** | `dsh-skill-office` | 随包 Word / PowerPoint / Excel 工作流与结构检查 skill，含内置 Python 环境 |
| **桥接已有 hooks** | `dsh-hooks-claude-code` / `dsh-hooks-codex` | 直接跑你现有的 Claude Code / Codex `hooks.json` command 钩子 |
| **出站代理** | `dsh-http-proxy` | 从标准代理环境变量解析一次，装为 undici 全局 dispatcher，覆盖 LLM / 搜索 / MCP 流量 |
| **Webhook 触发会话** | `dsh-webhook` + `-github` | 带签名的 GitHub webhook → 在 Web Workspace 创建根会话（动作只有这一种） |
| **MCP 资源** | `dsh-mcp-resources` | 按需发现/读取 MCP 资源的三个共享工具 |
| **持久 pwsh** | `dsh-tool-pwsh-persistent` | 每个 agent 一个 shell，跨调用保留 cwd/环境变量/函数 |
| **自动化任务** | `dsh-experimental-schedule-bundle` | 补上发行版 Web 组合**不含**的 `time-context`/`schedule`/`ui-schedule` 三个条目（默认禁用） |
| **agent 子插件声明式化** | `dsh-agent-preset` | 用普通 Cordis YAML 声明 agent 的子插件列表，多 preset 并存 |
| **工作流改沙箱运行** | `dsh-workflow-ptc` | `agent()`/`parallel()`/`pipeline()`/`phase()`/`log()` 钩子保留，改在沙箱化 Node 运行时执行 |
| **切面改动即热重载** | `dsh-hmr` | 模块替换、Include 刷新、profile 配置变更共用一条协调队列（取代 `cordis-plugin-hmr`） |

另有 4 个默认关闭的实验特性（Agent Teams、逐调用 Auto review、语音输入、SDK/ACP profile 组合），与日常使用无关，需要时再评估。

**注意一个与本仓库插件相关的静默风险**：0.2 的 bundle 条目 id 变动很大（`dsh-base` 78 → 94 条、`dsh-web-app` 78 → 112 条，`client-runtime` / `code-runtime` / `agent-presets` / `api-gateway` / `hmr` 等条目被移除）。第三方 bundle 的 `cordis.patch.yml` 若**按旧 id 做覆盖或禁用**，在 0.2 会命中不到而**静默失效**。你现在 `~/.dsh/profiles/web/cordis.patch.yml` 的 patch 层是空数组 `[]`，暂时不受影响，但四个第三方插件各自带 patch，升级后需逐个确认其目标 id 仍存在。

## 五、建议路径（先验证、再切换）

**阶段 0 · 备份（不可省）**
```bash
cp ~/.dsh/settings.yaml ~/.dsh/settings.yaml.bak-0.1
cp ~/.dsh/profiles/web/package.json ~/.dsh/profiles/web/package.json.bak-0.1
cp ~/.dsh/profiles/web/cordis.patch.yml ~/.dsh/profiles/web/cordis.patch.yml.bak-0.1
# 会话目录也要备（降级时 v4 文件在 0.1 里读不到，见第七节）
tar czf ~/dsh-0.1-backup-$(date +%F).tgz -C ~ .dsh/settings.yaml .dsh/profiles/web/package.json .dsh/profiles/web/cordis.patch.yml .dsh/profiles/web/pnpm-lock.yaml .dsh/sessions
```

**阶段 1 · 隔离试跑（不动现有 3080 实例、不动 `~/.dsh`）**

用一个独立的 `DSH_HOME` + 独立端口跑 0.2，直接验证 B1（插件是否加载）与 B2（设置是否迁移成功）：
```bash
mkdir -p ~/dsh02/home ~/dsh02/prefix
cp -r ~/.dsh/profiles ~/dsh02/home/profiles     # 带上你现有的 profile 与插件
cp ~/.dsh/settings.yaml ~/dsh02/home/            # 迁移实验在副本上做
npm i -g --prefix ~/dsh02/prefix @deepseek-ai/dsh@0.2.0-rc.2
DSH_HOME=~/dsh02/home ~/dsh02/prefix/bin/dsh web --port 3099
```
验证清单：① `@wongzexu/dsh-git-status` 面板是否出现；② vision-router 是否仍在设置里；③ `~/dsh02/home/settings.yaml` 是否变成 `.imported` 且各段成功落库；④ 前端是否有 inject 相关报错。

**阶段 2 · 按试跑结果改配置**
- `~/.dsh/profiles/web/package.json`：`"dsh-vision-router": "^1.7.1"` → `"^3.0.3"`。
- 本仓库 `@wongzexu/dsh-git-status` 的 `dsh.client.inject`: `["@deepseek-ai/dsh-client-runtime"]` → 换成 0.2 实际存在的模块 id（由阶段 1 的结果定；3.0.x 的 vision-router 已示范了目标形态）。改完需重新 `node scripts/build-client.js`。
- `dsh-companion` / `dsh-navbar` 同理（若其上游未适配，需 fork 或临时摘除对应 bundle）。

**阶段 3 · 正式切换**
```bash
npm i -g @deepseek-ai/dsh@0.2.0-rc.2     # 沙箱内会被拒（npm cache EROFS），需在你的终端执行
# 重启 dsh web（我不会自行 kill 你的进程，需你确认）
```

**回滚**
```bash
npm i -g @deepseek-ai/dsh@0.1.0-rc.6
cp ~/.dsh/settings.yaml.bak-0.1 ~/.dsh/settings.yaml     # 关键：还原被改名的设置
cp ~/.dsh/profiles/web/package.json.bak-0.1 ~/.dsh/profiles/web/package.json
```

## 六、我未验证的点（不做无据承诺）

1. ~~悬空 inject 是否致命~~ —— **已核实为静默跳过**（见二·B1），但真实运行时的最终表现仍未实跑。
2. `dsh-vision-router` 1.7.1 → 3.0.3 跨两个大版本：peer、patch、设置命名空间已核实兼容，但**功能面变化**（新增 `-mode` 等子命名空间、结构化流程改动）未逐条读完。
3. `dsh-companion` 是否已有适配 0.2 的版本（本机 link 版本 `0.2.0`，npm 上最高 `0.1.1`；该包零依赖、零 `@deepseek-ai/*` 引用，风险面小）。
4. 0.2 启动是否仍需要 `config/agent-presets`（0.2 发行包已不含 `config/`，presets 改由 `dsh-agent-presets` 等包提供）。
5. 0.2 官方 README 无升级/迁移说明（`README.zh.md` 仅 64 行，无 breaking-change 段），故上述结论均来自包内代码对照而非官方文档。
6. 更激进的选项未评估：`0.2.1-alpha.2`（2026-10-09，alpha 通道）。
7. **`dsh.bundle.patch` 单字符串形态在 0.2 是否仍被接受**：0.2 多个官方包里已出现**数组**形态（如 `["./cordis.patch.yml","./presets/*.patch.yml"]`），而你四个插件都用单字符串。已明确支持 0.2 的 `dsh-vision-router@3.0.3` 同样用单字符串，故判断仍被支持，但未实跑。
8. **0.2 的 UI 重组可能改变面板挂载点**：会话 UI 迁到 `dsh-client-ui-chat`、新增 `dsh-client-ui-dockkit` 等；`data-chat-flow=""` 锚点已核实存在，但挂载层级与相邻元素结构未验证。

## 七、降级与回滚的真实边界

分三块看，风险差别很大：

**1 · `settings.yaml`：行为上不可逆（最大）**

0.2 启动即 `rename(settings.yaml → settings.yaml.imported)`，随后把各段写进**profile 的 patch 文档**；而 0.1 **只认** `~/.dsh/settings.yaml`，既不读 profile patch 里的配置，也不读 `.imported`。

⇒ 「用 0.2 跑过一次再降级回 0.1」的结果是：settings.yaml 不存在，0.1 回落默认值（onboarding 状态、默认模型、`reasoningEffort`、deepseek models 覆盖、pi-ai providers 全部丢失）。原值是纯文本副本，**可手工 `mv settings.yaml.imported settings.yaml` 还原**，但要注意两点：

- 0.2 之后在 UI 里做的改动写在 **profile patch** 里，回迁到 0.1 后**不会跟随**；
- **导入失败的段只留在 `.imported` 里**，降级前必须先看日志确认哪些段没进去。

**2 · sessions：可降级，但有文件名分代陷阱**

| 代 | 文件名 |
| --- | --- |
| v0（你现在 44 个会话） | `session.jsonl.zstd` |
| v4（0.2 写入） | `session.v4.jsonl.zstd` |

0.1 的路径解析只认无代号形式。所以：

- 升级后**不碰**旧会话 → 降级回去仍能读（v0 文件原样在）。
- 在 0.2 里**继续对话** → 新事件落到 v4 文件；降级回 0.1 后这部分读不到，若 0.1 又按 v0 文件续写，同一会话目录下会**两份并存、内容分叉**。

⇒ 跨版本来回切之前，请整体备份 `~/.dsh/sessions`（当前约 20MB）。另外我**未找到** 0.2 会删除 v0 源代文件的证据（只找到"按代命名 + 校验两侧 basename"的代码），但这是"未查到否证"，不等于已证明安全。

**3 · 插件与 bundle：必须整体重装**

74 个 `dsh-*` 全部精确钉版本、移除 2 包、新增 23 包 ⇒ 回退不能只改版本号。且 0.1 的 `config/agent-presets/**` 已从 0.2 包内删除（preset 改由 web-app 内 `presets/*.patch.yml` 声明），两版包混装会出现 preset 找不到。

## 八、升级前后各查一次日志（可操作的验收点）

升级后立刻在 DSH 日志里搜两类关键字：

- `settings: imported` —— 迁移发生的确认
- `settings: section ... was not imported` —— **哪一段没进去**（按 `vision-router` 的判断，最可能命中的是它）

然后确认 profile patch 文档里确实出现了 `ui-settings-general` / `agent-default-model` / `llm-deepseek` / `llm-pi-ai` 四段的字段；再打开一个旧会话验证可读，并留意目录里是否新出现 `session.v4.jsonl.zstd`。

## 九、顺手发现的一个独立隐患（与升级无关，建议单独处理）

`~/.dsh/profiles/web/package.json` 里导航栏依赖写的是**未 pin 的** `"@dsh-external/dsh-navbar": "github:vlln/dsh-navbar#main"`，而本机实装是 `0.3.0`。

已核实的三方不一致：

| 来源 | 包名 | 版本 | peer / engines |
| --- | --- | --- | --- |
| 本机实装 | `@dsh-external/dsh-navbar` | 0.3.0 | `cordis ^4.0.0-rc.7`（非 scoped） |
| npm `@vlln/dsh-navbar` 0.3.0 | `@vlln/dsh-navbar` | 0.3.0 | `@deepseek-ai/cordis ^4.0.1`，`engines.dsh >=0.1.0-rc.5` |
| npm `@vlln/dsh-navbar` 0.4.0 | `@vlln/dsh-navbar` | 0.4.0 | 同上 |
| `@dsh-external/dsh-navbar` | — | **npm 404** | 这个名字不在 npm 上 |

即"profile 声明的键名 / 本机实装 / 上游当前版本"**三者互不相同**：本机实装的 0.3.0 是 `@dsh-external` 作用域（peer 用非 scoped `cordis`），而上游同名 0.3.0 早已是 `@vlln` 作用域（peer 用 `@deepseek-ai/cordis`）——说明本机这份早在某次改动中就与上游分叉了。

后果：任何一次 `pnpm install` 都会拉到 main HEAD，装成改名后的 `@vlln/dsh-navbar@0.4.0`（落在 `node_modules/@vlln/dsh-navbar`），而 profile 的依赖键与 `cordis.patch.yml` 里的 `name:` 仍是 `@dsh-external/dsh-navbar` → 加载器按键名找不到包（与你 `cordis.patch.yml` 注释里记录过的那次故障同型）。

两种收尾方式，选其一：

1. **保守（不动现有可用版本）**：pin 到你验证过的 commit，如 `"github:vlln/dsh-navbar#<commit>"`，避免漂移；缺点是长期停在已分叉的 `@dsh-external` 版本上。
2. **对齐上游（推荐，但要一起改三处）**：profile 依赖键、`cordis.patch.yml` 里的 `name:`、以及 pin 的版本标签（`github:vlln/dsh-navbar#v0.4.0` 或 npm 的 `@vlln/dsh-navbar@^0.4.0`）三处同时改成 `@vlln/dsh-navbar`。

无论哪种，都建议与 DSH 升级**分开做、分开验证**，避免两个变量混在一起难定位。

## 附：本次调研用到的证据路径

- 0.1 安装：`~/.npm-global/lib/node_modules/@deepseek-ai/dsh/`
- 0.2 解包：`.dsh-upgrade-probe/x-dsh*/`（临时产物，已在 `.gitignore` 忽略）
- 迁移代码：`x-dsh-settings/package/lib/index.js` 第 302–368 行
- 前端加载契约：`x-dsh-client-modules/package/lib/index.js` 第 456 行、`x-dsh-web-frontend/package/dist/assets/index-*.js`
- 插件侧：`~/.dsh/profiles/web/node_modules/{dsh-vision-router,@dsh-external/dsh-navbar}/package.json`、本仓库 `package.json`
- 悬空 inject 跳过：`x-dsh-client-modules/package/lib/client.js` 第 656–659 行
- 0.2 条目 id 清单：`x-base02/package/cordis.patch.yml`（`llm-deepseek` 第 525 行、`agent-default-model` 第 82 行）
- 会话持久化对照：`x-sp-0.1.0-rc.6/` 与 `x-sp-0.2.0-rc.2/`
- 会话格式版本：`x-dsh-session/package/lib/index.js:56`（`SESSION_FORMAT_VERSION = 4`）、`x-sp-0.2.0-rc.2/package/lib/index.js:761`（`generationLogFilename`）
- 迁移链装配：`https://registry.npmjs.org/@deepseek-ai/dsh-session-format-catalog/0.2.0-rc.2`（deps 含 `v0-to-v1`…`v3-to-v4`）
- bundle 条目清单对照：`x-base02/package/cordis.patch.yml`、`x-dsh-web-app/package/cordis.patch.yml`
- 新能力一句话来源：`.dsh-probe/unpacked/<pkg>/package/README.zh.md`（registry 的 readme 字段为空，故取自包内 README）
- navbar 包名：`https://registry.npmjs.org/@vlln/dsh-navbar`（0.3.0/0.4.0，peer 均为 `@deepseek-ai/cordis ^4.0.1`、`engines.dsh >=0.1.0-rc.5`）vs `@dsh-external/dsh-navbar`（404）；本机实装 0.3.0 带 `@dsh-external` 名与非 scoped `cordis` peer
