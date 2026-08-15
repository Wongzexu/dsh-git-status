// dsh-git-status Node half：git 路由（commit 图数据 / 详情 diff / 分支操作）。
//
// 模式：自造数据通道（同 dsh-task-status），官方树零改动。
// - git 只读路由：spawn 系统 git（better-sidebar 模式：-C 工作区、--no-pager、
//   color.ui=false、GIT_OPTIONAL_LOCKS=0、超时强杀），命令与格式移植
//   mhutchie/vscode-git-graph 的 getLog/getCommitDetails：%H␟%P␟%an␟%ae␟%at␟%s
//   --date-order，scope=all 用 --branches --tags --remotes HEAD（非 --all）；
//   v2：未提交改动虚拟行 UNCOMMITTED + stash 列表组装。
// - 写路由（POST + 强制 application/json content-type，CSRF 防护同 dsh-git-graph）：
//   - 分支操作：分支名 check-ref-format --branch 权威校验 + 客户端镜像校验双保险，
//     切换前守卫：冲突 / 进行中操作 / 其他 worktree 检出。
//   - 拉取远程 / 推送分支：镜像上游 dataSource.fetch/pushBranch —— remote 为空拉全部
//     （--all），prune 默认关（同上游 fetchAndPrune 默认）；push 参数白名单枚举；
//     网络写操作超时放宽（大仓库/慢网络）。
//   - stash 操作：apply/pop/drop/branch/push，selector 权威校验（refs/stash@{n}）。

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const name = 'git-status'
export const inject = ['webServer', 'workspaceRegistry', 'sessions']

export const GIT_LOG_PATH = '/plugins/dsh-git-status/git/log'
export const GIT_SHOW_PATH = '/plugins/dsh-git-status/git/show'
export const GIT_BRANCH_PATH = '/plugins/dsh-git-status/git/branch'
export const GIT_FETCH_PATH = '/plugins/dsh-git-status/git/fetch'
export const GIT_PUSH_PATH = '/plugins/dsh-git-status/git/push'
export const GIT_REMOTE_PATH = '/plugins/dsh-git-status/git/remote'
export const GIT_STASH_PATH = '/plugins/dsh-git-status/git/stash'
export const GIT_EVENTS_PATH = '/plugins/dsh-git-status/git/events'

/** git 命令超时（毫秒）：超时强杀，防挂起。 */
const GIT_TIMEOUT = 15 * 1000
/** fetch/push 超时（毫秒）：大仓库/慢网络下 15s 不够，单独放宽（上游无超时）。 */
const GIT_FETCH_TIMEOUT = 120 * 1000
/** git log 单次上限（commit 数）。 */
const GIT_LOG_MAX = 2000
/** diff patch 返回上限（字节）：超出截断并标记。 */
const PATCH_MAX = 256 * 1024
/** 未提交改动虚拟 commit 的固定 hash（同上游 UNCOMMITTED）。 */
const UNCOMMITTED = 'UNCOMMITTED'

/**
 * 工作区根目录（会话优先解析，better-sidebar 模式）：
 * 1) 会话权威 cwd：ctx.sessions.get(sessionId)?.header.cwd（未知会话静默跳过）
 * 2) workspaceRegistry 首位记录（注册顺序，非当前会话）
 * 3) 兜底 process.cwd()
 */
function workspaceRoot(ctx, sessionId) {
  if (typeof sessionId === 'string' && sessionId !== '') {
    try {
      const session = ctx.sessions?.get?.(sessionId)
      const cwd = session?.header?.cwd
      if (typeof cwd === 'string' && cwd !== '') return cwd
    } catch {
      // fall through
    }
  }
  try {
    const list = ctx.workspaceRegistry?.list?.() ?? []
    if (list.length > 0 && typeof list[0].path === 'string') return list[0].path
  } catch {
    // fall through
  }
  return process.cwd()
}

/** 把请求的相对路径安全拼进根目录；含 `..`/NUL 分量或越界返回 null。 */
function safeJoin(root, rel) {
  if (typeof rel !== 'string' || rel === '') return root
  if (rel.includes('\0')) return null
  const parts = rel.split('/')
  // 拒绝任何 `..` 分量（前缀检查挡不住穿越：`root/../../etc` 也以 root 开头）。
  if (parts.some((p) => p === '..')) return null
  const path = parts.filter((p) => p !== '' && p !== '.').join('/')
  const joined = path === '' ? root : `${root.replace(/\/+$/, '')}/${path}`
  const rootNorm = root.replace(/\/+$/, '') + '/'
  if (!joined.startsWith(rootNorm) && joined !== root) return null
  return joined
}

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/typescript; charset=utf-8',
  '.tsx': 'text/typescript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.toml': 'text/plain; charset=utf-8',
  '.py': 'text/x-python; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8',
}

function mimeOf(name) {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return 'text/plain; charset=utf-8'
  return MIME[name.slice(dot).toLowerCase()] ?? 'text/plain; charset=utf-8'
}



/**
 * 运行一条只读 git 命令（better-sidebar 模式）：spawn 系统 git、
 * `-C root`、`--no-pager`、`-c color.ui=false`、`GIT_OPTIONAL_LOCKS=0`
 * （只读命令不碰索引锁）、超时 SIGKILL。resolve stdout 文本。
 */
function runGit(root, args, timeoutMs = GIT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', root, '--no-pager', '-c', 'color.ui=false', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      // LC_ALL=C：git 错误信息强制英文，stderr 分类正则不受系统 locale 影响
      // （中文 locale 下 overwrite/worktree 报错全是中文，正则匹配不到）。
      // GIT_EDITOR=true：服务端无 TTY，merge --continue 等提交路径不弹编辑器。
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C', LANG: 'C', GIT_EDITOR: 'true' },
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else {
        // 失败信息可能在 stdout（git merge 冲突叙述走 stdout）：
        // 错误对象附带两流与退出码，供上层分类。
        const error = new Error(stderr.trim() || `git exited with code ${code}`)
        error.stdout = stdout
        error.code = code
        reject(error)
      }
    })
  })
}

/** 工作区根是否为 git 仓库。 */
async function gitIsRepo(root) {
  try {
    await runGit(root, ['rev-parse', '--git-dir'])
    return true
  } catch {
    return false
  }
}

/** 远程分支 ref 集合（refs/remotes/* 短名），供装饰串分类消歧：本地分支可含斜杠
 *  （feat/x），%D 输出无法从字符串区分，须以 for-each-ref 的权威分类为准。 */
async function gitRemoteRefs(root) {
  try {
    const out = await runGit(root, ['for-each-ref', 'refs/remotes', '--format=%(refname:short)'])
    return new Set(out.split(/\r?\n/).filter((line) => line !== ''))
  } catch {
    return new Set()
  }
}

/** 远程名列表（`git remote` 一行一个，同上游 getRemotes）；失败返回 []。
 *  client 据此显隐「拉取远程」按钮。 */
async function gitRemoteList(root) {
  try {
    const out = await runGit(root, ['remote'])
    return out.split(/\r?\n/).filter((line) => line !== '')
  } catch {
    return []
  }
}

/** refs 指纹（refs/heads + refs/remotes + refs/tags 全量）：for-each-ref 按
 *  refname 字典序输出，天然稳定；任何分支/远程/tag 增删改（含外部终端操作）
 *  都改指纹。失败返回空串（状态键变化一次，无害；下轮探测恢复）。 */
async function gitRefsFingerprint(root) {
  try {
    return await runGit(root, ['for-each-ref', '--format=%(refname)%(objectname)', 'refs/heads', 'refs/remotes', 'refs/tags'])
  } catch {
    return ''
  }
}


/** 解析 %D 装饰串（--decorate=short）：分类 heads / remotes / tags / HEAD。
 *  headName：当前 checkout 分支名（`HEAD -> X` 的 X）；游离 HEAD 为 null。
 *  跳过远程 HEAD 符号引用（`gitee/HEAD`，fetch 自动创建、指向远程默认分支），
 *  与上游 showRemoteHeads 默认关闭一致——红色 HEAD 徽标已表达当前提交。
 *  remoteRefs：refs/remotes/* 权威集合；含斜杠的 ref 先匹配远程集合，
 *  不在集合内（如本地 feat/x）归本地分支。 */
