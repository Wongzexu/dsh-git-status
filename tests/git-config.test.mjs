// git-config 测试：user.name/email 两层读取 / set / delete / switch-layer / 写路由（含 CSRF）。
// 零依赖：node:test + 真实 git fixture 仓库 + 伪造 cordis ctx。
// global 层用例通过临时 HOME 隔离（git config --global 读写 ~/.gitconfig）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  parseConfigList,
  gitUserConfig,
  validateUserConfigValue,
  gitUserConfigSet,
  gitUserConfigDelete,
  gitUserConfigSwitch,
  apply,
} from '../lib/index.mjs'
import { makeRepo } from './fixtures/repo.mjs'

/** 临时 HOME 隔离（global config 用例）；返回恢复函数。 */
async function withFakeHome(t) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-gitstatus-home-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const oldHome = process.env.HOME
  process.env.HOME = home
  t.after(() => { process.env.HOME = oldHome })
  return home
}

// ---------- parseConfigList ----------

test('parseConfigList: 基础解析', () => {
  const map = parseConfigList('user.name=Alice\nuser.email=a@b.c\ncore.editor=vim\n')
  assert.equal(map.get('user.name'), 'Alice')
  assert.equal(map.get('user.email'), 'a@b.c')
  assert.equal(map.get('core.editor'), 'vim')
})

test('parseConfigList: 键大小写不敏感、多值取最后、跳过无 = 行', () => {
  const map = parseConfigList('User.Name=Alice\nuser.name=Bob\n\ncontinuation line\nuser.email=')
  assert.equal(map.get('user.name'), 'Bob') // 最后值生效（同 git config <key>）
  assert.equal(map.get('user.email'), '')
  assert.equal(map.has('continuation'), false)
})

// ---------- validateUserConfigValue ----------

test('validateUserConfigValue: 合法值 → null', () => {
  assert.equal(validateUserConfigValue('Alice'), null)
  assert.equal(validateUserConfigValue(''), null) // 空串 = 删除语义，允许
  assert.equal(validateUserConfigValue('a'.repeat(100)), null)
})

test('validateUserConfigValue: 非法值 → 稳定原因', () => {
  assert.equal(validateUserConfigValue(42), 'invalid-value')
  assert.equal(validateUserConfigValue('a'.repeat(101)), 'value-too-long')
  assert.equal(validateUserConfigValue('a\x01b'), 'invalid-characters')
  assert.equal(validateUserConfigValue('a\nb'), 'invalid-characters')
})

// ---------- gitUserConfig：两层读取 ----------

test('gitUserConfig: local 有值 global 无 → local 生效', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await withFakeHome(t) // 隔离真实 ~/.gitconfig
  const user = await gitUserConfig(repo.root)
  assert.equal(user.name.local, 'Test User')
  assert.equal(user.name.global, null)
  assert.equal(user.email.local, 'test@example.com')
  assert.equal(user.email.global, null)
})

test('gitUserConfig: local 删除后 global 浮现（临时 HOME）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await withFakeHome(t)
  await repo.git(['config', '--global', 'user.name', 'Global User'])
  await repo.git(['config', '--local', '--unset-all', 'user.name'])
  const user = await gitUserConfig(repo.root)
  assert.equal(user.name.local, null)
  assert.equal(user.name.global, 'Global User')
})

// ---------- gitUserConfigSet ----------

test('gitUserConfigSet: local 写入 → 读回；未提供字段不动', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const user = await gitUserConfigSet(repo.root, { location: 'local', name: 'New Name' })
  assert.equal(user.name.local, 'New Name')
  assert.equal(user.email.local, 'test@example.com') // email 未动
})

test('gitUserConfigSet: 空串 = 删除该项', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const user = await gitUserConfigSet(repo.root, { location: 'local', name: '', email: '' })
  assert.equal(user.name.local, null)
  assert.equal(user.email.local, null)
})

test('gitUserConfigSet: 写 global 时清 local 遮蔽（同上游 deleteLocalName）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await withFakeHome(t)
  // local 已有值（makeRepo 设置），写 global 同名键 → local 被清，global 生效
  const user = await gitUserConfigSet(repo.root, { location: 'global', name: 'Global Name' })
  assert.equal(user.name.local, null)
  assert.equal(user.name.global, 'Global Name')
  assert.equal(user.email.local, 'test@example.com') // 其它 local 字段保留
})

test('gitUserConfigSet: 非法 location / 非法值 → 抛稳定错误', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await assert.rejects(() => gitUserConfigSet(repo.root, { location: 'system', name: 'x' }), /invalid-location/)
  await assert.rejects(() => gitUserConfigSet(repo.root, { location: 'local', name: 'a'.repeat(101) }), /value-too-long/)
  await assert.rejects(() => gitUserConfigSet(repo.root, { location: 'local', name: 'a\x02b' }), /invalid-characters/)
})

// ---------- gitUserConfigDelete ----------

