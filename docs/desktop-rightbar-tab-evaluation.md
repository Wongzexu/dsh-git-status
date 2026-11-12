# 桌面端右侧栏 Tab 版评估（A 方案）

> 分支：`feat/desktop-rightbar-tab`  
> 日期：2026-11-09  
> 结论：**A 方案可行且已落地第一版**。官方扩展 API 能支撑“Git 状态”作为右侧栏 tab 运行；现有浮窗 DOM 通过 `docked` 分支复用，设置面板提供「默认位置：浮窗 / 侧边栏」。

## 0. 实现状态（2026-11-09）

已在分支上实现：

- **设置 → 风格设置 → 默认位置**：`浮窗` / `侧边栏`；立即生效并持久化到 `dsc-git-settings`。
- **默认值**：桌面端（`dsh-app://` / `data-windows-titlebar` / `data-platform=darwin`）为 `侧边栏`；普通 Web 为 `浮窗`。
- **侧边栏模式**：注册 `sidebarRightTabs` 类型 + `sidebar.right.pane.tab` Body + guide 卡片；不在页面挂浮窗/开关。
- **docked 布局**：复用现有 DOM，去掉 fixed/拖拽/开关/位置记忆，`height:100%` 填满右侧栏；隐藏重复标题与关闭按钮。
- **会话绑定**：Body 的 `sessionId` 直接绑定到 `currentSessionId()`，SSE/轮询/写操作跟随 tab 会话。
- **切换生命周期**：浮窗 → 侧边栏自动打开 tab；侧边栏 → 浮窗自动展开浮窗；注销类型/关闭 tab/恢复样式表。
- **后台 tab 暂停**：`tab.visible === false`（后台会话）时暂停 10s 轮询与 SSE，切回前台补一次刷新；tab 关闭/插件卸载时 `tab.signal` abort 提前走同一份清理。
- **语言跟随**：侧边栏模式下切换 DSH 语言会重挂载面板（DOM 文案在挂载期固化，必须整体重建才能刷新）。
- **升级提示**：桌面端首次进入侧边栏模式提示一次「可在 设置 → 风格设置 → 默认位置 改回浮窗」。
- **React 不可用**：回退浮窗并把偏好落盘为 `float`，避免设置行与实际呈现不一致。
- **非 git 仓库**：设置页仍显示风格设置，可切换默认位置（用户信息/远程配置仍隐藏）。

已用 webprobe 在隔离 DSH 0.2 实例（真实 git 仓库会话）验证：

| 用例 | 结果 |
|---|---|
| 设置行 | 出现「默认位置 ? 浮窗 ▾」；菜单 `✓ 浮窗 / 侧边栏` |
| 浮窗 → 侧边栏 | 右侧栏 tab 自动打开；docked 面板 `575×782`，86 行 commit，无浮窗/开关残留 |
| 侧边栏 → 浮窗 | tab 关闭；浮窗回到 `x=888,y=96,w=380,h=590`；开关 `x=1238,y=66` |
| 宽度 1280 / 1000 / 640 / 520 | docked 面板分别 `575 / 575 / 639 / 519` 宽，均填满右侧栏；`scrollWidth == innerWidth`，无横向溢出 |
| tab 关闭 | 面板/根节点卸载；右侧栏收起；展开 → guide → 「Git 状态」可重新打开（86 行） |
| 右键菜单 | 在 docked 面板内右键，菜单 `160×140` 完全在视口内，暂存/提交/放弃项可用 |
| 模式持久化 | 写入 `defaultMode` 后 reload 仍保持对应模式 |
| 浅色主题 | 面板文字 `#0f1115`（白底/右侧栏）；行内详情底色 `#f5f6f7`；diff 底 `#f9fafb`；按钮文字 `#61666b`；徽标颜色按主题混合加深 |
| 深色主题 | 面板文字 `#f9fafb`；行内详情底色 `#2c2c2e`；diff 底 `#1b1b1c`；徽标颜色按主题混合提亮 |
| 回归 | `npm test` 269 用例全过 |

待办：

