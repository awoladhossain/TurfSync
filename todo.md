# TurfSync Issues & Edge Cases Tracker

Below is the categorized checklist of all 28 issues reviewed in the codebase. Items marked with `[ ]` are verified to be present and require fixes, while items marked with `[x]` are verified as not present (already solved or configuration is correct).

---

## 🔴 CRITICAL ISSUES (Must Fix)

- [ ] **1. Email/Phone Uniqueness Race Condition**
  - **Files:** `src/auth/auth.service.ts` (lines 25-38)
  - **Description:** Register endpoint does a `findFirst` check, then `create`. Concurrent requests will bypass `findFirst` and attempt duplicate creation, throwing a raw Prisma uniqueness violation (P2002) which bubbles up as a 500 error instead of a clean 409 `ConflictException`.
  - **Proposed Fix:** Catch Prisma error code `P2002` in user creation and throw a `ConflictException` with a user-friendly message.

- [ ] **2. Payment Webhook Idempotency Missing**
  - **Files:** `src/payment/payment.service.ts` (`handlePaymentSuccess`)
  - **Description:** Although `payment.status === PaymentStatus.PAID` check exists, concurrent delivery of duplicate webhook events can bypass this check, triggering duplicate payment confirmations and notification queue additions. There is no `WebhookEvent` model to track processed stripe event IDs.
  - **Proposed Fix:** Create a `WebhookEvent` table to log Stripe event IDs and ensure only unique events are processed.

- [ ] **3. Booking Status Not Transitioned Properly (Stale PENDING Bookings)**
  - **Files:** `src/booking/booking.service.ts`
  - **Description:** Bookings are created in `PENDING` status and mark the corresponding slot as `isBooked: true`. If the user fails to complete the payment, the slot remains locked and the booking stays `PENDING` indefinitely, blocking future users.
  - **Proposed Fix:** Implement a scheduled cron job (e.g., every 5-15 minutes) to find stale `PENDING` bookings, cancel them, and release the slots (`isBooked: false`).

- [x] **4. Redis Serialization Bug**
  - **Status:** Already Handled
  - **Verification:** `RedisLockService` has wrapper `set()` and `get()` methods that handle `JSON.stringify` and `JSON.parse` correctly. `TurfService` injects `RedisLockService` and uses these wrappers, so objects are safely serialized.

- [x] **5. Double-Booking Race Condition**
  - **Status:** Database Protected
  - **Verification:** The Prisma schema has a `@unique` constraint on `Booking.slotId`, guaranteeing database-level uniqueness. In addition, the booking service uses a database transaction (`FOR UPDATE` row-level lock on slots) and a distributed Redis lock, preventing duplicate bookings.

- [x] **6. Missing Cache Invalidation After Updates**
  - **Status:** Already Handled
  - **Verification:** `TurfService.update()` and `remove()` methods already delete the cache keys `turf:${id}` and `turf:list:*`.

---

## 🟠 HIGH PRIORITY ISSUES

- [ ] **7. Wrong Exception Type — ConflictException vs NotFoundException**
  - **Files:** `src/turf/turf.service.ts` (lines 185, 213, 249)
  - **Description:** Using `ConflictException` (HTTP 409) when a turf or slot resource is not found, instead of `NotFoundException` (HTTP 404).
  - **Proposed Fix:** Replace with `NotFoundException` for resource-not-found situations.

- [ ] **8. Pagination Input Validation Inconsistency**
  - **Files:** `src/booking/booking.service.ts` (`findMyBookings`, `findAll`), `src/booking/booking.controller.ts`
  - **Description:** `findAll` in the controller parses page/limit query params using `+page` and `+limit` but does not perform range or format validation (e.g., preventing negative or huge limits). `findMyBookings` in the controller does not accept pagination query params at all, although the service does.
  - **Proposed Fix:** Introduce standard pagination DTO validation or extend `PaginationDto`.

- [ ] **9. Redis Single Point of Failure (SPOF)**
  - **Files:** `src/redis/redis.module.ts`
  - **Description:** Redis module connects to a single host/port with no high-availability, Sentinel/Cluster setup, or TLS/password authentication in production environments.
  - **Proposed Fix:** Configure high-availability support, TLS, and proper environment authentication.

