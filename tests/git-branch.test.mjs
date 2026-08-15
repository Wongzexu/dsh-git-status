// git-branch 测试：分支名校验 / 守卫 / 失败分类 / 写路由（含 CSRF 防护）。
// 零依赖：node:test + 真实 git fixture 仓库 + 伪造 cordis ctx。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  validateBranchName,
  validateRemoteRef,
  classifySwitchFailure,
  extractBlockedPaths,
  gitGuardBlock,
  gitBranchAction,
  gitRefExists,
  apply,
} from '../lib/index.mjs'
import { makeRepo, makeConflictedRepo } from './fixtures/repo.mjs'

// ---------- validateBranchName：check-ref-format --branch 镜像 ----------

test('validateBranchName: 合法名 → null', () => {
  for (const name of ['main', 'feat/x', 'feature-1', 'v1.0.0', 'a/b/c']) {
    assert.equal(validateBranchName(name), null, name)
  }
})

test('validateBranchName: 非法名 → 稳定原因', () => {
  const cases = [
    ['', 'empty'],
    ['@', 'at-sign'],
    ['-bad', 'leading-dash'],
    ['bad.', 'trailing-dot'],
    ['bad.lock', 'lock-suffix'],
    ['a..b', 'double-dot'],
    ['a@{b', 'at-brace'],
    ['a//b', 'double-slash'],
    ['a b', 'space'],
    ['a~b', 'forbidden-char'],
    ['a^b', 'forbidden-char'],
    ['a:b', 'forbidden-char'],
    ['a?b', 'forbidden-char'],
    ['a*b', 'forbidden-char'],
    ['a[b', 'forbidden-char'],
    ['a\\b', 'forbidden-char'],
    ['\x01ab', 'control-char'],
    ['/a', 'empty-component'],
    ['a/', 'empty-component'],
    ['.a', 'dot-component'],
    ['a/.lock', 'lock-suffix'],
    ['x'.repeat(1001), 'too-long'],
  ]
  for (const [name, expected] of cases) {
    assert.equal(validateBranchName(name), expected, name)
  }
})

// ---------- validateRemoteRef ----------

test('validateRemoteRef: 合法/非法远程 ref', () => {
  assert.equal(validateRemoteRef('gitee/main'), true)
  assert.equal(validateRemoteRef('origin/feat/x'), true)
  for (const bad of ['', '..', '/x', 'x/', 'a b', 'a..b', 'x'.repeat(201)]) {
    assert.equal(validateRemoteRef(bad), false, bad)
  }
})

// ---------- classifySwitchFailure / extractBlockedPaths：stderr → 稳定错误码 ----------

test('classifySwitchFailure: 已跟踪文件被覆盖 → tracked-changes-would-be-overwritten + 路径', () => {
  const stderr = [
    'error: Your local changes to the following files would be overwritten by checkout:',
    '\ta.txt',
    '\t"b file.txt"',
    'Please commit your changes or stash them before you switch branches.',
    'Aborting',
  ].join('\n')
  const error = classifySwitchFailure(stderr)
  assert.equal(error.code, 'tracked-changes-would-be-overwritten')
  assert.deepEqual(error.paths, ['a.txt', 'b file.txt'])
  assert.equal(error.moreFiles, 0)
})

test('classifySwitchFailure: 未跟踪文件被覆盖，超过 2 个计 moreFiles', () => {
  const stderr = [
    'error: The following untracked working tree files would be overwritten by checkout:',
    '\tone.txt',
    '\ttwo.txt',
    '\tthree.txt',
    'Please move or remove them before you switch branches.',
    'Aborting',
  ].join('\n')
  const error = classifySwitchFailure(stderr)
  assert.equal(error.code, 'untracked-changes-would-be-overwritten')
  assert.deepEqual(error.paths, ['one.txt', 'two.txt'])
  assert.equal(error.moreFiles, 1)
})

