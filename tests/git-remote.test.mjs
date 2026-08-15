// git-remote 测试：tag 名校验 / 删除远程分支（含降级）/ 推送 tag / 删除 tag
// （仅本地 / 同步远程）/ 写路由（含 CSRF 防护）。
// 零依赖：node:test + 真实 git fixture 仓库（file:// 裸仓库往返）+ 伪造 cordis ctx。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  GIT_REMOTE_PATH,
  validateTagName,
  gitRemoteAction,
  gitPushAction,
  apply,
} from '../lib/index.mjs'
import { makeRepo, runGit, runGitSafe } from './fixtures/repo.mjs'

/** 建一个裸仓库（t.after 自动清理）。 */
async function makeBareRepo(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-git-status-bare-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await runGit(root, ['init', '--bare'])
  return root
}

/** 造一个「本地仓库 + 已连接裸远程」：返回 { repo, bare }。 */
async function makeRepoWithRemote(t) {
  const bare = await makeBareRepo(t)
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', bare])
  return { repo, bare }
}

// ---------- validateTagName ----------

test('validateTagName: 合法/非法', () => {
  for (const ok of ['v1.0', 'release/v1', 'a_b-c', 'v1.0.0-rc1']) {
    assert.equal(validateTagName(ok), true, ok)
  }
  for (const bad of ['', '..', 'a..b', 'a b', 'a@{b', '/x', 'x/', '.x', 'x.', 'x'.repeat(201), 'a~b', 'a^b', 'a:b', 'a?b', 'a*b', 'a[b', 'a\\b']) {
    assert.equal(validateTagName(bad), false, bad)
  }
})

// ---------- gitRemoteAction：delete-branch ----------

test('gitRemoteAction.delete-branch: 删除远程分支 + 本地跟踪 ref', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  // 推送 main + 建远程分支 feat（模拟）
  await gitPushAction(repo.root, { branch: 'main', remotes: ['origin'] })
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.git(['update-ref', 'refs/remotes/origin/feat', head])
  await runGit(bare, ['update-ref', 'refs/heads/feat', head])
  // 删除远程分支
  const result = await gitRemoteAction(repo.root, 'delete-branch', { branch: 'feat', remote: 'origin' })
  assert.deepEqual(result, { ok: true })
  // 裸仓库 refs/heads/feat 消失
  assert.equal((await runGitSafe(bare, ['rev-parse', '--verify', '--quiet', 'refs/heads/feat'])).ok, false)
  // 本地跟踪 ref 消失
  assert.equal((await repo.git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/feat'], true)).ok, false)
})

test('gitRemoteAction.delete-branch: 远程分支已不存在 → 降级清理本地跟踪 ref', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  await gitPushAction(repo.root, { branch: 'main', remotes: ['origin'] })
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  // 本地有跟踪 ref，但远程分支不存在（远程已删）
  await repo.git(['update-ref', 'refs/remotes/origin/gone', head])
  const result = await gitRemoteAction(repo.root, 'delete-branch', { branch: 'gone', remote: 'origin' })
  assert.deepEqual(result, { ok: true, degraded: true })
  assert.equal((await repo.git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/gone'], true)).ok, false)
})

test('gitRemoteAction.delete-branch: 校验（非法分支名/非法远程/远程不存在）', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  await gitPushAction(repo.root, { branch: 'main', remotes: ['origin'] })
  const badBranch = await gitRemoteAction(repo.root, 'delete-branch', { branch: 'bad name', remote: 'origin' })
  assert.equal(badBranch.error.code, 'invalid-branch-name')
  const badRemote = await gitRemoteAction(repo.root, 'delete-branch', { branch: 'main', remote: 'my remote' })
  assert.equal(badRemote.error.code, 'invalid-remote-name')
  const noRemote = await gitRemoteAction(repo.root, 'delete-branch', { branch: 'main', remote: 'nope' })
  assert.equal(noRemote.error.code, 'remote-not-found')
})

// ---------- gitRemoteAction：push-tag ----------

test('gitRemoteAction.push-tag: 推送 tag 到远程', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  await repo.git(['tag', 'v1.0'])
  const result = await gitRemoteAction(repo.root, 'push-tag', { tag: 'v1.0', remote: 'origin' })
  assert.deepEqual(result, { ok: true })
  const bareTag = (await runGit(bare, ['rev-parse', 'refs/tags/v1.0'])).trim()
  assert.equal(bareTag, (await repo.git(['rev-parse', 'refs/tags/v1.0'])).trim())
})

