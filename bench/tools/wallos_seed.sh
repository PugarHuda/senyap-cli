#!/bin/bash
# Log in as qb and add subscription "QB Netflix" via the app's own endpoint.
J=$(mktemp)
curl -s -c $J -b $J -o /dev/null -d "username=qb&password=QuietBench123!" localhost:8000/login.php
curl -s -c $J -b $J -X POST localhost:8000/endpoints/subscription/add.php \
  --data-urlencode "name=QB Netflix" -d "price=9.99&currency_id=1&frequency=1&cycle=3&next_payment=2026-12-15&payment_method_id=1&payer_user_id=1&category_id=1&notes=&url=&logo-url=&notify_days_before=-1"
echo
curl -s -b $J localhost:8000/ | grep -c "QB Netflix"
rm -f $J