test('classifySwitchFailure: 目标不存在 / 其它 worktree / 兜底 internal', () => {
  assert.equal(classifySwitchFailure('fatal: invalid reference: nope').code, 'target-branch-not-found')
  assert.equal(classifySwitchFailure("fatal: a branch named 'x' is already checked out at '/wt'").code, 'branch-in-other-worktree')
  assert.equal(classifySwitchFailure('fatal: unknown switch `q`').code, 'internal')
})

test('extractBlockedPaths: quotePath 转义还原（\\t \\\\ \\"）', () => {
  const stderr = [
    'error: Your local changes to the following files would be overwritten by checkout:',
    '\t"a\\tb.txt"',
    '\t"c\\\\d.txt"',
    '\t"e\\"f.txt"',
    'Aborting',
  ].join('\n')
  const { paths, moreFiles } = extractBlockedPaths(stderr, /Your local changes to the following files would be overwritten by checkout/)
  assert.deepEqual(paths, ['a\tb.txt', 'c\\d.txt'])
  assert.equal(moreFiles, 1)
})

// ---------- gitGuardBlock：切换前守卫 ----------

test('gitGuardBlock: 未解决冲突 → conflicts-present', async (t) => {
  const repo = await makeConflictedRepo(t)
  const blocked = await gitGuardBlock(repo.root, 'main')
  assert.equal(blocked.code, 'conflicts-present')
  assert.match(blocked.message, /unresolved conflict/)
})

test('gitGuardBlock: 进行中操作标记 → operation-in-progress', async (t) => {
  const repo = await makeConflictedRepo(t)
  await repo.git(['merge', '--abort'])
  const markerPath = (await repo.git(['rev-parse', '--git-path', 'CHERRY_PICK_HEAD'])).trim()
  assert.ok(markerPath !== '')
  await repo.write(markerPath, 'dummy marker')
  const blocked = await gitGuardBlock(repo.root, 'main')
  assert.equal(blocked.code, 'operation-in-progress')
})

test('gitGuardBlock: 目标分支在其它 worktree 检出 → branch-in-other-worktree', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  const wt = await mkdtemp(join(tmpdir(), 'dsh-git-status-wt-'))
  t.after(() => rm(wt, { recursive: true, force: true }))
  await repo.git(['worktree', 'add', wt, 'other'])
  const blocked = await gitGuardBlock(repo.root, 'other')
  assert.equal(blocked.code, 'branch-in-other-worktree')
  assert.equal(await gitGuardBlock(repo.root, 'main'), null)
})

test('gitGuardBlock: 干净仓库不拦截', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  assert.equal(await gitGuardBlock(repo.root, 'main'), null)
})

// ---------- gitGuardBlock：未提交改动守卫（方案 A） ----------

test('gitGuardBlock: checkUncommitted 有已跟踪改动 → uncommitted-changes-present + 三组计数', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'A\n' } })
  await repo.branch('other')
  await repo.write('f.txt', 'B\n')        // 未暂存
  await repo.git(['add', 'f.txt'])        // 暂存
  await repo.write('f.txt', 'C\n')        // 再改 → MM：staged=1、跟踪未暂存=1
  await repo.write('u.txt', 'untracked')  // 未跟踪（不计入 unstaged）
  const blocked = await gitGuardBlock(repo.root, 'other', { checkUncommitted: true })
  assert.equal(blocked.code, 'uncommitted-changes-present')
  assert.equal(blocked.staged, 1)
  assert.equal(blocked.unstaged, 1)
  assert.equal(blocked.untracked, 1)
})

test('gitGuardBlock: checkUncommitted 仅未跟踪文件 → 放行', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  await repo.write('u.txt', 'untracked')
  assert.equal(await gitGuardBlock(repo.root, 'other', { checkUncommitted: true }), null)
})

test('gitGuardBlock: checkUncommitted 默认关闭（delete/rename/merge 等调用点不受影响）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'A\n' } })
  await repo.write('f.txt', 'dirty') // 已跟踪改动
  assert.equal(await gitGuardBlock(repo.root, 'main'), null)
})

// ---------- gitBranchAction：create / checkout ----------

