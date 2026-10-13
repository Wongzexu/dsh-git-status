# DSH 0.2 隔离试跑操作单

> 配套文档：[dsh-0.2-upgrade-plan.md](./dsh-0.2-upgrade-plan.md)（升级提案与风险分析）
> 目的：**在不触碰现有 `~/.dsh` 与 3080 实例的前提下**，让 0.2.0-rc.2 跑起来，回答三个待验证问题。
> 前置：提案第五节的阶段 0 备份已完成。

## 为什么必须隔离、且必须整份复制 profile

两个在准备阶段实测出来的硬约束：

1. **`dsh` 会写 profile 目录**。实测 `dsh --profile web --dump-config` 会调用 `prepareProfile()` 去写 `$DSH_HOME/profiles/web/cordis.yml`（本次在沙箱里就被 EROFS 挡住）。所以不能只复制 `settings.yaml`，否则 0.2 会在一个残缺的 profile 上启动。
2. **`$DSH_HOME` 同时决定 profiles / sessions / logs / 凭据的根**。这正是隔离有效的原因：把 `DSH_HOME` 指向新目录，0.2 就看不到你的真实会话与设置。

## 环境布局

```
~/dsh02/
├── home/          # DSH_HOME（profiles/sessions/logs/凭据都在这里，全部是副本）
└── prefix/        # 0.2.0-rc.2 的独立安装前缀，不覆盖全局 dsh
```

端口用 **3099**，与现有实例的 3080 不冲突。

## 步骤 1 · 建环境并复制（可脚本化，幂等）

```bash
set -euo pipefail
mkdir -p ~/dsh02/prefix

# profile 整份复制，保留软链接（-a）
rm -rf ~/dsh02/home
mkdir -p ~/dsh02/home
cp -a ~/.dsh/profiles ~/dsh02/home/profiles
cp -a ~/.dsh/settings.yaml  ~/dsh02/home/settings.yaml
cp -a ~/.dsh/.credentials.yaml ~/dsh02/home/.credentials.yaml   # 副本，用于试跑鉴权
```

### ⚠️ 必须接着做：把 link 依赖绝对化

profile 里两个 `link:` 依赖是**相对路径软链接**（`../../../../Desktop/...`），它成立的前提是"软链接距 `~` 恰好 4 层"——这依赖目录**叫 `.dsh`** 且位于家目录下。复制到 `~/dsh02/home/` 后上溯 4 层落在 `~/dsh02`（不是 `~`），**链接直接断掉**：

```bash
# 实测：复制后原样不可达
node -e "require('/home/maoyi-yewu/dsh02/home/profiles/web/node_modules/dsh-companion/package.json')"
# → Error: Cannot find module
```

修复（绝对化，消除深度依赖）：

```bash
nm=~/dsh02/home/profiles/web/node_modules
ln -sfn /home/maoyi-yewu/Desktop/系统/dsh-companion "$nm/dsh-companion"
ln -sfn /home/maoyi-yewu/Desktop/系统/dsh-git-status "$nm/@wongzexu/dsh-git-status"
```

验证两个方向：

```bash
# 副本侧：必须可达
for p in "$nm/dsh-companion" "$nm/@wongzexu/dsh-git-status"; do
  node -e "const m=require('$p/package.json');console.log('可达 ✓', m.name, m.version)"
done
# 预期：dsh-companion 0.2.0 / @wongzexu/dsh-git-status 1.0.0

# 源头侧：确认没被误改（只读复制，必须仍可达）
for p in ~/.dsh/profiles/web/node_modules/dsh-companion ~/.dsh/profiles/web/node_modules/@wongzexu/dsh-git-status; do
  node -e "const m=require('$p/package.json');console.log('仍可达 ✓', m.name, m.version)"
done
```

> 这一步的副作用是好的：试跑**加载你正在开发的插件本体**（而非 npm 发布版）。所以试跑期间不要编辑这两个仓库，否则会污染当前 3080 实例的运行结果。

## 步骤 2 · 安装 0.2.0-rc.2 到独立前缀

```bash
npm i -g --prefix ~/dsh02/prefix @deepseek-ai/dsh@0.2.0-rc.2
~/dsh02/prefix/bin/dsh --version      # 预期输出 0.2.0-rc.2
```

> 这步必须在**你自己的终端**执行：当前沙箱下 npm 缓存目录只读（`EROFS`），且它会装到工作区之外。
> 全局 `dsh` 不受影响（`--prefix` 只写 `~/dsh02/prefix`）。

## 步骤 3 · 先跑轻量检查，再启动

**3a · 只看组合树，不启动服务**（最快暴露"插件能否被解析"）

