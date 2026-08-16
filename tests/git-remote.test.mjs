// git-remote 测试：tag 名校验 / 删除远程分支（含降级）/ 推送 tag / 创建 tag
// （轻量/附注/force 替换/双远程推送/部分失败）/ 删除 tag（仅本地 / 同步远程）/
// 远程配置管理（gitRemoteConfig 读取 / add-remote / edit-remote / delete-remote）/
// 写路由（含 CSRF 防护）。
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
  gitRemoteConfig,
  gitRemoteManageAction,
  validateRemoteUrl,
  apply,
} from '../lib/index.mjs'
import { makeRepo, runGit, runGitSafe } from './fixtures/repo.mjs'

/** 建一个裸仓库（t.after 自动清理）。 */
async function makeBareRepo(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-gitstatus-bare-'))
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

test('gitRemoteAction.push-tag: 远程已有同名 tag 且指向不同提交 → remote-tag-exists', async (t) => {
  const { repo } = await makeRepoWithRemote(t)
  await repo.git(['tag', 'v1.0'])
  const first = await gitRemoteAction(repo.root, 'push-tag', { tag: 'v1.0', remote: 'origin' })
  assert.deepEqual(first, { ok: true })
  // 本地新提交并强制移动 tag（远程仍指向旧提交）→ 再推送应被拒
  await repo.commit('c2')
  await repo.git(['tag', '-f', 'v1.0'])
  const result = await gitRemoteAction(repo.root, 'push-tag', { tag: 'v1.0', remote: 'origin' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'remote-tag-exists')
  assert.match(result.error.message, /already exists/)
  assert.ok(!result.error.message.includes('To '), `message 不应含推送目标行: ${result.error.message}`)
})

// ---------- gitRemoteAction：add-tag（创建 tag，镜像上游 Add Tag 对话框） ----------

test('gitRemoteAction.add-tag: 轻量 tag 创建（起点 = 目标提交，不切分支）', async (t) => {
  const { repo } = await makeRepoWithRemote(t)
  const c1 = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.commit('c2')
  const result = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1.0', hash: c1, type: 'lightweight' })
  assert.deepEqual(result, { ok: true })
  // 指向 c1 而非当前 HEAD（c2）
  assert.equal((await repo.git(['rev-parse', 'refs/tags/v1.0'])).trim(), c1)
  assert.equal(await repo.currentBranch(), 'main') // 不检出新分支
  assert.equal((await repo.git(['cat-file', '-t', 'refs/tags/v1.0'])).trim(), 'commit') // 轻量 = 直接指向 commit 对象
})

test('gitRemoteAction.add-tag: 附注 tag + message', async (t) => {
  const { repo } = await makeRepoWithRemote(t)
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const result = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1.0', hash: head, type: 'annotated', message: 'release v1' })
  assert.deepEqual(result, { ok: true })
  assert.equal((await repo.git(['cat-file', '-t', 'refs/tags/v1.0'])).trim(), 'tag') // 附注 = tag 对象
  const content = await repo.git(['cat-file', '-p', 'refs/tags/v1.0'])
  assert.match(content, /release v1/)
})

test('gitRemoteAction.add-tag: 校验（非法名/非法 hash/不存在 commit/非法类型/远程不存在）', async (t) => {
  const { repo } = await makeRepoWithRemote(t)
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const badName = await gitRemoteAction(repo.root, 'add-tag', { tag: 'a..b', hash: head, type: 'lightweight' })
  assert.equal(badName.error.code, 'invalid-tag-name')
  const badHash = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1', hash: 'zzz', type: 'lightweight' })
  assert.equal(badHash.error.code, 'invalid-commit')
  const noCommit = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1', hash: '1234567', type: 'lightweight' })
  assert.equal(noCommit.error.code, 'commit-not-found')
  const badType = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1', hash: head, type: 'signed' })
  assert.equal(badType.error.code, 'invalid-tag-type')
  const noRemote = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1', hash: head, type: 'lightweight', remotes: ['nope'] })
  assert.equal(noRemote.error.code, 'remote-not-found')
  const badRemotes = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1', hash: head, type: 'lightweight', remotes: 'origin' })
  assert.equal(badRemotes.error.code, 'invalid-remote-name')
})

test('gitRemoteAction.add-tag: 同名 tag 拒绝 → force 替换', async (t) => {
  const { repo } = await makeRepoWithRemote(t)
  const c1 = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.git(['tag', 'v1.0']) // 现成同名 tag（指向 c1）
  await repo.commit('c2')
  const c2 = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const dup = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1.0', hash: c2, type: 'lightweight' })
  assert.equal(dup.ok, false)
  assert.equal(dup.error.code, 'tag-already-exists')
  assert.equal((await repo.git(['rev-parse', 'refs/tags/v1.0'])).trim(), c1) // 未动
  const forced = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1.0', hash: c2, type: 'lightweight', force: true })
  assert.deepEqual(forced, { ok: true })
  assert.equal((await repo.git(['rev-parse', 'refs/tags/v1.0'])).trim(), c2) // 已移动
})

test('gitRemoteAction.add-tag: 创建 + 推送远程', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const result = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1.0', hash: head, type: 'lightweight', remotes: ['origin'] })
  assert.deepEqual(result, { ok: true, pushed: ['origin'] })
  assert.equal((await runGit(bare, ['rev-parse', 'refs/tags/v1.0'])).trim(), head)
})

test('gitRemoteAction.add-tag: 创建 + 推送双远程（顺序推，全部成功）', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  const bare2 = await makeBareRepo(t)
  await repo.git(['remote', 'add', 'gitee', bare2])
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const result = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1.0', hash: head, type: 'lightweight', remotes: ['origin', 'gitee'] })
  assert.deepEqual(result, { ok: true, pushed: ['origin', 'gitee'] })
  assert.equal((await runGit(bare, ['rev-parse', 'refs/tags/v1.0'])).trim(), head)
  assert.equal((await runGit(bare2, ['rev-parse', 'refs/tags/v1.0'])).trim(), head)
})

