# 🏟️ TurfSync: Advanced Turf Booking & Management System

<div align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="NestJS Logo" />
  
  <h3>Enterprise-Grade Sports Turf Booking & Management Platform</h3>

  [![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
  [![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
  [![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
  [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
  [![Stripe](https://img.shields.io/badge/Stripe-5433FF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
  [![Twilio](https://img.shields.io/badge/Twilio-F22F46?style=for-the-badge&logo=twilio&logoColor=white)](https://www.twilio.com/)
</div>

---

## 📋 Table of Contents
- [🎯 Overview](#-overview)
- [🛠️ Tech Stack](#-tech-stack)
- [✨ Core Features](#-core-features)
- [📁 Interactive Project Structure](#-interactive-project-structure)
- [💳 Payment & Queue Architecture](#-payment--queue-architecture)
- [🎟️ Coupon Integration Workflow](#-coupon-integration-workflow)
- [🔒 Security & Hardening Policies](#-security--hardening-policies)
- [🛡️ Administrative Control & Optimization](#-administrative-control--optimization)
- [ concurrency-control--idempotency](#-concurrency-control--idempotency)
- [🚀 Quick Start Guide](#-quick-start-guide)
- [📊 Monitoring & Observability](#-monitoring--observability)
- [🧪 Testing & Quality Assurance](#-testing--quality-assurance)
- [🔌 Interactive API Reference](#-interactive-api-reference)

---

## 🎯 Overview

**TurfSync** is a high-performance backend REST API designed for managing sports turf bookings (Football, Cricket, etc.). Built with **NestJS v11** and **TypeScript**, the system supports multiple user roles (Players, Turf Owners, Admins) with distinct workflows, real-time slot availability management, and transaction-safe booking operations.

### Key Objectives
* ⚡ **Zero Double Bookings**: Guaranteed via Redis distributed locks and Postgres row-level locking.
* 💳 **Secure Payment Processing**: Integrated seamlessly with Stripe Checkout and Webhooks.
* 🎟️ **Flexible Promotion Systems**: Intelligent and validation-safe discount coupon codes.
* 📨 **Reliable Notifications**: Decoupled asynchronous Email & SMS notification queues.

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime & Framework** | Node.js (v22), NestJS 11, TypeScript |
| **Databases** | PostgreSQL (Relational DB), Redis (Locking, Caching, and Queue Backend) |
| **ORM & Tools** | Prisma ORM |
| **Queueing Engine** | Bull Queue (Redis-backed async job processors) |
| **External APIs** | Stripe (Payments), Twilio (SMS Notifications), Cloudinary (Image Hosting) |
| **Testing Framework** | Jest, Supertest |
| **Quality Control** | ESLint, Prettier |
| **Ops & Deployments** | Docker, Docker Compose, Kubernetes (K8s) |

---

## ✨ Core Features

### ⚽ Turf & Slot Management
* **Role-Based Access Control (RBAC)**: Custom permissions for Players, Turf Owners, and Admins.
* **Slot Auto-Generation & Completion**: Automatically generates time slots and completes bookings via cron jobs.
* **Bulk Image Uploads**: Directly integrated with Cloudinary for fast, optimized image rendering.

### 💳 Stripe & Webhook Integrations
* **Stripe Payment Intent**: Seamlessly initiates checkout with strict metadata validation.
* **Robust Webhooks**: Secure signatures check (`req.rawBody`) with an **idempotent log registry** to prevent duplicate processing.

### 🎟️ Coupon & Discount engine
* **Active Coupon Validations**: Validates expiration dates, maximum usage limits, and per-user usage limits.
* **Atomic Usage Counter**: Updates coupon usage history atomically after the booking transaction successfully completes.

### 🔒 Hardened Security
* **Brute-Force Protection**: 5 failed login attempts triggers a **15-minute temporary lockout**.
* **Refresh Token Rotation (RTR)**: Single-use refresh tokens hashed with SHA-256 to stop replay attacks.
* **Argon2id Hashing**: Industry-standard cryptographic password hashing (OWASP recommendation).
* **Fail-Closed Guards**: Default-deny access strategy if required route parameters or metadata are missing.

---

## 📁 Interactive Project Structure

<details>
<summary>📂 <b>Click to expand/collapse full file directory</b></summary>

```bash
turfbook/
├── prisma/
│   ├── schema.prisma           # Prisma Database schema definitions
│   └── migrations/             # SQL migration files
├── src/
│   ├── admin/                  # Administrative services, metrics, and overrides
│   ├── auth/                   # Authentication, guards, and strategy implementations
│   ├── booking/                # Booking service logic, DTOs, and unit tests
│   ├── common/                 # Interceptors, filters, custom decorators, and pagination helpers
│   ├── coupon/                 # Coupon code validation, creation, and logs
│   ├── mail/                   # Automated mailer services with Handlebars template engine
│   ├── payment/                # Stripe API service, webhook handler, and models
│   ├── queue/                  # Bull queue processors for async dispatches
│   ├── redis/                  # Redis connection and distributed lock services
│   ├── sms/                    # Twilio SMS initialization and dispatch services
│   ├── main.ts                 # Main bootstrap entrypoint
│   └── app.module.ts           # Root configuration module
├── test/                       # Global E2E test suites
├── docker-compose.dev.yml      # Development container orchestration configuration
├── tsconfig.json               # TypeScript compilation settings
└── README.md                   # Project documentation
```
</details>

---

## 💳 Payment & Queue Architecture

The diagram below shows the event-driven Stripe checkout sequence and notification queuing:

```mermaid
sequenceDiagram
    autonumber
    actor Player
    participant Client as Frontend
    participant Server as NestJS API
    participant DB as PostgreSQL (Prisma)
    participant Stripe as Stripe API
    participant Queue as Redis (Bull Queue)
    participant Processor as NotificationProcessor

    %% Phase 1: Create Payment Intent
    Player->>Client: Book and Proceed to Pay
    Client->>Server: POST /payment/create-payment-intent { bookingId }
    Server->>DB: Check Booking Status
    Server->>Stripe: Create PaymentIntent (amount, metadata)
    Stripe-->>Server: Return PaymentIntent (client_secret)
    Server->>DB: Upsert Payment (status: INITIATED)
    Server-->>Client: Return clientSecret, paymentId

    %% Phase 2: Stripe Payment Processing
    Client->>Stripe: Submit card details with clientSecret
    Stripe->>Stripe: Process Payment (3D Secure, etc.)
    Stripe-->>Client: Payment Succeeded / Failed

    %% Phase 3: Stripe Webhook Notification
    Stripe->>Server: POST /payment/webhook (with stripe-signature)
    Server->>Server: Verify Webhook Signature (rawBody)
    
    alt Payment Succeeded
        Server->>DB: Start DB Transaction
        DB->>DB: Update Payment (status: PAID)
        DB->>DB: Update Booking (status: CONFIRMED)
        Server->>Queue: Push PAYMENT_SUCCESS_JOB (payload: payment, booking, user)
        Server-->>Stripe: 200 OK
        
        %% Async Notification
        Queue->>Processor: Process PAYMENT_SUCCESS_JOB
        Processor->>Processor: Send confirmation Email & SMS to user
    else Payment Failed
        Server->>DB: Update Payment (status: FAILED, failureReason)
        Server->>Queue: Push PAYMENT_FAILED_JOB (payload: paymentId, reason, user, booking)
        Server-->>Stripe: 200 OK
        
        %% Async Notification
        Queue->>Processor: Process PAYMENT_FAILED_JOB
        Processor->>Processor: Send failure alert Email/SMS to user
    end
```

---

## 🎟️ Coupon Integration Workflow

The coupon validation and application sequence is executed transaction-safely to prevent race conditions:

```mermaid
graph TD
    A[Player submits Booking DTO with couponCode] --> B{Is couponCode provided?}
    B -- Yes --> C[Fetch Turf pricePerHour]
    C --> D[CouponService.validateAndCalculate coupon, userId, originalAmount]
    D --> E{Is Coupon Valid & Available?}
    E -- Yes --> F[Calculate Discount & finalAmount]
    E -- No --> G[Throw BadRequestException]
    B -- No --> H[Set totalAmount = pricePerHour]
    F --> I[Acquire Redis Lock & DB Transaction]
    I --> J[Create Booking with totalAmount]
    J --> K[Finalize Booking Transaction]
    K --> L{Is Coupon Applied?}
    L -- Yes --> M[CouponService.applyCoupon usage record updated]
    L -- No --> N[End Flow]
    M --> N
```

---

## 🔒 Security & Hardening Policies

### 1. Account Lockout
* Tracks consecutive invalid login attempts (`failedLoginAttempts`).
* Triggers a **15-minute temporary lockout** after **5 failed attempts**.
* Rejects any subsequent attempts during the cooldown period with a clear lockout expiration countdown.

### 2. Hashed Refresh Token Rotation
* Replaces the current Refresh Token with a newly issued pair on every refresh request.
* All refresh tokens are permanently hashed using SHA-256 before being stored in the database, protecting active sessions from database leaks.

### 3. Fail-Closed Route Guards
* Route authentication guards operate on a strict **fail-closed** policy: if a protected endpoint lacks the required role declarations, it immediately denies access (HTTP 403) instead of bypassing verification.

---

## 🛡️ Administrative Control & Optimization

### 📈 High-Performance Revenue Analytics
* Avoids database round-trips by processing date-grouped statistics (`date_trunc`) directly on PostgreSQL via raw query aggregations (`$queryRaw`).
* Implements $O(1)$ in-memory mapping using JavaScript `Map` objects, dropping algorithmic complexity from $O(N \times M)$ to $O(N + M)$ and reducing DB query load by up to 95%.

### ⏰ Timezone-Safe Autocomplete & Cron Jobs
* Cron jobs run every 5 minutes in a unified PostgreSQL transaction (`BookingService.cleanupStalePendingBookings`) to garbage collect stale, unpaid pending bookings.
* Normalizes server offsets by using explicit UTC date calculations (`setUTCHours`) for time-based comparisons.

---

## 🔒 Concurrency Control & Idempotency

* **Row-Level Locking**: Employs `SELECT ... FOR UPDATE` raw database locks on slot creation, ensuring no two concurrent requests can reserve or modify the same slot at the exact same moment.
* **Webhook Idempotency Key**: Utilizes Stripe transaction IDs as primary database keys. Duplicate webhook requests trigger atomic database key collisions, preventing double confirmations.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js** >= 18 (v22 recommended)
* **Docker & Docker Compose**
* **npm** >= 9

### 1. Setup Environment
Clone the repository and copy the sample env:
```bash
git clone https://github.com/awoladhossain/TurfSync.git
cd TurfSync
cp .env.example .env
```

### 2. Fire Up Infrastructure
Spin up the PostgreSQL, Redis, and Monitoring servers in the background:
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Initialize Database
Install dependencies, generate the Prisma client, and run migrations:
```bash
npm install
npx prisma generate
npx prisma migrate dev
```

### 4. Run the App
<details>
<summary>⚡ <b>Click to expand run commands</b></summary>

```bash
# Start development watch mode
npm run start:dev

# Run typecheck compiler validation
npx tsc --noEmit

# Run linters
npm run lint
```
</details>

---

## 📊 Monitoring & Observability

TurfSync has integrated observability out-of-the-box. Access dashboards using these endpoints:

| Service | Access URL | Credentials |
|---------|------------|-------------|
| **Prometheus** | `http://localhost:9090` | *No auth required* |
| **Grafana** | `http://localhost:3001` | **Username:** `admin` <br> **Password:** `admin123` |

### Key Metrics Tracked
* **HTTP Latencies**: Request rates and `p95` response latency histograms.
* **Prisma Performance**: Custom duration queries tracking database latencies.
* **Cache Metrics**: Redis hit-and-miss ratio.
* **Business KPI**: Total bookings created/cancelled, payment success rates, and active player counts.

---

## 🧪 Testing & Quality Assurance

All test suites are configured via Jest. Run validations with the following commands:

```bash
# Run unit & service tests
npm run test

# Run End-to-End (E2E) integration tests
npm run test:e2e

# Run tests with HTML coverage report
npm run test:cov
```

---

## 🔌 Interactive API Reference

* **Interactive OpenAPI/Swagger**: Open `http://localhost:3000/api/docs` while the server is running.
* **Authorization**: Click the **Authorize** lock button in the Swagger header and paste your JWT Bearer token to test protected routes.

---

**Happy Coding! 🚀**
