#!/bin/bash
# usage: tududi_native.sh <sha>  -> fresh tududi (no Docker) on :3002, user qb@example.com / QuietBench123!
# Runs in the foreground; launch with run_in_background. Logs to scratch/tududi-<sha>.log
set -e
Q="/c/Hackathons/KaneCLI Online Hackathon/quietbench"; T="$Q/tududi"; S=$1
cd "$T"
OLD=$(git rev-parse HEAD:package-lock.json); git checkout -q -f "$S"
[ "$OLD" = "$(git rev-parse HEAD:package-lock.json)" ] && [ -d node_modules ] || PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PUPPETEER_SKIP_DOWNLOAD=1 HUSKY=0 npm ci --no-audit --no-fund
NODE_ENV=production npx webpack --config webpack.config.js >/dev/null
rm -rf backend/dist; cp -r dist backend/dist
D="$Q/scratch/tududi-db-$S"; rm -rf "$D"; mkdir -p "$D"
cd backend
export NODE_ENV=production PORT=3002 DB_FILE="$D/db.sqlite3" COOKIE_SECURE=false DISABLE_HSTS=true \
  TUDUDI_USER_EMAIL=qb@example.com TUDUDI_USER_PASSWORD='QuietBench123!' TUDUDI_SESSION_SECRET=qbsecretqbsecretqbsecretqbsecret01
node scripts/db-init.js
npx sequelize-cli db:migrate --config config/database.js || true
node scripts/user-create.js qb@example.com 'QuietBench123!' true
exec node app.js
