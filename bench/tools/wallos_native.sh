#!/bin/bash
# usage: wallos_native.sh <sha> -> fresh Wallos on :8000 with portable PHP 8.2 (quietbench/php), no Docker. Foreground; run_in_background.
# After it is up: bash tools/wallos_init.sh
set -e
Q="/c/Hackathons/KaneCLI Online Hackathon/quietbench"; cd "$Q/Wallos"
git checkout -q -f "$1"; cp db/wallos.empty.db db/wallos.db
P="$Q/php"
exec "$P/php.exe" -d extension_dir="$P/ext" -d extension=sqlite3 -d extension=pdo_sqlite -d extension=intl -d extension=gd -d extension=zip -d extension=curl -d extension=mbstring -d extension=openssl \
  -d auto_prepend_file="$Q/tools/wallos-img/prepend-native.php" -S 127.0.0.1:8000