test('gitRemoteAction.add-tag: 推送部分失败 → push-failed（tag 保留本地，成功远程已收）', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  const dead = await makeBareRepo(t)
  await rm(dead, { recursive: true, force: true }) // 远程路径失效 → 该远程推送必败
  await repo.git(['remote', 'add', 'dead', dead])
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const result = await gitRemoteAction(repo.root, 'add-tag', { tag: 'v1.0', hash: head, type: 'lightweight', remotes: ['origin', 'dead'] })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'push-failed')
  assert.match(result.error.message, /dead:/)
  assert.equal((await repo.git(['rev-parse', 'refs/tags/v1.0'])).trim(), head) // 本地已创建
  assert.equal((await runGit(bare, ['rev-parse', 'refs/tags/v1.0'])).trim(), head) // origin 已收到
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

test('remote 路由: 合法 add-tag 全链路成功', async (t) => {
  const { repo, bare } = await makeRepoWithRemote(t)
  const head = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const route = fakeCtx(repo.root).get(GIT_REMOTE_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: JSON.stringify({ action: 'add-tag', tag: 'v1.0', hash: head, type: 'lightweight', remotes: ['origin'] }) }),
    res,
  )
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.payload), { ok: true, pushed: ['origin'] })
  assert.equal((await repo.git(['rev-parse', 'refs/tags/v1.0'])).trim(), head)
  assert.equal((await runGit(bare, ['rev-parse', 'refs/tags/v1.0'])).trim(), head)
})

test('remote 路由: 非 git 仓库 → 稳定错误', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-gitstatus-nogit-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const route = fakeCtx(root).get(GIT_REMOTE_PATH)
  const res = fakeRes()
  await route.handler(
    fakeReq({ method: 'POST', contentType: 'application/json', body: '{"action":"push-tag","tag":"v1","remote":"origin"}' }),
    res,
  )
  assert.equal(JSON.parse(res.payload).error.code, 'internal')
})

// ---------- 远程配置管理（设置弹窗「远程配置」区块） ----------

const GIT_CONFIG_PATH = '/plugins/dsh-gitstatus/git/config'

test('validateRemoteUrl: 合法形态（http/ssh/scp 风格/本地路径）→ true', () => {
  assert.equal(validateRemoteUrl('https://github.com/user/repo.git'), true)
  assert.equal(validateRemoteUrl('git@gitee.com:user/repo.git'), true)
  assert.equal(validateRemoteUrl('ssh://git@host:2222/path/repo.git'), true)
  assert.equal(validateRemoteUrl('file:///srv/git/repo.git'), true)
  assert.equal(validateRemoteUrl('/srv/git/repo.git'), true)
  assert.equal(validateRemoteUrl('u'.repeat(500)), true)
})

test('validateRemoteUrl: 非法（空/超长/控制字符/非 string）→ false', () => {
  assert.equal(validateRemoteUrl(''), false)
  assert.equal(validateRemoteUrl(' '), false)
  assert.equal(validateRemoteUrl('u'.repeat(501)), false)
  assert.equal(validateRemoteUrl('git@gitee.com:u\nrepo.git'), false)
  assert.equal(validateRemoteUrl('git@gitee.com:u\x01repo.git'), false)
  assert.equal(validateRemoteUrl(42), false)
  assert.equal(validateRemoteUrl(null), false)
})

test('gitRemoteConfig: 无远程 → 空数组', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  assert.deepEqual(await gitRemoteConfig(repo.root), [])
})

