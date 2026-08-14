// 造仓库辅助（node:test 用，零依赖）：mkdtemp 建真实 git 仓库，
// 提供 commit / branch / checkout / stash / writeFile 等链式操作。
// 每个用例用 t.after 自动清理临时目录。
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

/** 跑一条 git 命令（同插件 runGit 的模式：-C root、--no-pager、无锁）。 */
export function runGit(root, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', root, '--no-pager', '-c', 'color.ui=false', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C', LANG: 'C', ...opts.env },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => { stdout += c })
    child.stderr.on('data', (c) => { stderr += c })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `git exited with code ${code}`))
    })
  })
}

/** 允许失败的 git（返回 { ok, stdout, stderr }）。 */
export async function runGitSafe(root, args, opts) {
  try {
    return { ok: true, stdout: await runGit(root, args, opts), stderr: '' }
  } catch (error) {
    return { ok: false, stdout: '', stderr: error instanceof Error ? error.message : String(error) }
  }
}

let counter = 0

/**
 * 建一个干净仓库。返回：
 * - root：仓库路径
 * - commit(message, { files })：提交（files: { 相对路径: 内容 }，缺省写 a.txt）
 * - branch(name, { start })：建分支
 * - checkout(name)：切分支
 * - write(relPath, content)：写文件（不提交）
 * - rmFile(relPath)：删文件（不提交）
 * - stash(pushArgs)：git stash push（-u 含未跟踪）
 * - headHash()：当前 HEAD 短 hash
 * - currentBranch()：git branch --show-current
 * - git(args)：裸跑任意命令
 */
export async function makeRepo(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), `dsh-git-status-${++counter}-`))
  t.after(() => rm(root, { recursive: true, force: true }))
  await runGit(root, ['init', '-b', 'main'])
  await runGit(root, ['config', 'user.name', opts.userName ?? 'Test User'])
  await runGit(root, ['config', 'user.email', opts.userEmail ?? 'test@example.com'])
  await runGit(root, ['config', 'commit.gpgsign', 'false'])

  const api = {
    root,
    async git(args, safe = false) {
      return safe ? runGitSafe(root, args) : runGit(root, args)
    },
    async write(relPath, content) {
      const full = join(root, relPath)
      await writeFile(full, content, 'utf8')
      return api
    },
    async rmFile(relPath) {
      const { rm } = await import('node:fs/promises')
      await rm(join(root, relPath), { force: true })
      return api
    },
    async commit(message, { files = { 'a.txt': message } } = {}) {
      for (const [rel, content] of Object.entries(files)) {
        await writeFile(join(root, rel), content, 'utf8')
      }
      await runGit(root, ['add', '-A'])
      await runGit(root, ['commit', '-m', message])
      return api
    },
    async branch(name, { start } = {}) {
      const args = ['branch', name]
      if (start !== undefined) args.push(start)
      await runGit(root, args)
      return api
    },
    async checkout(name) {
      await runGit(root, ['switch', '--no-guess', '--', name])
      return api
    },
    async stash(pushArgs = []) {
      await runGit(root, ['stash', 'push', ...pushArgs])
      return api
    },
    async headHash() {
      return (await runGit(root, ['rev-parse', '--short', 'HEAD'])).trim()
    },
    async currentBranch() {
      return (await runGit(root, ['branch', '--show-current'])).trim()
    },
  }
  return api
}

/** 把仓库搞出未解决冲突：main 与 side 各改同文件后 merge side。 */
export async function makeConflictedRepo(t) {
  const repo = await makeRepo(t)
  await repo.commit('base', { files: { 'c.txt': 'base\n' } })
  await repo.branch('side')
  await repo.commit('main change', { files: { 'c.txt': 'main\n' } })
  await repo.checkout('side')
  await repo.write('c.txt', 'side\n')
  await repo.git(['add', '-A'])
  await repo.git(['commit', '-m', 'side change'])
  await repo.checkout('main')
  await repo.git(['merge', 'side'], true) // 预期失败（冲突）
  return repo
}
