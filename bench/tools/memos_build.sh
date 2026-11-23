#!/bin/bash
# usage: memos_build.sh <sha> -> tools/bin/memos-<sha>.exe (frontend embedded)
set -e
Q="/c/Hackathons/KaneCLI Online Hackathon/quietbench"; S=$1; W="$Q/scratch/memos-wt-$S"
[ -f "$Q/tools/bin/memos-$S.exe" ] && { echo "have $S"; exit 0; }
mkdir -p "$Q/tools/bin"
[ -d "$W" ] || git -C "$Q/memos" worktree add -f --detach "$W" $S
cd "$W/web" && { [ -d node_modules/vite ] || pnpm install --frozen-lockfile >/dev/null 2>&1 || [ -d node_modules/vite ]; }
node node_modules/vite/bin/vite.js build --mode release --outDir=../server/router/frontend/dist --emptyOutDir >/dev/null
cd "$W"; M=./bin/memos/main.go; [ -f $M ] || M=./cmd/memos
go build -o "$Q/tools/bin/memos-$S.exe" $M
echo "built $S"
