#!/bin/sh
set -e

echo "⏳ Validating Prisma schema..."
npx prisma validate

echo "🗄️ Running database migrations (Prisma Deploy)..."
npx prisma migrate deploy

echo "✅ Migrations complete!"
echo "🚀 Starting TurfBook Production Server..."
exec node dist/src/main.js