# USSD System Enhancements - Implementation Guide

## Overview

This document describes the security, performance, and feature enhancements added to the Kyamatu Ward USSD system.

---

## 🚀 New Features

### 1. Security & Abuse Protection

#### Rate Limiting

- **Phone-based limiting**: Max 30 requests per 5 minutes per phone number
- **Session flood control**: Max 20 steps per 2 minutes per session
- Automatic cleanup of expired rate limit entries
- Returns user-friendly error messages when limits exceeded

#### Signature Verification (Optional)

- HMAC-SHA256 verification of requests from Africa's Talking
- Enabled via `VERIFY_SIGNATURE=true` environment variable
- Validates `X-AT-Signature` header against request body

#### Input Sanitization

- Automatic trimming and space normalization
- Control character removal
- Max length enforcement (140 chars for free text)
- Protection against injection attacks

### 2. Multilingual Support (EN/SW)

#### Language Selection

- New **Option 7** in main menu: Change language
- Persistent language preferences stored in database
- Universal navigation hints in both languages:
  - EN: "0:Back 00:Home"
  - SW: "0:Nyuma 00:Nyumbani"

#### Supported Languages

- **EN**: English (default)
- **SW**: Kiswahili/Swahili

All USSD screens, prompts, and error messages available in both languages.

### 3. Session Management

#### LRU Session Store

- In-memory cache with 10-minute TTL
- Max capacity: 10,000 sessions
- Automatic eviction of oldest sessions when full
- Automatic cleanup of expired sessions every 2 minutes
- Tracks transient state between USSD requests

### 4. Enhanced Admin Exports

#### Filtering Capabilities

All export endpoints now support query parameters:

- **`?q=`** - Search across all fields (case-insensitive)
- **`?from=YYYY-MM-DD`** - Filter by registration date (from)
- **`?to=YYYY-MM-DD`** - Filter by registration date (to)
- **`?area_id=`** - Filter by specific area

#### Examples

```bash
# Export all members registered in January 2025
GET /admin/exports/members.csv?from=2025-01-01&to=2025-01-31

# Search for specific member
GET /admin/exports/members.json?q=John

# Filter by area
GET /admin/exports/members.csv?area_id=5

# Combined filters
GET /admin/exports/members.json?area_id=3&from=2025-01-01&q=Mwala
```

### 5. Metrics & Monitoring

#### Public Metrics Endpoint

**GET /metrics** - Returns system statistics

```json
{
  "uptime_s": 3600,
  "requests_total": 1234,
  "ussd_active_sessions": 15,
  "registrations_total": 456,
  "applications_total": 78,
  "issues_total": 23,
  "rate_limited_total": 5,
  "database": {
    "total_members": 456,
    "total_bursary_apps": 78
  },
  "session_store": {
    "active": 15,
    "max_capacity": 10000
  },
  "areas_cache": {
    "cached": true,
    "count": 12,
    "expired": false
  }
}
```

### 6. Areas Cache

#### Automatic Caching

- Areas loaded into memory on startup
- 10-minute TTL (auto-refresh)
- Reduces database queries during USSD pagination

#### Manual Refresh

**GET /admin/areas/refresh** (requires `X-ADMIN-KEY`)

Returns:
```json
{
  "success": true,
  "count": 12,
  "refreshed_at": "2025-01-15T10:30:00.000Z",
  "message": "Areas cache refreshed with 12 areas"
}
```

#### Cache Status

**GET /admin/areas/status** (requires `X-ADMIN-KEY`)

### 7. Database Backups

#### Windows (PowerShell)

```powershell
cd backend
.\scripts\backup.ps1

# With custom parameters
.\scripts\backup.ps1 -BackupDir "D:\Backups" -RetentionDays 60
```

#### Linux/Unix (Bash)

```bash
cd backend
chmod +x scripts/backup.sh
./scripts/backup.sh

# With custom parameters
BACKUP_DIR=/backups RETENTION_DAYS=60 ./scripts/backup.sh
```

#### Features

- Timestamped backup files: `voo_db_YYYYMMDD_HHMM.sql.gz`
- Automatic gzip compression
- Automatic cleanup of old backups (default: 30 days)
- Colorized output with progress indicators

---

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file or environment:

```bash
# Required (existing)
DB_URL=postgresql://postgres:password@localhost:5432/voo_db
PORT=4000
NODE_ENV=production

# Admin Access
ADMIN_EXPORT_KEY=kyamatu-secure-2024

# Rate Limiting
RATE_LIMIT_WINDOW_MS=300000      # 5 minutes (default)
RATE_LIMIT_MAX=30                # Max requests per window

# Signature Verification (Optional)
VERIFY_SIGNATURE=false           # Set to 'true' to enable
AT_API_KEY=your_africas_talking_api_key

# Metrics
METRICS_ENABLED=true             # Set to 'false' to disable /metrics endpoint

# Database Backup (for scripts)
PGHOST=localhost
PGPORT=5432
PGDATABASE=voo_db
PGUSER=postgres
PGPASSWORD=your_password         # KEEP SECRET!
```

