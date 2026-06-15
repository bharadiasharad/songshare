#!/bin/sh
set -e

echo "▶ Applying database migrations (prisma migrate deploy)..."
npx prisma migrate deploy

# Optionally seed the database when SEED_ON_START=true
if [ "$SEED_ON_START" = "true" ]; then
  echo "▶ Seeding database..."
  npx prisma db seed || echo "⚠ Seed step skipped/failed (continuing)."
fi

echo "▶ Starting application..."
exec "$@"