- [ ] Windows/macOS 官方桌面端真机验收（顶栏 40/48px、macOS 红绿灯、右侧栏 fullscreen、剪贴板/SSE）。
- [ ] 从浮动切到侧边栏时若右侧栏没有空间/服务不可用，增加自动回退提示（React 不可用已回退浮窗并落盘 `float`；服务未就绪时仍无 UI）。
- [ ] 手动把 localStorage 改成 float 而遗留的 Git tab 清理（正常设置切换已关闭 tab）。
- [ ] 可选的 header 快捷入口/快捷键（当前入口为右侧栏 guide 卡片；关闭 tab 后需展开右侧栏再点 guide）。

## 1. 为什么要评估 A

实测桌面端默认窗口 `1280×820` 下，现有浮窗与 DSH 右侧栏冲突：

| 场景 | DSH 右侧栏 | Git 浮窗 | 结果 |
|---|---|---|---|
| 1280×820 | x=704、宽 576px | x=888、宽 380px | 浮窗整幅压住右侧栏 |
| 1000×700 | x=550、宽 450px | x=608、宽 380px | 仍 380px 全宽重叠 |
| 640×700 | 右侧栏自动全屏 | x=248、宽 380px | 浮窗浮在全屏右侧栏上 |

A 方案把 Git 面板变成右侧栏的一个 tab，和 Files / Terminal 同级，从根上消除遮挡、开关碰撞和窄窗口问题。

## 2. API 验证（已跑通）

在隔离的 DSH 0.2 Web 实例（`DSH_HOME` 独立，仅加载 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 与本插件）中验证：

1. **`require('react')` 可用**：client bundle 由 `__ModuleLoader__` 的 factory 提供 `require`；与官方 decoration 模板一致。
2. **tab 类型注册成功**：`ctx.sidebarRightTabs.register({ id, kind, title, guide })` 后，右侧栏 guide 页面出现：
   - `data-sidebar-right-guide-entry=git-status`
   - 文案「Git 状态 / 在右侧栏查看提交图与分支操作」
3. **点击 guide 卡片打开 tab**：tab 标题显示「Git 状态」，右侧栏自动展开。
4. **Body 拿到会话上下文**：
   - `sidebar.right.pane.tab` 的 Body 收到 `sessionId=session-46b7f832-...`
   - `useTabInfo()` 返回 `tab.id=tab3` 等信息
   - Body 根节点渲染在右侧栏 `x=705, y=38, w=575`（tab strip 下方，铺满 pane 宽度）
5. **直接打开**：`ctx.sidebarRight.openTab('git-status')` 可从插件按钮/快捷键打开或聚焦该 tab。
6. **宿主路由无需改动**：现有 `/plugins/dsh-gitstatus/*` 路由仍按 `session=` 解析工作区；tab 只要把 `sessionId` 传给数据层即可。

Spike 代码（评估期一次性验证，**未进入正式实现**）：

- 当时临时加过 `require('react')` 的占位 Body（`Git Tab OK · session=...`）与浮窗头部的 `Tab` 测试按钮；
- 正式实现（§3）保留同一套 API 用法（`require('react')` 挂载壳 + `sidebarRightTabs` 类型 + `sidebar.right.pane.tab` Body + guide 入口），但那两个临时入口已移除。

## 3. 正式实现设计

### 3.1 注册

```js
const TAB_ID = '@wongzexu/dsh-git-status'
const TAB_KIND = 'git-status'

ctx.inject(['sidebarRightTabs', 'sidebarRight', 'slots'], (scope) => {
  const offType = scope.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_KIND,
    title: () => t('gitStatus'),
    guide: [{
      id: 'git-status',
      order: 30,
      title: () => t('gitStatus'),
      description: () => '在右侧栏查看提交图与分支操作',
    }],
  })
  const offBody = scope.slots.inject('sidebar.right.pane.tab', () =>
    scope.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, GitTabBody))
  return () => { offBody(); offType() }
})
```

- `kind` 用 `git-status`，避免与内置 `files`/`terminal` 冲突。
- `priority` 默认 `extension`，无需覆盖。
- guide 的 `icon` 可选；不提供时显示 cube 占位。
- `multiple` 省略（每个 pane 一个 Git tab）。
- `keepMounted` 先不启用，tab 切换时重新挂载、重新拉数据；后续可按需开启。

### 3.2 Body 包装

```js
function GitTabBody({ sessionId, useTabInfo }) {
  const ref = React.useRef(null)
  const { tab } = useTabInfo()
  React.useEffect(() => {
    if (ref.current === null) return
    const dispose = mountGitPanel({
      root: ref.current,
      sessionId,
      mode: 'tab',
      visible: () => tab.visible,
    })
    return dispose
  }, [sessionId, tab.id])
  return React.createElement('div', { ref, className: 'dsc-git-tab-root' })
}
```