test('gitRemoteConfig: 读取 url / pushUrl（无 pushUrl → null）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  await repo.git(['remote', 'add', 'mirror', 'git@gitee.com:user/mirror.git'])
  await repo.git(['remote', 'set-url', '--push', 'mirror', 'git@gitee.com:user/push.git'])
  const remotes = await gitRemoteConfig(repo.root)
  assert.equal(remotes.length, 2)
  const origin = remotes.find((r) => r.name === 'origin')
  assert.equal(origin.url, 'https://github.com/user/repo.git')
  assert.equal(origin.pushUrl, null)
  const mirror = remotes.find((r) => r.name === 'mirror')
  assert.equal(mirror.url, 'git@gitee.com:user/mirror.git')
  assert.equal(mirror.pushUrl, 'git@gitee.com:user/push.git')
})

test('gitRemoteConfig: 按名排序（非添加顺序）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'zeta', 'https://z.example/r.git'])
  await repo.git(['remote', 'add', 'alpha', 'https://a.example/r.git'])
  const names = (await gitRemoteConfig(repo.root)).map((r) => r.name)
  assert.deepEqual(names, ['alpha', 'zeta'])
})

test('gitRemoteConfig: 保留远程名大小写（MyRemote ≠ myremote 两个远程）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'MyRemote', 'https://m.example/r.git'])
  await repo.git(['remote', 'add', 'myremote', 'https://m.example/r2.git'])
  const remotes = await gitRemoteConfig(repo.root)
  assert.equal(remotes.length, 2)
  const big = remotes.find((r) => r.name === 'MyRemote')
  assert.ok(big !== undefined, 'MyRemote 应原样保留（未小写化）')
  assert.equal(big.url, 'https://m.example/r.git')
  const small = remotes.find((r) => r.name === 'myremote')
  assert.ok(small !== undefined, 'myremote 应独立存在（未被合并）')
  assert.equal(small.url, 'https://m.example/r2.git')
})

test('gitRemoteManageAction.add-remote: 成功（含 pushUrl）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitRemoteManageAction(repo.root, 'add-remote', {
    name: 'origin',
    url: 'https://github.com/user/repo.git',
    pushUrl: 'git@gitee.com:user/push.git',
  })
  assert.equal(result.ok, true)
  const remotes = await gitRemoteConfig(repo.root)
  assert.equal(remotes.length, 1)
  assert.equal(remotes[0].name, 'origin')
  assert.equal(remotes[0].url, 'https://github.com/user/repo.git')
  assert.equal(remotes[0].pushUrl, 'git@gitee.com:user/push.git')
})

test('gitRemoteManageAction.add-remote: 重名 → remote-already-exists', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  const result = await gitRemoteManageAction(repo.root, 'add-remote', { name: 'origin', url: 'https://x.example/r.git' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'remote-already-exists')
})

test('gitRemoteManageAction.add-remote: 非法名 / 非法 URL → 稳定错误码', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  let r = await gitRemoteManageAction(repo.root, 'add-remote', { name: 'bad name', url: 'https://x.example/r.git' })
  assert.equal(r.error.code, 'invalid-remote-name')
  r = await gitRemoteManageAction(repo.root, 'add-remote', { name: 'ok', url: '' })
  assert.equal(r.error.code, 'invalid-remote-url')
  r = await gitRemoteManageAction(repo.root, 'add-remote', { name: 'ok', url: 'https://x.example/r.git', pushUrl: 'bad\nurl' })
  assert.equal(r.error.code, 'invalid-remote-url')
})

test('gitRemoteManageAction.edit-remote: 改 fetch URL', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  const result = await gitRemoteManageAction(repo.root, 'edit-remote', { name: 'origin', url: 'https://github.com/user/new.git' })
  assert.equal(result.ok, true)
  const remotes = await gitRemoteConfig(repo.root)
  assert.equal(remotes[0].url, 'https://github.com/user/new.git')
})

test('gitRemoteManageAction.edit-remote: 改名（remote rename 生效）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  const result = await gitRemoteManageAction(repo.root, 'edit-remote', { name: 'origin', newName: 'upstream' })
  assert.equal(result.ok, true)
  assert.deepEqual((await gitRemoteConfig(repo.root)).map((r) => r.name), ['upstream'])
  assert.deepEqual((await runGit(repo.root, ['remote'])).trim().split('\n'), ['upstream'])
})

