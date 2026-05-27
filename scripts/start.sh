#!/bin/sh
set -e

echo "⏳ Running database migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete"
echo "🚀 Starting TurfBook..."
exec node dist/main.js