test('gitRemoteAction.push-tag: tag 不存在 / 非法名 / 远程不存在', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  await repo.git(['tag', 'v1.0'])
  const missing = await gitRemoteAction(repo.root, 'push-tag', { tag: 'nope', remote: 'origin' })
  assert.equal(missing.error.code, 'tag-not-found')
  const bad = await gitRemoteAction(repo.root, 'push-tag', { tag: 'a..b', remote: 'origin' })
  assert.equal(bad.error.code, 'invalid-tag-name')
  const noRemote = await gitRemoteAction(repo.root, 'push-tag', { tag: 'v1.0', remote: 'nope' })
  assert.equal(noRemote.error.code, 'remote-not-found')
})

// ---------- gitRemoteAction：delete-tag ----------

test('gitRemoteAction.delete-tag: 仅删除本地（远程保留）', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  await repo.git(['tag', 'v1.0'])
  await gitRemoteAction(repo.root, 'push-tag', { tag: 'v1.0', remote: 'origin' })
  const result = await gitRemoteAction(repo.root, 'delete-tag', { tag: 'v1.0' })
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['rev-parse', '--verify', '--quiet', 'refs/tags/v1.0'], true)).ok, false)
  // 远程保留
  assert.equal((await runGitSafe(bare, ['rev-parse', '--verify', '--quiet', 'refs/tags/v1.0'])).ok, true)
})

test('gitRemoteAction.delete-tag: 同步删除远程', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  await repo.git(['tag', 'v1.0'])
  await gitRemoteAction(repo.root, 'push-tag', { tag: 'v1.0', remote: 'origin' })
  const result = await gitRemoteAction(repo.root, 'delete-tag', { tag: 'v1.0', remote: 'origin' })
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['rev-parse', '--verify', '--quiet', 'refs/tags/v1.0'], true)).ok, false)
  assert.equal((await runGitSafe(bare, ['rev-parse', '--verify', '--quiet', 'refs/tags/v1.0'])).ok, false)
})

test('gitRemoteAction.delete-tag: tag 不存在', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  const result = await gitRemoteAction(repo.root, 'delete-tag', { tag: 'nope' })
  assert.equal(result.error.code, 'tag-not-found')
})

test('gitRemoteAction: 未知 action → internal', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  const result = await gitRemoteAction(repo.root, 'explode')
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

function fakeReq({ method = 'GET', contentType, body = '', url = GIT_REMOTE_PATH } = {}) {
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

test('remote 路由: GET → 405；非 json → 415；畸形 → 400；未知 action → 400', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  const route = fakeCtx(repo.root).get(GIT_REMOTE_PATH)
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

test('remote 路由: 合法 push-tag 全链路成功', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  await repo.git(['tag', 'v1.0'])
  const route = fakeCtx(repo.root).get(GIT_REMOTE_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"push-tag","tag":"v1.0","remote":"origin"}' }),
    res,
  )
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.payload), { ok: true })
  assert.equal((await runGitSafe(bare, ['rev-parse', '--verify', '--quiet', 'refs/tags/v1.0'])).ok, true)
})

test('remote 路由: 非 git 仓库 → 稳定错误', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-git-status-nogit-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const route = fakeCtx(root).get(GIT_REMOTE_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"push-tag","tag":"v1","remote":"origin"}' }),
    res,
  )
  assert.equal(JSON.parse(res.payload).error.code, 'internal')
})
