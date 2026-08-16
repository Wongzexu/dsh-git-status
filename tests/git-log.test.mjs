// git-log 测试：装饰解析 / 未提交计数分类 / 虚拟行组装 / stash / show 详情。
// 零依赖：node:test + 真实 git fixture 仓库。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  UNCOMMITTED,
  parseDecorations,
  parseNumstat,
  gitUncommittedCount,
  gitStashes,
  gitLog,
  gitLogV2,
  gitShow,
  gitShowUncommitted,
  gitShowStashUntracked,
} from '../lib/index.mjs'
import { makeRepo, makeConflictedRepo } from './fixtures/repo.mjs'

// ---------- parseDecorations：%D 装饰串分类 ----------

test('parseDecorations: 空串 → 全空', () => {
  assert.deepEqual(parseDecorations(''), {
    heads: [], remotes: [], tags: [], isHead: false, headName: null,
  })
})

test('parseDecorations: HEAD -> 分支 + 远程 + tag + HEAD 标记', () => {
  const remoteRefs = new Set(['gitee/main'])
  const deco = parseDecorations('HEAD -> main, gitee/main, tag: v1.0, HEAD', remoteRefs)
  assert.equal(deco.isHead, true)
  assert.equal(deco.headName, 'main')
  assert.deepEqual(deco.heads, ['main'])
  assert.deepEqual(deco.remotes, ['gitee/main'])
  assert.deepEqual(deco.tags, ['v1.0'])
})

test('parseDecorations: 含斜杠的本地分支靠 remoteRefs 权威集合消歧', () => {
  assert.deepEqual(parseDecorations('feat/x', new Set(['gitee/feat/x'])).heads, ['feat/x'])
  assert.deepEqual(parseDecorations('feat/x', new Set(['feat/x'])).remotes, ['feat/x'])
})

test('parseDecorations: 远程 HEAD 符号引用被过滤', () => {
  const deco = parseDecorations('gitee/HEAD, main', new Set(['gitee/HEAD']))
  assert.deepEqual(deco.remotes, [])
  assert.deepEqual(deco.heads, ['main'])
})

test('parseDecorations: tag 含斜杠（release/v1）', () => {
  assert.deepEqual(parseDecorations('tag: release/v1').tags, ['release/v1'])
})

test('parseDecorations: 游离 HEAD（无 headName）', () => {
  const deco = parseDecorations('HEAD')
  assert.equal(deco.isHead, true)
  assert.equal(deco.headName, null)
})

// ---------- parseNumstat ----------

test('parseNumstat: 常规 / 二进制（-）/ 空行', () => {
  const out = '1\t2\ta.txt\n-\t-\tbin.dat\n0\t0\tempty.txt\n\n'
  assert.deepEqual(parseNumstat(out), [
    { path: 'a.txt', adds: 1, dels: 2 },
    { path: 'bin.dat', adds: 0, dels: 0 },
    { path: 'empty.txt', adds: 0, dels: 0 },
  ])
})

// ---------- gitUncommittedCount：XY 位分类 ----------

test('gitUncommittedCount: 干净仓库 → 0', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  assert.deepEqual(await gitUncommittedCount(repo.root), { total: 0, staged: 0, unstaged: 0, untracked: 0 })
})

test('gitUncommittedCount: 未跟踪文件归未暂存', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('u.txt', 'u')
  assert.deepEqual(await gitUncommittedCount(repo.root), { total: 1, staged: 0, unstaged: 1, untracked: 1 })
})

test('gitUncommittedCount: 未暂存修改', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('a.txt', 'changed')
  assert.deepEqual(await gitUncommittedCount(repo.root), { total: 1, staged: 0, unstaged: 1, untracked: 0 })
})

test('gitUncommittedCount: 已暂存修改', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('a.txt', 'changed')
  await repo.git(['add', 'a.txt'])
  assert.deepEqual(await gitUncommittedCount(repo.root), { total: 1, staged: 1, unstaged: 0, untracked: 0 })
})

test('gitUncommittedCount: MM 部分暂存两边各计一处', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('a.txt', 'v2')
  await repo.git(['add', 'a.txt'])
  await repo.write('a.txt', 'v3')
  assert.deepEqual(await gitUncommittedCount(repo.root), { total: 1, staged: 1, unstaged: 1, untracked: 0 })
})

// ---------- gitLogV2：虚拟行组装 ----------

