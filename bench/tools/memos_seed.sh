#!/bin/bash
# usage: memos_seed.sh -> create user qb / QuietBench123! on the memos at :8081 (first user = host); no settings row is written
for i in $(seq 60); do curl -sf -o /dev/null localhost:8081/healthz && break; curl -s -o /dev/null localhost:8081/ && break; sleep 1; done
curl -s -X POST localhost:8081/api/v1/users -H 'Content-Type: application/json' -d '{"username":"qb","password":"QuietBench123!","role":"HOST"}'; echo