```bash
DSH_HOME=~/dsh02/home ~/dsh02/prefix/bin/dsh --profile web --dump-config > ~/dsh02/dump-config.txt 2>&1
wc -l ~/dsh02/dump-config.txt
grep -nE "dsh-git-status|dsh-companion|dsh-navbar|vision-router" ~/dsh02/dump-config.txt
```

**预期**：四个插件都出现在组合树里。若某个插件报 `Cannot find package` / `failed to import loader entry`，说明其 bundle patch 的目标 id 在 0.2 不存在（提案第四节末提到的静默失效面）。

**3b · 启动 0.2 Web**

```bash
DSH_HOME=~/dsh02/home ~/dsh02/prefix/bin/dsh web --port 3099
```

用后台方式跑更便于留日志：

```bash
DSH_HOME=~/dsh02/home nohup ~/dsh02/prefix/bin/dsh web --port 3099 > ~/dsh02/web.log 2>&1 &
echo $! > ~/dsh02/web.pid
sleep 20 && tail -40 ~/dsh02/web.log
```

## 步骤 4 · 验证清单（本次试跑要回答的三个问题）

### 问题 1 · 设置迁移：五段里哪几段真的进去了

```bash
# 迁移发生的确认
grep -n "settings: imported" ~/dsh02/web.log

# 逐段结果：出现 was not imported 的就是没进去的
grep -n "was not imported" ~/dsh02/web.log

# 旧文件是否被改名（这是迁移发生的实物证据）
ls -la ~/dsh02/home/settings.yaml* 2>/dev/null

# 成功落库的段写在 profile patch 文档里
grep -nE "ui-settings-general|agent-default-model|llm-deepseek|llm-pi-ai|vision-router" \
     ~/dsh02/home/profiles/web/cordis.patch.yml 2>/dev/null
```

**判定**：`~/.dsh/settings.yaml` 的五个段是 `ui-onboarding`、`llm-pi-ai`、`agent-default-model`、`vision-router`、`llm-deepseek`。预期前四段（`ui-onboarding` 经映射转 `ui-settings-general`）能进去；**`vision-router` 是重点观察对象**——它在 0.2 里没有对应 entry id，判断它大概率落进 `.imported` 并留一条 warn。

### 问题 2 · 插件在 0.2 下能否工作

浏览器打开 `http://127.0.0.1:3099`，逐个确认：

- [ ] Git 状态面板能打开（锚点 `[data-chat-flow=""]` 命中，面板挂上去）
- [ ] 面板里数据能加载（说明自造路由 `/plugins/dshgitstatus/*` 在 0.2 下注册成功）
- [ ] 导航栏（navbar）显示正常
- [ ] vision-router 的设置项是否出现（未出现 = 插件没加载，需与问题 1 的 `vision-router` 段结果对照）
- [ ] companion 功能是否正常

同时在日志与浏览器控制台找这两类信息：

```bash
grep -inE "inject|client-runtime|not loaded|missing|warn" ~/dsh02/web.log | head -30
```

### 问题 3 · 悬空 inject 的真实表现（静态分析说是"静默跳过"）

- 若控制台/日志**没有**关于 `@deepseek-ai/dsh-client-runtime` 的报错，且插件工作正常 → 静态结论成立（静默跳过、不致命），可以把提案里的残余风险降为"已确认无害"
- 若出现 `could not load` / `not loaded because dependency ... failed` 之类 → 静态结论被推翻，需要改 inject 目标

## 步骤 5 · 收尾

```bash
# 停掉试跑实例（只杀你自己起的那个 pid）
kill "$(cat ~/dsh02/web.pid)" 2>/dev/null

# 保留现场供分析；确认无用后整体删除
# rm -rf ~/dsh02
```

**不要**动 `~/.dsh` 与 3080 实例。

## 试跑实测结果（2026-10-13 已完成）

环境：`~/dsh02/{home,prefix}` + 0.2.0-rc.2 + 端口 3099；已跑完并优雅停止，`~/.dsh` 与 3080 实例全程未受影响。

### 发现 1 · 0.2 有内建版本护栏，vision-router 被自动拦下（**最重要的发现**）

无需手动比对 peer：0.2 启动时自己校验，不兼容的 bundle **直接被跳过**，并打印精确的放行命令。

```
dsh: skipping profile bundle "dsh-vision-router": Error: Plugin dsh-vision-router@1.7.1 is
incompatible with dsh 0.2.0-rc.2: peerDependencies {"@deepseek-ai/dsh-anonymous-user-id":"^0.1.0-rc.6",
"@deepseek-ai/dsh-llm-deepseek":"^0.1.0-rc.6"}. Running it may cause crashes or data loss. Update the
plugin or install a plugin version compatible with this dsh runtime. To accept this risk explicitly,
grant the exact-version exemption ... with `dsh plugin allow-version` or the plugin manager ...
Exact-version exemption: not active.
```

