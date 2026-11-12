// 回归：git 的 core.quotepath（默认 true）会把非 ASCII 路径输出成
// `"docs/\344\270\255..."` 八进制转义；详情页文件列表不能只剩数字。
// 修复：runGit 关 core.quotepath + parseNumstat 还原残余引号转义。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { gitShow, gitShowUncommitted, parseNumstat } from '../lib/index.mjs'
import { makeRepo } from './fixtures/repo.mjs'

// ---------- parseNumstat：转义还原 ----------

test('parseNumstat: 八进制转义按 UTF-8 字节还原为中文', () => {
  // 实际输出形如：1\t0\t"docs/\344\270\255\346\226\207.md"
  const out = '1\t0\t"docs/\\344\\270\\255\\346\\226\\207.md"\n'
  assert.deepEqual(parseNumstat(out), [{ path: 'docs/中文.md', adds: 1, dels: 0 }])
})

test('parseNumstat: 引号内的特殊字符转义还原（\\ \\"）', () => {
  const out = '1\t0\t"a\\\\b.txt"\n2\t3\t"e\\"f.txt"\n'
  assert.deepEqual(parseNumstat(out), [
    { path: 'a\\b.txt', adds: 1, dels: 0 },
    { path: 'e"f.txt', adds: 2, dels: 3 },
  ])
})

test('parseNumstat: 普通/二进制/空行行为不变', () => {
  assert.deepEqual(parseNumstat('3\t2\tsrc/a.js\n-\t-\timage.png\n\n'), [
    { path: 'src/a.js', adds: 3, dels: 2 },
    { path: 'image.png', adds: 0, dels: 0 },
  ])
})

// ---------- gitShow / gitShowUncommitted：真实仓库中文文件名 ----------

test('gitShow: 文件列表与 patch 头里的中文文件名保持中文', async (t) => {
  const repo = await makeRepo(t)
  await mkdir(join(repo.root, 'docs'), { recursive: true })
  await repo.commit('中文文件', { files: { 'docs/中文文档.md': 'x\n' } })

  const detail = await gitShow(repo.root, await repo.headHash())
  assert.deepEqual(detail.files.map((f) => f.path), ['docs/中文文档.md'])
  assert.ok(
    detail.patch.includes('diff --git a/docs/中文文档.md b/docs/中文文档.md'),
    'patch 头不应出现 "docs/\\344..." 形式的八进制转义',
  )
})

test('gitShowUncommitted: 暂存区中文文件名不被转义', async (t) => {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'a.txt': 'base\n' } })
  await repo.write('中文.md', 'x\n')
  await repo.git(['add', '-A'])

  const detail = await gitShowUncommitted(repo.root)
  assert.deepEqual(detail.staged.files.map((f) => f.path), ['中文.md'])
})
