# 上游参考源码：mhutchie/vscode-git-graph

本目录保存 vscode-git-graph（VS Code 扩展 Git Graph）的**只读参考源码**，
供移植研究（泳道布局 / 右键菜单矩阵 / 对话框 / 服务端命令）使用。

> ⚠️ **不入版本库**（见仓库根 `.gitignore`）：第三方 MIT 源码仅本地保留，
> 本 README（出处与重拉方式）随仓库提交。

## 出处

- 仓库：<https://github.com/mhutchie/vscode-git-graph>
- 分支：`master`
- commit：`881a9e613045bacbbadf8940f6b6c5b8bd699335`（2021-04-05，作者停止维护前的最终提交）
- 许可：MIT

## 文件对照

| 本地文件 | 上游路径 | 用途（本项目的移植参考） |
|---|---|---|
| `main.ts` | `web/main.ts` | 右键菜单构建（getBranch/RemoteBranch/Tag/Stash/Commit/Uncommitted ContextMenuActions）、全部对话框（Push/Rebase/Reset/Cherry-pick/Pull…） |
| `dataSource.ts` | `src/dataSource.ts` | 全部 git 命令实现（fetch/push/rebase/reset/cherryPick/revert/pull/deleteRemoteBranch/pushTag…）与错误处理 |
| `graph.ts` | `web/graph.ts` | 泳道图渲染（本项目的 buildGitGraph 移植源） |
| `contextMenu.ts` | `web/contextMenu.ts` | 右键菜单组件（分组/divider/动态刷新） |
| `CHANGELOG.md` | `CHANGELOG.md` | 功能演进与 issue 编号（常用性研究依据） |

## 重新拉取

```sh
UPSTREAM=docs/upstream/vscode-git-graph
BASE=https://raw.githubusercontent.com/mhutchie/vscode-git-graph/master
curl -sL "$BASE/web/main.ts"         -o $UPSTREAM/main.ts
curl -sL "$BASE/src/dataSource.ts"   -o $UPSTREAM/dataSource.ts
curl -sL "$BASE/web/graph.ts"        -o $UPSTREAM/graph.ts
curl -sL "$BASE/web/contextMenu.ts"  -o $UPSTREAM/contextMenu.ts
curl -sL "$BASE/CHANGELOG.md"        -o $UPSTREAM/CHANGELOG.md
```

## 已沉淀的移植结论（速查）

- **泳道布局**：`graph.ts` 的 Graph 类 → `src/client/index.js` 的 `buildGitGraph`/`gitGraphPaths`
- **fetch**：`dataSource.ts` `fetch()`（`--all`/`--prune`）→ `lib/index.mjs` `gitFetchAction`
- **push**：`dataSource.ts` `pushBranch()` + `main.ts` Push Branch 对话框 → `gitPushAction` + push 对话框
- **stash**：`main.ts` Stash/Uncommitted Context Menu + `dataSource.ts` → `gitStashAction`
- **远程/标签操作**：`dataSource.ts` `deleteRemoteBranch()`（降级语义）/`pushTag()`/`deleteTag()` → `gitRemoteAction`
- **研究中**：Rebase / Reset（祖先守卫）/ Cherry-pick / Pull
