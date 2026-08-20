// git-history 测试：Rebase / Reset / Cherry-pick / Revert / Pull 五操作。
// 覆盖「目标在/不在当前分支」场景矩阵 + 祖先守卫 + merge-commit parent 白名单 +
// 冲突分类 + 写路由 CSRF 全链路（方案见 issue IK91UG）。
// 零依赖：node:test + 真实 git fixture 仓库 + 伪造 cordis ctx。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  classifyHistoryFailure,
  gitHistoryAction,
  gitCommitParents,
  gitOperationMarker,
  apply,
} from '../lib/index.mjs'
import { makeRepo, runGit } from './fixtures/repo.mjs'

/** 建裸远程仓库（pull 用）。 */
async function makeBare(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-gitstatus-bare-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await runGit(root, ['init', '--bare'])
  return root
}

/** 把本地仓库链接到裸远程，并把 main 与 side 分别推上去（side 作 origin/remote2）。
 *  返回 { bare }（网络路径断言用）。 */
async function pushRemote(repo, t) {
  const bare = await makeBare(t)
  await repo.git(['remote', 'add', 'origin', bare])
  await repo.git(['push', '-u', 'origin', 'main'])
  await repo.git(['push', 'origin', 'side:remote2'])
  return { bare }
}

/** 造普通提交仓库：base → main 改 g.txt；side 从 base 分叉改 h.txt（互不冲突）。 */
async function makeDivergeRepo(t) {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'f.txt': 'base' } })
  await repo.branch('side')
  await repo.commit('mainG', { files: { 'g.txt': 'mainG' } })
  await repo.checkout('side')
  await repo.commit('sideH', { files: { 'h.txt': 'sideH' } })
  await repo.checkout('main')
  return repo
}

// ---------- Rebase ----------

test('rebase: 非交互变基到分支（本分支提交重放到目标之上）', async (t) => {
  const repo = await makeDivergeRepo(t)
  const result = await gitHistoryAction(repo.root, 'rebase', { target: 'side' })
  assert.equal(result.ok, true)
  // main 的提交重放到 side 之上：HEAD 主题是 mainG，sideH 也在历史里，h.txt 就位
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'mainG')
  assert.match(await repo.git(['log', '--format=%s']), /sideH/)
  assert.equal((await repo.git(['show', 'HEAD:h.txt'])).trim(), 'sideH')
})

test('rebase: 目标提交 hash（commit 行右键入口）', async (t) => {
  const repo = await makeDivergeRepo(t)
  const sideHash = (await repo.git(['rev-parse', 'side'])).trim()
  const result = await gitHistoryAction(repo.root, 'rebase', { target: sideHash.slice(0, 7) })
  assert.equal(result.ok, true)
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'mainG')
})

test('rebase: 目标是祖先 → 无害 up-to-date', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.commit('c2')
  const result = await gitHistoryAction(repo.root, 'rebase', { target: 'main' })
  assert.equal(result.ok, true)
  assert.equal((await repo.currentBranch()), 'main')
})

test('rebase: 冲突 → rebase-conflicts + rebase 标记；abort 后恢复', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'f.txt': 'base' } })
  await repo.branch('side')
  await repo.commit('mainA', { files: { 'f.txt': 'mainA' } })
  await repo.checkout('side')
  await repo.commit('sideA', { files: { 'f.txt': 'sideA' } })
  await repo.checkout('main')

  const result = await gitHistoryAction(repo.root, 'rebase', { target: 'side' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'rebase-conflicts')
  const marker = await gitOperationMarker(repo.root)
  assert.ok(marker === 'rebase-merge' || marker === 'rebase-apply', `marker=${marker}`)
  await repo.git(['rebase', '--abort'])
  assert.equal(await gitOperationMarker(repo.root), null)
})

