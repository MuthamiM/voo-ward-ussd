# VOO Auth Workflow & Recovery Plan

This document outlines the architecture for the Unified Authentication System and the specific steps to restore Google Sign-In Service.

## 1. Authentication Architecture

The system uses a **Centralized Backend** approach. We do not use Firebase Auth on the client-side for session management; instead, we use Supabase (PostgreSQL) as the single source of truth for user data.

### A. Standard Login (Phone + Password/PIN)

1.  **Client** sends `username` and `password` to `POST /api/auth/login`.
    - _Correction implemented:_ The frontend no longer sends `pin` key; it maps it to `password`.
2.  **Backend** looks up user in standard `app_users` table in Supabase.
3.  **Backend** verifies hash (Salted SHA-256).
4.  **Backend** returns a custom JWT or Session Token.

### B. Google Sign-In (Unified)

1.  **Client (Mobile/Web)**:
    - **Mobile**: Uses `google_sign_in` (native SDK) to get an `idToken`.
    - **Dashboard**: Uses Google Identity Services (GIS) Web SDK to get `credential` (JWT).
2.  **Client** sends this Token to `POST /api/auth/google`.
3.  **Backend**:
    - Validates the token directly with Google (`https://oauth2.googleapis.com/tokeninfo`).
    - Extracts email, name, and Google ID (`sub`).
4.  **Backend**:
    - Checks if user exists in `app_users` by Google ID or Email.
    - **If Exists**: Updates avatar/name if changed, logs them in.
    - **If New**: Creates a new record in `app_users`.
5.  **Backend** returns the session user object to the client.

---

## 2. Recovery Plan: Restoring Google Sign-In

The generic "Google Sign-In Failed" error is caused by invalid configuration. We must fix the Trust Chain.

### Step 1: Fix Dashboard (Web)

**Root Cause**: The Client ID in `login.html` is deleted or invalid.
**Action**:

1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  Select your project.
3.  Go to **APIs & Services > Credentials**.
4.  Create Credentials > **OAuth Client ID**.
    - **Application Type**: Web application
    - **Authorized Origins**: `https://voo-ward-ussd-1.onrender.com`
    - **Authorized Redirect URIs**: (Leave empty for One-Tap/Popup)
5.  **Copy the Client ID** and provide it to the Agent.

### Step 2: Fix Mobile App (Android)

**Root Cause**: The `google-services.json` file determines the allowed Client IDs. If the Web Client ID changed, or the SHA-1 fingerprint is missing, Google rejects the token.
**Action**:

1.  In Google Cloud Console credentials, look for an **Android** Client ID.
2.  Ensure the **Package Name** matches: `com.voo.citizen.app` (or whatever is in your `build.gradle`).
3.  Ensure the **SHA-1 Certificate Fingerprint** matches your _Release Key_.
    - Since we signed the app recently, the Release Key SHA-1 _must_ be added to Firebase/Google Console.
4.  Download the latest `google-services.json` and replace the one in `android/app/`. (If you cannot do this now, the existing one _might_ work if only the Web ID was broken, but often they are linked).

### Step 3: Verify Backend

**Root Cause**: The backend must be able to reach `googleapis.com`.
**Action**:

1.  We have updated the backend to use `axios` and output detailed logs.
2.  If login fails, the **Rentern Logs** will now show exactly _why_ (e.g. "Token expired", "Audience mismatch", "Invalid Issuer").

---

## 3. Registration Workflow (New User)

1.  **User** fills details (Name, ID, Phone).
2.  **User** clicks "Register".
3.  **App** sends `POST /api/auth/register-otp`.
4.  **Backend** generates OTP (Simulated).
5.  **App** displays OTP.
6.  **User** enters OTP.
7.  **App** sends `POST /api/auth/register-verify-otp`.
8.  **Backend** returns temporary token.
9.  **App** sends `POST /api/auth/register-complete` with full details + Token.
10. **Backend** creates user in `app_users`.

> **Note**: This workflow removes the dependency on Firebase Auth for user creation, saving costs and centralized control.
