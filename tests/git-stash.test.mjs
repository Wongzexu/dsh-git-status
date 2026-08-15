// git-stash 测试：selector 校验 / push（message/untracked）/ apply / pop /
// drop / 从 stash 建分支 / 冲突分类（CONFLICT 走 stdout、overwrite 走 stderr）/
// 写路由（含 CSRF 防护）。
// 零依赖：node:test + 真实 git fixture 仓库 + 伪造 cordis ctx。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  GIT_STASH_PATH,
  validateStashSelector,
  classifyStashFailure,
  gitStashAction,
  apply,
} from '../lib/index.mjs'
import { makeRepo } from './fixtures/repo.mjs'

/** 造一个有 stash 的仓库：c1 提交 → 改 f.txt → stash（selector 返回）。 */
async function makeStashedRepo(t, opts = {}) {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'A\n' } })
  if (opts.untracked === true) await repo.write('u.txt', 'untracked')
  await repo.write('f.txt', 'B\n')
  await repo.git(['add', '-A'])
  await repo.git(['stash', 'push', '-m', 'wip', ...(opts.untracked === true ? ['-u'] : [])])
  const selector = (await repo.git(['reflog', '--format=%gD', 'refs/stash', '--'])).trim().split('\n')[0]
  return { repo, selector }
}

// ---------- validateStashSelector ----------

test('validateStashSelector: 合法/非法', () => {
  for (const ok of ['refs/stash@{0}', 'refs/stash@{12}']) {
    assert.equal(validateStashSelector(ok), true, ok)
  }
  for (const bad of ['', 'stash@{0}', 'refs/stash@{-1}', 'refs/stash@{x}', 'refs/stash@{}', 'refs/stash@{0}/x', 'refs/stash', 'refs/heads/stash@{0}']) {
    assert.equal(validateStashSelector(bad), false, bad)
  }
})

// ---------- classifyStashFailure ----------

test('classifyStashFailure: 冲突/overwrite → stash-conflicts；兜底 internal', () => {
  assert.equal(classifyStashFailure('CONFLICT (content): Merge conflict in c.txt').code, 'stash-conflicts')
  assert.equal(classifyStashFailure('error: Your local changes to the following files would be overwritten by merge:').code, 'stash-conflicts')
  assert.equal(classifyStashFailure('fatal: unknown switch `q`').code, 'internal')
})

// ---------- gitStashAction：push（未提交行） ----------

test('gitStashAction.push: 有改动成功，message 生效', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'A\n' } })
  await repo.write('f.txt', 'B\n')
  const result = await gitStashAction(repo.root, 'push', { message: 'my stash' })
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['stash', 'list'])).trim(), 'stash@{0}: On main: my stash')
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), '')
})

test('gitStashAction.push: 无改动也返回 ok（git 退出码 0，与上游一致）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'A\n' } })
  const result = await gitStashAction(repo.root, 'push')
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['stash', 'list'])).trim(), '')
})

test('gitStashAction.push: includeUntracked 含未跟踪文件', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'f.txt': 'A\n' } })
  await repo.write('f.txt', 'B\n')
  await repo.write('u.txt', 'untracked')
  const result = await gitStashAction(repo.root, 'push', { includeUntracked: true })
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), '')
  // 未跟踪文件被 stash 带走（apply 后回来）
  const selector = (await repo.git(['reflog', '--format=%gD', 'refs/stash', '--'])).trim()
  await gitStashAction(repo.root, 'apply', { selector })
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), 'M f.txt\n?? u.txt')
})

// ---------- gitStashAction：apply / pop / drop ----------

test('gitStashAction.apply: 改动恢复且 stash 保留', async (t) => {
  const { repo, selector } = await makeStashedRepo(t)
  const result = await gitStashAction(repo.root, 'apply', { selector })
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), 'M f.txt')
  assert.equal((await repo.git(['stash', 'list'])).trim(), 'stash@{0}: On main: wip')
})

test('gitStashAction.pop: 改动恢复且 stash 消失', async (t) => {
  const { repo, selector } = await makeStashedRepo(t)
  const result = await gitStashAction(repo.root, 'pop', { selector })
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), 'M f.txt')
  assert.equal((await repo.git(['stash', 'list'])).trim(), '')
})

test('gitStashAction.drop: 删除 stash；不存在 → stash-not-found', async (t) => {
  const { repo, selector } = await makeStashedRepo(t)
  const result = await gitStashAction(repo.root, 'drop', { selector })
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['stash', 'list'])).trim(), '')
  const missing = await gitStashAction(repo.root, 'drop', { selector })
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'stash-not-found')
})

test('gitStashAction: 非法 selector / 不存在的 stash → 稳定错误', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const bad = await gitStashAction(repo.root, 'apply', { selector: 'stash@{0}' })
  assert.equal(bad.error.code, 'invalid-stash-selector')
  const missing = await gitStashAction(repo.root, 'apply', { selector: 'refs/stash@{9}' })
  assert.equal(missing.error.code, 'stash-not-found')
})

