# 🔒 DATABASE HARDENING - PRODUCTION READY

## Overview

This system implements a **production-grade PostgreSQL database** with:
- **ZAK as permanent super admin** (username: `zak`, PIN: `827700`)
- **Immutable audit logging**
- **Transaction safety with SERIALIZABLE isolation**
- **Protection triggers** preventing ZAK deletion
- **Checksum-verified migrations**
- **No demo data, no fragile configs**

---

## 🛡️ ZAK Permanent Admin Protection

### What Makes ZAK Permanent?

1. **Database Level Protection:**
   ```sql
   is_permanent BOOLEAN NOT NULL DEFAULT FALSE
   ```
   - ZAK has `is_permanent = TRUE`
   - Protected by PostgreSQL triggers

2. **Deletion Protection:**
   ```sql
   CREATE TRIGGER trg_protect_permanent_admins
     BEFORE DELETE ON admin_users
   ```
   - **Prevents** `DELETE FROM admin_users WHERE username = 'zak'`
   - Raises exception: *"Cannot delete permanent admin user"*

3. **Modification Protection:**
   ```sql
   CREATE TRIGGER trg_protect_permanent_status
     BEFORE UPDATE ON admin_users
   ```
   - **Prevents** changing `is_permanent` from TRUE → FALSE
   - **Prevents** changing username of permanent admin
   - Allows PIN updates (password changes)

4. **Audit Trail:**
   - All changes to `admin_users` automatically logged in `audit_log`
   - Immutable append-only log
   - Tracks: actor, action, old/new values, timestamp

---

## 📁 File Structure

```
/migrations/
  01_init.sql                    # Core schema + ZAK creation
  02_protection_triggers.sql     # ZAK protection + audit triggers

/backend/
  migrate-production.js          # Production migration runner
  
/etc/voo-ward/                   # Secure config (0400 permissions)
  pg_url                         # PostgreSQL connection string
  jwt_key                        # JWT signing key
  ussd_hmac_key                  # USSD signature verification
```

---

## 🚀 Quick Start

### 1. Run Migrations

```powershell
# Navigate to backend
cd C:\Users\Admin\USSD\backend

# Run production migrator
node migrate-production.js
```

**Expected Output:**
```
✓ Connected to PostgreSQL
✓ Found 0 previously applied migrations
Found 2 migration file(s)

→ APPLY: 01_init.sql
✓ SUCCESS: 01_init.sql
→ APPLY: 02_protection_triggers.sql
✓ SUCCESS: 02_protection_triggers.sql

✓ Migration complete: 2 new migration(s) applied

✓ ZAK super admin verified
  Username: zak
  Role: mca
  Permanent: true
  PIN: 827700

✓ Database is production-ready
```

### 2. Verify ZAK Protection

```sql
-- Try to delete ZAK (will FAIL)
DELETE FROM admin_users WHERE username = 'zak';
-- ERROR: Cannot delete permanent admin user: zak

-- Try to remove permanent status (will FAIL)
UPDATE admin_users SET is_permanent = FALSE WHERE username = 'zak';
-- ERROR: Cannot remove permanent status from user: zak

-- Try to change username (will FAIL)
UPDATE admin_users SET username = 'newname' WHERE username = 'zak';
-- ERROR: Cannot change username of permanent admin: zak

-- Update PIN (ALLOWED)
UPDATE admin_users SET pin_hash = 'new_hash' WHERE username = 'zak';
-- SUCCESS: PIN can be changed
```

---

## 🔑 Default Credentials

**ZAK (Super Admin - MCA)**
- **Username:** `zak` (case-insensitive)
- **PIN:** `827700`
- **Role:** `mca` (Super Admin)
- **Permanent:** `TRUE` (cannot be deleted)

---

## 📊 Database Schema

### Tables

1. **constituents** - Citizens/voters
   - Hashed ID numbers (`id_no_hash`)
   - Hashed phone numbers (`phone_hash`)
   - Verification status tracking
   - E.164 normalized phone format

2. **issues** - Community issues
   - 6-character unique ticket
   - Enum-based categories and statuses
   - Message length constraints
   - Indexed for fast lookups

3. **admin_users** - System administrators
   - Username (min 3 chars, alphanumeric)
   - bcrypt PIN hash
   - Role-based access (`clerk`, `mca`, `admin`)
   - **Permanent flag** for ZAK

4. **audit_log** - Immutable audit trail
   - Append-only (no updates/deletes)
   - JSON snapshots of old/new values
   - Actor tracking
   - Automatic timestamping

5. **announcements** - Public notices
6. **projects** - Ward projects
7. **bursaries** - Education assistance
8. **schema_migrations** - Migration tracking

### Enums (Strict Type Safety)

```sql
issue_category: 'water', 'health', 'security', 'road', 'other'
issue_status: 'new', 'ack', 'resolved', 'archived'
project_status: 'planned', 'ongoing', 'completed', 'halted'
bursary_stage: 'submitted', 'under_review', 'shortlisted', 'approved', 'disbursed'
verify_status: 'pending', 'verified', 'rejected', 'needs_review'
user_role: 'clerk', 'mca', 'admin'
```

---

## 🔒 Security Features

### 1. **No Plain Text PII**
- ID numbers: SHA-256 hash + last 4 digits
- Phone numbers: SHA-256 hash + E.164 format
- PINs: bcrypt hash (cost factor 12)

### 2. **Transaction Isolation**
```javascript
await client.query('BEGIN');
await client.query('SET LOCAL TRANSACTION ISOLATION LEVEL SERIALIZABLE');
// ... critical writes ...
await client.query('COMMIT');
```