test('rebase: 工作区有未暂存改动 → rebase-uncommitted', async (t) => {
  const repo = await makeDivergeRepo(t)
  await repo.write('f.txt', 'dirty')
  const result = await gitHistoryAction(repo.root, 'rebase', { target: 'side' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'rebase-uncommitted')
})

test('rebase: 目标分支不存在 / 非法 → 稳定错误', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  assert.equal((await gitHistoryAction(repo.root, 'rebase', { target: 'nope' })).error?.code, 'target-branch-not-found')
  assert.equal((await gitHistoryAction(repo.root, 'rebase', { target: 'a b' })).error?.code, 'invalid-branch-name')
  assert.equal((await gitHistoryAction(repo.root, 'rebase', { target: '' })).error?.code, 'invalid-target')
})

// ---------- Reset ----------

test('reset: 模式白名单外 → invalid-reset-mode', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitHistoryAction(repo.root, 'reset', { hash: 'HEAD', mode: 'explode' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'invalid-reset-mode')
})

test('reset: 目标是祖先 → 常规回退成功（hard 丢弃工作区改动）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'v1' } })
  const c1 = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.commit('c2', { files: { 'f.txt': 'v2' } })
  await repo.write('f.txt', 'dirty')

  const result = await gitHistoryAction(repo.root, 'reset', { hash: c1, mode: 'hard' })
  assert.equal(result.ok, true)
  assert.equal(result.hash, c1.slice(0, 7))
  assert.equal((await repo.git(['rev-list', '--count', 'HEAD'])).trim(), '1')
  assert.equal((await repo.git(['show', 'HEAD:f.txt'])).trim(), 'v1')
})

test('reset: 目标不在当前分支（非祖先）→ 拒绝且仓库不动；带 force 旁路成功', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'f.txt': 'base' } })
  await repo.branch('side')
  await repo.commit('main1')
  await repo.checkout('side')
  await repo.commit('side1')
  const sideHash = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.checkout('main')

  const rejected = await gitHistoryAction(repo.root, 'reset', { hash: sideHash, mode: 'hard' })
  assert.equal(rejected.ok, false)
  assert.equal(rejected.error.code, 'reset-not-ancestor')
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'main1')
  // 客户端确认后带 force 重发 → 分支指针移到无关 commit
  const forced = await gitHistoryAction(repo.root, 'reset', { hash: sideHash, mode: 'hard', force: true })
  assert.equal(forced.ok, true)
  assert.equal((await repo.git(['rev-parse', 'HEAD'])).trim(), sideHash)
})

test('reset: 目标是当前 HEAD（自身即祖先）→ 允许', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  assert.equal((await gitHistoryAction(repo.root, 'reset', { hash: head, mode: 'soft' })).ok, true)
})

// ---------- Cherry-pick ----------

test('cherry-pick: 干净应用（目标不在当前分支），revert/cherry-pick 对祖先关系不敏感', async (t) => {
  const repo = await makeDivergeRepo(t)
  const sideHash = (await repo.git(['rev-parse', 'side'])).trim()
  const result = await gitHistoryAction(repo.root, 'cherry-pick', { hash: sideHash })
  assert.equal(result.ok, true)
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'sideH')
  assert.equal((await repo.git(['show', 'HEAD:h.txt'])).trim(), 'sideH')
})

test('cherry-pick: recordOrigin(-x) 在提交体记录来源', async (t) => {
  const repo = await makeDivergeRepo(t)
  const sideHash = (await repo.git(['rev-parse', 'side'])).trim()
  const result = await gitHistoryAction(repo.root, 'cherry-pick', { hash: sideHash, recordOrigin: true })
  assert.equal(result.ok, true)
  const body = await repo.git(['log', '-1', '--format=%b'])
  assert.match(body, /cherry picked from commit/)
})

test('cherry-pick: no-commit 仅应用到暂存区，不产生新提交', async (t) => {
  const repo = await makeDivergeRepo(t)
  const sideHash = (await repo.git(['rev-parse', 'side'])).trim()
  const before = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const result = await gitHistoryAction(repo.root, 'cherry-pick', { hash: sideHash, noCommit: true })
  assert.equal(result.ok, true)
  assert.equal((await repo.git(['rev-parse', 'HEAD'])).trim(), before)
  const staged = await repo.git(['diff', '--cached', '--name-only'])
  assert.match(staged, /h\.txt/)
})

