<div align="center">

# @wongzexu/dsh-git-status

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com) [![npm](https://img.shields.io/npm/v/@wongzexu/dsh-git-status?color=cb3837&label=npm)](https://www.npmjs.com/package/@wongzexu/dsh-git-status) [![dshfind](https://dshfind.com/api/badge/Wongzexu/dsh-git-status?lang=en)](https://dshfind.com/zh/plugins/Wongzexu/dsh-git-status)

**English** · [**简体中文**](README.md)

A standalone Git status (Git Graph) plugin for DSH: a **Git status drawer** docked to the right edge of the DSH web UI — commit DAG lane graph + uncommitted changes/stash + inline detail diffs + branch operations.

🔖 **v0.5.3** · 🧩 pure front-end self-rendered DOM (greeter mode, zero React, zero build chain) · 🛠 read-only/write Node half · 📜 MIT · 📦 npm `@wongzexu/dsh-git-status`

</div>

## Features

- **Drawer UX**: the drawer is **draggable** with its position **remembered**; a floating toggle button sits at the panel's top-right corner (overlaps the corner, follows drags, and stays floating at that spot to reopen after closing); a one-time first-use hint bubble (localStorage)
- **Commit DAG lane graph**: first-parent chains as lines, greedy leftmost column assignment, lane reuse, merge-commit connectors; SVG grid rendering (shadow + dual-color paths, elbow transitions, right-edge gradient fade, bold HEAD dot)
- **Inline refs badges**: H (red, detached HEAD) / branches (gold) / remotes (blue) / tags (green); the currently checked-out branch pill is highlighted in bright gold (denser background + gold inset border + bold, hover tooltip "current"); a local branch and its same-named remote are merged into one pill: `⎇ main [gitee]`; with ≥2 same-named remotes the sub-badges collapse into a count badge `⎇ main [2]` (hovering anywhere on the pill shows the full remote ref list, right-click picks a remote first); remote HEAD symbolic refs (`gitee/HEAD`) are filtered by default
- **Uncommitted changes virtual row**: when the worktree has changes, a virtual row is inserted at the top of the graph (hollow circle + gray dashed line to HEAD), showing staged/unstaged counts; click to expand details grouped by "Changes / Staged Changes" (VS Code semantics: partially staged files appear in both groups, untracked files carry a badge)
- **Staging and committing**: right-click the uncommitted changes row to "Stage all changes" (`git add -A`), stash changes, "Discard all uncommitted changes" (`git reset --hard HEAD` + `git clean -fd`; includes untracked files, keeps ignored files; red confirmation dialog, irreversible), commit staged content, or amend the previous commit; normal commits include staged content only, and multiline messages submit with `Ctrl+Enter` (`Cmd+Enter` on macOS)
- **Stash display**: `git reflog refs/stash` rows are inserted into the graph (double circle + `stash@{n}` badge); expanding shows details (explicit two-tree diff of the base + untracked third-parent snapshot appended)
- **Inline expandable details**: click a commit row to expand commit message + changed files (+/- line counts) + per-file diffs (256 KB truncation); the detail box height adapts to content (≤340px) and opening a patch does not shift the graph
- **Branch operations**:
  - Right-click a local branch badge: switch to x / merge x into current… / rename x… / delete x… / force delete x… (second confirmation when unmerged)
  - "Merge x into current…" opens a secondary confirmation dialog with three merge modes:
    **Merge commit (default)** (fast-forward when possible, otherwise a merge commit) / **NoFF (no fast-forward)**
    (`--no-ff`, always creates a merge commit) / **Squash merge** (flattened into one commit, no merge commit);
    Squash offers a commit-message input with a "use fixed text" checkbox (checked by default; unchecked requires a message);
    on conflict the merge bar takes over (squash has no `MERGE_HEAD` — abort goes through `reset --hard`, continue finishes via `commit`)
  - Right-click a remote branch badge: "create local branch x and check out" — if a same-named local branch already exists, a three-choice dialog appears: check out the existing branch and fast-forward to the remote's latest (`git merge --ff-only`; refused when diverged) / create a local branch with a different name (with upstream tracking) / cancel (mirroring the upstream checkoutBranchAction); (a collapsed count badge asks you to pick a remote first); right-click a tag badge: "create branch at x and check out"
  - Header "＋ New branch" dialog: instant client-side validation + authoritative server-side `check-ref-format` validation
  - Switch guard: unresolved conflicts / in-progress operations (`MERGE_HEAD` etc.) / target branch checked out in another worktree → stable error codes; with **tracked** uncommitted changes a "switch anyway" confirmation dialog appears (confirming proceeds with the `force` bypass; untracked-only changes do not block)
  - After a merge conflict: header badge + merge bar offer "abort merge / continue merge" (resolve conflicts, `git add`, then continue); squash-merge conflicts are handled by the same merge bar (badge shows "squash merge in progress")
- **Fetch from remotes**: header "⇣" button (shown only when the repo has remotes), one-click `git fetch --all` (mirrors the upstream Git Graph toolbar Fetch from Remote(s) form: no dialog, prune off by default); the graph refreshes immediately on success or failure (multiple remotes may partially succeed); categorized failure hints (network/auth errors, remote missing, remote repo missing or unreachable)
- **Conflict/in-progress badges**: the header shows "N unresolved conflicts" and "merge/rebase in progress" in real time (`MERGE_HEAD` / `SQUASH_MSG` (squash merge) etc.)
- **SSE live refresh**: `/git/events` subscription (2s server-side state-key comparison + change push + 15s heartbeat); the graph refreshes instantly when another terminal checks out or commits; a 10s poll remains as a disconnect fallback
- **Scope switching**: all branches / current branch; auto refresh + manual refresh; non-git-repo hint
- **Settings page**: default behaviors (auto-checkout after creating a branch / include untracked files when stashing / default merge mode, unified dropdowns) and display options (uncommitted changes, HEAD badge, commit author, commit time — each independently toggleable)

## Installation

### Requirements

- DSH (DeepSeek Harness) web installed and running (`dsh web`)
- `git` CLI installed (the plugin runs all operations through the system `git`)
- Zero third-party dependencies: no React, no build artifacts, zero npm packages in the Node half

### Install the plugin

**Option 1: install from npm (recommended, release)**

```sh
dsh plugin --profile web add @wongzexu/dsh-git-status
```

**Option 2: install from GitHub (source)**

```sh
dsh plugin --profile web add github:Wongzexu/dsh-git-status
```

**Option 3: install from a local directory (development / personal use)**

```sh
dsh plugin --profile web add /path/to/dsh-git-status
```

Replace `/path/to/dsh-git-status` with the actual plugin directory path (e.g. this repository root).

> ⚠️ Note: there is a *different*, unscoped package named `dsh-git-status` on npm (a React implementation by another author, unrelated to this plugin); make sure you install **`@wongzexu/dsh-git-status`**.

### Enable

1. Restart the DSH web service for the plugin to load;
2. Open the DSH web page → Settings → "Plugins" panel, confirm `@wongzexu/dsh-git-status` is enabled (can be disabled/enabled anytime).

### Usage

> 📖 Full usage guide (bilingual, text version): [docs/USAGE.md#wongzexudsh-git-status-usage-guide](docs/USAGE.md#wongzexudsh-git-status-usage-guide) — UI overview, reading the graph, branch operations, conflict handling, and fetching from remotes.

1. Enter any chat view;
2. Click the **branch icon** button outside the panel's top-right corner — the "Git status" drawer expands (draggable, position remembered; the button stays glued to the panel's top-right corner, and floats at that spot to reopen once the panel is closed; a one-time hint guides first use);
3. The drawer header toggles "All branches / Current branch" and manual refresh (↻); while open, SSE live refresh applies (10s poll fallback on disconnect);
4. Click a commit row to expand details (commit message / changed files / per-file diffs); click a file row to view that file's patch;
5. Right-click branch badges: local — "switch to x / merge x / rename x / delete x (force delete)"; remote — "create local branch x and check out" (a same-named local branch triggers a three-choice dialog: check out the existing branch & fast-forward / create with a different name / cancel);
6. Right-click a tag badge: "create branch at x and check out"; header "＋ New branch": type a name to create and check out (invalid names are rejected instantly);
7. Header badges show unresolved conflicts / in-progress operations; on merge conflict the merge bar offers "abort merge / continue merge"; "Merge x into current…" opens a confirmation dialog first — merge commit (default) / NoFF (no fast-forward) / squash merge (custom message or fixed-text checkbox);
8. When the repo has remotes configured, the header "⇣" button fetches all remotes at once (`git fetch --all`, prune off by default), then the graph refreshes immediately.

> Tip: when the current session's workspace is not a git repo, the drawer shows a hint; switch to a session whose workspace is a git repo.

### Uninstall

```sh
dsh plugin --profile web remove @wongzexu/dsh-git-status
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
│   ├── index.mjs         # Node half: git log/show/branch/fetch/push/remote/stash/stage/discard/commit/events routes (pure functions exported at the end for tests)
│   └── client.js         # client bundle (build artifact, __ModuleLoader__ contract)
├── src/client/index.js   # client source (hand-written CJS, single module)
├── scripts/build-client.js  # zero-dependency build script (pure Node)
└── tests/
    ├── fixtures/repo.mjs     # repo fixture helper (mkdtemp real git repos, t.after cleanup)
    ├── git-log.test.mjs      # decoration parsing/uncommitted classification/virtual row assembly/stash/show/conflict status
    ├── git-branch.test.mjs   # branch name validation/guards/failure classification/CRUD/merge/write routes (incl. CSRF)
    ├── git-fetch.test.mjs    # remote listing/name validation/fetch failure classification/real fetch (file:// bare repo, incl. prune)/write routes (incl. CSRF)
    ├── git-stage.test.mjs    # git add -A semantics, route validation, and session isolation
    ├── git-commit.test.mjs   # staged commit/amend, failure classification, routes, and session isolation
    └── git-events.test.mjs   # SSE subscription: initial push/change detection/heartbeat/disconnect cleanup
```

- **Data channel**: the Node half registers `/plugins/dsh-gitstatus/*` routes (webServer); the client subscribes to SSE `/git/events` for live refresh with a 10s poll fallback
- **git execution**: spawns the system `git` (`-C workspace --no-pager -c color.ui=false`, `GIT_OPTIONAL_LOCKS=0`, `LC_ALL=C` for stable English output, `GIT_EDITOR=true` to disable editors, 15s timeout hard kill; fetch relaxed to 120s)
- **Layout anchor**: official DOM attributes (`data-chat-flow`), no dependency on React internals
- **Security**: routes are rooted at the session's authoritative workspace (request must carry `session=` and only `ctx.sessions.get(id).header.cwd` is trusted; missing/invalid sessions are rejected instead of falling back to another project), rejecting `..` components and out-of-bounds paths; read-only command whitelist; write routes (branch operations + fetch + stage + commit) are POST with enforced `application/json` content-type (CSRF protection), authoritative branch-name validation + argv arrays (no shell) + pre-switch guards; fetch timeout relaxed (120s for slow networks and large repos)

## Development

```sh
node scripts/build-client.js   # rebuild the client bundle (lib/client.js) after editing src/client/index.js
npm test                       # node:test suite (233 cases, real git fixtures, zero dependencies)
```

Edit the Node half directly in `lib/index.mjs` (no build step); run `npm test` after changes.
Test coverage: decoration string classification, uncommitted XY status classification, UNCOMMITTED/stash virtual row assembly, stash third parent, show details, conflict/in-progress status, branch name validation, switch guards (conflict/in-progress/other worktree/**uncommitted confirmation**: staged/unstaged/untracked counts, untracked-only pass, force bypass with changes), full CRUD/merge paths (incl. merge-conflict abort/continue), failure stderr classification, write-route CSRF (content-type enforcement) and full chains, discard-all action (staged/unstaged/untracked/ignored-preserved/unborn head, route validation + session scoping), SSE subscription (initial push/change detection/heartbeat/disconnect cleanup), fetch full chains (--all/single remote/prune semantics/failure classification/CSRF, real fetch from file:// bare repos).

After rebuilding the client, **refresh the browser page** to see changes (no web service restart needed); after editing the Node half, **restart the web service**.

### Publishing a new version

1. Bump the version and changelog in README / README_EN;
2. `npm version patch` (or minor / major) — syncs package.json and creates a `vX.Y.Z` tag;
3. `git push --follow-tags` — push code and the tag;
4. On GitHub: **Releases** → Draft a new release (pick the tag just pushed) → Publish release;
5. `.github/workflows/publish.yml` runs automatically: `npm ci` → `npm run build` → `npm publish`
   (GitHub Actions **Trusted Publishing** (OIDC), tokenless; authorize the repository as a
   Trusted Publisher on npmjs.org once before the first release).

## Roadmap

- Optimize git status change push: fs.watch detection (currently 2s polling with state-key comparison)
- Release form: npm live (`@wongzexu/dsh-git-status`); GitHub Release auto-publishes to npm via Actions

## License

MIT.

Implementation references: [mhutchie/vscode-git-graph](https://github.com/mhutchie/vscode-git-graph) (lane layout/rendering + Fetch from Remote(s) button form, MIT), [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)'s dsh-git-graph (branch operation guard model).