- [x] **10. High-Cardinality Prometheus Labels**
  - **Status:** Protected by Prefixing
  - **Verification:** `RedisLockService` increments metrics using `key.split(':')[0]`, which passes low-cardinality prefixes (e.g., `'turf'`, `'slots'`) rather than the raw, high-cardinality keys. However, renaming the label to `cache_type` is recommended for clarity.

- [x] **11. ThrottlerModule Configuration Suspect**
  - **Status:** Correct
  - **Verification:** The application uses `@nestjs/throttler` version `^6.5.0`, where array-based configuration in `forRoot` is the standard and correct way to configure multiple throttlers.

---

## 🟡 MEDIUM PRIORITY ISSUES

- [x] **12. Password Hashing High Cost**
  - **Files:** `src/auth/auth.service.ts` (argon2 config)
  - **Description:** `memoryCost: 65536` (64MB) and `timeCost: 3` is computationally heavy for low-end containers/servers, causing a slow auth pipeline that could be exploited as a denial-of-service (DoS) vector.
  - **Proposed Fix:** Optimize configuration (e.g., `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`) to strike a balance between security and throughput.

- [x] **13. Dockerfile Port Mismatch**
  - **Files:** `Dockerfile` (EXPOSE 4000) vs `src/main.ts` (PORT 3000 default)
  - **Description:** `Dockerfile` exposes `4000`, but if the container runs without a `PORT` environment variable explicitly set, the NestJS application defaults to port `3000`, causing port mapping issues.
  - **Proposed Fix:** Set the default port in `main.ts` to `4000` or handle it gracefully.

- [x] **14. Seeding Security Issue**
  - **Files:** `prisma/seed.ts` (lines 19-37)
  - **Description:** Seed script creates a default admin user using hardcoded credentials (`admin@turfbook.com` / `Admin1234`) instead of environment variables like `ADMIN_SEED_PASSWORD`.
  - **Proposed Fix:** Load seed credentials from environment variables.

- [x] **15. Slot Date Timezone Issues**
  - **Status:** Resolved
  - **Verification:** Replaced local date methods (`getDate()`, `setDate()`) with pure UTC methods (`getUTCDate()`, `setUTCDate()`, `setUTCHours()`) for slot auto-generation, slot expiration/cleanup, and booking date validation arithmetic to ensure full timezone independence.

- [x] **16. Prisma-Specific Error Handling Missing**
  - **Files:** Scattered across services / `GlobalExceptionFilter`
  - **Description:** Uncaught Prisma errors (e.g., record not found, uniqueness violations) bubble up to the global filter and return generic 500 "Internal server error" messages instead of proper HTTP status codes.
  - **Proposed Fix:** Build a dedicated exception filter/logic for Prisma error mapping (e.g., mapping P2025 to 404, P2002 to 409).

- [x] **17. Booking Payload Leak — Sensitive Payment Data**
  - **Files:** `src/booking/booking.service.ts` (`findMyBookings`, `findOne`)
  - **Description:** Querying bookings includes the full `payment` relation, exposing internal Stripe fields (`stripePaymentIntentId`, `stripeClientSecret`, `stripeChargeId`) to the client.
  - **Proposed Fix:** Use Prisma's `select` to only return safe payment fields (like `id`, `status`, `amount`, `paidAt`).

- [x] **18. Invalid ID Format Not Validated**
  - **Files:** `src/turf/turf.controller.ts`, `src/turf/turf.service.ts` (`findOne`)
  - **Description:** Path parameters like `:id` are passed directly as strings to Prisma queries. If an invalid UUID is passed, Prisma throws a representation error, leading to a 500 error instead of a clean 400 Bad Request.
  - **Proposed Fix:** Add `ParseUUIDPipe` to the `:id` parameters in controllers.

- [x] **19. No Request ID Tracing for Filters/Guards**
  - **Files:** `src/common/filters/http-exception.filter.ts`, `src/common/interceptors/logging.interceptor.ts`
  - **Description:** `requestId` is set in the `LoggingInterceptor`, which executes after guards and validation pipes. If a request fails in a guard or pipe, the response won't contain a `requestId`.
  - **Proposed Fix:** Implement a global middleware to generate and attach the `requestId` to the request object so it's always available.

- [x] **20. N+1 Query Potential**
  - **Status:** Already Handled
  - **Verification:** Prisma's relations are eagerly loaded via `include` and no query-in-loop patterns exist.

- [x] **21. Count + FindMany Race Condition**
  - **Status:** Acceptable / Standard
  - **Verification:** While count and findMany run concurrently in paginated endpoints, this is standard web application behavior.