// ---------- gitStashAction：冲突分类（实测两种形态） ----------

test('gitStashAction.pop: 三方合并冲突 → stash-conflicts 且 stash 保留（CONFLICT 走 stdout）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'c.txt': '1\n' } })
  await repo.write('c.txt', '2\n')
  await repo.git(['stash', 'push', '-q', '-m', 'wip'])
  // 提交另一版 → pop 时与 stash 内容三方合并冲突
  await repo.write('c.txt', '3\n')
  await repo.git(['add', '-A'])
  await repo.git(['commit', '-q', '-m', 'c2'])
  const selector = (await repo.git(['reflog', '--format=%gD', 'refs/stash', '--'])).trim()
  const result = await gitStashAction(repo.root, 'pop', { selector })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'stash-conflicts')
  assert.match(result.error.message, /CONFLICT/)
  // stash 保留（"The stash entry is kept"）
  assert.equal((await repo.git(['stash', 'list'])).trim(), 'stash@{0}: On main: wip')
  // 工作区留下冲突标记
  assert.match((await repo.git(['status', '--porcelain'])).trim(), /^UU c\.txt/)
})

test('gitStashAction.pop: 工作区改动会被覆盖 → stash-conflicts（overwrite 走 stderr）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'c.txt': '1\n' } })
  await repo.write('c.txt', '2\n')
  await repo.git(['stash', 'push', '-q', '-m', 'wip'])
  // 工作区有未提交改动（与 stash 要恢复的文件相同）→ overwrite 拒绝
  await repo.write('c.txt', '3\n')
  const selector = (await repo.git(['reflog', '--format=%gD', 'refs/stash', '--'])).trim()
  const result = await gitStashAction(repo.root, 'pop', { selector })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'stash-conflicts')
  assert.equal((await repo.git(['stash', 'list'])).trim(), 'stash@{0}: On main: wip')
})

// ---------- gitStashAction：branch（从 stash 建分支） ----------

test('gitStashAction.branch: 从 stash 建分支并检出，stash 消失', async (t) => {
  const { repo, selector } = await makeStashedRepo(t)
  const result = await gitStashAction(repo.root, 'branch', { selector, branch: 'from-stash' })
  assert.deepEqual(result, { ok: true, branch: 'from-stash' })
  assert.equal(await repo.currentBranch(), 'from-stash')
  assert.equal((await repo.git(['stash', 'list'])).trim(), '')
  // 改动以暂存态应用到了新分支（stash branch 保留 index 状态）
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), 'M  f.txt')
})

test('gitStashAction.branch: 非法名 / 已存在分支拒绝', async (t) => {
  const { repo, selector } = await makeStashedRepo(t)
  const bad = await gitStashAction(repo.root, 'branch', { selector, branch: 'bad name' })
  assert.equal(bad.error.code, 'invalid-branch-name')
  await repo.branch('dup')
  const dup = await gitStashAction(repo.root, 'branch', { selector, branch: 'dup' })
  assert.equal(dup.error.code, 'branch-already-exists')
})

test('gitStashAction: 未知 action → internal', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitStashAction(repo.root, 'explode')
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'internal')
})

// ---------- 写路由（伪造 cordis ctx）：CSRF / 方法 / 全链路 ----------

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

function fakeReq({ method = 'GET', contentType, body = '', url = GIT_STASH_PATH } = {}) {
  const headers = {}
  if (contentType !== undefined) headers['content-type'] = contentType
  return {
    method,
    headers,
    url,
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

test('stash 路由: GET → 405；非 json → 415；畸形 → 400；未知 action → 400', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(GIT_STASH_PATH)
  let res = fakeRes()
  await route.handler(fakeReq({ method: 'GET' }), res)
  assert.equal(res.status, 405)
  res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'text/plain', body: '{}' }), res)
  assert.equal(res.status, 415)
  res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: 'x' }), res)
  assert.equal(res.status, 400)
  res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"explode"}' }), res)
  assert.equal(res.status, 400)
})

test('stash 路由: 合法 drop 全链路成功', async (t) => {
  const { repo, selector } = await makeStashedRepo(t)
  const route = fakeCtx(repo.root).get(GIT_STASH_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: JSON.stringify({ action: 'drop', selector }) }),
    res,
  )
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.payload), { ok: true })
  assert.equal((await repo.git(['stash', 'list'])).trim(), '')
})

test('stash 路由: 非 git 仓库 → 稳定错误', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-git-status-nogit-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const route = fakeCtx(root).get(GIT_STASH_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"drop","selector":"refs/stash@{0}"}' }),
    res,
  )
  assert.equal(JSON.parse(res.payload).error.code, 'internal')
})