test('gitUserConfigDelete: 删 local 项；不存在时静默成功', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  let user = await gitUserConfigDelete(repo.root, { location: 'local', field: 'name' })
  assert.equal(user.name.local, null)
  assert.equal(user.email.local, 'test@example.com') // email 保留
  // 再次删除（key 不存在，git 退出码 5）→ 静默成功
  user = await gitUserConfigDelete(repo.root, { location: 'local', field: 'name' })
  assert.equal(user.name.local, null)
})

test('gitUserConfigDelete: 删 global 项（临时 HOME）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await withFakeHome(t)
  await repo.git(['config', '--global', 'user.email', 'g@example.com'])
  const user = await gitUserConfigDelete(repo.root, { location: 'global', field: 'email' })
  assert.equal(user.email.global, null)
})

test('gitUserConfigDelete: 非法 location / field → 抛稳定错误', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await assert.rejects(() => gitUserConfigDelete(repo.root, { location: 'global', field: 'x' }), /invalid-field/)
  await assert.rejects(() => gitUserConfigDelete(repo.root, { location: 'x', field: 'name' }), /invalid-location/)
})

// ---------- gitUserConfigSwitch：层级迁移 ----------

test('gitUserConfigSwitch: local→global = 移动（写 global + 清 local）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await withFakeHome(t)
  const user = await gitUserConfigSwitch(repo.root, { field: 'name', to: 'global' })
  assert.equal(user.name.global, 'Test User')
  assert.equal(user.name.local, null)
  assert.equal(user.email.local, 'test@example.com') // email 未动
})

test('gitUserConfigSwitch: global→local = 复制（写 local，global 保留）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await withFakeHome(t)
  await repo.git(['config', '--global', 'user.name', 'Global User'])
  await repo.git(['config', '--local', '--unset-all', 'user.name'])
  const user = await gitUserConfigSwitch(repo.root, { field: 'name', to: 'local' })
  assert.equal(user.name.local, 'Global User')
  assert.equal(user.name.global, 'Global User') // 复制：global 保留
})

test('gitUserConfigSwitch: 两层都无值 → 抛 no-value', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await withFakeHome(t) // 隔离真实 ~/.gitconfig
  await repo.git(['config', '--local', '--unset-all', 'user.name'])
  await assert.rejects(() => gitUserConfigSwitch(repo.root, { field: 'name', to: 'global' }), /no-value/)
})

// ---------- 写路由（伪造 cordis ctx）：CSRF / 方法 / 载荷 / 全链路 ----------

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

function fakeReq({ method = 'GET', contentType, body = '', url = '/plugins/dsh-gitstatus/git/config' } = {}) {
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
  return {
    status: 0,
    payload: null,
    writeHead(status) { this.status = status },
    end(payload) { this.payload = payload },
  }
}

const CONFIG_PATH = '/plugins/dsh-gitstatus/git/config'

test('config 路由 GET: 返回两层 user 结构', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await withFakeHome(t) // 隔离真实 ~/.gitconfig
  const route = fakeCtx(repo.root).get(CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ url: `${CONFIG_PATH}?session=` }), res)
  assert.equal(res.status, 200)
  const data = JSON.parse(res.payload)
  assert.equal(data.ok, true)
  assert.equal(data.isRepo, true)
  assert.equal(data.user.name.local, 'Test User')
  assert.equal(data.user.name.global, null)
})

test('config 路由 GET: 非 git 仓库 → isRepo false', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-gitstatus-norepo-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const route = fakeCtx(root).get(CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ url: `${CONFIG_PATH}?session=` }), res)
  assert.equal(JSON.parse(res.payload).isRepo, false)
})

test('config 路由 POST: PUT → 405（GET 是读操作）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'PUT' }), res)
  assert.equal(res.status, 405)
  assert.equal(JSON.parse(res.payload).error, 'method not allowed')
})

test('config 路由 POST: 非 application/json → 415（CSRF）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'text/plain', body: '{}' }), res)
  assert.equal(res.status, 415)
})

test('config 路由 POST: 畸形 JSON → 400', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: 'oops' }), res)
  assert.equal(res.status, 400)
})

test('config 路由 POST: 未知 action → 400', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"boom"}' }), res)
  assert.equal(res.status, 400)
  assert.equal(JSON.parse(res.payload).error, 'unknown action')
})

test('config 路由 POST: set 全链路（真实写 config + 返回最新状态）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ action: 'set', location: 'local', name: 'Routed Name' }),
  }), res)
  assert.equal(res.status, 200)
  const data = JSON.parse(res.payload)
  assert.equal(data.ok, true)
  assert.equal(data.user.name.local, 'Routed Name')
  assert.equal(data.user.email.local, 'test@example.com')
})

test('config 路由 POST: switch-layer 全链路（临时 HOME）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await withFakeHome(t)
  const route = fakeCtx(repo.root).get(CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ action: 'switch-layer', field: 'email', to: 'global' }),
  }), res)
  const data = JSON.parse(res.payload)
  assert.equal(data.ok, true)
  assert.equal(data.user.email.global, 'test@example.com')
  assert.equal(data.user.email.local, null)
})