test('gitLogV2: 干净仓库无 UNCOMMITTED 行', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.commit('c2')
  const { commits } = await gitLogV2(repo.root, { scope: 'head' })
  assert.equal(commits.length, 2)
  assert.ok(!commits.some((c) => c.hash === UNCOMMITTED))
  assert.equal(commits[0].subject, 'c2')
})

test('gitLogV2: 有改动时前插 UNCOMMITTED 虚拟行（parents=[head]）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('a.txt', 'dirty')
  const headFull = (await repo.git(['rev-parse', 'HEAD'])).trim()
  const { commits, uncommitted } = await gitLogV2(repo.root, { scope: 'head' })
  assert.equal(commits[0].hash, UNCOMMITTED)
  assert.deepEqual(commits[0].parents, [headFull])
  assert.equal(commits[0].uncommitted.total, 1)
  assert.equal(uncommitted.total, 1)
})

test('gitLogV2: scope=head 只含当前分支，scope=all 含其它分支', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('main1')
  await repo.branch('side')
  await repo.checkout('side')
  await repo.commit('side1')
  await repo.checkout('main')
  const head = await gitLogV2(repo.root, { scope: 'head' })
  assert.deepEqual(head.commits.map((c) => c.subject), ['main1'])
  const all = await gitLogV2(repo.root, { scope: 'all' })
  assert.deepEqual(new Set(all.commits.map((c) => c.subject)), new Set(['main1', 'side1']))
})

test('gitLogV2: stash 行插到 base 之前（子先于父；selector 由 client 剥 refs/ 前缀）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('a.txt', 'stash me')
  await repo.stash()
  const { commits } = await gitLogV2(repo.root, { scope: 'head' })
  assert.equal(commits.length, 2) // c1 + stash 行
  assert.equal(commits[0].stash.selector, 'refs/stash@{0}')
  assert.deepEqual(commits[0].parents, [commits[1].hash])
  assert.equal(commits[0].stash.baseHash, commits[1].hash)
  assert.ok(!commits.some((c) => c.hash === UNCOMMITTED)) // stash 后工作区干净
})

test('gitLogV2: stash -u 记录 untracked 第三父', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('u.txt', 'untracked')
  await repo.stash(['-u'])
  const stashes = await gitStashes(repo.root)
  assert.equal(stashes.length, 1)
  assert.ok(stashes[0].untrackedFilesHash !== null)
  const { commits } = await gitLogV2(repo.root, { scope: 'head' })
  assert.ok(commits[0].stash.untrackedFilesHash !== null)
})

test('gitStashes: 普通 stash 无第三父（selector 保留 refs/ 前缀）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('a.txt', 'v2')
  await repo.stash()
  const stashes = await gitStashes(repo.root)
  assert.equal(stashes.length, 1)
  assert.equal(stashes[0].baseHash, (await repo.git(['rev-parse', 'HEAD'])).trim())
  assert.equal(stashes[0].untrackedFilesHash, null)
  assert.equal(stashes[0].selector, 'refs/stash@{0}')
})

// ---------- gitShow：详情 ----------

test('gitShow: commit 详情含 meta/files/patch', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'a.txt': '1\n' } })
  await repo.commit('c2', { files: { 'b.txt': '2\n' } })
  const hash = await repo.headHash()
  const detail = await gitShow(repo.root, hash)
  assert.equal(detail.meta.subject, 'c2')
  assert.equal(detail.meta.hashShort, hash)
  assert.deepEqual(detail.files, [{ path: 'b.txt', adds: 1, dels: 0 }])
  assert.ok(detail.patch.includes('b.txt'))
  assert.equal(detail.truncated, false)
})

test('gitShow: 首个 commit 走 --root diff', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('first', { files: { 'a.txt': '1\n' } })
  const detail = await gitShow(repo.root, (await repo.headHash()))
  assert.deepEqual(detail.files, [{ path: 'a.txt', adds: 1, dels: 0 }])
})

test('gitShowUncommitted: 未跟踪进未暂存组（status ??），两组 patch 各含各自改动', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('a.txt', 'dirty')
  await repo.write('u.txt', 'new')
  const detail = await gitShowUncommitted(repo.root)
  assert.equal(detail.meta.hash, UNCOMMITTED)
  // 未暂存组：已修改 a.txt + 未跟踪 u.txt（?? 徽标数据）
  assert.ok(detail.unstaged.files.some((f) => f.path === 'a.txt'))
  const u = detail.unstaged.files.find((f) => f.path === 'u.txt')
  assert.ok(u !== undefined)
  assert.equal(u.status, '??') // 未跟踪文件 git diff 无输出，只进未暂存组
  assert.ok(detail.unstaged.patch.includes('a.txt'))
  assert.ok(!detail.unstaged.patch.includes('u.txt'))
  // 暂存组为空
  assert.deepEqual(detail.staged.files, [])
  assert.equal(detail.staged.patch, '')
})