function parseDecorations(deco, remoteRefs = new Set()) {
  const heads = []
  const remotes = []
  const tags = []
  let isHead = false
  let headName = null
  if (typeof deco !== 'string' || deco === '') return { heads, remotes, tags, isHead, headName }
  for (const token of deco.split(',')) {
    const name = token.trim()
    if (name === 'HEAD') { isHead = true; continue }
    if (name.startsWith('HEAD -> ')) { isHead = true; headName = name.slice(8); heads.push(name.slice(8)); continue }
    if (name.endsWith('/HEAD')) continue
    if (name.startsWith('tag: ')) { tags.push(name.slice(5)); continue }
    if (name.includes('/') && remoteRefs.has(name)) remotes.push(name)
    else heads.push(name)
  }
  return { heads, remotes, tags, isHead, headName }
}

/** HEAD 解析（游离 HEAD 也可）：失败返回 null。 */
async function gitHead(root) {
  try {
    const hash = (await runGit(root, ['rev-parse', '--verify', 'HEAD'])).trim()
    if (!/^[0-9a-f]{40}$/.test(hash)) return null
    return { hash, hashShort: hash.slice(0, 7) }
  } catch {
    return null
  }
}

/**
 * 未提交改动分类计数（基于 `status --porcelain` 的 XY 位）：`status --untracked-files=all
 * --porcelain` 每行两位状态码 —— X 位（index）= 已暂存、Y 位（worktree）= 未暂存；
 * `??` 未跟踪归入未暂存；`MM` 类部分暂存文件两边各计一处。
 * 返回 { total（文件数）, staged, unstaged, untracked }（untracked 为 `??` 行数，
 * 供切换守卫区分「仅未跟踪文件」的安全场景）。
 */
async function gitUncommittedCount(root) {
  try {
    const out = await runGit(root, ['status', '--untracked-files=all', '--porcelain'])
    const lines = out.split(/\r?\n/).filter((line) => line !== '')
    let staged = 0
    let unstaged = 0
    let untracked = 0
    for (const line of lines) {
      const x = line[0] ?? ' '
      const y = line[1] ?? ' '
      if (x === '?' && y === '?') untracked++
      if (x !== ' ' && x !== '?') staged++
      if (y !== ' ' || (x === '?' && y === '?')) unstaged++
    }
    return { total: lines.length, staged, unstaged, untracked }
  } catch {
    return { total: 0, staged: 0, unstaged: 0, untracked: 0 }
  }
}

/**
 * stash 列表（移植上游 getStashes）：`git reflog --format=... refs/stash --`。
 * stash commit 通常 2~3 个 parent：parents[0]=base、parents[2]=untracked 快照。
 */
async function gitStashes(root) {
  try {
    const fmt = '%H%x1f%P%x1f%gD%x1f%an%x1f%ae%x1f%at%x1f%s'
    const out = await runGit(root, ['reflog', `--format=${fmt}`, 'refs/stash', '--'])
    const stashes = []
    for (const line of out.split(/\r?\n/)) {
      if (line === '') continue
      const fields = line.split('\x1f')
      if (fields.length < 7) continue
      const [hash, parents, selector, author, email, at, subject] = fields
      const parentHashes = parents === '' ? [] : parents.split(' ')
      if (parentHashes.length === 0) continue
      stashes.push({
        hash,
        hashShort: hash.slice(0, 7),
        baseHash: parentHashes[0],
        untrackedFilesHash: parentHashes.length === 3 ? parentHashes[2] : null,
        selector,
        author,
        email,
        date: Number(at) || 0,
        subject,
      })
    }
    return stashes
  } catch {
    return []
  }
}

/**
 * 提交历史（移植原版 getLog）：`git log --max-count=N --format=%H␟%P␟%an␟%ae␟%at␟%s␟%D
 * --date-order`；scope=all 追加 `--branches --tags --remotes HEAD`；N+1 条表示还有更多。
 */
async function gitLog(root, { n = 500, scope = 'all', followFirst = false, remoteRefs } = {}) {
  const count = Math.max(1, Math.min(Math.floor(n) || 500, GIT_LOG_MAX))
  const fmt = '%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%D'
  const args = ['log', `--max-count=${count + 1}`, '--date-order', '--decorate=short', `--format=${fmt}`]
  if (followFirst) args.push('--first-parent')
  if (scope !== 'head') args.push('--branches', '--tags', '--remotes', 'HEAD')
  args.push('--')
  const out = await runGit(root, args)
  const lines = out.split(/\r?\n/).filter((line) => line !== '')
  let moreAvailable = false
  if (lines.length > count) {
    lines.pop()
    moreAvailable = true
  }
  const commits = []
  for (const line of lines) {
    const fields = line.split('\x1f')
    if (fields.length < 7) continue
    const [hash, parents, author, email, at, subject, deco] = fields
    const refs = parseDecorations(deco, remoteRefs)
    commits.push({
      hash,
      hashShort: hash.slice(0, 7),
      parents: parents === '' ? [] : parents.split(' '),
      author,
      email,
      date: Number(at) || 0,
      subject,
      refs,
    })
  }
  return { commits, moreAvailable }
}

/**
 * 提交历史 + v2 虚拟行组装（移植上游 getCommits 的插入逻辑）：
 * - head 在列表中且存在未提交改动 → 前插 UNCOMMITTED 虚拟行（第 0 行，parents=[head]）
 * - stash：hash 已在列表 → 给该行打 stash 标记；否则 baseHash 在列表 → splice 到其后
 * - 顺序（同上游）：先 unshift 虚拟行 → 建 hash 索引 → 收集 stash 插入点 → 重建索引
 * - 空仓库：git log 无 commit 报错 + HEAD 解析失败 → 返回空列表（client 显示"无提交"）
 */
async function gitLogV2(root, opts = {}) {
  const [head, stashes, uncommitted, remoteRefs, conflicts, operation, remotes] = await Promise.all([
    gitHead(root),
    gitStashes(root),
    gitUncommittedCount(root),
    gitRemoteRefs(root),
    gitConflicts(root),
    gitOperationMarker(root),
    gitRemoteList(root),
  ])
  const logResult = await gitLog(root, { ...opts, remoteRefs })
    .catch((error) => ({ commits: [], moreAvailable: false, logError: error }))
  if (logResult.logError !== undefined) {
    // log 失败但 HEAD 存在 → 真实错误，向上抛（路由 500）
    if (head !== null) throw logResult.logError
    return { commits: [], moreAvailable: false, head, uncommitted, conflicts, operationInProgress: operation !== null, operation, remotes }
  }
  const { commits, moreAvailable } = logResult
  const rows = commits.map((c) => ({ ...c, stash: null }))
  let hashIndex = new Map()
  rows.forEach((c, i) => hashIndex.set(c.hash, i))
  if (head !== null && uncommitted.total > 0 && hashIndex.has(head.hash)) {
    rows.unshift({
      hash: UNCOMMITTED,
      hashShort: UNCOMMITTED,
      parents: [head.hash],
      author: '',
      email: '',
      date: Math.round(Date.now() / 1000),
      subject: '',
      refs: { heads: [], remotes: [], tags: [], isHead: false, headName: null },
      stash: null,
      uncommitted,
    })
    hashIndex = new Map()
    rows.forEach((c, i) => hashIndex.set(c.hash, i))
  }
  const toAdd = []
  for (const s of stashes) {
    if (hashIndex.has(s.hash)) {
      rows[hashIndex.get(s.hash)].stash = { selector: s.selector, baseHash: s.baseHash, untrackedFilesHash: s.untrackedFilesHash }
    } else if (hashIndex.has(s.baseHash)) {
      toAdd.push({ index: hashIndex.get(s.baseHash), data: s })
    }
  }
  toAdd.sort((a, b) => (a.index !== b.index ? a.index - b.index : b.data.date - a.data.date))
  for (let i = toAdd.length - 1; i >= 0; i--) {
    const s = toAdd[i].data
    rows.splice(toAdd[i].index, 0, {
      hash: s.hash,
      hashShort: s.hashShort,
      parents: [s.baseHash],
      author: s.author,
      email: s.email,
      date: s.date,
      subject: s.subject,
      refs: { heads: [], remotes: [], tags: [], isHead: false, headName: null },
      stash: { selector: s.selector, baseHash: s.baseHash, untrackedFilesHash: s.untrackedFilesHash },
    })
  }
  return { commits: rows, moreAvailable, head, uncommitted, conflicts, operationInProgress: operation !== null, operation, remotes }
}

