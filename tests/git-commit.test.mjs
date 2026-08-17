import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmod, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  GIT_COMMIT_PATH,
  classifyCommitFailure,
  gitCommitAction,
  registerRoutes,
} from '../lib/index.mjs'
import { makeConflictedRepo, makeRepo } from './fixtures/repo.mjs'

function fakeCtx(root, sessionRoots = { 'test-session': root }) {
  const routes = []
  const ctx = {
    sessions: { get: (id) => sessionRoots[id] === undefined ? undefined : { header: { cwd: sessionRoots[id] } } },
    workspaceRegistry: { list: () => [{ path: root }] },
    webServer: { register: (route) => { routes.push(route); return () => {} } },
    effect: (fn) => fn(),
  }
  registerRoutes(ctx)
  return routes.find((route) => route.path === GIT_COMMIT_PATH)
}

function fakeReq({ method = 'POST', contentType = 'application/json', body = {}, session = 'test-session' } = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify({ ...body, session })
  return {
    method,
    headers: { 'content-type': contentType },
    url: GIT_COMMIT_PATH,
    [Symbol.asyncIterator]: async function* () { yield payload },
  }
}

function fakeRes() {
  const res = { status: 0, payload: '' }
  res.writeHead = (status) => { res.status = status }
  res.end = (payload = '') => { res.payload = payload }
  return res
}

test('gitCommitAction: 普通提交只提交 staged 内容并返回完整 hash', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'f.txt': 'A\n' } })
  await repo.write('f.txt', 'staged\n')
  await repo.git(['add', 'f.txt'])
  await repo.write('f.txt', 'unstaged\n')

  const result = await gitCommitAction(repo.root, { message: 'subject\n\nbody' })
  assert.equal(result.ok, true)
  assert.match(result.hash, /^[0-9a-f]{40}$/)
  assert.equal((await repo.git(['log', '-1', '--format=%B'])).trim(), 'subject\n\nbody')
  assert.equal((await repo.git(['show', 'HEAD:f.txt'])).trim(), 'staged')
  assert.equal((await repo.git(['status', '--porcelain'])).trimEnd(), ' M f.txt')
})

test('gitCommitAction: 无 staged 内容拒绝普通提交', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base')
  await repo.write('a.txt', 'unstaged')
  const result = await gitCommitAction(repo.root, { message: 'no staged' })
  assert.equal(result.error.code, 'nothing-to-commit')
})

test('gitCommitAction: 空消息、身份缺失和 amend 无 HEAD', async (t) => {
  const emptyRepo = await makeRepo(t)
  assert.equal((await gitCommitAction(emptyRepo.root, { message: '  \n' })).error.code, 'empty-commit-message')

  const identityRepo = await makeRepo(t)
  await identityRepo.git(['config', '--local', 'user.name', ''])
  await identityRepo.git(['config', '--local', 'user.email', ''])
  assert.equal((await gitCommitAction(identityRepo.root, { message: 'message' })).error.code, 'identity-missing')

  const noHeadRepo = await makeRepo(t)
  assert.equal((await gitCommitAction(noHeadRepo.root, { message: 'message', amend: true })).error.code, 'no-commit-to-amend')
})

test('gitCommitAction: amend 可只修改上一条消息且不带入未暂存改动', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('old', { files: { 'f.txt': 'A\n' } })
  await repo.write('f.txt', 'working tree\n')
  const beforeCount = (await repo.git(['rev-list', '--count', 'HEAD'])).trim()
  const result = await gitCommitAction(repo.root, { message: 'amended', amend: true })
  assert.equal(result.ok, true)
  assert.equal((await repo.git(['rev-list', '--count', 'HEAD'])).trim(), beforeCount)
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'amended')
  assert.equal((await repo.git(['status', '--porcelain'])).trimEnd(), ' M f.txt')
})

test('gitCommitAction: 冲突和 hook 拒绝分类稳定', async (t) => {
  const conflicted = await makeConflictedRepo(t)
  const conflict = await gitCommitAction(conflicted.root, { message: 'resolve' })
  assert.equal(conflict.error.code, 'unmerged-files')

  const repo = await makeRepo(t)
  await repo.commit('base')
  await repo.write('hook.txt', 'hook')
  await repo.git(['add', '-A'])
  const hook = join(repo.root, '.git', 'hooks', 'pre-commit')
  await writeFile(hook, '#!/bin/sh\necho rejected by hook >&2\nexit 1\n', 'utf8')
  await chmod(hook, 0o755)
  const result = await gitCommitAction(repo.root, { message: 'blocked' })
  assert.equal(result.error.code, 'commit-hook-failed')
  assert.match(result.error.message, /hook/i)
})

test('classifyCommitFailure: 支持 stdout/stderr 失败信息', () => {
  assert.equal(classifyCommitFailure(Object.assign(new Error(''), { stdout: 'nothing to commit' })).code, 'nothing-to-commit')
  assert.equal(classifyCommitFailure(Object.assign(new Error(''), { stdout: 'unmerged paths' })).code, 'unmerged-files')
})

test('commit 路由: 方法、content-type、JSON、session 和全链路', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base')
  await repo.write('new.txt', 'new')
  await repo.git(['add', '-A'])
  const route = fakeCtx(repo.root)

  const method = fakeRes()
  await route.handler(fakeReq({ method: 'GET' }), method)
  assert.equal(method.status, 405)

  const contentType = fakeRes()
  await route.handler(fakeReq({ contentType: 'text/plain' }), contentType)
  assert.equal(contentType.status, 415)

  const malformed = fakeRes()
  await route.handler(fakeReq({ body: '{' }), malformed)
  assert.equal(malformed.status, 400)

  for (const [session, status, code] of [['', 400, 'session-required'], ['missing-session', 404, 'session-not-found']]) {
    const response = fakeRes()
    await route.handler(fakeReq({ body: { message: 'message' }, session }), response)
    assert.equal(response.status, status)
    assert.equal(JSON.parse(response.payload).error.code, code)
  }

  const response = fakeRes()
  await route.handler(fakeReq({ body: { message: 'route commit' } }), response)
  assert.equal(response.status, 200)
  assert.equal(JSON.parse(response.payload).ok, true)
  assert.equal((await repo.git(['log', '-1', '--format=%s'])).trim(), 'route commit')
})

test('commit 路由: 使用目标 session 工作区，不回退 registry 首项', async (t) => {
  const repoA = await makeRepo(t)
  const repoB = await makeRepo(t)
  await repoA.commit('a')
  await repoB.commit('b')
  await repoB.write('b.txt', 'changed')
  await repoB.git(['add', '-A'])
  const route = fakeCtx(repoA.root, { a: repoA.root, b: repoB.root })
  const response = fakeRes()
  await route.handler(fakeReq({ body: { message: 'b commit' }, session: 'b' }), response)
  assert.equal(JSON.parse(response.payload).ok, true)
  assert.equal((await repoB.git(['log', '-1', '--format=%s'])).trim(), 'b commit')
  assert.equal((await repoA.git(['log', '-1', '--format=%s'])).trim(), 'a')
})
