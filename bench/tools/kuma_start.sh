#!/bin/bash
# usage: kuma_start.sh pre|post  -> fresh uptime-kuma on :3001 with admin qb and paused monitor "QB Self"
docker rm -f qb-kuma >/dev/null 2>&1
T="/c/Hackathons/KaneCLI Online Hackathon/quietbench/tools/kuma-img"
CMD="node server/server.js"; [ "$1" = post ] && CMD="cp server/server.post.js server/server.js && node server/server.js"
MSYS_NO_PATHCONV=1 docker run -d --name qb-kuma -p 3001:3001 -v "C:/Hackathons/KaneCLI Online Hackathon/quietbench/tools/kuma-img/seed.js:/app/seed.js:ro" qb-kuma bash -c "$CMD" >/dev/null
for i in $(seq 60); do curl -s -o /dev/null localhost:3001 && break; sleep 1; done
docker exec qb-kuma node seed.js
docker exec qb-kuma grep -c "await bean.isActive()" server/server.js