- `sessionId` 由 slot 框架直接注入（与 `FilesBody({ sessionId, ... })` 一致），**不要**再用全局 `uiSession` 决定 tab 的数据会话。
- `useTabInfo()` 提供 `tab.id`、`tab.visible`、`tab.signal`、`tab.actions.close()`。
- `tab.visible === false`（后台会话）时暂停 SSE/轮询；`tab.signal` 在 tab 关闭/插件卸载时 abort。
- `React` 只做“挂载容器”；现有 DOM UI 不改写成 React。

### 3.3 `mountUi` 改造成 docked 模式

需要把当前 `mountUi()` 拆成可复用的 `mountGitPanel({ root, sessionId, mode })`：

| 浮窗模式 | Tab 模式 |
|---|---|
| `position: fixed; right: 12px; top: 96px; width: 380px` | `position: static; width: 100%; height: 100%`，flex 纵向 |
| `gitToggle` / `gitHint` / 拖拽 / `localStorage` 位置 | 不创建 |
| 头部关闭按钮 | 隐藏（tab strip 自带关闭） |
| `data-dsc-git` 根节点 append 到 `document.body` | append 到 `root` |
| 头部可拖动 | 固定 toolbar |
| 浮窗卡片背景/圆角/阴影 | 跟随右侧栏 ground color，无卡片感 |
| `gitPanel.style.maxHeight = min(72vh, 800px)` | `height: 100%`，body 内部滚动 |

关键点：

- `currentSessionId()` 增加 docked 绑定：`let boundSessionId = null`，tab 模式设置后优先返回它；`sessionQuery()`/SSE/轮询/写操作全部跟随。
- 所有 `fetch`/`gitPost`/`gitEvents` 已通过 `currentSessionId()`，改造点集中。
- 对话框/右键菜单仍 `position: fixed`，append 到 `body`；需确认在右侧栏内不被 `overflow` 裁剪（当前 spike 的 tab body 在 `y=38`，右侧栏有独立滚动容器）。
- 图宽：现有 `GIT_ROW_PAD=240` / `clipW` 逻辑可继续用；tab 宽度可能 300–576px，需要实测图列 + 主题列在 300px 下不挤压。
- 头部按钮顺序：功能 / 范围 / ⇣ / ＋新分支 / ↻ / ⚙ / （关闭隐藏）；tab 模式下可把「设置」保留为 toolbar 弹窗。

### 3.4 入口与模式

- **guide 卡片**已可用：打开右侧栏 → guide → 点「Git 状态」，最贴近原生。
- 可选加一个快捷键（`ctx.shortcuts.register`）或会话 header 按钮；header corner 已被右侧栏展开按钮占用，插按钮需要额外 slot/布局确认。
- 建议保留浮窗模式，做成设置项：
  - 桌面端默认 `tab`；
  - Web 默认 `float`（或也默认 tab，需产品确认）；
  - 设置项「显示方式：右侧栏 Tab / 浮窗」立即切换（重建 UI）。
- 如果选择 tab-only，需要移除浮窗的开关/位置记忆/首用提示，入口只剩 guide/快捷键；老用户会有迁移感，建议 dual mode。

## 4. 工作量与风险

| 项 | 估计 |
|---|---|
| `mountUi` 拆 docked + session 绑定 | 1–1.5 天 |
| 宽/窄图与 diff 自适应、样式对齐右侧栏 | 0.5–1 天 |
| 入口（guide/快捷键/设置）、双模式、文案 | 0.5–1 天 |
| webprobe E2E（1280/1000/640、tab 开关、SSE、写操作） | 0.5 天 |
| **合计** | **约 2–3.5 天** |

风险：