test('gitShowUncommitted: 暂存进 staged 组；MM 部分暂存两组各出现一次', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1', { files: { 'b.txt': 'base\n' } })
  await repo.write('b.txt', 'staged\n')
  await repo.git(['add', 'b.txt'])        // 已暂存
  await repo.write('b.txt', 'unstaged\n') // 再改 → MM
  await repo.write('u.txt', 'new')        // 未跟踪
  const detail = await gitShowUncommitted(repo.root)
  assert.ok(detail.staged.files.some((f) => f.path === 'b.txt'))
  assert.ok(detail.unstaged.files.some((f) => f.path === 'b.txt'))
  assert.ok(detail.staged.patch.includes('b.txt'))
  assert.ok(detail.unstaged.patch.includes('b.txt'))
  assert.ok(!detail.staged.files.some((f) => f.path === 'u.txt'))
  assert.ok(detail.unstaged.files.some((f) => f.path === 'u.txt'))
})

test('gitShowStashUntracked: 第三父快照文件', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.write('u.txt', 'snapshot')
  await repo.stash(['-u'])
  const stashes = await gitStashes(repo.root)
  const extra = await gitShowStashUntracked(repo.root, stashes[0].untrackedFilesHash)
  assert.deepEqual(extra.files, [{ path: 'u.txt', adds: 1, dels: 0 }])
  assert.ok(extra.patch.includes('u.txt'))
})

// ---------- gitLogV2：冲突 / 进行中操作状态（2.3） ----------

test('gitLogV2: 未解决冲突计数 + MERGE_HEAD 标记，abort 后清零', async (t) => {
  const repo = await makeConflictedRepo(t)
  const result = await gitLogV2(repo.root, { scope: 'head' })
  assert.equal(result.conflicts, 1)
  assert.equal(result.operation, 'MERGE_HEAD')
  assert.equal(result.operationInProgress, true)
  await repo.git(['merge', '--abort'])
  const clean = await gitLogV2(repo.root, { scope: 'head' })
  assert.equal(clean.conflicts, 0)
  assert.equal(clean.operation, null)
  assert.equal(clean.operationInProgress, false)
})

test('gitLogV2: 干净仓库无冲突无操作', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  const result = await gitLogV2(repo.root, { scope: 'head' })
  assert.equal(result.conflicts, 0)
  assert.equal(result.operation, null)
  assert.equal(result.operationInProgress, false)
})

// ---------- gitLog：--first-parent / --reflog 参数透传 ----------

test('gitLog: followFirst 只输出第一父链（合并分支提交被排除）', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.branch('side')
  await repo.commit('c2')
  await repo.checkout('side')
  await repo.commit('s1', { files: { 's.txt': 's1' } })
  await repo.checkout('main')
  await repo.git(['merge', '--no-ff', 'side', '-m', 'merge side'])
  const subjects = (rows) => rows.commits.map((c) => c.subject)
  const all = await gitLog(repo.root, { scope: 'head' })
  assert.ok(subjects(all).includes('s1'), '默认输出应含合并分支提交')
  const first = await gitLog(repo.root, { scope: 'head', followFirst: true })
  assert.ok(!subjects(first).includes('s1'), '--first-parent 应排除第二父分支提交')
  assert.ok(subjects(first).includes('merge side'))
  assert.ok(subjects(first).includes('c2'))
})

test('gitLog: reflogs 包含被 reset 丢弃的提交', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('c1')
  await repo.commit('c2')
  const c2 = (await repo.git(['rev-parse', 'HEAD'])).trim()
  await repo.git(['reset', '--hard', 'HEAD~1']) // c2 仅存于 reflog
  const without = await gitLog(repo.root, { scope: 'all' })
  assert.ok(!without.commits.some((c) => c.hash === c2), '默认输出应不含被丢弃的提交')
  const withReflogs = await gitLog(repo.root, { scope: 'all', reflogs: true })
  assert.ok(withReflogs.commits.some((c) => c.hash === c2), '--reflog 应包含 reflog 提及的提交')
})
