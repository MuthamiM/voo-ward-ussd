# VOO Database Schema & Data Flow

This document explains how information is stored and related in the Supabase (PostgreSQL) database.

## System Overview

- **Primary Database**: Supabase (PostgreSQL 15)
- **Object Storage**: Cloudinary (Images), Hive (Local Offline Cache)
- **Authentication**: Custom JWT (Session-based) verifying against `app_users` table.

---

## 1. Users Table (`app_users`)

Stores all citizen and admin accounts.

| Column          | Type      | Description                           |
| :-------------- | :-------- | :------------------------------------ |
| `id`            | UUID      | Primary Key (Unique User ID)          |
| `full_name`     | Text      | Real Name                             |
| `phone`         | Text      | Unique Phone Number (e.g., `+254...`) |
| `username`      | Text      | Unique Login Username                 |
| `password_hash` | Text      | Format: `salt:hash` (SHA-256)         |
| `google_id`     | Text      | Google User ID (if linked)            |
| `village`       | Text      | User's residential village            |
| `ward`          | Text      | Default: 'Kyamatu'                    |
| `created_at`    | Timestamp | Registration Date                     |

**Data Flow**:

- **Registration**: App sends data -> Backend Hashes Password -> Inserts row.
- **Google Login**: Backend checks for `google_id` or `email` -> Updates/Inserts row.

---

## 2. Issues Table (`issues`)

Stores community reports (potholes, water leaks, etc).

| Column         | Type      | Description                            |
| :------------- | :-------- | :------------------------------------- |
| `id`           | UUID      | Primary Key                            |
| `issue_number` | Text      | Human-readable ID (e.g., `ISS-123456`) |
| `user_id`      | UUID      | Foreign Key -> `app_users.id`          |
| `category`     | Text      | Water, Roads, Electricity, etc.        |
| `description`  | Text      | User's explanation                     |
| `status`       | Text      | `Pending`, `Resolved`, `In Progress`   |
| `location`     | JSON/Text | GPS Coordinates or Place Name          |
| `images`       | Array     | List of Cloudinary URLs                |
| `created_at`   | Timestamp | Submission Date                        |
| `updated_at`   | Timestamp | Last Status Change                     |

**Data Flow**:

- **Offline**: App stores in Hive Box `pending_issues`.
- **Online**: App -> Backend -> Cloudinary (Images) -> Supabase (Row Insert).

---

## 3. Bursaries Table (`bursary_applications`)

Stores student funding requests.

| Column             | Type    | Description                       |
| :----------------- | :------ | :-------------------------------- |
| `id`               | UUID    | Primary Key                       |
| `user_id`          | UUID    | Applicant (Student/Parent)        |
| `institution_name` | Text    | School/University Name            |
| `amount_requested` | Numeric | Amount in KES                     |
| `amount_approved`  | Numeric | Final Allocation                  |
| `status`           | Text    | `pending`, `approved`, `rejected` |
| `admin_notes`      | Text    | Reason for approval/rejection     |

---

## 4. Lost IDs Table (`lost_ids`)

Community lost and found.

| Column               | Type | Description                  |
| :------------------- | :--- | :--------------------------- |
| `id`                 | UUID | Primary Key                  |
| `id_number`          | Text | The ID Number being reported |
| `status`             | Text | `lost` or `found`            |
| `reporter_phone`     | Text | Contact for recovery         |
| `last_seen_location` | Text | Where it was lost/found      |

---

## Data Security

1.  **Passwords**: Never stored in plain text. We use Salt + SHA-256.
2.  **Connections**: All Database connections are over SSL.
3.  **Local Storage**: On the phone, sensitive data is encrypted using AES-256 via `flutter_secure_storage`.