1. **引入 React**：仅 `require('react')` 做挂载容器，不引入构建链/JSX；但确实打破“零 React”字面承诺。若坚持零 React，A 不可行，转 B。
2. **图/diff 宽度**：现有布局按 380px 设计；右侧栏 300–576px 的极端宽度需要实测与微调。
3. **固定定位弹窗**：右键菜单/确认框在右侧栏内的层级与裁剪需验证。
4. **会话绑定**：tab 的 `sessionId` 可能与全局 `uiSession` 不同；必须彻底替换 `currentSessionId` 的 docked 分支，避免写操作落到错误会话。
5. **生命周期**：tab 关闭、sidebar 收起、会话切换、插件卸载时 SSE/轮询/弹窗必须清理；`tab.signal` 可作为统一清理信号。
6. **桌面实机**：本机 Linux 无法安装官方桌面端；Windows/macOS 仍需真机验收（顶栏、右侧栏 fullscreen、Windows 40 DIP）。

## 5. 验收清单（正式实现时）

- [x] 1280×820：guide 卡片出现；点击打开 tab；tab 铺满右侧栏；无浮窗遮挡。（实测 docked 面板 647×719、93 行）
- [x] 640×700：右侧栏 fullscreen 时 tab 仍铺满；无横向溢出。（见 §0 宽度实测表）
- [x] tab 关闭后重新打开，数据正常。（SSE 随 tab 卸载关闭）
- [x] 后台会话 tab `tab.visible=false` 时暂停轮询/SSE。（代码已接入 `setVisible`；待真机后台会话复验）
- [ ] 分支切换/提交/暂存/放弃/合并/rebase 等写操作作用在 tab 的 session。（写路由已全部走 `currentSessionId()`，待逐项实测）
- [x] 右键菜单、确认框、设置弹窗不被右侧栏裁剪。（见 §0 弹层定位实测）
- [x] 浮窗模式行为不变；两种模式切换无残留 DOM/监听。（实测浮窗 `position:fixed`、无 `data-dsc-git-docked`、无残留 tab root）
- [x] `npm test` 269 用例通过；webprobe 验证：侧边栏渲染、迁移提示一次性+6s、设置行「默认位置 侧边栏 ▾」。
- [ ] Windows/macOS 官方桌面端实机验收。

## 6. 建议

**A 可行，建议作为桌面端的正式形态**：以 guide 卡片为入口，右侧栏 tab 承载 Git 面板；浮窗保留为 Web/兼容模式。先做 `mountUi` docked 重构与 session 绑定，再做宽度自适应；预计 2–3.5 天。

评估期提出的三个待确认问题均已决策并落地：

1. 接受 `require('react')` 薄包装——React 只作挂载壳，UI 仍是零 React 原生 DOM（README 的「零 React」措辞已同步修正为「零 React UI + 宿主 React 挂载壳」）；
2. 双模式、浮窗保留——Web 默认浮窗，桌面端默认侧边栏；
3. 桌面端默认侧边栏、Web 默认浮窗，已实现并持久化（`dsc-git-settings.defaultMode`），桌面端首次进入有一次性迁移提示。

与立项 issue（Gitee `IK8Y7I`）的差异与决策记录见第 7 节。

## 7. 与 IK8Y7I 的差异与决策

立项提案（Gitee `IK8Y7I`「Git 状态双模式切换：悬浮抽屉 ⇄ 标题栏标签页（整页视图）」）设计的机制是 `conversation.view` 整页视图；本分支实际落地为 DSH **右侧栏 tab**（`sidebarRightTabs` + `sidebar.right.pane.tab`）。这不是无意跑偏，而是评估后改选的 A 方案：

| 维度 | issue 原方案 | 本分支实现 | 理由 |
|---|---|---|---|
| 容器 | `conversation.view`（会话标题栏 tab，独占中栏） | `sidebarRightTabs`（与 Files / Terminal 同级） | 不挤占对话宽度；桌面端形态更贴近原生侧栏；`conversation.view` 的 tablist 显示条件与 session 作用域风险已写在 issue §八 |
| 入口 | 标题栏 tab + 抽屉头部切换按钮 | 右侧栏 guide 卡片 + 设置「默认位置」 | 复用 DSH 右侧栏既有入口，避免标题栏再插 tab |
| 偏好持久化 | 阶段一 localStorage → 阶段二 settings namespace | 阶段一 localStorage（已完成） | 阶段二（`settingsScope` / `settings.general.item`，跨设备同步）拆为后续 issue 跟踪 |

需要在 issue 上留痕的两点：

1. 侧栏形态：issue「开放问题 #2」原写“暂不纳入本提案”，本分支已采纳，应在 issue 上正式转为决策；
2. 阶段二 settings 同步：不作为本分支验收项，拆独立 issue 跟踪。
