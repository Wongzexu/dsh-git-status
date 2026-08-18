import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  GIT_DISCARD_PATH,
  gitDiscardAction,
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
  return routes.find((route) => route.path === GIT_DISCARD_PATH)
}

function fakeReq({ method = 'POST', contentType = 'application/json', body = '{}', session } = {}) {
  const payload = JSON.parse(body)
  if (session !== undefined) payload.session = session
  body = JSON.stringify(payload)
  return {
    method,
    headers: { 'content-type': contentType },
    url: GIT_DISCARD_PATH,
    [Symbol.asyncIterator]: async function* () { yield body },
  }
}

function fakeRes() {
  const res = { status: 0, payload: '' }
  res.writeHead = (status) => { res.status = status }
  res.end = (payload = '') => { res.payload = payload }
  return res
}

test('gitDiscardAction: 丢弃已暂存、未暂存与未跟踪改动', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'keep.txt': 'A\n', 'del.txt': 'D\n' } })
  await repo.write('keep.txt', 'B\n') // 未暂存修改
  await repo.write('stage.txt', 'S\n') // 新增（未跟踪）
  await repo.git(['add', 'stage.txt']) // 变为已暂存新增
  await repo.write('stage.txt', 'S2\n') // 部分暂存：MM（已暂存 + 未暂存）
  await repo.rmFile('del.txt') // 未暂存删除

  const result = await gitDiscardAction(repo.root)
  assert.equal(result.ok, true)
  assert.deepEqual(result.counts, { total: 0, staged: 0, unstaged: 0, untracked: 0 })
  assert.equal((await repo.git(['status', '--porcelain'])).trim(), '')
  assert.equal(await readFile(join(repo.root, 'keep.txt'), 'utf8'), 'A\n')
  await assert.rejects(access(join(repo.root, 'stage.txt')))
  // 已跟踪文件的「删除」被丢弃 = 恢复到 HEAD 内容，文件重新出现
  assert.equal(await readFile(join(repo.root, 'del.txt'), 'utf8'), 'D\n')
})

test('gitDiscardAction: 无提交（unborn）时全量清空', async (t) => {
  const repo = await makeRepo(t)
  await repo.write('a.txt', 'A\n')
  await repo.write('b.txt', 'B\n')
  await repo.git(['add', 'a.txt']) // 已暂存；b.txt 未跟踪

  const result = await gitDiscardAction(repo.root)
  assert.equal(result.ok, true)
  assert.deepEqual(result.counts, { total: 0, staged: 0, unstaged: 0, untracked: 0 })
  await assert.rejects(access(join(repo.root, 'a.txt')))
  await assert.rejects(access(join(repo.root, 'b.txt')))
})

test('gitDiscardAction: 干净仓库无变化但成功', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base')
  assert.deepEqual(await gitDiscardAction(repo.root), {
    ok: true,
    counts: { total: 0, staged: 0, unstaged: 0, untracked: 0 },
  })
})

test('gitDiscardAction: 保留被忽略文件（clean 不带 -x）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'keep.txt': 'A\n' } })
  await repo.write('.gitignore', 'ignored.log\n')
  await repo.git(['add', '.gitignore'])
  await repo.git(['commit', '-m', 'gitignore'])
  await repo.write('ignored.log', 'x\n')
  await repo.write('junk.txt', 'y\n')

  const result = await gitDiscardAction(repo.root)
  assert.equal(result.ok, true)
  assert.equal(await readFile(join(repo.root, 'ignored.log'), 'utf8'), 'x\n')
  await assert.rejects(access(join(repo.root, 'junk.txt')))
})

test('discard 路由: 方法、content-type、JSON 和 session 校验', async (t) => {
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
    method: 'POST', headers: { 'content-type': 'application/json' }, url: GIT_DISCARD_PATH,
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

test('discard 路由: 使用目标 session 工作区，不回退 registry 首项', async (t) => {
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
  assert.equal((await repoB.git(['status', '--porcelain'])).trim(), '')
  assert.equal((await repoA.git(['status', '--porcelain'])).trim(), '')
})