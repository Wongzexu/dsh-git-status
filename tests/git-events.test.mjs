// /git/events SSE 测试：连接即推初始状态、状态键变化才推、心跳保活、断连清理。
// 零依赖：node:test + 真实 git fixture + 伪造 ctx/res（短轮询间隔注入）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GIT_EVENTS_PATH, registerRoutes } from '../lib/index.mjs'
import { makeRepo } from './fixtures/repo.mjs'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 注册路由（短间隔），返回注册表。 */
function fakeCtx(root, intervals) {
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
  }
  registerRoutes(ctx, { events: intervals })
  return routes
}

/** 可触发的流式 res/req（记录 writeHead/write；end 幂等，close 只触发一次，
 *  避免 cleanup → res.end() → emit('close') → cleanup 无限递归）。 */
function fakeStream() {
  const handlers = {}
  return {
    chunks: [],
    status: 0,
    headers: null,
    ended: false,
    writeHead(status, headers) { this.status = status; this.headers = headers },
    write(chunk) { this.chunks.push(String(chunk)) },
    end() {
      if (this.ended) return
      this.ended = true
      this.emit('close')
    },
    on(event, fn) { (handlers[event] ??= []).push(fn) },
    emit(event) { for (const fn of handlers[event] ?? []) fn() },
    text() { return this.chunks.join('') },
  }
}

/** SSE 帧解析 → [{ event, data }]（心跳注释帧为 message/''）。 */
function parseFrames(text) {
  return text.split('\n\n').filter((frame) => frame !== '').map((frame) => ({
    event: /^event: (.+)$/m.exec(frame)?.[1] ?? 'message',
    data: /^data: (.+)$/m.exec(frame)?.[1] ?? '',
  }))
}

const changeCount = (res) => parseFrames(res.text()).filter((f) => f.event === 'change').length

test('events: 连接即推初始状态，无变化不重复推，变化才推', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root, { pollIntervalMs: 20, heartbeatMs: 40 }).find((r) => r.path === GIT_EVENTS_PATH)
  const res = fakeStream()
  const req = fakeStream()
  req.method = 'GET'
  req.headers = {}
  req.url = GIT_EVENTS_PATH
  await route.handler(req, res)
  t.after(() => req.emit('close'))
  await wait(150)
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'text/event-stream; charset=utf-8')
  assert.equal(changeCount(res), 1) // 初始推送
  const first = parseFrames(res.text()).find((f) => f.event === 'change')
  assert.ok(first.data.includes('"key"'))
  await wait(120)
  assert.equal(changeCount(res), 1) // 无变化不重复推
  await repo.commit('c2') // 仓库状态变化
  await wait(200)
  assert.ok(changeCount(res) >= 2, `expected >=2 change events, got ${changeCount(res)}`)
})

test('events: 断连后清理订阅，不再推送', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root, { pollIntervalMs: 20, heartbeatMs: 40 }).find((r) => r.path === GIT_EVENTS_PATH)
  const res = fakeStream()
  const req = fakeStream()
  req.method = 'GET'
  req.headers = {}
  req.url = GIT_EVENTS_PATH
  await route.handler(req, res)
  await wait(150)
  req.emit('close') // 客户端断开
  const count = changeCount(res)
  await repo.commit('c3')
  await wait(150)
  assert.equal(changeCount(res), count) // 清理后不再推
})

test('events: 心跳注释保活（: ping）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root, { pollIntervalMs: 100, heartbeatMs: 30 }).find((r) => r.path === GIT_EVENTS_PATH)
  const res = fakeStream()
  const req = fakeStream()
  req.method = 'GET'
  req.headers = {}
  req.url = GIT_EVENTS_PATH
  await route.handler(req, res)
  t.after(() => req.emit('close'))
  await wait(150)
  assert.ok(res.text().includes(': ping'), 'expected heartbeat comment frames')
})

test('events: 非 GET → 405', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root, { pollIntervalMs: 100, heartbeatMs: 100 }).find((r) => r.path === GIT_EVENTS_PATH)
  const res = fakeStream()
  const req = fakeStream()
  req.method = 'POST'
  req.headers = {}
  req.url = GIT_EVENTS_PATH
  await route.handler(req, res)
  assert.equal(res.status, 405)
})