test('cherry-pick: merge commit 强 parent（无 parent → invalid-mainline；-m 1 → 成功）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'f.txt': 'base' } })
  await repo.branch('side')
  await repo.commit('mainM', { files: { 'g.txt': 'mainM' } })
  await repo.checkout('side')
  await repo.commit('sideM', { files: { 'h.txt': 'sideM' } })
  await repo.checkout('main')
  const preMerge = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.git(['merge', '--no-ff', 'side', '-m', 'mergeSide'])
  const mergeHash = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const parents = await gitCommitParents(repo.root, mergeHash)
  assert.equal(parents.length, 2)
  // 另一分支上摘取 merge commit
  await repo.branch('picker', { start: preMerge })
  await repo.checkout('picker')
  const noParent = await gitHistoryAction(repo.root, 'cherry-pick', { hash: mergeHash })
  assert.equal(noParent.ok, false)
  assert.equal(noParent.error.code, 'invalid-mainline')
  const withParent = await gitHistoryAction(repo.root, 'cherry-pick', { hash: mergeHash, parent: 1 })
  assert.equal(withParent.ok, true)
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'mergeSide')
})

test('cherry-pick: 冲突 → cherry-pick-conflicts + CHERRY_PICK_HEAD 标记；abort 恢复', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'f.txt': 'base' } })
  await repo.branch('side')
  await repo.commit('mainA', { files: { 'f.txt': 'mainA' } })
  await repo.checkout('side')
  await repo.commit('sideA', { files: { 'f.txt': 'sideA' } })
  await repo.checkout('main')
  const sideHash = (await repo.git(['rev-parse', 'side'])).trim()

  const result = await gitHistoryAction(repo.root, 'cherry-pick', { hash: sideHash })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'cherry-pick-conflicts')
  assert.equal(await gitOperationMarker(repo.root), 'CHERRY_PICK_HEAD')
  await repo.git(['cherry-pick', '--abort'])
  assert.equal(await gitOperationMarker(repo.root), null)
})

// ---------- Revert ----------

test('revert: 生成反向提交（内容回到该提交之前）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'v1' } })
  await repo.commit('c2', { files: { 'f.txt': 'v2' } })
  // 目标：c2（把 v1→v2），还原后内容回到 v1
  const c2Full = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const result = await gitHistoryAction(repo.root, 'revert', { hash: c2Full })
  assert.equal(result.ok, true)
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), `Revert "c2"`)
  assert.equal((await repo.git(['show', 'HEAD:f.txt'])).trim(), 'v1')
})

test('revert: merge commit 强 parent（无 parent → invalid-mainline；-m 1 → 成功）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'f.txt': 'base' } })
  await repo.branch('side')
  await repo.commit('mainM', { files: { 'g.txt': 'mainM' } })
  await repo.checkout('side')
  await repo.commit('sideM', { files: { 'h.txt': 'sideM' } })
  await repo.checkout('main')
  await repo.git(['merge', '--no-ff', 'side', '-m', 'mergeSide'])
  const mergeHash = (await repo.git(['rev-parse', 'HEAD'])).trim()

  const noParent = await gitHistoryAction(repo.root, 'revert', { hash: mergeHash })
  assert.equal(noParent.ok, false)
  assert.equal(noParent.error.code, 'invalid-mainline')
  const withParent = await gitHistoryAction(repo.root, 'revert', { hash: mergeHash, parent: 1 })
  assert.equal(withParent.ok, true)
  assert.match(await repo.git(['log', '-1', '--format=%s']), /^Revert "mergeSide"/)
})