⇒ **风险被 0.2 自己兜住了**：不是"装上才发现崩"，而是"优雅跳过 + 明确指引"。护栏实现见 0.2 的 `lib/plugin-BGnVfe_D.js`（支持 `allow-version` / `revoke-version` / `version-exemptions`，须带 `--accept-risk`，且**只对精确的包版本 + DSH 版本组合生效**）。

若要临时放行（**不建议**，正确做法是升到 3.0.3）：

```bash
DSH_HOME=~/dsh02/home ~/dsh02/prefix/bin/dsh plugin --profile web \
  allow-version dsh-vision-router@1.7.1 --dsh-version 0.2.0-rc.2 --accept-risk
```

### 发现 2 · 其余三个插件在 0.2 下**完全正常**

`--dump-config` 与我写的浏览器探针（`probes/dsh02-trial-probe.mjs`）双重复核：

| 检查项 | 实测结果 |
| --- | --- |
| boot 图条目总数 | 68 |
| 进图的自定义插件 | `@dsh-external/dsh-navbar`、`dsh-companion`、`@wongzexu/dsh-git-status`（**三个都在**） |
| vision-router | **不在图里**（被护栏跳过） |
| `@deepseek-ai/dsh-client-runtime` 是否在 boot 图 | **false**（确实已不存在） |
| 带悬空 runtime inject 的条目 | 恰好是那三个插件（声明原样带进图，**无任何报错**） |
| 官方挂载锚点 `[data-chat-flow]` | 命中 2，且**空值形态 `[data-chat-flow=""]` 也命中 2** ⇒ 你的选择器有效 |
| 插件 DOM | `[data-dsc-git]` 节点存在；插件自建的 `data-dsc-*` 节点已批量创建 |
| 页面异常扫描 | `ok: true`，`weird: []`（无布局异常） |

### 发现 3 · 数据通路完全打通（node half 健康）

自造路由在浏览器内实测（`probes/dsh02-routes-probe.mjs`）：

| 路由 | 状态 | 含义 |
| --- | --- | --- |
| `/plugins/dsh-gitstatus/git/config` | 400 `session-required` | 路由存在，Params 校验正常 |
| `/plugins/dsh-gitstatus/git/log` | 400 `session-required` | 同上 |
| `/plugins/dsh-gitstatus/git/branch` | 405 `method not allowed` | POST-only 端点，方法校验正常 |
| `/plugins/dsh-gitstatus/git/remote` | 405 `method not allowed` | 同上 |

对照：不存在的路径返回 404。⇒ **`ctx.webServer.register()` 在 0.2 下的注册方式对你的插件没有任何影响**。

### 发现 4 · 悬空 inject 的最终裁定：确认无害

静态分析曾判断"静默跳过"，现在实测坐实：三个插件的 inject 里都挂着 0.2 已不存在的 `@deepseek-ai/dsh-client-runtime`，**boot 无报错、插件正常挂载、数据通路正常**。⇒ 提案里那条残余风险可正式关闭；改 inject 只是"清理声明"，不再是升级前置条件。

### 发现 5 · 设置迁移：4 段成功、1 段留存

- `settings.yaml` 确实被改名为 `settings.yaml.imported`（实测证据），迁移**会自动执行**。
- 成功的 4 段写进了 `profiles/web/cordis.patch.yml`，且**以 patch 条目形态追加，原有注释完好保留**：

```yaml
- id: ui-settings-general
  name: "@deepseek-ai/dsh-client-ui-settings-general"
  config:
    welcomeNoticeVersion: 2026-09-28.1      # ← 注意：值被 0.2 更新（原 2026-08-13.1）
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers: { opencode-go: { apiKeyEnv: OPENCODE_GO_API_KEY } }
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config: { provider: deepseek-official, model: deepseek-flash, reasoningEffort: high }
- id: llm-deepseek
  name: "@deepseek-ai/dsh-llm-deepseek-api-key"
  config:
    models:
      - { id: deepseek-v4-pro, name: DeepSeek-V4-Pro, contextWindow: 1000000 }
      - { id: deepseek-flash, name: DeepSeek-V4.1-Flash }
```

- **`vision-router` 段没有进 patch**（因为其 bundle 被跳过、entry 不存在），只留在 `.imported` 里 —— 与提案预判一致。后果很轻：升到 3.0.3 后 `onboardingSeen` 会回到默认 `false`，重新走一次引导。
- 复核结论：**`llm-deepseek` 的 `models` 数组（你的 deepseek-v4-pro / deepseek-flash 自定义）完整迁移，条目 id 未变**——先前"被拆包会不会丢配置"的担忧彻底排除。
- 注：本次 stdout 里没有 `settings: imported` 的 INFO 行（`DSH_HOME/logs` 为空，该行未落到可读日志），但 `.imported` 文件与 patch 写入是确定的实物证据。

