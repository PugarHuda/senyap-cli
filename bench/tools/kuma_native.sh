#!/bin/bash
# usage: kuma_native.sh <sha>  -> fresh uptime-kuma (no Docker) on :3011 (:3001 is held by a stale Docker container from an earlier run), admin qb, paused monitor "QB Self"
# foreground server; launch with run_in_background. Seed with: (cd uptime-kuma && node ../tools/kuma-img/seed.js)
set -e
Q="/c/Hackathons/KaneCLI Online Hackathon/quietbench"; cd "$Q/uptime-kuma"
git checkout -q -f "$1"   # pre->fix only changes server/server.js, so dist/ and node_modules are reused
[ -f dist/index.html ] || npx vite build --config ./config/vite.config.js >/dev/null
D="$Q/scratch/kuma-data-$1"; rm -rf "$D"; mkdir -p "$D"
DATA_DIR="$D/" exec node -r "$Q/tools/node26-shim.js" server/server.js --port=3011
