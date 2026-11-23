#!/bin/bash
# usage: linkding_start.sh <sha> -> fresh linkding (no Docker, dev settings so runserver serves static) on :9090,
# superuser qb / QuietBench123!, one bookmark tagged "qbtag". Foreground; launch with run_in_background.
set -e
Q="/c/Hackathons/KaneCLI Online Hackathon/quietbench"; cd "$Q/linkding"
git checkout -q -f "$1"   # pre->fix only changes a template, so the venv and the JS build are reused
rm -rf data; mkdir -p data
export LD_DISABLE_BACKGROUND_TASKS=True LD_DISABLE_URL_VALIDATION=True PYTHONUTF8=1
PY=.venv/Scripts/python.exe
$PY manage.py migrate -v0
DJANGO_SUPERUSER_PASSWORD='QuietBench123!' $PY manage.py createsuperuser --noinput --username qb --email qb@example.com
$PY manage.py shell -c "
from django.contrib.auth.models import User
from bookmarks.models import Bookmark, Tag; from django.utils import timezone as tz; n=tz.now()
u=User.objects.get(username='qb'); t=Tag.objects.create(name='qbtag', owner=u, date_added=n)
b=Bookmark.objects.create(url='https://example.com/qb', title='QB Example', owner=u, date_added=n, date_modified=n); b.tags.add(t); print('seeded', b.id)"
exec $PY manage.py runserver 127.0.0.1:9090 --noreload
