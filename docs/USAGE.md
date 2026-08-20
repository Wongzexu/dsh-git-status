# @wongzexu/dsh-git-status 使用指南 · Usage Guide

> 中英双语（Bilingual）：上方为中文版，下方为 [English version](#wongzexudsh-git-status-usage-guide)。与 [README](../README.md) 配套的详细文字版操作指南，覆盖从打开浮窗到分支操作、冲突处理、远程拉取的全流程。适用版本：v0.5.0+。

## 中文版

### 1. 安装与启用

**方式一：npm 安装（推荐，发布版）**

```sh
dsh plugin --profile web add @wongzexu/dsh-git-status
```

**方式二：从 GitHub 安装（源码版）**

```sh
dsh plugin --profile web add github:Wongzexu/dsh-git-status
```

**方式三：本地目录安装（开发/自用）**

```sh
dsh plugin --profile web add /path/to/dsh-git-status
```

> ⚠️ npm 上另有同名（无作用域）包 `dsh-git-status`（其他作者的 React 实现，与本插件无关）；安装请认准 **`@wongzexu/dsh-git-status`**。

然后：

1. 重启 DSH web 服务，使插件加载生效；
2. 打开 DSH web 页面 → 设置页「插件」面板，确认 `@wongzexu/dsh-git-status` 已启用（可随时停用/启用）。

### 2. 打开 / 关闭浮窗

1. 进入任意聊天视图（对话界面）；
2. 点击面板右上角外侧的 **分支图标** 按钮，右侧展开「Git 状态」浮窗；
3. **关闭**：点击浮窗右上角的开关按钮（按钮右下角与面板右上角重合）；
4. **重新打开**：按钮留在原位悬浮，点击即可重新展开；
5. 浮窗可**拖拽**移动，位置**自动记忆**（下次打开保持上次位置）；
6. **首次使用**会显示引导提示气泡（仅显示一次，由 localStorage 记录）。

> 提示：当前会话工作区不是 git 仓库时，浮窗内会显示提示；切换到 git 仓库目录所在会话即可。

### 3. 界面速览

#### 头部（自左向右）

- **范围切换**：「所有分支 / 当前分支」；
- **手动刷新**：↻；
- **从远程拉取**：⇣（仅仓库配置了远程时显示）—— 一键 `git fetch --all`（无对话框，prune 默认关）；
- **＋ 新分支**：输入名称创建并检出新分支；
- **状态徽标**：实时显示「N 个未解决冲突」「合并/rebase 进行中」（基于 `MERGE_HEAD` / `SQUASH_MSG`（squash 合并）等标记）；
- **关闭按钮**：面板右上角（即开关按钮，关闭后原位悬浮）。

#### 图区（commit DAG 泳道图）

- 每行一个 commit：第一父链成线、列分配贪心最左、泳道复用、合并提交连线；
- 网格制 SVG 渲染：shadow + 彩色双 path、折角过渡、HEAD 加粗圆点。

#### refs 徽标颜色

| 徽标 | 颜色 | 说明 |
|---|---|---|
| HEAD | 红 | 当前检出位置 |
| 分支 | 金 | 当前 checkout 分支**亮金高亮**（深底色 + 金色内描边 + 加粗，hover 提示 current） |
| 远程 | 蓝 | 远程跟踪分支 |
| 标签 | 绿 | tag |

- 同名本地/远程分支合并为一个 pill：`⎇ main [gitee]`（多远程依次内嵌）；
- 远程 HEAD 符号引用（`gitee/HEAD`）默认过滤。

### 4. 阅读 Git 图

#### 未提交改动虚拟行

- 工作区有改动时，图顶部插入虚拟行：**空心圆 + 灰色虚线连 HEAD**；
- 分类显示**未暂存/已暂存**处数；
- 点击展开按「更改 / 暂存的更改」分组的详情（VS Code 语义：部分暂存文件两组各出现一次，未跟踪文件带徽标）。

#### stash 行

- `git reflog refs/stash` 插入图中：**双层圆 + `stash@{n}` 徽标**；
- 展开详情：base 显式两树 diff + untracked 第三父快照追加。

#### 提交详情

- 点击 commit 行 → 展开：提交信息 + 变更文件（+/- 行数）+ 逐文件 diff（256KB 截断）；
- 点击文件行 → 查看该文件 patch；
- 详情盒高度自适应内容（≤340px 上限），点开 patch 不引起图跳动。

#### 暂存、贮藏与提交

- 右键未提交改动虚拟行 → **暂存全部改动**：执行 `git add -A`，包含新增、修改和删除；
- **贮藏未提交改动**：将改动保存到 stash 并清理工作区，不等同于暂存；
- **提交已暂存**：只提交 Git index 中已暂存的内容；没有已暂存改动时该项禁用；
- **提交已暂存（修订）**：修改上一条提交，可不包含新的 staged 改动；
- 提交框支持多行信息，普通 Enter 换行，Windows/Linux 使用 `Ctrl+Enter`，macOS 使用 `Cmd+Enter`。

### 5. 分支操作

#### 右键本地分支徽标

- **切换到 x**：切换前执行守卫检查（见下）；
- **合并 x 到当前分支…**；
- **重命名 x…**；
- **删除 x… / 强制删除 x…**（未合并时二次确认）。

#### 右键远程分支徽标

- **创建本地分支 x 并检出**。

#### 右键 tag 徽标

 - **在 x 创建分支…**：是否自动检出由设置中的「创建分支后自动检出」控制。

#### 右键 commit 行

- **创建 tag…**：对话框 = tag 名 + 类型（**附注/轻量**，附注可填备注）+ 底部左侧「推送到」**下拉多选**
  （镜像推送分支的 remote 多选菜单：第一项「不推送」，其后各远程可勾多个；无远程时隐藏）；
  同名 tag 弹「替换？」确认后强制覆盖（`-f`）；多远程逐个顺序推送，部分失败时提示失败明细
  （tag 保留本地，成功远程已收）；
- **在 {hash} 新建分支**：以该提交为起点创建分支；是否自动检出由设置控制（上游 Create Branch… 形态）；
  复用头部「＋ 新分支」对话框，起始点（commit hash / tag）服务端权威校验。

#### 新建分支（头部「＋」）

- 输入名称创建新分支（默认从当前 HEAD 起分支）；是否自动检出由设置控制；
- **客户端即时校验 + 服务端 `check-ref-format` 权威校验双保险**，非法名称即时拦截。

#### 切换守卫（checkout 拦截）

以下情况**拒绝切换**并返回稳定错误码：

- 未解决冲突；
- 进行中操作（`MERGE_HEAD` / `SQUASH_MSG`（squash 合并）等标记）；
- 目标分支在其他 worktree 检出。

存在**已跟踪**未提交改动时：弹「仍然切换」确认框，确认后带 `force` 旁路切换；**仅未跟踪文件不拦截**。

### 6. 合并与冲突处理

1. 右键分支 → 「合并 x 到当前分支…」→ 弹出二级确认框，合并方式三选一（单选按钮组）：
   - **合并提交（默认）**：能快进则快进，分叉时生成合并提交（`git merge --no-edit`）；
   - **NoFF（禁用快进）**：始终生成合并提交（`git merge --no-edit --no-ff`，可快进也强制）；
   - **Squash 合并**：压平为一个提交，无合并提交、无分叉线（`git merge --squash` + 自动提交）。
     仅此项显示「提交信息」输入 +「使用固定文案」勾选（默认勾选，文案为 `Squash 合并 x`；取消勾选后必须填写）。
2. 若产生冲突：头部徽标提示「N 个未解决冲突」，合并条提供「**中止合并 / 继续合并**」
   （普通合并走 `git merge --abort/--continue`；**squash 合并无 `MERGE_HEAD`**，中止为
   `git reset --hard` + 清理合并新增文件，继续为冲突解决并 `git add` 后 `git commit`
   （提交信息沿用发起时填写的内容））；
3. 解决冲突 → `git add` 已解决文件 → 点「继续合并」完成；
4. 想放弃合并：直接点「中止合并」。

### 6.1 设置中的默认行为

- **创建分支后自动检出**：控制普通创建分支、从 commit/tag/远程创建分支后的是否切换；从 stash 创建分支仍保持创建并检出；
- **贮藏时包含未跟踪文件**：作为「贮藏未提交改动」对话框的默认选项；
- **默认合并方式**：预选普通合并、NoFF 或 Squash；
- **删除本地分支时同步删除远程**（默认关）：开启后，右键删除本地分支（普通删除与强制删除）时，若远程存在同名分支则一并删除（`git push <remote> --delete <branch>`）；无同名远程分支时不受影响；远程删除失败会提示明细，本地删除不受影响；
- **显示未提交改动**：位于「显示」区，控制图顶部工作区改动虚拟行。

### 7. 从远程拉取

- 头部「⇣」按钮（仓库有 remote 才显示）：一键 `git fetch --all`（镜像上游 Git Graph Fetch from Remote(s) 形态：无对话框、prune 默认关）；
- **无论成败图都即时刷新**（多远程可能部分成功）；
- 失败分类提示：网络/认证错误、远程不存在、远程仓库不存在或不可达。

### 8. 实时刷新机制

- 打开期间 **SSE 即时刷新**：订阅 `/git/events`（2s 服务端状态键对比 + 变化推送 + 15s 心跳）；
- 其他终端 checkout / 提交时，图即时刷新；
- **断连时 10s 轮询兜底**，也可手动 ↻。

### 9. 常见问题

| 现象 | 处理 |
|---|---|
| 浮窗不出现 | 确认处于聊天视图；插件已在「插件」面板启用；刚安装的话先重启 web |
| 提示「当前工作区不是 git 仓库」 | 当前会话的工作目录不是 git 仓库，切换到仓库目录所在会话 |
| 看不到远程分支 | 仓库配置远程后点 ⇣ 拉取；远程分支徽标为蓝色 |

### 10. 卸载

```sh
dsh plugin --profile web remove @wongzexu/dsh-git-status
```

---

# @wongzexu/dsh-git-status Usage Guide

> Bilingual companion: English below, [中文版](#中文版) above. A detailed text-based usage guide for the [README](../README_EN.md), covering everything from opening the drawer to branch operations, conflict handling, and fetching from remotes. Applies to v0.5.0+.

## 1. Install & enable

**Option 1: install from npm (recommended, release)**

```sh
dsh plugin --profile web add @wongzexu/dsh-git-status
```

**Option 2: install from GitHub (source)**

```sh
dsh plugin --profile web add github:Wongzexu/dsh-git-status
```

**Option 3: install from a local directory (development / personal use)**

```sh
dsh plugin --profile web add /path/to/dsh-git-status
```

> ⚠️ There is a *different*, unscoped package named `dsh-git-status` on npm (a React implementation by another author, unrelated to this plugin); make sure you install **`@wongzexu/dsh-git-status`**.

Then:

1. Restart the DSH web service for the plugin to load;
2. Open the DSH web page → Settings → "Plugins" panel, confirm `@wongzexu/dsh-git-status` is enabled (can be disabled/enabled anytime).

## 2. Opening / closing the drawer

1. Enter any chat view;
2. Click the **branch icon** button outside the panel's top-right corner — the "Git status" drawer expands from the right;
3. **Close**: click the toggle button at the drawer's top-right corner (the button's bottom-right overlaps the panel's top-right corner);
4. **Reopen**: the button stays floating at that spot — click it to expand the drawer again;
5. The drawer is **draggable** and its position is **remembered** (restored on the next open);
6. **First use** shows a one-time hint bubble (recorded in localStorage).

> Tip: when the current session's workspace is not a git repo, the drawer shows a hint; switch to a session whose workspace is a git repo.

## 3. UI overview

### Header (left to right)

- **Scope switch**: "All branches / Current branch";
- **Manual refresh**: ↻;
- **Fetch from remotes**: ⇣ (shown only when the repo has remotes) — one-click `git fetch --all` (no dialog, prune off by default);
- **＋ New branch**: type a name to create and check out a new branch;
- **Status badges**: real-time "N unresolved conflicts" and "merge/rebase in progress" (based on `MERGE_HEAD` / `SQUASH_MSG` (squash merge) etc.);
- **Close button**: top-right corner of the panel (the toggle button; it stays floating at that spot once the panel is closed).

### Graph area (commit DAG lane graph)

- One row per commit: first-parent chains as lines, greedy leftmost column assignment, lane reuse, merge-commit connectors;
- SVG grid rendering: shadow + dual-color paths, elbow transitions, bold HEAD dot.

### Ref badge colors

| Badge | Color | Meaning |
|---|---|---|
| HEAD | red | current checked-out position |
| Branch | gold | the currently checked-out branch is **bright-gold highlighted** (denser background + gold inset border + bold; hover tooltip "current") |
| Remote | blue | remote-tracking branch |
| Tag | green | tag |

- A local branch and its same-named remote are merged into one pill: `⎇ main [gitee]` (multiple remotes nest in order);
- Remote HEAD symbolic refs (`gitee/HEAD`) are filtered by default.

## 4. Reading the graph

### Uncommitted changes virtual row

- When the worktree has changes, a virtual row is inserted at the top of the graph: **hollow circle + gray dashed line to HEAD**;
- Shows staged/unstaged counts;
- Click to expand details grouped by "Changes / Staged Changes" (VS Code semantics: partially staged files appear in both groups, untracked files carry a badge).

### Stash rows

- `git reflog refs/stash` rows are inserted into the graph: **double circle + `stash@{n}` badge**;
- Expanding shows details: explicit two-tree diff of the base + untracked third-parent snapshot appended.

### Commit details

- Click a commit row to expand: commit message + changed files (+/- line counts) + per-file diffs (256 KB truncation);
- Click a file row to view that file's patch;
- The detail box height adapts to content (≤340px) and opening a patch does not shift the graph.

### Staging, stashing, and committing

- Right-click the uncommitted changes row → **Stage all changes**: runs `git add -A`, including added, modified, and deleted files;
- **Stash uncommitted changes** saves changes to stash and cleans the worktree; it is not the same as staging;
- **Commit staged changes** commits only the Git index; the item is disabled when nothing is staged;
- **Commit staged changes (amend)** edits the previous commit and may run without new staged changes;
- The commit dialog supports multiline messages. Press Enter for a newline, `Ctrl+Enter` on Windows/Linux, or `Cmd+Enter` on macOS to submit.

## 5. Branch operations

### Right-click a local branch badge

- **Switch to x** (guards are checked before switching, see below);
- **Merge x into current…**;
- **Rename x…**;
- **Delete x… / Force delete x…** (second confirmation when unmerged).

### Right-click a remote branch badge

- **Create local branch x and check out**.

### Right-click a tag badge

- **Create branch at x and check out**.

### New branch (header "＋")

- Type a name to create and check out;
- **Instant client-side validation + authoritative server-side `check-ref-format` validation** — invalid names are rejected immediately.

### Switch guard (checkout interception)

Switching is **rejected** with stable error codes when:

- There are unresolved conflicts;
- An operation is in progress (`MERGE_HEAD` / `SQUASH_MSG` (squash merge) etc.);
- The target branch is checked out in another worktree.

With **tracked** uncommitted changes, a "switch anyway" confirmation dialog appears; confirming proceeds with the `force` bypass. **Untracked-only changes do not block.**

## 6. Merge & conflict handling

1. Right-click a branch → "Merge x into current…" → a secondary confirmation dialog appears with three merge modes (radio group):
   - **Merge commit (default)**: fast-forward when possible, otherwise a merge commit (`git merge --no-edit`);
   - **NoFF (no fast-forward)**: always creates a merge commit (`git merge --no-edit --no-ff`);
   - **Squash merge**: flattened into one commit — no merge commit, no divergence line (`git merge --squash` + auto `git commit`).
     Only this mode shows the "commit message" input + "use fixed text" checkbox (checked by default; the fixed text is `Squash merge x`; unchecking requires a message).
2. On conflict: the header badge shows "N unresolved conflicts" and the merge bar offers "**abort merge / continue merge**" (plain merges use `git merge --abort/--continue`; a **squash merge has no `MERGE_HEAD`** — abort runs `git reset --hard` plus cleanup of files the merge added, continue commits after resolving conflicts and `git add`, reusing the message from the dialog);
3. Resolve conflicts → `git add` the resolved files → click "continue merge" to finish;
4. To give up: click "abort merge".

## 7. Fetching from remotes

- Header "⇣" button (shown only when the repo has remotes): one-click `git fetch --all` (mirrors the upstream Git Graph Fetch from Remote(s) form: no dialog, prune off by default);
- The graph refreshes **immediately on success or failure** (multiple remotes may partially succeed);
- Categorized failure hints: network/auth errors, remote missing, remote repo missing or unreachable.

## 8. Live refresh

- While open, **SSE live refresh** applies: subscribes to `/git/events` (2s server-side state-key comparison + change push + 15s heartbeat);
- The graph refreshes instantly when another terminal checks out or commits;
- **10s poll fallback on disconnect**; manual refresh (↻) also available.

## 9. FAQ

| Symptom | Fix |
|---|---|
| The drawer does not appear | Make sure you are in a chat view; the plugin is enabled in the "Plugins" panel; restart web right after a fresh install |
| "The current workspace is not a git repository" | The current session's working directory is not a git repo; switch to a session in a repo directory |
| Remote branches are missing | After configuring remotes, click ⇣ to fetch; remote badges are blue |

## 10. Uninstall

```sh
dsh plugin --profile web remove @wongzexu/dsh-git-status
```
