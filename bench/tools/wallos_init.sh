#!/bin/bash
# migrate, register qb, seed "QB Netflix" on the Wallos at :8000
for i in $(seq 30); do curl -s -o /dev/null localhost:8000/ && break; sleep 1; done
curl -s localhost:8000/endpoints/db/migrate.php | tail -1; echo
curl -s -o /dev/null -d "username=qb&email=qb@example.com&password=QuietBench123!&confirm_password=QuietBench123!&main_currency=1&language=en" localhost:8000/registration.php
bash "/c/Hackathons/KaneCLI Online Hackathon/quietbench/tools/wallos_seed.sh"
