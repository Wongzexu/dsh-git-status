// dsh-git-status Node half：git 路由（commit 图数据 / 详情 diff / 分支操作）。
//
// 模式：自造数据通道（同 dsh-task-status），官方树零改动。
// - git 只读路由：spawn 系统 git（better-sidebar 模式：-C 工作区、--no-pager、
//   color.ui=false、GIT_OPTIONAL_LOCKS=0、超时强杀），命令与格式移植
//   mhutchie/vscode-git-graph 的 getLog/getCommitDetails：%H␟%P␟%an␟%ae␟%at␟%s
//   --date-order，scope=all 用 --branches --tags --remotes HEAD（非 --all）；
//   v2：未提交改动虚拟行 UNCOMMITTED + stash 列表组装。
// - 分支操作路由（唯一写路由）：POST + 强制 application/json content-type
//   （CSRF 防护，同 dsh-git-graph），分支名 check-ref-format --branch 权威校验 +
//   客户端镜像校验双保险，切换前守卫：冲突 / 进行中操作 / 其他 worktree 检出。

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const name = 'git-status'
export const inject = ['webServer', 'workspaceRegistry', 'sessions']

export const GIT_LOG_PATH = '/plugins/dsh-git-status/git/log'
export const GIT_SHOW_PATH = '/plugins/dsh-git-status/git/show'
export const GIT_BRANCH_PATH = '/plugins/dsh-git-status/git/branch'
export const GIT_EVENTS_PATH = '/plugins/dsh-git-status/git/events'

/** git 命令超时（毫秒）：超时强杀，防挂起。 */
const GIT_TIMEOUT = 15 * 1000
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
 * 返回 { total（文件数）, staged, unstaged }。
 */
async function gitUncommittedCount(root) {
  try {
    const out = await runGit(root, ['status', '--untracked-files=all', '--porcelain'])
    const lines = out.split(/\r?\n/).filter((line) => line !== '')
    let staged = 0
    let unstaged = 0
    for (const line of lines) {
      const x = line[0] ?? ' '
      const y = line[1] ?? ' '
      if (x !== ' ' && x !== '?') staged++
      if (y !== ' ' || (x === '?' && y === '?')) unstaged++
    }
    return { total: lines.length, staged, unstaged }
  } catch {
    return { total: 0, staged: 0, unstaged: 0 }
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
  const [head, stashes, uncommitted, remoteRefs, conflicts, operation] = await Promise.all([
    gitHead(root),
    gitStashes(root),
    gitUncommittedCount(root),
    gitRemoteRefs(root),
    gitConflicts(root),
    gitOperationMarker(root),
  ])
  const logResult = await gitLog(root, { ...opts, remoteRefs })
    .catch((error) => ({ commits: [], moreAvailable: false, logError: error }))
  if (logResult.logError !== undefined) {
    // log 失败但 HEAD 存在 → 真实错误，向上抛（路由 500）
    if (head !== null) throw logResult.logError
    return { commits: [], moreAvailable: false, head, uncommitted, conflicts, operationInProgress: operation !== null, operation }
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
  return { commits: rows, moreAvailable, head, uncommitted, conflicts, operationInProgress: operation !== null, operation }
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
 */
async function gitGuardBlock(root, target) {
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
  return null
}

/**
 * 分支操作（插件首个写路由，作用于磁盘工作树）：
 * - checkout：本地分支 `git switch --no-guess -- <branch>`；远程 start-point 时
 *   `git switch --no-guess -c <branch> -- <remoteFull>`（创建本地跟踪分支并检出）
 * - create：从当前 HEAD `git switch --no-guess -c <name>`（无 start-point）
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
      const blocked = await gitGuardBlock(root, undefined)
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
    const blocked = await gitGuardBlock(root, branch)
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
  const [head, uncommitted, conflicts, operation, branch] = await Promise.all([
    gitHead(root),
    gitUncommittedCount(root),
    gitConflicts(root),
    gitOperationMarker(root),
    gitCurrentBranch(root),
  ])
  return {
    root,
    head: head === null ? '' : head.hash,
    branch,
    staged: uncommitted.staged,
    unstaged: uncommitted.unstaged,
    conflicts,
    operation,
  }
}

/** 状态键：任何影响泳道图的仓库状态变化都会改键 → 触发推送。 */
function gitStateKey(status) {
  if (status === null) return 'no-repo'
  return `${status.root}|${status.head}|${status.branch}|${status.staged}|${status.unstaged}|${status.conflicts}|${status.operation}`
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
  OVERWRITE_PATTERNS,
  extractBlockedPaths,
  classifySwitchFailure,
  gitOperationInProgress,
  gitOperationMarker,
  gitConflicts,
  gitCurrentBranch,
  gitGuardBlock,
  gitBranchAction,
  gitRefExists,
}