/**
 * 单个 commit 详情（移植原版 getCommitDetails 精简）：meta + 变更文件 + patch。
 * - base 提供时（stash）：显式 diff base..rev（stash 是多父 commit，diff-tree/show
 *   对其无输出或输出 combined diff，须两树 diff）
 * - 普通 merge commit（parents > 1）：同样显式 diff 第一父，避免 diff-tree 无输出 /
 *   `git show` 的 combined diff 丢文件
 */
async function gitShow(root, rev, base = '') {
  const metaFmt = '%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s'
  const metaOut = (await runGit(root, ['show', '-s', `--format=${metaFmt}`, rev])).replace(/\r?\n$/, '')
  const metaFields = metaOut.split('\x1f')
  const meta = {
    hash: metaFields[0] ?? rev,
    hashShort: (metaFields[0] ?? rev).slice(0, 7),
    parents: (metaFields[1] ?? '') === '' ? [] : (metaFields[1] ?? '').split(' '),
    author: metaFields[2] ?? '',
    email: metaFields[3] ?? '',
    date: Number(metaFields[4]) || 0,
    subject: metaFields[5] ?? '',
  }
  const diffBase = base !== '' ? base : meta.parents.length > 1 ? meta.parents[0] : ''
  const [bodyOut, statOut, patchOut] = await Promise.all([
    runGit(root, ['log', '-1', '--format=%B', rev]),
    diffBase !== ''
      ? runGit(root, ['diff', '--numstat', diffBase, rev]).catch(() => '')
      : runGit(root, ['diff-tree', '-r', '--numstat', '--no-commit-id', '--root', rev]).catch(() => ''),
    diffBase !== ''
      ? runGit(root, ['diff', '--no-color', diffBase, rev]).catch(() => '')
      : runGit(root, ['show', '--format=', '--no-color', rev]).catch(() => ''),
  ])
  const files = parseNumstat(statOut)
  let patch = patchOut
  let truncated = false
  if (patch.length > PATCH_MAX) {
    patch = patch.slice(0, PATCH_MAX)
    truncated = true
  }
  return { meta, body: bodyOut.replace(/\r?\n$/, ''), files, patch, truncated }
}

/** 解析 `--numstat` 输出为 [{ path, adds, dels }]。 */
function parseNumstat(statOut) {
  const files = []
  for (const line of statOut.split(/\r?\n/)) {
    if (line === '') continue
    const [adds, dels, ...rest] = line.split('\t')
    const path = rest.join('\t')
    if (path === '') continue
    files.push({
      path,
      adds: adds === '-' ? 0 : Number(adds) || 0,
      dels: dels === '-' ? 0 : Number(dels) || 0,
    })
  }
  return files
}

/**
 * 未提交改动详情（分组版，VS Code「更改 / 暂存的更改」语义）：
 * - staged 组：`git diff --cached`（索引 vs HEAD，含 A/M/D/R）
 * - unstaged 组：`git diff`（工作区 vs 索引，含 M/D/R）+ status 追加未跟踪（??）
 * 部分暂存文件（MM/AM）会同时出现在两组；未跟踪文件无 patch（git diff 无输出）。
 */
async function gitShowUncommitted(root) {
  const [stagedNumstat, unstagedNumstat, statusOut, stagedPatch, unstagedPatch] = await Promise.all([
    runGit(root, ['diff', '--cached', '--numstat']).catch(() => ''),
    runGit(root, ['diff', '--numstat']).catch(() => ''),
    runGit(root, ['status', '-s', '--untracked-files=all', '--porcelain', '-z']).catch(() => ''),
    runGit(root, ['diff', '--cached', '--no-color']).catch(() => ''),
    runGit(root, ['diff', '--no-color']).catch(() => ''),
  ])
  const stagedFiles = parseNumstat(stagedNumstat)
  const unstagedFiles = parseNumstat(unstagedNumstat)
  for (const entry of statusOut.split('\0')) {
    if (entry.length < 4) continue
    const code = entry.slice(0, 2)
    const path = entry.slice(3)
    if (path === '' || code !== '??') continue
    if (!unstagedFiles.some((f) => f.path === path)) unstagedFiles.push({ path, adds: 0, dels: 0, status: code })
  }
  const cut = (patch) => {
    let truncated = false
    if (patch.length > PATCH_MAX) {
      patch = patch.slice(0, PATCH_MAX)
      truncated = true
    }
    return { patch, truncated }
  }
  const staged = cut(stagedPatch)
  const unstaged = cut(unstagedPatch)
  return {
    meta: { hash: UNCOMMITTED, hashShort: UNCOMMITTED, parents: [], author: '', email: '', date: 0, subject: '' },
    body: '',
    staged: { files: stagedFiles, patch: staged.patch, truncated: staged.truncated },
    unstaged: { files: unstagedFiles, patch: unstaged.patch, truncated: unstaged.truncated },
  }
}

/** stash 第三父（untracked 快照）的变更文件与 patch（追加进 stash 详情）。 */
async function gitShowStashUntracked(root, hash) {
  const [statOut, patchOut] = await Promise.all([
    runGit(root, ['diff-tree', '-r', '--numstat', '--no-commit-id', '--root', hash]).catch(() => ''),
    runGit(root, ['show', '--format=', '--no-color', hash]).catch(() => ''),
  ])
  let patch = patchOut
  let truncated = false
  if (patch.length > PATCH_MAX) {
    patch = patch.slice(0, PATCH_MAX)
    truncated = true
  }
  return { files: parseNumstat(statOut), patch, truncated }
}

// ---------- 分支操作（写路由，守卫模型移植自社区 dsh-git-graph） ----------

/** 存在即表示有 git 操作进行中的标记（同 dsh-git-graph OPERATION_MARKERS）。 */
const OPERATION_MARKERS = [
  'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG',
  'rebase-merge', 'rebase-apply', 'sequencer',
]

/**
 * `git check-ref-format --branch` 短分支名规则的纯镜像（客户端即时反馈用；
 * 服务端权威校验仍是 check-ref-format 本身）。返回非法原因，合法返回 null。
 */
function validateBranchName(name) {
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

/** 远程全名（如 gitee/main）形态校验：非空、不含空白/控制符/危险字符。 */
function validateRemoteRef(name) {
  return typeof name === 'string' && name.length <= 200 && name.length > 0 &&
    /^[0-9A-Za-z._\/-]+$/.test(name) && !name.startsWith('/') && !name.endsWith('/') && !name.includes('..')
}

/** 远程名（remote 名，非 ref）形态校验：git remote 名不含 `/`，余同 ref 规则。 */
/** remote 名形态校验（安全网，实测对齐 git valid_remote_nick）：
 *  允许大小写/@/+/斜杠/尾点（repo@backup、upstream+mirror、a/b、a. 均合法）；
 *  git 拒绝空格、含 ..、. 开头组件、.lock 结尾组件。
 *  权威校验仍是 gitRemoteList 存在性（列表里选出来的名字必然合法），
 *  这里只防控制字符/超长/明显非法形态。 */
function validateRemoteName(name) {
  if (typeof name !== 'string' || name === '' || name.length > 200) return false
  if (name.includes(' ') || name.includes('\0') || /[\x00-\x1f\x7f]/.test(name)) return false
  for (const component of name.split('/')) {
    if (component === '' || component.includes('..') || component.startsWith('.') || component.endsWith('.lock')) return false
  }
  return true
}

/** stash selector 权威形态校验（实测 %gD 输出 refs/stash@{n}，带 refs/ 前缀）。 */
function validateStashSelector(name) {
  return typeof name === 'string' && /^refs\/stash@\{[0-9]+\}$/.test(name)
}

/** tag 名形态校验（镜像 refs/tags 规则；服务端 check-ref-format 权威）。 */
function validateTagName(name) {
  return typeof name === 'string' && name.length <= 200 && name.length > 0 &&
    /^[0-9A-Za-z._\/-]+$/.test(name) && !name.startsWith('/') && !name.startsWith('.') &&
    !name.endsWith('/') && !name.endsWith('.') && !name.includes('..') && !name.includes('@{')
}

/** stderr 覆盖守卫模式 → 错误码（同 dsh-git-graph OVERWRITE_PATTERNS）。 */
const OVERWRITE_PATTERNS = [
  { code: 'tracked-changes-would-be-overwritten', header: /Your local changes to the following files would be overwritten by checkout/ },
  { code: 'untracked-changes-would-be-overwritten', header: /The following untracked working tree files would be overwritten by checkout/ },
  { code: 'tracked-changes-would-be-overwritten', header: /Your local changes to the following files would be overwritten by merge/ },
]

/** 从 overwrite 报错中提取被挡文件（最多 2 个 + 剩余数）。
 *  git 的 core.quotePath 转义还原：`\"`→引号、`\\`→反斜杠、`\t`→制表符等。 */
const PATH_UNESCAPE = { '\\': '\\', '"': '"', t: '\t', n: '\n', r: '\r', b: '\b', f: '\f', v: '\v' }
function extractBlockedPaths(stderr, header) {
  const start = stderr.indexOf('\n', stderr.search(header))
  if (start === -1) return { paths: [], moreFiles: 0 }
  const paths = []
  for (const line of stderr.slice(start + 1).split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || !line.startsWith('\t')) break
    const quoted = /^"(.+)"$/.exec(trimmed)
    paths.push(quoted === null ? trimmed.replace(/\\(.)/g, (_, c) => PATH_UNESCAPE[c] ?? c) : (quoted[1] ?? '').replace(/\\(.)/g, (_, c) => PATH_UNESCAPE[c] ?? c))
  }
  return { paths: paths.slice(0, 2), moreFiles: Math.max(0, paths.length - 2) }
}

