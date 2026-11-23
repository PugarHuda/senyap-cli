#!/bin/bash
# usage: run_s.sh <bug> <pre|post> <url> <flow>  -> senyap hunt, report copied to results/<bug>-<phase>.json
T0=$(date -u +%Y-%m-%dT%H:%M:%SZ); B=$1; P=$2; URL=$3; FLOW=$4
Q="/c/Hackathons/KaneCLI Online Hackathon/quietbench"
D="$Q/scratch/$B-$P"; rm -rf "$D"; mkdir -p "$D"; cd "$D"
node "/c/Hackathons/KaneCLI Online Hackathon/senyap/bin/senyap.js" hunt --url "$URL" --flow "$FLOW" --json > hunt.out 2> hunt.err; echo "exit $?"
cp .senyap/report.json "$Q/results/$B-$P.json"
node -e "const r=require('./.senyap/report.json').results[0];console.log(JSON.stringify({status:r.status,result_code:r.kane.result_code,reason:r.kane.reason_code,family:r.kane.verdict&&r.kane.verdict.family,observe:r.observe&&[r.observe.status,r.observe.kane.result_code],confirm:r.confirm&&[r.confirm.status,r.confirm.kane.result_code],credits:r.credits??r.kane.credits,findings:r.findings.map(f=>(f.severity||'')+' '+f.kind+' '+(f.method||'')+' '+(f.url||'')+' '+(f.status||'')+' '+(f.detail||'').slice(0,120)),falseGreen:r.falseGreen,retried:!!r.retriedAfter}))"
CD=$(node "$Q/tools/credits.js" "$FLOW" $T0 $(date -u +%Y-%m-%dT%H:%M:%SZ) S | cut -d" " -f1); echo "credits (Kane sessions): $CD"; echo $CD > credits.txt
