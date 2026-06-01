#!/bin/sh
set -e

echo "⏳ Waiting for database engine to be fully ready..."
npx prisma db validate

echo "🗄️ Running database migrations (Prisma Deploy)..."
npx prisma migrate deploy

echo "✅ Migrations complete!"
echo "🚀 Starting TurfBook Production Server..."
exec node dist/main.js