# 适配 DSH 0.2 的改动清单（@wongzexu/dsh-git-status）

> 依据：2026-10-13 隔离试跑实测（0.2.0-rc.2 + 端口 3099）。完整实测记录见 [dsh-0.2-trial-runbook.md](./dsh-0.2-trial-runbook.md)。
> 核心结论（**2026-10-13 订正**）：插件**清单声明**要改（第 一 节，有实质影响）；且**代码也必须改一处**——
> 0.2 下取当前会话 id 的契约变了，不改则面板提示「当前会话不可用」、所有写操作被拒（第 三 节，已修并实测）。
> 首轮"代码零改动即可在 0.2 跑起来"的结论已被推翻：当时只验证到"路由能应答"，未验证"有会话时面板能否取到数据"。

## 一、必要改动：`peerDependencies` 声明（有实质影响）

### 问题

你的 `package.json` 目前只声明了一个 peer：

```json
"peerDependencies": { "cordis": "^4.0.0-rc.7" }
```

而 0.2 的**版本护栏只看特定前缀的 peer**。证据（0.2 的 `@deepseek-ai/dsh-app-boot` → `evaluatePluginCompatibility`）：

```js
for (const [name, range] of Object.entries(dependencies)) {
  if (name !== "@deepseek-ai/dsh" && !name.startsWith("@deepseek-ai/dsh-")) continue;  // ← 其余全部跳过
  if (requirement.trim() === "" || !semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })) peers[name] = range;
}
```

两条推论：

1. **`"cordis"` 不匹配该前缀 ⇒ 被跳过 ⇒ 你的声明护栏完全不看**，既不产出兼容性判定，也不参与"跳过不兼容插件"的决策。形同虚设。
2. `cordis` 这个包名在本机根本不存在（0.1/0.2 都用 `@deepseek-ai/cordis`），所以它连"被满足"都谈不上——先前静态分析也确认过它属装饰性声明。

**后果**：未来 DSH 升到 0.3 若发生破坏性变更，护栏**不会**拦你，你会直接装上、在运行时才发现问题——而这正是 vision-router 1.7.1 被优雅拦下的机制，你享受不到。

### 改法

```json
"peerDependencies": {
  "@deepseek-ai/dsh": ">=0.2.0-rc.2 <0.3.0-0"
}
```

- 用范围而非精确值，以便将来 0.2.x 补丁版不被误拦。
- 若你想继续兼容 0.1 与 0.2 两代，可写成 `">=0.1.0-rc.6 <0.3.0-0"`——但注意护栏会用**当前运行的 DSH 版本**去 satisfies，跨代声明仍能通过。
- 这条声明同时是**给用户的信号**：`dsh plugin` 安装与插件管理面板都会据此判定兼容性（对比 `@vlln/dsh-navbar` 就声明了 `engines.dsh >=0.1.0-rc.5`，属同一意图）。
- ⚠️ 声明后请**实测一次安装**（`dsh plugin --profile <p> add <pkg>`）确认护栏不再误报；范围写错会被自己的护栏拦下。

