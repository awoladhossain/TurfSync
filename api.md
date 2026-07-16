# TurfSync API Integration Guide for Frontend Developers

This document highlights the key API updates, updated response schemas, security behaviors, and standard endpoints for integrating the TurfSync frontend.

---

## 🚀 Key Updates & Behavioral Changes

### 1. Unified Error Response Format
We cleaned up the global exception filters. The redundant `reason` field has been removed. All HTTP and database errors now follow this clean envelope:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error description here",
  "errors": null,
  "requestId": "uuid-string-here",
  "timestamp": "2026-07-16T13:40:00.000Z",
  "path": "/api/resource"
}
```

### 2. Standard Success Response Format
All successful responses are encapsulated in a standard envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "meta": {
    "requestId": "uuid-string-here",
    "timestamp": "2026-07-16T13:40:00.000Z"
  }
}
```

### 3. HTTP 403 Forbidden for Unauthorized Resource Access
Accessing payment details or trying to initiate a refund for a booking that does not belong to the logged-in user now correctly returns **`403 Forbidden`** (previously `400 Bad Request`).

---

## 🔑 Authentication Endpoints

### Register User
* **Method & Path:** `POST /api/auth/register`
* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "name": "John Doe",
    "phone": "+1234567890"
  }
  ```
* **Success Response:** Sets secure, httpOnly cookies (`access_token`, `refresh_token`) and returns:
  ```json
  {
    "success": true,
    "statusCode": 201,
    "data": {
      "user": { "id": "user-uuid", "email": "user@example.com", "name": "John Doe" },
      "accessToken": "jwt-token-string",
      "refreshToken": "jwt-token-string"
    }
  }
  ```

### Login User
* **Method & Path:** `POST /api/auth/login`
* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
* **Success Response:** Sets secure, httpOnly cookies (`access_token`, `refresh_token`) and returns tokens.
* **Email Verification Note (Dev vs Prod):** 
  * In the dev phase, verification check is temporarily commented out.
  * In production, if the email is not verified (`isVerified = false`), login will reject with **`401 Unauthorized`**:
    ```json
    {
      "success": false,
      "statusCode": 401,
      "message": "Your email address has not been verified. Please check your inbox for a verification link."
    }
    ```

### Refresh Tokens
* **Method & Path:** `POST /api/auth/refresh`
* **Request Headers:** Cookie must contain `refresh_token` or Authorization Bearer header.
* **Success Response:** Updates the access and refresh cookies and returns the new tokens.

### Logout
* **Method & Path:** `POST /api/auth/logout`
* **Success Response:** Clears the cookie tokens.

---

## 🏟️ Turf & Slot Endpoints

### List Turfs (with Cache Optimization)
* **Method & Path:** `GET /api/turfs`
* **Query Parameters:** `city`, `sportType`, `search`, `minPrice`, `maxPrice`, `availableDate`, `page`, `limit`
* **Note:** This list is heavily cached using Redis. Cache-invalidation happens automatically whenever an admin creates, updates, or deletes a turf.

### Get Turf Slots
* **Method & Path:** `GET /api/turfs/:turfId/slots`
* **Query Parameters:** `date` (format: `YYYY-MM-DD`, defaults to today UTC)
* **Response:**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "turf": { ... },
      "slots": [
        { "id": "slot-uuid", "startTime": "08:00", "endTime": "09:00", "isBooked": false }
      ],
      "date": "2026-07-16"
    }
  }
  ```

---

## 📅 Booking Endpoints

### Create Booking
* **Method & Path:** `POST /api/bookings`
* **Headers:** `Authorization: Bearer <accessToken>`
* **Request Body:**
  ```json
  {
    "slotId": "slot-uuid",
    "couponCode": "SAVE10" // Optional
  }
  ```

---

## 💳 Payment & Refund Endpoints

### Create Payment Intent
* **Method & Path:** `POST /api/payments/create-intent`
* **Headers:** `Authorization: Bearer <accessToken>`
* **Request Body:**
  ```json
  {
    "bookingId": "booking-uuid"
  }
  ```
* **Success Response:**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "clientSecret": "pi_xxx_secret_yyy"
    }
  }
  ```

### Get Payment Status
* **Method & Path:** `GET /api/payments/:bookingId/status`
* **Headers:** `Authorization: Bearer <accessToken>`
* **Response Status Codes:**
  * `200 OK` on success.
  * `403 Forbidden` if the booking/payment does not belong to you.

### Request Refund
* **Method & Path:** `POST /api/payments/:bookingId/refund`
* **Headers:** `Authorization: Bearer <accessToken>`
* **Behavior:**
  * Returns `403 Forbidden` if you are not the booking owner.
  * Same-day bookings (e.g. today's 8:00 PM slot requested at 12:00 PM) **can be successfully refunded**.
  * If the slot's actual start time has already passed, it will reject with **`400 Bad Request`**:
    ```json
    {
      "success": false,
      "statusCode": 400,
      "message": "Cannot refund a booking whose slot has already started or passed"
    }
    ```
