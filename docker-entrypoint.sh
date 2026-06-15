#!/bin/sh
set -e

echo "▶ Applying database migrations (prisma migrate deploy)..."
npx prisma migrate deploy

# Optionally seed the database when SEED_ON_START=true. Runs the compiled seed
# (the production image has no ts-node); a failure never blocks app startup.
if [ "$SEED_ON_START" = "true" ]; then
  echo "▶ Seeding database..."
  node dist/scripts/seed.js || echo "⚠ Seed step skipped/failed (continuing)."
fi

echo "▶ Starting application..."
exec "$@"