test('gitBranchAction.create: 合法名成功并检出', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitBranchAction(repo.root, 'create', { name: 'feat/new' })
  assert.deepEqual(result, { ok: true, branch: 'feat/new' })
  assert.equal(await repo.currentBranch(), 'feat/new')
})

test('gitBranchAction.create: 非法名拒绝', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitBranchAction(repo.root, 'create', { name: 'bad name' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'invalid-branch-name')
})

test('gitBranchAction.create: 已存在拒绝', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('dup')
  const result = await gitBranchAction(repo.root, 'create', { name: 'dup' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'branch-already-exists')
})

test('gitBranchAction.checkout: 本地分支成功', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  const result = await gitBranchAction(repo.root, 'checkout', { branch: 'other' })
  assert.deepEqual(result, { ok: true, branch: 'other' })
  assert.equal(await repo.currentBranch(), 'other')
})

test('gitBranchAction.checkout: 目标不存在', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitBranchAction(repo.root, 'checkout', { branch: 'nope' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'target-branch-not-found')
})

test('gitBranchAction.checkout: 远程 start-point 建本地跟踪分支', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.git(['update-ref', 'refs/remotes/origin/feat', head])
  const result = await gitBranchAction(repo.root, 'checkout', { branch: 'feat', remote: 'origin/feat' })
  assert.deepEqual(result, { ok: true, branch: 'feat' })
  assert.equal(await repo.currentBranch(), 'feat')
})

test('gitBranchAction.checkout: 本地改动会被覆盖 → 稳定错误码 + 被挡路径', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'A\n' } })
  await repo.branch('other')
  await repo.checkout('other')
  await repo.write('f.txt', 'B\n')
  await repo.git(['add', '-A'])
  await repo.git(['commit', '-m', 'other change'])
  await repo.checkout('main')
  await repo.write('f.txt', 'C\n') // 未提交改动
  // 带 force 旁路未提交守卫（不带 force 时先被 uncommitted-changes-present 拦截，
  // 见「有已跟踪改动 → 拒绝且不切换」用例），才会轮到 git 的 overwrite 错误。
  const result = await gitBranchAction(repo.root, 'checkout', { branch: 'other', force: true })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'tracked-changes-would-be-overwritten')
  assert.deepEqual(result.error.paths, ['f.txt'])
  await repo.git(['checkout', '--', 'f.txt']) // 清理
})

test('gitBranchAction.checkout: 有已跟踪改动 → 拒绝且不切换（改动保留）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  await repo.write('a.txt', 'dirty')
  const result = await gitBranchAction(repo.root, 'checkout', { branch: 'other' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'uncommitted-changes-present')
  assert.equal(result.error.staged, 0)
  assert.equal(result.error.unstaged, 1)
  assert.equal(await repo.currentBranch(), 'main') // 未切换
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), 'M a.txt') // 改动保留
})

test('gitBranchAction.checkout: force 旁路 → 带改动切换成功', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  await repo.write('a.txt', 'dirty')
  const result = await gitBranchAction(repo.root, 'checkout', { branch: 'other', force: true })
  assert.deepEqual(result, { ok: true, branch: 'other' })
  assert.equal(await repo.currentBranch(), 'other')
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), 'M a.txt') // 改动带到新分支
})

test('gitBranchAction.checkout: 仅未跟踪文件 → 直接切换（不弹确认）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  await repo.write('u.txt', 'untracked')
  const result = await gitBranchAction(repo.root, 'checkout', { branch: 'other' })
  assert.deepEqual(result, { ok: true, branch: 'other' })
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), '?? u.txt')
})

// ---------- gitBranchAction：tag 起始点（2.2） ----------

test('gitBranchAction.create: 以 tag 为起始点建分支', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['tag', 'v1.0'])
  const result = await gitBranchAction(repo.root, 'create', { name: 'from-tag', start: 'v1.0' })
  assert.deepEqual(result, { ok: true, branch: 'from-tag' })
  assert.equal(await repo.currentBranch(), 'from-tag')
  // 新分支起点 = tag 指向的提交
  const tagHash = (await repo.git(['rev-parse', 'refs/tags/v1.0'])).trim()
  assert.equal((await repo.git(['rev-parse', 'HEAD'])).trim(), tagHash)
})