test('gitRemoteManageAction.edit-remote: pushUrl 设置与清除（留空 = 回到同 fetch）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  let result = await gitRemoteManageAction(repo.root, 'edit-remote', { name: 'origin', pushUrl: 'git@gitee.com:user/push.git' })
  assert.equal(result.ok, true)
  assert.equal((await gitRemoteConfig(repo.root))[0].pushUrl, 'git@gitee.com:user/push.git')
  result = await gitRemoteManageAction(repo.root, 'edit-remote', { name: 'origin', pushUrl: '' })
  assert.equal(result.ok, true)
  assert.equal((await gitRemoteConfig(repo.root))[0].pushUrl, null)
  // 再次清除（key 已不存在，exit 5）→ 仍静默成功
  result = await gitRemoteManageAction(repo.root, 'edit-remote', { name: 'origin', pushUrl: '' })
  assert.equal(result.ok, true)
})

test('gitRemoteManageAction.edit-remote: 改名到已存在名 → remote-already-exists', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  await repo.git(['remote', 'add', 'upstream', 'https://github.com/other/repo.git'])
  const result = await gitRemoteManageAction(repo.root, 'edit-remote', { name: 'origin', newName: 'upstream' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'remote-already-exists')
})

test('gitRemoteManageAction.edit-remote: 远程不存在 / 非法名 → 稳定错误码', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  let r = await gitRemoteManageAction(repo.root, 'edit-remote', { name: 'ghost', url: 'https://x.example/r.git' })
  assert.equal(r.error.code, 'remote-not-found')
  r = await gitRemoteManageAction(repo.root, 'edit-remote', { name: 'bad name', url: 'https://x.example/r.git' })
  assert.equal(r.error.code, 'invalid-remote-name')
})

test('gitRemoteManageAction.delete-remote: 成功并连带清理远程跟踪分支', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  // 造一条远程跟踪引用（模拟 fetch 过）
  await runGit(repo.root, ['update-ref', 'refs/remotes/origin/main', 'HEAD'])
  const result = await gitRemoteManageAction(repo.root, 'delete-remote', { name: 'origin' })
  assert.equal(result.ok, true)
  assert.deepEqual(await gitRemoteConfig(repo.root), [])
  assert.equal((await runGitSafe(repo.root, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'])).ok, false)
})

test('gitRemoteManageAction.delete-remote: 远程不存在 → remote-not-found', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitRemoteManageAction(repo.root, 'delete-remote', { name: 'ghost' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'remote-not-found')
})

// ---------- 远程配置写路由：GET remotes / POST 全链路 / CSRF ----------

test('config 路由 GET: 返回 remotes 数组（含 pushUrl）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  await repo.git(['remote', 'set-url', '--push', 'origin', 'git@gitee.com:user/push.git'])
  const route = fakeCtx(repo.root).get(GIT_CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ url: `${GIT_CONFIG_PATH}?session=` }), res)
  assert.equal(res.status, 200)
  const data = JSON.parse(res.payload)
  assert.equal(data.ok, true)
  assert.equal(data.remotes.length, 1)
  assert.equal(data.remotes[0].name, 'origin')
  assert.equal(data.remotes[0].url, 'https://github.com/user/repo.git')
  assert.equal(data.remotes[0].pushUrl, 'git@gitee.com:user/push.git')
})

test('config 路由 GET: 非 git 仓库 → remotes 空数组', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-gitstatus-norepo-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const route = fakeCtx(root).get(GIT_CONFIG_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({ url: `${GIT_CONFIG_PATH}?session=` }), res)
  const data = JSON.parse(res.payload)
  assert.equal(data.isRepo, false)
  assert.deepEqual(data.remotes, [])
})

test('remote 路由 POST: add-remote 全链路（真实写 + 返回 ok）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const route = fakeCtx(repo.root).get(GIT_REMOTE_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ action: 'add-remote', name: 'origin', url: 'https://github.com/user/repo.git' }),
  }), res)
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.payload).ok, true)
  assert.equal((await gitRemoteConfig(repo.root))[0].url, 'https://github.com/user/repo.git')
})

test('remote 路由 POST: 重名 add → 200 + remote-already-exists', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  const route = fakeCtx(repo.root).get(GIT_REMOTE_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ action: 'add-remote', name: 'origin', url: 'https://x.example/r.git' }),
  }), res)
  assert.equal(res.status, 200)
  const data = JSON.parse(res.payload)
  assert.equal(data.ok, false)
  assert.equal(data.error.code, 'remote-already-exists')
})

test('remote 路由 POST: delete-remote 全链路', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.git(['remote', 'add', 'origin', 'https://github.com/user/repo.git'])
  const route = fakeCtx(repo.root).get(GIT_REMOTE_PATH)
  const res = fakeRes()
  await route.handler(fakeReq({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ action: 'delete-remote', name: 'origin' }),
  }), res)
  assert.equal(JSON.parse(res.payload).ok, true)
  assert.deepEqual(await gitRemoteConfig(repo.root), [])
})