### Default Values

If not specified, the system uses these defaults:
- `RATE_LIMIT_WINDOW_MS`: 300000 (5 minutes)
- `RATE_LIMIT_MAX`: 30
- `VERIFY_SIGNATURE`: false
- `METRICS_ENABLED`: true
- `ADMIN_EXPORT_KEY`: kyamatu-secure-2024

---

## 📊 Database Migrations

### Run Migrations

```bash
cd backend

# Migration 1: Create preferences table
psql -U postgres -d voo_db -f db/migrations/001_preferences.sql

# Migration 2: Add audit indexes
psql -U postgres -d voo_db -f db/migrations/002_audit_index.sql
```

### What's Created

**`preferences` table:**
- Stores user language preferences (EN or SW)
- Auto-updates timestamp on changes
- Indexed for fast lookups

**Audit indexes:**
- `idx_audit_created` - Time-based queries
- `idx_audit_event_type` - Event filtering
- `idx_audit_phone` - User activity lookups

---

## 🔌 API Endpoints

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ussd` | POST | USSD webhook (Africa's Talking) |
| `/metrics` | GET | System metrics (if enabled) |

### Admin Endpoints (Require `X-ADMIN-KEY` header)

| Endpoint | Method | Description | Query Params |
|----------|--------|-------------|--------------|
| `/admin/exports/members.csv` | GET | Export members as CSV | `q`, `from`, `to`, `area_id` |
| `/admin/exports/members.json` | GET | Export members as JSON | `q`, `from`, `to`, `area_id` |
| `/admin/areas` | GET | List all areas | - |
| `/admin/areas/refresh` | GET | Refresh areas cache | - |
| `/admin/areas/status` | GET | Get cache status | - |

### Authentication

All admin endpoints require the `X-ADMIN-KEY` header:

```bash
curl -H "X-ADMIN-KEY: kyamatu-secure-2024" \
  http://localhost:4000/admin/exports/members.csv
```

---

## 🧪 Testing

### Test Rate Limiting

```bash
# Send 35 requests rapidly (should hit limit at 31st)
for i in {1..35}; do
  curl -X POST http://localhost:4000/ussd \
    -d "phoneNumber=254712345678&text=" \
    -H "Content-Type: application/x-www-form-urlencoded"
  echo ""
done
```

Expected: First 30 succeed, rest return "END Too many requests..."

### Test Language Switching

```bash
# 1. Select English
curl -X POST http://localhost:4000/ussd \
  -d "phoneNumber=254712345678&text=1" \
  -H "Content-Type: application/x-www-form-urlencoded"

# 2. Select Swahili from menu
curl -X POST http://localhost:4000/ussd \
  -d "phoneNumber=254712345678&text=1*7*2" \
  -H "Content-Type: application/x-www-form-urlencoded"

# 3. Navigate in Swahili
curl -X POST http://localhost:4000/ussd \
  -d "phoneNumber=254712345678&text=2*1" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

### Test Export Filters

```bash
# With authentication header
API_KEY="kyamatu-secure-2024"

# Search filter
curl -H "X-ADMIN-KEY: $API_KEY" \
  "http://localhost:4000/admin/exports/members.json?q=John"

# Date range
curl -H "X-ADMIN-KEY: $API_KEY" \
  "http://localhost:4000/admin/exports/members.csv?from=2025-01-01&to=2025-01-31"

# Combined
curl -H "X-ADMIN-KEY: $API_KEY" \
  "http://localhost:4000/admin/exports/members.json?area_id=3&from=2025-01-01"
```

### Test Metrics

```bash
curl http://localhost:4000/metrics | jq
```

### Test Areas Cache

```bash
API_KEY="kyamatu-secure-2024"

# Refresh cache
curl -H "X-ADMIN-KEY: $API_KEY" \
  http://localhost:4000/admin/areas/refresh

# Check status
curl -H "X-ADMIN-KEY: $API_KEY" \
  http://localhost:4000/admin/areas/status
```

---

## 📝 Audit Trail

All USSD interactions are logged to `audit_events` table with enhanced details:

```sql
-- View recent USSD sessions
SELECT event_type, phone_number, details, created_at
FROM audit_events
WHERE event_type LIKE 'USSD_%'
ORDER BY created_at DESC
LIMIT 50;

-- Count events by type
SELECT event_type, COUNT(*) as count
FROM audit_events
GROUP BY event_type
ORDER BY count DESC;

-- User activity
SELECT phone_number, COUNT(*) as interactions
FROM audit_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY phone_number
ORDER BY interactions DESC;
```

---

## 🔒 Security Best Practices

### Production Deployment

1. **Change default admin key**:
   ```bash
   ADMIN_EXPORT_KEY=$(openssl rand -hex 32)
   ```