test('gitBranchAction.create: tag 不存在 / start 形态非法', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const missing = await gitBranchAction(repo.root, 'create', { name: 'x', start: 'nope' })
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'start-point-not-found')
  const bad = await gitBranchAction(repo.root, 'create', { name: 'x', start: 'a..b' })
  assert.equal(bad.ok, false)
  assert.equal(bad.error.code, 'invalid-start-point')
})

// ---------- gitBranchAction：commit 起始点（commit 行右键新建分支） ----------

test('gitBranchAction.create: 以 commit hash 为起始点建分支', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const c1Hash = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.commit('c2')
  const result = await gitBranchAction(repo.root, 'create', { name: 'from-commit', start: c1Hash })
  assert.deepEqual(result, { ok: true, branch: 'from-commit' })
  assert.equal(await repo.currentBranch(), 'from-commit')
  // 新分支起点 = 目标提交（而非当前 HEAD c2）
  assert.equal((await repo.git(['rev-parse', 'HEAD'])).trim(), c1Hash)
})

test('gitBranchAction.create: 短 hash 起始点 / hex hash 不存在', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const c1Hash = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.commit('c2')
  // 短 hash（7 位）同样按 commit 校验通过
  const short = await gitBranchAction(repo.root, 'create', { name: 'from-short', start: c1Hash.slice(0, 7) })
  assert.deepEqual(short, { ok: true, branch: 'from-short' })
  assert.equal((await repo.git(['rev-parse', 'HEAD'])).trim(), c1Hash)
  // hex 形态但对象不存在 → rev-parse 权威校验拒绝
  const missing = await gitBranchAction(repo.root, 'create', { name: 'x', start: '1234567' })
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'start-point-not-found')
})

// ---------- gitBranchAction：delete（2.4） ----------

test('gitBranchAction.delete: 已合并分支安全删除', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  const result = await gitBranchAction(repo.root, 'delete', { branch: 'other' })
  assert.deepEqual(result, { ok: true, branch: 'other' })
  assert.equal(await gitRefExists(repo.root, 'refs/heads/other'), false)
})

test('gitBranchAction.delete: 当前分支拒绝', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitBranchAction(repo.root, 'delete', { branch: 'main' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'cannot-delete-current')
})

test('gitBranchAction.delete: 未合并拒绝，force 强删', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  await repo.checkout('other')
  await repo.commit('other-only')
  await repo.checkout('main')
  const refused = await gitBranchAction(repo.root, 'delete', { branch: 'other' })
  assert.equal(refused.ok, false)
  assert.equal(refused.error.code, 'branch-not-fully-merged')
  assert.equal(await gitRefExists(repo.root, 'refs/heads/other'), true)
  const forced = await gitBranchAction(repo.root, 'delete', { branch: 'other', force: true })
  assert.deepEqual(forced, { ok: true, branch: 'other' })
  assert.equal(await gitRefExists(repo.root, 'refs/heads/other'), false)
})

test('gitBranchAction.delete: 不存在', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitBranchAction(repo.root, 'delete', { branch: 'nope' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'target-branch-not-found')
})

// ---------- gitBranchAction：rename（2.4） ----------

test('gitBranchAction.rename: 普通分支 + 当前分支', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  const renamed = await gitBranchAction(repo.root, 'rename', { branch: 'other', name: 'other2' })
  assert.deepEqual(renamed, { ok: true, branch: 'other2' })
  assert.equal(await gitRefExists(repo.root, 'refs/heads/other'), false)
  assert.equal(await gitRefExists(repo.root, 'refs/heads/other2'), true)
  // 当前分支可重命名
  const cur = await gitBranchAction(repo.root, 'rename', { branch: 'main', name: 'main2' })
  assert.deepEqual(cur, { ok: true, branch: 'main2' })
  assert.equal(await repo.currentBranch(), 'main2')
})