test('revert: 冲突 → revert-conflicts + REVERT_HEAD 标记；abort 恢复', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'f.txt': 'a' } })
  // 制造反向应用冲突：f.txt 被后续提交改为 b，再还原改变 a→b 的那个早期提交时应冲突
  await repo.commit('toRevert', { files: { 'f.txt': 'b' } })
  const toRevert = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.commit('after', { files: { 'f.txt': 'c' } })
  await repo.branch('other')
  await repo.checkout('other')
  // other 分支也把 f.txt 改掉：revert「b→a」应用在 current c 上出现整行冲突
  await repo.write('f.txt', 'x')
  await repo.git(['add', '-A'])
  await repo.git(['commit', '-m', 'otherX'])
  await repo.checkout('main')

  const result = await gitHistoryAction(repo.root, 'revert', { hash: toRevert })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'revert-conflicts')
  assert.equal(await gitOperationMarker(repo.root), 'REVERT_HEAD')
  await repo.git(['revert', '--abort'])
  assert.equal(await gitOperationMarker(repo.root), null)
})

// ---------- Pull ----------

test('pull: 远程不存在 → remote-not-found；非法远程/分支 → 稳定错误', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', '/tmp/not-here.git'])
  assert.equal((await gitHistoryAction(repo.root, 'pull', { remote: 'nope', branch: 'main' })).error?.code, 'remote-not-found')
  assert.equal((await gitHistoryAction(repo.root, 'pull', { remote: 'nope b', branch: 'main' })).error?.code, 'invalid-remote-name')
  assert.equal((await gitHistoryAction(repo.root, 'pull', { remote: 'origin', branch: 'a b' })).error?.code, 'invalid-branch-name')
})

test('pull: 默认合并（--no-rebase）拉取远程分叉分支', async (t) => {
  const repo = await makeDivergeRepo(t)
  const { bare } = await pushRemote(repo, t)
  const result = await gitHistoryAction(repo.root, 'pull', { remote: 'origin', branch: 'remote2' })
  assert.equal(result.ok, true)
  assert.equal((await repo.git(['show', 'HEAD:h.txt'])).trim(), 'sideH')
  // 再次拉取（已最新）→ 无害成功
  assert.equal((await gitHistoryAction(repo.root, 'pull', { remote: 'origin', branch: 'remote2' })).ok, true)
  assert.equal(bare, (await repo.git(['remote', 'get-url', 'origin'])).trim())
})

test('pull: --no-ff 生成合并提交；--squash 压平（SQUASH_MSG 由合并条接管）', async (t) => {
  const repo = await makeDivergeRepo(t)
  await pushRemote(repo, t)
  const noff = await gitHistoryAction(repo.root, 'pull', { remote: 'origin', branch: 'remote2', noff: true })
  assert.equal(noff.ok, true)
  assert.equal((await repo.git(['rev-list', '--count', '--merges', 'main'])).trim(), '1')

  // 再来一个仓库测 squash（避免 v0 状态叠加）
  const repo2 = await makeDivergeRepo(t)
  await pushRemote(repo2, t)
  const squash = await gitHistoryAction(repo2.root, 'pull', { remote: 'origin', branch: 'remote2', squash: true })
  assert.equal(squash.ok, true)
  // git merge --squash 语义：不提交、留 SQUASH_MSG、改动已暂存
  assert.equal(await gitOperationMarker(repo2.root), 'SQUASH_MSG')
  assert.match(await repo2.git(['diff', '--cached', '--name-only']), /h\.txt/)
  // 合并条 abort 路径（squash 无 MERGE_HEAD → reset --hard + 清理新增）
  await repo2.git(['reset', '--hard', 'HEAD'])
})

test('pull: 冲突（远程改动覆盖本地文件）→ merge-conflicts（归现有 merge 分类）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'f.txt': 'base' } })
  await repo.branch('side')
  // 远程分支 side 改同一个文件 f.txt
  await repo.checkout('side')
  await repo.write('f.txt', 'remote-side')
  await repo.git(['add', '-A'])
  await repo.git(['commit', '-m', 'remoteSideChange'])
  await repo.checkout('main')
  const { bare } = await pushRemote(repo, t)
  // 本地 main 也改同一个文件 → pull 与远程分叉合并时冲突
  await repo.write('f.txt', 'local-side')
  await repo.git(['add', '-A'])
  await repo.git(['commit', '-m', 'localSideChange'])

  const result = await gitHistoryAction(repo.root, 'pull', { remote: 'origin', branch: 'remote2' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'merge-conflicts')
  assert.equal(await gitOperationMarker(repo.root), 'MERGE_HEAD')
  await repo.git(['merge', '--abort'])
  assert.equal(bare, (await repo.git(['remote', 'get-url', 'origin'])).trim())
})

