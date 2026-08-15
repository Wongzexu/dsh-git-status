// git-fetch 测试：远程列表 / 名称校验 / fetch 失败分类 / fetch 动作（file:// 裸仓库
// 真实拉取，含 prune 语义）/ 写路由（含 CSRF 防护）。
// 零依赖：node:test + 真实 git fixture 仓库 + 伪造 cordis ctx。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  GIT_FETCH_PATH,
  gitRemoteList,
  validateRemoteName,
  classifyFetchFailure,
  gitFetchAction,
  gitLogV2,
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

/** 造一个含 main 分支内容的裸仓库远程（本地 file:// 路径，真实 push）。 */
async function makeRemote(t, messages) {
  const bare = await makeBareRepo(t)
  const src = await makeRepo(t)
  for (const m of messages) await src.commit(m)
  await src.git(['remote', 'add', 'origin', bare])
  await src.git(['push', 'origin', 'main'])
  return bare
}

// ---------- validateRemoteName：remote 名（非 ref）形态校验 ----------

test('validateRemoteName: 合法名 → true（含实测 git 接受的 @ / + / 斜杠 / 尾点）', () => {
  for (const name of ['origin', 'gitee', 'my_remote-2', 'a.b', 'Gitee', 'repo@backup', 'upstream+mirror', 'a/b', 'a.']) {
    assert.equal(validateRemoteName(name), true, name)
  }
})

test('validateRemoteName: 非法名 → false（对齐实测 git 拒绝集）', () => {
  for (const bad of ['', 'a b', 'a..b', '.a', 'a/.b', 'x.lock', 'a/b.lock', 'x'.repeat(201)]) {
    assert.equal(validateRemoteName(bad), false, bad)
  }
})

// ---------- gitRemoteList：`git remote` 解析 ----------

test('gitRemoteList: 无 remote → []；添加后按序返回', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  assert.deepEqual(await gitRemoteList(repo.root), [])
  await repo.git(['remote', 'add', 'origin', '/tmp/nonexistent-remote'])
  assert.deepEqual(await gitRemoteList(repo.root), ['origin'])
  await repo.git(['remote', 'add', 'upstream', '/tmp/nonexistent-remote2'])
  assert.deepEqual(await gitRemoteList(repo.root), ['origin', 'upstream'])
})

// ---------- classifyFetchFailure：stderr → 稳定错误码 ----------

test('classifyFetchFailure: 网络/认证 → network-error', () => {
  const cases = [
    "fatal: unable to access 'https://x.example/repo.git/': Could not resolve host: x.example",
    "fatal: Authentication failed for 'https://x.example/repo.git/'",
    'git@x.example: Permission denied (publickey).',
    'ssh: connect to host x.example port 22: Connection refused',
    "fatal: unable to access 'https://x.example/': Failed to connect to x.example port 443: Connection timed out",
  ]
  for (const stderr of cases) {
    assert.equal(classifyFetchFailure(stderr).code, 'network-error', stderr)
  }
})

test('classifyFetchFailure: 远程名存在但仓库不可达 → remote-unreachable', () => {
  const stderr = [
    "fatal: 'nope' does not appear to be a git repository",
    'fatal: Could not read from remote repository.',
    '',
  ].join('\n')
  assert.equal(classifyFetchFailure(stderr).code, 'remote-unreachable')
})

test('classifyFetchFailure: 兜底 internal', () => {
  assert.equal(classifyFetchFailure('fatal: unknown switch `q`').code, 'internal')
})

// ---------- gitFetchAction：真实拉取（file:// 裸仓库往返） ----------

test('gitFetchAction: remote 为空 → fetch --all 全量拉取', async (t) => {
  const bare = await makeRemote(t, ['r1', 'r2'])
  const repo = await makeRepo(t)
  await repo.commit('local')
  await repo.git(['remote', 'add', 'origin', bare])
  const result = await gitFetchAction(repo.root)
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['log', '-1', '--format=%s', 'refs/remotes/origin/main'])).trim(), 'r2')
})

test('gitFetchAction: 指定单 remote 只拉该远程', async (t) => {
  const bare1 = await makeRemote(t, ['r1'])
  const bare2 = await makeRemote(t, ['r2'])
  const repo = await makeRepo(t)
  await repo.commit('local')
  await repo.git(['remote', 'add', 'origin', bare1])
  await repo.git(['remote', 'add', 'upstream', bare2])
  const result = await gitFetchAction(repo.root, { remote: 'upstream' })
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['log', '-1', '--format=%s', 'refs/remotes/upstream/main'])).trim(), 'r2')
  // origin 未被拉取
  const origin = await repo.git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'], true)
  assert.equal(origin.ok, false)
})

