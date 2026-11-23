#!/bin/bash
# usage: tududi_start.sh <sha>  -> fresh tududi on :3002, user qb@example.com / QuietBench123!
docker rm -f qb-tududi >/dev/null 2>&1
docker run -d --name qb-tududi -p 3002:3002 -e TUDUDI_USER_EMAIL=qb@example.com -e TUDUDI_USER_PASSWORD='QuietBench123!' -e TUDUDI_SESSION_SECRET=qbsecretqbsecretqbsecretqbsecret01 qb-tududi:$1 >/dev/null
for i in $(seq 90); do curl -sf -o /dev/null localhost:3002/api/health && break; sleep 1; done
curl -s localhost:3002/api/health; echo