### 3. **Audit Everything**
- All `admin_users` changes automatically logged
- Actor, action, entity tracked
- Before/after JSON snapshots
- Immutable append-only log

### 4. **Protection Triggers**
- Prevent deletion of permanent admins
- Prevent modification of permanent status
- Prevent username changes for permanent admins
- Auto-update `updated_at` timestamps

### 5. **Input Validation**
- Username: 3+ chars, alphanumeric only
- ID numbers: 4-digit regex check on `last4`
- Message lengths: Hard limits (512 chars)
- Date constraints: end_date >= start_date

---

## 🧪 Testing

### Test 1: Migration Idempotency
```powershell
# Run migrations twice
node migrate-production.js
node migrate-production.js

# Expected: Second run skips all (already applied)
```

### Test 2: ZAK Deletion Protection
```sql
-- This should FAIL
DELETE FROM admin_users WHERE username = 'zak';
-- ERROR: Cannot delete permanent admin user: zak
```

### Test 3: ZAK Modification Protection
```sql
-- This should FAIL
UPDATE admin_users 
SET is_permanent = FALSE 
WHERE username = 'zak';
-- ERROR: Cannot remove permanent status
```

### Test 4: Audit Trail
```sql
-- Check audit log for ZAK creation
SELECT * FROM audit_log 
WHERE entity = 'admin_users' 
  AND action = 'create'
ORDER BY created_at DESC;

-- Should show ZAK creation by SYSTEM
```

### Test 5: Checksum Verification
```powershell
# Modify a migration file that was already applied
# Then run migrator

node migrate-production.js

# Expected: CHECKSUM MISMATCH error and exit(1)
```

---

## 📝 Makefile Targets

Create `Makefile` in backend folder:

```makefile
.PHONY: migrate db-verify db-status

migrate:
	@node migrate-production.js

db-verify:
	@psql $(shell cat /etc/voo-ward/pg_url || echo $(DB_URL)) -c "\
	  SELECT username, role, is_permanent \
	  FROM admin_users \
	  WHERE is_permanent = TRUE;"

db-status:
	@psql $(shell cat /etc/voo-ward/pg_url || echo $(DB_URL)) -c "\
	  SELECT name, applied_at \
	  FROM schema_migrations \
	  ORDER BY applied_at;"
```

**Usage:**
```powershell
make migrate      # Run migrations
make db-verify    # Check ZAK permanent status
make db-status    # Show applied migrations
```

---

## 🔄 Migration Workflow

### Adding New Migrations

1. **Create new file:**
   ```
   migrations/03_add_sms_log.sql
   ```

2. **Write SQL:**
   ```sql
   BEGIN;
   
   CREATE TABLE sms_log(
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     phone_e164 TEXT NOT NULL,
     message TEXT NOT NULL,
     sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   
   INSERT INTO schema_migrations (name, checksum)
   VALUES (
     '03_add_sms_log.sql',
     encode(digest('03_add_sms_log.sql_v1.0.0', 'sha256'), 'hex')
   );
   
   COMMIT;
   ```

3. **Run migrator:**
   ```powershell
   node migrate-production.js
   ```

4. **Never modify applied migrations** - checksums will fail!

---

## ⚠️ Critical Rules

### DO:
✅ Run all migrations in production
✅ Verify ZAK exists after migrations
✅ Keep `/etc/voo-ward/pg_url` at 0400 permissions
✅ Use transactions for multi-row writes
✅ Test migrations in staging first
✅ Backup database before major changes

### DON'T:
❌ **NEVER** modify applied migration files
❌ **NEVER** delete ZAK from database (protected)
❌ **NEVER** set ZAK's `is_permanent = FALSE` (protected)
❌ **NEVER** expose raw ID/phone numbers
❌ **NEVER** commit credentials to git
❌ **NEVER** bypass audit logging

---

## 🆘 Emergency Procedures

### If ZAK Gets Locked Out (PIN Forgotten)

```sql
-- Reset ZAK's PIN to default (827700)
UPDATE admin_users 
SET pin_hash = '$2b$12$xx9EAn4xTiuTlFjXfyg31O2kLNJ.ypV8yvV607emW5SFfxpgjar/q'
WHERE username = 'zak';

-- This is ALLOWED (permanent admin can change PIN)
-- Audit log will track this change
```

### If Database Corruption

1. **Stop all writes immediately**
2. **Check last known good backup:**
   ```sql
   SELECT pg_last_wal_replay_lsn();
   ```
3. **Restore from PITR (Point-in-Time Recovery)**
4. **Verify ZAK exists:**
   ```sql
   SELECT * FROM admin_users WHERE username = 'zak';
   ```
5. **Re-run migrations if needed**

---

## 📚 References

- PostgreSQL Docs: https://www.postgresql.org/docs/
- bcrypt: https://github.com/kelektiv/node.bcrypt.js
- node-postgres: https://node-postgres.com/
- SHA-256 Hashing: PostgreSQL `pgcrypto` extension

---

## ✅ Production Checklist

- [ ] Migrations run successfully
- [ ] ZAK super admin exists (`username: zak`)
- [ ] ZAK is permanent (`is_permanent: TRUE`)
- [ ] ZAK deletion fails (trigger protection)
- [ ] Audit log is working
- [ ] All tables have indexes
- [ ] Enums enforce valid values
- [ ] Checksums verified
- [ ] Database backups configured
- [ ] `/etc/voo-ward/pg_url` has 0400 permissions
- [ ] Connection pooling configured
- [ ] Monitoring enabled

---

**System Status:** Production-Ready ✅
**ZAK Protection:** Active ✅
**Audit Trail:** Enabled ✅
**Migration Safety:** Checksum-verified ✅