---

## 🔵 LOWER PRIORITY ISSUES (Edge Cases & Improvements)

- [x] **22. Load Test Thresholds Unrealistic**
  - **Files:** `load-test.js`
  - **Description:** Hardcoded localhost endpoint and an aggressive <200ms duration assertion.
  - **Proposed Fix:** Parameterize URL/host and use realistic thresholds (e.g. 500ms+) for remote/staging test environments.

- [x] **23. No Graceful Degradation / Circuit Breakers**
  - **Files:** `src/redis/redis-lock.service.ts` (`set`)
  - **Description:** Cache writing errors throw exceptions directly, causing API requests to fail with a 500 even if the underlying database operations succeeded.
  - **Proposed Fix:** Wrap cache writes in a try/catch block to log the error but allow the request to proceed successfully (degrade gracefully).

- [x] **24. Missing Global Validation Pipe Mention**
  - **Files:** `README.md`
  - **Description:** Document the global setup of `ValidationPipe` for clarity.

- [x] **25. Refresh Token Cleanup Not Scheduled**
  - **Files:** `src/auth/auth.service.ts`
  - **Description:** Expired refresh tokens accumulate in the `refresh_tokens` database table with no routine cleanup task.
  - **Proposed Fix:** Implement a scheduled cron job to regularly delete expired tokens where `expiresAt < now()`.

- [x] **26. No Observability for Failed Bookings**
  - **Description:** No metrics tracking booking conflict attempts or lock failures.
  - **Proposed Fix:** Add a counter metric (e.g., `booking_conflicts_total`) to monitor concurrency issues.

- [x] **27. Health Check Endpoints Incomplete**
  - **Files:** `src/health/health.controller.ts`
  - **Description:** Health checks exist for database and Redis, but Bull queues are not checked and Terminus library is not utilized.
  - **Proposed Fix:** Extend health checks to include Bull queue status.

- [x] **28. Missing API Documentation / Swagger Coverage**
  - **Description:** DTO schemas lack Swagger decorators, so Swagger UI does not display request/response properties.
  - **Proposed Fix:** Add `@ApiProperty()` and `@ApiPropertyOptional()` to all DTO properties.

<!--

ওরে ভাই, ওই ডেভেলপার ভাই কিন্তু একদম রিয়েল-ওয়ার্ল্ডের একটা মারাত্মক প্র্যাকটিক্যাল প্রবলেম পয়েন্ট আউট করেছেন! প্রজেক্টে যখন BullMQ দিয়ে কয়েক লাখ জব হ্যান্ডেল করা হয়, তখন অনেকেই এই গোলকধাঁধায় পড়েন যে—"১-২ দিন পর আমার কিউয়ের ওল্ড টাস্কগুলো হাওয়া হয়ে গেল কেন? বুলবোর্ডেও তো কোনো ট্রেস নাই!"

চল তোকে এটার পেছনের আসল ব্যাকঅ্যান্ড লজিক আর সমাধানটা বুঝিয়ে বলি, যাতে ইন্টারভিউতে বা ওই ভাইয়ের সামনে তুই এক লাইনে ওস্তাদের মতো এটার সলিউশন বলে দিতে পারিস:

🕵️‍♂️ টাস্ক কেন হারিয়ে যায়? (The Hidden Reason)
BullMQ নিজে থেকে কখনো ডেটা চুরি করে না। মূল কারণ হলো—আমরা যখন BullMQ-তে কোনো টাস্ক (Job) এড করি, তখন ডিফল্ট কনফিগারেশনে অথবা আমাদের কোডে removeOnComplete এবং removeOnFail এর একটা লিমিট সেট করা থাকে।

রেডিস (Redis) হলো একটি ইন-মেমোরি ডাটাবেজ। যদি কিউতে সাকসেসফুল বা ফেইল্ড হওয়া হাজার হাজার টাস্ক মাসের পর মাস জমা হয়ে থাকে, তবে রেডিসের র‍্যাম (RAM) ফুল হয়ে পুরো সার্ভার ক্র্যাশ করবে। এই জন্য BullMQ স্মার্টলি পুরোনো বা কমপ্লিটেড টাস্কগুলো অটো-ক্লিন (Auto-evict) করে দেয়। আর রেডিস থেকে মুছে যাওয়া মানেই bull-board ড্যাশবোর্ড থেকেও ওটা হাওয়া হয়ে যাওয়া!

