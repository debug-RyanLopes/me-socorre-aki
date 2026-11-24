#!/bin/sh
set -eu

npx prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  node dist/prisma/seed.js
fi

exec node dist/src/main.js
