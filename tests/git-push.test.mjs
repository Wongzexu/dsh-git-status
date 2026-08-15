// git-push 测试：参数校验 / 失败分类 / 真实推送（file:// 裸仓库往返，含
// set-upstream 与 non-fast-forward 拒绝）/ 写路由（含 CSRF 防护）。
// 零依赖：node:test + 真实 git fixture 仓库 + 伪造 cordis ctx。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  GIT_PUSH_PATH,
  classifyPushFailure,
  gitPushAction,
  apply,
} from '../lib/index.mjs'
import { makeRepo, runGit } from './fixtures/repo.mjs'

/** 建一个裸仓库（t.after 自动清理）。 */
async function makeBareRepo(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-gitstatus-bare-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await runGit(root, ['init', '--bare'])
  return root
}

// ---------- 参数校验 ----------

test('gitPushAction: 非法分支名 / 非法 remote / 非法 mode / 空参数拒绝', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', '/tmp/nonexistent-remote'])
  const badBranch = await gitPushAction(repo.root, { branch: 'bad name', remotes: ['origin'] })
  assert.equal(badBranch.error.code, 'invalid-branch-name')
  const badRemote = await gitPushAction(repo.root, { branch: 'main', remotes: ['my remote'] })
  assert.equal(badRemote.error.code, 'invalid-remote-name')
  const badMode = await gitPushAction(repo.root, { branch: 'main', remotes: ['origin'], mode: 'explode' })
  assert.equal(badMode.error.code, 'invalid-push-mode')
})

test('gitPushAction: remote 不存在 / 分支不存在拒绝', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const noRemote = await gitPushAction(repo.root, { branch: 'main', remotes: ['nope'] })
  assert.equal(noRemote.error.code, 'remote-not-found')
  await repo.git(['remote', 'add', 'origin', '/tmp/nonexistent-remote'])
  const noBranch = await gitPushAction(repo.root, { branch: 'ghost', remotes: ['origin'] })
  assert.equal(noBranch.error.code, 'target-branch-not-found')
})

// ---------- classifyPushFailure：stderr → 稳定错误码 ----------

test('classifyPushFailure: non-fast-forward → push-rejected', () => {
  const stderr = [
    ' ! [rejected]        main -> main (non-fast-forward)',
    "error: failed to push some refs to '/tmp/bare'",
    'hint: Updates were rejected because the tip of your current branch is behind',
  ].join('\n')
  assert.equal(classifyPushFailure(stderr).code, 'push-rejected')
})

test('classifyPushFailure: fetch first → push-rejected；remote rejected → remote-rejected', () => {
  const fetchFirst = ' ! [rejected]        main -> main (fetch first)'
  assert.equal(classifyPushFailure(fetchFirst).code, 'push-rejected')
  const hookReject = ' ! [remote rejected] main -> main (pre-receive hook declined)'
  assert.equal(classifyPushFailure(hookReject).code, 'remote-rejected')
})

test('classifyPushFailure: 网络/认证 → network-error；兜底 internal', () => {
  assert.equal(classifyPushFailure("fatal: unable to access 'https://x/': Could not resolve host: x").code, 'network-error')
  assert.equal(classifyPushFailure('fatal: unknown switch `q`').code, 'internal')
})

// ---------- 真实推送（file:// 裸仓库往返） ----------

test('gitPushAction: 普通推送成功，set-upstream 写入 tracking 配置', async (t) => {
  const bare = await makeBareRepo(t)
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', bare])
  const result = await gitPushAction(repo.root, { branch: 'main', remotes: ['origin'], setUpstream: true })
  assert.deepEqual(result, { ok: true })
  // 裸仓库已有 refs/heads/main
  assert.equal((await runGit(bare, ['rev-parse', 'refs/heads/main'])).trim(), (await repo.git(['rev-parse', 'HEAD'])).trim())
  // --set-upstream 生效：branch.main.remote = origin
  assert.equal((await repo.git(['config', 'branch.main.remote'])).trim(), 'origin')
})