test('gitBranchAction.rename: 重名 / 不存在 / 非法新名', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  const dup = await gitBranchAction(repo.root, 'rename', { branch: 'other', name: 'main' })
  assert.equal(dup.ok, false)
  assert.equal(dup.error.code, 'branch-already-exists')
  const missing = await gitBranchAction(repo.root, 'rename', { branch: 'nope', name: 'x' })
  assert.equal(missing.error.code, 'target-branch-not-found')
  const bad = await gitBranchAction(repo.root, 'rename', { branch: 'other', name: 'bad name' })
  assert.equal(bad.error.code, 'invalid-branch-name')
})

// ---------- gitBranchAction：merge / merge-abort / merge-continue（2.4） ----------

test('gitBranchAction.merge: 快进合并', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  await repo.checkout('other')
  await repo.commit('other work')
  await repo.checkout('main')
  const result = await gitBranchAction(repo.root, 'merge', { branch: 'other' })
  assert.deepEqual(result, { ok: true, branch: 'other' })
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'other work')
})

test('gitBranchAction.merge: noff 可快进也强制生成合并提交', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  await repo.checkout('other')
  await repo.commit('other work')
  await repo.checkout('main')
  const result = await gitBranchAction(repo.root, 'merge', { branch: 'other', noff: true })
  assert.deepEqual(result, { ok: true, branch: 'other' })
  // 本可快进，但 --no-ff 强制产生了合并提交（默认消息 "Merge branch 'other'"）
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), "Merge branch 'other'")
  assert.equal((await repo.git(['rev-list', '--count', '--merges', 'main'])).trim(), '1')
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const other = (await repo.git(['rev-parse', 'other'])).trim()
  assert.notEqual(head, other)
})

test('gitBranchAction.merge: 自身 / 不存在 / 非法名', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const self = await gitBranchAction(repo.root, 'merge', { branch: 'main' })
  assert.equal(self.ok, false)
  assert.equal(self.error.code, 'cannot-merge-self')
  const missing = await gitBranchAction(repo.root, 'merge', { branch: 'nope' })
  assert.equal(missing.error.code, 'target-branch-not-found')
})

test('gitBranchAction.merge: 冲突 → merge-conflicts + MERGE_HEAD；abort 恢复', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'c.txt': 'base\n' } })
  await repo.branch('side')
  await repo.commit('main change', { files: { 'c.txt': 'main\n' } })
  await repo.checkout('side')
  await repo.write('c.txt', 'side\n')
  await repo.git(['add', '-A'])
  await repo.git(['commit', '-m', 'side change'])
  await repo.checkout('main')
  const result = await gitBranchAction(repo.root, 'merge', { branch: 'side' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'merge-conflicts')
  const markerPath = (await repo.git(['rev-parse', '--git-path', 'MERGE_HEAD'])).trim()
  assert.ok(markerPath !== '')
  assert.ok(existsSync(join(repo.root, markerPath)))
  const aborted = await gitBranchAction(repo.root, 'merge-abort')
  assert.deepEqual(aborted, { ok: true, branch: '' })
  assert.ok(!existsSync(join(repo.root, markerPath)))
  assert.equal(await repo.currentBranch(), 'main')
})

test('gitBranchAction.merge-continue: 冲突未解决拒绝；解决后成功', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'c.txt': 'base\n' } })
  await repo.branch('side')
  await repo.commit('main change', { files: { 'c.txt': 'main\n' } })
  await repo.checkout('side')
  await repo.write('c.txt', 'side\n')
  await repo.git(['add', '-A'])
  await repo.git(['commit', '-m', 'side change'])
  await repo.checkout('main')
  await gitBranchAction(repo.root, 'merge', { branch: 'side' })
  const refused = await gitBranchAction(repo.root, 'merge-continue')
  assert.equal(refused.ok, false)
  assert.equal(refused.error.code, 'merge-conflicts-remain')
  await repo.write('c.txt', 'resolved\n')
  await repo.git(['add', 'c.txt'])
  const done = await gitBranchAction(repo.root, 'merge-continue')
  assert.deepEqual(done, { ok: true, branch: '' })
  const markerPath = (await repo.git(['rev-parse', '--git-path', 'MERGE_HEAD'])).trim()
  assert.ok(!existsSync(join(repo.root, markerPath)))
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'Merge branch \'side\'')
})