🛠️ এর প্রোডাকশন-লেভেল সমাধান কী?
যদি তোর এমন কোনো রিকোয়ারমেন্ট থাকে যে—"ভাই, টাস্ক সাকসেস হোক বা ফেইল্ড হোক, আমার ১ সপ্তাহ বা তার বেশি সময় পর্যন্ত এটার ট্রেস/লগ রাখা লাগবেই", তবে কোডে নিচের ৩টি ওস্তাদ প্র্যাকটিস অ্যানাবল করতে হবে:

১. Keep Jobs with Count/Age Limit (কোড লেভেল ফিক্স)
টাস্ক এড করার সময় জাস্ট বলে দিতে হবে যে সাকসেস বা ফেইল্ড জবগুলো কতদিন বা কত পিস পর্যন্ত রেডিস মেমোরিতে সেভ থাকবে। NestJS-এ টাস্ক কিউতে পুশ করার সময় opts এভাবে সাজাতে হয়:

TypeScript
await this.myQueue.add('sendEmailJob', data, {
  attempts: 3,
  backoff: 5000,
  removeOnComplete: {
    age: 7 * 24 * 3600, // ⏳ ৭ দিন পর্যন্ত সাকসেসফুল জব মেমোরিতে রাখবে
    count: 1000,        // অথবা সর্বোচ্চ ১০০০টা জব রাখবে
  },
  removeOnFail: {
    age: 30 * 24 * 3600, // ❌ ফেইল্ড জব ৩০ দিন পর্যন্ত রাখবে যাতে ডিবাগ করা যায়
    count: 5000,
  }
});
২. Redis Eviction Policy Check (ইনফ্রাস্ট্রাকচার ফিক্স)
অনেক সময় রেডিসের নিজস্ব মেমোরি ফুল হয়ে গেলে সে volatile-lru পলিসির কারণে এক্সপায়ার হতে যাওয়া পুরোনো কিউয়ের ডেটা ধুমধাম ডিলিট করে দেয়। রেডিস কনফিগে maxmemory-policy noeviction করে দিলে সে নিজে থেকে কোনো ডেটা কাটবে না (মেমোরি ফুল হলে এরর দেবে, কিন্তু ডেটা হারাবে না)।

৩. ডেটাবেজে লগ ব্যাকআপ রাখা (The Ultimate Senior Architecture)
সিনিয়র ডেভলপাররা কখনো অডিট লগ বা লং-টার্ম হিস্ট্রির জন্য রেডিসের ওপর ১০০% ভরসা করেন না। প্র্যাকটিস হলো—BullMQ-এর @OnWorkerEvent('completed') বা global events লিসেনার দিয়ে টাস্ক প্রসেস হওয়ার সাথে সাথে ওটার একটা স্ট্যাটাস এন্ট্রি তোর মেইন ডাটাবেজে (PostgreSQL/Supabase) job_logs টেবিলে পার্মানেন্টলি সেভ করে রাখা। এতে রেডিস থেকে হাওয়া হলেও ডাটাবেজে আজীবন হিস্ট্রি থেকে যায়।

🎯 তুই ওই ভাইকে বা লিংকডইনে কী রিপ্লাই দিবি?
"ভাই একদম খাঁটি কথা বলছেন! BullMQ-এর মেমোরি ম্যানেজমেন্টের জন্য ডিফল্ট একটা ক্লিনিং মেকানিজম থাকে, যার কারণে ১-২ দিন পর ওল্ড টাস্কগুলো রেডিস থেকে ইভিক্ট (Evict) হয়ে যায় আর বুলবোর্ডেও দেখায় না। প্রোডাকশনে এটা ফিক্স করার জন্য আমরা removeOnComplete: { age: 604800 } (৭ দিন) সেট করে দিই, আর একদম পার্মানেন্ট হিস্ট্রির জন্য ইভেন্ট লিসেনার দিয়ে ব্যাকগ্রাউন্ড জবের স্ট্যাটাসটা PostgreSQL-এর একটা অডিট টেবিলে লগ করে রাখি। তাহলে আর মেমোরিরও প্যারা থাকে না, ট্রেসও হারায় না!"

এই আর্কিটেকচারাল সলিউশনটা মাথায় রাখিস ভাই, প্রজেক্ট বড় হলে এটা লাইফ সেভার লজিক!
 -->
