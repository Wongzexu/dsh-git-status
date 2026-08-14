# dsh-git-status

独立 Git 状态 / Git Graph 插件（从 [dsh-companion](https://gitee.com/wongzexu/dsh-companion) 抽离）。
DSH Web 右缘 **⎇ 浮窗**：commit DAG 泳道图 + 未提交改动/stash + 行内详情 diff + 分支操作。

> 状态：v0.4.0 · 纯前端自渲染 DOM（greeter 模式，零 React 依赖、零构建链）+ Node half 自造只读/写路由，官方代码零改动。

## 功能

- **commit DAG 泳道图**：算法移植自 [mhutchie/vscode-git-graph](https://github.com/mhutchie/vscode-git-graph) 的 `web/graph.ts`
  - 泳道布局：第一父链成线、列分配贪心最左、泳道复用、合并提交连线
  - 渲染：网格制 SVG，shadow + 彩色双 path、折角过渡、右缘渐变淡出、HEAD 加粗圆点
- **行内 refs 徽标**：HEAD（红）/ 分支（金）/ 远程（蓝）/ 标签（绿）；当前 checkout 分支名加粗；
  同名本地/远程分支合并为一个 pill：`⎇ main [gitee]`（多远程依次内嵌）；
  远程 HEAD 符号引用（`gitee/HEAD`）默认过滤
- **未提交改动虚拟行**：工作区有改动时图顶部插入虚拟行（空心圆 + 灰色虚线连 HEAD），
  分类显示未暂存/已暂存处数；点击展开 diff HEAD 详情（含未跟踪/已删除文件）
- **stash 显示**：`git reflog refs/stash` 插入图中（双层圆 + `stash@{n}` 徽标），
  展开详情（base 显式两树 diff + untracked 第三父快照追加）
- **行内展开详情**：点击 commit 行 → 展开提交信息 + 变更文件（+/- 行数）+ 逐文件 diff
  （256KB 截断）；详情盒高度自适应内容（≤340px 上限），点开 patch 不引起图跳动
- **分支操作**（守卫模型移植自社区 [dsh-git-graph](https://github.com/zhu1090093659/dsh-web-ui)）：
  - 右键分支徽标：本地「切换到 x」/ 远程「创建本地分支 x 并检出」
  - 头部「＋ 新分支」对话框：客户端即时校验 + 服务端 `check-ref-format` 权威校验双保险
  - 切换守卫：未解决冲突 / 进行中操作（MERGE_HEAD 等标记）/ 目标分支在其他 worktree 检出 → 稳定错误码
- 范围切换：所有分支 / 当前分支；10s 自动刷新 + 手动刷新；非 git 仓库提示

## 架构

```
dsh-git-status/
├── package.json          # dsh.bundle.patch + dsh.client.inject + platform: web
├── cordis.patch.yml      # 挂载 Node half
├── lib/
│   ├── index.mjs         # Node half：git log/show/branch 三个路由
│   └── client.js         # client bundle（构建产物，__ModuleLoader__ 契约）
├── src/client/index.js   # client 源码（手写 CJS，单模块）
└── scripts/build-client.js  # 零依赖构建脚本（纯 Node）
```

- **数据通道**：Node half 注册 `/plugins/dsh-git-status/*` 路由（webServer），客户端 10s 轮询
- **git 执行**：spawn 系统 `git`（`-C 工作区 --no-pager -c color.ui=false`、`GIT_OPTIONAL_LOCKS=0`、15s 超时强杀）
- **布局锚点**：官方 DOM 属性（`data-chat-flow`），不依赖 React 内部结构
- **安全**：路由根限定**会话权威工作区**（请求带 `session=`，优先 `ctx.sessions.get(id).header.cwd`；
  缺省回退注册表/进程 cwd），拒绝 `..` 分量与越界路径；只读命令白名单；
  分支写路由（唯一写操作）POST + 强制 `application/json` content-type（CSRF 防护），
  分支名权威校验 + argv 数组（无 shell）+ 切换前守卫

## 安装（开发态，本地目录源）

```sh
dsh plugin --profile web add /home/maoyi-yewu/Desktop/系统/dsh-git-status
# 重启 web 生效；设置页「插件」面板可停用/启用
```

## 开发

```sh
node scripts/build-client.js   # 改 src/client/index.js 后重新打包 client
```

改 Node half 直接改 `lib/index.mjs`（无构建步骤）。

## 路线

- 分支操作扩展：删除/重命名/合并
- git 状态 SSE 推送（/git/events 订阅，替代 10s 轮询）
- tag 右键「在此提交创建分支」

## 许可

MIT（DSH 生态示例插件形态，BSD-3-Clause 生态内自写自用）。