test('gitFetchAction: prune 默认关（残留失效跟踪 ref），prune=true 清除', async (t) => {
  const bare = await makeRemote(t, ['c1'])
  const repo = await makeRepo(t)
  await repo.commit('local')
  await repo.git(['remote', 'add', 'origin', bare])
  // 伪造一个远程已删除分支的跟踪 ref
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.git(['update-ref', 'refs/remotes/origin/gone', head])
  // 默认（上游 fetchAndPrune 默认关）：fetch 后残留
  await gitFetchAction(repo.root)
  assert.equal((await repo.git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/gone'], true)).ok, true)
  // prune=true：剪除失效跟踪 ref
  await gitFetchAction(repo.root, { prune: true })
  assert.equal((await repo.git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/gone'], true)).ok, false)
  assert.equal((await repo.git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'], true)).ok, true)
})

test('gitFetchAction: 非法 remote 名拒绝', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitFetchAction(repo.root, { remote: 'my remote' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'invalid-remote-name')
})

test('gitFetchAction: 未知 remote → remote-not-found（服务端权威校验，不跑 git）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitFetchAction(repo.root, { remote: 'nope' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'remote-not-found')
})

test('gitFetchAction: remote 名存在但 URL 仓库不可达 → remote-unreachable', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  // remote 名存在（通过权威校验），但指向的仓库路径不存在
  await repo.git(['remote', 'add', 'origin', join(tmpdir(), 'dsh-gitstatus-does-not-exist')])
  const result = await gitFetchAction(repo.root, { remote: 'origin' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'remote-unreachable')
})

test('gitFetchAction: fetch --all 某远程仓库不可达 → remote-unreachable', async (t) => {
  const bare = await makeRemote(t, ['r1'])
  const repo = await makeRepo(t)
  await repo.commit('local')
  await repo.git(['remote', 'add', 'origin', bare])
  await repo.git(['remote', 'add', 'dead', join(tmpdir(), 'dsh-gitstatus-does-not-exist')])
  const result = await gitFetchAction(repo.root)
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'remote-unreachable')
  // 部分成功：origin 的跟踪 ref 已更新（git 会继续尝试其余远程）
  assert.equal((await repo.git(['log', '-1', '--format=%s', 'refs/remotes/origin/main'])).trim(), 'r1')
})

// ---------- gitLogV2：响应带 remotes（按钮显隐依据） ----------

test('gitLogV2: 响应带 remotes 列表', async (t) => {
  const bare = await makeRemote(t, ['c1'])
  const repo = await makeRepo(t)
  await repo.commit('local')
  assert.deepEqual((await gitLogV2(repo.root)).remotes, [])
  await repo.git(['remote', 'add', 'origin', bare])
  assert.deepEqual((await gitLogV2(repo.root)).remotes, ['origin'])
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

function fakeReq({ method = 'GET', contentType, body = '', url = GIT_FETCH_PATH } = {}) {
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

test('fetch 路由: GET → 405', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(GIT_FETCH_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'GET' }), res)
  assert.equal(res.status, 405)
  assert.equal(JSON.parse(res.payload).error, 'method not allowed')
})

test('fetch 路由: 非 application/json content-type → 415（CSRF 防护）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(GIT_FETCH_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'text/plain', body: '{}' }), res)
  assert.equal(res.status, 415)
  assert.equal(JSON.parse(res.payload).error, 'unsupported media type')
})

test('fetch 路由: 畸形 JSON → 400', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(GIT_FETCH_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: 'not json' }), res)
  assert.equal(res.status, 400)
})

test('fetch 路由: 合法请求全链路成功（fetch --all）', async (t) => {
  const bare = await makeRemote(t, ['r1'])
  const repo = await makeRepo(t)
  await repo.commit('local')
  await repo.git(['remote', 'add', 'origin', bare])
  const route = fakeCtx(repo.root).get(GIT_FETCH_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"remote":"","prune":false}' }),
    res,
  )
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.payload), { ok: true })
  assert.equal((await repo.git(['log', '-1', '--format=%s', 'refs/remotes/origin/main'])).trim(), 'r1')
})

test('fetch 路由: 非 git 仓库 → 稳定错误', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-gitstatus-nogit-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const route = fakeCtx(root).get(GIT_FETCH_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"remote":""}' }),
    res,
  )
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.payload).error.code, 'internal')
})
