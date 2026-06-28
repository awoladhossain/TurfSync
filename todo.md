# TurfSync API & Integration Todo List

This file documents the newly completed authentication API endpoints (Email Verification & Password Reset) and lists the remaining tasks for frontend integration.

---

## 🚀 Completed Backend API Endpoints

All the endpoints below are fully implemented, type-safe, validated via `class-validator`, and documented via Swagger.

### 1. Email Verification
Exposes route to verify a user's registration email via token.
* **Endpoint**: `POST /auth/verify-email`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "token": "your-verification-token-string"
  }
  ```
* **Success Response** (`200 OK`):
  ```json
  {
    "message": "Email verified successfully"
  }
  ```
* **Error Response** (`400 Bad Request` - invalid/expired token):
  ```json
  {
    "message": "Invalid or expired verification token",
    "error": "Bad Request",
    "statusCode": 400
  }
  ```

---

### 2. Request Password Reset (Forgot Password)
Generates a temporary (1-hour) secure token and sends a reset password link to the user's email.
* **Endpoint**: `POST /auth/forgot-password`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
* **Response** (`200 OK` - response message is kept generic for security):
  ```json
  {
    "message": "Reset email has been sent"
  }
  ```

---

### 3. Reset Password
Verifies the reset token, hashes and updates the user's password, and invalidates all existing active refresh tokens (logging the user out of all devices for security).
* **Endpoint**: `POST /auth/reset-password`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "token": "your-reset-token-string",
    "password": "NewSecurePassword123!"
  }
  ```
* **Success Response** (`200 OK`):
  ```json
  {
    "message": "Password reset successfully"
  }
  ```
* **Error Response** (`400 Bad Request`):
  ```json
  {
    "message": "Invalid or expired reset token",
    "error": "Bad Request",
    "statusCode": 400
  }
  ```

---

## 📧 Email Templates (Handlebars)

The following HTML/Handlebars transactional email templates have been created in `src/mail/templates/` and configured to be bundled automatically in the NestJS build output:
1. `verify-email.hbs` — Sends the email verification button.
2. `reset-password.hbs` — Sends the password reset button.
3. `booking-confirmation.hbs` — Sends booking receipt info (`#booking.id`, total amount, date, slot time).

---

## 🛠️ Frontend Integration TODO Tasks (For Frontend Developer)

Here is what needs to be implemented on the frontend to connect with these features:

### 1. Email Verification Flow
- [ ] **Create a route/page** at `/verify-email`.
- [ ] **Extract the token** from the URL query parameters (e.g., `/verify-email?token=xyz`).
- [ ] **Send a POST request** to `POST /auth/verify-email` on mount, passing the token in the body.
- [ ] **Show UI states**:
  - *Loading*: "Verifying your email address..."
  - *Success*: "Email verified successfully! You can now log in." (with a redirect button to `/login`).
  - *Error*: "Invalid or expired verification link. Please request a new verification email."

### 2. Forgot Password Flow
- [ ] **Create a forgot password page** (e.g., `/forgot-password`).
- [ ] **Add a form** with an `email` input field.
- [ ] **Send a POST request** to `POST /auth/forgot-password` on submit.
- [ ] **Show UI feedback**: "If that email exists in our system, we've sent you instructions to reset your password."

### 3. Reset Password Flow
- [ ] **Create a reset password page** at `/reset-password`.
- [ ] **Extract the token** from the URL query parameters (e.g., `/reset-password?token=xyz`).
- [ ] **Add a form** with fields for `New Password` and `Confirm Password` (minimum 6 characters).
- [ ] **Send a POST request** to `POST /auth/reset-password` on submit, passing `token` and `password` in the body.
- [ ] **Show success feedback**: "Password reset successful! Redirecting to login..." and redirect user to `/login`.

---

## 📋 General Backend Cleanup & Maintenance Tasks
- [ ] **Trigger Verification Email on Signup**: Update `AuthService.register` to generate an email verification token and trigger the `MailService.sendVerificationEmail()` function when a new account is registered.
- [ ] **Add Resend Verification Endpoint**: Expose an endpoint `POST /auth/resend-verification` in case users request another verification link.
- [ ] **Production Email Settings**: Ensure SMTP environment variables (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`) are updated in production `.env` files.