// ---------- 写路由（CSRF 全链路） ----------

function fakeCtx(root) {
  const routes = []
  const ctx = {
    sessions: { get: (id) => id === 'test-session' ? { header: { cwd: root } } : undefined },
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

function fakeReq({ method = 'GET', contentType, body = '', path = '/plugins/dsh-gitstatus/git/history' } = {}) {
  const headers = {}
  if (contentType !== undefined) headers['content-type'] = contentType
  try {
    const parsed = JSON.parse(body)
    if (parsed !== null && typeof parsed === 'object') body = JSON.stringify({ ...parsed, session: 'test-session' })
  } catch { /* malformed-body tests must stay malformed */ }
  return {
    method,
    headers,
    url: path,
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

const HISTORY_PATH = '/plugins/dsh-gitstatus/git/history'

test('写路由: GET → 405；非 json content-type → 415；畸形 body → 400；未知 action → 400', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(HISTORY_PATH)
  const r1 = fakeRes(); await route.handler(fakeReq({ method: 'GET' }), r1); assert.equal(r1.status, 405)
  const r2 = fakeRes(); await route.handler(fakeReq({ method: 'POST', contentType: 'text/plain', body: '{}' }), r2); assert.equal(r2.status, 415)
  const r3 = fakeRes(); await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: 'not json' }), r3); assert.equal(r3.status, 400)
  const r4 = fakeRes(); await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"explode"}' }), r4); assert.equal(r4.status, 400)
})

test('写路由: reset 全链路（session 绑定 + payload 透传）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'v1' } })
  const c1 = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.commit('c2', { files: { 'f.txt': 'v2' } })
  const route = fakeCtx(repo.root).get(HISTORY_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: JSON.stringify({ action: 'reset', hash: c1, mode: 'mixed' }) }),
    res,
  )
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.payload).ok, true)
  // mixed 重置：分支回退到 c1，工作区保留 v2 为未暂存改动
  assert.equal((await repo.git(['rev-list', '--count', 'HEAD'])).trim(), '1')
  assert.equal((await repo.git(['show', 'HEAD:f.txt'])).trim(), 'v1')
  assert.match(await repo.git(['status', '--porcelain']), /f\.txt/)
})

test('写路由: rebase 全链路（路由透传 target）', async (t) => {
  const repo = await makeDivergeRepo(t)
  const route = fakeCtx(repo.root).get(HISTORY_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: JSON.stringify({ action: 'rebase', target: 'side' }) }),
    res,
  )
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.payload).ok, true)
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'mainG')
})

// ---------- classifyHistoryFailure（纯函数，稳定错误码） ----------

test('classifyHistoryFailure: 冲突 → <kind>-conflicts；uncommitted / not-on-branch 独立', () => {
  assert.equal(classifyHistoryFailure('error: could not apply abc\nCONFLICT (content): Merge conflict in f.txt', '', 'rebase').code, 'rebase-conflicts')
  assert.equal(classifyHistoryFailure('error: CONFLICT (content)', '', 'cherry-pick').code, 'cherry-pick-conflicts')
  assert.equal(classifyHistoryFailure('', 'CONFLICT (content): Merge conflict in f.txt', 'revert').code, 'revert-conflicts')
  assert.equal(classifyHistoryFailure('error: The previous cherry-pick is now empty, possibly due to conflict resolution.', '', 'cherry-pick').code, 'cherry-pick-conflicts')
  assert.equal(classifyHistoryFailure('error: cannot rebase: You have unstaged changes.', '', 'rebase').code, 'rebase-uncommitted')
  assert.equal(classifyHistoryFailure('fatal: You are not currently on a branch.', '', 'rebase').code, 'not-on-branch')
})

