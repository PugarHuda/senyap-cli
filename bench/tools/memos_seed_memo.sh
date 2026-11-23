#!/bin/bash
# usage: memos_seed_memo.sh -> sign in as qb on :8081 and create memo "- [ ] alpha / - [ ] beta" (memos5865)
T=$(curl -s -X POST localhost:8081/api/v1/auth/signin -H 'Content-Type: application/json' -d '{"passwordCredentials":{"username":"qb","password":"QuietBench123!"}}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))")
curl -s -X POST localhost:8081/api/v1/memos -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"content":"- [ ] alpha\n- [ ] beta","visibility":"PRIVATE"}'; echo
