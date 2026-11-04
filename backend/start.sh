#!/bin/sh
set -e

# Postgres may still be starting (compose depends_on doesn't wait for readiness), so retry.
attempt=1
until alembic upgrade head; do
  if [ "$attempt" -ge 15 ]; then
    echo "alembic upgrade failed after $attempt attempts" >&2
    exit 1
  fi
  echo "alembic upgrade failed (attempt $attempt), retrying in 2s..." >&2
  attempt=$((attempt + 1))
  sleep 2
done

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