## 二、建议改动：清掉悬空的 `dsh.client.inject`

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "inject": ["@deepseek-ai/dsh-client-runtime"], "platform": "web" }
}
```

`@deepseek-ai/dsh-client-runtime` **在 0.2 已被删除**（npm 止于 0.1.1-rc.2；0.2 的 boot 图里 `runtimeInBoot: false`）。实测确认这条悬空声明**无害**（boot 无报错、插件正常挂载、路由正常应答），但：

- 它会被原样带进 0.2 的 boot 图（实测三个插件都在图里带着这条 dangling inject），属误导性元数据；
- 你的客户端**实际上不依赖它**——真正的加载契约是 `window.__ModuleLoader__.load({id, factory})`，这条在 0.2 仍然有效，你与官方插件用的是同一套（`scripts/build-client.js` 的实现与官方一致）。

**建议**：直接删掉整个 `inject` 数组，或换成 0.2 实际注册的模块 id——参考已适配 0.2 的 `dsh-vision-router@3.0.3`，它的 inject 是 `ui-settings, ui-primitives, connection, api-remotes`（**不含** client-runtime）。你与官方 UI 无耦合，**删掉最干净**。

## 三、已结案并修复：0.2 下 `currentSessionId()` 恒返回空串

**症状**（用户报告："git 说会话不可用"）：面板提示「当前会话不可用，请重新选择会话后重试」
（`gitErrSessionRequired`），且暂存/提交/分支/推送等所有写操作直接抛 `session-required`——
不是文案问题，是整条链路停摆。

**根因**：0.1 / better-sidebar 时代的 `sessions.list.getSnapshot().current` 在 0.2 已不存在。

- 0.2 客户端 `sessions` 服务（`@deepseek-ai/dsh-api-session-controller/client`）的 list 快照
  **只有** `{ ids, byId, phase, projectionsBySession }`，唯一写入点即
  `lib/types/client/sessions/service.js` 的 `this.list.set({ ids, byId, phase, projectionsBySession })`
  （初始化同键名）；`SessionListState` 类型定义一致。⇒ `snapshot.current` 与 `snapshot.currentId`
  恒为 `undefined`，四种旧形状全部落空。
- 「主视图选中会话」在 0.2 搬到 **`uiSession`**（`@deepseek-ai/dsh-client-ui-session`，boot 图
  id `ui-session`）：`uiSession.adapter.current`（`SlotScopeAdapter.current`）的 binding `key`
  就是会话 id（其 `publishMain()` 内 `const currentId = this.current.value.key`）。
- 服务端那一环没问题：host 侧 `sessions.get(id)?.header?.cwd`（`dsh-session`）0.2 仍在。

**修法**（已实施：`src/client/index.js` 的 `currentSessionId()`，`npm run build` 重建 `lib/client.js`）：

1. 0.2 权威来源：`ctx.get('uiSession').adapter.current.getSnapshot().key`
2. 0.2 兜底：`sessions.list.getSnapshot()` 里 `byId[id].retainedBy.mainView > 0` 的第一行
   （镜像 `publishMain` 的判定，只依赖 `sessions` 服务，不依赖 UI 包）
3. 保留 0.1 / better-sidebar 旧形状（`current` / `current.id` / `current.sessionId` / `currentId`）

失败仍返回空串、服务端仍拒绝（不回退到别的工作区），这条安全语义不变。

**实测验证**（`~/dsh02` 隔离实例，0.2.0-rc.2 + 端口 3099，探针 `probes/git-session-fix-verify.mjs`）：

| 断言 | 结果 |
| --- | --- |
| 面板打开 | `.open` / `display:flex`，380px |
| 提交行渲染 | 81 行 + 2 个分支标签（真实提交历史） |
| 请求携带会话 | `/git/log?...&session=session-82a55521-…`（3 次） |
| SSE | `/git/events?session=session-82a55521-…` |
| 「会话不可用」提示 | 无（note 元素空且 `display:none`） |

**同源隐患（另一仓库，未修）**：`dsh-companion` 用的是同款旧读法且**没有兜底**
（`sessions?.list?.getSnapshot?.()?.current ?? ''`）；它取不到时服务端会退化成
`workspaceRegistry / process.cwd` 兜底，可能**静默操作错误的仓库**，建议一并修。

## 四、可选收益：用 0.2 的插件管理面板替代手改 profile

0.2 新增 `dsh-plugin-manager`（Web 侧边栏「插件」+ agent 工具），能力包括启停插件条目、选装组合包、安装/删除外部 bundle、以及**兼容性豁免的可视化授权**。

你现在改插件只能手编辑 `~/.dsh/profiles/web/package.json` 和 `cordis.patch.yml`（你 patch 文件里那段中文注释就是踩坑记录）。声明好 `@deepseek-ai/dsh` peer 之后，就能在面板里直接看到并管理，界面也会显示兼容性状态。

## 五、需要留意的行为差异（非必须改动）

| 项 | 说明 |
| --- | --- |
| 会话 UI 迁移 | 会话界面从 `dsh-client-ui-conversation` 迁到 `dsh-client-ui-chat`（`data-chat-flow=""` 锚点两版都在，实测命中） |
| 新 UI 结构 | 0.2 新增 `sidebar-right` / `dockkit` / `ui-session` / `ui-open-in-app` 等；你的面板走 `document.body` 挂载 + 自身 `data-dsc-*` 命名，**未发现冲突**，但视觉层级建议在有会话时目视确认一次 |
| 插件按钮显示时机 | 实测：首页/空会话下插件的按钮与面板容器已创建但 `display:none`（不挂进会话 UI）。这是既有设计，不是 0.2 回归 |
| `config/` 目录 | 0.1 的 `config/agent-presets/**` 已从 0.2 包内移除（presets 改由包提供）。你的插件不依赖它，无影响 |

## 六、一句话总结

| 改动 | 必要性 | 工作量 |
| --- | --- | --- |
| `peerDependencies` 加 `@deepseek-ai/dsh` 范围 | **必要**（否则护栏对你失效） | 1 行 |
| 删除悬空的 `dsh.client.inject` | 建议 | 1 行 |
| 修 `currentSessionId()`（0.2 取会话 id 的契约变了） | **必要**（否则 0.2 下面板全停摆） | 已修（第 三 节） |
| 声明并享受插件管理面板 | 可选 | 0 行（承第 1 条） |

**订正"代码零改动"**：0.2 下插件**能挂载、路由能应答**，但**前端取不到当前会话 id** ⇒ 面板显示
「当前会话不可用」且所有写操作被拒。第三节的修复是 0.2 可用的前置条件（2026-10-13 隔离实例实测验证）。

## 附：本次用到的可复用探针

- `probes/dsh02-trial-probe.mjs` —— boot 图、插件注册、DOM 锚点、悬空 inject 一次性体检
- `probes/dsh02-routes-probe.mjs` —— 路由连通性与状态码语义
- `probes/dsh02-btn-audit.mjs` —— 插件节点可见性审计
- `probes/dsh02-panel-probe.mjs` / `probes/dsh02-e2e-probe.mjs` —— 建会话 + 点开面板的端到端尝试（受无头环境限制，未跑通会话建立）
- `probes/dsh02-shot.mjs` —— 截图 + DOM 摘要
- `probes/git-session-fix-verify.mjs` —— **端到端回归断言**：打开侧栏真实会话 → 点 `[data-dsc-toggle]`
  开面板 → 断言请求带 `session=`、提交行 > 0、无「会话不可用」提示（`ok:false` 时退出码 1）。
  ⚠️ 需要带 launch token 的 URL（裸 `127.0.0.1:<port>/` 返回 401）：`dsh web` 启动时打印的那条。
- `probes/git-session-console-probe.mjs` / `git-session-locate.mjs` / `git-session-dom-discovery.mjs` —— 诊断用：
  抓页面异常、定位侧栏会话行、转储 `data-*` 结构。