/** 失败的 switch/create 的 stderr → 稳定错误码。 */
function classifySwitchFailure(stderr) {
  const head = stderr.trim().split('\n')[0] ?? stderr
  for (const pattern of OVERWRITE_PATTERNS) {
    if (pattern.header.test(stderr)) {
      const { paths, moreFiles } = extractBlockedPaths(stderr, pattern.header)
      return { code: pattern.code, message: head, paths, moreFiles }
    }
  }
  if (/did not match any file\(s\) known to git|invalid reference|not a valid branch/.test(stderr)) {
    return { code: 'target-branch-not-found', message: head }
  }
  if (/already used by worktree|is already checked out at/.test(stderr)) {
    return { code: 'branch-in-other-worktree', message: head }
  }
  if (/local changes to the following files would be overwritten/.test(stderr)) {
    return { code: 'tracked-changes-would-be-overwritten', message: head }
  }
  return { code: 'internal', message: head || 'git operation failed' }
}

/** fetch 失败 stderr → 稳定错误码（上游 fetch 直接回传 ErrorInfo，这里分类给客户端文案）。
 *  网络/认证类（unable to access、Could not resolve、Authentication failed、
 *  Permission denied、连接超时/拒绝）→ network-error；远程名存在但仓库不可达
 *  （does not appear to be a git repository / URL 失效）→ remote-unreachable。
 *  注意：远程名不存在已在 gitFetchAction 服务端权威校验拦截（stderr 无法区分
 *  「名不存在」与「URL 仓库不可达」，两者都是 does not appear to be a git repository）。 */
function classifyFetchFailure(stderr) {
  const head = stderr.trim().split('\n')[0] ?? stderr
  if (/Could not resolve|Failed to connect|unable to access|Authentication failed|Permission denied|Connection (timed out|refused)|Operation timed out|terminal prompts disabled|Could not read Username/.test(stderr)) {
    return { code: 'network-error', message: head }
  }
  if (/does not appear to be a git repository|Could not read from remote repository/.test(stderr)) {
    return { code: 'remote-unreachable', message: head }
  }
  return { code: 'internal', message: head || 'git fetch failed' }
}

/** push 失败 stderr → 稳定错误码。
 *  rejected（fetch first / non-fast-forward）→ push-rejected；服务端 hook 拒绝
 *  （remote rejected）→ remote-rejected；网络/认证复用 network-error 正则。 */
function classifyPushFailure(stderr) {
  const head = stderr.trim().split('\n')[0] ?? stderr
  if (/\[rejected\].*(fetch first|non-fast-forward)|non-fast-forward|fetch first/.test(stderr)) {
    return { code: 'push-rejected', message: head }
  }
  if (/\[remote rejected\]/.test(stderr)) {
    return { code: 'remote-rejected', message: head }
  }
  if (/Could not resolve|Failed to connect|unable to access|Authentication failed|Permission denied|Connection (timed out|refused)|Operation timed out|terminal prompts disabled|Could not read Username/.test(stderr)) {
    return { code: 'network-error', message: head }
  }
  if (/does not appear to be a git repository|Could not read from remote repository/.test(stderr)) {
    return { code: 'remote-unreachable', message: head }
  }
  return { code: 'internal', message: head || 'git push failed' }
}

/** stash 失败 stderr → 稳定错误码（apply/pop 冲突叙述可能在 stdout，调用方两流都查）。
 *  overwrite 拒绝（工作区有改动会被覆盖）也归 stash-conflicts：stash 保留，
 *  用户需先处理工作区改动。 */
function classifyStashFailure(stderr) {
  const head = stderr.trim().split('\n')[0] ?? stderr
  if (/CONFLICT|conflict|would be overwritten by merge/.test(stderr)) return { code: 'stash-conflicts', message: head }
  return { code: 'internal', message: head || 'git stash operation failed' }
}

/** 是否存在进行中的 git 操作（MERGE_HEAD 等标记文件）。 */
async function gitOperationInProgress(root) {
  return (await gitOperationMarker(root)) !== null
}

/** 进行中的 git 操作标记名（MERGE_HEAD / CHERRY_PICK_HEAD / rebase-merge …），无则 null。 */
async function gitOperationMarker(root) {
  for (const marker of OPERATION_MARKERS) {
    try {
      const markerPath = (await runGit(root, ['rev-parse', '--git-path', marker])).trim()
      if (markerPath !== '' && existsSync(resolve(root, markerPath))) return marker
    } catch {
      // 标记不存在 → rev-parse 报错，继续
    }
  }
  return null
}

/** 未解决冲突文件数（diff --diff-filter=U）。 */
async function gitConflicts(root) {
  try {
    const out = await runGit(root, ['diff', '--name-only', '--diff-filter=U'])
    return out.split(/\r?\n/).filter((line) => line !== '').length
  } catch {
    return 0
  }
}

/** 当前分支名（游离 HEAD 为空串）。 */
async function gitCurrentBranch(root) {
  try {
    return (await runGit(root, ['branch', '--show-current'])).trim()
  } catch {
    return ''
  }
}

/**
 * 切换守卫（ZCode/dsh-git-graph 语义）：未解决冲突 / 进行中操作 /
 * 目标分支已在其他 worktree 检出 → 返回拒绝错误，否则 null。
 * @param target - 目标本地分支名；undefined（创建）时跳过 worktree 检查。
 * @param opts.checkUncommitted - true 时额外拦截已跟踪未提交改动（staged /
 *   跟踪未暂存）：git 本身允许带改动切换，这里只做提醒式拦截，`force` 确认后旁路。
 *   仅未跟踪文件不拦 —— 切换安全（文件跟随，git 不拦），目标分支同名时才由
 *   git 报 untracked-changes-would-be-overwritten（已有分类）。
 */
async function gitGuardBlock(root, target, opts = {}) {
  const count = await gitConflicts(root)
  if (count > 0) return { code: 'conflicts-present', message: `repository has ${count} unresolved conflict(s)` }
  if (await gitOperationInProgress(root)) {
    return { code: 'operation-in-progress', message: 'a git operation is in progress' }
  }
  if (target !== undefined) {
    try {
      const out = await runGit(root, ['worktree', 'list', '--porcelain'])
      // 排除当前 worktree 自身：porcelain 每条目以 `worktree <path>` 开头，
      // 目标分支在本 worktree 检出不是「其它 worktree」。
      const rootResolved = resolve(root)
      let currentPath = null
      for (const line of out.split(/\r?\n/)) {
        const wt = /^worktree (.+)$/.exec(line.trim())
        if (wt !== null) { currentPath = wt[1]; continue }
        const m = /^branch refs\/heads\/(.+)$/.exec(line.trim())
        if (m !== null && m[1] === target && currentPath !== null && resolve(currentPath) !== rootResolved) {
          return { code: 'branch-in-other-worktree', message: `branch "${target}" is checked out in another worktree` }
        }
      }
    } catch {
      // 忽略
    }
  }
  if (opts.checkUncommitted === true) {
    const u = await gitUncommittedCount(root)
    const unstagedTracked = u.unstaged - u.untracked
    if (u.staged > 0 || unstagedTracked > 0) {
      return {
        code: 'uncommitted-changes-present',
        message: 'working tree has uncommitted changes',
        staged: u.staged,
        unstaged: unstagedTracked,
        untracked: u.untracked,
      }
    }
  }
  return null
}

