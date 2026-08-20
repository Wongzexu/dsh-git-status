#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Git 分支清理脚本
# 用法: bash scripts/git-cleanup.sh
# 说明: 对齐最新 main → 删除旧本地分支 → 清理远程缓存 → GC
# ============================================================

REMOTE="${1:-gitee}"  # 默认 gitee，可传参如: bash scripts/git-cleanup.sh github

echo "==> 1. 切换到 main 并重置到 $REMOTE/main"
git checkout main
git fetch "$REMOTE"
git reset --hard "$REMOTE/main"

echo ""
echo "==> 2. 检测已合并到 main 的本地分支（可安全删除）"
for branch in $(git branch --merged main | grep -v "\* main" | sed 's/^[[:space:]]*//'); do
  read -p "    删除 '$branch' ? (Y/n) " yn
  if [[ -z "$yn" || "$yn" == "y" || "$yn" == "Y" ]]; then
    git branch -D "$branch" && echo "    ✅ 已删除 $branch"
  else
    echo "    ⏭ 跳过 $branch"
  fi
done

echo ""
echo "==> 3. 清理远程缓存（让 git branch -a 看不见已删的远程分支）"
git fetch --all --prune

echo ""
echo "==> 4. 预览未跟踪文件（确认无重要配置被误删）"
git clean -n

echo ""
echo "==> 5. 安全提醒"
echo "    确认无误后执行: git clean -fd  （删除未跟踪文件/目录）"

echo ""
echo "==> 6. 彻底清理本地失联的历史对象"
git reflog expire --expire=now --all
git gc --prune=now

echo ""
echo "✅ 清理完成"
