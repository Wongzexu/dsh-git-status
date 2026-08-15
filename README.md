<div align="center">

# dsh-git-status

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com) [![dshfind](https://dshfind.com/api/badge/Wongzexu/dsh-git-status?lang=zh)](https://dshfind.com/zh/plugins/Wongzexu/dsh-git-status)

[**English**](README_EN.md) · **简体中文**

独立 Git 状态（Git Graph）插件：DSH Web 右缘 **Git 状态浮窗** —— commit DAG 泳道图 + 未提交改动/stash + 行内详情 diff + 分支操作。

🔖 **v0.4.0** · 🧩 纯前端自渲染 DOM（greeter 模式，零 React、零构建链）· 🛠 Node half 只读/写路由 · 📜 MIT

</div>

## 功能

- **浮窗交互**：面板可**拖拽**、位置**自动记忆**；右上角悬浮开关按钮（与面板角重合、拖拽跟随、关闭后原位悬浮重开）；
  首次使用引导提示气泡（仅一次，localStorage 记录）
- **commit DAG 泳道图**：第一父链成线、列分配贪心最左、泳道复用、合并提交连线；
  网格制 SVG 渲染（shadow + 彩色双 path、折角过渡、右缘渐变淡出、HEAD 加粗圆点）
- **行内 refs 徽标**：H（红，游离 HEAD）/ 分支（金）/ 远程（蓝）/ 标签（绿）；当前 checkout 分支 pill 亮金高亮
  （背景加浓 + 金色内描边 + 加粗，悬停提示「当前分支」）；
  同名本地/远程分支合并为一个 pill：`⎇ main [gitee]`；同一分支有 ≥2 个远程时
  折叠为计数子标签 `⎇ main [2]`（悬停 pill 任意处即显示完整远程引用列表，右键先选远程再操作）；
  远程 HEAD 符号引用（`gitee/HEAD`）默认过滤
- **未提交改动虚拟行**：工作区有改动时图顶部插入虚拟行（空心圆 + 灰色虚线连 HEAD），
  分类显示未暂存/已暂存处数；点击展开按「更改 / 暂存的更改」分组的详情
  （VS Code 语义：部分暂存文件两组各出现一次，未跟踪文件带徽标）
- **stash 显示**：`git reflog refs/stash` 插入图中（双层圆 + `stash@{n}` 徽标），
  展开详情（base 显式两树 diff + untracked 第三父快照追加）
- **行内展开详情**：点击 commit 行 → 展开提交信息 + 变更文件（+/- 行数）+ 逐文件 diff
  （256KB 截断）；详情盒高度自适应内容（≤340px 上限），点开 patch 不引起图跳动
- **分支操作**：
  - 右键本地分支徽标：切换到 x / 合并 x 到当前分支 / 重命名 x / 删除 x / 强制删除 x（未合并二次确认）
  - 右键远程分支徽标：「创建本地分支 x 并检出」/「删除远程分支 x」（远程已删时自动降级清理本地跟踪引用）；
    折叠计数徽标右键先选远程、再出该远程的操作菜单；
    右键 tag 徽标：「在 x 创建分支并检出」/「推送 tag 到 <远程>」（每远程一项）/「删除 tag」
    （可选同步删除远程）；右键 commit 行「创建 tag…」（轻量/附注 + 多远程推送）/
    「在 x 新建分支并检出」（以该提交为起点）
  - 头部「＋ 新分支」对话框：客户端即时校验 + 服务端 `check-ref-format` 权威校验双保险
  - 切换守卫：未解决冲突 / 进行中操作（MERGE_HEAD 等标记）/ 目标分支在其他 worktree 检出 → 稳定错误码；
    存在**已跟踪**未提交改动时弹「仍然切换」确认框（确认后带 `force` 旁路；仅未跟踪文件不拦）
  - 合并冲突后：头部徽标 + 合并条提供「中止合并 / 继续合并」（解决冲突后 `git add` 再继续）
- **从远程拉取**：头部「⇣」按钮（仓库有 remote 才显示），一键 `git fetch --all`
  （镜像上游工具栏 Fetch from Remote(s) 形态：无对话框、prune 默认关），
  无论成败图都即时刷新（多远程可能部分成功）；失败分类提示
  （网络/认证错误、远程不存在、远程仓库不存在或不可达）
- **推送分支**：右键本地分支「推送到远程…」（镜像上游 Push Branch 对话框）——
  remote 单选（默认 origin/首个）+ Set Upstream + Push Mode 三选一
  （normal / force-with-lease / force）；失败保留对话框可改模式重试
- **stash 操作**：右键 stash 徽标「应用 / 弹出 / 从 stash 创建分支并检出 / 删除（确认框）」；
  右键未提交改动虚拟行「暂存未提交改动」（说明 + 包含未跟踪文件）；
  应用冲突（合并冲突 / 本地改动被覆盖）分类提示且 stash 保留
- **冲突/进行中状态徽标**：头部实时显示「N 个未解决冲突」「合并/rebase 进行中」（`MERGE_HEAD` 等标记）
- **SSE 即时刷新**：`/git/events` 订阅（2s 服务端状态键对比 + 变化推送 + 15s 心跳），
  其他终端 checkout/提交时图即时刷新；10s 轮询保留作断连兜底
- 范围切换：所有分支 / 当前分支；自动刷新 + 手动刷新；非 git 仓库提示

## 安装指南

### 环境要求

- DSH（DeepSeek Harness）web 端已安装并运行（`dsh web`）
- 已安装 `git` 命令行工具（插件通过系统 `git` 执行所有操作）
- 插件零第三方依赖：无 React、无构建产物依赖、Node half 零 npm 包

### 安装插件

**方式一：从 GitHub 安装（发布版）**

```sh
dsh plugin --profile web add github:Wongzexu/dsh-git-status
```

**方式二：本地目录安装（开发/自用）**

```sh
dsh plugin --profile web add /path/to/dsh-git-status
```

把 `/path/to/dsh-git-status` 换成插件目录的实际路径（例如本仓库根目录）。

### 启用

1. 重启 DSH web 服务，使插件加载生效；
2. 打开 DSH web 页面 → 设置页「插件」面板，确认 `dsh-git-status` 已启用（可随时停用/启用）。

### 使用

> 📖 完整操作指南（中英双语）：[docs/USAGE.md](docs/USAGE.md) —— 界面速览、Git 图阅读、分支操作、冲突处理、远程拉取全流程详解。

1. 进入任意聊天视图（对话界面）；
2. 点击面板右上角外侧的 **分支图标** 按钮，展开「Git 状态」浮窗（浮窗可拖拽，位置自动记忆；按钮始终贴在浮窗右上角，关闭后留在原位悬浮，点击重新展开；首次使用有引导提示）；
3. 浮窗头部可切换「所有分支 / 当前分支」、手动刷新（↻）；打开期间 SSE 即时刷新（断连时 10s 轮询兜底）；
4. 点击 commit 行展开详情（提交信息 / 变更文件 / 逐文件 diff）；点击文件行查看该文件 patch；
5. 右键分支徽标：本地「切换到 x / 推送到远程… / 合并 x / 重命名 x / 删除 x（可强删）」；远程「创建本地分支 x 并检出」；
6. 右键 tag 徽标「在 x 创建分支并检出」/「推送 tag 到 <远程>」/「删除 tag（可选同步远程）」；头部「＋ 新分支」：输入名称创建并检出新分支（非法名称即时拦截）；
7. 右键 stash 徽标「应用 / 弹出 / 从 stash 创建分支并检出 / 删除」；右键未提交改动虚拟行「暂存未提交改动」；
8. 头部徽标提示未解决冲突 / 进行中操作；合并冲突时合并条提供「中止合并 / 继续合并」；
9. 仓库配置了远程时，头部「⇣」按钮一键拉取全部远程（`git fetch --all`，prune 默认关），完成后图即时刷新。

> 提示：当前会话工作区不是 git 仓库时，浮窗内会显示提示，切换到 git 仓库所在会话即可。

### 卸载

```sh
dsh plugin --profile web remove dsh-git-status
```

### 常见问题

- **浮窗不出现**：确认处于聊天视图；插件已在「插件」面板启用；刚安装的话先重启 web。
- **提示「当前工作区不是 git 仓库」**：当前会话的工作目录不是 git 仓库，切换到仓库目录所在会话。

## 架构

```
dsh-git-status/
├── package.json          # dsh.bundle.patch + dsh.client.inject + platform: web
├── cordis.patch.yml      # 挂载 Node half
├── lib/
│   ├── index.mjs         # Node half：git log/show/branch/fetch/push/remote/stash/events 八路由（末尾导出测试用纯函数）
│   └── client.js         # client bundle（构建产物，__ModuleLoader__ 契约）
├── src/client/index.js   # client 源码（手写 CJS，单模块）
├── scripts/build-client.js  # 零依赖构建脚本（纯 Node）
└── tests/
    ├── fixtures/repo.mjs     # 造仓库辅助（mkdtemp 真实 git 仓库，t.after 自动清理）
    ├── git-log.test.mjs      # 装饰解析/未提交分类/虚拟行组装/stash/show/冲突状态
    ├── git-branch.test.mjs   # 分支名校验/守卫/失败分类/增删改合/写路由（含 CSRF）
    ├── git-fetch.test.mjs    # 远程列表/名称校验/fetch 失败分类/真实拉取（file:// 裸仓库，含 prune）/写路由（含 CSRF）
    ├── git-push.test.mjs     # push 参数校验/失败分类/真实推送（set-upstream、non-fast-forward→force）/写路由（含 CSRF）
    ├── git-stash.test.mjs    # stash selector 校验/apply/pop/drop/branch/两种冲突形态/写路由（含 CSRF）
    ├── git-remote.test.mjs   # tag 名校验/删除远程分支（含降级）/推送与删除 tag（含同步远程）/写路由（含 CSRF）
    └── git-events.test.mjs   # SSE 订阅：初始推送/变化检测/心跳/断连清理
```

- **数据通道**：Node half 注册 `/plugins/dsh-git-status/*` 路由（webServer），
  客户端 SSE 订阅 `/git/events` 即时刷新 + 10s 轮询兜底
- **git 执行**：spawn 系统 `git`（`-C 工作区 --no-pager -c color.ui=false`、`GIT_OPTIONAL_LOCKS=0`、
  `LC_ALL=C` 强制英文输出、`GIT_EDITOR=true` 禁编辑器、15s 超时强杀；fetch/push 放宽到 120s）
- **布局锚点**：官方 DOM 属性（`data-chat-flow`），不依赖 React 内部结构
- **安全**：路由根限定**会话权威工作区**（请求带 `session=`，优先 `ctx.sessions.get(id).header.cwd`；
  缺省回退注册表/进程 cwd），拒绝 `..` 分量与越界路径；只读命令白名单；
  写路由（分支操作 + 拉取远程 + 推送 + 远程/标签操作 + stash）POST + 强制 `application/json` content-type（CSRF 防护），
  分支名/remote 名/tag 名/stash selector 权威校验 + argv 数组（无 shell）+ 切换前守卫；fetch/push 超时放宽（120s）

## 开发

```sh
node scripts/build-client.js   # 改 src/client/index.js 后重新打包 client（lib/client.js）
npm test                       # node:test 套件（135 用例，真实 git fixture，零依赖）
```

改 Node half 直接改 `lib/index.mjs`（无构建步骤），改完跑 `npm test` 回归。
测试链覆盖：装饰串分类、未提交改动 XY 位分类、UNCOMMITTED/stash 虚拟行组装、
stash 第三父、show 详情、冲突/进行中状态、分支名校验、切换守卫
（冲突/进行中/其他 worktree/**未提交改动确认**：staged/未暂存/未跟踪三组计数、
仅未跟踪放行、force 旁路带改动切换）、增删改合全路径（含合并冲突 abort/continue）、
失败 stderr 分类、写路由 CSRF（content-type 强校验）与全链路、SSE 订阅
（初始推送/变化检测/心跳/断连清理/删分支与 stash 变化推送）、fetch 全链路
（--all/单远程/prune 语义/失败分类/CSRF，file:// 裸仓库真实拉取）、push 全链路
（set-upstream tracking / non-fast-forward → force 覆盖 / 失败分类 / CSRF）、
stash 全链路（push/apply/pop/drop/branch/两种冲突形态 / CSRF）、远程/标签操作全链路
（删除远程分支含降级、推送/删除 tag 含同步远程、tag 名校验 / CSRF）。

重新打包 client 后**刷新浏览器页面**即可看到效果（无需重启 web 服务）；
改 Node half 后需**重启 web 服务**生效。

## 路线

- git 状态变化推送降级优化：fs.watch 检测（当前为 2s 轮询对比状态键）
- 发布形态：GitHub Releases（tag/Release）

## 许可

MIT（DSH 生态示例插件形态，BSD-3-Clause 生态内自写自用）。

实现参考：[mhutchie/vscode-git-graph](https://github.com/mhutchie/vscode-git-graph)（泳道布局/渲染 + Fetch from Remote(s) 按钮形态，MIT）、
[zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) 的 dsh-git-graph（分支操作守卫模型）。
