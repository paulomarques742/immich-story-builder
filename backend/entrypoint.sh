#!/bin/sh
set -e

if [ -f /data/db.sqlite ]; then
  echo "[entrypoint] Database found at /data/db.sqlite — resuming."
else
  echo "[entrypoint] No database found — will be created on first run."
fi

exec node src/index.js
