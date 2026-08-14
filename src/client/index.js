// dsh-git-status 浏览器端 half：自渲染 DOM，零 React 依赖（greeter 模式）。
// 单模块：Git 状态（commit DAG 泳道图 + 行内详情 diff + 分支操作）。
// 数据通道：Node half 自造路由（/plugins/dsh-git-status/*）；
// 布局锚点：官方 DOM 属性（data-chat-flow 等），不依赖 React 内部结构。
// 构建：scripts/build-client.js 包成 __ModuleLoader__.load 契约（CJS）。
const BASE = '/plugins/dsh-git-status'

const I18N = {
  zh: {
    copied: '已复制到剪贴板',
    copyFailed: '复制失败',
    close: '关闭',
    gitStatus: 'Git 状态',
    gitAll: '所有分支',
    gitHead: '当前分支',
    gitNotRepo: '当前工作区不是 git 仓库',
    gitNoCommits: '（无提交）',
    gitMore: '仅显示前 {n} 条，有更多',
    gitError: '加载失败',
    gitLoading: '加载中…',
    gitCopyHash: '复制 hash',
    gitFiles: '变更文件',
    gitNoFiles: '（无文件变更）',
    gitTruncated: '（diff 过长，已截断）',
    gitDetached: '游离 HEAD',
    gitUncommitted: '未提交改动：未暂存（{unstaged} 处）· 已暂存（{staged} 处）',
    gitStash: 'stash',
    gitSwitchTo: '切换到 {branch}',
    gitCurrentBranch: '（当前分支）',
    gitCreateFromRemote: '创建本地分支 {branch} 并检出（{remote}）',
    gitCreateBtn: '＋ 新分支',
    gitCreateTitle: '创建并检出新分支',
    gitCreatePlaceholder: '新分支名',
    gitCreateSubmit: '创建并检出',
    gitCreateOk: '已创建分支 {name}',
    gitSwitchOk: '已切换到 {branch}',
    gitErr: '操作失败',
    gitErrInvalidBranchName: '分支名无效',
    gitErrBranchAlreadyExists: '分支已存在',
    gitErrTargetBranchNotFound: '分支不存在',
    gitErrConflictsPresent: '存在未解决冲突',
    gitErrOperationInProgress: '有 git 操作正在进行',
    gitErrBranchInOtherWorktree: '该分支已在其他工作区检出',
    gitErrTrackedChangesWouldBeOverwritten: '本地改动会被覆盖',
    gitErrUntrackedChangesWouldBeOverwritten: '未跟踪文件会被覆盖',
    timeJustNow: '刚刚',
    timeMin: '{n} 分钟前',
    timeHour: '{n} 小时前',
    timeDay: '{n} 天前',
  },
  en: {
    copied: 'Copied to clipboard',
    copyFailed: 'Copy failed',
    close: 'Close',
    gitStatus: 'Git Status',
    gitAll: 'All branches',
    gitHead: 'Current branch',
    gitNotRepo: 'Current workspace is not a git repository',
    gitNoCommits: '(no commits)',
    gitMore: 'Showing first {n} commits, more available',
    gitError: 'Failed to load',
    gitLoading: 'Loading…',
    gitCopyHash: 'Copy hash',
    gitFiles: 'Changed files',
    gitNoFiles: '(no file changes)',
    gitTruncated: '(diff truncated)',
    gitDetached: 'detached HEAD',
    gitUncommitted: 'Uncommitted: {unstaged} unstaged · {staged} staged',
    gitStash: 'stash',
    gitSwitchTo: 'Switch to {branch}',
    gitCurrentBranch: '(current)',
    gitCreateFromRemote: 'Create local branch {branch} and check out ({remote})',
    gitCreateBtn: '+ New branch',
    gitCreateTitle: 'Create and check out new branch',
    gitCreatePlaceholder: 'new branch name',
    gitCreateSubmit: 'Create & check out',
    gitCreateOk: 'Branch {name} created',
    gitSwitchOk: 'Switched to {branch}',
    gitErr: 'Operation failed',
    gitErrInvalidBranchName: 'Invalid branch name',
    gitErrBranchAlreadyExists: 'Branch already exists',
    gitErrTargetBranchNotFound: 'Branch not found',
    gitErrConflictsPresent: 'Unresolved conflicts present',
    gitErrOperationInProgress: 'A git operation is in progress',
    gitErrBranchInOtherWorktree: 'Branch is checked out in another worktree',
    gitErrTrackedChangesWouldBeOverwritten: 'Local changes would be overwritten',
    gitErrUntrackedChangesWouldBeOverwritten: 'Untracked files would be overwritten',
    timeJustNow: 'just now',
    timeMin: '{n}m ago',
    timeHour: '{n}h ago',
    timeDay: '{n}d ago',
  },
}
module.exports = {
  name: 'git-status-client',
  apply(ctx) {
    const body = document.body
    if (body === null) return
    const L = () => (I18N[(document.documentElement.lang || 'zh').slice(0, 2)] === undefined ? I18N.zh : I18N[(document.documentElement.lang || 'zh').slice(0, 2)])
    const t = (key, vars) => {
      let s = L()[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
      return s
    }

    // ---------- 样式 ----------
    const STYLE_ID = 'dsh-git-status-style'
    if (document.getElementById(STYLE_ID) === null) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = `
[data-dsc-btn] {
  border: none; border-radius: 6px; padding: 2px 8px; font-size: 11px;
  cursor: pointer; color: var(--dsw-alias-text-1, #eee);
  background: rgba(255,255,255,.08); font-family: system-ui;
}
[data-dsc-btn]:hover { background: rgba(255,255,255,.16); }
[data-dsc-btn].danger:hover { background: rgba(255,69,58,.85); }
[data-dsc-btn].armed { background: rgba(255,69,58,.85); }
[data-dsc-toggle] {
  position: fixed; left: 10px; z-index: 915; width: 30px; height: 30px;
  border-radius: 10px; border: 1px solid rgba(255,255,255,.08);
  background: var(--dsw-hovercard-bg, #2C2C2E); color: var(--dsw-alias-text-1, #eee);
  font-size: 14px; cursor: pointer; display: none; align-items: center; justify-content: center;
  box-shadow: var(--dsw-shadow-lv3, 0 4px 12px rgba(0,0,0,.3));
}
[data-dsc-toggle]:hover { background: var(--dsw-alias-interactive-bg-hover); }
[data-dsc-toggle].on { outline: 1px solid var(--dsw-alias-text-accent, #4c9aff); }
[data-dsc-msg] {
  position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%);
  z-index: 930; padding: 6px 14px; border-radius: 999px; font-size: 12px;
  font-family: system-ui; color: var(--dsw-alias-text-1, #eee);
  background: var(--dsw-hovercard-bg, #2C2C2E); box-shadow: var(--dsw-shadow-lv3);
  border: 1px solid rgba(255,255,255,.08); display: none; pointer-events: none;
}
[data-dsc-bm-time] { opacity: .5; font-size: 10px; flex: none; }
[data-dsc-git] {
  position: fixed; right: 12px; top: 96px; z-index: 916; width: 380px;
  max-width: calc(100vw - 24px); box-sizing: border-box; display: none;
  flex-direction: column; border-radius: 12px; overflow: hidden;
  background: var(--dsw-hovercard-bg, #2C2C2E); color: var(--dsw-alias-text-1, #eee);
  box-shadow: var(--dsw-shadow-lv3); border: 1px solid rgba(255,255,255,.08);
  font-family: system-ui; font-size: 12px;
}
[data-dsc-git].open { display: flex; max-height: min(72vh, 600px); }
[data-dsc-git-head] {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px; flex: none;
  border-bottom: 1px solid rgba(255,255,255,.06); font-weight: 600;
  cursor: grab; user-select: none; touch-action: none;
}
[data-dsc-git-head]:active { cursor: grabbing; }
[data-dsc-git-body] { overflow-y: auto; flex: 1; }
[data-dsc-git-rows] { position: relative; }
[data-dsc-git-svg] { position: absolute; left: 0; top: 0; pointer-events: none; overflow: hidden; }
.dsc-gline-shadow { fill: none; stroke: rgba(0,0,0,.4); stroke-width: 3.4; }
.dsc-gline { fill: none; stroke-width: 2; }
.dsc-gline-dash { stroke: #808080; stroke-dasharray: 2px 3px; opacity: .9; }
[data-dsc-git-row] {
  display: flex; align-items: center; gap: 5px; padding: 0 8px; cursor: pointer;
  height: 26px; box-sizing: border-box; overflow: hidden;
}
[data-dsc-git-row]:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06)); }
[data-dsc-git-row].sel { background: rgba(76,154,255,.16); }
[data-dsc-git-subject] {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0;
}
[data-dsc-git-row].sel [data-dsc-git-subject] { color: var(--dsw-alias-text-accent, #4c9aff); }
[data-dsc-git-meta] { display: flex; flex: none; gap: 6px; opacity: .55; font-size: 10px; white-space: nowrap; }
[data-dsc-git-copy] {
  flex: none; border: none; background: none; color: inherit; cursor: pointer;
  padding: 0 2px; opacity: 0; font-size: 11px;
}
[data-dsc-git-row]:hover [data-dsc-git-copy] { opacity: .7; }
[data-dsc-git-copy]:hover { opacity: 1 !important; }
.dsc-gref {
  flex: none; border-radius: 4px; padding: 0 5px; font-size: 10px; line-height: 16px;
  white-space: nowrap; font-weight: 600;
}
.dsc-gref-head { background: rgba(255,69,58,.22); color: #ff6961; }
.dsc-gref-branch { background: rgba(245,166,35,.18); color: #f7b84d; }
.dsc-gref-remote { background: rgba(76,154,255,.18); color: #7ab8ff; }
.dsc-gref-tag { background: rgba(52,199,89,.16); color: #5fd97f; }
.dsc-gref-stash { background: rgba(175,82,222,.18); color: #d47fff; }
/* 同名远程子标签（内嵌于本地分支 pill，同上游 gitRefHeadRemote）：远程色小块 */
.dsc-gref-remote-sub {
  margin-left: 5px; padding: 0 4px; border-radius: 3px;
  background: rgba(76,154,255,.22); color: #7ab8ff; font-size: 9px; line-height: 14px;
}
/* 当前 checkout 分支名加粗（同上游 gitRef.active .gitRefName，仅本地分支文字） */
.dsc-gref-current { font-weight: 800; }
/* 分支徽标可右键操作（context-menu 光标提示） */
.dsc-gref-branch, .dsc-gref-remote, .dsc-gref-remote-sub { cursor: context-menu; }
/* 分支操作右键菜单 / 创建分支对话框（浮层卡片，同 hovercard 风格） */
[data-dsc-git-ctx], [data-dsc-git-create] {
  position: fixed; z-index: 930; min-width: 150px; max-width: 320px;
  border-radius: 8px; padding: 4px; display: none; font-size: 11px;
  color: var(--dsw-alias-text-1, #eee);
  background: var(--dsw-hovercard-bg, #2C2C2E);
  border: 1px solid rgba(255,255,255,.08); box-shadow: var(--dsw-shadow-lv3);
}
[data-dsc-git-ctx] button {
  display: block; width: 100%; text-align: left; padding: 6px 8px;
  border-radius: 6px; color: inherit; background: none; border: none; cursor: pointer;
}
[data-dsc-git-ctx] button:hover { background: rgba(255,255,255,.07); }
[data-dsc-git-ctx] button:disabled { opacity: .45; cursor: default; }
[data-dsc-git-ctx] button:disabled:hover { background: none; }
[data-dsc-git-create] { padding: 8px 10px; display: none; }
[data-dsc-git-create] .dsc-git-create-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;
}
[data-dsc-git-create] .dsc-git-create-title { font-weight: 600; }
[data-dsc-git-create] input {
  width: 100%; box-sizing: border-box; padding: 4px 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.25);
  color: inherit; font-size: 11px; outline: none;
}
[data-dsc-git-create] input:focus { border-color: var(--dsw-alias-text-accent, #4c9aff); }
[data-dsc-git-create-err] { color: #ff6961; font-size: 11px; margin-top: 4px; min-height: 14px; }
[data-dsc-git-create] .dsc-git-create-actions { display: flex; gap: 6px; margin-top: 6px; }
[data-dsc-git-note] { padding: 18px 16px; text-align: center; opacity: .65; }
[data-dsc-git-inline] {
  box-sizing: border-box; overflow-y: auto;
  margin: 0 8px 4px; padding: 8px 10px; border-radius: 8px;
  display: flex; flex-direction: column; gap: 6px;
  background: var(--dsw-hovercard-bg, #2C2C2E);
  border: 1px solid rgba(255,255,255,.08);
}
[data-dsc-git-dtitle] { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-weight: 600; }
[data-dsc-git-dsub] { opacity: .65; font-size: 11px; }
[data-dsc-git-dbody] {
  white-space: pre-wrap; word-break: break-word; font-size: 11px; opacity: .85;
  max-height: 120px; overflow-y: auto;
}
[data-dsc-git-dfiles] { border-top: 1px solid rgba(255,255,255,.06); padding-top: 6px; }
[data-dsc-git-dfile] {
  display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 6px;
  cursor: pointer; font-size: 11px; overflow: hidden;
}
[data-dsc-git-dfile]:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06)); }
[data-dsc-git-dfile].sel { background: rgba(76,154,255,.16); }
[data-dsc-git-dfile-path] { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsc-gnum { flex: none; font-family: ui-monospace, monospace; font-size: 10px; }
.dsc-gnum-add { color: #34c759; }
.dsc-gnum-del { color: #ff453a; }
[data-dsc-git-dpatch] {
  margin: 0; white-space: pre-wrap; word-break: break-word;
  font-family: ui-monospace, monospace; font-size: 10.5px; line-height: 1.5;
  background: rgba(0,0,0,.28); border-radius: 6px; padding: 6px 8px;
  max-height: 200px; overflow-y: auto; display: none;
}
[data-dsc-git-dpatch].on { display: block; }

`
      document.head.appendChild(style)
    }

    
    // ---------- 共享工具 ----------
    const flowOf = () => document.querySelector('[data-chat-flow=""]')
    const isChatView = () => flowOf() !== null
    // 提示气泡（分支操作成功/失败等）。
    let msgTimer = null
    const flash = (text) => {
      msg.textContent = text
      msg.style.display = 'block'
      if (msgTimer !== null) clearTimeout(msgTimer)
      msgTimer = setTimeout(() => { msg.style.display = 'none' }, 1400)
    }
    // 当前会话 id（client 端 sessions 服务，better-sidebar 模式）：
    // 惰性解析——每次请求时取最新选中会话；服务不可用时返回空串，
    // 服务端自动回退 workspaceRegistry / process.cwd()。
    const currentSessionId = () => {
      try {
        const sessions = ctx?.get?.('sessions')
        return sessions?.list?.getSnapshot?.()?.current ?? ''
      } catch {
        return ''
      }
    }
    const sessionQuery = () => {
      const id = currentSessionId()
      return id === '' ? '' : `&session=${encodeURIComponent(id)}`
    }
// ---------- Git Graph（右缘浮窗，移植 vscode-git-graph 泳道算法） ----------
    // 算法移植自 mhutchie/vscode-git-graph 的 web/graph.ts：
    // - 每条"分支线"沿第一父链向下延伸，中间顶点共享一线（Vertex.onBranch）
    // - 列分配贪心最左：registerUnavailable 把被占用的点往右推（nextX）
    // - 泳道复用：availableColours[i] 记每色最后使用行，新线只占"已在上方结束"的旧泳道
    // - 合并提交的第二父向下连到已存在的父分支线（pointConnectingTo）
    // - 渲染：网格制 + shadow/彩色双 path + 折角过渡（Angular），右缘渐变淡出
    const GIT_GRID = { x: 18, y: 26, offsetX: 10, offsetY: 13, expandY: 340 }
    // 行内展开动态高度：默认 = GIT_GRID.expandY（上限）。详情内容渲染完成后按实际
    // 高度收缩（≤ 上限）。图高度 / 线拉伸 / 盒子高度三者都跟随它，保证一致不穿帮。
    let gitExpandY = GIT_GRID.expandY
    const GIT_COLORS = ['#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784', '#aed581', '#ffb74d', '#ff8a65', '#a1887f']
    const GIT_ROW_PAD = 240
    const NULL_VERTEX = -1

    const fmtRelDate = (unix) => {
      const s = Math.max(0, Math.floor(Date.now() / 1000 - unix))
      if (s < 60) return t('timeJustNow')
      if (s < 3600) return t('timeMin', { n: Math.floor(s / 60) })
      if (s < 86400) return t('timeHour', { n: Math.floor(s / 3600) })
      return t('timeDay', { n: Math.floor(s / 86400) })
    }

    // 泳道布局（原版 Graph.loadCommits + determinePath 移植）。
    const buildGitGraph = (commits) => {
      const hashIndex = new Map()
      commits.forEach((c, i) => hashIndex.set(c.hash, i))
      const vertices = commits.map((c, i) => ({
        id: i,
        onBranch: null,
        x: 0,
        nextX: 0,
        connections: [],
        parents: [],
        children: [],
        processed: 0,
      }))
      for (let i = 0; i < commits.length; i++) {
        for (const p of commits[i].parents) {
          const pi = hashIndex.get(p)
          vertices[i].parents.push(typeof pi === 'number' ? pi : NULL_VERTEX)
          if (typeof pi === 'number') vertices[pi].children.push(i)
        }
      }
      const point = (v) => ({ x: v.x, y: v.id })
      const nextPoint = (v) => ({ x: v.nextX, y: v.id })
      const nextParent = (v) => (v.processed < v.parents.length ? v.parents[v.processed] : null)
      const pointConnectingTo = (v, target, branch) => {
        for (let i = 0; i < v.connections.length; i++) {
          if (v.connections[i] !== undefined && v.connections[i].target === target && v.connections[i].branch === branch) return { x: i, y: v.id }
        }
        return null
      }
      const registerUnavailable = (v, x, target, branch) => {
        if (x === v.nextX) {
          v.nextX = x + 1
          v.connections[x] = { target, branch }
        }
      }
      const addToBranch = (v, branch, x) => {
        if (v.onBranch === null) { v.onBranch = branch; v.x = x }
      }
      const branches = []
      const availableColours = []
      const getAvailableColour = (startAt) => {
        for (let i = 0; i < availableColours.length; i++) {
          if (startAt > availableColours[i]) return i
        }
        availableColours.push(0)
        return availableColours.length - 1
      }
      const determinePath = (startAt) => {
        let i = startAt
        let vertex = vertices[i]
        let parentVertex = nextParent(vertex)
        let lastPoint = vertex.onBranch === null ? nextPoint(vertex) : point(vertex)
        let curVertex, curPoint
        if (parentVertex !== null && parentVertex !== NULL_VERTEX && vertices[parentVertex].parents.length > 0 && vertex.onBranch !== null && vertices[parentVertex].onBranch !== null && vertex.parents.length > 1) {
          // 合并线：第二父已在线上的情形，向下连到该父所在分支线
          let foundPointToParent = false
          const parentBranch = vertices[parentVertex].onBranch
          for (i = startAt + 1; i < vertices.length; i++) {
            curVertex = vertices[i]
            curPoint = pointConnectingTo(curVertex, parentVertex, parentBranch)
            if (curPoint !== null) foundPointToParent = true
            else curPoint = nextPoint(curVertex)
            parentBranch.lines.push({ p1: lastPoint, p2: curPoint, lockedFirst: !foundPointToParent && curVertex !== vertices[parentVertex] ? lastPoint.x < curPoint.x : true })
            registerUnavailable(curVertex, curPoint.x, parentVertex, parentBranch)
            lastPoint = curPoint
            if (foundPointToParent) { vertex.processed++; break }
          }
        } else {
          // 普通分支线：沿第一父链向下
          const branch = { colour: getAvailableColour(startAt), lines: [], end: 0 }
          addToBranch(vertex, branch, lastPoint.x)
          registerUnavailable(vertex, lastPoint.x, vertex, branch)
          for (i = startAt + 1; i < vertices.length; i++) {
            curVertex = vertices[i]
            curPoint = parentVertex === i && vertices[parentVertex].onBranch !== null ? point(vertices[parentVertex]) : nextPoint(curVertex)
            branch.lines.push({ p1: lastPoint, p2: curPoint, lockedFirst: lastPoint.x < curPoint.x })
            registerUnavailable(curVertex, curPoint.x, parentVertex, branch)
            lastPoint = curPoint
            if (parentVertex === i) {
              vertex.processed++
              const parentVertexOnBranch = vertices[parentVertex].onBranch !== null
              addToBranch(vertices[parentVertex], branch, curPoint.x)
              vertex = vertices[parentVertex]
              parentVertex = nextParent(vertex)
              if (parentVertex === null || parentVertexOnBranch) break
            }
          }
          if (i === vertices.length && parentVertex !== null && parentVertex === NULL_VERTEX) vertex.processed++
          branch.end = i
          branches.push(branch)
          availableColours[branch.colour] = i
        }
      }
      let i = 0
      while (i < vertices.length) {
        if (nextParent(vertices[i]) !== null || vertices[i].onBranch === null) determinePath(i)
        else i++
      }
      let maxX = 1
      for (const v of vertices) if (v.nextX > maxX) maxX = v.nextX
      const width = Math.max(0, 2 * GIT_GRID.offsetX + (maxX - 1) * GIT_GRID.x)
      const height = vertices.length * GIT_GRID.y + GIT_GRID.offsetY - GIT_GRID.y / 2
      return { vertices, branches, width, height }
    }

    // 分支线 → SVG path（原版 Branch.draw 移植：像素化 + 展开区拉伸 + 共线合并 + 折角过渡）。
    // expandAt：展开的 commit 行号（-1 = 不展开）。穿过展开区的线按原版规则处理：
    // 垂直直穿拉长；lockedFirst 折角留在展开区上方、下方补竖线；否则展开区下方补竖线、折角整体下移。
    // hasUncommitted：存在未提交虚拟行（第 0 行）时，p1 在第 0 行的线段为"未提交段"，
    // 灰色虚线单独成 path（原版 numUncommitted + drawPath 拆分移植）。
    const gitGraphPaths = (graph, expandAt = -1, hasUncommitted = false, expandY = GIT_GRID.expandY) => {
      const { x: gx, y: gy, offsetX, offsetY } = GIT_GRID
      const dElbow = gy * 0.38
      const paths = []
      for (const branch of graph.branches) {
        const lines = []
        for (const line of branch.lines) {
          const uncommitted = hasUncommitted && line.p1.y === 0
          let x1 = line.p1.x * gx + offsetX
          let y1 = line.p1.y * gy + offsetY
          let x2 = line.p2.x * gx + offsetX
          let y2 = line.p2.y * gy + offsetY
          // 未提交段虚线从空心圆下缘起线（圆心 y + 圆半径 5），不从圆心穿出
          if (uncommitted) y1 += 5
          if (expandAt > -1) {
            if (line.p1.y > expandAt) {
              // 整条线在展开区之下：整体下移
              y1 += expandY
              y2 += expandY
            } else if (line.p2.y > expandAt) {
              // 线穿过展开区（p1 行 <= expandAt < p2 行）
              if (x1 === x2) {
                // 垂直：终点拉长过展开区
                y2 += expandY
              } else if (line.lockedFirst) {
                // 折角留在原位（展开区上沿），下方补竖线穿过展开区
                lines.push({ p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, lockedFirst: true, uncommitted })
                lines.push({ p1: { x: x2, y: y1 + gy }, p2: { x: x2, y: y2 + expandY }, lockedFirst: true, uncommitted })
                continue
              } else {
                // 展开区上方补竖线，折角移到展开区下沿
                lines.push({ p1: { x: x1, y: y1 }, p2: { x: x1, y: y2 - gy + expandY }, lockedFirst: false, uncommitted })
                y1 += expandY
                y2 += expandY
              }
            }
          }
          lines.push({ p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, lockedFirst: line.lockedFirst, uncommitted })
        }
        let i = 0
        while (i < lines.length - 1) {
          const a = lines[i]
          const b = lines[i + 1]
          // 共线合并：不跨 committed/uncommitted 边界
          if (a.uncommitted === b.uncommitted && a.p1.x === a.p2.x && a.p2.x === b.p1.x && b.p1.x === b.p2.x && a.p2.y === b.p1.y) {
            a.p2 = b.p2
            lines.splice(i + 1, 1)
          } else {
            i++
          }
        }
        // 按 committed/uncommitted 分段拆分 path（原版 drawPath 拆分移植）
        let d = ''
        let prev = null
        let segUncommitted = null
        const flush = () => {
          if (d === '') return
          paths.push({ d, colour: GIT_COLORS[branch.colour % GIT_COLORS.length], dashed: segUncommitted })
          d = ''
        }
        for (const line of lines) {
          const { p1, p2 } = line
          if (line.uncommitted !== segUncommitted) {
            flush()
            segUncommitted = line.uncommitted
          }
          if (d === '' || prev === null || p1.x !== prev.x || p1.y !== prev.y) d += `M${p1.x.toFixed(0)},${p1.y.toFixed(1)}`
          if (p1.x === p2.x) {
            d += `L${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
          } else if (line.lockedFirst) {
            d += `L${p2.x.toFixed(0)},${(p2.y - dElbow).toFixed(1)}L${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
          } else {
            d += `L${p1.x.toFixed(0)},${(p1.y + dElbow).toFixed(1)}L${p2.x.toFixed(0)},${p2.y.toFixed(1)}`
          }
          prev = p2
        }
        flush()
      }
      return paths
    }

    const SVG_NS = 'http://www.w3.org/2000/svg'
    const gitToggle = document.createElement('button')
    gitToggle.type = 'button'
    gitToggle.setAttribute('data-dsc-toggle', '')
    gitToggle.textContent = '⎇'
    gitToggle.title = t('gitStatus')
    gitToggle.style.top = 'calc(50% + 38px)'
    gitToggle.style.transform = 'translateY(-50%)'
    body.appendChild(gitToggle)

    const gitPanel = document.createElement('div')
    gitPanel.setAttribute('data-dsc-git', '')
    body.appendChild(gitPanel)
    const gitHead = document.createElement('div')
    gitHead.setAttribute('data-dsc-git-head', '')
    const gitTitle = document.createElement('span')
    gitTitle.textContent = t('gitStatus')
    // 范围切换：自绘下拉（原生 select 的弹出面板是浏览器级 UI，CSS 无法定制；
    // 改为按钮 + 复用右键菜单组件，样式完全统一）
    let gitScopeValue = 'all'
    const gitScopeBtn = document.createElement('button')
    gitScopeBtn.type = 'button'
    gitScopeBtn.setAttribute('data-dsc-btn', '')
    gitScopeBtn.style.marginLeft = 'auto' // 按钮组靠右（原 select 的 margin-left: auto 语义）
    gitScopeBtn.textContent = `${t('gitAll')} ▾`
    gitScopeBtn.addEventListener('click', (ev) => {
      const rect = gitScopeBtn.getBoundingClientRect()
      gitCtxOpen(rect.left, rect.bottom + 4, [
        { label: t('gitAll'), checked: gitScopeValue === 'all', onClick: () => { if (gitScopeValue !== 'all') { gitScopeValue = 'all'; gitScopeBtn.textContent = `${t('gitAll')} ▾`; gitFetch(false) } } },
        { label: t('gitHead'), checked: gitScopeValue === 'head', onClick: () => { if (gitScopeValue !== 'head') { gitScopeValue = 'head'; gitScopeBtn.textContent = `${t('gitHead')} ▾`; gitFetch(false) } } },
      ])
      ev.stopPropagation()
    })
    const gitRefresh = document.createElement('button')
    gitRefresh.type = 'button'
    gitRefresh.setAttribute('data-dsc-btn', '')
    gitRefresh.textContent = '↻'
    const gitClose = document.createElement('button')
    gitClose.type = 'button'
    gitClose.setAttribute('data-dsc-btn', '')
    gitClose.textContent = t('close')
    gitHead.appendChild(gitTitle)
    gitHead.appendChild(gitScopeBtn)
    gitHead.appendChild(gitRefresh)
    gitHead.appendChild(gitClose)
    const gitBody = document.createElement('div')
    gitBody.setAttribute('data-dsc-git-body', '')
    const gitRowsWrap = document.createElement('div')
    gitRowsWrap.setAttribute('data-dsc-git-rows', '')
    const gitSvg = document.createElementNS(SVG_NS, 'svg')
    gitSvg.setAttribute('data-dsc-git-svg', '')
    const gitNote = document.createElement('div')
    gitNote.setAttribute('data-dsc-git-note', '')
    gitRowsWrap.appendChild(gitSvg)
    gitRowsWrap.appendChild(gitNote)
    gitBody.appendChild(gitRowsWrap)
    gitPanel.appendChild(gitHead)
    gitPanel.appendChild(gitBody)

    // 浮窗拖拽（位置记忆到 localStorage）。
    const savedGitPos = (() => {
      try { return JSON.parse(localStorage.getItem('dsc-git-pos') ?? 'null') } catch { return null }
    })()
    if (savedGitPos !== null && typeof savedGitPos.x === 'number') {
      gitPanel.style.left = `${savedGitPos.x}px`
      gitPanel.style.top = `${savedGitPos.y}px`
      gitPanel.style.right = 'auto'
    }
    let gitDrag = null
    gitHead.addEventListener('pointerdown', (ev) => {
      if (ev.target instanceof HTMLElement && ev.target.closest('select, [data-dsc-btn]') !== null) return
      gitDrag = { dx: ev.clientX - gitPanel.offsetLeft, dy: ev.clientY - gitPanel.offsetTop }
      gitHead.setPointerCapture?.(ev.pointerId)
      ev.preventDefault()
    })
    gitHead.addEventListener('pointermove', (ev) => {
      if (gitDrag === null) return
      gitPanel.style.left = `${Math.min(Math.max(8, ev.clientX - gitDrag.dx), window.innerWidth - 60)}px`
      gitPanel.style.top = `${Math.min(Math.max(8, ev.clientY - gitDrag.dy), window.innerHeight - 60)}px`
      gitPanel.style.right = 'auto'
    })
    const gitDragEnd = () => {
      if (gitDrag !== null) {
        try { localStorage.setItem('dsc-git-pos', JSON.stringify({ x: gitPanel.offsetLeft, y: gitPanel.offsetTop })) } catch { /* ignore */ }
      }
      gitDrag = null
    }
    gitHead.addEventListener('pointerup', gitDragEnd)
    gitHead.addEventListener('pointercancel', gitDragEnd)

    let gitOpen = false
    let gitSelected = null
    const gitShowCache = new Map()

    const renderGitNote = (text) => {
      gitNote.textContent = text
      gitNote.style.display = text === '' ? 'none' : 'block'
    }

    // 行内详情：把 commit 详情（标题/作者/正文/变更文件/diff）渲染进传入的盒子。
    // 数据按 hash 缓存，刷新重渲染时秒开。v2：虚拟行（UNCOMMITTED）/ stash 走特化 URL：
    // - UNCOMMITTED：diff HEAD（服务端 gitShowUncommitted），无作者行/复制按钮
    // - stash：&base=<baseHash> 显式 diff base..stash（多父 commit 的 diff-tree/show 无输出），
    //   第三父 untracked 快照经 &stashUntracked= 追加
    const showGitDetail = async (commit, box) => {
      const hash = commit.hash
      const isUncommitted = hash === 'UNCOMMITTED'
      box.replaceChildren()
      const dTitle = document.createElement('div')
      dTitle.setAttribute('data-dsc-git-dtitle', '')
      const dSub = document.createElement('div')
      dSub.setAttribute('data-dsc-git-dsub', '')
      const dBody = document.createElement('div')
      dBody.setAttribute('data-dsc-git-dbody', '')
      const dFiles = document.createElement('div')
      dFiles.setAttribute('data-dsc-git-dfiles', '')
      box.appendChild(dTitle)
      box.appendChild(dSub)
      box.appendChild(dBody)
      box.appendChild(dFiles)
      const loading = document.createElement('span')
      loading.textContent = t('gitLoading')
      dTitle.appendChild(loading)
      try {
        let data = gitShowCache.get(hash)
        if (data === undefined) {
          let url = `${BASE}/git/show?rev=${encodeURIComponent(hash)}${sessionQuery()}`
          if (commit.stash !== null) {
            url += `&base=${encodeURIComponent(commit.stash.baseHash)}`
            if (commit.stash.untrackedFilesHash !== null) url += `&stashUntracked=${encodeURIComponent(commit.stash.untrackedFilesHash)}`
          }
          const r = await fetch(url)
          data = await r.json()
          if (data.error !== undefined) throw new Error(data.error)
          gitShowCache.set(hash, data)
        }
        dTitle.replaceChildren()
        if (!isUncommitted) {
          const hashTag = document.createElement('span')
          hashTag.textContent = data.meta.hashShort
          const copyBtn = document.createElement('button')
          copyBtn.type = 'button'
          copyBtn.setAttribute('data-dsc-btn', '')
          copyBtn.textContent = '⧉'
          copyBtn.title = t('gitCopyHash')
          copyBtn.addEventListener('click', () => {
            navigator.clipboard?.writeText(data.meta.hash).then(() => flash(t('copied')), () => flash(t('copyFailed')))
          })
          dTitle.appendChild(hashTag)
          dTitle.appendChild(copyBtn)
        }
        const subject = document.createElement('span')
        subject.textContent = isUncommitted
          ? t('gitUncommitted', { unstaged: commit.uncommitted.unstaged, staged: commit.uncommitted.staged })
          : data.meta.subject
        subject.style.flex = '1'
        subject.style.overflow = 'hidden'
        subject.style.textOverflow = 'ellipsis'
        subject.style.whiteSpace = 'nowrap'
        dTitle.appendChild(subject)
        if (!isUncommitted) {
          dSub.textContent = `${data.meta.author} <${data.meta.email}> · ${new Date(data.meta.date * 1000).toLocaleString()}`
          if (data.body !== '' && data.body !== data.meta.subject) dBody.textContent = data.body
        }
        // 变更文件
        const fileHead = document.createElement('div')
        fileHead.style.opacity = '.6'
        fileHead.style.marginBottom = '2px'
        fileHead.textContent = t('gitFiles')
        dFiles.appendChild(fileHead)
        const sections = data.patch.split(/^diff --git /m).filter((s) => s.trim() !== '')
        if (data.files.length === 0) {
          const empty = document.createElement('div')
          empty.style.opacity = '.55'
          empty.textContent = t('gitNoFiles')
          dFiles.appendChild(empty)
        }
        const patchPre = document.createElement('pre')
        patchPre.setAttribute('data-dsc-git-dpatch', '')
        dFiles.appendChild(patchPre)
        data.files.forEach((f, idx) => {
          const row = document.createElement('div')
          row.setAttribute('data-dsc-git-dfile', '')
          const path = document.createElement('span')
          path.setAttribute('data-dsc-git-dfile-path', '')
          path.textContent = f.path
          const num = document.createElement('span')
          num.className = 'dsc-gnum'
          if (f.adds > 0 || f.dels > 0) {
            const a = document.createElement('span')
            a.className = 'dsc-gnum-add'
            a.textContent = `+${f.adds}`
            const d = document.createElement('span')
            d.className = 'dsc-gnum-del'
            d.textContent = `-${f.dels}`
            num.appendChild(a)
            num.appendChild(document.createTextNode(' '))
            num.appendChild(d)
          } else {
            num.textContent = '±'
            num.style.opacity = '.5'
          }
          row.appendChild(path)
          row.appendChild(num)
          row.addEventListener('click', () => {
            const section = sections[idx]
            const isOn = patchPre.classList.contains('on') && patchPre.dataset.idx === String(idx)
            patchPre.classList.remove('on')
            for (const el of dFiles.querySelectorAll('[data-dsc-git-dfile].sel')) el.classList.remove('sel')
            if (!isOn && section !== undefined) {
              patchPre.dataset.idx = String(idx)
              patchPre.textContent = 'diff --git ' + section + (data.truncated ? `\n${t('gitTruncated')}` : '')
              patchPre.classList.add('on')
              row.classList.add('sel')
            }
          })
          dFiles.appendChild(row)
        })
        if (data.truncated && sections.length === 0) {
          const note = document.createElement('div')
          note.style.opacity = '.55'
          note.textContent = t('gitTruncated')
          dFiles.appendChild(note)
        }
      } catch {
        dTitle.replaceChildren()
        const err = document.createElement('span')
        err.textContent = t('gitError')
        dTitle.appendChild(err)
      }
      // 内容渲染完成（成功或失败）：切 auto 按实际高度收缩（≤ 上限），
      // 图/线/盒子高度跟随（gitExpandY），不等则重绘一次；相等即停（终止条件）。
      // 注意：点击文件行展开 patch 不走这里，盒子保持当前高度内部滚动，图不跳动。
      // box 可能已被后续重绘/收起移出 DOM（快速切换行）：isConnected 时才能测量，
      // 否则 offsetHeight = 0 会把 gitExpandY 打崩。
      if (box.isConnected) {
        box.style.height = 'auto'
        const measured = box.offsetHeight
        if (measured !== gitExpandY) {
          gitExpandY = measured
          renderGitGraph()
        }
      }
    }

    const renderGitGraph = () => {
      gitRowsWrap.querySelectorAll('[data-dsc-git-row], [data-dsc-git-inline]').forEach((el) => el.remove())
      gitSvg.replaceChildren()
      if (gitRows.length === 0) {
        gitSelected = null
        renderGitNote(t('gitNoCommits'))
        gitSvg.setAttribute('width', '0')
        gitSvg.setAttribute('height', '0')
        return
      }
      // 展开索引：选中 commit 所在行；已不在列表（刷新后消失）则收起。
      let expandAt = -1
      if (gitSelected !== null) {
        expandAt = gitRows.findIndex((c) => c.hash === gitSelected)
        if (expandAt === -1) gitSelected = null
      }
      renderGitNote('')
      // 收起/无展开时把动态高度重置回上限（下次展开重新测量）
      if (expandAt === -1 && gitExpandY !== GIT_GRID.expandY) gitExpandY = GIT_GRID.expandY
      const graph = buildGitGraph(gitRows)
      const hasUncommitted = gitRows[0]?.hash === 'UNCOMMITTED'
      const clipW = Math.min(graph.width, GIT_ROW_PAD)
      const expandY = expandAt > -1 ? gitExpandY : 0
      gitSvg.setAttribute('width', String(graph.width))
      gitSvg.setAttribute('height', String(graph.height + expandY))
      gitSvg.style.width = `${clipW}px`
      // 分支线：shadow + 彩色双 path（原版画法；展开时线穿过详情区拉伸；
      // v2：未提交段灰色虚线单独 path）
      for (const path of gitGraphPaths(graph, expandAt, hasUncommitted, expandY)) {
        for (const cls of ['dsc-gline-shadow', 'dsc-gline']) {
          const p = document.createElementNS(SVG_NS, 'path')
          p.setAttribute('d', path.d)
          p.setAttribute('class', path.dashed && cls === 'dsc-gline' ? `${cls} dsc-gline-dash` : cls)
          if (cls === 'dsc-gline') p.setAttribute('stroke', path.dashed ? '#808080' : path.colour)
          gitSvg.appendChild(p)
        }
      }
      // 顶点圆点（颜色 = 所在泳道颜色；HEAD 提交加粗描边；v2：未提交行空心圆、
      // stash 双层圆；展开行下方整体下移）
      const headIndex = gitRows.findIndex((c) => c.refs.isHead)
      // 当前 checkout 分支名（HEAD -> X；游离 HEAD 为 null）→ 本地徽标文字加粗
      const currentBranch = headIndex > -1 ? gitRows[headIndex].refs.headName ?? null : null
      graph.vertices.forEach((v, idx) => {
        const commit = gitRows[v.id]
        const isUncommitted = commit.hash === 'UNCOMMITTED'
        const isStash = commit.stash !== null
        const cx = v.x * GIT_GRID.x + GIT_GRID.offsetX
        const cy = v.id * GIT_GRID.y + GIT_GRID.offsetY + (expandAt > -1 && v.id > expandAt ? expandY : 0)
        const colour = v.onBranch !== null ? GIT_COLORS[v.onBranch.colour % GIT_COLORS.length] : '#8e8e93'
        if (isUncommitted) {
          // 空心圆（灰色，未提交）
          const dot = document.createElementNS(SVG_NS, 'circle')
          dot.setAttribute('cx', String(cx))
          dot.setAttribute('cy', String(cy))
          dot.setAttribute('r', '5')
          dot.setAttribute('fill', 'none')
          dot.setAttribute('stroke', '#808080')
          dot.setAttribute('stroke-width', '2')
          gitSvg.appendChild(dot)
        } else if (isStash) {
          // 双层圆（外环 + 实心内核，同原版 stashOuter/stashInner）
          const outer = document.createElementNS(SVG_NS, 'circle')
          outer.setAttribute('cx', String(cx))
          outer.setAttribute('cy', String(cy))
          outer.setAttribute('r', '4.5')
          outer.setAttribute('fill', 'none')
          outer.setAttribute('stroke', colour)
          outer.setAttribute('stroke-width', '1.5')
          gitSvg.appendChild(outer)
          const inner = document.createElementNS(SVG_NS, 'circle')
          inner.setAttribute('cx', String(cx))
          inner.setAttribute('cy', String(cy))
          inner.setAttribute('r', '2')
          inner.setAttribute('fill', colour)
          gitSvg.appendChild(inner)
        } else {
          const dot = document.createElementNS(SVG_NS, 'circle')
          dot.setAttribute('cx', String(cx))
          dot.setAttribute('cy', String(cy))
          dot.setAttribute('r', idx === headIndex ? '5' : '4')
          dot.setAttribute('fill', idx === headIndex ? '#1c1c1e' : colour)
          dot.setAttribute('stroke', colour)
          dot.setAttribute('stroke-width', idx === headIndex ? '2' : '1.5')
          gitSvg.appendChild(dot)
        }
        // 行
        const row = document.createElement('div')
        row.setAttribute('data-dsc-git-row', '')
        row.style.height = `${GIT_GRID.y}px`
        row.style.paddingLeft = `${clipW}px`
        if (idx === expandAt) row.classList.add('sel')
        // 同名本地/远程分支徽标合并（同上游 gitRefHeadRemote）：本地分支 pill 内
        // 内嵌远程名子标签，如 ⎇ main [gitee]；只归并同一 commit 上的同名 refs，
        // 多个远程同名 → ⎇ main [gitee][origin]；无本地分支的远程保持独立蓝 pill。
        const remotesOfHead = new Map()
        for (const r of commit.refs.remotes) {
          const slash = r.indexOf('/')
          if (slash <= 0) continue
          const branchName = r.slice(slash + 1)
          if (commit.refs.heads.includes(branchName)) {
            if (!remotesOfHead.has(branchName)) remotesOfHead.set(branchName, [])
            remotesOfHead.get(branchName).push(r.slice(0, slash))
          }
        }
        for (const r of commit.refs.heads) {
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-branch'
          const name = document.createElement('span')
          name.textContent = r
          // 当前 checkout 分支名加粗（同上游 gitRef.active .gitRefName，仅本地分支文字）
          if (r === currentBranch) name.className = 'dsc-gref-current'
          b.appendChild(name)
          const remotes = remotesOfHead.get(r)
          if (remotes !== undefined) {
            for (const remote of remotes) {
              const sub = document.createElement('span')
              sub.className = 'dsc-gref-remote-sub'
              sub.textContent = remote
              b.appendChild(sub)
            }
          }
          row.appendChild(b)
        }
        for (const r of commit.refs.remotes) {
          const slash = r.indexOf('/')
          if (slash > 0 && commit.refs.heads.includes(r.slice(slash + 1))) continue
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-remote'
          b.textContent = r
          row.appendChild(b)
        }
        for (const r of commit.refs.tags) {
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-tag'
          b.textContent = r
          row.appendChild(b)
        }
        if (commit.stash !== null) {
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-stash'
          b.textContent = commit.stash.selector.replace(/^refs\//, '')
          b.title = t('gitStash')
          row.appendChild(b)
        }
        if (commit.refs.isHead) {
          const b = document.createElement('span')
          b.className = 'dsc-gref dsc-gref-head'
          b.textContent = 'HEAD'
          b.title = t('gitDetached')
          row.appendChild(b)
        }
        const subject = document.createElement('span')
        subject.setAttribute('data-dsc-git-subject', '')
        subject.textContent = isUncommitted
          ? t('gitUncommitted', { unstaged: commit.uncommitted.unstaged, staged: commit.uncommitted.staged })
          : commit.subject
        subject.title = subject.textContent
        row.appendChild(subject)
        if (!isUncommitted) {
          const meta = document.createElement('span')
          meta.setAttribute('data-dsc-git-meta', '')
          meta.textContent = `${commit.author} · ${fmtRelDate(commit.date)}`
          row.appendChild(meta)
        }
        if (!isUncommitted) {
          const copyBtn = document.createElement('button')
          copyBtn.type = 'button'
          copyBtn.setAttribute('data-dsc-git-copy', '')
          copyBtn.textContent = '⧉'
          copyBtn.title = t('gitCopyHash')
          copyBtn.addEventListener('click', (ev) => {
            ev.stopPropagation()
            navigator.clipboard?.writeText(commit.hash).then(() => flash(t('copied')), () => flash(t('copyFailed')))
          })
          row.appendChild(copyBtn)
        }
        row.addEventListener('click', () => {
          gitSelected = gitSelected === commit.hash ? null : commit.hash
          renderGitGraph()
        })
        gitRowsWrap.appendChild(row)
        // 行内展开：详情盒插在该行下方（高度 = gitExpandY，图列留白让分支线可见；
        // maxHeight 用 JS 与 GIT_GRID.expandY 保持单一真源；内容渲染后 showGitDetail
        // 会切 auto 重新测量收缩）
        if (idx === expandAt) {
          const box = document.createElement('div')
          box.setAttribute('data-dsc-git-inline', '')
          box.style.marginLeft = `${clipW}px`
          box.style.maxHeight = `${GIT_GRID.expandY}px`
          box.style.height = `${expandY}px`
          gitRowsWrap.appendChild(box)
          showGitDetail(commit, box)
        }
      })
      if (gitMoreAvailable) {
        const more = document.createElement('div')
        more.style.padding = '6px 12px'
        more.style.opacity = '.55'
        more.style.fontSize = '11px'
        more.textContent = t('gitMore', { n: gitRows.length })
        gitRowsWrap.appendChild(more)
      }
    }

    let gitRows = []
    let gitMoreAvailable = false
    const gitFetch = async (silent) => {
      if (!silent) renderGitNote(t('gitLoading'))
      try {
        const r = await fetch(`${BASE}/git/log?n=500&scope=${gitScopeValue}${sessionQuery()}`)
        const data = await r.json()
        if (data.error !== undefined) throw new Error(data.error)
        if (data.isRepo === false) {
          gitRows = []
          gitMoreAvailable = false
          renderGitGraph()
          renderGitNote(t('gitNotRepo'))
          return
        }
        gitRows = data.commits
        gitMoreAvailable = data.moreAvailable
        renderGitGraph()
      } catch {
        if (!silent) renderGitNote(t('gitError'))
      }
    }

    // ---------- 分支操作（v0.4.0，守卫模型移植自社区 dsh-git-graph） ----------
    // check-ref-format 短分支名规则的客户端镜像（即时反馈；服务端仍权威校验）。
    const validateBranchName = (name) => {
      if (name === '') return 'empty'
      if (name === '@') return 'at-sign'
      if (name.startsWith('-')) return 'leading-dash'
      if (name.endsWith('.')) return 'trailing-dot'
      if (name.endsWith('.lock')) return 'lock-suffix'
      if (name.includes('..')) return 'double-dot'
      if (name.includes('@{')) return 'at-brace'
      if (name.includes('//')) return 'double-slash'
      if (name.includes(' ')) return 'space'
      if (name.includes('~') || name.includes('^') || name.includes(':') || name.includes('?') || name.includes('*') || name.includes('[') || name.includes('\\')) return 'forbidden-char'
      for (const ch of name) {
        const code = ch.codePointAt(0)
        if (code !== undefined && (code < 0x20 || code === 0x7f)) return 'control-char'
      }
      for (const component of name.split('/')) {
        if (component === '') return 'empty-component'
        if (component.startsWith('.')) return 'dot-component'
        if (component.endsWith('.lock')) return 'lock-suffix'
      }
      if (name.length > 1000) return 'too-long'
      return null
    }

    /** 稳定错误码 → 本地化文案（含被挡文件路径详情）。 */
    const gitErrText = (err) => {
      if (err === undefined || err === null) return t('gitErr')
      const key = 'gitErr' + String(err.code ?? 'internal').replace(/(^|-)([a-z])/g, (_, p, c) => c.toUpperCase())
      const base = t(key)
      const detail = Array.isArray(err.paths) && err.paths.length > 0 ? err.paths.join(', ') : (err.message ?? '')
      return base === key ? (detail || base) : detail ? `${base}：${detail}` : base
    }

    /** 分支操作 POST（写路由）；resolve { ok, branch }，reject { code, message, paths? }。 */
    const gitBranchAction = async (payload) => {
      const r = await fetch(`${BASE}/git/branch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, session: currentSessionId() }),
      })
      const data = await r.json().catch(() => null)
      if (data === null) throw { code: 'internal', message: t('gitErr') }
      if (data.ok === true) return data
      throw data.error ?? { code: 'internal', message: t('gitErr') }
    }

    // 右键菜单浮层（本地分支：切换；远程：创建本地分支并检出）。
    const gitCtxMenu = document.createElement('div')
    gitCtxMenu.setAttribute('data-dsc-git-ctx', '')
    body.appendChild(gitCtxMenu)
    const gitCtxClose = () => { gitCtxMenu.style.display = 'none'; gitCtxMenu.replaceChildren() }
    const gitCtxOpen = (x, y, items) => {
      gitCtxMenu.replaceChildren()
      for (const item of items) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = item.checked === true ? `✓ ${item.label}` : item.label
        btn.disabled = item.disabled === true
        if (item.disabled !== true) btn.addEventListener('click', () => { gitCtxClose(); item.onClick() })
        gitCtxMenu.appendChild(btn)
      }
      gitCtxMenu.style.display = 'block'
      const rect = gitCtxMenu.getBoundingClientRect()
      gitCtxMenu.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`
      gitCtxMenu.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`
    }
    document.addEventListener('click', (ev) => {
      if (!gitCtxMenu.contains(ev.target)) gitCtxClose()
    })
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') gitCtxClose()
    })

    // 分支徽标右键（document 级委托，行重建不影响）：本地 pill → 切换；
    // 远程子标签/独立 pill → 创建本地分支并检出。命中 git 面板内徽标才拦截默认菜单。
    document.addEventListener('contextmenu', (ev) => {
      if (!(ev.target instanceof HTMLElement)) return
      if (!gitCtxMenu.contains(ev.target)) gitCtxClose()
      const sub = ev.target.closest('[data-dsc-git-rows] .dsc-gref-remote-sub')
      const local = ev.target.closest('[data-dsc-git-rows] .dsc-gref-branch')
      const remote = ev.target.closest('[data-dsc-git-rows] .dsc-gref-remote')
      const target = sub ?? (local === null ? remote : local)
      if (target === null) return
      ev.preventDefault()
      ev.stopPropagation()
      const currentBranch = gitRows.find((c) => c.refs.isHead)?.refs.headName ?? null
      if (sub !== null || remote !== null) {
        // 远程：全名 = 远程名/本地分支名（子标签）或完整 ref（独立 pill）
        const fullRef = sub !== null
          ? `${(local?.firstChild?.textContent ?? '').trim()}/${sub.textContent.trim()}`
          : (remote?.textContent ?? '').trim()
        const slash = fullRef.indexOf('/')
        const branchName = slash > 0 ? fullRef.slice(slash + 1) : fullRef
        gitCtxOpen(ev.clientX, ev.clientY, [{
          label: t('gitCreateFromRemote', { branch: branchName, remote: fullRef.slice(0, slash) }),
          onClick: async () => {
            try {
              const result = await gitBranchAction({ action: 'checkout', branch: branchName, remote: fullRef })
              flash(t('gitSwitchOk', { branch: result.branch }))
              gitFetch(true)
            } catch (err) {
              flash(gitErrText(err))
            }
          },
        }])
      } else if (local !== null) {
        const branchName = (local.firstChild?.textContent ?? '').trim()
        gitCtxOpen(ev.clientX, ev.clientY, [{
          label: t('gitSwitchTo', { branch: branchName }),
          disabled: branchName === currentBranch,
          onClick: async () => {
            try {
              const result = await gitBranchAction({ action: 'checkout', branch: branchName })
              flash(t('gitSwitchOk', { branch: result.branch }))
              gitFetch(true)
            } catch (err) {
              flash(gitErrText(err))
            }
          },
        }])
      }
    })

    // 创建分支对话框：头部「＋ 新分支」按钮 → 输入名 + 即时校验 + 创建并检出。
    const gitCreateBox = document.createElement('div')
    gitCreateBox.setAttribute('data-dsc-git-create', '')
    body.appendChild(gitCreateBox)
    const gitCreateHead = document.createElement('div')
    gitCreateHead.className = 'dsc-git-create-head'
    const gitCreateTitle = document.createElement('div')
    gitCreateTitle.className = 'dsc-git-create-title'
    gitCreateTitle.textContent = t('gitCreateTitle')
    const gitCreateCancel = document.createElement('button')
    gitCreateCancel.type = 'button'
    gitCreateCancel.setAttribute('data-dsc-btn', '')
    gitCreateCancel.textContent = t('close')
    gitCreateHead.appendChild(gitCreateTitle)
    gitCreateHead.appendChild(gitCreateCancel)
    const gitCreateInput = document.createElement('input')
    gitCreateInput.type = 'text'
    gitCreateInput.placeholder = t('gitCreatePlaceholder')
    const gitCreateErr = document.createElement('div')
    gitCreateErr.setAttribute('data-dsc-git-create-err', '')
    const gitCreateActions = document.createElement('div')
    gitCreateActions.className = 'dsc-git-create-actions'
    const gitCreateSubmit = document.createElement('button')
    gitCreateSubmit.type = 'button'
    gitCreateSubmit.setAttribute('data-dsc-btn', '')
    gitCreateSubmit.textContent = t('gitCreateSubmit')
    gitCreateActions.appendChild(gitCreateSubmit)
    gitCreateBox.appendChild(gitCreateHead)
    gitCreateBox.appendChild(gitCreateInput)
    gitCreateBox.appendChild(gitCreateErr)
    gitCreateBox.appendChild(gitCreateActions)
    const gitCreateClose = () => { gitCreateBox.style.display = 'none' }
    const gitCreateOpen = () => {
      gitCreateErr.textContent = ''
      gitCreateInput.value = ''
      gitCreateBox.style.display = 'block'
      const headRect = gitHead.getBoundingClientRect()
      gitCreateBox.style.left = `${Math.min(headRect.left, window.innerWidth - 230)}px`
      gitCreateBox.style.top = `${headRect.bottom + 6}px`
      gitCreateInput.focus()
    }
    gitCreateInput.addEventListener('input', () => {
      const reason = validateBranchName(gitCreateInput.value.trim())
      gitCreateErr.textContent = reason === null ? '' : t('gitErrInvalidBranchName')
      gitCreateSubmit.disabled = reason !== null
    })
    const gitCreateRun = async () => {
      const name = gitCreateInput.value.trim()
      if (validateBranchName(name) !== null) return
      gitCreateSubmit.disabled = true
      try {
        const result = await gitBranchAction({ action: 'create', name })
        gitCreateClose()
        flash(t('gitCreateOk', { name: result.branch }))
        gitFetch(true)
      } catch (err) {
        gitCreateErr.textContent = gitErrText(err)
        gitCreateSubmit.disabled = false
      }
    }
    gitCreateSubmit.addEventListener('click', gitCreateRun)
    gitCreateInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') gitCreateRun()
      if (ev.key === 'Escape') gitCreateClose()
    })
    gitCreateCancel.addEventListener('click', gitCreateClose)
    const gitCreateBtn = document.createElement('button')
    gitCreateBtn.type = 'button'
    gitCreateBtn.setAttribute('data-dsc-btn', '')
    gitCreateBtn.textContent = t('gitCreateBtn')
    gitCreateBtn.title = t('gitCreateTitle')
    gitCreateBtn.addEventListener('click', gitCreateOpen)
    // 插到关闭按钮之前：头部按钮顺序为 标题 / 范围▾ / ↻ / ＋新分支 / 关闭（关闭最右）
    gitHead.insertBefore(gitCreateBtn, gitClose)

    gitToggle.addEventListener('click', () => {
      gitOpen = !gitOpen
      gitPanel.classList.toggle('open', gitOpen)
      gitToggle.classList.toggle('on', gitOpen)
      if (gitOpen) gitFetch(false)
    })
    gitClose.addEventListener('click', () => {
      gitOpen = false
      gitPanel.classList.remove('open')
      gitToggle.classList.remove('on')
    })
    gitRefresh.addEventListener('click', () => gitFetch(false))
    const gitTimer = setInterval(() => {
      if (gitOpen && document.visibilityState === 'visible') gitFetch(true)
    }, 10000)

    
    // ---------- 全局观测：视图切换时显示/隐藏左缘 ⎇ 开关 ----------
    const syncToggles = () => {
      gitToggle.style.display = isChatView() ? 'flex' : 'none'
    }
    let flow = flowOf()
    const bindFlow = () => {
      const next = flowOf()
      if (next === flow) return false
      flow = next
      syncToggles()
      return true
    }
    const observer = new MutationObserver(() => { bindFlow() })
    observer.observe(body, { childList: true, subtree: true })
    // 视图切换可能不触发 mutation，定时兜底
    const viewTimer = setInterval(syncToggles, 2000)

    const msg = document.createElement('div')
    msg.setAttribute('data-dsc-msg', '')
    body.appendChild(msg)

    bindFlow()
    syncToggles()

    // 插件生命周期：unload 时清理。
    return () => {
      clearInterval(gitTimer)
      clearInterval(viewTimer)
      if (msgTimer !== null) clearTimeout(msgTimer)
      observer.disconnect()
      gitToggle.remove()
      gitPanel.remove()
      gitCtxMenu.remove()
      gitCreateBox.remove()
      msg.remove()
      document.getElementById(STYLE_ID)?.remove()
    }
  },
}
