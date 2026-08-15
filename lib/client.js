window.__ModuleLoader__.load({ id: "dsh-git-status", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
// dsh-git-status 浏览器端 half：自渲染 DOM，零 React 依赖（greeter 模式）。
// 单模块：Git 状态（commit DAG 泳道图 + 行内详情 diff + 分支操作）。
// 数据通道：Node half 自造路由（/plugins/dsh-git-status/*）；
// 布局锚点：官方 DOM 属性（data-chat-flow 等），不依赖 React 内部结构。
// 构建：scripts/build-client.js 包成 __ModuleLoader__.load 契约（CJS）。
const BASE = '/plugins/dsh-git-status'

const I18N = {
  zh: {
    copied: '已复制到剪贴板',
    copyFailed: '复制失败',
    close: '关闭',
    gitStatus: 'Git 状态',
    gitHint: '点击打开 Git 状态面板',
    gitAll: '所有分支',
    gitHead: '当前分支',
    gitNotRepo: '当前工作区不是 git 仓库',
    gitNoCommits: '（无提交）',
    gitMore: '仅显示前 {n} 条，有更多',
    gitError: '加载失败',
    gitLoading: '加载中…',
    gitCopyHash: '复制 hash',
    gitFiles: '变更文件',
    gitNoFiles: '（无文件变更）',
    gitChanges: '更改',
    gitStagedChanges: '暂存的更改',
    gitUntracked: '未跟踪',
    gitTruncated: '（diff 过长，已截断）',
    gitDetached: '游离 HEAD',
    gitUncommitted: '未提交改动：未暂存（{unstaged} 处）· 已暂存（{staged} 处）',
    gitStash: 'stash',
    gitSwitchTo: '切换到 {branch}',
    gitCurrentBranch: '（当前分支）',
    gitCreateFromRemote: '创建本地分支 {branch} 并检出（{remote}）',
    gitCreateBtn: '＋ 新分支',
    gitCreateTitle: '创建并检出新分支',
    gitCreatePlaceholder: '新分支名',
    gitCreateSubmit: '创建并检出',
    gitCreatePrompt: '请输入分支名',
    gitCreateOk: '已创建分支 {name}',
    gitSwitchOk: '已切换到 {branch}',
    gitErr: '操作失败',
    gitErrInvalidBranchName: '分支名无效',
    gitErrBranchAlreadyExists: '分支已存在',
    gitErrTargetBranchNotFound: '分支不存在',
    gitErrConflictsPresent: '存在未解决冲突',
    gitErrOperationInProgress: '有 git 操作正在进行',
    gitErrBranchInOtherWorktree: '该分支已在其他工作区检出',
    gitErrTrackedChangesWouldBeOverwritten: '本地改动会被覆盖',
    gitErrUntrackedChangesWouldBeOverwritten: '未跟踪文件会被覆盖',
    gitErrCannotDeleteCurrent: '不能删除当前分支',
    gitErrBranchNotFullyMerged: '分支未完全合并',
    gitErrCannotMergeSelf: '不能合并当前分支自身',
    gitErrMergeConflicts: '合并冲突，请解决后继续或中止',
    gitErrNoMergeInProgress: '没有进行中的合并',
    gitErrMergeConflictsRemain: '仍有未解决冲突，无法继续合并',
    gitErrStartPointNotFound: '起始点不存在',
    gitErrInvalidStartPoint: '无效的起始点',
    gitConflicts: '存在 {n} 个未解决冲突',
    gitOpMerge: '合并进行中',
    gitOpCherryPick: 'cherry-pick 进行中',
    gitOpRevert: 'revert 进行中',
    gitOpRebase: 'rebase 进行中',
    gitOpBisect: 'bisect 进行中',
    gitOpSequencer: 'sequencer 进行中',
    gitMergeAbort: '中止合并',
    gitMergeContinue: '继续合并',
    gitMergeInto: '合并 {branch} 到当前分支',
    gitRenameBranch: '重命名分支 {branch}',
    gitRenameTitle: '重命名分支',
    gitRenameSubmit: '重命名',
    gitRenameOk: '已重命名 {from} → {name}',
    gitDeleteBranch: '删除分支 {branch}',
    gitDeleteBranchForce: '强制删除分支 {branch}（未合并）',
    gitDeleteConfirm: '确定删除分支 {branch}？',
    gitDeleteForceConfirm: '确定强制删除未合并分支 {branch}？此操作不可恢复。',
    gitDeleteOk: '已删除分支 {branch}',
    gitDeleteBtn: '删除',
    gitDeleteForceBtn: '强制删除',
    gitMergeOk: '已合并 {branch}',
    gitMergeAborted: '已中止合并',
    gitMergeContinued: '合并已完成',
    gitCreateFromTag: '在 {tag} 创建分支并检出',
    gitFetch: '从远程拉取',
    gitFetching: '拉取中…',
    gitFetchOk: '已从远程拉取',
    gitErrNetworkError: '网络或认证错误',
    gitErrRemoteNotFound: '远程不存在',
    gitErrRemoteUnreachable: '远程仓库不存在或不可达',
    gitPush: '推送到远程…',
    gitPushTitle: '推送分支 {branch}',
    gitPushRemote: '推送目标远程',
    gitPushSetUpstream: '设置上游（--set-upstream）',
    gitPushMode: '推送模式',
    gitPushModeNormal: '普通',
    gitPushModeForceWithLease: 'Force with lease',
    gitPushModeForce: 'Force 强制',
    gitPushOk: '已推送 {branch} → {remote}',
    gitErrPushRejected: '推送被拒绝（远程有本地没有的提交，先拉取或改用 force 模式）',
    gitErrRemoteRejected: '远程拒绝推送（服务端规则/hook）',
    gitErrInvalidPushMode: '无效的推送模式',
    gitDeleteRemoteBranch: '删除远程分支 {branch}',
    gitDeleteRemoteBranchConfirm: '确定删除远程分支 {remote}/{branch}？此操作不可恢复。',
    gitDeleteRemoteBranchOk: '已删除远程分支 {remote}/{branch}',
    gitDeleteRemoteBranchDegraded: '远程分支已不存在，已清理本地跟踪引用',
    gitPushTag: '推送 tag {tag}',
    gitPushTagTo: '推送 tag {tag} 到 {remote}',
    gitPushTagOk: '已推送 tag {tag} → {remote}',
    gitDeleteTag: '删除 tag {tag}',
    gitDeleteTagLocalOnly: '仅删除本地 tag {tag}',
    gitDeleteTagWithRemote: '删除本地并同步删除远程 {remote} 的 {tag}',
    gitDeleteTagConfirm: '确定删除 tag {tag}？此操作不可恢复。',
    gitDeleteTagOk: '已删除 tag {tag}',
    gitErrTagNotFound: 'tag 不存在',
    gitErrInvalidTagName: '无效的 tag 名',
    gitErrRemoteRefNotFound: '远程引用不存在',
    gitPushBtn: '推送',
    gitStashApply: '应用 stash {selector}',
    gitStashPop: '弹出 stash {selector}',
    gitStashDrop: '删除 stash {selector}',
    gitStashDropConfirm: '确定删除 stash {selector}？此操作不可恢复。',
    gitStashBranch: '从 stash {selector} 创建分支并检出',
    gitStashBranchTitle: '从 stash 创建分支',
    gitStashUncommitted: '暂存未提交改动…',
    gitStashUncommittedTitle: '暂存未提交改动',
    gitStashMessage: '说明（可选）',
    gitStashIncludeUntracked: '包含未跟踪文件',
    gitStashOk: '已暂存未提交改动',
    gitStashApplyOk: '已应用 {selector}',
    gitStashPopOk: '已弹出 {selector}',
    gitStashDropOk: '已删除 {selector}',
    gitStashBranchOk: '已从 {selector} 创建分支 {branch}',
    gitErrStashConflicts: 'stash 应用冲突，请解决后继续',
    gitErrStashNotFound: 'stash 不存在',
    gitErrInvalidStashSelector: '无效的 stash 引用',
    gitErrStashNothingToSave: '没有可暂存的改动',
    gitErrUncommittedChangesPresent: '工作区有未提交改动',
    gitSwitchUncommitted: '工作区有未提交改动（已暂存 {staged} 处 · 未暂存 {unstaged} 处），切换到 {branch} 会把这些改动一起带过去。',
    gitSwitchUncommittedUntracked: '（另有 {untracked} 个未跟踪文件）',
    gitSwitchAnyway: '仍然切换',
    gitCancel: '取消',
    timeJustNow: '刚刚',
    timeMin: '{n} 分钟前',
    timeHour: '{n} 小时前',
    timeDay: '{n} 天前',
  },
  en: {
    copied: 'Copied to clipboard',
    copyFailed: 'Copy failed',
    close: 'Close',
    gitStatus: 'Git Status',
    gitHint: 'Click to open Git Status',
    gitAll: 'All branches',
    gitHead: 'Current branch',
    gitNotRepo: 'Current workspace is not a git repository',
    gitNoCommits: '(no commits)',
    gitMore: 'Showing first {n} commits, more available',
    gitError: 'Failed to load',
    gitLoading: 'Loading…',
    gitCopyHash: 'Copy hash',
    gitFiles: 'Changed files',
    gitNoFiles: '(no file changes)',
    gitChanges: 'Changes',
    gitStagedChanges: 'Staged Changes',
    gitUntracked: 'Untracked',
    gitTruncated: '(diff truncated)',
    gitDetached: 'detached HEAD',
    gitUncommitted: 'Uncommitted: {unstaged} unstaged · {staged} staged',
    gitStash: 'stash',
    gitSwitchTo: 'Switch to {branch}',
    gitCurrentBranch: '(current)',
    gitCreateFromRemote: 'Create local branch {branch} and check out ({remote})',
    gitCreateBtn: '+ New branch',
    gitCreateTitle: 'Create and check out new branch',
    gitCreatePlaceholder: 'new branch name',
    gitCreateSubmit: 'Create & check out',
    gitCreatePrompt: 'Please enter a branch name',
    gitCreateOk: 'Branch {name} created',
    gitSwitchOk: 'Switched to {branch}',
    gitErr: 'Operation failed',
    gitErrInvalidBranchName: 'Invalid branch name',
    gitErrBranchAlreadyExists: 'Branch already exists',
    gitErrTargetBranchNotFound: 'Branch not found',
    gitErrConflictsPresent: 'Unresolved conflicts present',
    gitErrOperationInProgress: 'A git operation is in progress',
    gitErrBranchInOtherWorktree: 'Branch is checked out in another worktree',
    gitErrTrackedChangesWouldBeOverwritten: 'Local changes would be overwritten',
    gitErrUntrackedChangesWouldBeOverwritten: 'Untracked files would be overwritten',
    gitErrCannotDeleteCurrent: 'Cannot delete the current branch',
    gitErrBranchNotFullyMerged: 'Branch is not fully merged',
    gitErrCannotMergeSelf: 'Cannot merge the current branch into itself',
    gitErrMergeConflicts: 'Merge conflicts — resolve then continue, or abort',
    gitErrNoMergeInProgress: 'No merge in progress',
    gitErrMergeConflictsRemain: 'Unresolved conflicts remain, cannot continue',
    gitErrStartPointNotFound: 'Start point does not exist',
    gitErrInvalidStartPoint: 'Invalid start point',
    gitConflicts: '{n} unresolved conflict(s)',
    gitOpMerge: 'Merge in progress',
    gitOpCherryPick: 'Cherry-pick in progress',
    gitOpRevert: 'Revert in progress',
    gitOpRebase: 'Rebase in progress',
    gitOpBisect: 'Bisect in progress',
    gitOpSequencer: 'Sequencer in progress',
    gitMergeAbort: 'Abort merge',
    gitMergeContinue: 'Continue merge',
    gitMergeInto: 'Merge {branch} into current',
    gitRenameBranch: 'Rename branch {branch}',
    gitRenameTitle: 'Rename branch',
    gitRenameSubmit: 'Rename',
    gitRenameOk: 'Renamed {from} → {name}',
    gitDeleteBranch: 'Delete branch {branch}',
    gitDeleteBranchForce: 'Force-delete branch {branch} (unmerged)',
    gitDeleteConfirm: 'Delete branch {branch}?',
    gitDeleteForceConfirm: 'Force-delete unmerged branch {branch}? This cannot be undone.',
    gitDeleteOk: 'Branch {branch} deleted',
    gitDeleteBtn: 'Delete',
    gitDeleteForceBtn: 'Force delete',
    gitMergeOk: 'Merged {branch}',
    gitMergeAborted: 'Merge aborted',
    gitMergeContinued: 'Merge completed',
    gitCreateFromTag: 'Create branch from {tag} and check out',
    gitFetch: 'Fetch from Remote(s)',
    gitFetching: 'Fetching…',
    gitFetchOk: 'Fetched from remote(s)',
    gitErrNetworkError: 'Network or authentication error',
    gitErrRemoteNotFound: 'Remote not found',
    gitErrRemoteUnreachable: 'Remote repository not found or unreachable',
    gitPush: 'Push to remote…',
    gitPushTitle: 'Push branch {branch}',
    gitPushRemote: 'Push to remote',
    gitPushSetUpstream: 'Set upstream (--set-upstream)',
    gitPushMode: 'Push mode',
    gitPushModeNormal: 'Normal',
    gitPushModeForceWithLease: 'Force with lease',
    gitPushModeForce: 'Force',
    gitPushOk: 'Pushed {branch} → {remote}',
    gitErrPushRejected: 'Push rejected (remote has commits you lack — pull first or use a force mode)',
    gitErrRemoteRejected: 'Push rejected by the remote (server rules/hook)',
    gitErrInvalidPushMode: 'Invalid push mode',
    gitDeleteRemoteBranch: 'Delete remote branch {branch}',
    gitDeleteRemoteBranchConfirm: 'Delete remote branch {remote}/{branch}? This cannot be undone.',
    gitDeleteRemoteBranchOk: 'Deleted remote branch {remote}/{branch}',
    gitDeleteRemoteBranchDegraded: 'Remote branch no longer exists — cleaned up the local tracking reference',
    gitPushTag: 'Push tag {tag}',
    gitPushTagTo: 'Push tag {tag} to {remote}',
    gitPushTagOk: 'Pushed tag {tag} → {remote}',
    gitDeleteTag: 'Delete tag {tag}',
    gitDeleteTagLocalOnly: 'Delete local tag {tag} only',
    gitDeleteTagWithRemote: 'Delete local tag {tag} and on remote {remote}',
    gitDeleteTagConfirm: 'Delete tag {tag}? This cannot be undone.',
    gitDeleteTagOk: 'Deleted tag {tag}',
    gitErrTagNotFound: 'Tag not found',
    gitErrInvalidTagName: 'Invalid tag name',
    gitErrRemoteRefNotFound: 'Remote reference not found',
    gitPushBtn: 'Push',
    gitStashApply: 'Apply stash {selector}',
    gitStashPop: 'Pop stash {selector}',
    gitStashDrop: 'Drop stash {selector}',
    gitStashDropConfirm: 'Drop stash {selector}? This cannot be undone.',
    gitStashBranch: 'Create branch from stash {selector} and check out',
    gitStashBranchTitle: 'Create branch from stash',
    gitStashUncommitted: 'Stash uncommitted changes…',
    gitStashUncommittedTitle: 'Stash uncommitted changes',
    gitStashMessage: 'Message (optional)',
    gitStashIncludeUntracked: 'Include untracked files',
    gitStashOk: 'Uncommitted changes stashed',
    gitStashApplyOk: 'Applied {selector}',
    gitStashPopOk: 'Popped {selector}',
    gitStashDropOk: 'Dropped {selector}',
    gitStashBranchOk: 'Created branch {branch} from {selector}',
    gitErrStashConflicts: 'Stash apply conflicts — resolve them first',
    gitErrStashNotFound: 'Stash not found',
    gitErrInvalidStashSelector: 'Invalid stash reference',
    gitErrStashNothingToSave: 'No local changes to stash',
    gitErrUncommittedChangesPresent: 'Working tree has uncommitted changes',
    gitSwitchUncommitted: 'The working tree has uncommitted changes ({staged} staged · {unstaged} unstaged); switching to {branch} will carry them along.',
    gitSwitchUncommittedUntracked: '({untracked} untracked file(s))',
    gitSwitchAnyway: 'Switch anyway',
    gitCancel: 'Cancel',
    timeJustNow: 'just now',
    timeMin: '{n}m ago',
    timeHour: '{n}h ago',
    timeDay: '{n}d ago',
  },
}
module.exports = {
  name: 'git-status-client',
  apply(ctx) {
    const body = document.body
    if (body === null) return
    const L = () => (I18N[(document.documentElement.lang || 'zh').slice(0, 2)] === undefined ? I18N.zh : I18N[(document.documentElement.lang || 'zh').slice(0, 2)])
    const t = (key, vars) => {
      let s = L()[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
      return s
    }

    // ---------- 样式 ----------
    const STYLE_ID = 'dsh-git-status-style'
    if (document.getElementById(STYLE_ID) === null) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = `
[data-dsc-btn] {
  border: none; border-radius: 6px; padding: 2px 8px; font-size: 11px;
  cursor: pointer; color: var(--dsw-alias-text-1, #eee);
  background: rgba(255,255,255,.08); font-family: system-ui;
}
[data-dsc-btn]:hover { background: rgba(255,255,255,.16); }
[data-dsc-btn]:disabled { opacity: .45; cursor: default; }
[data-dsc-btn]:disabled:hover { background: rgba(255,255,255,.08); }
[data-dsc-btn].danger:hover { background: rgba(255,69,58,.85); }
[data-dsc-btn].armed { background: rgba(255,69,58,.85); }
/* 面板角上悬浮开关（框外 FAB 形态）：位置由 JS 按面板右上角计算并钳制在视口内；
   z-index 高于面板（916），钳制时压在面板边缘上方仍可点 */
[data-dsc-toggle] {
  position: fixed; z-index: 917; width: 30px; height: 30px;
  border-radius: 10px; border: 1px solid rgba(255,255,255,.08);
  background: var(--dsw-hovercard-bg, #2C2C2E); color: var(--dsw-alias-text-1, #eee);
  font-size: 14px; cursor: pointer; display: none; align-items: center; justify-content: center;
  box-shadow: var(--dsw-shadow-lv3, 0 4px 12px rgba(0,0,0,.3));
}
[data-dsc-toggle]:hover { background: var(--dsw-alias-button-floating-hover, rgba(255,255,255,.22)); color: var(--dsw-alias-text-accent, #4c9aff); }
[data-dsc-toggle].on { outline: 1px solid var(--dsw-alias-text-accent, #4c9aff); }
/* 操作反馈提示（切换/删除分支等）：位置由 flash() 动态定位到面板框外正上方
   居中（tooltip 式，贴顶时 fallback 面板下方）；成功绿底 / 错误红底，与面板
   背景明显区分。 */
[data-dsc-msg] {
  position: fixed; z-index: 932; max-width: 260px; padding: 6px 14px;
  border-radius: 999px; font-size: 12px;
  font-family: system-ui; color: #fff; background: rgba(56,142,60,.95);
  box-shadow: var(--dsw-shadow-lv3); border: 1px solid rgba(255,255,255,.18);
  display: none; pointer-events: none;
}
[data-dsc-msg].error { background: rgba(211,47,47,.95); }
/* 首次使用提示气泡（跟随开关按钮，只显示一次） */
[data-dsc-hint] {
  position: fixed; z-index: 931; max-width: 240px; padding: 6px 10px;
  border-radius: 8px; font-size: 12px; line-height: 1.5; font-family: system-ui;
  color: var(--dsw-alias-text-1, #eee);
  background: var(--dsw-hovercard-bg, #2C2C2E); box-shadow: var(--dsw-shadow-lv3);
  border: 1px solid rgba(255,255,255,.08); display: none; pointer-events: none;
}
[data-dsc-bm-time] { opacity: .5; font-size: 10px; flex: none; }
[data-dsc-git] {
  position: fixed; right: 12px; top: 96px; z-index: 916; width: 380px;
  max-width: calc(100vw - 24px); box-sizing: border-box; display: none;
  flex-direction: column; border-radius: 12px; overflow: hidden;
  background: var(--dsw-hovercard-bg, #2C2C2E); color: var(--dsw-alias-text-1, #eee);
  box-shadow: var(--dsw-shadow-lv3); border: 1px solid rgba(255,255,255,.08);
  font-family: system-ui; font-size: 12px;
  /* 滚动条 thumb：比面板背景浅约三档的灰（用户偏好：明显可辨但仍是低调灰）。
     宿主未定义主题级 --dsw-hovercard-bg，面板背景恒为 #2C2C2E；
     用 color-mix 把背景向主题中性灰 --dsw-static-neutral-400 提亮——
     语义上恒为「相对背景的灰阶」，换主题/换背景 token 也自动协调；
     旧引擎不支持 color-mix 时回退到等价的硬编码值。 */
  --dsh-scrollbar-thumb: rgb(77, 78, 80);
  --dsh-scrollbar-thumb: color-mix(in srgb, var(--dsw-hovercard-bg, #2C2C2E) 72%, var(--dsw-static-neutral-400, rgb(162, 164, 166)));
  --dsh-scrollbar-thumb-hover: rgb(84, 85, 87);
  --dsh-scrollbar-thumb-hover: color-mix(in srgb, var(--dsw-hovercard-bg, #2C2C2E) 66%, var(--dsw-static-neutral-400, rgb(162, 164, 166)));
}
[data-dsc-git].open { display: flex; max-height: min(72vh, 600px); }
[data-dsc-git-head] {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px; flex: none;
  border-bottom: 1px solid rgba(255,255,255,.06); font-weight: 600;
  cursor: grab; user-select: none; touch-action: none;
}
[data-dsc-git-head]:active { cursor: grabbing; }
/* 主列表滚动区：scrollbar-gutter 预留 8px，滚动条出现/消失时行内容不再左右跳 */
[data-dsc-git-body] { overflow-y: auto; flex: 1; scrollbar-gutter: stable; }
[data-dsc-git-rows] { position: relative; }
[data-dsc-git-svg] { position: absolute; left: 0; top: 0; pointer-events: none; overflow: hidden; }
.dsc-gline-shadow { fill: none; stroke: rgba(0,0,0,.4); stroke-width: 3.4; }
.dsc-gline { fill: none; stroke-width: 2; }
.dsc-gline-dash { stroke: #808080; stroke-dasharray: 2px 3px; opacity: .9; }
[data-dsc-git-row] {
  display: flex; align-items: center; gap: 5px; padding: 0 8px; cursor: pointer;
  height: 26px; box-sizing: border-box; overflow: hidden;
}
[data-dsc-git-row]:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06)); }
[data-dsc-git-row].sel { background: rgba(76,154,255,.16); }
[data-dsc-git-subject] {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0;
}
[data-dsc-git-row].sel [data-dsc-git-subject] { color: var(--dsw-alias-text-accent, #4c9aff); }
[data-dsc-git-meta] { display: flex; flex: none; gap: 6px; opacity: .55; font-size: 10px; white-space: nowrap; }
[data-dsc-git-copy] {
  flex: none; border: none; background: none; color: inherit; cursor: pointer;
  padding: 0 2px; opacity: 0; font-size: 11px;
}
[data-dsc-git-row]:hover [data-dsc-git-copy] { opacity: .7; }
[data-dsc-git-copy]:hover { opacity: 1 !important; }
.dsc-gref {
  flex: none; border-radius: 4px; padding: 0 5px; font-size: 10px; line-height: 16px;
  white-space: nowrap; font-weight: 600;
}
.dsc-gref-head { background: rgba(255,69,58,.22); color: #ff6961; }
.dsc-gref-branch { background: rgba(245,166,35,.18); color: #f7b84d; }
.dsc-gref-remote { background: rgba(76,154,255,.18); color: #7ab8ff; }
.dsc-gref-tag { background: rgba(52,199,89,.16); color: #5fd97f; }
.dsc-gref-stash { background: rgba(175,82,222,.18); color: #d47fff; }
/* 同名远程子标签（内嵌于本地分支 pill，同上游 gitRefHeadRemote）：远程色小块 */
.dsc-gref-remote-sub {
  margin-left: 5px; padding: 0 4px; border-radius: 3px;
  background: rgba(76,154,255,.22); color: #7ab8ff; font-size: 9px; line-height: 14px;
}
/* 当前 checkout 分支 pill 高亮（同上游 gitRef.active 语义，强化为一眼可辨认）：
   背景加浓 + 金色内描边 + 加粗；类挂在本地分支 pill 上（.dsc-gref-branch） */
.dsc-gref-branch.dsc-gref-current {
  background: rgba(245,166,35,.36); color: #ffe3a8; font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(245,166,35,.5);
}
/* 分支徽标可右键操作（context-menu 光标提示） */
.dsc-gref-branch, .dsc-gref-remote, .dsc-gref-remote-sub { cursor: context-menu; }
/* 分支操作右键菜单 / 创建分支对话框 / 切换确认框（浮层卡片，同 hovercard 风格） */
[data-dsc-git-ctx], [data-dsc-git-create], [data-dsc-git-confirm] {
  position: fixed; z-index: 930; min-width: 150px; max-width: 320px;
  border-radius: 8px; padding: 4px; display: none; font-size: 12px;
  color: var(--dsw-alias-text-1, #eee);
  background: var(--dsw-hovercard-bg, #2C2C2E);
  border: 1px solid rgba(255,255,255,.08); box-shadow: var(--dsw-shadow-lv3);
}
/* 右键菜单可在其他浮层之上弹出（如 push 对话框的 remote 选择）：层级最高 */
[data-dsc-git-ctx] { z-index: 935; }
[data-dsc-git-ctx] button {
  display: block; width: 100%; text-align: left; padding: 6px 8px;
  border-radius: 6px; color: inherit; background: none; border: none; cursor: pointer;
  font-size: inherit; /* 覆盖 UA 表单控件默认 13.3333px，跟随容器字号 */
}
[data-dsc-git-ctx] button:hover { background: rgba(255,255,255,.07); }
[data-dsc-git-ctx] button:disabled { opacity: .45; cursor: default; }
[data-dsc-git-ctx] button:disabled:hover { background: none; }
/* 面板内按钮（头部/合并条/创建对话框）：跟随面板字号，覆盖 UA 表单控件默认 13.3333px */
[data-dsc-git] [data-dsc-btn], [data-dsc-git-create] [data-dsc-btn], [data-dsc-git-confirm] [data-dsc-btn] { font-size: inherit; }
/* 切换确认框（未提交改动提醒）：标题 + 正文 + 右对齐按钮行 */
[data-dsc-git-confirm] { padding: 10px 12px; width: 260px; box-sizing: border-box; }
[data-dsc-git-confirm] .dsc-git-confirm-title { font-weight: 600; margin-bottom: 6px; }
[data-dsc-git-confirm] .dsc-git-confirm-text { opacity: .85; line-height: 1.5; }
[data-dsc-git-confirm] .dsc-git-confirm-actions { display: flex; gap: 6px; margin-top: 10px; justify-content: flex-end; }
/* 危险操作确认按钮（删除分支等不可恢复操作）：红色实底，与普通确认（仍然切换）区分 */
[data-dsc-git-confirm] .dsc-git-confirm-ok-danger {
  background: rgba(232,73,73,.92); color: #fff;
}
[data-dsc-git-confirm] .dsc-git-confirm-ok-danger:hover { background: rgba(255,92,92,1); }
/* push/stash 对话框（浮层卡片，同 confirm/create 框风格）：选项行 + toggle 按钮 */
[data-dsc-git-push], [data-dsc-git-stash] {
  position: fixed; z-index: 930; min-width: 250px; max-width: 340px;
  border-radius: 8px; padding: 10px 12px; display: none; font-size: 12px;
  box-sizing: border-box; color: var(--dsw-alias-text-1, #eee);
  background: var(--dsw-hovercard-bg, #2C2C2E);
  border: 1px solid rgba(255,255,255,.08); box-shadow: var(--dsw-shadow-lv3);
}
[data-dsc-git-push] .dsc-git-push-title, [data-dsc-git-stash] .dsc-git-stash-title {
  font-weight: 600; margin-bottom: 8px;
}
.dsc-git-opt-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-bottom: 6px; font-size: 11px;
}
.dsc-git-opt-row label { opacity: .85; flex: 1; min-width: 0; }
.dsc-git-opt-group { display: flex; gap: 4px; flex: none; }
[data-dsc-git-stash] input[type='text'] {
  width: 100%; box-sizing: border-box; padding: 4px 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.25);
  color: inherit; font-size: 11px; outline: none; margin-bottom: 6px;
}
[data-dsc-git-stash] input[type='text']:focus { border-color: var(--dsw-alias-text-accent, #4c9aff); }
/* toggle 按钮（Set Upstream / Include Untracked / Push Mode 互斥组）：on 高亮 accent */
.dsc-git-toggle {
  border: 1px solid rgba(255,255,255,.14); border-radius: 6px; padding: 2px 8px;
  font-size: 11px; cursor: pointer; background: rgba(255,255,255,.05); color: inherit;
}
.dsc-git-toggle.on {
  border-color: var(--dsw-alias-text-accent, #4c9aff);
  color: var(--dsw-alias-text-accent, #4c9aff);
  background: rgba(76,154,255,.12);
}
.dsc-git-opt-actions { display: flex; gap: 6px; margin-top: 8px; justify-content: flex-end; }
[data-dsc-git-create] { padding: 8px 10px; display: none; }
[data-dsc-git-create] .dsc-git-create-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;
}
[data-dsc-git-create] .dsc-git-create-title { font-weight: 600; }
[data-dsc-git-create] input {
  width: 100%; box-sizing: border-box; padding: 4px 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.25);
  color: inherit; font-size: 11px; outline: none;
}
[data-dsc-git-create] input:focus { border-color: var(--dsw-alias-text-accent, #4c9aff); }
[data-dsc-git-create-err] { color: #ff6961; font-size: 11px; margin-top: 4px; min-height: 14px; }
/* 初始空输入的提示态（「请输入分支名」）：弱化颜色，区别于真实错误 */
[data-dsc-git-create-err].hint { color: var(--dsw-alias-text-2, rgba(255,255,255,.55)); }
[data-dsc-git-create] .dsc-git-create-actions { display: flex; gap: 6px; margin-top: 6px; }
[data-dsc-git-state] { display: flex; gap: 4px; align-items: center; margin-left: 8px; font-size: 11px; min-width: 0; overflow: hidden; }
[data-dsc-git-state] .dsc-git-state-item { padding: 1px 6px; border-radius: 8px; white-space: nowrap; }
[data-dsc-git-state] .dsc-git-state-warn { background: rgba(255,149,0,.14); color: #ff9f0a; }
[data-dsc-git-state] .dsc-git-state-op { background: rgba(255,59,48,.14); color: #ff6b61; }
[data-dsc-git-mergebar] {
  display: flex; gap: 6px; align-items: center; padding: 4px 12px; font-size: 11px;
  background: rgba(255,59,48,.1); color: #ff6b61; border-bottom: 1px solid rgba(255,255,255,.06);
}
[data-dsc-git-mergebar] span { flex: 1; }
[data-dsc-git-note] { padding: 18px 16px; text-align: center; opacity: .65; }
[data-dsc-git-inline] {
  box-sizing: border-box; overflow-y: auto;
  margin: 0 8px 4px; padding: 8px 10px; border-radius: 8px;
  display: flex; flex-direction: column; gap: 6px;
  background: var(--dsw-hovercard-bg, #2C2C2E);
  border: 1px solid rgba(255,255,255,.08);
}
[data-dsc-git-dtitle] { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-weight: 600; }
[data-dsc-git-dsub] { opacity: .65; font-size: 11px; }
[data-dsc-git-dbody] {
  white-space: pre-wrap; word-break: break-word; font-size: 11px; opacity: .85;
  max-height: 120px; overflow-y: auto; scrollbar-gutter: stable;
}
[data-dsc-git-dfiles] { border-top: 1px solid rgba(255,255,255,.06); padding-top: 6px; }
[data-dsc-git-dfile] {
  display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 6px;
  cursor: pointer; font-size: 11px; overflow: hidden;
}
[data-dsc-git-dfile]:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06)); }
[data-dsc-git-dfile].sel { background: rgba(76,154,255,.16); }
[data-dsc-git-dfile-path] { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsc-gnum { flex: none; font-family: ui-monospace, monospace; font-size: 10px; }
.dsc-gnum-add { color: #34c759; }
.dsc-gnum-del { color: #ff453a; }
/* 未跟踪文件徽标（未提交改动详情「更改」组内，弱化样式） */
.dsc-gfile-untracked { flex: none; font-size: 9px; padding: 0 4px; border-radius: 3px; background: rgba(255,255,255,.1); color: var(--dsw-alias-text-2, rgba(255,255,255,.55)); }
[data-dsc-git-dpatch] {
  margin: 0; white-space: pre-wrap; word-break: break-word;
  font-family: ui-monospace, monospace; font-size: 10.5px; line-height: 1.5;
  background: rgba(0,0,0,.28); border-radius: 6px; padding: 6px 8px;
  max-height: 200px; overflow-y: auto; display: none; scrollbar-gutter: stable;
}
[data-dsc-git-dpatch].on { display: block; }

`
      document.head.appendChild(style)
    }

    
    // ---------- 共享工具 ----------
    const flowOf = () => document.querySelector('[data-chat-flow=""]')
    const isChatView = () => flowOf() !== null
    // 提示气泡（分支操作成功/失败等）：定位在面板框外正上方居中（tooltip 式，
    // 操作反馈就近且不遮挡面板内容）；面板贴顶放不下时 fallback 到面板下方。
    // kind：'success'（绿底）| 'error'（红底），与面板背景明显区分。
    let msgTimer = null
    const flash = (text, kind = 'success') => {
      msg.textContent = text
      msg.classList.toggle('error', kind === 'error')
      msg.style.display = 'block'
      msg.style.visibility = 'hidden' // 先测量实际尺寸再定位
      const w = msg.offsetWidth
      const h = msg.offsetHeight
      msg.style.visibility = ''
      const panelRect = gitPanel.getBoundingClientRect()
      let left = panelRect.left + (panelRect.width - w) / 2
      left = Math.min(Math.max(8, left), window.innerWidth - w - 8)
      let top = panelRect.top - h - 8
      if (top < 8) top = Math.min(panelRect.bottom + 8, window.innerHeight - h - 8)
      msg.style.left = `${left}px`
      msg.style.top = `${top}px`
      if (msgTimer !== null) clearTimeout(msgTimer)
      msgTimer = setTimeout(() => { msg.style.display = 'none' }, 1400)
    }
    // 当前会话 id（client 端 sessions 服务，better-sidebar 模式）：
    // 惰性解析——每次请求时取最新选中会话；服务不可用时返回空串，
    // 服务端自动回退 workspaceRegistry / process.cwd()。
    const currentSessionId = () => {
      try {
        const sessions = ctx?.get?.('sessions')
        return sessions?.list?.getSnapshot?.()?.current ?? ''
      } catch {
        return ''
      }
    }
    const sessionQuery = () => {
      const id = currentSessionId()
      return id === '' ? '' : `&session=${encodeURIComponent(id)}`
    }
// ---------- Git Graph（右缘浮窗，移植 vscode-git-graph 泳道算法） ----------
    // 算法移植自 mhutchie/vscode-git-graph 的 web/graph.ts：
    // - 每条"分支线"沿第一父链向下延伸，中间顶点共享一线（Vertex.onBranch）
    // - 列分配贪心最左：registerUnavailable 把被占用的点往右推（nextX）
    // - 泳道复用：availableColours[i] 记每色最后使用行，新线只占"已在上方结束"的旧泳道
    // - 合并提交的第二父向下连到已存在的父分支线（pointConnectingTo）
    // - 渲染：网格制 + shadow/彩色双 path + 折角过渡（Angular），右缘渐变淡出
    const GIT_GRID = { x: 18, y: 26, offsetX: 10, offsetY: 13, expandY: 340 }
    // 行内展开动态高度：默认 = GIT_GRID.expandY（上限）。详情内容渲染完成后按实际
    // 高度收缩（≤ 上限）。图高度 / 线拉伸 / 盒子高度三者都跟随它，保证一致不穿帮。
    let gitExpandY = GIT_GRID.expandY
    const GIT_COLORS = ['#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784', '#aed581', '#ffb74d', '#ff8a65', '#a1887f']
    const GIT_ROW_PAD = 240
    const NULL_VERTEX = -1

    const fmtRelDate = (unix) => {
      const s = Math.max(0, Math.floor(Date.now() / 1000 - unix))
      if (s < 60) return t('timeJustNow')
      if (s < 3600) return t('timeMin', { n: Math.floor(s / 60) })
      if (s < 86400) return t('timeHour', { n: Math.floor(s / 3600) })
      return t('timeDay', { n: Math.floor(s / 86400) })
    }

    // 泳道布局（原版 Graph.loadCommits + determinePath 移植）。
    const buildGitGraph = (commits) => {
      const hashIndex = new Map()
      commits.forEach((c, i) => hashIndex.set(c.hash, i))
      const vertices = commits.map((c, i) => ({
        id: i,
        onBranch: null,
        x: 0,
        nextX: 0,
        connections: [],
        parents: [],
        children: [],
        processed: 0,
      }))
      for (let i = 0; i < commits.length; i++) {
        for (const p of commits[i].parents) {
          const pi = hashIndex.get(p)
          vertices[i].parents.push(typeof pi === 'number' ? pi : NULL_VERTEX)
          if (typeof pi === 'number') vertices[pi].children.push(i)
        }
      }
      const point = (v) => ({ x: v.x, y: v.id })
      const nextPoint = (v) => ({ x: v.nextX, y: v.id })
      const nextParent = (v) => (v.processed < v.parents.length ? v.parents[v.processed] : null)
      const pointConnectingTo = (v, target, branch) => {
        for (let i = 0; i < v.connections.length; i++) {
          if (v.connections[i] !== undefined && v.connections[i].target === target && v.connections[i].branch === branch) return { x: i, y: v.id }
        }
        return null
      }
      const registerUnavailable = (v, x, target, branch) => {
        if (x === v.nextX) {
          v.nextX = x + 1
          v.connections[x] = { target, branch }
        }
      }
      const addToBranch = (v, branch, x) => {
        if (v.onBranch === null) { v.onBranch = branch; v.x = x }
      }
      const branches = []
      const availableColours = []
      const getAvailableColour = (startAt) => {
        for (let i = 0; i < availableColours.length; i++) {
          if (startAt > availableColours[i]) return i
        }
        availableColours.push(0)
        return availableColours.length - 1
      }
      const determinePath = (startAt) => {
        let i = startAt
        let vertex = vertices[i]
        let parentVertex = nextParent(vertex)
        let lastPoint = vertex.onBranch === null ? nextPoint(vertex) : point(vertex)
        let curVertex, curPoint
        if (parentVertex !== null && parentVertex !== NULL_VERTEX && vertices[parentVertex].parents.length > 0 && vertex.onBranch !== null && vertices[parentVertex].onBranch !== null && vertex.parents.length > 1) {
          // 合并线：第二父已在线上的情形，向下连到该父所在分支线
          let foundPointToParent = false
          const parentBranch = vertices[parentVertex].onBranch
          for (i = startAt + 1; i < vertices.length; i++) {
            curVertex = vertices[i]
            curPoint = pointConnectingTo(curVertex, parentVertex, parentBranch)
            if (curPoint !== null) foundPointToParent = true
            else curPoint = nextPoint(curVertex)
            parentBranch.lines.push({ p1: lastPoint, p2: curPoint, lockedFirst: !foundPointToParent && curVertex !== vertices[parentVertex] ? lastPoint.x < curPoint.x : true })
            registerUnavailable(curVertex, curPoint.x, parentVertex, parentBranch)
            lastPoint = curPoint
            if (foundPointToParent) { vertex.processed++; break }
          }
        } else {
          // 普通分支线：沿第一父链向下
          const branch = { colour: getAvailableColour(startAt), lines: [], end: 0 }
          addToBranch(vertex, branch, lastPoint.x)
          registerUnavailable(vertex, lastPoint.x, vertex, branch)
          for (i = startAt + 1; i < vertices.length; i++) {
            curVertex = vertices[i]
            curPoint = parentVertex === i && vertices[parentVertex].onBranch !== null ? point(vertices[parentVertex]) : nextPoint(curVertex)
            branch.lines.push({ p1: lastPoint, p2: curPoint, lockedFirst: lastPoint.x < curPoint.x })
            registerUnavailable(curVertex, curPoint.x, parentVertex, branch)
            lastPoint = curPoint
            if (parentVertex === i) {
              vertex.processed++
              const parentVertexOnBranch = vertices[parentVertex].onBranch !== null
              addToBranch(vertices[parentVertex], branch, curPoint.x)
              vertex = vertices[parentVertex]
              parentVertex = nextParent(vertex)
              if (parentVertex === null || parentVertexOnBranch) break
            }
          }
          if (i === vertices.length && parentVertex !== null && parentVertex === NULL_VERTEX) vertex.processed++
          branch.end = i
          branches.push(branch)
          availableColours[branch.colour] = i
        }
      }
      let i = 0
      while (i < vertices.length) {
        if (nextParent(vertices[i]) !== null || vertices[i].onBranch === null) determinePath(i)
        else i++
      }
      let maxX = 1
      for (const v of vertices) if (v.nextX > maxX) maxX = v.nextX
      const width = Math.max(0, 2 * GIT_GRID.offsetX + (maxX - 1) * GIT_GRID.x)
      const height = vertices.length * GIT_GRID.y + GIT_GRID.offsetY - GIT_GRID.y / 2
      return { vertices, branches, width, height }
    }

    // 分支线 → SVG path（原版 Branch.draw 移植：像素化 + 展开区拉伸 + 共线合并 + 折角过渡）。
    // expandAt：展开的 commit 行号（-1 = 不展开）。穿过展开区的线按原版规则处理：
    // 垂直直穿拉长；lockedFirst 折角留在展开区上方、下方补竖线；否则展开区下方补竖线、折角整体下移。
    // hasUncommitted：存在未提交虚拟行（第 0 行）时，p1 在第 0 行的线段为"未提交段"，
    // 灰色虚线单独成 path（原版 numUncommitted + drawPath 拆分移植）。
    const gitGraphPaths = (graph, expandAt = -1, hasUncommitted = false, expandY = GIT_GRID.expandY) => {
      const { x: gx, y: gy, offsetX, offsetY } = GIT_GRID
      const dElbow = gy * 0.38
      const paths = []
      for (const branch of graph.branches) {
        const lines = []
        for (const line of branch.lines) {
          const uncommitted = hasUncommitted && line.p1.y === 0
          let x1 = line.p1.x * gx + offsetX
          let y1 = line.p1.y * gy + offsetY
          let x2 = line.p2.x * gx + offsetX
          let y2 = line.p2.y * gy + offsetY
          // 未提交段虚线从空心圆下缘起线（圆心 y + 圆半径 5），不从圆心穿出
          if (uncommitted) y1 += 5
          if (expandAt > -1) {
            if (line.p1.y > expandAt) {
              // 整条线在展开区之下：整体下移
              y1 += expandY
              y2 += expandY
            } else if (line.p2.y > expandAt) {
              // 线穿过展开区（p1 行 <= expandAt < p2 行）
              if (x1 === x2) {
                // 垂直：终点拉长过展开区
                y2 += expandY
              } else if (line.lockedFirst) {
                // 折角留在原位（展开区上沿），下方补竖线穿过展开区
                lines.push({ p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, lockedFirst: true, uncommitted })
                lines.push({ p1: { x: x2, y: y1 + gy }, p2: { x: x2, y: y2 + expandY }, lockedFirst: true, uncommitted })
                continue
              } else {
                // 展开区上方补竖线，折角移到展开区下沿
                lines.push({ p1: { x: x1, y: y1 }, p2: { x: x1, y: y2 - gy + expandY }, lockedFirst: false, uncommitted })
                y1 += expandY
                y2 += expandY
              }
            }
          }
          lines.push({ p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, lockedFirst: line.lockedFirst, uncommitted })
        }
        let i = 0
        while (i < lines.length - 1) {
          const a = lines[i]
          const b = lines[i + 1]
          // 共线合并：不跨 committed/uncommitted 边界
          if (a.uncommitted === b.uncommitted && a.p1.x === a.p2.x && a.p2.x === b.p1.x && b.p1.x === b.p2.x && a.p2.y === b.p1.y) {
            a.p2 = b.p2
            lines.splice(i + 1, 1)
          } else {
            i++
          }
        }
        // 按 committed/uncommitted 分段拆分 path（原版 drawPath 拆分移植）
        let d = ''
        let prev = null
        let segUncommitted = null
        const flush = () => {
          if (d === '') return
          paths.push({ d, colour: GIT_COLORS[branch.colour % GIT_COLORS.length], dashed: segUncommitted })
          d = ''
        }
        for (const line of lines) {
          const { p1, p2 } = line
          if (line.uncommitted !== segUncommitted) {
            flush()
            segUncommitted = line.uncommitted
          }
          if (d === '' || prev === null || p1.x !== prev.x || p1.y !== prev.y) d += `M${p1.x.toFixed(0)},${p1.y.toFixed(1)}`
          if (p1.x === p2.x) {
            d += `L${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
          } else if (line.lockedFirst) {
            d += `L${p2.x.toFixed(0)},${(p2.y - dElbow).toFixed(1)}L${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
          } else {
            d += `L${p1.x.toFixed(0)},${(p1.y + dElbow).toFixed(1)}L${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
          }
          prev = p2
        }
        flush()
      }
      return paths
    }

    const SVG_NS = 'http://www.w3.org/2000/svg'
    // 面板角上悬浮开关图标：git-branch（iconfont 1024 网格）。fill=currentColor 跟随
    // 按钮文字色；SVG + viewBox 结构，尺寸（width/height）可任意缩放。
    const GIT_BRANCH_ICON_D = 'M234.688 832a64 64 0 1 1 0-128 64 64 0 0 1 0 128z m-149.376-64a149.312 149.312 0 1 0 199.104-140.8c13.184-30.144 43.264-51.2 78.272-51.2h298.624A170.688 170.688 0 0 0 832 405.312v-6.144a149.376 149.376 0 1 0-85.312 0v6.144c0 47.168-38.208 85.376-85.376 85.376H362.688c-31.104 0-60.224 8.32-85.376 22.784V399.168a149.376 149.376 0 1 0-85.312 0v225.664A149.376 149.376 0 0 0 85.312 768z m704-448a64 64 0 1 1 0-128 64 64 0 0 1 0 128zM234.688 320a64 64 0 1 1 0-128 64 64 0 0 1 0 128z'
    const gitToggle = document.createElement('button')
    gitToggle.type = 'button'
    gitToggle.setAttribute('data-dsc-toggle', '')
    const gitToggleIcon = document.createElementNS(SVG_NS, 'svg')
    gitToggleIcon.setAttribute('viewBox', '0 0 1024 1024')
    gitToggleIcon.setAttribute('width', '16')
    gitToggleIcon.setAttribute('height', '16')
    gitToggleIcon.setAttribute('fill', 'currentColor')
    gitToggleIcon.setAttribute('aria-hidden', 'true')
    const gitToggleIconPath = document.createElementNS(SVG_NS, 'path')
    gitToggleIconPath.setAttribute('d', GIT_BRANCH_ICON_D)
    gitToggleIcon.appendChild(gitToggleIconPath)
    gitToggle.appendChild(gitToggleIcon)
    gitToggle.title = t('gitStatus')
    body.appendChild(gitToggle)

    const gitPanel = document.createElement('div')
    gitPanel.setAttribute('data-dsc-git', '')
    body.appendChild(gitPanel)
    const gitHead = document.createElement('div')
    gitHead.setAttribute('data-dsc-git-head', '')
    const gitTitle = document.createElement('span')
    gitTitle.textContent = t('gitStatus')
    // 范围切换：自绘下拉（原生 select 的弹出面板是浏览器级 UI，CSS 无法定制；
    // 改为按钮 + 复用右键菜单组件，样式完全统一）
    let gitScopeValue = 'all'
    const gitScopeBtn = document.createElement('button')
    gitScopeBtn.type = 'button'
    gitScopeBtn.setAttribute('data-dsc-btn', '')
    gitScopeBtn.style.marginLeft = 'auto' // 按钮组靠右（原 select 的 margin-left: auto 语义）
    gitScopeBtn.textContent = `${t('gitAll')} ▾`
    gitScopeBtn.addEventListener('click', (ev) => {
      const rect = gitScopeBtn.getBoundingClientRect()
      gitCtxOpen(rect.left, rect.bottom + 4, [
        { label: t('gitAll'), checked: gitScopeValue === 'all', onClick: () => { if (gitScopeValue !== 'all') { gitScopeValue = 'all'; gitScopeBtn.textContent = `${t('gitAll')} ▾`; gitFetch(false) } } },
        { label: t('gitHead'), checked: gitScopeValue === 'head', onClick: () => { if (gitScopeValue !== 'head') { gitScopeValue = 'head'; gitScopeBtn.textContent = `${t('gitHead')} ▾`; gitFetch(false) } } },
      ])
      ev.stopPropagation()
    })
    const gitRefresh = document.createElement('button')
    gitRefresh.type = 'button'
    gitRefresh.setAttribute('data-dsc-btn', '')
    gitRefresh.textContent = '↻'
    const gitClose = document.createElement('button')
    gitClose.type = 'button'
    gitClose.setAttribute('data-dsc-btn', '')
    gitClose.textContent = t('close')
    // 状态徽标（2.3）：未解决冲突数 + 进行中操作（merge/rebase/…）
    const gitStateBadge = document.createElement('div')
    gitStateBadge.setAttribute('data-dsc-git-state', '')
    gitHead.appendChild(gitTitle)
    gitHead.appendChild(gitStateBadge)
    gitHead.appendChild(gitScopeBtn)
    gitHead.appendChild(gitRefresh)
    gitHead.appendChild(gitClose)
    // 拉取远程按钮（上游 Git Graph 工具栏 Fetch from Remote(s) 移植）：有 remote
    // 才显示（gitFetch 加载后按响应 remotes 显隐，初始隐藏）；点击直接 fetch --all
    // （上游工具栏形态，无对话框），prune 默认关（同上游 fetchAndPrune 默认）；
    // 完成后显式刷新图（SSE 状态键不含 refs/remotes，fetch 只更新远程跟踪 ref）。
    const gitFetchBtn = document.createElement('button')
    gitFetchBtn.type = 'button'
    gitFetchBtn.setAttribute('data-dsc-btn', '')
    gitFetchBtn.textContent = '⇣'
    gitFetchBtn.title = t('gitFetch')
    gitFetchBtn.style.display = 'none'
    gitFetchBtn.addEventListener('click', async () => {
      gitFetchBtn.disabled = true
      gitFetchBtn.title = t('gitFetching')
      try {
        await gitPost('/git/fetch', { remote: '', prune: false })
        flash(t('gitFetchOk'))
      } catch (err) {
        flash(gitErrText(err), 'error')
      } finally {
        gitFetchBtn.disabled = false
        gitFetchBtn.title = t('gitFetch')
      }
      // 无论成败都刷新图：--all 多远程可能部分成功（git 会继续尝试其余远程），
      // 已更新的跟踪 ref 要立即上屏；单远程失败时刷新也无害。
      gitFetch(true, true)
    })
    // 插到刷新按钮之前：头部顺序 标题 / 状态徽标 / 范围▾ / ⇣拉取 / ↻ / ＋新分支 / 关闭
    gitHead.insertBefore(gitFetchBtn, gitRefresh)
    const gitBody = document.createElement('div')
    gitBody.setAttribute('data-dsc-git-body', '')
    // 合并进行中条（2.4）：中止 / 继续
    const gitMergeBar = document.createElement('div')
    gitMergeBar.setAttribute('data-dsc-git-mergebar', '')
    gitMergeBar.style.display = 'none'
    const gitMergeBarText = document.createElement('span')
    const gitMergeAbort = document.createElement('button')
    gitMergeAbort.type = 'button'
    gitMergeAbort.setAttribute('data-dsc-btn', '')
    gitMergeAbort.textContent = t('gitMergeAbort')
    const gitMergeContinue = document.createElement('button')
    gitMergeContinue.type = 'button'
    gitMergeContinue.setAttribute('data-dsc-btn', '')
    gitMergeContinue.textContent = t('gitMergeContinue')
    gitMergeBar.appendChild(gitMergeBarText)
    gitMergeBar.appendChild(gitMergeAbort)
    gitMergeBar.appendChild(gitMergeContinue)
    gitBody.appendChild(gitMergeBar)
    const gitRowsWrap = document.createElement('div')
    gitRowsWrap.setAttribute('data-dsc-git-rows', '')
    const gitSvg = document.createElementNS(SVG_NS, 'svg')
    gitSvg.setAttribute('data-dsc-git-svg', '')
    const gitNote = document.createElement('div')
    gitNote.setAttribute('data-dsc-git-note', '')
    gitRowsWrap.appendChild(gitSvg)
    gitRowsWrap.appendChild(gitNote)
    gitBody.appendChild(gitRowsWrap)
    gitPanel.appendChild(gitHead)
    gitPanel.appendChild(gitBody)

    // 浮窗拖拽（位置记忆到 localStorage）。
    const savedGitPos = (() => {
      try { return JSON.parse(localStorage.getItem('dsc-git-pos') ?? 'null') } catch { return null }
    })()
    if (savedGitPos !== null && typeof savedGitPos.x === 'number') {
      gitPanel.style.left = `${savedGitPos.x}px`
      gitPanel.style.top = `${savedGitPos.y}px`
      gitPanel.style.right = 'auto'
    }
    // 面板当前位置（拖拽后为具体坐标；null = 默认 right:12px/top:96px，随视口宽变化）。
    let gitPanelPos = savedGitPos !== null && typeof savedGitPos.x === 'number' ? { x: savedGitPos.x, y: savedGitPos.y } : null
    // 面板角上悬浮开关同步：面板右上角点 = 按钮右下角点（按钮整体悬在面板
    // 右上角外侧正上方贴角），角点严格重合、关联固定；仅当面板被拖到贴顶/
    // 贴右缘等极端位置时才钳制回视口内。面板隐藏时按钮仍按记忆位置悬浮，
    // 作为重新展开的入口。
    const syncGitToggle = () => {
      const pLeft = gitPanelPos === null ? window.innerWidth - 380 - 12 : gitPanelPos.x
      const pTop = gitPanelPos === null ? 96 : gitPanelPos.y
      const T = 30 // 按钮尺寸（与 CSS [data-dsc-toggle] width/height 一致）
      const left = Math.min(Math.max(8, pLeft + 380 - T), window.innerWidth - T - 8)
      const top = Math.min(Math.max(8, pTop - T), window.innerHeight - T - 8)
      gitToggle.style.left = `${left}px`
      gitToggle.style.top = `${top}px`
    }
    let gitDrag = null
    gitHead.addEventListener('pointerdown', (ev) => {
      if (ev.target instanceof HTMLElement && ev.target.closest('select, [data-dsc-btn]') !== null) return
      gitDrag = { dx: ev.clientX - gitPanel.offsetLeft, dy: ev.clientY - gitPanel.offsetTop }
      gitHead.setPointerCapture?.(ev.pointerId)
      ev.preventDefault()
    })
    gitHead.addEventListener('pointermove', (ev) => {
      if (gitDrag === null) return
      const x = Math.min(Math.max(8, ev.clientX - gitDrag.dx), window.innerWidth - 60)
      const y = Math.min(Math.max(8, ev.clientY - gitDrag.dy), window.innerHeight - 60)
      gitPanelPos = { x, y }
      gitPanel.style.left = `${x}px`
      gitPanel.style.top = `${y}px`
      gitPanel.style.right = 'auto'
      syncGitToggle()
    })
    const gitDragEnd = () => {
      if (gitDrag !== null) {
        try { localStorage.setItem('dsc-git-pos', JSON.stringify({ x: gitPanel.offsetLeft, y: gitPanel.offsetTop })) } catch { /* ignore */ }
      }
      gitDrag = null
    }
    gitHead.addEventListener('pointerup', gitDragEnd)
    gitHead.addEventListener('pointercancel', gitDragEnd)
    // 视口变化（不同分辨率/窗口缩放）时重新钳制按钮位置。
    const onResize = () => syncGitToggle()
    window.addEventListener('resize', onResize)
    syncGitToggle()

    let gitOpen = false
    let gitSelected = null
    const gitShowCache = new Map()

    const renderGitNote = (text) => {
      gitNote.textContent = text
      gitNote.style.display = text === '' ? 'none' : 'block'
    }

    // 行内详情：把 commit 详情（标题/作者/正文/变更文件/diff）渲染进传入的盒子。
    // 数据按 hash 缓存，刷新重渲染时秒开。v2：虚拟行（UNCOMMITTED）/ stash 走特化 URL：
    // - UNCOMMITTED：分组 diff（服务端 gitShowUncommitted：更改/暂存的更改），无作者行/复制按钮
    // - stash：&base=<baseHash> 显式 diff base..stash（多父 commit 的 diff-tree/show 无输出），
    //   第三父 untracked 快照经 &stashUntracked= 追加
    const showGitDetail = async (commit, box) => {
      const hash = commit.hash
      const isUncommitted = hash === 'UNCOMMITTED'
      box.replaceChildren()
      const dTitle = document.createElement('div')
      dTitle.setAttribute('data-dsc-git-dtitle', '')
      const dSub = document.createElement('div')
      dSub.setAttribute('data-dsc-git-dsub', '')
      const dBody = document.createElement('div')
      dBody.setAttribute('data-dsc-git-dbody', '')
      const dFiles = document.createElement('div')
      dFiles.setAttribute('data-dsc-git-dfiles', '')
      box.appendChild(dTitle)
      box.appendChild(dSub)
      box.appendChild(dBody)
      box.appendChild(dFiles)
      const loading = document.createElement('span')
      loading.textContent = t('gitLoading')
      dTitle.appendChild(loading)
      try {
        let data = gitShowCache.get(hash)
        if (data === undefined) {
          let url = `${BASE}/git/show?rev=${encodeURIComponent(hash)}${sessionQuery()}`
          if (commit.stash !== null) {
            url += `&base=${encodeURIComponent(commit.stash.baseHash)}`
            if (commit.stash.untrackedFilesHash !== null) url += `&stashUntracked=${encodeURIComponent(commit.stash.untrackedFilesHash)}`
          }
          const r = await fetch(url)
          data = await r.json()
          if (data.error !== undefined) throw new Error(data.error)
          gitShowCache.set(hash, data)
        }
        dTitle.replaceChildren()
        if (!isUncommitted) {
          const hashTag = document.createElement('span')
          hashTag.textContent = data.meta.hashShort
          const copyBtn = document.createElement('button')
          copyBtn.type = 'button'
          copyBtn.setAttribute('data-dsc-btn', '')
          copyBtn.textContent = '⧉'
          copyBtn.title = t('gitCopyHash')
          copyBtn.addEventListener('click', () => {
            navigator.clipboard?.writeText(data.meta.hash).then(() => flash(t('copied')), () => flash(t('copyFailed'), 'error'))
          })
          dTitle.appendChild(hashTag)
          dTitle.appendChild(copyBtn)
        }
        const subject = document.createElement('span')
        subject.textContent = isUncommitted
          ? t('gitUncommitted', { unstaged: commit.uncommitted.unstaged, staged: commit.uncommitted.staged })
          : data.meta.subject
        subject.style.flex = '1'
        subject.style.overflow = 'hidden'
        subject.style.textOverflow = 'ellipsis'
        subject.style.whiteSpace = 'nowrap'
        dTitle.appendChild(subject)
        if (!isUncommitted) {
          dSub.textContent = `${data.meta.author} <${data.meta.email}> · ${new Date(data.meta.date * 1000).toLocaleString()}`
          if (data.body !== '' && data.body !== data.meta.subject) dBody.textContent = data.body
        }
        // 变更文件（分组渲染）：普通 commit 单组「变更文件」；未提交改动按
        // VS Code 语义分「更改 / 暂存的更改」两组——空组隐藏，部分暂存文件
        // （MM/AM）两组各出现一次，未跟踪文件（??）带徽标且无 patch。
        const gitDetailFiles = (group, label, hideEmpty) => {
          if (hideEmpty && group.files.length === 0) return
          const head = document.createElement('div')
          head.style.opacity = '.6'
          head.style.marginBottom = '2px'
          head.textContent = label
          dFiles.appendChild(head)
          const sections = group.patch.split(/^diff --git /m).filter((s) => s.trim() !== '')
          if (!hideEmpty && group.files.length === 0) {
            const empty = document.createElement('div')
            empty.style.opacity = '.55'
            empty.textContent = t('gitNoFiles')
            dFiles.appendChild(empty)
          }
          const patchPre = document.createElement('pre')
          patchPre.setAttribute('data-dsc-git-dpatch', '')
          dFiles.appendChild(patchPre)
          group.files.forEach((f, idx) => {
            const row = document.createElement('div')
            row.setAttribute('data-dsc-git-dfile', '')
            const path = document.createElement('span')
            path.setAttribute('data-dsc-git-dfile-path', '')
            path.textContent = f.path
            const num = document.createElement('span')
            num.className = 'dsc-gnum'
            if (f.adds > 0 || f.dels > 0) {
              const a = document.createElement('span')
              a.className = 'dsc-gnum-add'
              a.textContent = `+${f.adds}`
              const d = document.createElement('span')
              d.className = 'dsc-gnum-del'
              d.textContent = `-${f.dels}`
              num.appendChild(a)
              num.appendChild(document.createTextNode(' '))
              num.appendChild(d)
            } else {
              num.textContent = '±'
              num.style.opacity = '.5'
            }
            row.appendChild(path)
            row.appendChild(num)
            if (f.status === '??') {
              const badge = document.createElement('span')
              badge.className = 'dsc-gfile-untracked'
              badge.textContent = t('gitUntracked')
              row.appendChild(badge)
            }
            row.addEventListener('click', () => {
              const section = sections[idx]
              const isOn = patchPre.classList.contains('on') && patchPre.dataset.idx === String(idx)
              patchPre.classList.remove('on')
              for (const el of dFiles.querySelectorAll('[data-dsc-git-dfile].sel')) el.classList.remove('sel')
              if (!isOn && section !== undefined) {
                patchPre.dataset.idx = String(idx)
                patchPre.textContent = 'diff --git ' + section + (group.truncated ? `\n${t('gitTruncated')}` : '')
                patchPre.classList.add('on')
                row.classList.add('sel')
              }
            })
            dFiles.appendChild(row)
          })
          if (group.truncated && sections.length === 0) {
            const note = document.createElement('div')
            note.style.opacity = '.55'
            note.textContent = t('gitTruncated')
            dFiles.appendChild(note)
          }
        }
        if (isUncommitted) {
          // 未暂存组在前（VS Code「更改」），暂存组在后（VS Code「暂存的更改」）
          gitDetailFiles(data.unstaged, t('gitChanges'), true)
          gitDetailFiles(data.staged, t('gitStagedChanges'), true)
        } else {
          gitDetailFiles({ files: data.files, patch: data.patch, truncated: data.truncated }, t('gitFiles'), false)
        }
      } catch {
        dTitle.replaceChildren()
        const err = document.createElement('span')
        err.textContent = t('gitError')
        dTitle.appendChild(err)
      }
      // 内容渲染完成（成功或失败）：切 auto 按实际高度收缩（≤ 上限），
      // 图/线/盒子高度跟随（gitExpandY），不等则重绘一次；相等即停（终止条件）。
      // 注意：点击文件行展开 patch 不走这里，盒子保持当前高度内部滚动，图不跳动。
      // box 可能已被后续重绘/收起移出 DOM（快速切换行）：isConnected 时才能测量，
      // 否则 offsetHeight = 0 会把 gitExpandY 打崩。归属校验（dataset.hash ===
      // gitSelected）保证测量重绘只作用于当前选中行，杜绝陈旧盒子的竞态。
      if (box.isConnected && box.dataset.hash === gitSelected) {
        box.style.height = 'auto'
        const measured = box.offsetHeight
        if (measured !== gitExpandY) {
          gitExpandY = measured
          renderGitGraph()
        }
      }
    }

    // 渲染防重入：showGitDetail 的缓存命中路径会同步执行测量并触发 renderGitGraph，
    // 若此时外层 renderGitGraph 的 forEach 尚未跑完，内层渲染会清空重建一遍，外层
    // 随后又把剩余行追加一遍 —— 造成"选中行之下的行在列表末尾重复"（本 bug 根因）。
    // 重入时置 dirty 标记，外层渲染结束后补一次完整渲染（此时测量已更新 gitExpandY，
    // 补渲染一次收敛，不会无限循环）。
    let gitRendering = false
    let gitRenderDirty = false
    const renderGitGraph = () => {
      if (gitRendering) {
        gitRenderDirty = true
        return
      }
      gitRendering = true
      try {
        gitRowsWrap.querySelectorAll('[data-dsc-git-row], [data-dsc-git-inline], [data-dsc-git-more]').forEach((el) => el.remove())
        gitSvg.replaceChildren()
      if (gitRows.length === 0) {
        gitSelected = null
        renderGitNote(t('gitNoCommits'))
        gitSvg.setAttribute('width', '0')
        gitSvg.setAttribute('height', '0')
        return
      }
      // 展开索引：选中 commit 所在行；已不在列表（刷新后消失）则收起。
      let expandAt = -1
      if (gitSelected !== null) {
        expandAt = gitRows.findIndex((c) => c.hash === gitSelected)
        if (expandAt === -1) gitSelected = null
      }
      renderGitNote('')
      // 收起/无展开时把动态高度重置回上限（下次展开重新测量）
      if (expandAt === -1 && gitExpandY !== GIT_GRID.expandY) gitExpandY = GIT_GRID.expandY
      const graph = buildGitGraph(gitRows)
      const hasUncommitted = gitRows[0]?.hash === 'UNCOMMITTED'
      const clipW = Math.min(graph.width, GIT_ROW_PAD)
      const expandY = expandAt > -1 ? gitExpandY : 0
      gitSvg.setAttribute('width', String(graph.width))
      gitSvg.setAttribute('height', String(graph.height + expandY))
      gitSvg.style.width = `${clipW}px`
      // 分支线：shadow + 彩色双 path（原版画法；展开时线穿过详情区拉伸；
      // v2：未提交段灰色虚线单独 path）
      for (const path of gitGraphPaths(graph, expandAt, hasUncommitted, expandY)) {
        for (const cls of ['dsc-gline-shadow', 'dsc-gline']) {
          const p = document.createElementNS(SVG_NS, 'path')
          p.setAttribute('d', path.d)
          p.setAttribute('class', path.dashed && cls === 'dsc-gline' ? `${cls} dsc-gline-dash` : cls)
          if (cls === 'dsc-gline') p.setAttribute('stroke', path.dashed ? '#808080' : path.colour)
          gitSvg.appendChild(p)
        }
      }
      // 顶点圆点（颜色 = 所在泳道颜色；HEAD 提交加粗描边；v2：未提交行空心圆、
      // stash 双层圆；展开行下方整体下移）
      const headIndex = gitRows.findIndex((c) => c.refs.isHead)
      // 当前 checkout 分支名（HEAD -> X；游离 HEAD 为 null）→ 本地徽标文字加粗
      const currentBranch = headIndex > -1 ? gitRows[headIndex].refs.headName ?? null : null
      graph.vertices.forEach((v, idx) => {
        const commit = gitRows[v.id]
        const isUncommitted = commit.hash === 'UNCOMMITTED'
        const isStash = commit.stash !== null
        const cx = v.x * GIT_GRID.x + GIT_GRID.offsetX
        const cy = v.id * GIT_GRID.y + GIT_GRID.offsetY + (expandAt > -1 && v.id > expandAt ? expandY : 0)
        const colour = v.onBranch !== null ? GIT_COLORS[v.onBranch.colour % GIT_COLORS.length] : '#8e8e93'
        if (isUncommitted) {
          // 空心圆（灰色，未提交）
          const dot = document.createElementNS(SVG_NS, 'circle')
          dot.setAttribute('cx', String(cx))
          dot.setAttribute('cy', String(cy))
          dot.setAttribute('r', '5')
          dot.setAttribute('fill', 'none')
          dot.setAttribute('stroke', '#808080')
          dot.setAttribute('stroke-width', '2')
          gitSvg.appendChild(dot)
        } else if (isStash) {
          // 双层圆（外环 + 实心内核，同原版 stashOuter/stashInner）
          const outer = document.createElementNS(SVG_NS, 'circle')
          outer.setAttribute('cx', String(cx))
          outer.setAttribute('cy', String(cy))
          outer.setAttribute('r', '4.5')
          outer.setAttribute('fill', 'none')
          outer.setAttribute('stroke', colour)
          outer.setAttribute('stroke-width', '1.5')
          gitSvg.appendChild(outer)
          const inner = document.createElementNS(SVG_NS, 'circle')
          inner.setAttribute('cx', String(cx))
          inner.setAttribute('cy', String(cy))
          inner.setAttribute('r', '2')
          inner.setAttribute('fill', colour)
          gitSvg.appendChild(inner)
        } else {
          const dot = document.createElementNS(SVG_NS, 'circle')
          dot.setAttribute('cx', String(cx))
          dot.setAttribute('cy', String(cy))
          dot.setAttribute('r', idx === headIndex ? '5' : '4')
          dot.setAttribute('fill', idx === headIndex ? '#1c1c1e' : colour)
          dot.setAttribute('stroke', colour)
          dot.setAttribute('stroke-width', idx === headIndex ? '2' : '1.5')
          gitSvg.appendChild(dot)
        }
        // 行
        const row = document.createElement('div')
        row.setAttribute('data-dsc-git-row', '')
        row.dataset.hash = commit.hash
        row.style.height = `${GIT_GRID.y}px`
        row.style.paddingLeft = `${clipW}px`
        if (idx === expandAt) row.classList.add('sel')
        // 同名本地/远程分支徽标合并（同上游 gitRefHeadRemote）：本地分支 pill 内
        // 内嵌远程名子标签，如 ⎇ main [gitee]；只归并同一 commit 上的同名 refs，
        // 多个远程同名 → ⎇ main [gitee][origin]；无本地分支的远程保持独立蓝 pill。
        const remotesOfHead = new Map()
        for (const r of commit.refs.remotes) {
          const slash = r.indexOf('/')
          if (slash <= 0) continue
          const branchName = r.slice(slash + 1)
          if (commit.refs.heads.includes(branchName)) {
            if (!remotesOfHead.has(branchName)) remotesOfHead.set(branchName, [])
            remotesOfHead.get(branchName).push(r.slice(0, slash))
          }
        }
        for (const r of commit.refs.heads) {
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-branch'
          const name = document.createElement('span')
          name.textContent = r
          // 当前 checkout 分支：pill 级高亮（亮金背景 + 描边 + 加粗，见样式区），
          // 悬停 title 提示（同上游 gitRef.active 语义，仅本地分支 pill）
          if (r === currentBranch) {
            b.classList.add('dsc-gref-current')
            b.title = t('gitCurrentBranch')
          }
          b.appendChild(name)
          const remotes = remotesOfHead.get(r)
          if (remotes !== undefined) {
            for (const remote of remotes) {
              const sub = document.createElement('span')
              sub.className = 'dsc-gref-remote-sub'
              sub.textContent = remote
              b.appendChild(sub)
            }
          }
          row.appendChild(b)
        }
        for (const r of commit.refs.remotes) {
          const slash = r.indexOf('/')
          if (slash > 0 && commit.refs.heads.includes(r.slice(slash + 1))) continue
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-remote'
          b.textContent = r
          row.appendChild(b)
        }
        for (const r of commit.refs.tags) {
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-tag'
          b.textContent = r
          row.appendChild(b)
        }
        if (commit.stash !== null) {
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-stash'
          b.textContent = commit.stash.selector.replace(/^refs\//, '')
          b.dataset.selector = commit.stash.selector
          b.title = t('gitStash')
          row.appendChild(b)
        }
        if (commit.refs.isHead) {
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-head'
          b.textContent = 'HEAD'
          b.title = t('gitDetached')
          row.appendChild(b)
        }
        const subject = document.createElement('span')
        subject.setAttribute('data-dsc-git-subject', '')
        subject.textContent = isUncommitted
          ? t('gitUncommitted', { unstaged: commit.uncommitted.unstaged, staged: commit.uncommitted.staged })
          : commit.subject
        subject.title = subject.textContent
        row.appendChild(subject)
        if (!isUncommitted) {
          const meta = document.createElement('span')
          meta.setAttribute('data-dsc-git-meta', '')
          meta.textContent = `${commit.author} · ${fmtRelDate(commit.date)}`
          row.appendChild(meta)
        }
        if (!isUncommitted) {
          const copyBtn = document.createElement('button')
          copyBtn.type = 'button'
          copyBtn.setAttribute('data-dsc-git-copy', '')
          copyBtn.textContent = '⧉'
          copyBtn.title = t('gitCopyHash')
          copyBtn.addEventListener('click', (ev) => {
            ev.stopPropagation()
            navigator.clipboard?.writeText(commit.hash).then(() => flash(t('copied')), () => flash(t('copyFailed'), 'error'))
          })
          row.appendChild(copyBtn)
        }
        row.addEventListener('click', () => {
          // 行已在后续渲染中被替换（面板重建）时，忽略陈旧行上的点击，
          // 防止用陈旧 commit 改写 gitSelected 导致选中态/展开盒错位。
          if (!row.isConnected) return
          gitSelected = gitSelected === commit.hash ? null : commit.hash
          renderGitGraph()
        })
        gitRowsWrap.appendChild(row)
        // 行内展开：详情盒插在该行下方（高度 = gitExpandY，图列留白让分支线可见；
        // maxHeight 用 JS 与 GIT_GRID.expandY 保持单一真源；内容渲染后 showGitDetail
        // 会切 auto 重新测量收缩）
        if (idx === expandAt) {
          const box = document.createElement('div')
          box.setAttribute('data-dsc-git-inline', '')
          box.dataset.hash = commit.hash // 标记归属行：测量重绘前校验仍为当前选中行
          box.style.marginLeft = `${clipW}px`
          box.style.maxHeight = `${GIT_GRID.expandY}px`
          box.style.height = `${expandY}px`
          gitRowsWrap.appendChild(box)
          showGitDetail(commit, box)
        }
      })
      if (gitMoreAvailable) {
        const more = document.createElement('div')
        more.setAttribute('data-dsc-git-more', '')
        more.style.padding = '6px 12px'
        more.style.opacity = '.55'
        more.style.fontSize = '11px'
        more.textContent = t('gitMore', { n: gitRows.length })
        gitRowsWrap.appendChild(more)
      }
      } finally {
        gitRendering = false
        if (gitRenderDirty) {
          gitRenderDirty = false
          renderGitGraph()
        }
      }
    }

    let gitRows = []
    let gitMoreAvailable = false
    // 远程名列表（/git/log 响应 remotes）：有 remote 才显示「⇣ 拉取远程」按钮。
    let gitRemotes = []
    // 静默刷新去抖：上次 /git/log 响应的签名。内容未变时跳过重渲染，避免 10s 轮询 /
    // SSE 反复整体重建行 DOM —— 重建会替换行元素，扩大用户点击与渲染竞争的陈旧行窗口。
    let gitLastSig = null
    // 响应签名：覆盖所有影响 UI 的字段（commit 集合 / stash 位置 / 未提交计数 /
    // HEAD 与分支名 / 每行 refs 装饰（分支/远程/tag，排序拼接防顺序抖动）/
    // 冲突数 / 进行中操作 / 远程列表）。任一变化都触发重渲染。
    const gitSigOf = (data) => {
      let s = `${data.moreAvailable}|${data.conflicts ?? 0}|${data.operation ?? ''}|${(data.remotes ?? []).join(',')}`
      for (const c of data.commits ?? []) {
        const refsKey = [...c.refs.heads, ...c.refs.remotes, ...c.refs.tags].sort().join(',')
        s += `|${c.hash}${c.stash !== null ? '@' + c.stash.selector : ''}${c.uncommitted !== undefined ? '#u' + c.uncommitted.staged + '/' + c.uncommitted.unstaged : ''}${c.refs.isHead ? '^' + (c.refs.headName ?? '') : ''}r:${refsKey}`
      }
      return s
    }
    // 仓库状态（2.3）：未解决冲突数 + 进行中操作标记（服务端 /git/log 响应）。
    let gitState = { conflicts: 0, operation: null }
    const OPERATION_LABELS = {
      MERGE_HEAD: 'Merge',
      CHERRY_PICK_HEAD: 'CherryPick',
      REVERT_HEAD: 'Revert',
      BISECT_LOG: 'Bisect',
      'rebase-merge': 'Rebase',
      'rebase-apply': 'Rebase',
      sequencer: 'Sequencer',
    }
    const renderGitState = () => {
      gitStateBadge.replaceChildren()
      if (gitState.conflicts > 0) {
        const el = document.createElement('span')
        el.className = 'dsc-git-state-item dsc-git-state-warn'
        el.textContent = t('gitConflicts', { n: gitState.conflicts })
        gitStateBadge.appendChild(el)
      }
      if (gitState.operation !== null) {
        const label = OPERATION_LABELS[gitState.operation] ?? gitState.operation
        const el = document.createElement('span')
        el.className = 'dsc-git-state-item dsc-git-state-op'
        el.textContent = t(`gitOp${label}`)
        gitStateBadge.appendChild(el)
      }
      const isMerge = gitState.operation === 'MERGE_HEAD'
      gitMergeBar.style.display = isMerge ? 'flex' : 'none'
      if (isMerge) gitMergeBarText.textContent = t('gitOpMerge')
    }
    gitMergeAbort.addEventListener('click', async () => {
      try {
        await gitBranchAction({ action: 'merge-abort' })
        flash(t('gitMergeAborted'))
        gitFetch(true, true)
      } catch (err) {
        flash(gitErrText(err), 'error')
      }
    })
    gitMergeContinue.addEventListener('click', async () => {
      try {
        await gitBranchAction({ action: 'merge-continue' })
        flash(t('gitMergeContinued'))
        gitFetch(true, true)
      } catch (err) {
        flash(gitErrText(err), 'error')
      }
    })
    const gitFetch = async (silent, force) => {
      if (!silent) renderGitNote(t('gitLoading'))
      try {
        const r = await fetch(`${BASE}/git/log?n=500&scope=${gitScopeValue}${sessionQuery()}`)
        const data = await r.json()
        if (data.error !== undefined) throw new Error(data.error)
        if (data.isRepo === false) {
          gitRows = []
          gitMoreAvailable = false
          gitRemotes = []
          gitFetchBtn.style.display = 'none'
          gitState = { conflicts: 0, operation: null }
          gitLastSig = 'no-repo'
          renderGitGraph()
          renderGitState()
          renderGitNote(t('gitNotRepo'))
          return
        }
        // 静默刷新（10s 轮询 / SSE）且响应签名未变：列表与状态均无变化，跳过重建。
        // force（本地写操作成功后）：结果确定变化，跳过签名比较直接重渲染；
        // 手动刷新（↻）与切换范围仍强制重渲染。
        const sig = gitSigOf(data)
        if (silent && !force && sig === gitLastSig) return
        gitLastSig = sig
        gitRows = data.commits
        gitMoreAvailable = data.moreAvailable
        gitRemotes = Array.isArray(data.remotes) ? data.remotes : []
        gitFetchBtn.style.display = gitRemotes.length > 0 ? '' : 'none'
        gitState = {
          conflicts: typeof data.conflicts === 'number' ? data.conflicts : 0,
          operation: typeof data.operation === 'string' ? data.operation : null,
        }
        renderGitGraph()
        renderGitState()
      } catch {
        if (!silent) renderGitNote(t('gitError'))
      }
    }

    // ---------- 分支操作（v0.4.0，守卫模型移植自社区 dsh-git-graph） ----------
    // check-ref-format 短分支名规则的客户端镜像（即时反馈；服务端仍权威校验）。
    const validateBranchName = (name) => {
      if (name === '') return 'empty'
      if (name === '@') return 'at-sign'
      if (name.startsWith('-')) return 'leading-dash'
      if (name.endsWith('.')) return 'trailing-dot'
      if (name.endsWith('.lock')) return 'lock-suffix'
      if (name.includes('..')) return 'double-dot'
      if (name.includes('@{')) return 'at-brace'
      if (name.includes('//')) return 'double-slash'
      if (name.includes(' ')) return 'space'
      if (name.includes('~') || name.includes('^') || name.includes(':') || name.includes('?') || name.includes('*') || name.includes('[') || name.includes('\\')) return 'forbidden-char'
      for (const ch of name) {
        const code = ch.codePointAt(0)
        if (code !== undefined && (code < 0x20 || code === 0x7f)) return 'control-char'
      }
      for (const component of name.split('/')) {
        if (component === '') return 'empty-component'
        if (component.startsWith('.')) return 'dot-component'
        if (component.endsWith('.lock')) return 'lock-suffix'
      }
      if (name.length > 1000) return 'too-long'
      return null
    }

    /** 稳定错误码 → 本地化文案（含被挡文件路径详情）。 */
    const gitErrText = (err) => {
      if (err === undefined || err === null) return t('gitErr')
      const key = 'gitErr' + String(err.code ?? 'internal').replace(/(^|-)([a-z])/g, (_, p, c) => c.toUpperCase())
      const base = t(key)
      const detail = Array.isArray(err.paths) && err.paths.length > 0 ? err.paths.join(', ') : (err.message ?? '')
      return base === key ? (detail || base) : detail ? `${base}：${detail}` : base
    }

    /** 分支操作 POST（写路由）；resolve { ok, branch }，reject { code, message, paths? }。 */
    const gitBranchAction = (payload) => gitPost('/git/branch', payload)

    /** 写路由 POST（/git/branch、/git/fetch 共用）；resolve { ok, ... }，reject { code, message, paths? }。 */
    const gitPost = async (path, payload) => {
      const r = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, session: currentSessionId() }),
      })
      const data = await r.json().catch(() => null)
      if (data === null) throw { code: 'internal', message: t('gitErr') }
      if (data.ok === true) return data
      throw data.error ?? { code: 'internal', message: t('gitErr') }
    }

    // ---------- SSE 订阅（2.1）：/git/events，仓库状态变化即时刷新 ----------
    // EventSource 自带断线重连；10s 轮询保留作兜底。
    let gitEvents = null
    let gitEventsSession = ''
    const gitEventsOpen = () => {
      if (gitEvents !== null) return
      const session = currentSessionId()
      gitEventsSession = session
      try {
        gitEvents = new EventSource(`${BASE}/git/events?session=${encodeURIComponent(session)}`)
      } catch {
        gitEvents = null
        return
      }
      gitEvents.addEventListener('change', () => { gitFetch(true) })
    }
    const gitEventsClose = () => {
      if (gitEvents === null) return
      gitEvents.close()
      gitEvents = null
      gitEventsSession = ''
    }

    // 右键菜单浮层（本地分支：切换；远程：创建本地分支并检出）。
    const gitCtxMenu = document.createElement('div')
    gitCtxMenu.setAttribute('data-dsc-git-ctx', '')
    body.appendChild(gitCtxMenu)
    const gitCtxClose = () => { gitCtxMenu.style.display = 'none'; gitCtxMenu.replaceChildren() }
    const gitCtxOpen = (x, y, items) => {
      gitCtxMenu.replaceChildren()
      for (const item of items) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = item.checked === true ? `✓ ${item.label}` : item.label
        btn.disabled = item.disabled === true
        // stopPropagation：菜单项可能同步弹出确认框（删除分支），若不阻断冒泡，
        // document 级「点击外部关闭」监听会把刚弹出的确认框当作外部点击立即关掉
        // （异步弹出如切换确认不受影响——点击事件早已结束）。
        if (item.disabled !== true) btn.addEventListener('click', (ev) => { ev.stopPropagation(); gitCtxClose(); item.onClick() })
        gitCtxMenu.appendChild(btn)
      }
      gitCtxMenu.style.display = 'block'
      const rect = gitCtxMenu.getBoundingClientRect()
      gitCtxMenu.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`
      gitCtxMenu.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`
    }
    document.addEventListener('click', (ev) => {
      if (!gitCtxMenu.contains(ev.target)) gitCtxClose()
    })
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') gitCtxClose()
    })

    // 切换确认框（未提交改动提醒，方案 A）：风格同右键菜单/create 框浮层卡片。
    // 收到 uncommitted-changes-present 时弹出，「仍然切换」带 force 重发（服务端
    // 旁路未提交守卫，其余守卫仍生效）；Escape / 点击外部 / 取消 关闭。
    const gitConfirmBox = document.createElement('div')
    gitConfirmBox.setAttribute('data-dsc-git-confirm', '')
    body.appendChild(gitConfirmBox)
    const gitConfirmTitle = document.createElement('div')
    gitConfirmTitle.className = 'dsc-git-confirm-title'
    const gitConfirmText = document.createElement('div')
    gitConfirmText.className = 'dsc-git-confirm-text'
    const gitConfirmActions = document.createElement('div')
    gitConfirmActions.className = 'dsc-git-confirm-actions'
    const gitConfirmOk = document.createElement('button')
    gitConfirmOk.type = 'button'
    gitConfirmOk.setAttribute('data-dsc-btn', '')
    const gitConfirmCancel = document.createElement('button')
    gitConfirmCancel.type = 'button'
    gitConfirmCancel.setAttribute('data-dsc-btn', '')
    gitConfirmActions.appendChild(gitConfirmOk)
    gitConfirmActions.appendChild(gitConfirmCancel)
    gitConfirmBox.appendChild(gitConfirmTitle)
    gitConfirmBox.appendChild(gitConfirmText)
    gitConfirmBox.appendChild(gitConfirmActions)
    let gitConfirmOnOk = null
    const gitConfirmClose = () => { gitConfirmBox.style.display = 'none'; gitConfirmOnOk = null }
    const gitConfirmOpen = (opts) => {
      gitConfirmTitle.textContent = opts.title ?? ''
      gitConfirmText.textContent = opts.text
      gitConfirmOk.textContent = opts.okText ?? t('gitSwitchAnyway')
      gitConfirmCancel.textContent = opts.cancelText ?? t('gitCancel')
      // danger：确认按钮红色实底（删除分支等不可恢复操作）
      gitConfirmOk.classList.toggle('dsc-git-confirm-ok-danger', opts.danger === true)
      gitConfirmOnOk = opts.onOk ?? null
      gitConfirmBox.style.display = 'block'
      // 定位：面板头部下方（同 create 框）；确认框在异步 POST 返回后弹出，
      // 原鼠标位置已不可靠，不复用 ctx 菜单的坐标定位。
      const headRect = gitHead.getBoundingClientRect()
      gitConfirmBox.style.left = `${Math.min(headRect.left, window.innerWidth - 260)}px`
      gitConfirmBox.style.top = `${headRect.bottom + 6}px`
      gitConfirmOk.focus()
    }
    gitConfirmOk.addEventListener('click', () => { const fn = gitConfirmOnOk; gitConfirmClose(); if (fn !== null) fn() })
    gitConfirmCancel.addEventListener('click', gitConfirmClose)
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && gitConfirmBox.style.display !== 'none') gitConfirmClose()
    })
    document.addEventListener('click', (ev) => {
      if (gitConfirmBox.style.display === 'none') return
      if (!gitConfirmBox.contains(ev.target)) gitConfirmClose()
    })

    /** 切换分支统一入口（本地/远程 checkout）：成功 flash + 刷新；
     *  uncommitted-changes-present → 弹确认框，确认后带 force 重发。 */
    const gitCheckout = async (payload) => {
      try {
        const result = await gitBranchAction({ action: 'checkout', ...payload })
        flash(t('gitSwitchOk', { branch: result.branch }))
        gitFetch(true, true)
      } catch (err) {
        if (err.code === 'uncommitted-changes-present') {
          let text = t('gitSwitchUncommitted', {
            branch: payload.branch,
            staged: err.staged ?? 0,
            unstaged: err.unstaged ?? 0,
          })
          if ((err.untracked ?? 0) > 0) {
            text += ` ${t('gitSwitchUncommittedUntracked', { untracked: err.untracked })}`
          }
          gitConfirmOpen({
            title: t('gitSwitchTo', { branch: payload.branch }),
            text,
            onOk: () => gitCheckout({ ...payload, force: true }),
          })
          return
        }
        flash(gitErrText(err), 'error')
      }
    }

    // 徽标右键（document 级委托，行重建不影响）：本地 pill → 切换/合并/重命名/删除；
    // 远程子标签/独立 pill → 创建本地分支并检出；tag → 以 tag 为起始点建分支。
    // 命中 git 面板内徽标才拦截默认菜单。
    document.addEventListener('contextmenu', (ev) => {
      if (!(ev.target instanceof HTMLElement)) return
      if (!gitCtxMenu.contains(ev.target)) gitCtxClose()
      const tag = ev.target.closest('[data-dsc-git-rows] .dsc-gref-tag')
      if (tag !== null) {
        ev.preventDefault()
        ev.stopPropagation()
        const tagName = tag.textContent.trim()
        gitCtxOpen(ev.clientX, ev.clientY, [
          {
            label: t('gitCreateFromTag', { tag: tagName }),
            onClick: () => gitCreateOpen({ start: tagName }),
          },
          // 推送 tag：二级选择（每远程一项，与删除 tag 交互一致；无远程时禁用）
          {
            label: t('gitPushTag', { tag: tagName }),
            disabled: gitRemotes.length === 0,
            onClick: () => gitCtxOpen(ev.clientX, ev.clientY, gitRemotes.map((r) => ({
              label: t('gitPushTagTo', { tag: tagName, remote: r }),
              onClick: () => gitConfirmOpen({
                title: t('gitPushTag', { tag: tagName }),
                text: t('gitPushTagTo', { tag: tagName, remote: r }),
                okText: t('gitPushBtn'),
                onOk: async () => {
                  try {
                    await gitPost('/git/remote', { action: 'push-tag', tag: tagName, remote: r })
                    flash(t('gitPushTagOk', { tag: tagName, remote: r }))
                    gitFetch(true, true)
                  } catch (err) {
                    flash(gitErrText(err))
                  }
                },
              }),
            }))),
          },
          // 删除 tag：二级选择（仅本地 / 各远程同步）→ 确认框
          {
            label: t('gitDeleteTag', { tag: tagName }),
            onClick: () => gitCtxOpen(ev.clientX, ev.clientY, [
              {
                label: t('gitDeleteTagLocalOnly', { tag: tagName }),
                onClick: () => gitConfirmOpen({
                  title: t('gitDeleteTag', { tag: tagName }),
                  text: t('gitDeleteTagConfirm', { tag: tagName }),
                  okText: t('gitDeleteBtn'),
                  danger: true,
                  onOk: async () => {
                    try {
                      await gitPost('/git/remote', { action: 'delete-tag', tag: tagName, remote: '' })
                      flash(t('gitDeleteTagOk', { tag: tagName }))
                      gitFetch(true, true)
                    } catch (err) {
                      flash(gitErrText(err))
                    }
                  },
                }),
              },
              ...gitRemotes.map((r) => ({
                label: t('gitDeleteTagWithRemote', { remote: r, tag: tagName }),
                onClick: () => gitConfirmOpen({
                  title: t('gitDeleteTag', { tag: tagName }),
                  text: t('gitDeleteTagWithRemote', { remote: r, tag: tagName }),
                  okText: t('gitDeleteBtn'),
                  danger: true,
                  onOk: async () => {
                    try {
                      await gitPost('/git/remote', { action: 'delete-tag', tag: tagName, remote: r })
                      flash(t('gitDeleteTagOk', { tag: tagName }))
                      gitFetch(true, true)
                    } catch (err) {
                      flash(gitErrText(err))
                    }
                  },
                }),
              })),
            ]),
          },
        ])
        return
      }
      const stashBadge = ev.target.closest('[data-dsc-git-rows] .dsc-gref-stash')
      if (stashBadge !== null) {
        ev.preventDefault()
        ev.stopPropagation()
        const selector = stashBadge.dataset.selector ?? ''
        const shortSel = selector.replace(/^refs\//, '')
        gitCtxOpen(ev.clientX, ev.clientY, [
          {
            label: t('gitStashApply', { selector: shortSel }),
            onClick: () => gitStashRun('apply', selector),
          },
          {
            label: t('gitStashPop', { selector: shortSel }),
            onClick: () => gitStashRun('pop', selector),
          },
          {
            label: t('gitStashBranch', { selector: shortSel }),
            onClick: () => gitCreateOpen({ mode: 'stash', selector }),
          },
          {
            label: t('gitStashDrop', { selector: shortSel }),
            onClick: () => gitConfirmOpen({
              title: t('gitStashDrop', { selector: shortSel }),
              text: t('gitStashDropConfirm', { selector: shortSel }),
              okText: t('gitDeleteBtn'),
              danger: true,
              onOk: () => gitStashRun('drop', selector),
            }),
          },
        ])
        return
      }
      const sub = ev.target.closest('[data-dsc-git-rows] .dsc-gref-remote-sub')
      const local = ev.target.closest('[data-dsc-git-rows] .dsc-gref-branch')
      const remote = ev.target.closest('[data-dsc-git-rows] .dsc-gref-remote')
      const target = sub ?? (local === null ? remote : local)
      if (target === null) {
        // 未提交改动虚拟行右键：暂存未提交改动（上游 Uncommitted Context Menu 核心项）
        const row = ev.target.closest('[data-dsc-git-rows] [data-dsc-git-row]')
        if (row !== null && row.dataset.hash === 'UNCOMMITTED') {
          ev.preventDefault()
          ev.stopPropagation()
          gitCtxOpen(ev.clientX, ev.clientY, [{
            label: t('gitStashUncommitted'),
            onClick: () => gitStashBoxOpen(),
          }])
        }
        return
      }
      ev.preventDefault()
      ev.stopPropagation()
      const currentBranch = gitRows.find((c) => c.refs.isHead)?.refs.headName ?? null
      if (sub !== null || remote !== null) {
        // 远程：全名 = 远程名/本地分支名（子标签）或完整 ref（独立 pill）
        const fullRef = sub !== null
          ? `${(local?.firstChild?.textContent ?? '').trim()}/${sub.textContent.trim()}`
          : (remote?.textContent ?? '').trim()
        const slash = fullRef.indexOf('/')
        const branchName = slash > 0 ? fullRef.slice(slash + 1) : fullRef
        gitCtxOpen(ev.clientX, ev.clientY, [
          {
            label: t('gitCreateFromRemote', { branch: branchName, remote: fullRef.slice(0, slash) }),
            onClick: () => gitCheckout({ branch: branchName, remote: fullRef }),
          },
          {
            label: t('gitDeleteRemoteBranch', { branch: branchName }),
            onClick: () => gitConfirmOpen({
              title: t('gitDeleteRemoteBranch', { branch: branchName }),
              text: t('gitDeleteRemoteBranchConfirm', { remote: fullRef.slice(0, slash), branch: branchName }),
              okText: t('gitDeleteBtn'),
              danger: true,
              onOk: async () => {
                try {
                  const result = await gitPost('/git/remote', { action: 'delete-branch', branch: branchName, remote: fullRef.slice(0, slash) })
                  flash(result.degraded === true
                    ? t('gitDeleteRemoteBranchDegraded')
                    : t('gitDeleteRemoteBranchOk', { remote: fullRef.slice(0, slash), branch: branchName }))
                  gitFetch(true, true)
                } catch (err) {
                  flash(gitErrText(err))
                }
              },
            }),
          },
        ])
      } else if (local !== null) {
        const branchName = (local.firstChild?.textContent ?? '').trim()
        const isCurrent = branchName === currentBranch
        gitCtxOpen(ev.clientX, ev.clientY, [
          {
            label: t('gitSwitchTo', { branch: branchName }),
            disabled: isCurrent,
            onClick: () => gitCheckout({ branch: branchName }),
          },
          {
            label: t('gitPush', { branch: branchName }),
            disabled: gitRemotes.length === 0,
            onClick: () => gitPushOpen(branchName),
          },
          {
            label: t('gitMergeInto', { branch: branchName }),
            disabled: isCurrent,
            onClick: async () => {
              try {
                const result = await gitBranchAction({ action: 'merge', branch: branchName })
                flash(t('gitMergeOk', { branch: result.branch }))
                gitFetch(true, true)
              } catch (err) {
                flash(gitErrText(err), 'error')
              }
            },
          },
          {
            label: t('gitRenameBranch', { branch: branchName }),
            onClick: () => gitCreateOpen({ mode: 'rename', branch: branchName }),
          },
          {
            label: t('gitDeleteBranch', { branch: branchName }),
            disabled: isCurrent,
            onClick: () => gitConfirmOpen({
              title: t('gitDeleteBranch', { branch: branchName }),
              text: t('gitDeleteConfirm', { branch: branchName }),
              okText: t('gitDeleteBtn'),
              danger: true,
              onOk: async () => {
                try {
                  await gitBranchAction({ action: 'delete', branch: branchName })
                  flash(t('gitDeleteOk', { branch: branchName }))
                  gitFetch(true, true)
                } catch (err) {
                  flash(gitErrText(err), 'error')
                }
              },
            }),
          },
          {
            label: t('gitDeleteBranchForce', { branch: branchName }),
            disabled: isCurrent,
            onClick: () => gitConfirmOpen({
              title: t('gitDeleteBranchForce', { branch: branchName }),
              text: t('gitDeleteForceConfirm', { branch: branchName }),
              okText: t('gitDeleteForceBtn'),
              danger: true,
              onOk: async () => {
                try {
                  await gitBranchAction({ action: 'delete', branch: branchName, force: true })
                  flash(t('gitDeleteOk', { branch: branchName }))
                  gitFetch(true, true)
                } catch (err) {
                  flash(gitErrText(err), 'error')
                }
              },
            }),
          },
        ])
      }
    })

    // 创建分支对话框：头部「＋ 新分支」按钮 → 输入名 + 即时校验 + 创建并检出。
    const gitCreateBox = document.createElement('div')
    gitCreateBox.setAttribute('data-dsc-git-create', '')
    body.appendChild(gitCreateBox)
    const gitCreateHead = document.createElement('div')
    gitCreateHead.className = 'dsc-git-create-head'
    const gitCreateTitle = document.createElement('div')
    gitCreateTitle.className = 'dsc-git-create-title'
    gitCreateTitle.textContent = t('gitCreateTitle')
    const gitCreateCancel = document.createElement('button')
    gitCreateCancel.type = 'button'
    gitCreateCancel.setAttribute('data-dsc-btn', '')
    gitCreateCancel.textContent = t('close')
    gitCreateHead.appendChild(gitCreateTitle)
    gitCreateHead.appendChild(gitCreateCancel)
    const gitCreateInput = document.createElement('input')
    gitCreateInput.type = 'text'
    gitCreateInput.placeholder = t('gitCreatePlaceholder')
    const gitCreateErr = document.createElement('div')
    gitCreateErr.setAttribute('data-dsc-git-create-err', '')
    const gitCreateActions = document.createElement('div')
    gitCreateActions.className = 'dsc-git-create-actions'
    const gitCreateSubmit = document.createElement('button')
    gitCreateSubmit.type = 'button'
    gitCreateSubmit.setAttribute('data-dsc-btn', '')
    gitCreateSubmit.textContent = t('gitCreateSubmit')
    gitCreateActions.appendChild(gitCreateSubmit)
    gitCreateBox.appendChild(gitCreateHead)
    gitCreateBox.appendChild(gitCreateInput)
    gitCreateBox.appendChild(gitCreateErr)
    gitCreateBox.appendChild(gitCreateActions)
    const gitCreateClose = () => { gitCreateBox.style.display = 'none' }
    // 对话框模式（2.2/2.4）：create（含 start=tag）| rename | stash（从 stash 建分支）
    let gitCreateMode = 'create'
    let gitCreateStart = ''
    let gitCreateRenameFrom = ''
    let gitCreateStashSelector = ''
    const gitCreateOpen = (opts = {}) => {
      gitCreateMode = opts.mode ?? 'create'
      gitCreateStart = opts.start ?? ''
      gitCreateRenameFrom = opts.branch ?? ''
      gitCreateStashSelector = opts.selector ?? ''
      gitCreateTitle.textContent = gitCreateMode === 'rename' ? t('gitRenameTitle') : gitCreateMode === 'stash' ? t('gitStashBranchTitle') : t('gitCreateTitle')
      gitCreateSubmit.textContent = gitCreateMode === 'rename' ? t('gitRenameSubmit') : t('gitCreateSubmit')
      // 初始态：提示输入分支名（弱化样式），空输入时提交按钮禁用
      gitCreateErr.textContent = t('gitCreatePrompt')
      gitCreateErr.classList.add('hint')
      gitCreateInput.value = ''
      gitCreateSubmit.disabled = true
      gitCreateBox.style.display = 'block'
      const headRect = gitHead.getBoundingClientRect()
      gitCreateBox.style.left = `${Math.min(headRect.left, window.innerWidth - 230)}px`
      gitCreateBox.style.top = `${headRect.bottom + 6}px`
      gitCreateInput.focus()
    }
    gitCreateInput.addEventListener('input', () => {
      const reason = validateBranchName(gitCreateInput.value.trim())
      if (reason === null) {
        gitCreateErr.textContent = ''
        gitCreateErr.classList.remove('hint')
      } else if (reason === 'empty') {
        // 清空后回到初始提示态
        gitCreateErr.textContent = t('gitCreatePrompt')
        gitCreateErr.classList.add('hint')
      } else {
        gitCreateErr.textContent = t('gitErrInvalidBranchName')
        gitCreateErr.classList.remove('hint')
      }
      gitCreateSubmit.disabled = reason !== null
    })
    const gitCreateRun = async () => {
      const name = gitCreateInput.value.trim()
      if (validateBranchName(name) !== null) return
      gitCreateSubmit.disabled = true
      try {
        if (gitCreateMode === 'rename') {
          const result = await gitBranchAction({ action: 'rename', branch: gitCreateRenameFrom, name })
          gitCreateClose()
          flash(t('gitRenameOk', { from: gitCreateRenameFrom, name: result.branch }))
        } else if (gitCreateMode === 'stash') {
          const result = await gitPost('/git/stash', { action: 'branch', selector: gitCreateStashSelector, branch: name })
          gitCreateClose()
          flash(t('gitStashBranchOk', { selector: gitCreateStashSelector.replace(/^refs\//, ''), branch: result.branch }))
        } else {
          const payload = { action: 'create', name }
          if (gitCreateStart !== '') payload.start = gitCreateStart
          const result = await gitBranchAction(payload)
          gitCreateClose()
          flash(t('gitCreateOk', { name: result.branch }))
        }
        gitFetch(true, true)
      } catch (err) {
        gitCreateErr.textContent = gitErrText(err)
        gitCreateErr.classList.remove('hint')
        gitCreateSubmit.disabled = false
      }
    }
    gitCreateSubmit.addEventListener('click', gitCreateRun)
    gitCreateInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') gitCreateRun()
      if (ev.key === 'Escape') gitCreateClose()
    })
    gitCreateCancel.addEventListener('click', gitCreateClose)
    const gitCreateBtn = document.createElement('button')
    gitCreateBtn.type = 'button'
    gitCreateBtn.setAttribute('data-dsc-btn', '')
    gitCreateBtn.textContent = t('gitCreateBtn')
    gitCreateBtn.title = t('gitCreateTitle')
    gitCreateBtn.addEventListener('click', gitCreateOpen)
    // 插到关闭按钮之前：头部按钮顺序为 标题 / 范围▾ / ↻ / ＋新分支 / 关闭（关闭最右）
    gitHead.insertBefore(gitCreateBtn, gitClose)

    // ---------- 推送分支对话框（上游 Push Branch 对话框移植，本地简化版） ----------
    // remote 单选（默认 origin/首个，同上游 getPushRemote 简化）+ Set Upstream toggle
    // （默认开）+ Push Mode 三选一（normal / force-with-lease / force，同上游枚举）。
    const gitPushBox = document.createElement('div')
    gitPushBox.setAttribute('data-dsc-git-push', '')
    body.appendChild(gitPushBox)
    const gitPushTitle = document.createElement('div')
    gitPushTitle.className = 'dsc-git-push-title'
    const gitPushRemoteRow = document.createElement('div')
    gitPushRemoteRow.className = 'dsc-git-opt-row'
    const gitPushRemoteLabel = document.createElement('label')
    gitPushRemoteLabel.textContent = t('gitPushRemote')
    const gitPushRemoteBtn = document.createElement('button')
    gitPushRemoteBtn.type = 'button'
    gitPushRemoteBtn.className = 'dsc-git-toggle on'
    gitPushRemoteRow.appendChild(gitPushRemoteLabel)
    gitPushRemoteRow.appendChild(gitPushRemoteBtn)
    const gitPushUpstreamRow = document.createElement('div')
    gitPushUpstreamRow.className = 'dsc-git-opt-row'
    const gitPushUpstreamLabel = document.createElement('label')
    gitPushUpstreamLabel.textContent = t('gitPushSetUpstream')
    const gitPushUpstreamToggle = document.createElement('button')
    gitPushUpstreamToggle.type = 'button'
    gitPushUpstreamToggle.className = 'dsc-git-toggle on'
    gitPushUpstreamToggle.textContent = '✓'
    gitPushUpstreamRow.appendChild(gitPushUpstreamLabel)
    gitPushUpstreamRow.appendChild(gitPushUpstreamToggle)
    const gitPushModeRow = document.createElement('div')
    gitPushModeRow.className = 'dsc-git-opt-row'
    const gitPushModeLabel = document.createElement('label')
    gitPushModeLabel.textContent = t('gitPushMode')
    const gitPushModeGroup = document.createElement('div')
    gitPushModeGroup.className = 'dsc-git-opt-group'
    const PUSH_MODE_KEYS = ['normal', 'force-with-lease', 'force']
    const PUSH_MODE_TEXTS = ['gitPushModeNormal', 'gitPushModeForceWithLease', 'gitPushModeForce']
    const gitPushModeBtns = PUSH_MODE_KEYS.map((mode, i) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'dsc-git-toggle' + (mode === 'normal' ? ' on' : '')
      btn.textContent = t(PUSH_MODE_TEXTS[i])
      btn.dataset.mode = mode
      btn.addEventListener('click', () => {
        for (const b of gitPushModeBtns) b.classList.toggle('on', b === btn)
      })
      gitPushModeGroup.appendChild(btn)
      return btn
    })
    gitPushModeRow.appendChild(gitPushModeLabel)
    gitPushModeRow.appendChild(gitPushModeGroup)
    const gitPushActions = document.createElement('div')
    gitPushActions.className = 'dsc-git-opt-actions'
    const gitPushSubmit = document.createElement('button')
    gitPushSubmit.type = 'button'
    gitPushSubmit.setAttribute('data-dsc-btn', '')
    gitPushSubmit.textContent = t('gitPush')
    const gitPushCancel = document.createElement('button')
    gitPushCancel.type = 'button'
    gitPushCancel.setAttribute('data-dsc-btn', '')
    gitPushCancel.textContent = t('gitCancel')
    gitPushActions.appendChild(gitPushSubmit)
    gitPushActions.appendChild(gitPushCancel)
    gitPushBox.appendChild(gitPushTitle)
    gitPushBox.appendChild(gitPushRemoteRow)
    gitPushBox.appendChild(gitPushUpstreamRow)
    gitPushBox.appendChild(gitPushModeRow)
    gitPushBox.appendChild(gitPushActions)
    let gitPushBranch = ''
    let gitPushRemote = ''
    const gitPushClose = () => { gitPushBox.style.display = 'none' }
    const gitPushOpen = (branchName) => {
      gitPushBranch = branchName
      gitPushRemote = gitRemotes.includes('origin') ? 'origin' : gitRemotes[0] ?? ''
      if (gitPushRemote === '') return // 无远程不应触发（菜单项已按 remotes>0 显示）
      gitPushTitle.textContent = t('gitPushTitle', { branch: branchName })
      gitPushRemoteBtn.textContent = gitPushRemote
      gitPushUpstreamToggle.classList.add('on')
      for (const b of gitPushModeBtns) b.classList.toggle('on', b.dataset.mode === 'normal')
      gitPushBox.style.display = 'block'
      const headRect = gitHead.getBoundingClientRect()
      gitPushBox.style.left = `${Math.min(headRect.left, window.innerWidth - 280)}px`
      gitPushBox.style.top = `${headRect.bottom + 6}px`
    }
    gitPushRemoteBtn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const rect = gitPushRemoteBtn.getBoundingClientRect()
      gitCtxOpen(rect.left, rect.bottom + 4, gitRemotes.map((r) => ({
        label: r,
        checked: r === gitPushRemote,
        onClick: () => { gitPushRemote = r; gitPushRemoteBtn.textContent = r },
      })))
    })
    gitPushUpstreamToggle.addEventListener('click', () => {
      gitPushUpstreamToggle.classList.toggle('on')
    })
    const gitPushRun = async () => {
      gitPushSubmit.disabled = true
      const mode = gitPushModeBtns.find((b) => b.classList.contains('on'))?.dataset.mode ?? 'normal'
      try {
        await gitPost('/git/push', {
          branch: gitPushBranch,
          remote: gitPushRemote,
          setUpstream: gitPushUpstreamToggle.classList.contains('on'),
          mode,
        })
        gitPushClose()
        flash(t('gitPushOk', { branch: gitPushBranch, remote: gitPushRemote }))
        gitFetch(true, true)
      } catch (err) {
        // 失败保留对话框：用户可改 mode（如 force-with-lease）后重试
        flash(gitErrText(err), 'error')
        gitPushSubmit.disabled = false
      }
    }
    gitPushSubmit.addEventListener('click', gitPushRun)
    gitPushCancel.addEventListener('click', gitPushClose)
    document.addEventListener('keydown', (ev) => {
      // remote 列表开着时 Esc 只关列表（ctx 菜单自己的监听处理），不连 push 框一起关
      if (ev.key === 'Escape' && gitPushBox.style.display !== 'none' && gitCtxMenu.style.display === 'none') gitPushClose()
    })
    document.addEventListener('click', (ev) => {
      if (gitPushBox.style.display === 'none') return
      // 排除右键菜单内的点击：remote 选择列表从 push 框弹出，点选项不能关 push 框
      if (!gitPushBox.contains(ev.target) && !gitCtxMenu.contains(ev.target)) gitPushClose()
    })

    // ---------- stash 对话框（未提交行右键「暂存未提交改动」） ----------
    // message（可选）+ include untracked toggle（上游 stashUncommittedChanges 对话框简化）。
    const gitStashBox = document.createElement('div')
    gitStashBox.setAttribute('data-dsc-git-stash', '')
    body.appendChild(gitStashBox)
    const gitStashTitle = document.createElement('div')
    gitStashTitle.className = 'dsc-git-stash-title'
    gitStashTitle.textContent = t('gitStashUncommittedTitle')
    const gitStashMsgInput = document.createElement('input')
    gitStashMsgInput.type = 'text'
    gitStashMsgInput.placeholder = t('gitStashMessage')
    const gitStashUntrackedRow = document.createElement('div')
    gitStashUntrackedRow.className = 'dsc-git-opt-row'
    const gitStashUntrackedLabel = document.createElement('label')
    gitStashUntrackedLabel.textContent = t('gitStashIncludeUntracked')
    const gitStashUntrackedToggle = document.createElement('button')
    gitStashUntrackedToggle.type = 'button'
    gitStashUntrackedToggle.className = 'dsc-git-toggle'
    gitStashUntrackedToggle.textContent = '✓'
    gitStashUntrackedRow.appendChild(gitStashUntrackedLabel)
    gitStashUntrackedRow.appendChild(gitStashUntrackedToggle)
    const gitStashActions = document.createElement('div')
    gitStashActions.className = 'dsc-git-opt-actions'
    const gitStashSubmit = document.createElement('button')
    gitStashSubmit.type = 'button'
    gitStashSubmit.setAttribute('data-dsc-btn', '')
    gitStashSubmit.textContent = t('gitStashUncommitted')
    const gitStashCancel = document.createElement('button')
    gitStashCancel.type = 'button'
    gitStashCancel.setAttribute('data-dsc-btn', '')
    gitStashCancel.textContent = t('gitCancel')
    gitStashActions.appendChild(gitStashSubmit)
    gitStashActions.appendChild(gitStashCancel)
    gitStashBox.appendChild(gitStashTitle)
    gitStashBox.appendChild(gitStashMsgInput)
    gitStashBox.appendChild(gitStashUntrackedRow)
    gitStashBox.appendChild(gitStashActions)
    const gitStashBoxClose = () => { gitStashBox.style.display = 'none' }
    const gitStashBoxOpen = () => {
      gitStashMsgInput.value = ''
      gitStashUntrackedToggle.classList.remove('on')
      gitStashBox.style.display = 'block'
      const headRect = gitHead.getBoundingClientRect()
      gitStashBox.style.left = `${Math.min(headRect.left, window.innerWidth - 280)}px`
      gitStashBox.style.top = `${headRect.bottom + 6}px`
      gitStashMsgInput.focus()
    }
    gitStashUntrackedToggle.addEventListener('click', () => {
      gitStashUntrackedToggle.classList.toggle('on')
    })
    const gitStashBoxRun = async () => {
      gitStashSubmit.disabled = true
      try {
        await gitPost('/git/stash', {
          action: 'push',
          message: gitStashMsgInput.value.trim(),
          includeUntracked: gitStashUntrackedToggle.classList.contains('on'),
        })
        gitStashBoxClose()
        flash(t('gitStashOk'))
        gitFetch(true, true)
      } catch (err) {
        flash(gitErrText(err), 'error')
        gitStashSubmit.disabled = false
      }
    }
    gitStashSubmit.addEventListener('click', gitStashBoxRun)
    gitStashCancel.addEventListener('click', gitStashBoxClose)
    gitStashMsgInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') gitStashBoxRun()
      if (ev.key === 'Escape') gitStashBoxClose()
    })
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && gitStashBox.style.display !== 'none') gitStashBoxClose()
    })
    document.addEventListener('click', (ev) => {
      if (gitStashBox.style.display === 'none') return
      if (!gitStashBox.contains(ev.target)) gitStashBoxClose()
    })

    /** stash 徽标右键统一入口（apply/pop/drop）：成功 flash + 刷新。 */
    const gitStashRun = async (action, selector) => {
      const shortSel = selector.replace(/^refs\//, '')
      const okKey = action === 'apply' ? 'gitStashApplyOk' : action === 'pop' ? 'gitStashPopOk' : 'gitStashDropOk'
      try {
        await gitPost('/git/stash', { action, selector })
        flash(t(okKey, { selector: shortSel }))
        gitFetch(true, true)
      } catch (err) {
        flash(gitErrText(err), 'error')
      }
    }

    gitToggle.addEventListener('click', () => {
      hideGitHint() // 首次提示：点过即不再显示
      gitOpen = !gitOpen
      gitPanel.classList.toggle('open', gitOpen)
      gitToggle.classList.toggle('on', gitOpen)
      if (gitOpen) {
        gitFetch(false)
        gitEventsOpen()
      } else {
        gitEventsClose()
      }
    })
    gitClose.addEventListener('click', () => {
      gitOpen = false
      gitPanel.classList.remove('open')
      gitToggle.classList.remove('on')
      gitEventsClose()
    })
    gitRefresh.addEventListener('click', () => gitFetch(false))
    const gitTimer = setInterval(() => {
      if (gitOpen && document.visibilityState === 'visible') {
        // 会话切换（换工作区）时重建 SSE 订阅；10s 轮询兜底 EventSource 断连
        if (gitEventsSession !== currentSessionId()) {
          gitEventsClose()
          gitEventsOpen()
        }
        gitFetch(true)
      }
    }, 10000)

    
    // ---------- 全局观测：视图切换时显示/隐藏面板角上开关 ----------
    const syncToggles = () => {
      gitToggle.style.display = isChatView() ? 'flex' : 'none'
    }
    let flow = flowOf()
    const bindFlow = () => {
      const next = flowOf()
      if (next === flow) return false
      flow = next
      syncToggles()
      return true
    }
    const observer = new MutationObserver(() => { bindFlow() })
    observer.observe(body, { childList: true, subtree: true })
    // 视图切换可能不触发 mutation，定时兜底
    const viewTimer = setInterval(syncToggles, 2000)

    const msg = document.createElement('div')
    msg.setAttribute('data-dsc-msg', '')
    body.appendChild(msg)

    // 首次使用提示气泡：指向面板角上开关，只显示一次（localStorage 记录），
    // 6 秒自动消失或点击开关即消失。位置：按钮左侧、垂直居中，钳制在视口内。
    const gitHint = document.createElement('div')
    gitHint.setAttribute('data-dsc-hint', '')
    gitHint.textContent = t('gitHint')
    body.appendChild(gitHint)
    let gitHintTimer = null
    const hideGitHint = (remember = true) => {
      if (remember) { try { localStorage.setItem('dsc-git-hint', '1') } catch { /* ignore */ } }
      if (gitHintTimer !== null) clearTimeout(gitHintTimer)
      gitHintTimer = null
      gitHint.style.display = 'none'
    }
    const showGitHint = () => {
      if (localStorage.getItem('dsc-git-hint') === '1') return
      gitHint.style.display = 'block'
      gitHint.style.visibility = 'hidden' // 先测量实际尺寸再定位
      const w = gitHint.offsetWidth
      const h = gitHint.offsetHeight
      gitHint.style.visibility = ''
      const btnLeft = parseFloat(gitToggle.style.left) || 8
      const btnTop = parseFloat(gitToggle.style.top) || 8
      const left = Math.min(Math.max(8, btnLeft - w - 10), window.innerWidth - w - 8)
      const top = Math.min(Math.max(8, btnTop + 15 - h / 2), window.innerHeight - h - 8)
      gitHint.style.left = `${left}px`
      gitHint.style.top = `${top}px`
      gitHintTimer = setTimeout(() => hideGitHint(), 6000)
    }

    bindFlow()
    syncToggles()
    if (isChatView()) showGitHint()

    // 插件生命周期：unload 时清理。
    return () => {
      clearInterval(gitTimer)
      clearInterval(viewTimer)
      if (msgTimer !== null) clearTimeout(msgTimer)
      if (gitHintTimer !== null) clearTimeout(gitHintTimer)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      gitToggle.remove()
      gitPanel.remove()
      gitCtxMenu.remove()
      gitCreateBox.remove()
      gitConfirmBox.remove()
      gitPushBox.remove()
      gitStashBox.remove()
      msg.remove()
      gitHint.remove()
      document.getElementById(STYLE_ID)?.remove()
    }
  },
}

return module.exports; } });
