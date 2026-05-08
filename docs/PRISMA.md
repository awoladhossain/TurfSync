# Prisma 7 Setup Guide

A comprehensive guide for setting up and using Prisma 7 with NestJS and PostgreSQL.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Migrations](#migrations)
- [Troubleshooting](#troubleshooting)

---

## Installation

### 1. Install Prisma Dependencies

```bash
npm install @prisma/client @prisma/adapter-pg pg
npm install --save-dev prisma
```

**Package Breakdown:**
- `@prisma/client` - Prisma ORM client
- `@prisma/adapter-pg` - PostgreSQL adapter for Prisma 7 (required for direct DB connections)
- `pg` - PostgreSQL driver
- `prisma` - CLI for migrations and schema management

### 2. Verify Installation

```bash
npx prisma --version
```

Expected output: `prisma/5.x.x or higher`

---

## Configuration

### 1. Environment Variables

Create a `.env` file in your project root:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

**Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

### 2. Schema Configuration (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  // Note: In Prisma 7, the url is NOT specified here
  // It's configured via prisma.config.ts and PrismaClient adapter
}
```

**Important:** Do NOT include `url = env("DATABASE_URL")` in Prisma 7 schemas.

### 3. Prisma Config File (`prisma.config.ts`)

```typescript
import { defineConfig } from '@prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

This file:
- Points to your schema location
- Manages datasource configuration for migrations
- Loads environment variables

### 4. NestJS Service (`src/prisma/prisma.service.ts`)

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('❌ DATABASE_URL is not defined in .env file');
    }

    // Create PostgreSQL connection pool
    const pool = new Pool({ connectionString });

    // Create Prisma adapter with the pool
    const adapter = new PrismaPg(pool);

    // Pass adapter to PrismaClient (Prisma 7 requirement)
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Database connected successfully via Prisma 7');
    } catch (error) {
      console.error('❌ Connection error:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 5. NestJS Module (`src/prisma/prisma.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### 6. App Module Integration (`src/app.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  // ... other modules
})
export class AppModule {}
```

---

## Project Structure

```
project-root/
├── prisma/
│   ├── schema.prisma           # Database schema definition
│   ├── migrations/              # Migration history
│   │   ├── migration_lock.toml
│   │   └── [migration_folders]/
│   └── seeds.ts                 # (Optional) Database seeding
├── src/
│   ├── prisma/
│   │   ├── prisma.module.ts    # NestJS module
│   │   └── prisma.service.ts   # PrismaClient service
│   ├── app.module.ts
│   └── main.ts
├── .env                         # Environment variables (gitignore)
├── .env.example                 # Template for env variables
├── prisma.config.ts             # Prisma configuration
└── package.json
```

---

## Usage

### Basic Database Operations

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Create
  async createUser(data: any) {
    return this.prisma.user.create({ data });
  }

  // Read
  async getUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // Update
  async updateUser(id: string, data: any) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Delete
  async deleteUser(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
```

---

## Migrations

### Create a New Migration

After modifying `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name migration_name
```

This will:
1. Create a SQL migration file
2. Apply it to your development database
3. Generate Prisma Client types

### Apply Migrations to Production

```bash
npx prisma migrate deploy
```

### View Migration Status

```bash
npx prisma migrate status
```

### Reset Database (Development Only)

```bash
npx prisma migrate reset
```

⚠️ **Warning:** This drops all data and recreates the database.

---

## Troubleshooting

### ❌ Error: `PrismaClientConstructorValidationError: Unknown property datasources`

**Cause:** Passing `datasources` directly to PrismaClient constructor

**Solution:** Use the `PrismaPg` adapter pattern (see PrismaService above)

### ❌ Error: `PrismaClientInitializationError: PrismaClient needs to be constructed with non-empty PrismaClientOptions`

**Cause:** Prisma 7 requires an adapter/configuration

**Solution:**
```typescript
// ✅ Correct way
const adapter = new PrismaPg(pool);
super({ adapter });

// ❌ Wrong way
super(); // Empty constructor
```

### ❌ Error: `DATABASE_URL is not defined`

**Cause:** Missing `.env` file or missing DATABASE_URL variable

**Solution:**
1. Create `.env` file in project root
2. Add valid DATABASE_URL: `postgresql://user:password@localhost:5432/dbname`
3. Restart your application

### ❌ Error: `role "username" does not exist`

**Cause:** PostgreSQL user/role not created

**Solution:**
```bash
psql -U postgres
CREATE USER username WITH PASSWORD 'password';
CREATE DATABASE database_name OWNER username;
```

### ⚠️ Warning: `Option 'baseUrl' is deprecated`

**Cause:** TypeScript deprecation warning (non-critical)

**Solution:** You can safely ignore this. It will be fully removed in TypeScript 7.0+

---

## Best Practices

1. **Always use the adapter pattern** in Prisma 7
2. **Version control migrations** - commit migration files to git
3. **Use `.env.example`** - template without secrets
4. **Keep schema organized** - group related models
5. **Use proper typing** - leverage Prisma's generated types
6. **Test migrations** - test migrations in staging before production

---

## Useful Commands

| Command | Purpose |
|---------|---------|
| `npx prisma studio` | Open visual database browser |
| `npx prisma format` | Format schema.prisma file |
| `npx prisma validate` | Validate schema syntax |
| `npx prisma generate` | Generate Prisma Client types |
| `npx prisma db push` | Push schema changes without migrations |
| `npx prisma db pull` | Introspect database and update schema |

---

## References

- [Prisma Official Docs](https://www.prisma.io/docs)
- [Prisma 7 Release Notes](https://www.prisma.io/docs/orm/releases)
- [PostgreSQL Adapter](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [NestJS + Prisma Integration](https://docs.nestjs.com/recipes/prisma)

---

## Support

For issues or questions:
1. Check [Prisma GitHub Issues](https://github.com/prisma/prisma/issues)
2. Review [Prisma Discord Community](https://discord.gg/prisma)
3. Consult this guide's troubleshooting section
