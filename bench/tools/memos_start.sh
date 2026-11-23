#!/bin/bash
# usage: memos_start.sh <sha>  -> fresh memos (no Docker) on :8081 from tools/bin/memos-<sha>.exe; foreground (run_in_background)
# Older builds need --mode prod; 2026 builds dropped the flag (prod is the default).
Q="/c/Hackathons/KaneCLI Online Hackathon/quietbench"; D="$Q/scratch/memos-data-$1"; B="$Q/tools/bin/memos-$1.exe"
rm -rf "$D"; mkdir -p "$D"
M=""; "$B" --help 2>&1 | grep -q -- "--mode" && M="--mode prod"
exec "$B" $M --port 8081 --data "$D"