test('gitBranchAction.merge-abort: 无合并进行中', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitBranchAction(repo.root, 'merge-abort')
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'no-merge-in-progress')
})

// ---------- 写路由（伪造 cordis ctx）：CSRF / 方法 / 载荷 ----------

function fakeCtx(root) {
  const routes = []
  const ctx = {
    sessions: { get: () => undefined },
    workspaceRegistry: { list: () => [{ path: root }] },
    webServer: {
      register: (route) => {
        routes.push(route)
        return () => {}
      },
    },
    effect: (fn) => fn(),
  }
  apply(ctx)
  return { routes, get: (path) => routes.find((r) => r.path === path) }
}

function fakeReq({ method = 'GET', contentType, body = '' } = {}) {
  const headers = {}
  if (contentType !== undefined) headers['content-type'] = contentType
  return {
    method,
    headers,
    url: '/plugins/dsh-git-status/git/branch',
    [Symbol.asyncIterator]: async function* () {
      yield body
    },
  }
}

function fakeRes() {
  const calls = []
  return {
    calls,
    status: 0,
    payload: null,
    writeHead(status) { this.status = status },
    end(payload) { this.payload = payload },
  }
}

test('写路由: GET → 405', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get('/plugins/dsh-git-status/git/branch')
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'GET' }), res)
  assert.equal(res.status, 405)
  assert.equal(JSON.parse(res.payload).error, 'method not allowed')
})

test('写路由: 非 application/json content-type → 415（CSRF 防护）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get('/plugins/dsh-git-status/git/branch')
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'text/plain', body: '{}' }), res)
  assert.equal(res.status, 415)
  assert.equal(JSON.parse(res.payload).error, 'unsupported media type')
})

test('写路由: 畸形 JSON → 400', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get('/plugins/dsh-git-status/git/branch')
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: 'not json' }), res)
  assert.equal(res.status, 400)
})

test('写路由: 未知 action → 400', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get('/plugins/dsh-git-status/git/branch')
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"explode"}' }), res)
  assert.equal(res.status, 400)
  assert.equal(JSON.parse(res.payload).error, 'unknown action')
})

test('写路由: 合法 create 全链路成功（workspaceRoot 回退注册表）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get('/plugins/dsh-git-status/git/branch')
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"create","name":"route-branch"}' }),
    res,
  )
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.payload), { ok: true, branch: 'route-branch' })
  assert.equal(await repo.currentBranch(), 'route-branch')
})

test('写路由: merge + noff 全链路成功（payload.noff 透传）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  await repo.checkout('other')
  await repo.commit('other work')
  await repo.checkout('main')
  const route = fakeCtx(repo.root).get('/plugins/dsh-git-status/git/branch')
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"merge","branch":"other","noff":true}' }),
    res,
  )
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.payload), { ok: true, branch: 'other' })
  assert.equal((await repo.git(['rev-list', '--count', '--merges', 'main'])).trim(), '1')
})

test('写路由: 非 git 仓库 → 稳定错误', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-git-status-nogit-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const route = fakeCtx(root).get('/plugins/dsh-git-status/git/branch')
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"create","name":"x"}' }),
    res,
  )
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.payload).error.code, 'internal')
})

test('写路由: checkout 脏仓库 → uncommitted-changes-present；force 全链路成功', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('other')
  await repo.write('a.txt', 'dirty')
  const route = fakeCtx(repo.root).get('/plugins/dsh-git-status/git/branch')
  const res1 = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"checkout","branch":"other"}' }),
    res1,
  )
  assert.equal(res1.status, 200)
  assert.equal(JSON.parse(res1.payload).error.code, 'uncommitted-changes-present')
  const res2 = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"checkout","branch":"other","force":true}' }),
    res2,
  )
  assert.deepEqual(JSON.parse(res2.payload), { ok: true, branch: 'other' })
  assert.equal(await repo.currentBranch(), 'other')
})
