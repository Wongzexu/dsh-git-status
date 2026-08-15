<div align="center">

# dsh-git-status

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

**English** · [**简体中文**](README.md)

A standalone Git status (Git Graph) plugin for DSH: a **Git status drawer** docked to the right edge of the DSH web UI — commit DAG lane graph + uncommitted changes/stash + inline detail diffs + branch operations.

🔖 **v0.4.0** · 🧩 pure front-end self-rendered DOM (greeter mode, zero React, zero build chain) · 🛠 read-only/write Node half · 📜 MIT

</div>

## Features

- **Drawer UX**: the drawer is **draggable** with its position **remembered**; a floating toggle button sits at the panel's top-right corner (overlaps the corner, follows drags, and stays floating at that spot to reopen after closing); a one-time first-use hint bubble (localStorage)
- **Commit DAG lane graph**: first-parent chains as lines, greedy leftmost column assignment, lane reuse, merge-commit connectors; SVG grid rendering (shadow + dual-color paths, elbow transitions, right-edge gradient fade, bold HEAD dot)
- **Inline refs badges**: HEAD (red) / branches (gold) / remotes (blue) / tags (green); the currently checked-out branch pill is highlighted in bright gold (denser background + gold inset border + bold, hover tooltip "current"); a local branch and its same-named remote are merged into one pill: `⎇ main [gitee]` (multiple remotes nest in order); remote HEAD symbolic refs (`gitee/HEAD`) are filtered by default
- **Uncommitted changes virtual row**: when the worktree has changes, a virtual row is inserted at the top of the graph (hollow circle + gray dashed line to HEAD), showing staged/unstaged counts; click to expand details grouped by "Changes / Staged Changes" (VS Code semantics: partially staged files appear in both groups, untracked files carry a badge)
- **Stash display**: `git reflog refs/stash` rows are inserted into the graph (double circle + `stash@{n}` badge); expanding shows details (explicit two-tree diff of the base + untracked third-parent snapshot appended)
- **Inline expandable details**: click a commit row to expand commit message + changed files (+/- line counts) + per-file diffs (256 KB truncation); the detail box height adapts to content (≤340px) and opening a patch does not shift the graph
- **Branch operations**:
  - Right-click a local branch badge: switch to x / merge x into current / rename x / delete x / force delete x (second confirmation when unmerged)
  - Right-click a remote branch badge: "create local branch x and check out"; right-click a tag badge: "create branch at x and check out"
  - Header "＋ New branch" dialog: instant client-side validation + authoritative server-side `check-ref-format` validation
  - Switch guard: unresolved conflicts / in-progress operations (`MERGE_HEAD` etc.) / target branch checked out in another worktree → stable error codes; with **tracked** uncommitted changes a "switch anyway" confirmation dialog appears (confirming proceeds with the `force` bypass; untracked-only changes do not block)
  - After a merge conflict: header badge + merge bar offer "abort merge / continue merge" (resolve conflicts, `git add`, then continue)
- **Fetch from remotes**: header "⇣" button (shown only when the repo has remotes), one-click `git fetch --all` (mirrors the upstream Git Graph toolbar Fetch from Remote(s) form: no dialog, prune off by default); the graph refreshes immediately on success or failure (multiple remotes may partially succeed); categorized failure hints (network/auth errors, remote missing, remote repo missing or unreachable)
- **Conflict/in-progress badges**: the header shows "N unresolved conflicts" and "merge/rebase in progress" in real time (`MERGE_HEAD` etc.)
- **SSE live refresh**: `/git/events` subscription (2s server-side state-key comparison + change push + 15s heartbeat); the graph refreshes instantly when another terminal checks out or commits; a 10s poll remains as a disconnect fallback
- **Scope switching**: all branches / current branch; auto refresh + manual refresh; non-git-repo hint

## Installation

### Requirements

- DSH (DeepSeek Harness) web installed and running (`dsh web`)
- `git` CLI installed (the plugin runs all operations through the system `git`)
- Zero third-party dependencies: no React, no build artifacts, zero npm packages in the Node half

### Install the plugin

**Option 1: install from GitHub (release)**

```sh
dsh plugin --profile web add github:Wongzexu/dsh-git-status
```

**Option 2: install from a local directory (development / personal use)**

```sh
dsh plugin --profile web add /path/to/dsh-git-status
```

Replace `/path/to/dsh-git-status` with the actual plugin directory path (e.g. this repository root).

### Enable

1. Restart the DSH web service for the plugin to load;
2. Open the DSH web page → Settings → "Plugins" panel, confirm `dsh-git-status` is enabled (can be disabled/enabled anytime).

### Usage

