#!/bin/bash
# fresh Wallos: empty db, migrate, register qb, seed one subscription
docker rm -f qb-wallos >/dev/null 2>&1
cd "/c/Hackathons/KaneCLI Online Hackathon/quietbench/Wallos"; cp db/wallos.empty.db db/wallos.db
MSYS_NO_PATHCONV=1 docker run -d --name qb-wallos -p 8000:8000 -v "C:/Hackathons/KaneCLI Online Hackathon/quietbench/Wallos:/app" -v "C:/Hackathons/KaneCLI Online Hackathon/quietbench/tools/wallos-img/prepend.php:/prepend.php:ro" -w /app qb-wallos-php php -d auto_prepend_file=/prepend.php -S 0.0.0.0:8000 >/dev/null
sleep 2; curl -s localhost:8000/endpoints/db/migrate.php | tail -1; echo
curl -s -o /dev/null -d "username=qb&email=qb@example.com&password=QuietBench123!&confirm_password=QuietBench123!&main_currency=1&language=en" localhost:8000/registration.php
bash "/c/Hackathons/KaneCLI Online Hackathon/quietbench/tools/wallos_seed.sh"
