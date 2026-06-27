# TurfSync API Documentation

This document describes all available API endpoints for TurfSync. This reference can be used by frontend developers to integrate with the backend services.

---

## Standard Response Envelope

All API endpoints (except Stripe webhooks and health check endpoints) return a standard JSON envelope format wrapped by the global `ResponseInterceptor`. The actual response payload is contained within the `data` property.

### **Success Response Structure**
```json
{
  "success": true,
  "statusCode": 200, // Or appropriate HTTP success code (200, 201, etc.)
  "message": "Success",
  "data": { ... }, // Actual API response payload
  "meta": { ... }, // Optional metadata (e.g., pagination info)
  "timestamp": "2026-06-27T12:00:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440003"
}
```

### **Error Response Structure**
If an error occurs, the global exception filter catches it and returns the following structure:
```json
{
  "success": false,
  "statusCode": 400, // Or appropriate HTTP error code (400, 401, 403, 404, 500, etc.)
  "message": "Error details/message",
  "errors": [ ... ], // Optional array of validation messages (if validation failed)
  "requestId": "550e8400-e29b-41d4-a716-446655440003",
  "timestamp": "2026-06-27T12:00:00.000Z",
  "path": "/api/endpoint",
  "reason": "Error details/message"
}
```

---

## Table of Contents
1. [Authentication (`/auth`)](#1-authentication-auth)
2. [Turfs (`/turfs`)](#2-turfs-turfs)
3. [Bookings (`/bookings`)](#3-bookings-bookings)
4. [Payments (`/payment`)](#4-payments-payment)
5. [Admin Slots Management (`/admin/slots`)](#5-admin-slots-management-adminslots)
6. [Admin Turf Image Uploads (`/admin/upload`)](#6-admin-turf-image-uploads-adminupload)
7. [System Health Check (`/health`)](#7-system-health-check-health)

---

## 1. Authentication (`/auth`)

Base URL: `/auth`

### **Register a New User**
* **Endpoint**: `POST /auth/register`
* **Auth**: None
* **Request Body** (`RegisterDto`):
  ```json
  {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "01712345678", // Valid Bangladeshi phone number
    "password": "Password123!" // Min 8 chars, 1 uppercase, 1 lowercase, 1 digit
  }
  ```
* **Success Response**: `201 Created` (wrapped in `.data`)
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "01712345678",
    "role": "USER",
    "isVerified": false,
    "createdAt": "2026-06-27T12:00:00.000Z"
  }
  ```

### **Login User**
* **Endpoint**: `POST /auth/login`
* **Auth**: None (Rate limited: Max 5 requests/minute)
* **Request Body** (`LoginDto`):
  ```json
  {
    "email": "john.doe@example.com",
    "password": "Password123!"
  }
  ```
* **Success Response**: `200 OK` (wrapped in `.data`)
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
  ```

### **Refresh Access Token**
* **Endpoint**: `POST /auth/refresh`
* **Auth**: `Bearer <Refresh-Token>` (Requires JWT Refresh Guard)
* **Success Response**: `200 OK` (wrapped in `.data`)
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
  ```

### **Logout**
* **Endpoint**: `POST /auth/logout`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Request Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
* **Success Response**: `200 OK`

### **Logout From All Devices**
* **Endpoint**: `POST /auth/logout-all`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Success Response**: `200 OK`

### **Get User Profile**
* **Endpoint**: `GET /auth/me`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Success Response**: `200 OK` (wrapped in `.data`)
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "01712345678",
    "role": "USER"
  }
  ```

---

## 2. Turfs (`/turfs`)

Base URL: `/turfs`

### **Find All Turfs**
* **Endpoint**: `GET /turfs`
* **Auth**: None
* **Query Parameters** (`QueryTurfDto`):
  * `page` (number, optional, default: `1`)
  * `limit` (number, optional, default: `10`)
  * `city` (string, optional)
  * `sportType` (enum: `FOOTBALL`, `CRICKET`, `BOTH`, optional)
  * `search` (string, optional) - searches name with case-insensitive contains
  * `minPrice` (number, optional, min: `0`)
  * `maxPrice` (number, optional, min: `0`)
  * `availableDate` (string, optional, format: `YYYY-MM-DD`) - retrieves turfs that have available slots on this date, including matching slot metadata.
* **Success Response**: `200 OK` (wrapped in `.data`)
  ```json
  [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Banani Premium Arena",
      "description": "Premium artificial 7-a-side turf.",
      "address": "Road 11, Banani",
      "city": "Dhaka",
      "sportType": "BOTH",
      "pricePerHour": 1500.00,
      "openTime": "06:00",
      "closeTime": "23:00",
      "isActive": true,
      "images": ["https://res.cloudinary.com/..."],
      "slots": [
        { "id": "uuid-1", "startTime": "08:00", "endTime": "09:00" }
      ] // Only included when availableDate query filter is active
    }
  ]
  ```
  *Note: Pagination metadata (`total`, `page`, `limit`, `totalPages`) will be present in the `meta` field of the standard response envelope.*

### **Find Turf by ID**
* **Endpoint**: `GET /turfs/:id`
* **Auth**: None
* **Success Response**: `200 OK` (wrapped in `.data`)
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Banani Premium Arena",
    ...
  }
  ```

### **Get Available Slots for Turf**
* **Endpoint**: `GET /turfs/:id/slots`
* **Auth**: None
* **Query Parameters**:
  * `date` (string, optional, format: `YYYY-MM-DD`) - defaults to current date
* **Success Response**: `200 OK` (wrapped in `.data`)
  ```json
  [
    {
      "id": "slot-uuid",
      "turfId": "turf-uuid",
      "date": "2026-06-27T00:00:00.000Z",
      "startTime": "06:00",
      "endTime": "07:00",
      "isBooked": false
    }
  ]
  ```

### **Create a New Turf (Admin Only)**
* **Endpoint**: `POST /turfs`
* **Auth**: `Bearer <Access-Token>` (Requires **ADMIN** Role)
* **Request Body** (`CreateTurfDto`):
  ```json
  {
    "name": "Old Trafford Arena",
    "description": "Premium 7-a-side artificial turf with modern amenities.",
    "address": "Road 11, Banani",
    "city": "Dhaka",
    "sportType": "FOOTBALL",
    "pricePerHour": 1500,
    "openTime": "06:00",
    "closeTime": "23:00",
    "images": ["https://example.com/turf1.jpg"] // Optional
  }
  ```
* **Success Response**: `201 Created`

### **Update Turf (Admin Only)**
* **Endpoint**: `PATCH /turfs/:id`
* **Auth**: `Bearer <Access-Token>` (Requires **ADMIN** Role)
* **Request Body**: `Partial<CreateTurfDto>`
* **Success Response**: `200 OK`

### **Delete Turf (Admin Only)**
* **Endpoint**: `DELETE /turfs/:id`
* **Auth**: `Bearer <Access-Token>` (Requires **ADMIN** Role)
* **Success Response**: `200 OK`

---

## 3. Bookings (`/bookings`)

Base URL: `/bookings`

### **Create Booking**
* **Endpoint**: `POST /bookings`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Request Body** (`CreateBookingDto`):
  ```json
  {
    "turfId": "550e8400-e29b-41d4-a716-446655440001",
    "slotId": "550e8400-e29b-41d4-a716-446655440002",
    "date": "2026-06-27",
    "notes": "Please prepare the turf." // Optional
  }
  ```
* **Success Response**: `201 Created` (wrapped in `.data`)
  ```json
  {
    "id": "booking-uuid",
    "userId": "user-uuid",
    "turfId": "turf-uuid",
    "slotId": "slot-uuid",
    "totalAmount": 1500.00,
    "status": "PENDING",
    "paymentStatus": "INITIATED",
    "notes": "Please prepare the turf."
  }
  ```

### **Get My Bookings**
* **Endpoint**: `GET /bookings/my`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Query Parameters**:
  * `page` (number, optional, default: `1`)
  * `limit` (number, optional, default: `10`)
* **Success Response**: `200 OK` (wrapped in `.data`)

### **Get Booking by ID**
* **Endpoint**: `GET /bookings/:id`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Success Response**: `200 OK` (wrapped in `.data` - Accessible by the owner user or an Admin)

### **Cancel Booking**
* **Endpoint**: `PATCH /bookings/:id/cancel`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Success Response**: `200 OK`

### **Get All Bookings (Admin Only)**
* **Endpoint**: `GET /bookings/admin/all`
* **Auth**: `Bearer <Access-Token>` (Requires **ADMIN** Role)
* **Query Parameters**:
  * `page` (number, optional)
  * `limit` (number, optional)
* **Success Response**: `200 OK` (wrapped in `.data`)

---

## 4. Payments (`/payment`)

Base URL: `/payment`

### **Create Stripe Payment Intent**
* **Endpoint**: `POST /payment/create-payment-intent`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Request Body** (`CreatePaymentDto`):
  ```json
  {
    "bookingId": "550e8400-e29b-41d4-a716-446655440002"
  }
  ```
* **Success Response**: `201 Created` (wrapped in `.data`)
  ```json
  {
    "clientSecret": "pi_123456_secret_654321",
    "paymentIntentId": "pi_123456"
  }
  ```

### **Get Payment Status**
* **Endpoint**: `POST /payment/booking/:bookingId`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Success Response**: `200 OK` (wrapped in `.data`)

### **Refund Payment**
* **Endpoint**: `POST /payment/refund/:bookingId`
* **Auth**: `Bearer <Access-Token>` (Requires JWT Auth Guard)
* **Success Response**: `200 OK`

### **Stripe Webhook Handler**
* **Endpoint**: `POST /payment/webhook`
* **Auth**: Stripe Signature Verification (Header `stripe-signature`)
* **Success Response**: `200 OK` (NOT wrapped in standard envelope)

---

## 5. Admin Slots Management (`/admin/slots`)

Base URL: `/admin/slots`

### **Generate Slots for All Active Turfs**
* **Endpoint**: `POST /admin/slots/generate`
* **Auth**: `Bearer <Access-Token>` (Requires **ADMIN** Role)
* **Success Response**: `201 Created` (Generates slots for the next 7 days)

### **Generate Slots for Specific Turf**
* **Endpoint**: `POST /admin/slots/generate/turf/:turfId`
* **Auth**: `Bearer <Access-Token>` (Requires **ADMIN** Role)
* **Query Parameters**:
  * `days` (number, optional, default: `7`)
* **Success Response**: `201 Created`

### **Clean Up Old Slots**
* **Endpoint**: `POST /admin/slots/cleanup`
* **Auth**: `Bearer <Access-Token>` (Requires **ADMIN** Role)
* **Success Response**: `201 Created`

---

## 6. Admin Turf Image Uploads (`/admin/upload`)

Base URL: `/admin/upload`

### **Upload Turf Image**
* **Endpoint**: `POST /admin/upload/turf/:turfId/image`
* **Auth**: `Bearer <Access-Token>` (Requires **ADMIN** Role)
* **Content-Type**: `multipart/form-data`
* **Request Body**:
  * `image` (binary file, maximum size `5MB`. Supported types: `image/jpeg`, `image/png`, `image/webp`)
* **Success Response**: `201 Created` (wrapped in `.data`)
  ```json
  {
    "imageUrl": "https://res.cloudinary.com/..."
  }
  ```

### **Delete Turf Image**
* **Endpoint**: `DELETE /admin/upload/turf/:turfId/image`
* **Auth**: `Bearer <Access-Token>` (Requires **ADMIN** Role)
* **Request Body** (`DeleteImageDto`):
  ```json
  {
    "imageUrl": "https://res.cloudinary.com/..."
  }
  ```
* **Success Response**: `200 OK` (wrapped in `.data`)
  ```json
  {
    "success": true
  }
  ```

---

## 7. System Health Check (`/health`)

Base URL: `/health`

### **Liveness/Readiness Check**
* **Endpoint**: `GET /health`
* **Auth**: None
* **Success Response**: `200 OK` (NOT wrapped in standard envelope)
  ```json
  {
    "status": "ok",
    "info": {
      "database": { "status": "up" },
      "redis": { "status": "up" },
      "bull": { "status": "up" }
    },
    "error": {},
    "details": {
      "database": { "status": "up" },
      "redis": { "status": "up" },
      "bull": { "status": "up" }
    }
  }
  ```