> 📖 Full usage guide (bilingual, text version): [docs/USAGE.md#dsh-git-status-usage-guide](docs/USAGE.md#dsh-git-status-usage-guide) — UI overview, reading the graph, branch operations, conflict handling, and fetching from remotes.

1. Enter any chat view;
2. Click the **branch icon** button outside the panel's top-right corner — the "Git status" drawer expands (draggable, position remembered; the button stays glued to the panel's top-right corner, and floats at that spot to reopen once the panel is closed; a one-time hint guides first use);
3. The drawer header toggles "All branches / Current branch" and manual refresh (↻); while open, SSE live refresh applies (10s poll fallback on disconnect);
4. Click a commit row to expand details (commit message / changed files / per-file diffs); click a file row to view that file's patch;
5. Right-click branch badges: local — "switch to x / merge x / rename x / delete x (force delete)"; remote — "create local branch x and check out";
6. Right-click a tag badge: "create branch at x and check out"; header "＋ New branch": type a name to create and check out (invalid names are rejected instantly);
7. Header badges show unresolved conflicts / in-progress operations; on merge conflict the merge bar offers "abort merge / continue merge";
8. When the repo has remotes configured, the header "⇣" button fetches all remotes at once (`git fetch --all`, prune off by default), then the graph refreshes immediately.

> Tip: when the current session's workspace is not a git repo, the drawer shows a hint; switch to a session whose workspace is a git repo.

### Uninstall

```sh
dsh plugin --profile web remove dsh-git-status
```

### FAQ

- **The drawer does not appear**: make sure you are in a chat view; the plugin is enabled in the "Plugins" panel; restart web right after a fresh install.
- **"The current workspace is not a git repository"**: the current session's working directory is not a git repo; switch to a session in a repo directory.

## Architecture

```
dsh-git-status/
├── package.json          # dsh.bundle.patch + dsh.client.inject + platform: web
├── cordis.patch.yml      # mounts the Node half
├── lib/
│   ├── index.mjs         # Node half: git log/show/branch/fetch/events routes (pure functions exported at the end for tests)
│   └── client.js         # client bundle (build artifact, __ModuleLoader__ contract)
├── src/client/index.js   # client source (hand-written CJS, single module)
├── scripts/build-client.js  # zero-dependency build script (pure Node)
└── tests/
    ├── fixtures/repo.mjs     # repo fixture helper (mkdtemp real git repos, t.after cleanup)
    ├── git-log.test.mjs      # decoration parsing/uncommitted classification/virtual row assembly/stash/show/conflict status
    ├── git-branch.test.mjs   # branch name validation/guards/failure classification/CRUD/merge/write routes (incl. CSRF)
    ├── git-fetch.test.mjs    # remote listing/name validation/fetch failure classification/real fetch (file:// bare repo, incl. prune)/write routes (incl. CSRF)
    └── git-events.test.mjs   # SSE subscription: initial push/change detection/heartbeat/disconnect cleanup
```

- **Data channel**: the Node half registers `/plugins/dsh-git-status/*` routes (webServer); the client subscribes to SSE `/git/events` for live refresh with a 10s poll fallback
- **git execution**: spawns the system `git` (`-C workspace --no-pager -c color.ui=false`, `GIT_OPTIONAL_LOCKS=0`, `LC_ALL=C` for stable English output, `GIT_EDITOR=true` to disable editors, 15s timeout hard kill; fetch relaxed to 120s)
- **Layout anchor**: official DOM attributes (`data-chat-flow`), no dependency on React internals
- **Security**: routes are rooted at the session's authoritative workspace (request carries `session=`, preferring `ctx.sessions.get(id).header.cwd`; falls back to registry/process cwd), rejecting `..` components and out-of-bounds paths; read-only command whitelist; write routes (branch operations + fetch) are POST with enforced `application/json` content-type (CSRF protection), authoritative branch-name validation + argv arrays (no shell) + pre-switch guards; fetch timeout relaxed (120s for slow networks and large repos)

## Development

```sh
node scripts/build-client.js   # rebuild the client bundle (lib/client.js) after editing src/client/index.js
npm test                       # node:test suite (92 cases, real git fixtures, zero dependencies)
```

Edit the Node half directly in `lib/index.mjs` (no build step); run `npm test` after changes.
Test coverage: decoration string classification, uncommitted XY status classification, UNCOMMITTED/stash virtual row assembly, stash third parent, show details, conflict/in-progress status, branch name validation, switch guards (conflict/in-progress/other worktree/**uncommitted confirmation**: staged/unstaged/untracked counts, untracked-only pass, force bypass with changes), full CRUD/merge paths (incl. merge-conflict abort/continue), failure stderr classification, write-route CSRF (content-type enforcement) and full chains, SSE subscription (initial push/change detection/heartbeat/disconnect cleanup), fetch full chains (--all/single remote/prune semantics/failure classification/CSRF, real fetch from file:// bare repos).

After rebuilding the client, **refresh the browser page** to see changes (no web service restart needed); after editing the Node half, **restart the web service**.

## Roadmap

- Optimize git status change push: fs.watch detection (currently 2s polling with state-key comparison)
- Release form: GitHub releases (tag/Release)

## License

MIT.

Implementation references: [mhutchie/vscode-git-graph](https://github.com/mhutchie/vscode-git-graph) (lane layout/rendering + Fetch from Remote(s) button form, MIT), [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)'s dsh-git-graph (branch operation guard model).
