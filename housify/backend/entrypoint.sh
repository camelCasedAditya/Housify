#!/bin/sh
# Entry point for all containers built from this image.
# When RUN_MIGRATIONS=1 (set on the `backend` service), run makemigrations+migrate
# before launching the actual command. Other services (worker) just exec.
set -e

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] running makemigrations + migrate"
  python manage.py makemigrations --noinput || true
  python manage.py migrate --noinput
fi

exec "$@"
