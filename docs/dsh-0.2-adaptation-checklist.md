# 适配 DSH 0.2 的改动清单（@wongzexu/dsh-git-status）

> 依据：2026-10-13 隔离试跑实测（0.2.0-rc.2 + 端口 3099）。完整实测记录见 [dsh-0.2-trial-runbook.md](./dsh-0.2-trial-runbook.md)。
> 核心结论：**你的插件代码在 0.2 下实测可用，不需要为"能跑"改任何代码**；需要改的是**清单声明**（且其中一条有实质影响）。

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

## 三、待你实测确认的一处（我无法在 HTTP 层证伪）

客户端用这条链路取当前会话 id（`src/client/index.js` 约 1207 行）：

```js
const sessions = ctx?.get?.('sessions')
const snapshot = sessions?.list?.getSnapshot?.()
// 依次尝试 snapshot.current / current.id / current.sessionId / snapshot.currentId
```

- 已核实：0.2 的 `dsh-session` 仍提供 `sessions` 服务，且 `get(id)`（第 1861 行）、`list()`（第 1868 行）都在；
- **未核实**：`sessions.list.getSnapshot()` 这个**客户端**快照的确切形状。我尝试用 HTTP 直接打路由验证，但发现**该方法在 0.1 上同样返回 404**（需要会话处于加载态），故我的测试手法本身无效——不是 0.2 的差异。诚实标注：这一条我没验证成功。
- 好消息：你的代码已做**多形状兜底**（`current` 为字符串 / `current.id` / `current.sessionId` / `currentId` 四种都试），且失败时返回空串并让服务端拒绝，不会误操作到别的工作区。

**建议的一次性验证**（在 0.2 实例里开一个真会话，点开 Git 面板看是否有数据）：

若面板空且无数据，在 `apply(ctx)` 内临时加一行打印看真实形状：

```js
try {
  const s = ctx?.get?.('sessions')
  console.log('[git-status] sessions service:', s && Object.keys(s), 'list:', s?.list && Object.keys(s.list), 'snapshot:', JSON.stringify(s?.list?.getSnapshot?.()))
} catch (e) { console.log('[git-status] sessions probe failed', e) }
```

拿到真实键名后，把 `currentSessionId()` 的兜底链补上对应分支即可。

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
| 验证/补 `currentSessionId()` 兜底链 | 待实测决定 | 可能 0 行 |
| 声明并享受插件管理面板 | 可选 | 0 行（承第 1 条） |

**代码零改动即可在 0.2 跑起来**——这是实测结论，不是推断。

## 附：本次用到的可复用探针

- `probes/dsh02-trial-probe.mjs` —— boot 图、插件注册、DOM 锚点、悬空 inject 一次性体检
- `probes/dsh02-routes-probe.mjs` —— 路由连通性与状态码语义
- `probes/dsh02-btn-audit.mjs` —— 插件节点可见性审计
- `probes/dsh02-panel-probe.mjs` / `probes/dsh02-e2e-probe.mjs` —— 建会话 + 点开面板的端到端尝试（受无头环境限制，未跑通会话建立）
- `probes/dsh02-shot.mjs` —— 截图 + DOM 摘要
