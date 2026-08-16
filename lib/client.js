window.__ModuleLoader__.load({ id: "@wongzexu/dsh-git-status", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
// @wongzexu/dsh-git-status 浏览器端 half：自渲染 DOM，零 React 依赖（greeter 模式）。
// 单模块：Git 状态（commit DAG 泳道图 + 行内详情 diff + 分支操作）。
// 数据通道：Node half 自造路由（/plugins/dsh-gitstatus/*）；
// 布局锚点：官方 DOM 属性（data-chat-flow 等），不依赖 React 内部结构。
// 构建：scripts/build-client.js 包成 __ModuleLoader__.load 契约（CJS）。
const BASE = '/plugins/dsh-gitstatus'

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
    gitRemoteSubs: '{branch} 的远程分支：{remotes}',
    gitCreateFromRemote: '创建本地分支 {branch} 并检出（{remote}）',
    gitCreateFromCommit: '在 {hash} 新建分支并检出',
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
    gitFetch: '从所有远程拉取',
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
    gitAddTag: '创建 tag…',
    gitAddTagTitle: '给 {hash} 添加 tag',
    gitAddTagPrompt: '请输入 tag 名',
    gitAddTagPlaceholder: 'tag 名',
    gitAddTagSubmit: '创建 tag',
    gitAddTagOk: '已创建 tag {tag}',
    gitAddTagPushedOk: '已创建 tag {tag} 并推送 → {remote}',
    gitAddTagReplaceTitle: '替换 tag {tag}？',
    gitAddTagReplaceText: '同名 tag 已存在，是否用新 tag 替换？',
    gitReplaceBtn: '替换',
    gitTagType: '类型',
    gitTagTypeAnnotated: '附注',
    gitTagTypeLightweight: '轻量',
    gitTagMessagePlaceholder: '备注（可选，仅附注 tag）',
    gitPushTo: '推送到',
    gitNoPush: '不推送',
    gitErrPushFailed: 'tag 已创建，但推送远程失败',
    gitErrTagAlreadyExists: 'tag 已存在',
    gitErrRemoteTagExists: '远程已存在同名 tag（指向不同提交），需先删除远程 tag 再推送',
    gitErrInvalidTagType: '无效的 tag 类型',
    gitErrInvalidCommit: '无效的提交',
    gitErrCommitNotFound: '目标提交不存在',
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
    gitSettings: '设置',
    gitUserInfo: '用户信息',
    gitUserName: '姓名',
    gitUserEmail: '邮箱',
    gitUserNotSet: '未设置',
    gitUserAdd: '添加',
    gitUserEdit: '编辑',
    gitUserDelete: '删除',
    gitUserSave: '保存',
    gitUserLocal: 'Local',
    gitUserGlobal: 'Global',
    gitUserLocalRepo: '本仓库',
    gitUserGlobalRepo: '全局',
    gitUserSwitchToGlobal: '点击切换到全局配置（所有仓库生效）',
    gitUserSwitchToLocal: '点击切换为本仓库配置（仅当前仓库生效）',
    gitUserSwitchTitle: '切换配置层级',
    gitUserSwitchConfirm: '目标层已有不同的值，切换会覆盖它。确定切换吗？',
    gitUserSwitchAnyway: '仍要切换',
    gitUserDeleteConfirm: '确定删除该项配置吗？将写入 git config。',
    gitUserWriteTo: '写入位置：{layer}',
    gitUserEditPlaceholder: '输入{field}',
    gitUserConfigFailed: '读取 git 配置失败',
    gitUserSaveOk: '已保存',
    gitUserSwitchOk: '已切换配置层级',
    gitUserDeleteOk: '已删除',
    gitRemoteInfo: '远程配置',
    gitRemoteNone: '尚未配置远程',
    gitRemoteAdd: '添加远程',
    gitRemoteName: '名称',
    gitRemoteFetchUrl: 'Fetch URL',
    gitRemotePushUrl: 'Push URL',
    gitRemotePushSame: 'push 同 fetch URL',
    gitRemoteFetch: '拉取',
    gitRemoteFetching: '拉取中…',
    gitRemoteFetchOk: '已从 {name} 拉取',
    gitRemoteAddOk: '已添加远程',
    gitRemoteSaveOk: '已保存远程配置',
    gitRemoteDeleteOk: '已删除远程',
    gitRemoteDeleteTitle: '删除远程',
    gitRemoteDeleteConfirm: '确定删除远程 {name} 吗？其远程分支记录将一并移除。',
    gitSettingsDefaults: '默认行为',
    gitSettingsDisplay: '显示',
    gitDisplayStashes: '显示 stash 行',
    gitDisplayStashesHint: '控制图中是否显示 stash 条目（含徽标与双层圆点）',
    gitDisplayTags: '显示 tag 徽标',
    gitDisplayTagsHint: '在提交行上显示 tag 徽标',
    gitDisplayRemoteBranches: '显示远程分支',
    gitDisplayRemoteBranchesHint: '显示远程跟踪分支徽标（如 gitee/main）；关闭时也不显示同名合并子标签',
    gitDisplayMergeRefs: '合并同名本地/远程分支徽标',
    gitDisplayMergeRefsHint: '同名本地分支与远程分支合并为同一徽标，远程名以内嵌子标签显示（如 main [gitee]）；关闭时各自独立显示',
    gitDisplayReflogs: '包含 reflog 提到的提交',
    gitDisplayReflogsHint: '把仅被 reflog 提及的提交（如被 reset / 变基丢弃的提交）也纳入图，需刷新图生效',
    gitDisplayFirstParent: '只跟随第一个父提交',
    gitDisplayFirstParentHint: '仅跟踪每个提交的第一个父提交，历史线性化（大型仓库加载更快），需刷新图生效',
    gitDisplayDefaultScope: '打开时默认范围',
    gitDefaultPruneFetch: '拉取时自动修剪',
    gitDefaultPruneFetchHint: '拉取时自动清理远端已删除的分支引用（git fetch --prune）；关闭后保留过时的远程分支记录',
    gitErrRemoteAlreadyExists: '远程名称已存在',
    gitErrInvalidRemoteName: '远程名称非法',
    gitErrInvalidRemoteUrl: '远程 URL 非法',
    gitErrRemoteNotFound: '远程不存在',
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
    gitRemoteSubs: 'Remote branches of {branch}: {remotes}',
    gitCreateFromRemote: 'Create local branch {branch} and check out ({remote})',
    gitCreateFromCommit: 'Create branch from {hash} and check out',
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
    gitFetch: 'Fetch from all remotes',
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
    gitAddTag: 'Add Tag…',
    gitAddTagTitle: 'Add tag to commit {hash}',
    gitAddTagPrompt: 'Please enter a tag name',
    gitAddTagPlaceholder: 'tag name',
    gitAddTagSubmit: 'Add tag',
    gitAddTagOk: 'Tag {tag} created',
    gitAddTagPushedOk: 'Tag {tag} created and pushed → {remote}',
    gitAddTagReplaceTitle: 'Replace tag {tag}?',
    gitAddTagReplaceText: 'A tag named {tag} already exists. Replace it with the new tag?',
    gitReplaceBtn: 'Replace',
    gitTagType: 'Type',
    gitTagTypeAnnotated: 'Annotated',
    gitTagTypeLightweight: 'Lightweight',
    gitTagMessagePlaceholder: 'Message (optional, annotated tags only)',
    gitPushTo: 'Push to',
    gitNoPush: "Don't push",
    gitErrPushFailed: 'Tag created, but pushing to remote(s) failed',
    gitErrTagAlreadyExists: 'Tag already exists',
    gitErrRemoteTagExists: 'A tag with the same name already exists on the remote (pointing to a different commit); delete the remote tag before pushing',
    gitErrInvalidTagType: 'Invalid tag type',
    gitErrInvalidCommit: 'Invalid commit',
    gitErrCommitNotFound: 'Target commit not found',
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
    gitSettings: 'Settings',
    gitUserInfo: 'User Details',
    gitUserName: 'Name',
    gitUserEmail: 'Email',
    gitUserNotSet: 'Not set',
    gitUserAdd: 'Add',
    gitUserEdit: 'Edit',
    gitUserDelete: 'Delete',
    gitUserSave: 'Save',
    gitUserLocal: 'Local',
    gitUserGlobal: 'Global',
    gitUserLocalRepo: 'This repo',
    gitUserGlobalRepo: 'Global',
    gitUserSwitchToGlobal: 'Click to switch to global config (applies to all repositories)',
    gitUserSwitchToLocal: 'Click to switch to this repository config (this repo only)',
    gitUserSwitchTitle: 'Switch config layer',
    gitUserSwitchConfirm: 'The target layer already has a different value; switching will overwrite it. Switch anyway?',
    gitUserSwitchAnyway: 'Switch anyway',
    gitUserDeleteConfirm: 'Delete this config entry? This writes to git config.',
    gitUserWriteTo: 'Will be written to: {layer}',
    gitUserEditPlaceholder: 'Enter {field}',
    gitUserConfigFailed: 'Failed to load git config',
    gitUserSaveOk: 'Saved',
    gitUserSwitchOk: 'Config layer switched',
    gitUserDeleteOk: 'Deleted',
    gitRemoteInfo: 'Remotes',
    gitRemoteNone: 'No remotes configured',
    gitRemoteAdd: 'Add Remote',
    gitRemoteName: 'Name',
    gitRemoteFetchUrl: 'Fetch URL',
    gitRemotePushUrl: 'Push URL',
    gitRemotePushSame: 'push = fetch URL',
    gitRemoteFetch: 'Fetch',
    gitRemoteFetching: 'Fetching…',
    gitRemoteFetchOk: 'Fetched from {name}',
    gitRemoteAddOk: 'Remote added',
    gitRemoteSaveOk: 'Remote saved',
    gitRemoteDeleteOk: 'Remote deleted',
    gitRemoteDeleteTitle: 'Delete Remote',
    gitRemoteDeleteConfirm: 'Delete remote {name}? Its remote-tracking branches will be removed as well.',
    gitSettingsDefaults: 'Defaults',
    gitSettingsDisplay: 'Display',
    gitDisplayStashes: 'Show stash entries',
    gitDisplayStashesHint: 'Whether to show stash entries in the graph (badge and double-ring dot)',
    gitDisplayTags: 'Show tag badges',
    gitDisplayTagsHint: 'Whether to show tag badges on commit rows',
    gitDisplayRemoteBranches: 'Show remote branches',
    gitDisplayRemoteBranchesHint: 'Whether to show remote-tracking branch badges (e.g. gitee/main); merged sub-labels are hidden too when off',
    gitDisplayMergeRefs: 'Merge matching local/remote branches',
    gitDisplayMergeRefsHint: 'Merge a local branch and same-named remote branches into one badge, showing remotes as embedded sub-labels (e.g. main [gitee]); when off they are shown separately',
    gitDisplayReflogs: 'Include commits mentioned by reflogs',
    gitDisplayReflogsHint: 'Include commits only mentioned by reflogs (e.g. dropped by reset/rebase) in the graph; applies after a refresh',
    gitDisplayFirstParent: 'Only follow the first parent',
    gitDisplayFirstParentHint: 'Only follow the first parent of each commit, linearizing history (faster on large repos); applies after a refresh',
    gitDisplayDefaultScope: 'Default scope on open',
    gitDefaultPruneFetch: 'Prune stale remote branches on fetch',
    gitDefaultPruneFetchHint: 'Prune remote-tracking refs deleted on the remote (git fetch --prune) when fetching; disable to keep stale remote branches',
    gitErrRemoteAlreadyExists: 'Remote name already exists',
    gitErrInvalidRemoteName: 'Invalid remote name',
    gitErrInvalidRemoteUrl: 'Invalid remote URL',
    gitErrRemoteNotFound: 'Remote does not exist',
  },
}