/**
 * 分支操作（插件首个写路由，作用于磁盘工作树）：
 * - checkout：本地分支 `git switch --no-guess -- <branch>`；远程 start-point 时
 *   `git switch --no-guess -c <branch> -- <remoteFull>`（创建本地跟踪分支并检出）
 * - create：从当前 HEAD `git switch --no-guess -c <name>`（无 start-point）
 * - force：checkout 时旁路未提交改动守卫（客户端确认后携带）；delete 时为强删。
 * 返回 { ok: true, branch } 或 { ok: false, error: { code, message, paths?, moreFiles? } }。
 */
async function gitBranchAction(root, action, { branch = '', remote = '', name = '', force = false, start = '' } = {}) {
  const error = (code, message) => ({ ok: false, error: { code, message } })
  if (action === 'checkout') {
    if (typeof branch !== 'string' || branch === '' || validateBranchName(branch) !== null) {
      return error('invalid-branch-name', 'invalid branch name')
    }
    if (remote !== '') {
      if (!validateRemoteRef(remote)) return error('invalid-branch-name', 'invalid remote ref')
      // 远程分支必须真实存在
      try {
        await runGit(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/${remote}`])
      } catch {
        return error('target-branch-not-found', `remote branch "${remote}" does not exist`)
      }
      const localExists = await gitRefExists(root, `refs/heads/${branch}`)
      if (localExists) return error('branch-already-exists', `branch "${branch}" already exists locally`)
      const blocked = await gitGuardBlock(root, undefined, { checkUncommitted: force !== true })
      if (blocked !== null) return { ok: false, error: blocked }
      try {
        await runGit(root, ['switch', '--no-guess', '-c', branch, '--', remote])
        return { ok: true, branch }
      } catch (err) {
        return { ok: false, error: classifySwitchFailure(err instanceof Error ? err.message : String(err)) }
      }
    }
    const exists = await gitRefExists(root, `refs/heads/${branch}`)
    if (!exists) return error('target-branch-not-found', `branch "${branch}" does not exist locally`)
    const blocked = await gitGuardBlock(root, branch, { checkUncommitted: force !== true })
    if (blocked !== null) return { ok: false, error: blocked }
    try {
      await runGit(root, ['switch', '--no-guess', '--', branch])
      return { ok: true, branch }
    } catch (err) {
      return { ok: false, error: classifySwitchFailure(err instanceof Error ? err.message : String(err)) }
    }
  }
  if (action === 'create') {
    const mirror = validateBranchName(name)
    if (mirror !== null) return error('invalid-branch-name', `invalid branch name: ${mirror}`)
    try {
      await runGit(root, ['check-ref-format', '--branch', name])
    } catch (err) {
      return error('invalid-branch-name', err instanceof Error ? err.message : 'invalid branch name')
    }
    if (await gitRefExists(root, `refs/heads/${name}`)) {
      return error('branch-already-exists', `branch "${name}" already exists`)
    }
    const blocked = await gitGuardBlock(root, undefined)
    if (blocked !== null) return { ok: false, error: blocked }
    // 可选 start-point（tag 右键建分支）：refs/tags/<start> 权威校验后
    // `switch -c <name> -- <start>`（argv 数组无 shell；`--` 挡选项注入）。
    let startArgs = []
    if (start !== '') {
      if (!validateRemoteRef(start)) return error('invalid-start-point', 'invalid start point')
      try {
        await runGit(root, ['rev-parse', '--verify', '--quiet', `refs/tags/${start}`])
      } catch {
        return error('start-point-not-found', `tag "${start}" does not exist`)
      }
      startArgs = ['--', start]
    }
    try {
      await runGit(root, ['switch', '--no-guess', '-c', name, ...startArgs])
      return { ok: true, branch: name }
    } catch (err) {
      return { ok: false, error: classifySwitchFailure(err instanceof Error ? err.message : String(err)) }
    }
  }
  if (action === 'delete') {
    const mirror = validateBranchName(branch)
    if (mirror !== null) return error('invalid-branch-name', `invalid branch name: ${mirror}`)
    if (!(await gitRefExists(root, `refs/heads/${branch}`))) {
      return error('target-branch-not-found', `branch "${branch}" does not exist`)
    }
    if (branch === (await gitCurrentBranch(root))) {
      return error('cannot-delete-current', `cannot delete the current branch "${branch}"`)
    }
    const blocked = await gitGuardBlock(root, branch)
    if (blocked !== null) return { ok: false, error: blocked }
    try {
      await runGit(root, ['branch', force === true ? '-D' : '-d', branch])
      return { ok: true, branch }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/not fully merged/.test(msg)) return error('branch-not-fully-merged', (msg.split('\n')[0] ?? msg).trim())
      return { ok: false, error: classifySwitchFailure(msg) }
    }
  }
  if (action === 'rename') {
    const mirror = validateBranchName(name)
    if (mirror !== null) return error('invalid-branch-name', `invalid branch name: ${mirror}`)
    if (!(await gitRefExists(root, `refs/heads/${branch}`))) {
      return error('target-branch-not-found', `branch "${branch}" does not exist`)
    }
    if (await gitRefExists(root, `refs/heads/${name}`)) {
      return error('branch-already-exists', `branch "${name}" already exists`)
    }
    const blocked = await gitGuardBlock(root, branch)
    if (blocked !== null) return { ok: false, error: blocked }
    try {
      await runGit(root, ['branch', '-m', branch, name])
      return { ok: true, branch: name }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/used by worktree/.test(msg)) return error('branch-in-other-worktree', (msg.split('\n')[0] ?? msg).trim())
      return { ok: false, error: classifySwitchFailure(msg) }
    }
  }
  if (action === 'merge') {
    const mirror = validateBranchName(branch)
    if (mirror !== null) return error('invalid-branch-name', `invalid branch name: ${mirror}`)
    if (!(await gitRefExists(root, `refs/heads/${branch}`))) {
      return error('target-branch-not-found', `branch "${branch}" does not exist`)
    }
    if (branch === (await gitCurrentBranch(root))) {
      return error('cannot-merge-self', `cannot merge the current branch "${branch}" into itself`)
    }
    const blocked = await gitGuardBlock(root, undefined)
    if (blocked !== null) return { ok: false, error: blocked }
    try {
      await runGit(root, ['merge', '--no-edit', branch])
      return { ok: true, branch }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const stdout = err instanceof Error && typeof err.stdout === 'string' ? err.stdout : ''
      // merge 冲突叙述在 stdout（stderr 为空），两流都查。
      if (/CONFLICT/.test(msg) || /CONFLICT/.test(stdout)) {
        const head = (stdout.split('\n').find((l) => l.includes('CONFLICT')) ?? msg.split('\n')[0] ?? msg).trim()
        return error('merge-conflicts', head)
      }
      return { ok: false, error: classifySwitchFailure(msg) }
    }
  }
  if (action === 'merge-abort' || action === 'merge-continue') {
    try {
      const args = action === 'merge-abort'
        ? ['merge', '--abort']
        : ['merge', '--continue'] // --continue 不接受 --no-edit（fatal: expects no arguments）
      await runGit(root, args)
      return { ok: true, branch: '' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/There is no merge to abort|no merge in progress/.test(msg)) {
        return error('no-merge-in-progress', (msg.split('\n')[0] ?? msg).trim())
      }
      if (/Committing is not possible|unmerged files/.test(msg)) {
        return error('merge-conflicts-remain', (msg.split('\n')[0] ?? msg).trim())
      }
      return { ok: false, error: classifySwitchFailure(msg) }
    }
  }
  return error('internal', 'unknown action')
}

/** `git rev-parse --verify --quiet <ref>`：ref 是否存在。 */
async function gitRefExists(root, ref) {
  try {
    await runGit(root, ['rev-parse', '--verify', '--quiet', ref])
    return true
  } catch {
    return false
  }
}

/**
 * 拉取远程（写路由，镜像上游 dataSource.fetch）：
 * - remote 为空 → `git fetch --all`（上游工具栏 Fetch from Remote(s) 形态，无对话框）
 * - remote 非空 → `git fetch <name>`（单远程；先 `git remote` 权威校验名存在性，
 *   不存在 → remote-not-found——stderr 无法区分「名不存在」与「URL 仓库不可达」）
 * - prune 布尔（默认关，同上游 fetchAndPrune 默认值）
 * - 超时放宽：GIT_FETCH_TIMEOUT（大仓库/慢网络 15s 不够）
 * 返回 { ok: true } 或 { ok: false, error: { code, message } }。
 */
async function gitFetchAction(root, { remote = '', prune = false } = {}) {
  const error = (code, message) => ({ ok: false, error: { code, message } })
  if (remote !== '' && !validateRemoteName(remote)) {
    return error('invalid-remote-name', 'invalid remote name')
  }
  if (remote !== '') {
    const remotes = await gitRemoteList(root)
    if (!remotes.includes(remote)) {
      return error('remote-not-found', `remote "${remote}" does not exist`)
    }
  }
  const args = ['fetch', remote === '' ? '--all' : remote]
  if (prune === true) args.push('--prune')
  try {
    await runGit(root, args, GIT_FETCH_TIMEOUT)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: classifyFetchFailure(msg) }
  }
}

/** push 模式白名单（上游 GitPushBranchMode：normal / force-with-lease / force）。 */
const PUSH_MODES = ['normal', 'force-with-lease', 'force']

/**
 * 推送分支（写路由，镜像上游 dataSource.pushBranch / pushBranchToMultipleRemotes）：
 * `git push <remote> <branch> [--set-upstream] [--force-with-lease|--force]`。
 * - remotes：目标远程数组（至少一项），逐个顺序推、第一个失败即停（上游语义）；
 *   每项 remote 名白名单 + 存在性权威校验（同 fetch）
 * - 分支名 validateBranchName + 本地存在性；setUpstream 布尔；mode 白名单枚举
 * - 超时放宽：GIT_FETCH_TIMEOUT（慢网络大仓库）
 * 返回 { ok: true } 或 { ok: false, error: { code, message } }。
 */
async function gitPushAction(root, { branch = '', remotes = [], setUpstream = false, mode = 'normal' } = {}) {
  const error = (code, message) => ({ ok: false, error: { code, message } })
  if (branch === '' || validateBranchName(branch) !== null) {
    return error('invalid-branch-name', 'invalid branch name')
  }
  if (!Array.isArray(remotes) || remotes.length === 0 || remotes.some((r) => typeof r !== 'string' || !validateRemoteName(r))) {
    return error('invalid-remote-name', 'invalid remote name')
  }
  if (!PUSH_MODES.includes(mode)) return error('invalid-push-mode', 'invalid push mode')
  const remoteSet = await gitRemoteList(root)
  for (const r of remotes) {
    if (!remoteSet.includes(r)) return error('remote-not-found', `remote "${r}" does not exist`)
  }
  if (!(await gitRefExists(root, `refs/heads/${branch}`))) {
    return error('target-branch-not-found', `branch "${branch}" does not exist locally`)
  }
  for (const remote of remotes) {
    const args = ['push', remote, branch]
    if (setUpstream === true) args.push('--set-upstream')
    if (mode === 'force-with-lease') args.push('--force-with-lease')
    if (mode === 'force') args.push('--force')
    try {
      await runGit(root, args, GIT_FETCH_TIMEOUT)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: classifyPushFailure(msg) }
    }
  }
  return { ok: true }
}

/**
 * 远程/标签操作（写路由，镜像上游 deleteRemoteBranch / pushTag / deleteTag）：
 * - delete-branch：`git push <remote> --delete <branch>`；失败且报 remote ref does
 *   not exist（远程分支已不存在）→ 降级 `git branch -d -r <remote>/<branch>` 只删
 *   本地跟踪 ref（ok: { degraded: true }，上游 deleteRemoteBranch 语义）
 * - push-tag：`git push <remote> <tag>`（失败分类复用 classifyPushFailure）
 * - delete-tag：remote 非空时先 `git push <remote> --delete <tag>` 再 `git tag -d <tag>`
 *   （上游顺序：远程失败则整体失败、本地不删）；remote 空 = 仅删本地
 * 校验：branch/tag/remote 名白名单 + check-ref-format 权威 + 存在性。
 * 返回 { ok: true, degraded? } 或 { ok: false, error: { code, message } }。
 */
async function gitRemoteAction(root, action, { branch = '', tag = '', remote = '' } = {}) {
  const error = (code, message) => ({ ok: false, error: { code, message } })
  const remoteOk = async () => {
    if (!validateRemoteName(remote)) return error('invalid-remote-name', 'invalid remote name')
    const remotes = await gitRemoteList(root)
    if (!remotes.includes(remote)) return error('remote-not-found', `remote "${remote}" does not exist`)
    return null
  }
  if (action === 'delete-branch') {
    if (branch === '' || validateBranchName(branch) !== null) {
      return error('invalid-branch-name', 'invalid branch name')
    }
    const r = await remoteOk()
    if (r !== null) return r
    try {
      await runGit(root, ['push', remote, '--delete', branch], GIT_FETCH_TIMEOUT)
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/remote ref does not exist/.test(msg)) {
        // 远程分支已不存在：降级只删本地跟踪 ref（上游语义）
        try {
          await runGit(root, ['branch', '-d', '-r', `${remote}/${branch}`])
          return { ok: true, degraded: true }
        } catch {
          return { ok: false, error: { code: 'remote-ref-not-found', message: (msg.split('\n')[0] ?? msg).trim() } }
        }
      }
      return { ok: false, error: classifyPushFailure(msg) }
    }
  }
  if (action === 'push-tag' || action === 'delete-tag') {
    if (!validateTagName(tag)) return error('invalid-tag-name', 'invalid tag name')
    try {
      await runGit(root, ['check-ref-format', `refs/tags/${tag}`])
    } catch {
      return error('invalid-tag-name', `invalid tag name: ${tag}`)
    }
    if (!(await gitRefExists(root, `refs/tags/${tag}`))) {
      return error('tag-not-found', `tag "${tag}" does not exist`)
    }
    if (action === 'push-tag') {
      const r = await remoteOk()
      if (r !== null) return r
      try {
        await runGit(root, ['push', remote, tag], GIT_FETCH_TIMEOUT)
        return { ok: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, error: classifyPushFailure(msg) }
      }
    }
    if (remote !== '') {
      const r = await remoteOk()
      if (r !== null) return r
      try {
        await runGit(root, ['push', remote, '--delete', tag], GIT_FETCH_TIMEOUT)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, error: classifyPushFailure(msg) }
      }
    }
    try {
      await runGit(root, ['tag', '-d', tag])
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/not found|does not exist/.test(msg)) return error('tag-not-found', (msg.split('\n')[0] ?? msg).trim())
      return { ok: false, error: { code: 'internal', message: (msg.split('\n')[0] ?? msg).trim() } }
    }
  }
  return error('internal', 'unknown action')
}

/**
 * stash 操作（写路由，镜像上游 Stash Context Menu + Uncommitted Context Menu）：
 * - push：`git stash push [-m <message>] [-u]`（未提交行右键「暂存未提交改动」）
 * - apply/pop：`git stash (apply|pop) [--index] <selector>`（冲突 → stash-conflicts）
 * - drop：`git stash drop <selector>`（client 侧确认框）
 * - branch：`git stash branch <name> <selector>`（以 stash 建分支并检出）
 * selector 权威校验：refs/stash@{n}（实测 %gD 输出格式，防注入）。
 * 返回 { ok: true, branch? } 或 { ok: false, error: { code, message } }。
 */
async function gitStashAction(root, action, { selector = '', message = '', includeUntracked = false, reinstateIndex = false, branch = '' } = {}) {
  const error = (code, message) => ({ ok: false, error: { code, message } })
  const selectOk = () => validateStashSelector(selector)
  const stashExists = async () => {
    try {
      await runGit(root, ['rev-parse', '--verify', '--quiet', selector])
      return true
    } catch {
      return false
    }
  }
  const conflictOf = (err) => {
    const msg = err instanceof Error ? err.message : String(err)
    const stdout = err instanceof Error && typeof err.stdout === 'string' ? err.stdout : ''
    // 实测两种冲突形态：三方合并冲突叙述在 stdout（stderr 空 → runGit 报 code 1）；
    // 工作区改动会被覆盖（overwrite 拒绝）在 stderr。两流都查。
    if (/CONFLICT/.test(stdout) || /CONFLICT/.test(msg) || /would be overwritten by merge/.test(msg)) {
      const head = (stdout.split('\n').find((l) => l.includes('CONFLICT')) ?? msg.split('\n')[0] ?? msg).trim()
      return { code: 'stash-conflicts', message: head }
    }
    return null
  }
  if (action === 'push') {
    const args = ['stash', 'push']
    if (message !== '') args.push('-m', message)
    if (includeUntracked === true) args.push('-u')
    try {
      await runGit(root, args)
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === '' || /nothing to save|no local changes/.test(msg)) {
        return error('stash-nothing-to-save', (msg.split('\n')[0] ?? msg).trim() || 'no local changes to stash')
      }
      return { ok: false, error: classifyStashFailure(msg) }
    }
  }
  if (action === 'apply' || action === 'pop' || action === 'branch') {
    if (!selectOk()) return error('invalid-stash-selector', 'invalid stash selector')
    if (!(await stashExists())) return error('stash-not-found', `stash "${selector}" does not exist`)
    if (action === 'branch') {
      if (branch === '' || validateBranchName(branch) !== null) {
        return error('invalid-branch-name', `invalid branch name: ${validateBranchName(branch)}`)
      }
      if (await gitRefExists(root, `refs/heads/${branch}`)) {
        return error('branch-already-exists', `branch "${branch}" already exists`)
      }
    }
    const args = action === 'branch'
      ? ['stash', 'branch', branch, selector]
      : ['stash', action]
    if (action !== 'branch' && reinstateIndex === true) args.push('--index')
    if (action !== 'branch') args.push(selector)
    try {
      await runGit(root, args)
      return action === 'branch' ? { ok: true, branch } : { ok: true }
    } catch (err) {
      const conflicted = conflictOf(err)
      if (conflicted !== null) return { ok: false, error: conflicted }
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: classifyStashFailure(msg) }
    }
  }
  if (action === 'drop') {
    if (!selectOk()) return error('invalid-stash-selector', 'invalid stash selector')
    try {
      await runGit(root, ['stash', 'drop', selector])
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/No stash entries found|no stash found|does not exist|is not a valid reference/.test(msg)) {
        return error('stash-not-found', (msg.split('\n')[0] ?? msg).trim())
      }
      return { ok: false, error: classifyStashFailure(msg) }
    }
  }
  return error('internal', 'unknown action')
}



function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

/**
 * 插件主体：注册 git 只读路由 + 分支操作写路由 + SSE 推送。
 * @param ctx - host cordis context
 */
export function apply(ctx) {
  ctx.effect(() => registerRoutes(ctx), 'dsh-git-status: git log/show/branch/events routes')
}

/** SSE 轮询间隔（毫秒）：订阅期间服务端周期对比状态键，变化才推。 */
const EVENTS_POLL_MS = 2000
/** SSE 心跳注释间隔（毫秒）：防代理断空闲连接。 */
const EVENTS_HEARTBEAT_MS = 15000

/** 事件订阅状态（变化检测键的输入）。 */
async function gitEventsStatus(root) {
  if (!(await gitIsRepo(root))) return null
  const [head, uncommitted, conflicts, operation, branch, refs, stashes] = await Promise.all([
    gitHead(root),
    gitUncommittedCount(root),
    gitConflicts(root),
    gitOperationMarker(root),
    gitCurrentBranch(root),
    gitRefsFingerprint(root),
    gitStashes(root),
  ])
  return {
    root,
    head: head === null ? '' : head.hash,
    branch,
    staged: uncommitted.staged,
    unstaged: uncommitted.unstaged,
    conflicts,
    operation,
    refs,
    stash: stashes.length > 0 ? stashes[0].hash : '',
  }
}

/** 状态键：任何影响泳道图的仓库状态变化都会改键 → 触发推送。 */
function gitStateKey(status) {
  if (status === null) return 'no-repo'
  return `${status.root}|${status.head}|${status.branch}|${status.staged}|${status.unstaged}|${status.conflicts}|${status.operation}|refs:${status.refs}|stash:${status.stash}`
}

/**
 * 路由注册（独立导出供测试注入轮询间隔）。
 * @param ctx - host cordis context
 * @param opts.events - { pollIntervalMs, heartbeatMs } 测试用短间隔
 */
export function registerRoutes(ctx, { events = {} } = {}) {
  const disposers = []
  const eventsPollMs = Math.max(10, events.pollIntervalMs ?? EVENTS_POLL_MS)
  const eventsHeartbeatMs = Math.max(20, events.heartbeatMs ?? EVENTS_HEARTBEAT_MS)

  // 提交历史（泳道图数据）：?n= 数量 &scope=all|head &follow=1
  // v2：响应含组装后的虚拟行（UNCOMMITTED/stash）+ head + uncommitted 计数 +
  // conflicts/operationInProgress 状态。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_LOG_PATH,
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const root = workspaceRoot(ctx, url.searchParams.get('session') ?? '')
        if (!(await gitIsRepo(root))) return json(res, 200, { isRepo: false, commits: [], moreAvailable: false })
        const result = await gitLogV2(root, {
          n: Number(url.searchParams.get('n')) || 500,
          scope: url.searchParams.get('scope') === 'head' ? 'head' : 'all',
          followFirst: url.searchParams.get('follow') === '1',
        })
        json(res, 200, { isRepo: true, root, ...result })
      } catch (error) {
        json(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  // 单个 commit 详情：?rev= 短/全 hash（4-40 位十六进制）或 UNCOMMITTED；
  // &base= 提供时显式 diff base..rev（stash）；&stashUntracked= 追加第三父文件。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_SHOW_PATH,
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const rev = url.searchParams.get('rev') ?? ''
        const base = url.searchParams.get('base') ?? ''
        const stashUntracked = url.searchParams.get('stashUntracked') ?? ''
        const hashOk = (v) => v === '' || /^[0-9a-f]{4,40}$/.test(v)
        if (rev !== UNCOMMITTED && !hashOk(rev)) return json(res, 400, { error: 'invalid rev' })
        if (!hashOk(base) || !hashOk(stashUntracked)) return json(res, 400, { error: 'invalid rev' })
        const root = workspaceRoot(ctx, url.searchParams.get('session') ?? '')
        if (!(await gitIsRepo(root))) return json(res, 200, { isRepo: false })
        if (rev === UNCOMMITTED) {
          const detail = await gitShowUncommitted(root)
          json(res, 200, { isRepo: true, ...detail })
          return
        }
        const detail = await gitShow(root, rev, base)
        if (stashUntracked !== '') {
          const extra = await gitShowStashUntracked(root, stashUntracked)
          detail.files.push(...extra.files)
          if (extra.patch !== '') detail.patch += extra.patch
          if (extra.truncated) detail.truncated = true
        }
        json(res, 200, { isRepo: true, ...detail })
      } catch (error) {
        json(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  // 分支操作（写路由）：POST JSON body
  // { action: 'checkout'|'create'|'delete'|'rename'|'merge'|'merge-abort'|'merge-continue',
  //   branch, remote, name, force, start, session }。
  // CSRF 防护：强制 application/json content-type（跨站表单无法伪造，同 dsh-git-graph）。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_BRANCH_PATH,
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
        const contentType = req.headers['content-type'] ?? ''
        if (!contentType.toLowerCase().startsWith('application/json')) {
          return json(res, 415, { error: 'unsupported media type' })
        }
        let body = ''
        for await (const chunk of req) body += chunk
        let payload = {}
        try {
          payload = JSON.parse(body || '{}')
        } catch {
          return json(res, 400, { error: 'malformed body' })
        }
        if (typeof payload !== 'object' || payload === null) return json(res, 400, { error: 'malformed body' })
        const action = payload.action
        const ACTIONS = ['checkout', 'create', 'delete', 'rename', 'merge', 'merge-abort', 'merge-continue']
        if (!ACTIONS.includes(action)) return json(res, 400, { error: 'unknown action' })
        const root = workspaceRoot(ctx, payload.session ?? '')
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        const result = await gitBranchAction(root, action, {
          branch: typeof payload.branch === 'string' ? payload.branch : '',
          remote: typeof payload.remote === 'string' ? payload.remote : '',
          name: typeof payload.name === 'string' ? payload.name : '',
          force: payload.force === true,
          start: typeof payload.start === 'string' ? payload.start : '',
        })
        json(res, 200, result)
      } catch (error) {
        json(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
      }
    },
  }))

  // 拉取远程（写路由）：POST JSON body
  // { remote: ''（全部）|'gitee', prune: bool, session }。
  // CSRF 防护同 branch 路由（强制 application/json）。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_FETCH_PATH,
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
        const contentType = req.headers['content-type'] ?? ''
        if (!contentType.toLowerCase().startsWith('application/json')) {
          return json(res, 415, { error: 'unsupported media type' })
        }
        let body = ''
        for await (const chunk of req) body += chunk
        let payload = {}
        try {
          payload = JSON.parse(body || '{}')
        } catch {
          return json(res, 400, { error: 'malformed body' })
        }
        if (typeof payload !== 'object' || payload === null) return json(res, 400, { error: 'malformed body' })
        const root = workspaceRoot(ctx, payload.session ?? '')
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        const result = await gitFetchAction(root, {
          remote: typeof payload.remote === 'string' ? payload.remote : '',
          prune: payload.prune === true,
        })
        json(res, 200, result)
      } catch (error) {
        json(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
      }
    },
  }))

  // 推送分支（写路由）：POST JSON body
  // { branch, remotes: ['origin', ...], setUpstream: bool,
  //   mode: 'normal'|'force-with-lease'|'force', session }（兼容旧单数 remote）。
  // CSRF 防护同 branch 路由（强制 application/json）。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_PUSH_PATH,
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
        const contentType = req.headers['content-type'] ?? ''
        if (!contentType.toLowerCase().startsWith('application/json')) {
          return json(res, 415, { error: 'unsupported media type' })
        }
        let body = ''
        for await (const chunk of req) body += chunk
        let payload = {}
        try {
          payload = JSON.parse(body || '{}')
        } catch {
          return json(res, 400, { error: 'malformed body' })
        }
        if (typeof payload !== 'object' || payload === null) return json(res, 400, { error: 'malformed body' })
        const root = workspaceRoot(ctx, payload.session ?? '')
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        const result = await gitPushAction(root, {
          branch: typeof payload.branch === 'string' ? payload.branch : '',
          // remotes：数组（多选推送）；兼容旧的单数 remote 字段
          remotes: Array.isArray(payload.remotes)
            ? payload.remotes.filter((r) => typeof r === 'string')
            : typeof payload.remote === 'string' && payload.remote !== ''
              ? [payload.remote]
              : [],
          setUpstream: payload.setUpstream === true,
          mode: typeof payload.mode === 'string' ? payload.mode : 'normal',
        })
        json(res, 200, result)
      } catch (error) {
        json(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
      }
    },
  }))

  // 远程/标签操作（写路由）：POST JSON body
  // { action: 'delete-branch'|'push-tag'|'delete-tag', branch, tag, remote, session }。
  // CSRF 防护同 branch 路由（强制 application/json）。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_REMOTE_PATH,
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
        const contentType = req.headers['content-type'] ?? ''
        if (!contentType.toLowerCase().startsWith('application/json')) {
          return json(res, 415, { error: 'unsupported media type' })
        }
        let body = ''
        for await (const chunk of req) body += chunk
        let payload = {}
        try {
          payload = JSON.parse(body || '{}')
        } catch {
          return json(res, 400, { error: 'malformed body' })
        }
        if (typeof payload !== 'object' || payload === null) return json(res, 400, { error: 'malformed body' })
        const action = payload.action
        const ACTIONS = ['delete-branch', 'push-tag', 'delete-tag']
        if (!ACTIONS.includes(action)) return json(res, 400, { error: 'unknown action' })
        const root = workspaceRoot(ctx, payload.session ?? '')
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        const result = await gitRemoteAction(root, action, {
          branch: typeof payload.branch === 'string' ? payload.branch : '',
          tag: typeof payload.tag === 'string' ? payload.tag : '',
          remote: typeof payload.remote === 'string' ? payload.remote : '',
        })
        json(res, 200, result)
      } catch (error) {
        json(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
      }
    },
  }))

  // stash 操作（写路由）：POST JSON body
  // { action: 'push'|'apply'|'pop'|'drop'|'branch', selector, message, includeUntracked,
  //   reinstateIndex, branch, session }。
  // CSRF 防护同 branch 路由（强制 application/json）。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_STASH_PATH,
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
        const contentType = req.headers['content-type'] ?? ''
        if (!contentType.toLowerCase().startsWith('application/json')) {
          return json(res, 415, { error: 'unsupported media type' })
        }
        let body = ''
        for await (const chunk of req) body += chunk
        let payload = {}
        try {
          payload = JSON.parse(body || '{}')
        } catch {
          return json(res, 400, { error: 'malformed body' })
        }
        if (typeof payload !== 'object' || payload === null) return json(res, 400, { error: 'malformed body' })
        const action = payload.action
        const ACTIONS = ['push', 'apply', 'pop', 'drop', 'branch']
        if (!ACTIONS.includes(action)) return json(res, 400, { error: 'unknown action' })
        const root = workspaceRoot(ctx, payload.session ?? '')
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        const result = await gitStashAction(root, action, {
          selector: typeof payload.selector === 'string' ? payload.selector : '',
          message: typeof payload.message === 'string' ? payload.message : '',
          includeUntracked: payload.includeUntracked === true,
          reinstateIndex: payload.reinstateIndex === true,
          branch: typeof payload.branch === 'string' ? payload.branch : '',
        })
        json(res, 200, result)
      } catch (error) {
        json(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
      }
    },
  }))

  // SSE 推送（GET /git/events?session=…，对齐社区 dsh-git-graph）：
  // 连接即推初始状态；订阅期间每 eventsPollMs 对比状态键，变化才推 `change`；
  // 每 eventsHeartbeatMs 写注释行保活。全部订阅断开后停表。
  const subscribers = new Set()
  let pollTimer = null
  let heartbeatTimer = null
  const sendEvent = (sub, event, data) => {
    sub.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
  const stopTimers = () => {
    if (subscribers.size !== 0) return
    if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
    if (heartbeatTimer !== null) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  }
  const startTimers = () => {
    if (pollTimer === null) pollTimer = setInterval(() => { void pollEvents() }, eventsPollMs)
    if (heartbeatTimer === null) {
      heartbeatTimer = setInterval(() => {
        for (const sub of subscribers) sub.res.write(': ping\n\n')
      }, eventsHeartbeatMs)
    }
  }
  const pollEvents = async () => {
    for (const sub of subscribers) {
      try {
        const status = await gitEventsStatus(sub.root)
        // await 窗口内可能断连：closed 后再检查一次，不写已关闭连接
        if (sub.closed) continue
        const key = gitStateKey(status)
        if (key === sub.lastKey) continue
        sub.lastKey = key
        sendEvent(sub, 'change', { key })
      } catch {
        // 单订阅者失败不影响其他；连接异常由 close 清理
      }
    }
  }
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_EVENTS_PATH,
    handler: async (req, res) => {
      if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
      const url = new URL(req.url ?? '/', 'http://dsh.internal')
      const root = workspaceRoot(ctx, url.searchParams.get('session') ?? '')
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      const sub = { root, res, lastKey: null }
      subscribers.add(sub)
      startTimers()
      const cleanup = () => {
        sub.closed = true
        subscribers.delete(sub)
        try { res.end() } catch { /* 已关闭 */ }
        stopTimers()
      }
      req.on('close', cleanup)
      res.on('close', cleanup)
      try {
        const status = await gitEventsStatus(root)
        const key = gitStateKey(status)
        sub.lastKey = key
        sendEvent(sub, 'change', { key })
      } catch {
        cleanup()
      }
    },
  }))
  disposers.push(() => {
    stopTimers()
    for (const sub of subscribers) {
      try { sub.res.end() } catch { /* 已关闭 */ }
    }
    subscribers.clear()
  })

  return () => {
    for (const dispose of disposers) dispose()
  }
}

// ---------- 测试导出（node:test 用；cordis 插件加载不受影响） ----------

export {
  UNCOMMITTED,
  runGit,
  gitHead,
  gitRemoteRefs,
  gitRemoteList,
  gitUncommittedCount,
  gitStashes,
  gitLog,
  gitLogV2,
  gitShow,
  gitShowUncommitted,
  gitShowStashUntracked,
  parseDecorations,
  parseNumstat,
  validateBranchName,
  validateRemoteRef,
  validateRemoteName,
  validateStashSelector,
  validateTagName,
  OVERWRITE_PATTERNS,
  extractBlockedPaths,
  classifySwitchFailure,
  classifyFetchFailure,
  classifyPushFailure,
  classifyStashFailure,
  gitOperationInProgress,
  gitOperationMarker,
  gitConflicts,
  gitCurrentBranch,
  gitGuardBlock,
  gitBranchAction,
  gitFetchAction,
  gitPushAction,
  gitRemoteAction,
  gitStashAction,
  gitRefExists,
}