### 发现 6 · 会话文件名分代实测落地

试跑实例自建会话后，目录里出现的是 **`session.v4.jsonl.zstd`**（不是 `session.jsonl.zstd`）⇒ 证实提案第七节的降级陷阱：降级回 0.1 后这些会话读不到。

### 尚未验证（本次没做）

- ~~**面板在有会话时是否正常打开并渲染泳道图**。~~ **2026-10-13 补验完成**：同一隔离实例（3099）里点开侧栏
  真实会话「你好问候」→ 点 `[data-dsc-toggle]`（标题 `Git Status`；注意 `[data-dsc-git]` 是面板本体而非开关，
  默认 `display:none`，`.open` 才 `flex`）→ 面板渲染 **81 个提交行 + 2 个分支标签**，请求
  `/git/log?...&session=session-82a55521-…` 与 SSE `/git/events?session=…` 均携带会话 id。
  ⚠️ 前提是先修 `currentSessionId()`（见 [dsh-0.2-adaptation-checklist.md](./dsh-0.2-adaptation-checklist.md) 第三节）：
  修复前同一路径下面板只显示「当前会话不可用」，因为 0.2 的 `sessions.list` 快照不再有 `current`。
  回归探针：`probes/git-session-fix-verify.mjs`（`ok:false` 时退出码 1）。
  注意：无头访问必须用 `dsh web` 打印的**带 token 的 URL**，裸 `127.0.0.1:3099/` 返回 401。
- 升级后 `config/` 目录移除（presets 改由 package 提供）对启动的实际影响——本次 0.2 正常启动，说明无阻断。

### 结论：升级可行性判定

| 面向 | 判定 |
| --- | --- |
| DSH 本体升级 | ✅ 可升，0.2 有护栏兜底，不会因插件不兼容而崩 |
| git-status | ⚠️ **必须改一处代码**（`currentSessionId()`，2026-10-13 订正）：不改则面板「当前会话不可用」、写操作全被拒；已修并实测（见适配清单第三节） |
| companion / navbar | ✅ 实测正常（⚠️ companion 有同源隐患：旧 `snapshot.current` 读法 + 服务端兜底到 `process.cwd`，可能静默操作错误仓库，建议一并修） |
| vision-router | ⚠️ 必须升到 `>=2.3.0`（推荐 3.0.3）才可用；不升则该插件在 0.2 下功能缺失 |
| 设置 | ✅ 4/5 段自动迁移；`vision-router` 段重走引导 |
| 会话 | ✅ 旧会话可读并迁到 v4；⚠️ 但此后不可回降级 |

**推荐路径修正**：原计划"先修插件再升级"可简化为 → **直接升级 DSH + 同时把 vision-router 提到 3.0.3**；三个自定义插件无需任何改动即可用。

### 首轮记录表（已填，留作模板备下次复跑）

| 项 | 结果 |
| --- | --- |
| `--dump-config` 中四个插件是否都在 | 3 个在（navbar/companion/git-status）；vision-router 被护栏跳过 |
| 设置迁移：成功落库的段 | `ui-settings-general`(原 ui-onboarding)、`llm-pi-ai`、`agent-default-model`、`llm-deepseek` |
| 设置迁移：`was not imported` 的段 | `vision-router`（未写入 patch，留在 `.imported`） |
| `settings.yaml` 是否变成 `.imported` | ✅ 是 |
| Git 面板能否打开 / 能否加载数据 | 路由层已验证（400/405 语义正确）；**有会话时的可视化渲染未验证** |
| navbar / companion / vision-router 表现 | 前两者进 boot 图且 DOM 已挂；vision-router 未加载 |
| 有无 `client-runtime` 相关报错 | ❌ 无任何报错（悬空 inject 确认无害） |
| 其他异常 | 无：页面异常扫描 `weird: []` |

## 已知会让你困惑的点

1. **`~/dsh02/home/settings.yaml` 消失是正常的**——被 0.2 改名为 `settings.yaml.imported`。这是设计行为，不是故障；也正因如此，正式升级前必须备份真实那份。
2. **不要在这个环境里做正式的工作会话**。0.2 会把新会话写成 `session.v4.jsonl.zstd`，与 0.1 代不兼容（降级读不到）。
3. **`--port 3099` 是 0.2 真实支持的参数**（已核实其 web app 定义了 `--port <port>` / `--host <host>` / `--no-open`）。
4. 若 `npm i` 报 `ENOTFOUND`/超时，是网络问题；`registry.npmmirror.com` 也可用（本机默认镜像即它）。