// 远程行图标按钮 SVG（用户提供源稿清理版）：viewBox 1024，渲染 12px，
// fill 继承按钮文字色（currentColor），pointer-events:none 防 SVG 抢点击（拖拽豁免教训）。
// 拉取 = 下载箭头；编辑 = 铅笔；删除 = ×。
const GIT_ICON_FETCH = '<svg viewBox="0 0 1024 1024" width="11" height="11" fill="currentColor" style="vertical-align:middle;pointer-events:none" aria-hidden="true"><path d="M549.831 139.662h-75.662V64h75.662v75.662zM537.884 960l374.329-370.347-55.751-55.751-306.631 310.614v-107.52h-75.662v107.52L163.556 533.902l-51.769 55.751L486.116 960h51.768z m-63.715-597.333h75.662v-71.68h-75.662v71.68z m75.662 226.986h-75.662v-75.662h75.662v75.662z"/></svg>'
const GIT_ICON_EDIT = '<svg viewBox="0 0 1024 1024" width="11" height="11" fill="currentColor" style="vertical-align:middle;pointer-events:none" aria-hidden="true"><path d="M960 176.855v92.336L433.344 799.267l-17.099 10.26L152.916 960 64 871.084l150.473-263.328 10.26-17.099L754.809 64h92.336L960 176.855zM344.427 771.908l-92.336-92.336-99.176 191.511 191.512-99.175z m567.695-547.175L799.267 111.878 286.29 624.855 399.145 737.71l512.977-512.977z"/></svg>'
const GIT_ICON_DELETE = '<svg viewBox="0 0 1024 1024" width="11" height="11" fill="currentColor" style="vertical-align:middle;pointer-events:none" aria-hidden="true"><path d="M140.5 960L64 883.5 441 512 64 140.5 140.5 64 512 441 883.5 64l76.5 76.5L583 512l377 371.5-76.5 76.5L512 583 140.5 960z"/></svg>'
// 顶部「拉取」按钮图标（用户提供源稿清理版）：地球 + 下载箭头（从远程/云端拉取语义），
// 渲染 12px 先行看大小；其余同远程行图标约定。
const GIT_ICON_FETCH_TOP = '<svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor" style="vertical-align:middle;pointer-events:none" aria-hidden="true"><path d="M512 512a42.666667 42.666667 0 0 0-42.666667 42.666667v238.336l-97.834666-97.834667a42.666667 42.666667 0 0 0-60.330667 0 42.666667 42.666667 0 0 0 0 60.330667l170.666667 170.666666A42.666667 42.666667 0 0 0 554.666667 896v-341.333333a42.666667 42.666667 0 0 0-42.666667-42.666667z"/><path d="M652.501333 695.168l-170.666666 170.666667a42.666667 42.666667 0 0 0 0 60.330666 42.666667 42.666667 0 0 0 60.330666 0l170.666667-170.666666a42.666667 42.666667 0 0 0 0-60.330667 42.666667 42.666667 0 0 0-60.330667 0z"/><path d="M350.677333 87.082667A336.938667 336.938667 0 0 0 199.594667 139.52C9.386667 261.674667-10.794667 534.741333 159.317333 683.52a42.666667 42.666667 0 0 0 60.245334-3.968 42.666667 42.666667 0 0 0-4.053334-60.245333A255.018667 255.018667 0 0 1 245.76 211.2a254.976 254.976 0 0 1 383.658667 142.250667 42.666667 42.666667 0 0 0 40.917333 30.506666H746.666667c77.226667 0 125.781333 47.701333 143.232 107.178667 17.493333 59.434667 2.56 125.909333-62.378667 167.722667a42.666667 42.666667 0 0 0-12.8 59.008 42.666667 42.666667 0 0 0 58.965333 12.757333c96.128-61.866667 125.013333-172.16 98.133334-263.509333C944.938667 375.808 861.013333 298.666667 746.666667 298.666667h-53.248c-59.093333-141.013333-198.698667-225.109333-342.741334-211.584z"/></svg>'
const GIT_ICON_REFRESH = '<svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor" style="vertical-align:middle;pointer-events:none" aria-hidden="true"><path d="M512 85.333333C323.754667 85.333333 179.114667 200.746667 117.845333 348.757333 56.533333 496.768 77.226667 680.533333 210.346667 813.653333c133.12 133.12 316.885333 153.813333 464.896 92.501334C823.253333 844.885333 938.666667 700.245333 938.666667 512a42.666667 42.666667 0 0 0-42.666667-42.666667 42.666667 42.666667 0 0 0-42.666667 42.666667c0 153.856-91.392 265.941333-210.688 315.306667-119.253333 49.450667-263.210667 34.816-371.968-73.984-108.8-108.8-123.434667-252.714667-74.026666-371.968C246.058667 262.058667 358.144 170.666667 512 170.666667c96.213333 0 188.544 38.229333 258.005333 104.96l95.829334 95.872a42.666667 42.666667 0 0 0 60.330666 0 42.666667 42.666667 0 0 0 0-60.330667l-96.426666-96.426667a42.666667 42.666667 0 0 0-0.554667-0.554666C744.192 132.48 630.784 85.333333 512 85.333333z"/><path d="M896 85.333333a42.666667 42.666667 0 0 0-42.666667 42.666667v170.666667h-170.666666a42.666667 42.666667 0 0 0-42.666667 42.666666 42.666667 42.666667 0 0 0 42.666667 42.666667h213.333333a42.666667 42.666667 0 0 0 42.666667-42.666667V128a42.666667 42.666667 0 0 0-42.666667-42.666667z"/></svg>'
const GIT_ICON_CREATE = '<svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor" style="vertical-align:middle;pointer-events:none" aria-hidden="true"><path d="M256 85.333333a42.666667 42.666667 0 0 0-42.666667 42.666667v512a42.666667 42.666667 0 0 0 42.666667 42.666667 42.666667 42.666667 0 0 0 42.666667-42.666667V128a42.666667 42.666667 0 0 0-42.666667-42.666667zM768 85.333333c-53.333333 0-98.773333 21.546667-127.914667 54.314667C610.944 172.501333 597.333333 214.528 597.333333 256s13.610667 83.541333 42.752 116.352C669.226667 405.12 714.666667 426.666667 768 426.666667c53.333333 0 98.773333-21.546667 127.914667-54.314667C925.056 339.498667 938.666667 297.472 938.666667 256s-13.610667-83.541333-42.752-116.352C866.773333 106.88 821.333333 85.333333 768 85.333333z m0 85.333334c32 0 50.56 10.453333 64.085333 25.685333 13.525333 15.189333 21.248 37.12 21.248 59.648 0 22.528-7.722667 44.458667-21.248 59.648C818.56 330.88 800 341.333333 768 341.333333s-50.56-10.453333-64.085333-25.685333C690.389333 300.458667 682.666667 278.528 682.666667 256c0-22.528 7.722667-44.458667 21.248-59.648C717.44 181.12 736 170.666667 768 170.666667z"/><path d="M256 597.333333c-53.333333 0-98.773333 21.546667-127.914667 54.314667C98.944 684.501333 85.333333 726.528 85.333333 768s13.610667 83.541333 42.752 116.352C157.226667 917.12 202.666667 938.666667 256 938.666667c53.333333 0 98.773333-21.546667 127.914667-54.314667C413.056 851.498667 426.666667 809.472 426.666667 768s-13.610667-83.541333-42.752-116.352C354.773333 618.88 309.333333 597.333333 256 597.333333z m0 85.333334c32 0 50.56 10.453333 64.085333 25.685333 13.525333 15.189333 21.248 37.12 21.248 59.648 0 22.528-7.722667 44.458667-21.248 59.648C306.56 842.88 288 853.333333 256 853.333333s-50.56-10.453333-64.085333-25.685333C178.389333 812.458667 170.666667 790.528 170.666667 768c0-22.528 7.722667-44.458667 21.248-59.648C205.44 693.12 224 682.666667 256 682.666667z"/><path d="M640 213.333333C404.864 213.333333 213.333333 404.864 213.333333 640a42.666667 42.666667 0 0 0 42.666667 42.666667 42.666667 42.666667 0 0 0 42.666667-42.666667c0-189.013333 152.32-341.333333 341.333333-341.333333a42.666667 42.666667 0 0 0 42.666667-42.666667 42.666667 42.666667 0 0 0-42.666667-42.666667zM768 597.333333a42.666667 42.666667 0 0 0-42.666667 42.666667v256a42.666667 42.666667 0 0 0 42.666667 42.666667 42.666667 42.666667 0 0 0 42.666667-42.666667v-256a42.666667 42.666667 0 0 0-42.666667-42.666667z"/><path d="M640 725.333333a42.666667 42.666667 0 0 0-42.666667 42.666667 42.666667 42.666667 0 0 0 42.666667 42.666667h256a42.666667 42.666667 0 0 0 42.666667-42.666667 42.666667 42.666667 0 0 0-42.666667-42.666667z"/></svg>'

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
    const STYLE_ID = 'dsh-gitstatus-style'
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
/* 头部按钮统一 20px 高：文字/图标垂直居中（拉取 20×20 图标按钮已单独设置） */
[data-dsc-git-head] [data-dsc-btn] {
  height: 20px; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
}
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
/* 多选菜单项（如 push remote 选择）：复选框 + 文字左对齐 */
[data-dsc-git-ctx] button.dsc-ctx-multi {
  display: flex; align-items: center; gap: 6px;
}
[data-dsc-git-ctx] button.dsc-ctx-multi input[type='checkbox'] {
  margin: 0; accent-color: var(--dsw-alias-text-accent, #4c9aff);
}
/* 面板内按钮（头部/合并条/创建对话框）：跟随面板字号，覆盖 UA 表单控件默认 13.3333px */
[data-dsc-git] [data-dsc-btn], [data-dsc-git-create] [data-dsc-btn], [data-dsc-git-confirm] [data-dsc-btn], [data-dsc-git-tag] [data-dsc-btn] { font-size: inherit; }
/* 切换确认框（未提交改动提醒）：标题 + 正文 + 右对齐按钮行。
   z-index 940：高于设置弹窗（930）与右键菜单（935）——从设置弹窗内触发
   （如删除远程）时确认框必须浮在弹窗之上，否则同层叠被 DOM 靠后的弹窗盖住。 */
[data-dsc-git-confirm] { padding: 10px 12px; width: 260px; box-sizing: border-box; z-index: 940; }
[data-dsc-git-confirm] .dsc-git-confirm-title { font-weight: 600; margin-bottom: 6px; }
[data-dsc-git-confirm] .dsc-git-confirm-text { opacity: .85; line-height: 1.5; }
[data-dsc-git-confirm] .dsc-git-confirm-actions { display: flex; gap: 6px; margin-top: 10px; justify-content: flex-end; }
/* 危险操作确认按钮（删除分支等不可恢复操作）：红色实底，与普通确认（仍然切换）区分 */
[data-dsc-git-confirm] .dsc-git-confirm-ok-danger {
  background: rgba(232,73,73,.92); color: #fff;
}
[data-dsc-git-confirm] .dsc-git-confirm-ok-danger:hover { background: rgba(255,92,92,1); }
/* push/stash/tag 对话框（浮层卡片，同 confirm/create 框风格）：选项行 + toggle 按钮 */
[data-dsc-git-push], [data-dsc-git-stash], [data-dsc-git-tag] {
  position: fixed; z-index: 930; min-width: 250px; max-width: 340px;
  border-radius: 8px; padding: 10px 12px; display: none; font-size: 12px;
  box-sizing: border-box; color: var(--dsw-alias-text-1, #eee);
  background: var(--dsw-hovercard-bg, #2C2C2E);
  border: 1px solid rgba(255,255,255,.08); box-shadow: var(--dsw-shadow-lv3);
}
/* tag 对话框低于确认框（930）：同名 tag「替换？」确认需盖在对话框之上 */
[data-dsc-git-tag] { z-index: 929; }
/* tag 对话框底部操作行：左侧「推送到」+ 下拉多选按钮（不推送/各远程），右侧「创建 tag」按钮；
   按钮（margin-left:auto）保持右下 */
[data-dsc-git-tag] .dsc-git-tag-actions {
  display: flex; gap: 6px; margin-top: 8px; align-items: center; flex-wrap: wrap;
}
[data-dsc-git-tag] .dsc-git-tag-actions [data-dsc-btn] { margin-left: auto; }
[data-dsc-git-tag] .dsc-git-tag-push-label { opacity: .6; font-size: 11px; flex: none; }
[data-dsc-git-push] .dsc-git-push-title, [data-dsc-git-stash] .dsc-git-stash-title, [data-dsc-git-tag] .dsc-git-tag-title {
  font-weight: 600; margin-bottom: 8px;
}
.dsc-git-opt-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-bottom: 6px; font-size: 11px;
}
.dsc-git-opt-row label { opacity: .85; flex: 1; min-width: 0; }
.dsc-git-opt-group { display: flex; gap: 4px; flex: none; }
[data-dsc-git-stash] input[type='text'], [data-dsc-git-tag] input[type='text'] {
  width: 100%; box-sizing: border-box; padding: 4px 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.25);
  color: inherit; font-size: 11px; outline: none; margin-bottom: 6px;
}
[data-dsc-git-stash] input[type='text']:focus, [data-dsc-git-tag] input[type='text']:focus { border-color: var(--dsw-alias-text-accent, #4c9aff); }
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
/* 设置弹窗（头部 ⚙ 按钮 → 浮层卡片，同 push 框形态）：分区 + 用户信息行 +
   可点击层级徽标（Local⇄Global 切换）+ 行内编辑 */
[data-dsc-git-settings] {
  position: fixed; z-index: 930; width: 340px; max-width: 90vw;
  max-height: 70vh; overflow-y: auto; border-radius: 8px; padding: 10px 12px;
  display: none; font-size: 12px; box-sizing: border-box;
  color: var(--dsw-alias-text-1, #eee);
  background: var(--dsw-hovercard-bg, #2C2C2E);
  border: 1px solid rgba(255,255,255,.08); box-shadow: var(--dsw-shadow-lv3);
}
[data-dsc-git-settings] .dsc-git-settings-title {
  display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 10px;
}
[data-dsc-git-settings] .dsc-git-settings-title .spacer { flex: 1; }
[data-dsc-git-settings] .dsc-git-settings-section-title {
  font-size: 11px; opacity: .6; margin: 8px 0 6px; font-weight: 600;
}
/* 用户信息行：label / 值 / 层级徽标 / 操作按钮 */
.dsc-git-user-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11px;
}
.dsc-git-user-row .dsc-git-user-label { opacity: .85; flex: none; width: 36px; }
.dsc-git-user-row .dsc-git-user-value {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dsc-git-user-row .dsc-git-user-value.unset { opacity: .4; }
/* 层级徽标（可点击切换）：Local 蓝 / Global 绿，hover 提亮暗示可点 */
.dsc-git-user-layer {
  flex: none; font-size: 10px; padding: 1px 7px; border-radius: 999px;
  cursor: pointer; user-select: none; border: 1px solid transparent;
}
.dsc-git-user-layer.local {
  color: #8ab8ff; background: rgba(76,154,255,.14); border-color: rgba(76,154,255,.4);
}
.dsc-git-user-layer.global {
  color: #7ee2a8; background: rgba(74,190,120,.14); border-color: rgba(74,190,120,.4);
}
.dsc-git-user-layer:hover { filter: brightness(1.3); }
.dsc-git-user-layer:active { filter: brightness(1.5); }
/* 行内编辑区：输入框 + 层级提示/二选一 + 错误行 + 操作按钮 */
.dsc-git-user-edit { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
.dsc-git-user-edit input[type='text'] {
  flex: 1; min-width: 110px; padding: 4px 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.25);
  color: inherit; font-size: 11px; outline: none;
}
.dsc-git-user-edit input[type='text']:focus { border-color: var(--dsw-alias-text-accent, #4c9aff); }
.dsc-git-user-edit .dsc-git-user-err { color: #ff6961; font-size: 11px; width: 100%; }
.dsc-git-user-edit .dsc-git-user-layer-hint { opacity: .6; font-size: 10px; flex: none; }
.dsc-git-user-layers { display: flex; gap: 4px; flex: none; }
/* 编辑块内按钮与输入框同行：去掉全局 actions 的上边距（行内无需 8px 间隔） */
.dsc-git-user-edit .dsc-git-opt-actions { margin-top: 0; }
/* 顶部仅图标按钮（拉取 / 设置）：宽 26px、高 20px 固定；内部 20×20 画布
   水平居中、垂直占满，图标图形完全撑满画布中心 */
.dsc-git-top-icon-btn {
  flex: none; width: 25px; height: 20px; padding: 0; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
}
.dsc-git-top-icon-btn svg { display: block; }
/* 顶部拉取按钮：点击后地球+箭头图标整体旋转（图标本体近圆形，旋转观感自然） */
.dsc-git-top-spin svg { animation: dsc-git-remote-spin 0.9s linear infinite; }
/* 远程配置列表：每远程 = 主区一行（名称 + 两行信息 + 右侧按钮组） */
.dsc-git-remote-row { margin-bottom: 8px; }
.dsc-git-remote-main { display: flex; align-items: center; gap: 6px; font-size: 11px; }
/* 名称列：窄列（48px）内水平居中，超长省略 */
.dsc-git-remote-name {
  flex: none; width: 48px; text-align: center; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dsc-git-remote-info { flex: 1; min-width: 0; }
.dsc-git-remote-url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .85; }
.dsc-git-remote-push { font-size: 10px; opacity: .5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 右侧按钮组：拉取 / 编辑 / 删除（图标按钮） */
.dsc-git-remote-actions { flex: none; display: flex; gap: 4px; }
/* 图标按钮：18px 方形（与文字按钮同高）、图标 11px 居中；覆盖 data-dsc-btn 的 padding */
.dsc-git-remote-icon-btn {
  flex: none; width: 18px; height: 18px; padding: 0; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
}
.dsc-git-remote-icon-btn svg { display: block; }
/* 拉取中：箭头图标隐藏，原位显示旋转圆环加载圈（缺口随旋转游走） */
.dsc-git-remote-spin svg { display: none; }
.dsc-git-remote-spin::before {
  content: ''; width: 9px; height: 9px; border-radius: 50%;
  border: 2px solid currentColor; border-top-color: transparent;
  animation: dsc-git-remote-spin 0.8s linear infinite;
}
@keyframes dsc-git-remote-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.dsc-git-remote-row .dsc-git-remote-fetching { opacity: .6; cursor: default; }
.dsc-git-remote-none { font-size: 11px; opacity: .5; margin-bottom: 6px; }
/* 远程编辑表单：三字段（名称 / Fetch URL / Push URL），保存/取消与错误行 */
.dsc-git-remote-edit { margin-bottom: 6px; }
.dsc-git-remote-field { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 11px; }
.dsc-git-remote-field label { flex: none; width: 64px; opacity: .85; }
.dsc-git-remote-field input[type='text'] {
  flex: 1; min-width: 0; padding: 4px 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.25);
  color: inherit; font-size: 11px; outline: none;
}
.dsc-git-remote-field input[type='text']:focus { border-color: var(--dsw-alias-text-accent, #4c9aff); }
.dsc-git-remote-edit .dsc-git-remote-err { color: #ff6961; font-size: 11px; margin-top: 2px; }
/* 显示分区：2 列网格按钮（颜色状态由 .dsc-git-toggle.on 高亮区分，同 Local/Global） */
.dsc-git-display-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
  margin-bottom: 6px;
}
.dsc-git-display-grid .dsc-git-toggle {
  text-align: center; padding: 4px 6px; line-height: 1.3;
  white-space: normal; /* 长文案自动折两行 */
}
/* 默认行为开关行：toggle + 文案 + ？提示 */
.dsc-git-default-row { display: flex; align-items: center; gap: 6px; font-size: 11px; margin-bottom: 6px; }
.dsc-git-default-row .dsc-git-default-hint {
  flex: none; font-size: 10px; opacity: .5; cursor: help; border: 1px solid rgba(255,255,255,.2);
  border-radius: 999px; width: 13px; height: 13px; display: inline-flex; align-items: center;
  justify-content: center; line-height: 1;
}
[data-dsc-git-create] { padding: 8px 10px; display: none; }
[data-dsc-git-create] .dsc-git-create-head, [data-dsc-git-tag] .dsc-git-tag-head {
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
    gitRefresh.classList.add('dsc-git-top-icon-btn')
    gitRefresh.innerHTML = GIT_ICON_REFRESH
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
    // （上游工具栏形态，无对话框）；修剪跟随设置开关 gitSettingsStore.pruneOnFetch
    // （默认开，同上游 fetchAndPrune 默认）；
    // 完成后显式刷新图（SSE 状态键不含 refs/remotes，fetch 只更新远程跟踪 ref）。
    const gitFetchBtn = document.createElement('button')
    gitFetchBtn.type = 'button'
    gitFetchBtn.setAttribute('data-dsc-btn', '')
    // 顶部拉取按钮专用样式：高 20px 固定，图标撑满高度（20×20）
    gitFetchBtn.classList.add('dsc-git-top-icon-btn')
    // 地球 + 下载箭头 SVG；disabled 态 opacity 由 data-dsc-btn 提供
    gitFetchBtn.innerHTML = GIT_ICON_FETCH_TOP
    gitFetchBtn.title = t('gitFetch')
    gitFetchBtn.style.display = 'none'
    gitFetchBtn.addEventListener('click', async () => {
      gitFetchBtn.disabled = true
      gitFetchBtn.title = t('gitFetching')
      try {
        await gitPost('/git/fetch', { remote: '', prune: gitSettingsStoreLoad().pruneOnFetch === true })
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
      if (ev.target instanceof Element && ev.target.closest('select, [data-dsc-btn]') !== null) return
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
      // 显示设置（分区三）：徽标层门控统一在此取一次。
      // showMerge 依赖 showRemote：远程分支隐藏时合并子标签（本质是远程跟踪信息）一并隐藏。
      const disp = gitSettingsStoreLoad()
      const showRemote = disp.displayRemoteBranches === true
      const showTags = disp.displayTags === true
      const showMerge = showRemote && disp.mergeLocalRemote === true
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
        if (showMerge) {
          for (const r of commit.refs.remotes) {
            const slash = r.indexOf('/')
            if (slash <= 0) continue
            const branchName = r.slice(slash + 1)
            if (commit.refs.heads.includes(branchName)) {
              if (!remotesOfHead.has(branchName)) remotesOfHead.set(branchName, [])
              remotesOfHead.get(branchName).push(r.slice(0, slash))
            }
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
            if (remotes.length >= 2) {
              // ≥2 个远程：折叠为单个计数子标签（如 ⎇ main [2]）；完整远程引用
              // 列表提示放在整个 pill 上（悬停 pill 任意处即显示，无需对准小数字），
              // data-remotes 存完整列表供右键两级菜单使用。
              const sub = document.createElement('span')
              sub.className = 'dsc-gref-remote-sub'
              sub.textContent = String(remotes.length)
              sub.dataset.branch = r
              sub.dataset.remotes = JSON.stringify(remotes)
              b.appendChild(sub)
              const remoteTip = t('gitRemoteSubs', {
                branch: r,
                remotes: remotes.map((remote) => `${remote}/${r}`).join(', '),
              })
              b.title = r === currentBranch ? `${t('gitCurrentBranch')}\n${remoteTip}` : remoteTip
            } else {
              for (const remote of remotes) {
                const sub = document.createElement('span')
                sub.className = 'dsc-gref-remote-sub'
                sub.textContent = remote
                sub.dataset.branch = r
                sub.dataset.remote = remote
                b.appendChild(sub)
              }
            }
          }
          row.appendChild(b)
        }
        for (const r of commit.refs.remotes) {
          if (!showRemote) continue
          const slash = r.indexOf('/')
          if (showMerge && slash > 0 && commit.refs.heads.includes(r.slice(slash + 1))) continue
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-remote'
          b.textContent = r
          row.appendChild(b)
        }
        if (showTags) {
          for (const r of commit.refs.tags) {
            const b = document.createElement('span')
            b.className = 'dsc-gref dsc-gref-tag'
            b.textContent = r
            row.appendChild(b)
          }
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
          // 游离 HEAD 徽标：单个大写 H 省位置，悬停 title 提示完整语义
          b.textContent = 'H'
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
    // 后端原始行（含 stash 虚拟行等全部内容）；gitRows 为按「显示」设置过滤后的视图。
    // 开关切换时从原始行重过滤，无需重新 fetch。
    let gitRawRows = []
    let gitMoreAvailable = false
    // 按显示设置过滤行列表：stash 行（显示 stash 行=关 时剔除）。未提交改动行固定显示
    // （无开关）。显示设置切换（显示类）后重跑本函数 + renderGitGraph 即生效。
    // onlyFirstParent 开启时把每行 parents 截为第一父：--first-parent 只改 log 遍历顺序，
    // %P 字段仍含全部父；布局算法会把不在列表的第二父画成「从该 commit 向下伸出的悬空线」
    // 并多占泳道。截断后图只剩第一父链，符合「只跟随第一个父提交」的语义。
    const gitApplyRows = () => {
      const s = gitSettingsStoreLoad()
      const filtered = s.displayStashes === true ? gitRawRows : gitRawRows.filter((c) => c.stash === null)
      gitRows = s.onlyFirstParent === true
        ? filtered.map((c) => (c.parents.length > 1 ? { ...c, parents: c.parents.slice(0, 1) } : c))
        : filtered
    }
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
        // 日志选项（分区三「显示」）：仅跟随第一父（--first-parent）/ 包含 reflog 提交
        // （--reflog）改的是服务端 log 参数，切换后必须重拉才生效。
        const logPrefs = gitSettingsStoreLoad()
        const r = await fetch(`${BASE}/git/log?n=500&scope=${gitScopeValue}&follow=${logPrefs.onlyFirstParent === true ? 1 : 0}&reflogs=${logPrefs.includeReflogs === true ? 1 : 0}${sessionQuery()}`)
        const data = await r.json()
        if (data.error !== undefined) throw new Error(data.error)
        if (data.isRepo === false) {
          gitRows = []
          gitRawRows = []
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
        gitRawRows = data.commits
        gitApplyRows()
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

    /** tag 名客户端镜像（服务端 check-ref-format 权威）：空/超长/危险字符即时拦截。 */
    const validateTagName = (name) => {
      if (name === '') return 'empty'
      if (name.length > 200) return 'too-long'
      if (!/^[0-9A-Za-z._\/-]+$/.test(name)) return 'forbidden-char'
      if (name.startsWith('/') || name.startsWith('.') || name.endsWith('/') || name.endsWith('.') || name.includes('..') || name.includes('@{')) return 'forbidden-char'
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
    // opts.multi：多选模式（如 push remote 选择）——复选框样式，点击项切换选中
    // 状态（onToggle 须同步更新 item.checked）并保持菜单打开，点外部/Esc 关闭；
    // 普通模式点击项后关闭并执行 onClick。
    const gitCtxOpen = (x, y, items, opts = {}) => {
      gitCtxMenu.replaceChildren()
      for (const item of items) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.disabled = item.disabled === true
        if (opts.multi === true && typeof item.onToggle === 'function') {
          // 多选：原生复选框 + 文字（点击落在按钮上，checkbox 只作视觉）
          const cb = document.createElement('input')
          cb.type = 'checkbox'
          cb.checked = item.checked === true
          cb.style.pointerEvents = 'none'
          cb.style.flex = 'none'
          btn.appendChild(cb)
          btn.appendChild(document.createTextNode(item.label))
          btn.classList.add('dsc-ctx-multi')
        } else {
          btn.textContent = item.checked === true ? `✓ ${item.label}` : item.label
        }
        // stopPropagation：菜单项可能同步弹出确认框（删除分支），若不阻断冒泡，
        // document 级「点击外部关闭」监听会把刚弹出的确认框当作外部点击立即关掉
        // （异步弹出如切换确认不受影响——点击事件早已结束）。
        if (item.disabled !== true) btn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          if (opts.multi === true && typeof item.onToggle === 'function') {
            item.onToggle() // 约定：onToggle 同步更新 item.checked
            const cb = btn.querySelector('input[type="checkbox"]')
            if (cb !== null) cb.checked = item.checked === true
          } else {
            gitCtxClose()
            item.onClick()
          }
        })
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
    let gitConfirmJustOpened = false
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
      // 「刚打开」标志：本次 click 事件还在冒泡中（确认框由点击元素同步触发，
      // 如设置弹窗里点删除），document 的「点外部关闭」监听器会在同一事件里
      // 误判 target 不在框内而立即关闭刚弹出的确认框——跳过紧随的这一次。
      // 异步触发场景（POST 返回后弹框）无此问题，setTimeout 0 兜底清除。
      gitConfirmJustOpened = true
      setTimeout(() => { gitConfirmJustOpened = false }, 0)
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
      if (gitConfirmJustOpened) { gitConfirmJustOpened = false; return }
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

    // 远程分支操作菜单（独立蓝 pill 或本地分支内嵌远程子标签右键共用）：
    // 创建本地分支并检出 / 删除远程分支。fullRef 形如 gitee/main。
    const gitRemoteMenuOpen = (x, y, fullRef) => {
      const slash = fullRef.indexOf('/')
      const branchName = slash > 0 ? fullRef.slice(slash + 1) : fullRef
      const remoteName = slash > 0 ? fullRef.slice(0, slash) : fullRef
      gitCtxOpen(x, y, [
        {
          label: t('gitCreateFromRemote', { branch: branchName, remote: remoteName }),
          onClick: () => gitCheckout({ branch: branchName, remote: fullRef }),
        },
        {
          label: t('gitDeleteRemoteBranch', { branch: branchName }),
          onClick: () => gitConfirmOpen({
            title: t('gitDeleteRemoteBranch', { branch: branchName }),
            text: t('gitDeleteRemoteBranchConfirm', { remote: remoteName, branch: branchName }),
            okText: t('gitDeleteBtn'),
            danger: true,
            onOk: async () => {
              try {
                const result = await gitPost('/git/remote', { action: 'delete-branch', branch: branchName, remote: remoteName })
                flash(result.degraded === true
                  ? t('gitDeleteRemoteBranchDegraded')
                  : t('gitDeleteRemoteBranchOk', { remote: remoteName, branch: branchName }))
                gitFetch(true, true)
              } catch (err) {
                flash(gitErrText(err))
              }
            },
          }),
        },
      ])
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
        const row = ev.target.closest('[data-dsc-git-rows] [data-dsc-git-row]')
        if (row !== null) {
          if (row.dataset.hash === 'UNCOMMITTED') {
            // 未提交改动虚拟行右键：暂存未提交改动（上游 Uncommitted Context Menu 核心项）
            ev.preventDefault()
            ev.stopPropagation()
            gitCtxOpen(ev.clientX, ev.clientY, [{
              label: t('gitStashUncommitted'),
              onClick: () => gitStashBoxOpen(),
            }])
          } else if (row.dataset.hash !== '') {
            // 普通 commit 行右键：创建 tag / 新建分支（上游 Commit Context Menu：
            // Add Tag… 与 Create Branch…，均复用已有对话框）
            ev.preventDefault()
            ev.stopPropagation()
            const hash = row.dataset.hash
            gitCtxOpen(ev.clientX, ev.clientY, [
              {
                label: t('gitAddTag'),
                onClick: () => gitTagOpen(hash),
              },
              {
                label: t('gitCreateFromCommit', { hash: hash.slice(0, 7) }),
                onClick: () => gitCreateOpen({ start: hash }),
              },
            ])
          }
        }
        return
      }
      ev.preventDefault()
      ev.stopPropagation()
      const currentBranch = gitRows.find((c) => c.refs.isHead)?.refs.headName ?? null
      if (sub !== null || remote !== null) {
        if (sub !== null) {
          const branchName = sub.dataset.branch ?? (local?.firstChild?.textContent ?? '').trim()
          let remotes = null
          if (sub.dataset.remotes !== undefined) {
            try { remotes = JSON.parse(sub.dataset.remotes) } catch { remotes = null }
          }
          if (remotes !== null && remotes.length > 1) {
            // 折叠计数子标签（≥2 远程）：先选远程，再出该远程的操作菜单
            gitCtxOpen(ev.clientX, ev.clientY, remotes.map((remoteName) => ({
              label: `${remoteName}/${branchName}`,
              onClick: () => gitRemoteMenuOpen(ev.clientX, ev.clientY, `${remoteName}/${branchName}`),
            })))
            return
          }
          // 单远程子标签：直接出操作菜单（优先用 data 属性，兜底按原 DOM 拼法）
          const fullRef = sub.dataset.remote !== undefined
            ? `${sub.dataset.remote}/${branchName}`
            : `${branchName}/${sub.textContent.trim()}`
          gitRemoteMenuOpen(ev.clientX, ev.clientY, fullRef)
        } else {
          // 独立蓝 pill：完整 ref（remote/branch）即文本
          gitRemoteMenuOpen(ev.clientX, ev.clientY, (remote?.textContent ?? '').trim())
        }
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
    gitCreateBtn.classList.add('dsc-git-top-icon-btn')
    gitCreateBtn.innerHTML = GIT_ICON_CREATE
    gitCreateBtn.title = t('gitCreateTitle')
    gitCreateBtn.addEventListener('click', gitCreateOpen)
    // 插到刷新按钮之前：头部顺序 标题 / 状态徽标 / 范围▾ / ⇣拉取 / ＋新分支 / ↻ / ⚙设置 / 关闭
    gitHead.insertBefore(gitCreateBtn, gitRefresh)

    // ---------- 设置弹窗（头部 ⚙ → 浮层卡片） ----------
    // 首期区块：用户信息（git config user.name/email 两层读取 + 行内编辑 +
    // 徽标点击层级迁移 + 删除）。后续区块（远程配置/显示开关）同骨架扩展。
    const gitSettingsBtn = document.createElement('button')
    gitSettingsBtn.type = 'button'
    gitSettingsBtn.setAttribute('data-dsc-btn', '')
    gitSettingsBtn.classList.add('dsc-git-top-icon-btn')
    // 齿轮图标（iconfont 源 SVG 清理版）：fill 继承按钮文字色，display:block 保证
    // 在按钮内垂直居中（文本字符 ⚙ 在部分字体下会渲染成 emoji，SVG 稳定）
        gitSettingsBtn.innerHTML = '<svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor" style="vertical-align:middle;pointer-events:none" aria-hidden="true"><path d="M512 43.434667c-65.152 0-134.144 48.213333-141.824 128.981333a42.666667 42.666667 0 0 0-0.170666 0.341333c-3.626667 40.832-44.032 64.042667-81.194667 46.762667a42.666667 42.666667 0 0 0-0.426667-0.170667c-73.6-33.322667-149.632 2.218667-182.144 58.453334-32.469333 56.32-25.301333 139.989333 40.362667 187.093333a42.666667 42.666667 0 0 0 0.426667 0.256c33.493333 23.552 33.493333 70.058667 0 93.610667a42.666667 42.666667 0 0 0-0.384 0.256c-65.706667 47.104-72.96 130.858667-40.405334 187.136 32.512 56.32 108.586667 91.946667 182.272 58.496a42.666667 42.666667 0 0 0 0.426667-0.213334c37.12-17.365333 77.525333 5.973333 81.152 46.805334a42.666667 42.666667 0 0 0 0 0.256c7.68 80.725333 76.672 129.066667 141.824 129.066666s134.229333-48.341333 141.909333-129.066666a42.666667 42.666667 0 0 0 0-0.256c3.626667-40.832 43.946667-64.128 81.066667-46.848a42.666667 42.666667 0 0 0 0.426667 0.256c73.685333 33.450667 149.76-2.176 182.272-58.453334 32.512-56.32 25.344-140.074667-40.405334-187.178666a42.666667 42.666667 0 0 0-0.341333-0.256c-33.536-23.552-33.536-70.058667 0-93.610667a42.666667 42.666667 0 0 0 0.341333-0.256c65.706667-47.104 72.96-130.773333 40.405334-187.050667-32.512-56.32-108.586667-91.946667-182.272-58.496a42.666667 42.666667 0 0 0-0.426667 0.170667c-37.12 17.28-77.44-5.973333-81.066667-46.762667a42.666667 42.666667 0 0 0 0-0.341333c-7.68-80.725333-76.8-128.981333-141.909333-128.981333z m0 85.333333c28.544 0 53.12 11.946667 56.917333 51.712v-0.213333c8.576 97.109333 113.706667 157.738667 202.069334 116.565333l-0.298667 0.170667c36.266667-16.469333 58.88-1.152 73.130667 23.466666 14.250667 24.661333 16.128 51.925333-16.213334 75.093334l0.298667-0.213334c-79.786667 55.978667-79.786667 177.322667 0 233.301334l-0.341333-0.256c32.426667 23.210667 30.506667 50.474667 16.256 75.093333-14.208 24.661333-36.906667 39.893333-73.130667 23.466667l0.298667 0.128c-88.32-41.173333-193.493333 19.541333-202.069334 116.650666v-0.298666c-3.797333 39.765333-28.373333 51.797333-56.917333 51.797333s-53.12-12.032-56.917333-51.797333c-8.789333-96.938667-113.92-157.525333-202.154667-116.352l0.426667-0.170667c-36.266667 16.469333-58.965333 1.237333-73.173334-23.424-14.250667-24.618667-16.128-51.882667 16.213334-75.093333l-0.298667 0.256c79.786667-55.978667 79.786667-177.322667 0-233.301334l0.341333 0.256c-32.341333-23.210667-30.421333-50.389333-16.213333-75.008 14.250667-24.618667 36.906667-39.893333 73.088-23.509333l-0.426667-0.256c88.32 41.130667 193.28-19.328 202.112-116.266667a42.666667 42.666667 0 0 0 0.085334-0.085333c3.797333-39.765333 28.373333-51.712 56.917333-51.712z"/><path d="M512 341.333333c-93.738667 0-170.666667 76.928-170.666667 170.666667s76.928 170.666667 170.666667 170.666667 170.666667-76.928 170.666667-170.666667-76.928-170.666667-170.666667-170.666667z m0 85.333334c47.616 0 85.333333 37.717333 85.333333 85.333333s-37.717333 85.333333-85.333333 85.333333-85.333333-37.717333-85.333333-85.333333 37.717333-85.333333 85.333333-85.333333z"/></svg>'
    gitSettingsBtn.title = t('gitSettings')
    gitHead.insertBefore(gitSettingsBtn, gitClose)

    const gitSettingsBox = document.createElement('div')
    gitSettingsBox.setAttribute('data-dsc-git-settings', '')
    body.appendChild(gitSettingsBox)
    const gitSettingsTitle = document.createElement('div')
    gitSettingsTitle.className = 'dsc-git-settings-title'
    const gitSettingsTitleText = document.createElement('span')
    gitSettingsTitleText.textContent = `⚙ ${t('gitSettings')}`
    const gitSettingsTitleSpacer = document.createElement('span')
    gitSettingsTitleSpacer.className = 'spacer'
    const gitSettingsCloseBtn = document.createElement('button')
    gitSettingsCloseBtn.type = 'button'
    gitSettingsCloseBtn.setAttribute('data-dsc-btn', '')
    gitSettingsCloseBtn.textContent = t('close')
    gitSettingsTitle.appendChild(gitSettingsTitleText)
    gitSettingsTitle.appendChild(gitSettingsTitleSpacer)
    gitSettingsTitle.appendChild(gitSettingsCloseBtn)
    gitSettingsBox.appendChild(gitSettingsTitle)
    const gitSettingsBody = document.createElement('div')
    gitSettingsBox.appendChild(gitSettingsBody)

    // 用户信息状态：{ name: { local, global }, email: { local, global } }
    let gitUser = null
    let gitUserEditing = null // 'name' | 'email' | null（行内编辑中的字段）
    // 远程配置状态：{ name, url, pushUrl }[]；null = 未加载/非仓库
    let gitCfgRemotes = null
    let gitRemoteEditing = null // null | { mode:'add' } | { mode:'edit', index }
    let gitRemoteFetching = null // 拉取中的远程名（该行按钮禁用 + 文案变化）
    // 设置存储（localStorage，改动即应用）：显示/默认行为开关
    const GIT_SETTINGS_KEY = 'dsc-git-settings'
    const GIT_SETTINGS_DEFAULTS = {
      pruneOnFetch: true,
      displayStashes: true,
      displayTags: true,
      displayRemoteBranches: true,
      mergeLocalRemote: true,
      includeReflogs: false,
      onlyFirstParent: false,
      defaultScope: 'all',
    }
    let gitSettingsStore = null
    const gitSettingsStoreLoad = () => {
      if (gitSettingsStore !== null) return gitSettingsStore
      try {
        const raw = JSON.parse(localStorage.getItem(GIT_SETTINGS_KEY) ?? '{}')
        gitSettingsStore = { ...GIT_SETTINGS_DEFAULTS, ...(typeof raw === 'object' && raw !== null ? raw : {}) }
      } catch {
        gitSettingsStore = { ...GIT_SETTINGS_DEFAULTS }
      }
      return gitSettingsStore
    }
    const gitSettingsStoreSave = () => {
      try { localStorage.setItem(GIT_SETTINGS_KEY, JSON.stringify(gitSettingsStore)) } catch { /* 存储不可用时忽略 */ }
    }
    const gitUserLayerOf = (v) => (v.local !== null ? 'local' : v.global !== null ? 'global' : null)
    const gitUserValueOf = (v) => v.local ?? v.global
    const gitUserFieldLabel = (field) => t(field === 'name' ? 'gitUserName' : 'gitUserEmail')

    const gitSettingsClose = () => {
      gitSettingsBox.style.display = 'none'
      gitUserEditing = null
      gitRemoteEditing = null
    }
    // 同步渲染整个设置弹窗（用户信息 + 远程配置 + 默认行为）。所有操作（编辑/切换/
    // 保存/删除/拉取）都走这里——纯同步、无 fetch 间隙，避免「清空 → 等网络 → 重建」
    // 造成的闪烁与编辑态丢失。
    const gitSettingsRender = () => {
      gitSettingsBody.replaceChildren()
      if (gitUser === null) return // 未加载 / 非仓库（加载流程已放占位提示）
      // 用户信息区块
      const userTitle = document.createElement('div')
      userTitle.className = 'dsc-git-settings-section-title'
      userTitle.textContent = t('gitUserInfo')
      gitSettingsBody.appendChild(userTitle)
      for (const field of ['name', 'email']) {
        gitSettingsBody.appendChild(gitUserRow(field))
        if (gitUserEditing === field) gitSettingsBody.appendChild(gitUserEditBox(field))
      }
      // 远程配置区块
      const remoteTitle = document.createElement('div')
      remoteTitle.className = 'dsc-git-settings-section-title'
      remoteTitle.textContent = t('gitRemoteInfo')
      gitSettingsBody.appendChild(remoteTitle)
      gitSettingsBody.appendChild(gitRemoteSection())
      // 显示区块
      const displayTitle = document.createElement('div')
      displayTitle.className = 'dsc-git-settings-section-title'
      displayTitle.textContent = t('gitSettingsDisplay')
      gitSettingsBody.appendChild(displayTitle)
      gitSettingsBody.appendChild(gitDisplaySection())
      // 默认行为区块
      const defaultsTitle = document.createElement('div')
      defaultsTitle.className = 'dsc-git-settings-section-title'
      defaultsTitle.textContent = t('gitSettingsDefaults')
      gitSettingsBody.appendChild(defaultsTitle)
      gitSettingsBody.appendChild(gitDefaultPruneRow())
    }
    // 仅打开弹窗时拉取一次配置；之后所有操作直接用 POST 响应里的最新状态渲染
    const gitSettingsLoad = async () => {
      try {
        // sessionQuery() 返回 `&session=…`（带 & 前缀，供拼在已有 query 后）；
        // 本路由无其它 query，需先补 `?` 分隔符（否则整段被当路径 → 404）
        const r = await fetch(`${BASE}/git/config?${sessionQuery().replace(/^&/, '')}`)
        const data = await r.json().catch(() => null)
        if (data === null || data.ok !== true) throw { code: 'internal', message: t('gitUserConfigFailed') }
        if (data.isRepo === false) {
          gitUser = null
          gitCfgRemotes = null
          gitSettingsBody.replaceChildren()
          const note = document.createElement('div')
          note.className = 'dsc-git-user-value unset'
          note.textContent = t('gitNotRepo')
          gitSettingsBody.appendChild(note)
          return
        }
        gitUser = data.user
        gitCfgRemotes = Array.isArray(data.remotes) ? data.remotes : []
        gitSettingsRender()
      } catch (err) {
        gitSettingsBody.replaceChildren()
        const note = document.createElement('div')
        note.className = 'dsc-git-user-err'
        note.textContent = gitErrText(err)
        gitSettingsBody.appendChild(note)
      }
    }
    const gitUserSwitch = async (field, to) => {
      try {
        const data = await gitPost('/git/config', { action: 'switch-layer', field, to })
        gitUser = data.user
        // 徽标 Local↔Global 变化本身就是反馈；同步渲染不再弹 toast（避免"闪一下"）
        gitSettingsRender()
      } catch (err) {
        flash(gitErrText(err), 'error')
      }
    }
    // 单行渲染：label + 值（或未设置）+ 层级徽标（可点击迁移）+ 编辑/删除（或添加）
    const gitUserRow = (field) => {
      const row = document.createElement('div')
      row.className = 'dsc-git-user-row'
      const label = document.createElement('span')
      label.className = 'dsc-git-user-label'
      label.textContent = gitUserFieldLabel(field)
      row.appendChild(label)
      const v = gitUser[field]
      const layer = gitUserLayerOf(v)
      const value = document.createElement('span')
      value.className = 'dsc-git-user-value'
      if (layer === null) {
        // 空态：灰字 + 「＋ 添加」（点开行内编辑，写入层级二选一）
        value.textContent = t('gitUserNotSet')
        value.classList.add('unset')
        row.appendChild(value)
        const addBtn = document.createElement('button')
        addBtn.type = 'button'
        addBtn.setAttribute('data-dsc-btn', '')
        addBtn.textContent = `＋ ${t('gitUserAdd')}`
        addBtn.addEventListener('click', () => {
          gitUserEditing = gitUserEditing === field ? null : field
          gitRemoteEditing = null // 互斥：收起远程编辑块
          gitSettingsRender()
        })
        row.appendChild(addBtn)
        return row
      }
      value.textContent = gitUserValueOf(v)
      value.title = gitUserValueOf(v)
      row.appendChild(value)
      // 层级徽标 = 切换器：Local→Global 移动 / Global→Local 复制；目标层有不同值先确认
      const badge = document.createElement('span')
      badge.className = `dsc-git-user-layer ${layer}`
      badge.textContent = layer === 'local' ? t('gitUserLocal') : t('gitUserGlobal')
      badge.title = layer === 'local' ? t('gitUserSwitchToGlobal') : t('gitUserSwitchToLocal')
      badge.addEventListener('click', () => {
        const to = layer === 'local' ? 'global' : 'local'
        const target = to === 'local' ? v.local : v.global
        if (target !== null && target !== gitUserValueOf(v)) {
          gitConfirmOpen({
            title: t('gitUserSwitchTitle'),
            text: t('gitUserSwitchConfirm'),
            okText: t('gitUserSwitchAnyway'),
            danger: true,
            onOk: () => gitUserSwitch(field, to),
          })
          return
        }
        gitUserSwitch(field, to)
      })
      row.appendChild(badge)
      const editBtn = document.createElement('button')
      editBtn.type = 'button'
      editBtn.setAttribute('data-dsc-btn', '')
      editBtn.textContent = t('gitUserEdit')
      editBtn.addEventListener('click', () => {
        gitUserEditing = gitUserEditing === field ? null : field
        gitRemoteEditing = null // 互斥：收起远程编辑块
        gitSettingsRender()
      })
      row.appendChild(editBtn)
      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.setAttribute('data-dsc-btn', '')
      delBtn.textContent = t('gitUserDelete')
      delBtn.addEventListener('click', () => {
        gitConfirmOpen({
          title: gitUserFieldLabel(field),
          text: t('gitUserDeleteConfirm'),
          okText: t('gitUserDelete'),
          danger: true,
          onOk: async () => {
            try {
              const data = await gitPost('/git/config', { action: 'delete', location: layer, field })
              gitUser = data.user
              gitUserEditing = null // 删除后字段值可能变化，收起编辑态
              gitSettingsRender()
              flash(t('gitUserDeleteOk'))
            } catch (err) {
              flash(gitErrText(err), 'error')
            }
          },
        })
      })
      row.appendChild(delBtn)
      return row
    }
    // 行内编辑块：编辑态（写入层 = 当前徽标层，提示文字）/ 添加态（本仓库|全局 二选一）
    const gitUserEditBox = (field) => {
      const box = document.createElement('div')
      box.className = 'dsc-git-user-edit'
      const v = gitUser[field]
      const layer = gitUserLayerOf(v)
      const isAdd = layer === null
      const input = document.createElement('input')
      input.type = 'text'
      input.placeholder = t('gitUserEditPlaceholder', { field: gitUserFieldLabel(field) })
      input.value = isAdd ? '' : gitUserValueOf(v)
      box.appendChild(input)
      // 保存/取消与输入框同一行（紧贴右侧）；层级提示/二选一和错误提示在下一行
      const actions = document.createElement('div')
      actions.className = 'dsc-git-opt-actions'
      const save = document.createElement('button')
      save.type = 'button'
      save.setAttribute('data-dsc-btn', '')
      save.textContent = t('gitUserSave')
      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.setAttribute('data-dsc-btn', '')
      cancel.textContent = t('gitCancel')
      actions.appendChild(save)
      actions.appendChild(cancel)
      box.appendChild(actions)
      let targetLayer = isAdd ? 'local' : layer
      if (isAdd) {
        // 添加态没有层级徽标可参照，需要二选一（本仓库|全局）
        const layerGroup = document.createElement('div')
        layerGroup.className = 'dsc-git-user-layers'
        for (const [key, label] of [['local', t('gitUserLocalRepo')], ['global', t('gitUserGlobalRepo')]]) {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'dsc-git-toggle' + (targetLayer === key ? ' on' : '')
          btn.textContent = label
          btn.addEventListener('click', () => {
            targetLayer = key
            for (const b of layerGroup.querySelectorAll('button')) b.classList.toggle('on', b === btn)
          })
          layerGroup.appendChild(btn)
        }
        box.appendChild(layerGroup)
      }
      // 编辑态无需提示：写入层 = 该行徽标所示层（Local/Global 直接可见）
      const err = document.createElement('div')
      err.className = 'dsc-git-user-err'
      box.appendChild(err)
      const run = async () => {
        const value = input.value.trim()
        save.disabled = true
        try {
          const data = await gitPost('/git/config', {
            action: 'set',
            location: targetLayer,
            name: field === 'name' ? value : null,
            email: field === 'email' ? value : null,
          })
          gitUser = data.user
          gitUserEditing = null // 保存成功收起编辑态
          gitSettingsRender()
          flash(t('gitUserSaveOk'))
        } catch (e) {
          err.textContent = gitErrText(e)
          save.disabled = false
        }
      }
      save.addEventListener('click', run)
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') run()
        if (ev.key === 'Escape') { gitUserEditing = null; gitSettingsRender() }
      })
      cancel.addEventListener('click', () => { gitUserEditing = null; gitSettingsRender() })
      input.focus()
      return box
    }

    // ---------- 远程配置区块（设置弹窗） ----------
    // 列表（名称+URL / push 说明 / 操作按钮）+ 行内拉取 + 添加/编辑共用三字段表单
    // + 删除确认；全部同步重渲染，POST 响应喂最新 remotes 状态。
    const gitRemoteFetchOne = async (name) => {
      gitRemoteFetching = name
      gitSettingsRender()
      try {
        await gitPost('/git/fetch', { remote: name, prune: gitSettingsStoreLoad().pruneOnFetch === true })
        flash(t('gitRemoteFetchOk', { name }))
      } catch (err) {
        flash(gitErrText(err), 'error')
      } finally {
        gitRemoteFetching = null
        gitSettingsRender()
        // fetch 只更新远程跟踪 ref（SSE 状态键不含 refs/remotes），显式刷新图
        gitFetch(true, true)
      }
    }
    const gitRemoteDelete = (name) => {
      gitConfirmOpen({
        title: t('gitRemoteDeleteTitle'),
        text: t('gitRemoteDeleteConfirm', { name }),
        okText: t('gitUserDelete'),
        danger: true,
        onOk: async () => {
          try {
            const data = await gitPost('/git/remote', { action: 'delete-remote', name })
            gitCfgRemotes = data.remotes
            gitRemoteEditing = null
            gitSettingsRender()
            flash(t('gitRemoteDeleteOk'))
            gitFetch(true, true) // 远程分支随删除消失，图立即更新
          } catch (err) {
            flash(gitErrText(err), 'error')
          }
        },
      })
    }
    const gitRemoteSection = () => {
      const wrap = document.createElement('div')
      const remotes = gitCfgRemotes ?? []
      if (remotes.length === 0) {
        const none = document.createElement('div')
        none.className = 'dsc-git-remote-none'
        none.textContent = t('gitRemoteNone')
        wrap.appendChild(none)
      } else {
        remotes.forEach((remote, index) => {
          wrap.appendChild(gitRemoteRow(remote, index))
          if (gitRemoteEditing !== null && gitRemoteEditing.mode === 'edit' && gitRemoteEditing.index === index) {
            wrap.appendChild(gitRemoteEditBox(gitRemoteEditing))
          }
        })
      }
      // 添加按钮（点击展开添加表单，互斥：收起用户信息编辑块）
      if (gitRemoteEditing !== null && gitRemoteEditing.mode === 'add') {
        wrap.appendChild(gitRemoteEditBox(gitRemoteEditing))
      } else {
        const addBtn = document.createElement('button')
        addBtn.type = 'button'
        addBtn.setAttribute('data-dsc-btn', '')
        addBtn.textContent = `＋ ${t('gitRemoteAdd')}`
        addBtn.addEventListener('click', () => {
          gitUserEditing = null
          gitRemoteEditing = { mode: 'add' }
          gitSettingsRender()
        })
        wrap.appendChild(addBtn)
      }
      return wrap
    }
    const gitRemoteRow = (remote, index) => {
      const row = document.createElement('div')
      row.className = 'dsc-git-remote-row'
      // 主区一行：名称 + 两行信息 + 右侧按钮组（拉取 / 编辑 / 删除，拉取在最前），
      // 名称与按钮相对两行信息整体垂直居中
      const main = document.createElement('div')
      main.className = 'dsc-git-remote-main'
      const name = document.createElement('span')
      name.className = 'dsc-git-remote-name'
      name.textContent = remote.name
      name.title = remote.name
      const info = document.createElement('div')
      info.className = 'dsc-git-remote-info'
      const url = document.createElement('div')
      url.className = 'dsc-git-remote-url'
      url.textContent = remote.url ?? ''
      url.title = remote.url ?? ''
      const push = document.createElement('div')
      push.className = 'dsc-git-remote-push'
      push.textContent = remote.pushUrl ?? t('gitRemotePushSame')
      push.title = remote.pushUrl ?? ''
      info.appendChild(url)
      info.appendChild(push)
      main.appendChild(name)
      main.appendChild(info)
      // 右侧按钮组：拉取（组内最前）/ 编辑 / 删除
      const actions = document.createElement('div')
      actions.className = 'dsc-git-remote-actions'
      const fetching = gitRemoteFetching === remote.name
      const fetchBtn = document.createElement('button')
      fetchBtn.type = 'button'
      fetchBtn.setAttribute('data-dsc-btn', '')
      fetchBtn.className = 'dsc-git-remote-icon-btn' + (fetching ? ' dsc-git-remote-spin' : '')
      fetchBtn.title = fetching ? t('gitRemoteFetching') : t('gitRemoteFetch')
      fetchBtn.disabled = fetching
      fetchBtn.innerHTML = GIT_ICON_FETCH
      fetchBtn.addEventListener('click', () => gitRemoteFetchOne(remote.name))
      actions.appendChild(fetchBtn)
      const editBtn = document.createElement('button')
      editBtn.type = 'button'
      editBtn.setAttribute('data-dsc-btn', '')
      editBtn.className = 'dsc-git-remote-icon-btn'
      editBtn.title = t('gitUserEdit')
      editBtn.innerHTML = GIT_ICON_EDIT
      editBtn.addEventListener('click', () => {
        gitUserEditing = null
        const open = gitRemoteEditing !== null && gitRemoteEditing.mode === 'edit' && gitRemoteEditing.index === index
        gitRemoteEditing = open ? null : { mode: 'edit', index }
        gitSettingsRender()
      })
      actions.appendChild(editBtn)
      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.setAttribute('data-dsc-btn', '')
      delBtn.className = 'dsc-git-remote-icon-btn danger'
      delBtn.title = t('gitUserDelete')
      delBtn.innerHTML = GIT_ICON_DELETE
      delBtn.addEventListener('click', () => gitRemoteDelete(remote.name))
      actions.appendChild(delBtn)
      main.appendChild(actions)
      row.appendChild(main)
      return row
    }
    // 添加/编辑共用三字段表单：名称 / Fetch URL / Push URL（留空 = 清除 push URL）
    const gitRemoteEditBox = (editing) => {
      const box = document.createElement('div')
      box.className = 'dsc-git-remote-edit'
      const isAdd = editing.mode === 'add'
      const current = isAdd ? null : gitCfgRemotes[editing.index]
      const inputs = {}
      const fields = [
        { key: 'name', label: t('gitRemoteName'), value: isAdd ? '' : current.name, placeholder: '' },
        { key: 'url', label: t('gitRemoteFetchUrl'), value: isAdd ? '' : (current.url ?? ''), placeholder: '' },
        { key: 'pushUrl', label: t('gitRemotePushUrl'), value: isAdd ? '' : (current.pushUrl ?? ''), placeholder: t('gitRemotePushSame') },
      ]
      for (const f of fields) {
        const line = document.createElement('div')
        line.className = 'dsc-git-remote-field'
        const label = document.createElement('label')
        label.textContent = f.label
        const input = document.createElement('input')
        input.type = 'text'
        input.value = f.value
        if (f.placeholder !== '') input.placeholder = f.placeholder
        inputs[f.key] = input
        line.appendChild(label)
        line.appendChild(input)
        box.appendChild(line)
      }
      const actions = document.createElement('div')
      actions.className = 'dsc-git-opt-actions'
      const save = document.createElement('button')
      save.type = 'button'
      save.setAttribute('data-dsc-btn', '')
      save.textContent = t('gitUserSave')
      const cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.setAttribute('data-dsc-btn', '')
      cancel.textContent = t('gitCancel')
      actions.appendChild(save)
      actions.appendChild(cancel)
      box.appendChild(actions)
      const err = document.createElement('div')
      err.className = 'dsc-git-remote-err'
      box.appendChild(err)
      const run = async () => {
        const name = inputs.name.value.trim()
        const url = inputs.url.value.trim()
        const pushUrl = inputs.pushUrl.value.trim()
        if (name === '') { err.textContent = t('gitErrInvalidRemoteName'); return }
        if (url === '') { err.textContent = t('gitErrInvalidRemoteUrl'); return }
        save.disabled = true
        try {
          const data = await gitPost('/git/remote', {
            action: isAdd ? 'add-remote' : 'edit-remote',
            name: isAdd ? name : current.name,
            newName: isAdd ? '' : name,
            url,
            pushUrl,
          })
          gitCfgRemotes = data.remotes
          gitRemoteEditing = null
          gitSettingsRender()
          flash(isAdd ? t('gitRemoteAddOk') : t('gitRemoteSaveOk'))
          gitFetch(true, true) // 远程名/URL 变化影响图（远程分支前缀、拉取按钮显隐）
        } catch (e) {
          err.textContent = gitErrText(e)
          save.disabled = false
        }
      }
      save.addEventListener('click', run)
      cancel.addEventListener('click', () => { gitRemoteEditing = null; gitSettingsRender() })
      for (const input of Object.values(inputs)) {
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') run()
          if (ev.key === 'Escape') { gitRemoteEditing = null; gitSettingsRender() }
        })
      }
      inputs.name.focus()
      return box
    }
    // 显示区块（分区三）：网格布局 + 颜色状态按钮（.dsc-git-toggle.on 高亮，同
    // Local/Global 切换，不再用 ☑/☐ 勾选）；提示全部走 hover title（无 ? 字符）。
    // 日志选项（reflogs / first-parent）改的是服务端 log 参数 → 切换后重拉图；
    // 其余显示开关只看本地渲染 → 重过滤/重渲染即生效。
    const gitDisplayRow = (key, labelKey, hintKey, needsFetch) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'dsc-git-toggle' + (gitSettingsStoreLoad()[key] === true ? ' on' : '')
      btn.textContent = t(labelKey)
      btn.title = t(hintKey)
      btn.addEventListener('click', () => {
        gitSettingsStore = { ...gitSettingsStoreLoad(), [key]: !gitSettingsStoreLoad()[key] }
        gitSettingsStoreSave()
        gitSettingsRender()
        if (needsFetch) {
          gitFetch(false) // 日志参数变化：重拉
        } else {
          if (key === 'displayStashes') gitApplyRows() // 行级过滤（stash 虚拟行）
          renderGitGraph()
        }
      })
      return btn
    }
    const gitDisplaySection = () => {
      const wrap = document.createElement('div')
      wrap.className = 'dsc-git-display-grid'
      wrap.appendChild(gitDisplayRow('displayStashes', 'gitDisplayStashes', 'gitDisplayStashesHint', false))
      wrap.appendChild(gitDisplayRow('displayTags', 'gitDisplayTags', 'gitDisplayTagsHint', false))
      wrap.appendChild(gitDisplayRow('displayRemoteBranches', 'gitDisplayRemoteBranches', 'gitDisplayRemoteBranchesHint', false))
      wrap.appendChild(gitDisplayRow('mergeLocalRemote', 'gitDisplayMergeRefs', 'gitDisplayMergeRefsHint', false))
      wrap.appendChild(gitDisplayRow('includeReflogs', 'gitDisplayReflogs', 'gitDisplayReflogsHint', true))
      wrap.appendChild(gitDisplayRow('onlyFirstParent', 'gitDisplayFirstParent', 'gitDisplayFirstParentHint', true))
      // 打开时默认范围：自绘下拉（复用头部范围切换的菜单组件，候选值同为 all/head）。
      // 改动即应用：保存 + 当前打开的图立即按新范围刷新（下次打开面板同样生效）。
      const scopeRow = document.createElement('div')
      scopeRow.className = 'dsc-git-default-row'
      const scopeLabel = document.createElement('span')
      scopeLabel.textContent = t('gitDisplayDefaultScope')
      scopeLabel.style.opacity = '.85'
      const scopeBtn = document.createElement('button')
      scopeBtn.type = 'button'
      scopeBtn.setAttribute('data-dsc-btn', '')
      const scopeLabelOf = (v) => (v === 'head' ? t('gitHead') : t('gitAll'))
      scopeBtn.textContent = `${scopeLabelOf(gitSettingsStoreLoad().defaultScope)} ▾`
      scopeBtn.style.marginLeft = 'auto'
      scopeBtn.addEventListener('click', (ev) => {
        const rect = scopeBtn.getBoundingClientRect()
        gitCtxOpen(rect.left, rect.bottom + 4, [
          { label: t('gitAll'), checked: gitSettingsStoreLoad().defaultScope === 'all', onClick: () => gitDisplayPickScope('all') },
          { label: t('gitHead'), checked: gitSettingsStoreLoad().defaultScope === 'head', onClick: () => gitDisplayPickScope('head') },
        ])
        ev.stopPropagation()
      })
      const gitDisplayPickScope = (v) => {
        if (gitSettingsStoreLoad().defaultScope !== v) {
          gitSettingsStore = { ...gitSettingsStoreLoad(), defaultScope: v }
          gitSettingsStoreSave()
          gitSettingsRender()
        }
        if (gitScopeValue !== v) {
          gitScopeValue = v
          gitScopeBtn.textContent = `${scopeLabelOf(v)} ▾`
          gitFetch(false)
        }
      }
      scopeRow.appendChild(scopeLabel)
      scopeRow.appendChild(scopeBtn)
      wrap.appendChild(scopeRow)
      return wrap
    }
    // 默认行为区块：拉取自动修剪开关（改动即应用，localStorage 持久化）
    const gitDefaultPruneRow = () => {
      const row = document.createElement('div')
      row.className = 'dsc-git-default-row'
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'dsc-git-toggle' + (gitSettingsStoreLoad().pruneOnFetch === true ? ' on' : '')
      toggle.textContent = t('gitDefaultPruneFetch')
      toggle.addEventListener('click', () => {
        gitSettingsStore = { ...gitSettingsStoreLoad(), pruneOnFetch: !gitSettingsStoreLoad().pruneOnFetch }
        gitSettingsStoreSave()
        gitSettingsRender()
      })
      row.appendChild(toggle)
      const hint = document.createElement('span')
      hint.className = 'dsc-git-default-hint'
      hint.textContent = '?'
      hint.title = t('gitDefaultPruneFetchHint')
      row.appendChild(hint)
      return row
    }

    const gitSettingsOpen = () => {
      gitSettingsBox.style.display = 'block'
      const headRect = gitHead.getBoundingClientRect()
      gitSettingsBox.style.left = `${Math.min(headRect.left, window.innerWidth - 340)}px`
      gitSettingsBox.style.top = `${headRect.bottom + 6}px`
      gitSettingsLoad()
    }
    gitSettingsBtn.addEventListener('click', () => {
      if (gitSettingsBox.style.display !== 'none') gitSettingsClose()
      else gitSettingsOpen()
    })
    gitSettingsCloseBtn.addEventListener('click', gitSettingsClose)
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && gitSettingsBox.style.display !== 'none'
        && gitCtxMenu.style.display === 'none' && gitConfirmBox.style.display === 'none') {
        gitSettingsClose()
      }
    })
    document.addEventListener('click', (ev) => {
      if (gitSettingsBox.style.display === 'none') return
      // 用 composedPath（事件分发时确定的传播路径）而非 contains(ev.target)：
      // 弹窗内操作（如点编辑）会同步重建 DOM，ev.target 已被移除时 contains 返回
      // false，误判为外部点击而关闭弹窗。composedPath 不受后续 DOM 移除影响。
      // 豁免范围：弹窗自身、⚙ 按钮、确认框（confirm 的按钮点击也是弹窗交互链）。
      const path = ev.composedPath()
      if (path.includes(gitSettingsBox) || path.includes(gitSettingsBtn) || path.includes(gitConfirmBox)) return
      gitSettingsClose()
    })

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
    let gitPushRemotes = []
    // remote 选择记忆（localStorage，同 dsc-git-pos 模式）：上次推送的远程组合
    // 下次打开对话框时恢复；远程被删/改名时过滤失效项，全部失效回退默认。
    const gitPushRemotesKey = 'dsc-git-push-remotes'
    const gitPushRemotesSave = () => {
      try { localStorage.setItem(gitPushRemotesKey, JSON.stringify(gitPushRemotes)) } catch { /* ignore */ }
    }
    const gitPushRemotesLoad = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(gitPushRemotesKey) ?? 'null')
        if (Array.isArray(raw)) return raw.filter((r) => typeof r === 'string')
      } catch { /* ignore */ }
      return null
    }
    const gitPushClose = () => { gitPushBox.style.display = 'none' }
    const gitPushOpen = (branchName) => {
      gitPushBranch = branchName
      // 记忆的远程组合（仅保留当前仍存在的远程，按 gitRemotes 顺序）；
      // 无记忆或全部失效 → 回退默认 origin（存在时）或第一个远程
      const saved = gitPushRemotesLoad()
      gitPushRemotes = saved !== null && saved.length > 0
        ? gitRemotes.filter((r) => saved.includes(r))
        : []
      if (gitPushRemotes.length === 0) {
        gitPushRemotes = gitRemotes.includes('origin') ? ['origin'] : [gitRemotes[0] ?? ''].filter((r) => r !== '')
      }
      if (gitPushRemotes.length === 0) return // 无远程不应触发（菜单项已按 remotes>0 显示）
      gitPushTitle.textContent = t('gitPushTitle', { branch: branchName })
      gitPushRemoteBtn.textContent = gitPushRemotes.join(', ')
      gitPushUpstreamToggle.classList.add('on')
      for (const b of gitPushModeBtns) b.classList.toggle('on', b.dataset.mode === 'normal')
      // 上次推送成功后按钮被禁用（防重复提交）；再次打开必须重置，否则按钮永久失效
      gitPushSubmit.disabled = false
      gitPushBox.style.display = 'block'
      const headRect = gitHead.getBoundingClientRect()
      gitPushBox.style.left = `${Math.min(headRect.left, window.innerWidth - 280)}px`
      gitPushBox.style.top = `${headRect.bottom + 6}px`
    }
    gitPushRemoteBtn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const rect = gitPushRemoteBtn.getBoundingClientRect()
      // 多选模式（复选框）：点击切换勾选、菜单保持打开；点外部/Esc 关闭
      // （对齐上游 Push to Remote(s) 多选 + 顺序推）。item 自引用：
      // onToggle 同步更新 item.checked，供 gitCtxOpen 刷新复选框状态。
      gitCtxOpen(rect.left, rect.bottom + 4, gitRemotes.map((r) => {
        const item = {
          label: r,
          checked: gitPushRemotes.includes(r),
          onToggle: () => {
            gitPushRemotes = gitPushRemotes.includes(r)
              ? gitPushRemotes.filter((x) => x !== r)
              : [...gitPushRemotes, r]
            item.checked = gitPushRemotes.includes(r)
            gitPushRemoteBtn.textContent = gitPushRemotes.join(', ')
            gitPushRemotesSave() // 切换即记忆
          },
        }
        return item
      }), { multi: true })
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
          remotes: gitPushRemotes,
          setUpstream: gitPushUpstreamToggle.classList.contains('on'),
          mode,
        })
        gitPushClose()
        flash(t('gitPushOk', { branch: gitPushBranch, remote: gitPushRemotes.join(', ') }))
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

    // ---------- 创建 tag 对话框（镜像上游 Add Tag 对话框：名称 + 类型 + message + 推送远程） ----------
    // 入口：右键 commit 行「创建 tag…」。类型二选一（附注默认，同上游 dialogDefaults.addTag.type），
    // 附注时显示备注输入；推送目标为底部左侧下拉多选（镜像 push 对话框 remote 多选菜单：
    // 第一项「不推送」，其后各远程可多选，同上游 pushTagToMultipleRemotes 语义），
    // 无远程时隐藏；同名 tag 服务端权威返回 tag-already-exists → 「替换？」确认框后
    // 带 force 重试（上游两按钮语义）。
    const gitTagBox = document.createElement('div')
    gitTagBox.setAttribute('data-dsc-git-tag', '')
    body.appendChild(gitTagBox)
    const gitTagHead = document.createElement('div')
    gitTagHead.className = 'dsc-git-tag-head'
    const gitTagTitle = document.createElement('div')
    gitTagTitle.className = 'dsc-git-tag-title'
    const gitTagCancel = document.createElement('button')
    gitTagCancel.type = 'button'
    gitTagCancel.setAttribute('data-dsc-btn', '')
    gitTagCancel.textContent = t('close')
    gitTagHead.appendChild(gitTagTitle)
    gitTagHead.appendChild(gitTagCancel)
    const gitTagInput = document.createElement('input')
    gitTagInput.type = 'text'
    gitTagInput.placeholder = t('gitAddTagPlaceholder')
    const gitTagTypeRow = document.createElement('div')
    gitTagTypeRow.className = 'dsc-git-opt-row'
    const gitTagTypeLabel = document.createElement('label')
    gitTagTypeLabel.textContent = t('gitTagType')
    gitTagTypeRow.appendChild(gitTagTypeLabel)
    const gitTagTypeGroup = document.createElement('div')
    gitTagTypeGroup.className = 'dsc-git-opt-group'
    const gitTagTypeBtns = [
      { type: 'annotated', text: t('gitTagTypeAnnotated') },
      { type: 'lightweight', text: t('gitTagTypeLightweight') },
    ].map(({ type, text }) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'dsc-git-toggle' + (type === 'annotated' ? ' on' : '')
      btn.dataset.type = type
      btn.textContent = text
      btn.addEventListener('click', () => {
        gitTagType = type
        for (const b of gitTagTypeBtns) b.classList.toggle('on', b.dataset.type === gitTagType)
        gitTagMessageRow.style.display = type === 'annotated' ? '' : 'none'
      })
      gitTagTypeGroup.appendChild(btn)
      return btn
    })
    gitTagTypeRow.appendChild(gitTagTypeGroup)
    const gitTagMessageRow = document.createElement('div')
    gitTagMessageRow.className = 'dsc-git-opt-row'
    const gitTagMessageInput = document.createElement('input')
    gitTagMessageInput.type = 'text'
    gitTagMessageInput.placeholder = t('gitTagMessagePlaceholder')
    gitTagMessageRow.appendChild(gitTagMessageInput)
    const gitTagErr = document.createElement('div')
    gitTagErr.setAttribute('data-dsc-git-create-err', '')
    const gitTagActions = document.createElement('div')
    gitTagActions.className = 'dsc-git-tag-actions'
    // 推送目标下拉多选（镜像 push 对话框的 remote 多选菜单形态）：按钮显示当前选择
    // （「不推送」或远程列表），点击弹出多选菜单；第一项固定「不推送」（勾选 = 清空
    // 远程选择），其后每远程一项可多选，全不勾 = 不推送。远程再多也不挤占对话框宽度。
    const gitTagPushLabel = document.createElement('span')
    gitTagPushLabel.className = 'dsc-git-tag-push-label'
    gitTagPushLabel.textContent = t('gitPushTo')
    const gitTagRemoteBtn = document.createElement('button')
    gitTagRemoteBtn.type = 'button'
    gitTagRemoteBtn.className = 'dsc-git-toggle'
    gitTagRemoteBtn.textContent = t('gitNoPush')
    gitTagRemoteBtn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const rect = gitTagRemoteBtn.getBoundingClientRect()
      // 自引用 item（同 push 对话框模式）：gitCtxOpen 的 multi 刷新约定是
      // onToggle 必须同步更新 item.checked，勾选才会按 item.checked 重画。
      const noPushItem = {
        label: t('gitNoPush'),
        checked: gitTagRemotes.length === 0,
        onToggle: () => {
          gitTagRemotes = []
          noPushItem.checked = true
          // multi 模式只刷新被点项，这里同步清掉菜单里所有远程项勾选
          gitCtxMenu.querySelectorAll('button.dsc-ctx-multi').forEach((b, i) => {
            const cb = b.querySelector('input[type="checkbox"]')
            if (cb !== null && i > 0) cb.checked = false
          })
          gitTagRemoteBtn.textContent = t('gitNoPush')
        },
      }
      const remoteItems = gitRemotes.map((r) => {
        const item = {
          label: r,
          checked: gitTagRemotes.includes(r),
          onToggle: () => {
            gitTagRemotes = gitTagRemotes.includes(r)
              ? gitTagRemotes.filter((x) => x !== r)
              : [...gitTagRemotes, r]
            item.checked = gitTagRemotes.includes(r)
            // 勾选任一远程 → 「不推送」取消勾选（第一项）；全部取消 → 回到不推送
            gitCtxMenu.querySelectorAll('button.dsc-ctx-multi').forEach((b, i) => {
              const cb = b.querySelector('input[type="checkbox"]')
              if (cb !== null && i === 0) cb.checked = gitTagRemotes.length === 0
            })
            gitTagRemoteBtn.textContent = gitTagRemotes.length === 0 ? t('gitNoPush') : gitTagRemotes.join(', ')
          },
        }
        return item
      })
      gitCtxOpen(rect.left, rect.bottom + 4, [noPushItem, ...remoteItems], { multi: true })
    })
    const gitTagSubmit = document.createElement('button')
    gitTagSubmit.type = 'button'
    gitTagSubmit.setAttribute('data-dsc-btn', '')
    gitTagSubmit.textContent = t('gitAddTagSubmit')
    gitTagActions.appendChild(gitTagPushLabel)
    gitTagActions.appendChild(gitTagRemoteBtn)
    gitTagActions.appendChild(gitTagSubmit)
    gitTagBox.appendChild(gitTagHead)
    gitTagBox.appendChild(gitTagInput)
    gitTagBox.appendChild(gitTagTypeRow)
    gitTagBox.appendChild(gitTagMessageRow)
    gitTagBox.appendChild(gitTagErr)
    gitTagBox.appendChild(gitTagActions)
    let gitTagHash = ''
    let gitTagType = 'annotated'
    let gitTagRemotes = []
    let gitTagForce = false
    const gitTagClose = () => { gitTagBox.style.display = 'none' }
    const gitTagOpen = (hash) => {
      gitTagHash = hash
      gitTagType = 'annotated'
      gitTagRemotes = []
      gitTagForce = false
      gitTagTitle.textContent = t('gitAddTagTitle', { hash: hash.slice(0, 7) })
      gitTagInput.value = ''
      gitTagMessageInput.value = ''
      for (const b of gitTagTypeBtns) b.classList.toggle('on', b.dataset.type === gitTagType)
      gitTagMessageRow.style.display = ''
      // 推送目标下拉：无远程时隐藏；重置为「不推送」（全不勾）
      gitTagPushLabel.style.display = gitRemotes.length > 0 ? '' : 'none'
      gitTagRemoteBtn.style.display = gitRemotes.length > 0 ? '' : 'none'
      gitTagRemoteBtn.textContent = t('gitNoPush')
      gitTagErr.textContent = t('gitAddTagPrompt')
      gitTagErr.classList.add('hint')
      gitTagSubmit.disabled = true
      gitTagBox.style.display = 'block'
      const headRect = gitHead.getBoundingClientRect()
      gitTagBox.style.left = `${Math.min(headRect.left, window.innerWidth - 280)}px`
      gitTagBox.style.top = `${headRect.bottom + 6}px`
      gitTagInput.focus()
    }
    gitTagInput.addEventListener('input', () => {
      const reason = validateTagName(gitTagInput.value.trim())
      if (reason === null) {
        gitTagErr.textContent = ''
        gitTagErr.classList.remove('hint')
      } else if (reason === 'empty') {
        // 清空后回到初始提示态
        gitTagErr.textContent = t('gitAddTagPrompt')
        gitTagErr.classList.add('hint')
      } else {
        gitTagErr.textContent = t('gitErrInvalidTagName')
        gitTagErr.classList.remove('hint')
      }
      gitTagSubmit.disabled = reason !== null
    })
    const gitTagRun = async () => {
      const name = gitTagInput.value.trim()
      if (validateTagName(name) !== null) return
      gitTagSubmit.disabled = true
      try {
        const result = await gitPost('/git/remote', {
          action: 'add-tag',
          tag: name,
          hash: gitTagHash,
          type: gitTagType,
          message: gitTagType === 'annotated' ? gitTagMessageInput.value : '',
          remotes: gitTagRemotes,
          force: gitTagForce,
        })
        const pushed = Array.isArray(result.pushed) ? result.pushed : []
        gitTagClose()
        flash(pushed.length === 0
          ? t('gitAddTagOk', { tag: name })
          : t('gitAddTagPushedOk', { tag: name, remote: pushed.join(', ') }))
        gitFetch(true, true)
      } catch (err) {
        // 同名 tag：服务端权威校验拒绝 → 「替换？」确认后带 force 重试（上游两按钮对话框）；
        // 确认框（930）层级高于 tag 对话框（929），可正常盖在其上
        if (err.code === 'tag-already-exists' && gitTagForce !== true) {
          gitTagSubmit.disabled = false
          gitConfirmOpen({
            title: t('gitAddTagReplaceTitle', { tag: name }),
            text: t('gitAddTagReplaceText', { tag: name }),
            okText: t('gitReplaceBtn'),
            danger: true,
            onOk: async () => { gitTagForce = true; gitTagRun() },
          })
          return
        }
        // 创建成功但推送部分/全部失败（push-failed）：tag 已在本地，关框提示并刷新
        if (err.code === 'push-failed') {
          gitTagClose()
          flash(gitErrText(err), 'error')
          gitFetch(true, true)
          return
        }
        gitTagErr.textContent = gitErrText(err)
        gitTagErr.classList.remove('hint')
        gitTagSubmit.disabled = false
      }
    }
    gitTagSubmit.addEventListener('click', gitTagRun)
    gitTagInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') gitTagRun()
      if (ev.key === 'Escape') gitTagClose()
    })
    gitTagCancel.addEventListener('click', gitTagClose)

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
      // 上次成功后按钮被禁用；再次打开必须重置（同 push 对话框的 disabled 残留修复）
      gitStashSubmit.disabled = false
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
        // 打开时按「显示」设置中的默认范围初始化范围切换（下次打开还原到默认）。
        // gitSettingsStoreLoad 缓存，多次打开无额外开销。
        const defaultScope = gitSettingsStoreLoad().defaultScope === 'head' ? 'head' : 'all'
        if (gitScopeValue !== defaultScope) {
          gitScopeValue = defaultScope
          gitScopeBtn.textContent = `${t(defaultScope === 'head' ? 'gitHead' : 'gitAll')} ▾`
        }
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
    gitRefresh.addEventListener('click', () => {
      gitRefresh.classList.add('dsc-git-top-spin')
      // 本地仓库刷新通常很快（<100ms），动画会一闪而过；保证至少转满一圈（0.9s 周期）
      // 再停，加载态才肉眼可见
      const minSpin = new Promise((r) => setTimeout(r, 900))
      Promise.allSettled([gitFetch(false), minSpin]).finally(() => {
        gitRefresh.classList.remove('dsc-git-top-spin')
      })
    })
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
