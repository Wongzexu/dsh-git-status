// @wongzexu/dsh-git-status Node half：git 路由（commit 图数据 / 详情 diff / 分支操作）。
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
import { readFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

export const name = '@wongzexu/dsh-git-status'
export const inject = ['webServer', 'workspaceRegistry', 'sessions']

export const GIT_LOG_PATH = '/plugins/dsh-gitstatus/git/log'
export const GIT_SHOW_PATH = '/plugins/dsh-gitstatus/git/show'
export const GIT_BRANCH_PATH = '/plugins/dsh-gitstatus/git/branch'
export const GIT_FETCH_PATH = '/plugins/dsh-gitstatus/git/fetch'
export const GIT_PUSH_PATH = '/plugins/dsh-gitstatus/git/push'
export const GIT_REMOTE_PATH = '/plugins/dsh-gitstatus/git/remote'
export const GIT_STASH_PATH = '/plugins/dsh-gitstatus/git/stash'
export const GIT_STAGE_PATH = '/plugins/dsh-gitstatus/git/stage'
export const GIT_DISCARD_PATH = '/plugins/dsh-gitstatus/git/discard'
export const GIT_COMMIT_PATH = '/plugins/dsh-gitstatus/git/commit'
export const GIT_CONFIG_PATH = '/plugins/dsh-gitstatus/git/config'
export const GIT_EVENTS_PATH = '/plugins/dsh-gitstatus/git/events'

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
 * 按当前会话解析工作区。浏览器请求必须携带 session，且只信任服务端会话里的
 * header.cwd；不能在 session 缺失/失效时回退到 registry 首项或 process.cwd，
 * 否则写操作可能静默作用于另一个项目。
 */
function resolveWorkspace(ctx, sessionId) {
  if (typeof sessionId !== 'string' || sessionId === '') {
    return { ok: false, status: 400, error: { code: 'session-required', message: 'session is required' } }
  }
  try {
    const session = ctx.sessions?.get?.(sessionId)
    const cwd = session?.header?.cwd
    if (typeof cwd === 'string' && cwd !== '') return { ok: true, root: cwd }
  } catch {
    // Treat lookup failures as an unknown session; never fall back to another workspace.
  }
  return { ok: false, status: 404, error: { code: 'session-not-found', message: 'session does not exist or has no workspace' } }
}

function workspaceError(res, workspace, write = false) {
  return json(res, workspace.status, write ? { ok: false, error: workspace.error } : { error: workspace.error })
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
async function gitLog(root, { n = 500, scope = 'all', followFirst = false, reflogs = false, remoteRefs } = {}) {
  const count = Math.max(1, Math.min(Math.floor(n) || 500, GIT_LOG_MAX))
  const fmt = '%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%D'
  const args = ['log', `--max-count=${count + 1}`, '--date-order', '--decorate=short', `--format=${fmt}`]
  if (followFirst) args.push('--first-parent')
  if (scope !== 'head') {
    args.push('--branches', '--tags')
    // 上游同款：--reflog 与 --branches/--tags/--remotes/HEAD 共存（实测无冲突），
    // 把仅被 reflog 提及（重置/变基丢弃）的提交也纳入图
    if (reflogs) args.push('--reflog')
    args.push('--remotes', 'HEAD')
  }
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

/** 存在即表示有 git 操作进行中的标记（同 dsh-git-graph OPERATION_MARKERS）。
 *  SQUASH_MSG：`git merge --squash` 的专属标记——squash 合并不写 MERGE_HEAD，
 *  但会留下 SQUASH_MSG（无冲突时停留在暂存态、冲突时停留在半合并态，均需收尾）。 */
const OPERATION_MARKERS = [
  'MERGE_HEAD', 'SQUASH_MSG', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG',
  'rebase-merge', 'rebase-apply', 'sequencer',
]

/** commit message 清理：去 NUL、去首尾空白、限长；空串返回 ''（调用方决定兜底文案）。 */
function sanitizeCommitMessage(message) {
  if (typeof message !== 'string') return ''
  const cleaned = message.replace(/\0/g, '').trim()
  return cleaned.length > 500 ? cleaned.slice(0, 500).trim() : cleaned
}

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
 *  （remote rejected）→ remote-rejected；tag 同名冲突（already exists）→
 *  remote-tag-exists；网络/认证复用 network-error 正则。
 *  注意：git push 的 stderr 首行通常是 "To <远程地址>"（推送目标），真实错误
 *  从第二行开始，head 取第一条非 To 行（找不到才回退首行）。 */
function classifyPushFailure(stderr) {
  const lines = stderr.trim().split('\n')
  const head = (lines.find((line) => !line.trimStart().startsWith('To ')) ?? lines[0] ?? stderr).trim()
  if (/\[rejected\].*already exists/.test(stderr)) {
    // 远程已有同名 tag 且指向不同提交（tag 推送特有拒绝）
    return { code: 'remote-tag-exists', message: head }
  }
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
 * - create：从当前 HEAD `git switch --no-guess -c <name>`；可选 start-point
 *   （tag 右键 `refs/tags/<tag>` / commit 行右键 `<hash>^{commit}`，均权威校验后传入）
 * - merge：把 <branch> 合并进当前分支 `git merge --no-edit <branch>`；
 *   noff 时 `--no-ff`（可快进也强制生成合并提交）；
 *   squash 时 `git merge --squash <branch>` + `git commit -m <message>`
 *   （压平为一个提交；squash 无 MERGE_HEAD，冲突中止/继续见 merge-abort/merge-continue）。
 * - force：checkout 时旁路未提交改动守卫（客户端确认后携带）；delete 时为强删。
 * - fastForward：本地分支 checkout 后把该分支快进到远程 ref（`git merge --ff-only`，
 *   对齐上游「Checkout the existing branch & pull changes」；分叉/领先时拒绝且分支不动）。
 * 返回 { ok: true, branch, fastForwarded?, squash? } 或 { ok: false, error: { code, message, paths?, moreFiles? } }。
 */
async function gitBranchAction(root, action, { branch = '', remote = '', name = '', force = false, start = '', noff = false, squash = false, message = '', fastForward = '', checkout = true } = {}) {
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
    // 快进到远程 ref（仅本地分支路径；远程创建路径上面已提前 return）。
    // 语义对齐 `git pull --ff-only`：本地分支必须是远程的祖先，分叉/领先都拒绝。
    // 目标存在性/格式在切换前校验：目标坏了 → 不切换（不做半状态）。
    if (fastForward !== '') {
      if (!validateRemoteRef(fastForward)) return error('invalid-branch-name', 'invalid remote ref')
      try {
        await runGit(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/${fastForward}`])
      } catch {
        return error('target-branch-not-found', `remote branch "${fastForward}" does not exist`)
      }
    }
    const blocked = await gitGuardBlock(root, branch, { checkUncommitted: force !== true })
    if (blocked !== null) return { ok: false, error: blocked }
    try {
      await runGit(root, ['switch', '--no-guess', '--', branch])
    } catch (err) {
      return { ok: false, error: classifySwitchFailure(err instanceof Error ? err.message : String(err)) }
    }
    if (fastForward !== '') {
      try {
        await runGit(root, ['merge', '--ff-only', fastForward])
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const blockedPaths = extractBlockedPaths(msg, /Your local changes to the following files would be overwritten by merge/)
        if (blockedPaths.paths.length > 0) {
          return {
            ok: false,
            error: { code: 'tracked-changes-would-be-overwritten', message: msg, paths: blockedPaths.paths, moreFiles: blockedPaths.moreFiles },
          }
        }
        if (/Not possible to fast-forward|fast-forward.+abort/i.test(msg)) {
          // 分叉/领先：不给 message，客户端只显示本地化文案（避免中英混杂）。
          return error('cannot-fast-forward', '')
        }
        return error('fast-forward-failed', (msg.split('\n')[0] ?? msg).trim())
      }
      return { ok: true, branch, fastForwarded: true }
    }
    return { ok: true, branch }
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
    if (remote !== '') {
      if (!validateRemoteRef(remote)) return error('invalid-start-point', 'invalid remote ref')
      try {
        await runGit(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/${remote}`])
      } catch {
        return error('start-point-not-found', `remote branch "${remote}" does not exist`)
      }
      try {
        await runGit(root, ['branch', '--track', name, remote])
        return { ok: true, branch: name }
      } catch (err) {
        return { ok: false, error: classifySwitchFailure(err instanceof Error ? err.message : String(err)) }
      }
    }
    // 可选 start-point：tag 右键（refs/tags/<start>）或 commit 行右键（<hash>^{commit}），
    // 权威校验后 `switch -c <name> -- <start>`（argv 数组无 shell；`--` 挡选项注入）。
    // hex 形态按 commit hash 走（7–40 位，`^{commit}` 剥壳必须解析到 commit 对象）；
    // 其余按 tag 名走（形态校验 + refs/tags 存在性）。
    let startArgs = []
    if (start !== '') {
      if (/^[0-9a-f]{7,40}$/i.test(start)) {
        try {
          await runGit(root, ['rev-parse', '--verify', '--quiet', `${start}^{commit}`])
        } catch {
          return error('start-point-not-found', `commit "${start}" does not exist`)
        }
      } else {
        if (!validateRemoteRef(start)) return error('invalid-start-point', 'invalid start point')
        try {
          await runGit(root, ['rev-parse', '--verify', '--quiet', `refs/tags/${start}`])
        } catch {
          return error('start-point-not-found', `tag "${start}" does not exist`)
        }
      }
      startArgs = ['--', start]
    }
    try {
      await runGit(root, checkout === true
        ? ['switch', '--no-guess', '-c', name, ...startArgs]
        : ['branch', name, ...(startArgs.length > 0 ? [startArgs[1]] : [])])
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
    if (squash === true) {
      // squash 合并：`git merge --squash` 只暂存不提交（无 MERGE_HEAD，
      // 留下 SQUASH_MSG 标记），随后自动 `git commit` 收尾。
      // 冲突时停留在半合并态：中止走 merge-abort（reset 路径）、
      // 解决后继续走 merge-continue（commit 路径）。
      try {
        await runGit(root, ['merge', '--squash', branch])
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
      // commit 失败（如无作者信息）：squash 结果已暂存、SQUASH_MSG 在，
      // 属于可收尾状态——转 merge-conflicts-remain，让合并条兜底（abort/continue）。
      const finalMessage = sanitizeCommitMessage(message) || `Squash 合并 ${branch}`
      try {
        await runGit(root, ['commit', '-m', finalMessage])
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/Committing is not possible|unmerged files/.test(msg)) {
          return error('merge-conflicts-remain', (msg.split('\n')[0] ?? msg).trim())
        }
        return { ok: false, error: classifySwitchFailure(msg) }
      }
      return { ok: true, branch, squash: true }
    }
    try {
      // noff（NoFF/禁用快进）：可快进时也强制生成合并提交；argv 数组无 shell，参数固定无注入面。
      const args = ['merge', '--no-edit']
      if (noff === true) args.push('--no-ff')
      args.push(branch)
      await runGit(root, args)
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
  if (action === 'merge-abort') {
    const marker = await gitOperationMarker(root)
    if (marker === 'SQUASH_MSG') {
      // squash 中止：无 MERGE_HEAD，`git merge --abort` 不可用（fatal: 没有要终止的合并）。
      // 恢复方案：先收集本次合并新增且已暂存的文件（-z 原始路径，合并前不存在，
      // 删除无副作用），再 `git reset --hard HEAD` 还原跟踪文件与索引。
      try {
        const addedOut = await runGit(root, ['diff', '--cached', '--name-only', '-z', '--diff-filter=A'])
        const added = addedOut.split('\0').filter((line) => line !== '')
        await runGit(root, ['reset', '--hard', 'HEAD'])
        for (const p of added) {
          try { await rm(resolve(root, p), { force: true }) } catch { /* 路径已不存在 */ }
        }
        return { ok: true, branch: '' }
      } catch (err) {
        return { ok: false, error: classifySwitchFailure(err instanceof Error ? err.message : String(err)) }
      }
    }
    try {
      await runGit(root, ['merge', '--abort'])
      return { ok: true, branch: '' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/There is no merge to abort|no merge in progress/.test(msg)) {
        return error('no-merge-in-progress', (msg.split('\n')[0] ?? msg).trim())
      }
      return { ok: false, error: classifySwitchFailure(msg) }
    }
  }
  if (action === 'merge-continue') {
    const marker = await gitOperationMarker(root)
    if (marker === 'SQUASH_MSG') {
      // squash 继续：无 MERGE_HEAD，`git merge --continue` 不可用；
      // 需保证冲突已解决并 `git add`，再 `git commit` 收尾。
      // 提交信息：客户端发起 squash 时记住的 message 优先，
      // 兜底用 git 生成的 SQUASH_MSG 内容（被压平的提交清单）。
      try {
        const count = await gitConflicts(root)
        if (count > 0) return error('merge-conflicts-remain', `${count} unresolved conflict(s)`)
        const msg = sanitizeCommitMessage(message)
        if (msg !== '') {
          await runGit(root, ['commit', '-m', msg])
        } else {
          const sqPath = (await runGit(root, ['rev-parse', '--git-path', 'SQUASH_MSG'])).trim()
          await runGit(root, ['commit', '-F', resolve(root, sqPath === '' ? '.git/SQUASH_MSG' : sqPath)])
        }
        return { ok: true, branch: '' }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/Committing is not possible|unmerged files|no changes added/.test(msg)) {
          return error('merge-conflicts-remain', (msg.split('\n')[0] ?? msg).trim())
        }
        return { ok: false, error: classifySwitchFailure(msg) }
      }
    }
    try {
      // --continue 不接受 --no-edit（fatal: expects no arguments）
      await runGit(root, ['merge', '--continue'])
      return { ok: true, branch: '' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/Committing is not possible|unmerged files/.test(msg)) {
        return error('merge-conflicts-remain', (msg.split('\n')[0] ?? msg).trim())
      }
      if (/no merge in progress/.test(msg)) {
        return error('no-merge-in-progress', (msg.split('\n')[0] ?? msg).trim())
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
 *   setUpstream 为 true 时仅第一个远程写入 tracking 配置（分支只能有一个 upstream）；
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
  for (let i = 0; i < remotes.length; i++) {
    const remote = remotes[i]
    const args = ['push', remote, branch]
    if (setUpstream === true && i === 0) args.push('--set-upstream')
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
 * 远程/标签操作（写路由，镜像上游 deleteRemoteBranch / pushTag / deleteTag / addTag）：
 * - add-tag：创建 tag（`git tag [-f] [-a <name> -m <message>] <name> <hash>`），
 *   remotes 非空时创建成功后逐个 `git push <remote> <tag>`（上游 Add Tag 对话框 +
 *   addTag/pushTagToMultipleRemotes 语义：多远程顺序推、部分失败收集上报，tag 保留本地）
 * - delete-branch：`git push <remote> --delete <branch>`；失败且报 remote ref does
 *   not exist（远程分支已不存在）→ 降级 `git branch -d -r <remote>/<branch>` 只删
 *   本地跟踪 ref（ok: { degraded: true }，上游 deleteRemoteBranch 语义）
 * - push-tag：`git push <remote> <tag>`（失败分类复用 classifyPushFailure）
 * - delete-tag：remote 非空时先 `git push <remote> --delete <tag>` 再 `git tag -d <tag>`
 *   （上游顺序：远程失败则整体失败、本地不删）；remote 空 = 仅删本地
 * 校验：branch/tag/remote 名白名单 + check-ref-format 权威 + 存在性。
 * 返回 { ok: true, degraded? } 或 { ok: false, error: { code, message } }。
 */
async function gitRemoteAction(root, action, { branch = '', tag = '', remote = '', remotes = [], hash = '', type = '', message = '', force = false } = {}) {
  const error = (code, message) => ({ ok: false, error: { code, message } })
  const remoteOk = async () => {
    if (!validateRemoteName(remote)) return error('invalid-remote-name', 'invalid remote name')
    const remotes = await gitRemoteList(root)
    if (!remotes.includes(remote)) return error('remote-not-found', `remote "${remote}" does not exist`)
    return null
  }
  if (action === 'add-tag') {
    // 创建 tag（镜像上游 addTagAction 对话框语义）：
    // - tag 名 validateTagName + check-ref-format 权威（同 push/delete-tag）
    // - hash：hex 7–40 形态 + `rev-parse <hash>^{commit}` 权威校验（commit 行右键传全 hash）
    // - type 白名单（lightweight / annotated）；annotated 带 -m message（可选空串）
    // - 同名 tag 且非 force → tag-already-exists（客户端确认「替换？」后带 force 重试）
    // - remotes：目标远程数组（可空 = 不推送；多远程顺序推，同上游
    //   pushTagToMultipleRemotes），逐项白名单 + 存在性权威校验；
    //   推送失败收集上报（部分失败也返回，code=push-failed，tag 保留本地）
    if (!validateTagName(tag)) return error('invalid-tag-name', 'invalid tag name')
    try {
      await runGit(root, ['check-ref-format', `refs/tags/${tag}`])
    } catch (err) {
      return error('invalid-tag-name', err instanceof Error ? err.message : 'invalid tag name')
    }
    if (typeof hash !== 'string' || !/^[0-9a-f]{7,40}$/i.test(hash)) {
      return error('invalid-commit', 'invalid commit hash')
    }
    try {
      await runGit(root, ['rev-parse', '--verify', '--quiet', `${hash}^{commit}`])
    } catch {
      return error('commit-not-found', `commit "${hash}" does not exist`)
    }
    if (type !== 'lightweight' && type !== 'annotated') return error('invalid-tag-type', 'invalid tag type')
    if (!Array.isArray(remotes)) return error('invalid-remote-name', 'invalid remotes')
    if (remotes.some((r) => typeof r !== 'string' || !validateRemoteName(r))) {
      return error('invalid-remote-name', 'invalid remote name')
    }
    if (remotes.length > 0) {
      const remoteSet = await gitRemoteList(root)
      for (const r of remotes) {
        if (!remoteSet.includes(r)) return error('remote-not-found', `remote "${r}" does not exist`)
      }
    }
    if (force !== true && (await gitRefExists(root, `refs/tags/${tag}`))) {
      return error('tag-already-exists', `tag "${tag}" already exists`)
    }
    const args = ['tag']
    if (force === true) args.push('-f')
    if (type === 'annotated') args.push('-a', tag, '-m', typeof message === 'string' ? message : '')
    else args.push(tag)
    args.push(hash)
    try {
      await runGit(root, args)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const head = (msg.split('\n')[0] ?? msg).trim()
      if (/already exists/.test(msg)) return error('tag-already-exists', head)
      return { ok: false, error: { code: 'internal', message: head } }
    }
    // 逐个推送（顺序，同上游 pushTagToMultipleRemotes）；部分失败也返回，
    // failed 明细（remote + 分类错误）由客户端提示「tag 已创建，推送部分失败」
    const failed = []
    for (const r of remotes) {
      try {
        await runGit(root, ['push', r, tag], GIT_FETCH_TIMEOUT)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const classified = classifyPushFailure(msg)
        failed.push(`${r}: ${classified.message}`)
      }
    }
    if (failed.length > 0) {
      return { ok: false, error: { code: 'push-failed', message: failed.join('; ') } }
    }
    // 无推送目标时只回 { ok: true }（不带 pushed 噪音字段）
    return remotes.length > 0 ? { ok: true, pushed: remotes } : { ok: true }
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
 * - push：`git stash push [-m <message>] [-u]`（未提交行右键「贮藏未提交改动」）
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

/** 暂存工作区全部改动：`git add -A`，包含新增、修改和删除。 */
async function gitStageAction(root) {
  try {
    await runGit(root, ['add', '-A'])
    return { ok: true, counts: await gitUncommittedCount(root) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: { code: 'internal', message: (message.split('\n')[0] ?? message).trim() } }
  }
}

/**
 * 放弃全部未提交改动（不可恢复）：
 * - 已跟踪改动（index + worktree）：HEAD 存在 → `git reset --hard HEAD`；
 *   无提交（unborn，reset HEAD 会报 ambiguous）→ `git read-tree --empty` 清空索引，
 *   所有文件跌落为未跟踪交由下一步处理。
 * - 未跟踪文件/目录：`git clean -fd` 删除（不含被忽略文件，与状态面板口径一致）。
 * 返回 { ok, counts }（clean 后的未提交计数，正常应为 0）。
 */
async function gitDiscardAction(root) {
  try {
    if ((await gitHead(root)) === null) {
      await runGit(root, ['read-tree', '--empty'])
    } else {
      await runGit(root, ['reset', '--hard', 'HEAD'])
    }
    await runGit(root, ['clean', '-fd'])
    return { ok: true, counts: await gitUncommittedCount(root) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: { code: 'internal', message: (message.split('\n')[0] ?? message).trim() } }
  }
}

/** 从 git commit 失败输出中提取稳定错误码。 */
function classifyCommitFailure(error) {
  const message = error instanceof Error ? error.message : String(error)
  const stdout = error instanceof Error && typeof error.stdout === 'string' ? error.stdout : ''
  const text = `${message}\n${stdout}`
  const firstLine = (text.split('\n').find((line) => line.trim() !== '') ?? text).trim()
  if (/Please tell me who you are|Author identity unknown|user\.name|user\.email/i.test(text)) {
    return { code: 'identity-missing', message: firstLine }
  }
  if (/nothing to commit|no changes added to commit|no changes to commit/i.test(text)) {
    return { code: 'nothing-to-commit', message: firstLine }
  }
  if (/unmerged|needs merge|you have unmerged paths/i.test(text)) {
    return { code: 'unmerged-files', message: firstLine }
  }
  if (/hook|pre-commit|commit-msg|prepare-commit-msg|post-commit/i.test(text)) {
    return { code: 'commit-hook-failed', message: firstLine }
  }
  if (/does not have any commits yet|cannot amend|nothing to amend|no such commit|HEAD does not exist/i.test(text)) {
    return { code: 'no-commit-to-amend', message: firstLine }
  }
  return { code: 'internal', message: firstLine }
}

/** 提交 index 内容；普通提交不允许无 staged，amend 可只修改上一条提交消息。 */
async function gitCommitAction(root, { message = '', amend = false } = {}) {
  const fail = (code, detail) => ({ ok: false, error: { code, message: detail } })
  if (typeof message !== 'string' || message.trim() === '') return fail('empty-commit-message', 'commit message is empty')
  const user = await gitUserConfig(root)
  const name = user.name.local ?? user.name.global
  const email = user.email.local ?? user.email.global
  if (name === null || name === '' || email === null || email === '') {
    return fail('identity-missing', 'git user.name and user.email are required')
  }
  if (amend === true) {
    if ((await gitHead(root)) === null) return fail('no-commit-to-amend', 'there is no commit to amend')
  } else if ((await gitUncommittedCount(root)).staged === 0) {
    return fail('nothing-to-commit', 'there are no staged changes to commit')
  }
  const args = ['commit']
  if (amend === true) args.push('--amend')
  args.push('-m', message)
  try {
    await runGit(root, args)
    const head = await gitHead(root)
    if (head === null) return fail('internal', 'commit succeeded but HEAD could not be read')
    return { ok: true, hash: head.hash }
  } catch (err) {
    return { ok: false, error: classifyCommitFailure(err) }
  }
}

// ---------- 远程配置（设置弹窗「远程配置」区块：读取 + add/edit/delete 管理） ----------
// 读取走 local 层 remote.<name>.url / remote.<name>.pushurl（远程是仓库级概念）；
// 写入镜像 git remote add / rename / set-url / remove 语义，权威校验在 git 侧。

/** 远程 URL 形态安全网（权威校验在 git add/set-url）：string、非空、≤500、无控制字符。
 *  协议形态（http/https/ssh/git/file/scp 风格 git@host:path 等）交给 git 判错分类。 */
function validateRemoteUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return false
  if (value.length > 500) return false
  if (/[\x00-\x1f\x7f]/.test(value)) return false
  return true
}

/** 读取本地层远程配置：聚合 remote.<name>.url / remote.<name>.pushurl。
 *  注意：远程名大小写敏感（git remote 名原样保留，MyRemote 与 myremote 是两个
 *  不同远程），不能走 parseConfigList 的小写化（会合并大小写变体、丢掉原名）。
 *  这里直接解析 `git config --local --list` 原始输出，正则匹配大小写不敏感、
 *  名称部分保留原始大小写。返回按名排序的 [{ name, url, pushUrl }]；
 *  pushUrl 无 → null（UI 显示「同 fetch URL」）。失败返回 []（同 gitConfigList）。 */
async function gitRemoteConfig(root) {
  try {
    const stdout = await runGit(root, ['config', '--local', '--list'])
    const byName = new Map()
    for (const line of String(stdout).split('\n')) {
      const eq = line.indexOf('=')
      if (eq <= 0) continue // 空行/续行（value 含换行时 git 输出续行块，无 `=` 前缀键）
      const key = line.slice(0, eq).trim()
      const m = /^remote\.(.+)\.(url|pushurl)$/i.exec(key)
      if (m === null) continue
      const name = m[1] // 保留原始大小写
      const value = line.slice(eq + 1)
      if (value === '') continue
      let entry = byName.get(name)
      if (entry === undefined) {
        entry = { name, url: null, pushUrl: null }
        byName.set(name, entry)
      }
      if (m[2].toLowerCase() === 'url') entry.url = value
      else entry.pushUrl = value
    }
    return [...byName.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ name: e.name, url: e.url, pushUrl: e.pushUrl }))
  } catch {
    return []
  }
}

/** 远程配置管理（写路由，设置弹窗「远程配置」区块）：
 * - add-remote：{ name, url, pushUrl? } → `git remote add <name> <url>`，
 *   pushUrl 非空再 `git remote set-url --push <name> <pushUrl>`
 * - edit-remote：{ name, newName?, url?, pushUrl? } → 先 rename（改名连带迁移
 *   refs/remotes/<name>/* 跟踪分支），再 set-url；pushUrl 空串 = 清除（unset-all，
 *   key 不存在 exit 5 静默），非空 = set-url --push；字段缺省（null/''）= 不动
 * - delete-remote：{ name } → `git remote remove <name>`（连带删除跟踪分支）
 * 校验：validateRemoteName + gitRemoteList 存在性权威校验（同 fetch/push）；
 *  rename 目标名额外校验不存在（git remote rename 权威）。
 * 返回 { ok: true } 或 { ok: false, error: { code, message } }。
 */
async function gitRemoteManageAction(root, action, { name = '', newName = '', url = '', pushUrl = null } = {}) {
  const error = (code, message) => ({ ok: false, error: { code, message } })
  const head = (msg) => (msg.split('\n')[0] ?? msg).trim()
  if (action === 'add-remote') {
    if (!validateRemoteName(name)) return error('invalid-remote-name', 'invalid remote name')
    if (!validateRemoteUrl(url)) return error('invalid-remote-url', 'invalid remote url')
    if (pushUrl !== null && pushUrl !== '' && !validateRemoteUrl(pushUrl)) {
      return error('invalid-remote-url', 'invalid push url')
    }
    const remotes = await gitRemoteList(root)
    if (remotes.includes(name)) return error('remote-already-exists', `remote "${name}" already exists`)
    try {
      await runGit(root, ['remote', 'add', name, url])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/already exists/.test(msg)) return error('remote-already-exists', head(msg))
      return { ok: false, error: { code: 'internal', message: head(msg) } }
    }
    if (pushUrl !== null && pushUrl !== '') {
      try {
        await runGit(root, ['remote', 'set-url', '--push', name, pushUrl])
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, error: { code: 'internal', message: head(msg) } }
      }
    }
    return { ok: true, remotes: await gitRemoteConfig(root) }
  }
  if (action === 'edit-remote') {
    if (!validateRemoteName(name)) return error('invalid-remote-name', 'invalid remote name')
    const remotes = await gitRemoteList(root)
    if (!remotes.includes(name)) return error('remote-not-found', `remote "${name}" does not exist`)
    const target = newName !== '' && newName !== name ? newName : null
    if (target !== null) {
      if (!validateRemoteName(target)) return error('invalid-remote-name', 'invalid remote name')
      if (remotes.includes(target)) return error('remote-already-exists', `remote "${target}" already exists`)
      try {
        await runGit(root, ['remote', 'rename', name, target])
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/already exists/.test(msg)) return error('remote-already-exists', head(msg))
        return { ok: false, error: { code: 'internal', message: head(msg) } }
      }
      name = target // 后续 set-url 统一用新名
    }
    if (url !== '') {
      if (!validateRemoteUrl(url)) return error('invalid-remote-url', 'invalid remote url')
      try {
        await runGit(root, ['remote', 'set-url', name, url])
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, error: { code: 'internal', message: head(msg) } }
      }
    }
    if (pushUrl !== null) {
      if (pushUrl === '') {
        // 清除 push URL（回到「同 fetch URL」）；key 不存在时 exit 5 静默
        try {
          await runGit(root, ['config', '--local', '--unset-all', `remote.${name}.pushurl`])
        } catch (err) {
          if (err.code !== 5) {
            const msg = err instanceof Error ? err.message : String(err)
            return { ok: false, error: { code: 'internal', message: head(msg) } }
          }
        }
      } else {
        if (!validateRemoteUrl(pushUrl)) return error('invalid-remote-url', 'invalid push url')
        try {
          await runGit(root, ['remote', 'set-url', '--push', name, pushUrl])
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return { ok: false, error: { code: 'internal', message: head(msg) } }
        }
      }
    }
    return { ok: true, remotes: await gitRemoteConfig(root) }
  }
  if (action === 'delete-remote') {
    if (!validateRemoteName(name)) return error('invalid-remote-name', 'invalid remote name')
    const remotes = await gitRemoteList(root)
    if (!remotes.includes(name)) return error('remote-not-found', `remote "${name}" does not exist`)
    try {
      await runGit(root, ['remote', 'remove', name])
      return { ok: true, remotes: await gitRemoteConfig(root) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: { code: 'internal', message: head(msg) } }
    }
  }
  return error('internal', 'unknown action')
}

// ---------- 用户信息（git config user.name / user.email，移植上游 User Details） ----------
// 读取 local/global 两层值；写入支持 set/delete/switch-layer（层级迁移）。
// 上游语义：写 global 时若有 local 值先清 local（防遮蔽）；删除只删当前生效层。

/** 解析 `git config --list` 输出：小写键 → 值（多值取最后一个，同 `git config <key>` 语义）。 */
function parseConfigList(stdout) {
  const map = new Map()
  for (const line of String(stdout).split('\n')) {
    const eq = line.indexOf('=')
    if (eq <= 0) continue // 空行/续行（value 含换行时 git 输出续行块，无 `=` 前缀键）
    map.set(line.slice(0, eq).trim().toLowerCase(), line.slice(eq + 1))
  }
  return map
}

/** 读取指定层 git config 列表；配置文件不存在等失败 → 空 Map（无 ~/.gitconfig 属常态）。 */
async function gitConfigList(root, location) {
  try {
    const stdout = await runGit(root, ['config', `--${location}`, '--list'])
    return parseConfigList(stdout)
  } catch {
    return new Map()
  }
}

/** 读取 user.name/user.email 的 local/global 两层值。 */
async function gitUserConfig(root) {
  const [local, global] = await Promise.all([gitConfigList(root, 'local'), gitConfigList(root, 'global')])
  const pick = (key) => ({ local: local.get(key) ?? null, global: global.get(key) ?? null })
  return { name: pick('user.name'), email: pick('user.email') }
}

/** user 配置值校验：string、≤100 字符、无控制字符。合法返回 null，否则返回稳定原因。 */
function validateUserConfigValue(value) {
  if (typeof value !== 'string') return 'invalid-value'
  if (value.length > 100) return 'value-too-long'
  if (/[\u0000-\u001f\u007f]/.test(value)) return 'invalid-characters'
  return null
}

/** 写入单个 user 配置项；value 为空串 → unset（key 不存在时 git 退出码 5，静默）。
 *  location=global 时先清 local 同名键（防遮蔽，同上游 deleteLocalName 语义）。 */
async function gitUserConfigWriteOne(root, location, key, value) {
  if (value === '') {
    try {
      await runGit(root, ['config', `--${location}`, '--unset-all', key])
    } catch (error) {
      if (error.code !== 5) throw error
    }
    return
  }
  if (location === 'global') {
    try {
      await runGit(root, ['config', '--local', '--unset-all', key])
    } catch (error) {
      if (error.code !== 5) throw error
    }
  }
  await runGit(root, ['config', `--${location}`, key, value])
}

/** 设置用户信息（set）：{ location, name?, email? }；字段缺省（null/undefined）= 不动，空串 = 删除该项。
 *  返回写入后的最新 user 状态。 */
async function gitUserConfigSet(root, { location = 'local', name = null, email = null } = {}) {
  if (location !== 'local' && location !== 'global') throw new Error('invalid-location')
  if (name !== null) {
    const reason = validateUserConfigValue(name)
    if (reason !== null) throw new Error(reason)
    await gitUserConfigWriteOne(root, location, 'user.name', name)
  }
  if (email !== null) {
    const reason = validateUserConfigValue(email)
    if (reason !== null) throw new Error(reason)
    await gitUserConfigWriteOne(root, location, 'user.email', email)
  }
  return gitUserConfig(root)
}

/** 删除用户信息项（delete）：{ location, field: 'name'|'email' }（只删指定层，另一层有值则保留）。 */
async function gitUserConfigDelete(root, { location = 'local', field = 'name' } = {}) {
  if (location !== 'local' && location !== 'global') throw new Error('invalid-location')
  if (field !== 'name' && field !== 'email') throw new Error('invalid-field')
  await gitUserConfigWriteOne(root, location, `user.${field}`, '')
  return gitUserConfig(root)
}

/** 迁移用户信息项层级（switch-layer）：{ field, to }，取当前生效值写入目标层。
 *  to=global：移动（写 global + 清 local 遮蔽）；to=local：复制（写 local，global 保留供其它仓库用）。 */
async function gitUserConfigSwitch(root, { field = 'name', to = 'global' } = {}) {
  if (field !== 'name' && field !== 'email') throw new Error('invalid-field')
  if (to !== 'local' && to !== 'global') throw new Error('invalid-location')
  const user = await gitUserConfig(root)
  const value = user[field].local ?? user[field].global
  if (value === null) throw new Error('no-value')
  await gitUserConfigWriteOne(root, to, `user.${field}`, value)
  return gitUserConfig(root)
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
  ctx.effect(() => registerRoutes(ctx), '@wongzexu/dsh-git-status: git log/show/branch/events routes')
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

  // 提交历史（泳道图数据）：?n= 数量 &scope=all|head &follow=1 &reflogs=1
  // v2：响应含组装后的虚拟行（UNCOMMITTED/stash）+ head + uncommitted 计数 +
  // conflicts/operationInProgress 状态。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_LOG_PATH,
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const workspace = resolveWorkspace(ctx, url.searchParams.get('session') ?? '')
        if (!workspace.ok) return workspaceError(res, workspace)
        const root = workspace.root
        if (!(await gitIsRepo(root))) return json(res, 200, { isRepo: false, commits: [], moreAvailable: false })
        const result = await gitLogV2(root, {
          n: Number(url.searchParams.get('n')) || 500,
          scope: url.searchParams.get('scope') === 'head' ? 'head' : 'all',
          followFirst: url.searchParams.get('follow') === '1',
          reflogs: url.searchParams.get('reflogs') === '1',
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
        const workspace = resolveWorkspace(ctx, url.searchParams.get('session') ?? '')
        if (!workspace.ok) return workspaceError(res, workspace)
        const root = workspace.root
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
  //   branch, remote, name, force, start, noff, squash, message, fastForward, session }。
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
        const workspace = resolveWorkspace(ctx, payload.session ?? '')
        if (!workspace.ok) return workspaceError(res, workspace, true)
        const root = workspace.root
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        const result = await gitBranchAction(root, action, {
          branch: typeof payload.branch === 'string' ? payload.branch : '',
          remote: typeof payload.remote === 'string' ? payload.remote : '',
          name: typeof payload.name === 'string' ? payload.name : '',
          force: payload.force === true,
          start: typeof payload.start === 'string' ? payload.start : '',
          noff: payload.noff === true,
          squash: payload.squash === true,
          message: typeof payload.message === 'string' ? payload.message : '',
          fastForward: typeof payload.fastForward === 'string' ? payload.fastForward : '',
          checkout: payload.checkout !== false,
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
        const workspace = resolveWorkspace(ctx, payload.session ?? '')
        if (!workspace.ok) return workspaceError(res, workspace, true)
        const root = workspace.root
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
        const workspace = resolveWorkspace(ctx, payload.session ?? '')
        if (!workspace.ok) return workspaceError(res, workspace, true)
        const root = workspace.root
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
  // { action: 'delete-branch'|'push-tag'|'delete-tag'|'add-tag', branch, tag, remote,
  //   remotes, hash, type, message, force, session }。
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
        const ACTIONS = ['delete-branch', 'push-tag', 'delete-tag', 'add-tag', 'add-remote', 'edit-remote', 'delete-remote']
        if (!ACTIONS.includes(action)) return json(res, 400, { error: 'unknown action' })
        const workspace = resolveWorkspace(ctx, payload.session ?? '')
        if (!workspace.ok) return workspaceError(res, workspace, true)
        const root = workspace.root
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        // 远程配置管理（设置弹窗）与 远程分支/tag 操作（图右键菜单）分流
        const result = (action === 'add-remote' || action === 'edit-remote' || action === 'delete-remote')
          ? await gitRemoteManageAction(root, action, {
              name: typeof payload.name === 'string' ? payload.name : '',
              newName: typeof payload.newName === 'string' ? payload.newName : '',
              url: typeof payload.url === 'string' ? payload.url : '',
              pushUrl: typeof payload.pushUrl === 'string' ? payload.pushUrl : null,
            })
          : await gitRemoteAction(root, action, {
              branch: typeof payload.branch === 'string' ? payload.branch : '',
              tag: typeof payload.tag === 'string' ? payload.tag : '',
              remote: typeof payload.remote === 'string' ? payload.remote : '',
              remotes: Array.isArray(payload.remotes) ? payload.remotes.filter((r) => typeof r === 'string') : [],
              hash: typeof payload.hash === 'string' ? payload.hash : '',
              type: typeof payload.type === 'string' ? payload.type : '',
              message: typeof payload.message === 'string' ? payload.message : '',
              force: payload.force === true,
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
        const workspace = resolveWorkspace(ctx, payload.session ?? '')
        if (!workspace.ok) return workspaceError(res, workspace, true)
        const root = workspace.root
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

  // 暂存全部改动（写路由）：POST JSON body { session }。
  // `git add -A` 包含新增、修改和删除，严格绑定当前 session 工作区。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_STAGE_PATH,
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
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return json(res, 400, { error: 'malformed body' })
        const workspace = resolveWorkspace(ctx, payload.session ?? '')
        if (!workspace.ok) return workspaceError(res, workspace, true)
        const root = workspace.root
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        json(res, 200, await gitStageAction(root))
      } catch (error) {
        json(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
      }
    },
  }))

  // 放弃全部未提交改动（写路由）：POST JSON body { session }。
  // `git reset --hard HEAD` + `git clean -fd`，含未跟踪文件，不可恢复；
  // CSRF 防护同 stage 路由（强制 application/json）。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_DISCARD_PATH,
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
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return json(res, 400, { error: 'malformed body' })
        const workspace = resolveWorkspace(ctx, payload.session ?? '')
        if (!workspace.ok) return workspaceError(res, workspace, true)
        const root = workspace.root
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        json(res, 200, await gitDiscardAction(root))
      } catch (error) {
        json(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
      }
    },
  }))

  // 提交已暂存内容（写路由）：POST JSON body { message, amend, session }。
  // 普通提交只提交 index；amend 允许没有新的 staged 改动但必须存在 HEAD。
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_COMMIT_PATH,
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
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return json(res, 400, { error: 'malformed body' })
        const workspace = resolveWorkspace(ctx, payload.session ?? '')
        if (!workspace.ok) return workspaceError(res, workspace, true)
        const root = workspace.root
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        json(res, 200, await gitCommitAction(root, {
          message: typeof payload.message === 'string' ? payload.message : '',
          amend: payload.amend === true,
        }))
      } catch (error) {
        json(res, 500, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
      }
    },
  }))

  // 用户信息（git config user.name/email，移植上游 User Details 区块）：GET 读 / POST 写。
  // GET /git/config → { ok, isRepo, user: { name: { local, global }, email: { local, global } },
  //                    remotes: [{ name, url, pushUrl }] }（设置弹窗打开时一次拿全量）。
  // POST /git/config（CSRF 同 branch 路由）：
  //   { action: 'set', location, name?, email? }（字段缺省不动，空串 = 删除该项）
  //   { action: 'delete', location, field: 'name'|'email' }
  //   { action: 'switch-layer', field, to: 'local'|'global' }
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: GIT_CONFIG_PATH,
    handler: async (req, res) => {
      try {
        if (req.method === 'GET') {
          const url = new URL(req.url ?? '/', 'http://dsh.internal')
          const workspace = resolveWorkspace(ctx, url.searchParams.get('session') ?? '')
          if (!workspace.ok) return workspaceError(res, workspace)
          const root = workspace.root
          if (!(await gitIsRepo(root))) return json(res, 200, { ok: true, isRepo: false, user: null, remotes: [] })
          json(res, 200, { ok: true, isRepo: true, user: await gitUserConfig(root), remotes: await gitRemoteConfig(root) })
          return
        }
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
        const ACTIONS = ['set', 'delete', 'switch-layer']
        if (!ACTIONS.includes(action)) return json(res, 400, { error: 'unknown action' })
        const workspace = resolveWorkspace(ctx, payload.session ?? '')
        if (!workspace.ok) return workspaceError(res, workspace, true)
        const root = workspace.root
        if (!(await gitIsRepo(root))) return json(res, 200, { ok: false, error: { code: 'internal', message: 'not a git repository' } })
        let user
        if (action === 'set') {
          user = await gitUserConfigSet(root, {
            location: typeof payload.location === 'string' ? payload.location : 'local',
            name: typeof payload.name === 'string' ? payload.name : null,
            email: typeof payload.email === 'string' ? payload.email : null,
          })
        } else if (action === 'delete') {
          user = await gitUserConfigDelete(root, {
            location: typeof payload.location === 'string' ? payload.location : 'local',
            field: typeof payload.field === 'string' ? payload.field : 'name',
          })
        } else {
          user = await gitUserConfigSwitch(root, {
            field: typeof payload.field === 'string' ? payload.field : 'name',
            to: typeof payload.to === 'string' ? payload.to : 'global',
          })
        }
        json(res, 200, { ok: true, user })
      } catch (error) {
        json(res, 200, { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } })
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
      const workspace = resolveWorkspace(ctx, url.searchParams.get('session') ?? '')
      if (!workspace.ok) { res.writeHead(workspace.status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: workspace.error })); return }
      const root = workspace.root
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      const sub = { root, res, lastKey: null }
      subscribers.add(sub)
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
        if (sub.closed) return
        const key = gitStateKey(status)
        sub.lastKey = key
        sendEvent(sub, 'change', { key })
        // 初始状态算完并推送后才起轮询：避免首条状态未就绪时轮询抢跑，
        // 对同 key 重复推送（测试与慢环境下可稳定复现）。
        startTimers()
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
  gitStageAction,
  gitDiscardAction,
  classifyCommitFailure,
  gitCommitAction,
  gitRemoteConfig,
  gitRemoteManageAction,
  validateRemoteUrl,
  gitRefExists,
  parseConfigList,
  gitUserConfig,
  validateUserConfigValue,
  gitUserConfigSet,
  gitUserConfigDelete,
  gitUserConfigSwitch,
}
