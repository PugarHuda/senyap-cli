#!/bin/bash
# usage: run_a.sh <bug> <url> <flow>   -> plain Kane gate, output in ../scratch/<bug>-A/
Q="/c/Hackathons/KaneCLI Online Hackathon/quietbench"; T0=$(date -u +%Y-%m-%dT%H:%M:%SZ); B=$1; URL=$2; FLOW=$3
D="/c/Hackathons/KaneCLI Online Hackathon/quietbench/scratch/$B-A"; rm -rf "$D"; mkdir -p "$D"; cd "$D"
timeout -s KILL 360 node "C:\Users\pc\AppData\Roaming\npm\node_modules\@testmuai\kane-cli\bin\kane-cli.cjs" run "$FLOW. Then verify that it worked." --url "$URL" --agent --headless --bug-detection continue --timeout 300 > kane.ndjson 2> kane.err
grep '"type":"run_end"' kane.ndjson | tail -1 > run_end.json
node -e "const e=require('./run_end.json');console.log(JSON.stringify({status:e.status,result_code:e.result_code,reason_code:e.reason_code,test_url:e.test_url,credits:e.credits_consumed,summary:e.summary}))" | tee A.json
CD=$(node "$Q/tools/credits.js" "$FLOW" $T0 $(date -u +%Y-%m-%dT%H:%M:%SZ) A | cut -d" " -f1); echo "credits (Kane sessions): $CD"; echo $CD > credits.txt
