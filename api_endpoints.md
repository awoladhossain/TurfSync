# TurfSync API Endpoints Documentation

This document contains a complete list of API endpoints for **TurfSync**, including requests, parameters, validation requirements, authentication guards, and response structures.

## Base URL
* Local Development: `http://localhost:5000` (or as configured in `.env`)
* Production: `https://api.turfsync.com`

---

## Table of Contents
1. [Authentication (`/auth`)](#1-authentication-auth)
2. [Turfs (`/turfs`)](#2-turfs-turfs)
3. [Bookings (`/bookings`)](#3-bookings-bookings)
4. [Reviews & Ratings (`/review`)](#4-reviews--ratings-review)
5. [Payments (`/payment`)](#5-payments-payment)
6. [Coupons (`/coupons`)](#6-coupons-coupons)
7. [Admin Operations (`/admin`)](#7-admin-operations-admin)
8. [Admin Uploads (`/admin/upload`)](#8-admin-uploads-adminupload)
9. [Admin Slot Generation (`/admin/slots`)](#9-admin-slot-generation-adminslots)
10. [Health Checks (`/health`)](#10-health-checks-health)
11. [Data Types & Enums](#11-data-types--enums)

---

## 1. Authentication (`/auth`)

### Register
* **Method:** `POST`
* **Route:** `/auth/register`
* **Rate Limit:** Maximum 3 requests per 60 seconds.
* **Request Body (`RegisterDto`):**
  ```json
  {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "01712345678",
    "password": "Test1234!"
  }
  ```
  * `name`: String (2-50 characters, required).
  * `email`: Valid email string (required).
  * `phone`: Valid Bangladeshi phone number matching `/^(\+8801|8801|01)[3-9]\d{8}$/` (required).
  * `password`: String (minimum 8 characters, must contain at least one uppercase letter, one lowercase letter, and one number).
* **Cookies Set on Success:**
  * `access_token` (HTTP-only, secure in production, maxAge: 15 mins)
  * `refresh_token` (HTTP-only, secure in production, maxAge: 7 days)
* **Response (Status 201 Created):**
  ```json
  {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "01712345678",
      "role": "USER",
      "isVerified": false
    },
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "eyJhbGciOiJIUzI1..."
  }
  ```

### Login
* **Method:** `POST`
* **Route:** `/auth/login`
* **Rate Limit:** Maximum 5 requests per 60 seconds.
* **Request Body (`LoginDto`):**
  ```json
  {
    "email": "john.doe@example.com",
    "password": "Test1234!"
  }
  ```
* **Cookies Set on Success:**
  * `access_token` and `refresh_token`
* **Response (Status 200 OK):**
  ```json
  {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "01712345678",
      "role": "USER",
      "isVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "eyJhbGciOiJIUzI1..."
  }
  ```

### Refresh Token
* **Method:** `POST`
* **Route:** `/auth/refresh`
* **Guards:** `JwtRefreshGuard` (Must send refresh token in header or cookie)
* **Headers:** `Authorization: Bearer <refresh_token>` (or via `refresh_token` cookie)
* **Response (Status 200 OK):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "eyJhbGciOiJIUzI1..."
  }
  ```

### Logout
* **Method:** `POST`
* **Route:** `/auth/logout`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Request Body (`RefreshTokenDto`):**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1..."
  }
  ```
  *(Optional: If not provided in body, fallback will attempt to extract from `refresh_token` cookie).*
* **Cookies Cleared:** `access_token`, `refresh_token`
* **Response (Status 200 OK):**
  ```json
  {
    "message": "Logout successful"
  }
  ```

### Logout All Devices
* **Method:** `POST`
* **Route:** `/auth/logout-all`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Response (Status 200 OK):**
  ```json
  {
    "success": true,
    "message": "Logged out from all devices"
  }
  ```

### Get My Profile
* **Method:** `GET`
* **Route:** `/auth/me`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Response (Status 200 OK):**
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "01712345678",
    "role": "USER",
    "isVerified": true,
    "createdAt": "2026-07-01T10:00:00.000Z"
  }
  ```

### Verify Email
* **Method:** `POST`
* **Route:** `/auth/verify-email`
* **Request Body (`VerifyEmailDto`):**
  ```json
  {
    "token": "verification-token-string"
  }
  ```
* **Response (Status 200 OK):**
  ```json
  {
    "success": true,
    "message": "Email verified successfully"
  }
  ```

### Forgot Password
* **Method:** `POST`
* **Route:** `/auth/forgot-password`
* **Request Body (`ForgotPasswordDto`):**
  ```json
  {
    "email": "john.doe@example.com"
  }
  ```
* **Response (Status 200 OK):**
  ```json
  {
    "success": true,
    "message": "Password reset token sent to your email"
  }
  ```

### Reset Password
* **Method:** `POST`
* **Route:** `/auth/reset-password`
* **Request Body (`ResetPasswordDto`):**
  ```json
  {
    "token": "password-reset-token-string",
    "password": "NewPassword123!"
  }
  ```
  * `password`: Min 6 characters.
* **Response (Status 200 OK):**
  ```json
  {
    "success": true,
    "message": "Password reset successfully"
  }
  ```

---

## 2. Turfs (`/turfs`)

### Get All Turfs
* **Method:** `GET`
* **Route:** `/turfs`
* **Query Parameters (`QueryTurfDto`):**
  * `page` (optional, default: `1`): Current page number.
  * `limit` (optional, default: `10`): Number of results per page (max `100`).
  * `city` (optional): Filter by city (e.g. `Dhaka`).
  * `sportType` (optional): Filter by sport type (`FOOTBALL`, `CRICKET`, `BOTH`).
  * `search` (optional): Case-insensitive search on turf `name` or `description`.
  * `minPrice` (optional): Filter by minimum price per hour.
  * `maxPrice` (optional): Filter by maximum price per hour.
  * `availableDate` (optional): Filter for turfs having available slots on date `YYYY-MM-DD`.
* **Response (Status 200 OK):**
  ```json
  {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "Banani Premium Arena",
        "description": "Premium 7-a-side artificial turf with modern amenities.",
        "address": "Road 11, Banani",
        "city": "Dhaka",
        "sportType": "FOOTBALL",
        "pricePerHour": "1500.00",
        "openTime": "06:00",
        "closeTime": "23:00",
        "rating": 4.5,
        "isActive": true,
        "images": ["https://example.com/images/banani-turf.jpg"]
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

### Get Single Turf Details
* **Method:** `GET`
* **Route:** `/turfs/:id`
* **Path Parameters:**
  * `id`: UUID of the Turf.
* **Response (Status 200 OK):**
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Banani Premium Arena",
    "description": "Premium 7-a-side artificial turf with modern amenities.",
    "address": "Road 11, Banani",
    "city": "Dhaka",
    "sportType": "FOOTBALL",
    "pricePerHour": "1500.00",
    "openTime": "06:00",
    "closeTime": "23:00",
    "rating": 4.5,
    "isActive": true,
    "images": ["https://example.com/images/banani-turf.jpg"],
    "createdAt": "2026-07-01T10:00:00.000Z",
    "updatedAt": "2026-07-01T10:00:00.000Z"
  }
  ```

### Get Turf Slots
* **Method:** `GET`
* **Route:** `/turfs/:id/slots`
* **Path Parameters:**
  * `id`: UUID of the Turf.
* **Query Parameters:**
  * `date` (optional): Retrieve slots for specific date `YYYY-MM-DD`. Defaults to current date if not specified.
* **Response (Status 200 OK):**
  ```json
  [
    {
      "id": "550e8400-e29b-41d4-a716-446655449999",
      "turfId": "550e8400-e29b-41d4-a716-446655440001",
      "date": "2026-07-08T00:00:00.000Z",
      "startTime": "18:00",
      "endTime": "19:00",
      "isBooked": false
    }
  ]
  ```

### Create Turf (Admin Only)
* **Method:** `POST`
* **Route:** `/turfs`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Request Body (`CreateTurfDto`):**
  ```json
  {
    "name": "Old Trafford Banani",
    "description": "Premium 7-a-side turf with full facilities.",
    "address": "Road 11, Banani",
    "city": "Dhaka",
    "sportType": "FOOTBALL",
    "pricePerHour": 1500,
    "openTime": "06:00",
    "closeTime": "23:00",
    "images": ["https://example.com/images/turf1.jpg"]
  }
  ```
  * `name`: String (required, unique).
  * `description`: String (minimum 10 characters, required).
  * `address`: String (required).
  * `city`: String (required).
  * `sportType`: `FOOTBALL`, `CRICKET`, `BOTH` (required).
  * `pricePerHour`: Number (minimum 100 BDT, required).
  * `openTime`: HH:mm format (24-hour pattern: `/^([01]\d|2[0-3]):([0-5]\d)$/`, required).
  * `closeTime`: HH:mm format (24-hour pattern: `/^([01]\d|2[0-3]):([0-5]\d)$/`, required).
  * `images`: String Array (optional).
* **Response (Status 201 Created):** Created Turf Object.

### Update Turf (Admin Only)
* **Method:** `PATCH`
* **Route:** `/turfs/:id`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `id`: UUID of the Turf to update.
* **Request Body:** Partial of `CreateTurfDto` (All fields optional).
* **Response (Status 200 OK):** Updated Turf Object.

### Delete Turf (Admin Only)
* **Method:** `DELETE`
* **Route:** `/turfs/:id`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `id`: UUID of the Turf to delete.
* **Response (Status 200 OK):** Deletion confirmation status.

---

## 3. Bookings (`/bookings`)

### Create Booking
* **Method:** `POST`
* **Route:** `/bookings`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Request Body (`CreateBookingDto`):**
  ```json
  {
    "turfId": "550e8400-e29b-41d4-a716-446655440001",
    "slotId": "550e8400-e29b-41d4-a716-446655449999",
    "date": "2026-07-08",
    "notes": "Need referee assistance."
  }
  ```
  * `turfId`: UUID string (required).
  * `slotId`: UUID string (required).
  * `date`: ISO Date string `YYYY-MM-DD` (required).
  * `notes`: String (optional).
* **Response (Status 201 Created):**
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655448888",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "turfId": "550e8400-e29b-41d4-a716-446655440001",
    "slotId": "550e8400-e29b-41d4-a716-446655449999",
    "totalAmount": "1500.00",
    "status": "PENDING",
    "paymentStatus": "INITIATED",
    "notes": "Need referee assistance.",
    "createdAt": "2026-07-08T12:00:00.000Z",
    "updatedAt": "2026-07-08T12:00:00.000Z"
  }
  ```

### Get My Bookings
* **Method:** `GET`
* **Route:** `/bookings/my`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Query Parameters (`PaginationDto`):**
  * `page` (optional, default: `1`)
  * `limit` (optional, default: `10`)
* **Response (Status 200 OK):**
  ```json
  {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655448888",
        "totalAmount": "1500.00",
        "status": "PENDING",
        "paymentStatus": "INITIATED",
        "date": "2026-07-08",
        "turf": {
          "name": "Banani Premium Arena",
          "city": "Dhaka"
        },
        "slot": {
          "startTime": "18:00",
          "endTime": "19:00"
        }
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

### Get Single Booking Details
* **Method:** `GET`
* **Route:** `/bookings/:id`
* **Guards:** `JwtAuthGuard` (Owner of the booking OR ADMIN role only)
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:**
  * `id`: UUID of the Booking.
* **Response (Status 200 OK):** Detailed booking object including user profile, turf detail, slot details, and coupon details (if applicable).

### Cancel Booking
* **Method:** `PATCH`
* **Route:** `/bookings/:id/cancel`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:**
  * `id`: UUID of the Booking to cancel.
* **Response (Status 200 OK):** Cancelled booking status confirmation.

---

## 4. Reviews & Ratings (`/review`)

### Submit Review
* **Method:** `POST`
* **Route:** `/review`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Request Body (`CreateReviewDto`):**
  ```json
  {
    "bookingId": "550e8400-e29b-41d4-a716-446655448888",
    "rating": 5,
    "comment": "Good and Clean Ground and Nice Management"
  }
  ```
  * `bookingId`: UUID string (required). Must belong to a completed booking that has not yet been reviewed.
  * `rating`: Integer (1 to 5, required).
  * `comment`: String (optional).
* **Response (Status 201 Created):** Created Review Object.

### Get Reviews for a Turf
* **Method:** `GET`
* **Route:** `/review/turf/:turfId`
* **Path Parameters:**
  * `turfId`: UUID of the Turf.
* **Query Parameters (`PaginationDto`):**
  * `page` (optional, default: `1`)
  * `limit` (optional, default: `10`)
* **Response (Status 200 OK):**
  ```json
  {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655441111",
        "rating": 5,
        "comment": "Good and Clean Ground and Nice Management",
        "createdAt": "2026-07-08T12:00:00.000Z",
        "user": {
          "name": "John Doe"
        }
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

---

## 5. Payments (`/payment`)

### Create Stripe Payment Intent
* **Method:** `POST`
* **Route:** `/payment/create-payment-intent`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Request Body (`CreatePaymentDto`):**
  ```json
  {
    "bookingId": "550e8400-e29b-41d4-a716-446655448888"
  }
  ```
* **Response (Status 201 Created):**
  ```json
  {
    "clientSecret": "pi_123456_secret_abcdef123456...",
    "paymentIntentId": "pi_123456"
  }
  ```

### Get Booking Payment Status
* **Method:** `POST`
* **Route:** `/payment/booking/:bookingId`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:**
  * `bookingId`: UUID of the Booking.
* **Response (Status 200 OK):** Status payload showing payment state.

### Refund Payment
* **Method:** `POST`
* **Route:** `/payment/refund/:bookingId`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:**
  * `bookingId`: UUID of the Booking.
* **Response (Status 200 OK):** Refund status confirmation.

### Stripe Webhook
* **Method:** `POST`
* **Route:** `/payment/webhook`
* **Authentication:** Stripe Signature verification (handled on server side via raw request body).
* **Headers:** `stripe-signature: <stripe_signature_hash>`
* **Request Body:** Raw Binary Buffer payload.
* **Response (Status 200 OK):**
  ```json
  {
    "received": true
  }
  ```

---

## 6. Coupons (`/coupons`)

### Validate Coupon Code
* **Method:** `POST`
* **Route:** `/coupons/validate`
* **Guards:** `JwtAuthGuard`
* **Headers:** `Authorization: Bearer <access_token>`
* **Request Body (`ValidateCouponDto`):**
  ```json
  {
    "code": "SUMMER50",
    "bookingAmount": 1500
  }
  ```
  * `code`: String (required).
  * `bookingAmount`: Number (minimum 0, required).
* **Response (Status 200 OK):**
  ```json
  {
    "discount": 150,
    "finalAmount": 1350,
    "isValid": true,
    "type": "PERCENTAGE"
  }
  ```

### Create Coupon (Admin Only)
* **Method:** `POST`
* **Route:** `/coupons`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Request Body (`CreateCouponDto`):**
  ```json
  {
    "code": "SUMMER50",
    "description": "Get 10% discount up to 50 BDT on summer bookings",
    "discountType": "PERCENTAGE",
    "discountValue": 10,
    "minOrderAmount": 1000,
    "maxDiscountAmount": 50,
    "usageLimit": 100,
    "userUsageLimit": 1,
    "validFrom": "2026-07-06T00:00:00.000Z",
    "validUntil": "2026-08-06T23:59:59.000Z",
    "isActive": true
  }
  ```
  * `code`: Unique code string (required).
  * `description`: String (optional).
  * `discountType`: `PERCENTAGE` or `FIXED` (required).
  * `discountValue`: Number (min 0, required).
  * `minOrderAmount`: Number (min 0, required).
  * `maxDiscountAmount`: Number (min 0, required; set `0` for percentage with no cap).
  * `usageLimit`: Total usage cap across all users (optional integer, min 1).
  * `userUsageLimit`: Max use per user (optional integer, min 1, defaults to 1).
  * `validFrom`: Valid starting ISO date/time string (required).
  * `validUntil`: Valid ending ISO date/time string (required).
  * `isActive`: Boolean flag (optional, default `true`).
* **Response (Status 201 Created):** Created Coupon Object.

### Get All Coupons (Admin Only)
* **Method:** `GET`
* **Route:** `/coupons`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Query Parameters (`PaginationDto`):**
  * `page` (optional, default: `1`)
  * `limit` (optional, default: `10`)
* **Response (Status 200 OK):** Paginated Coupon list.

### Get Coupon Details (Admin Only)
* **Method:** `GET`
* **Route:** `/coupons/:id`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `id`: UUID of Coupon.
* **Response (Status 200 OK):** Coupon details payload.

### Update Coupon (Admin Only)
* **Method:** `PATCH`
* **Route:** `/coupons/:id`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `id`: UUID of Coupon.
* **Request Body (`UpdateCouponDto`):** Partial of `CreateCouponDto`.
* **Response (Status 200 OK):** Updated Coupon details.

### Toggle Coupon Active Status (Admin Only)
* **Method:** `PATCH`
* **Route:** `/coupons/:id/toggle-active`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `id`: UUID of Coupon.
* **Response (Status 200 OK):** Toggled active status.

### Delete Coupon (Admin Only)
* **Method:** `DELETE`
* **Route:** `/coupons/:id`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `id`: UUID of Coupon.
* **Response (Status 200 OK):** Deletion confirmation status.

---

## 7. Admin Operations (`/admin`)

### Dashboard Overview Statistics
* **Method:** `GET`
* **Route:** `/admin/dashboard`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Response (Status 200 OK):**
  ```json
  {
    "totalUsers": 240,
    "totalBookings": 1240,
    "totalRevenue": 1860000,
    "activeTurfs": 8
  }
  ```

### Revenue Analytics
* **Method:** `GET`
* **Route:** `/admin/analytics/revenue`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Query Parameters:**
  * `period`: Filter period (`daily`, `weekly`, or `monthly`). Defaults to `daily`.
* **Response (Status 200 OK):** Period-specific aggregated revenue values.

### Get Users list
* **Method:** `GET`
* **Route:** `/admin/users`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Query Parameters (`GetAllUsersDto`):**
  * `page` (optional, default: `1`)
  * `limit` (optional, default: `10`)
  * `search` (optional): Filter users by name, email, or phone.
* **Response (Status 200 OK):** Paginated User list.

### Toggle User Verification Status
* **Method:** `PATCH`
* **Route:** `/admin/users/:userId/toggle-status`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `userId`: UUID of user.
* **Response (Status 200 OK):** User details with modified `isVerified` status.

### Promote User to Admin
* **Method:** `POST`
* **Route:** `/admin/users/:userId/promote`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `userId`: UUID of user.
* **Response (Status 200 OK):** User details showing `role` promoted to `ADMIN`.

### Demote Admin to User
* **Method:** `POST`
* **Route:** `/admin/users/:userId/demote`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `userId`: UUID of user.
* **Response (Status 200 OK):** User details showing `role` demoted to `USER`.

### Get All Bookings (Admin List)
* **Method:** `GET`
* **Route:** `/admin/bookings`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Query Parameters (`GetAllBookingsDto`):**
  * `page` (optional, default: `1`)
  * `limit` (optional, default: `10`)
  * `status` (optional): Filter by booking status (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`).
  * `turfId` (optional): Filter by turf UUID.
  * `dateFrom` (optional): Start date filter (Format: `YYYY-MM-DD`).
  * `dateTo` (optional): End date filter (Format: `YYYY-MM-DD`).
* **Response (Status 200 OK):** Paginated Booking list.

### Manually Complete Booking
* **Method:** `PATCH`
* **Route:** `/admin/bookings/:bookingId/complete`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `bookingId`: UUID of booking.
* **Response (Status 200 OK):** Booking object showing `status` set to `COMPLETED`.

### Turf Analytics
* **Method:** `GET`
* **Route:** `/admin/turfs/:turfId/analytics`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `turfId`: UUID of the Turf.
* **Response (Status 200 OK):** Analytical overview (booking rate, revenues, slot fill stats) for the given turf.

### Payment Report
* **Method:** `GET`
* **Route:** `/admin/payments/report`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Query Parameters (`GetPaymentReportDto`):**
  * `dateFrom` (optional): Start date filter (Format: `YYYY-MM-DD`).
  * `dateTo` (optional): End date filter (Format: `YYYY-MM-DD`).
* **Response (Status 200 OK):** Financial transaction reporting overview.

### Admin Audit Logs
* **Method:** `GET`
* **Route:** `/admin/audit-logs`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Query Parameters (`PaginationDto`):**
  * `page` (optional, default: `1`)
  * `limit` (optional, default: `10`)
* **Response (Status 200 OK):** Paginated list of administrative log operations (`AuditLog[]`).

---

## 8. Admin Uploads (`admin/upload`)

### Upload Turf Image
* **Method:** `POST`
* **Route:** `/admin/upload/turf/:turfId/image`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** 
  * `Authorization: Bearer <access_token>` (Admin Role required)
  * `Content-Type: multipart/form-data`
* **Path Parameters:**
  * `turfId`: UUID of Turf.
* **Request Body (Multipart Form):**
  * `image`: Binary file payload (Limit: Max 5MB file size, processed in memory).
* **Response (Status 201 Created):**
  ```json
  {
    "imageUrl": "https://res.cloudinary.com/turfsync/image/upload/v12345/turf_abcde.jpg"
  }
  ```

### Delete Turf Image
* **Method:** `DELETE`
* **Route:** `/admin/upload/turf/:turfId/image`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `turfId`: UUID of Turf.
* **Request Body (`DeleteImageDto`):**
  ```json
  {
    "imageUrl": "https://res.cloudinary.com/turfsync/image/upload/v12345/turf_abcde.jpg"
  }
  ```
* **Response (Status 200 OK):**
  ```json
  {
    "success": true
  }
  ```

---

## 9. Admin Slot Generation (`admin/slots`)

### Generate Slots for All Active Turfs
* **Method:** `POST`
* **Route:** `/admin/slots/generate`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Description:** Automatically generates slots for all active turfs for the next 7 days.
* **Response (Status 201 Created):** Success status and total generated slots details.

### Generate Slots for Specific Turf
* **Method:** `POST`
* **Route:** `/admin/slots/generate/turf/:turfId`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Path Parameters:**
  * `turfId`: UUID of Turf.
* **Query Parameters:**
  * `days` (optional, default: `7`): Number of days to generate slots for.
* **Response (Status 201 Created):** Success status confirmation.

### Cleanup Old Slots
* **Method:** `POST`
* **Route:** `/admin/slots/cleanup`
* **Guards:** `JwtAuthGuard`, `RolesGuard`
* **Headers:** `Authorization: Bearer <access_token>` (Admin Role required)
* **Description:** Cleans up historical unbooked slots.
* **Response (Status 201 Created):** Cleanup completion message.

---

## 10. Health Checks (`/health`)

### System Health Status
* **Method:** `GET`
* **Route:** `/health`
* **Response (Status 200 OK):**
  ```json
  {
    "status": "ok",
    "info": {
      "database": {
        "status": "up"
      },
      "redis": {
        "status": "up"
      },
      "bull": {
        "status": "up"
      }
    },
    "error": {},
    "details": {
      "database": {
        "status": "up"
      },
      "redis": {
        "status": "up"
      },
      "bull": {
        "status": "up"
      }
    }
  }
  ```

---

## 11. Data Types & Enums

### Roles
* `USER`
* `ADMIN`

### Sport Types
* `FOOTBALL`
* `CRICKET`
* `BOTH`

### Booking Status
* `PENDING` - Booking is requested but payment not completed.
* `CONFIRMED` - Paid and confirmed.
* `CANCELLED` - Cancelled by user or system.
* `COMPLETED` - Game played/finished.

### Payment Status
* `INITIATED`
* `PROCESSING`
* `PAID`
* `FAILED`
* `REFUNDED`

### Discount Types
* `PERCENTAGE` - Discount is percentage of total price up to `maxDiscountAmount`.
* `FIXED` - Flat discount value subtracted from total price.