test('gitPushAction: non-fast-forward 拒绝 → push-rejected；force 模式成功', async (t) => {
  const bare = await makeBareRepo(t)
  const repoA = await makeRepo(t)
  await repoA.commit('a1')
  await repoA.git(['remote', 'add', 'origin', bare])
  await gitPushAction(repoA.root, { branch: 'main', remotes: ['origin'] })
  // 另一仓库推不同历史 → non-fast-forward
  const repoB = await makeRepo(t)
  await repoB.commit('b1')
  await repoB.git(['remote', 'add', 'origin', bare])
  const rejected = await gitPushAction(repoB.root, { branch: 'main', remotes: ['origin'] })
  assert.equal(rejected.ok, false)
  assert.equal(rejected.error.code, 'push-rejected')
  // force 模式覆盖
  const forced = await gitPushAction(repoB.root, { branch: 'main', remotes: ['origin'], mode: 'force' })
  assert.deepEqual(forced, { ok: true })
  assert.equal((await runGit(bare, ['rev-parse', 'refs/heads/main'])).trim(), (await repoB.git(['rev-parse', 'HEAD'])).trim())
})

test('gitPushAction: force-with-lease 模式参数生效', async (t) => {
  const bare = await makeBareRepo(t)
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', bare])
  const result = await gitPushAction(repo.root, { branch: 'main', remotes: ['origin'], mode: 'force-with-lease' })
  assert.deepEqual(result, { ok: true })
})

test('gitPushAction: 多远程顺序推，全部成功', async (t) => {
  const bare1 = await makeBareRepo(t)
  const bare2 = await makeBareRepo(t)
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', bare1])
  await repo.git(['remote', 'add', 'upstream', bare2])
  const result = await gitPushAction(repo.root, { branch: 'main', remotes: ['origin', 'upstream'], setUpstream: true })
  assert.deepEqual(result, { ok: true })
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  assert.equal((await runGit(bare1, ['rev-parse', 'refs/heads/main'])).trim(), head)
  assert.equal((await runGit(bare2, ['rev-parse', 'refs/heads/main'])).trim(), head)
})

test('gitPushAction: 多远程顺序推，某远程失败即停（前面已成功的保留）', async (t) => {
  const bare1 = await makeBareRepo(t)
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', bare1])
  await repo.git(['remote', 'add', 'dead', join(tmpdir(), 'dsh-gitstatus-does-not-exist')])
  const result = await gitPushAction(repo.root, { branch: 'main', remotes: ['origin', 'dead'] })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'remote-unreachable')
  // 第一个远程已成功
  assert.equal((await runGit(bare1, ['rev-parse', 'refs/heads/main'])).trim(), (await repo.git(['rev-parse', 'HEAD'])).trim())
})

test('gitPushAction: remotes 空数组 / 含非法项拒绝', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', '/tmp/nonexistent-remote'])
  const empty = await gitPushAction(repo.root, { branch: 'main', remotes: [] })
  assert.equal(empty.error.code, 'invalid-remote-name')
  const mixed = await gitPushAction(repo.root, { branch: 'main', remotes: ['origin', 'my remote'] })
  assert.equal(mixed.error.code, 'invalid-remote-name')
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

function fakeReq({ method = 'GET', contentType, body = '', url = GIT_PUSH_PATH } = {}) {
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

test('push 路由: GET → 405；非 json → 415；畸形 → 400', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(GIT_PUSH_PATH)
  let res = fakeRes()
  await route.handler(fakeReq({ method: 'GET' }), res)
  assert.equal(res.status, 405)
  res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'text/plain', body: '{}' }), res)
  assert.equal(res.status, 415)
  res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: 'x' }), res)
  assert.equal(res.status, 400)
})

test('push 路由: 合法请求全链路成功', async (t) => {
  const bare = await makeBareRepo(t)
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', bare])
  const route = fakeCtx(repo.root).get(GIT_PUSH_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"branch":"main","remotes":["origin"],"setUpstream":true,"mode":"normal"}' }),
    res,
  )
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.payload), { ok: true })
  assert.equal((await repo.git(['config', 'branch.main.remote'])).trim(), 'origin')
})

test('push 路由: 非 git 仓库 → 稳定错误', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-gitstatus-nogit-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const route = fakeCtx(root).get(GIT_PUSH_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"branch":"main","remotes":["origin"]}' }),
    res,
  )
  assert.equal(JSON.parse(res.payload).error.code, 'internal')
})
