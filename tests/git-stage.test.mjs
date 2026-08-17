import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  GIT_STAGE_PATH,
  gitStageAction,
  registerRoutes,
} from '../lib/index.mjs'
import { makeRepo } from './fixtures/repo.mjs'

function fakeCtx(root, sessionRoots = { 'test-session': root }) {
  const routes = []
  const ctx = {
    sessions: { get: (id) => sessionRoots[id] === undefined ? undefined : { header: { cwd: sessionRoots[id] } } },
    workspaceRegistry: { list: () => [{ path: root }] },
    webServer: { register: (route) => { routes.push(route); return () => {} } },
    effect: (fn) => fn(),
  }
  registerRoutes(ctx)
  return routes.find((route) => route.path === GIT_STAGE_PATH)
}

function fakeReq({ method = 'POST', contentType = 'application/json', body = '{}', session } = {}) {
  const payload = JSON.parse(body)
  if (session !== undefined) payload.session = session
  body = JSON.stringify(payload)
  return {
    method,
    headers: { 'content-type': contentType },
    url: GIT_STAGE_PATH,
    [Symbol.asyncIterator]: async function* () { yield body },
  }
}

function fakeRes() {
  const res = { status: 0, payload: '' }
  res.writeHead = (status) => { res.status = status }
  res.end = (payload = '') => { res.payload = payload }
  return res
}

test('gitStageAction: 暂存新增、修改和删除', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'keep.txt': 'A\n', 'delete.txt': 'D\n' } })
  await repo.write('keep.txt', 'B\n')
  await repo.write('new.txt', 'N\n')
  await repo.rmFile('delete.txt')

  const result = await gitStageAction(repo.root)
  assert.equal(result.ok, true)
  assert.deepEqual(result.counts, { total: 3, staged: 3, unstaged: 0, untracked: 0 })
  assert.equal((await repo.git(['diff', '--cached', '--name-status'])).trim(), 'D\tdelete.txt\nM\tkeep.txt\nA\tnew.txt')
})

test('gitStageAction: 干净仓库无变化但成功', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base')
  assert.deepEqual(await gitStageAction(repo.root), {
    ok: true,
    counts: { total: 0, staged: 0, unstaged: 0, untracked: 0 },
  })
})

test('stage 路由: 方法、content-type、JSON 和 session 校验', async (t) => {
  const repo = await makeRepo(t)
  const route = fakeCtx(repo.root)

  const method = fakeRes()
  await route.handler(fakeReq({ method: 'GET', body: '{}', session: 'test-session' }), method)
  assert.equal(method.status, 405)

  const contentType = fakeRes()
  await route.handler(fakeReq({ contentType: 'text/plain', body: '{}', session: 'test-session' }), contentType)
  assert.equal(contentType.status, 415)

  const malformed = fakeRes()
  await route.handler({
    method: 'POST', headers: { 'content-type': 'application/json' }, url: GIT_STAGE_PATH,
    [Symbol.asyncIterator]: async function* () { yield '{' },
  }, malformed)
  assert.equal(malformed.status, 400)

  for (const [session, status, code] of [['', 400, 'session-required'], ['missing-session', 404, 'session-not-found']]) {
    const response = fakeRes()
    await route.handler(fakeReq({ session, body: '{}' }), response)
    assert.equal(response.status, status)
    assert.equal(JSON.parse(response.payload).error.code, code)
  }
})

test('stage 路由: 使用目标 session 工作区，不回退 registry 首项', async (t) => {
  const repoA = await makeRepo(t)
  const repoB = await makeRepo(t)
  await repoA.commit('a')
  await repoB.commit('b')
  await repoB.write('b.txt', 'changed\n')
  const route = fakeCtx(repoA.root, { a: repoA.root, b: repoB.root })
  const response = fakeRes()
  await route.handler(fakeReq({ session: 'b', body: '{}' }), response)
  assert.equal(response.status, 200)
  assert.equal(JSON.parse(response.payload).ok, true)
  assert.equal((await repoB.git(['diff', '--cached', '--name-only'])).trim(), 'b.txt')
  assert.equal((await repoA.git(['diff', '--cached', '--name-only'])).trim(), '')
})