2. **Enable signature verification**:
   ```bash
   VERIFY_SIGNATURE=true
   AT_API_KEY=your_actual_api_key
   ```

3. **Use strong database password**:
   ```bash
   PGPASSWORD=$(openssl rand -base64 32)
   ```

4. **Restrict metrics endpoint** (optional):
   ```bash
   METRICS_ENABLED=false
   ```

5. **Set up automated backups**:
   ```bash
   # Add to crontab (Linux)
   0 2 * * * /path/to/backend/scripts/backup.sh

   # Or Windows Task Scheduler (PowerShell)
   # Run daily at 2:00 AM
   ```

### Network Security

- Use HTTPS/TLS for production
- Firewall rules to restrict admin endpoints to trusted IPs
- Consider VPN or IP whitelisting for admin access
- Use environment-specific admin keys (dev/staging/prod)

---

## 📊 Monitoring

### Key Metrics to Watch

1. **Rate Limiting**:
   - `rate_limited_total` - Should be low (< 1% of requests)
   - High values indicate abuse or legitimate traffic spikes

2. **Session Store**:
   - `ussd_active_sessions` - Active USSD sessions
   - Should be < 10,000 (capacity limit)

3. **Areas Cache**:
   - `expired: false` - Cache is fresh
   - Refresh if expired to maintain performance

4. **Database**:
   - Monitor `total_members` and `total_bursary_apps` growth
   - Set up alerts for unusual spikes

### Logging

All components use structured logging (Pino):

```bash
# View logs with filtering
tail -f logs/app.log | grep "Rate limit"
tail -f logs/app.log | grep "ERROR"

# View USSD interactions
tail -f logs/app.log | grep "USSD"
```

---

## 🚨 Troubleshooting

### Rate Limit Issues

**Problem**: Users getting rate limited too quickly

**Solutions**:
```bash
# Increase limits
RATE_LIMIT_MAX=50
RATE_LIMIT_WINDOW_MS=600000  # 10 minutes
```

### Session Store Full

**Problem**: `ussd_active_sessions` consistently near 10,000

**Solutions**:
- Sessions auto-expire after 10 minutes (no action needed)
- Monitor for session leaks (sessions not cleared on END)
- Check session store stats: `sessionStore.getStats()`

### Areas Cache Issues

**Problem**: Cache frequently expired

**Solution**: Cache TTL is 10 minutes (by design). Refresh manually if needed:
```bash
curl -H "X-ADMIN-KEY: $KEY" http://localhost:4000/admin/areas/refresh
```

### Backup Failures

**Problem**: Backup script fails

**Common causes**:
1. PostgreSQL client not installed: Install `postgresql-client`
2. PGPASSWORD not set: Set environment variable
3. Insufficient disk space: Clear old backups or increase storage
4. Database connection issues: Check `PGHOST`, `PGPORT`, `PGUSER`

**Debug**:
```bash
# Test connection
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "\dt"
```

---

## 📚 Additional Resources

### File Structure

```
backend/
├── db/
│   ├── migrations/
│   │   ├── 001_preferences.sql
│   │   └── 002_audit_index.sql
│   ├── members.js (updated)
│   └── preferences.js (new)
├── src/
│   ├── middleware/
│   │   ├── rateLimit.js (new)
│   │   └── signature.js (new)
│   ├── services/
│   │   ├── sessionStore.js (new)
│   │   ├── i18n.js (new)
│   │   └── areasCache.js (new)
│   ├── routes/
│   │   ├── metrics.js (new)
│   │   ├── adminAreas.js (new)
│   │   ├── adminExports.js (updated)
│   │   └── ussd.js (updated)
│   └── index.js (updated)
└── scripts/
    ├── backup.ps1 (new)
    └── backup.sh (new)
```

### Dependencies

No new npm packages required. All features use Node.js built-ins:
- `crypto` for HMAC verification
- `Map` for LRU cache
- Native string manipulation for sanitization

---

## ✅ Acceptance Checklist

- [ ] Rate limiting triggers after 30 requests/5min
- [ ] Session flood control triggers after 20 steps/2min
- [ ] Language selection persists across sessions
- [ ] Swahili (SW) displays correctly in all screens
- [ ] Navigation hints show in correct language
- [ ] Admin exports accept filter parameters
- [ ] Metrics endpoint returns all counters
- [ ] Areas cache reduces database calls
- [ ] Cache refresh endpoint works
- [ ] Backup scripts generate timestamped .gz files
- [ ] Old backups auto-deleted after retention period
- [ ] Signature verification works (if enabled)
- [ ] Input sanitization prevents control characters
- [ ] Session store auto-expires old sessions
- [ ] All migrations run without errors

---

## 📞 Support

For issues or questions:
1. Check logs in `logs/app.log`
2. Review metrics at `/metrics`
3. Test with provided curl commands
4. Check database with provided SQL queries

---

**Last Updated**: January 2025  
**Version**: 2.0.0  
**Compatible with**: Node.js 18+, PostgreSQL 12+
