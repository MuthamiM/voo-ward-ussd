# Fastify Integration Guide for Enhancements

## ✅ Files Already Created
- ✅ `src/middleware/rateLimit.js`
- ✅ `src/middleware/signature.js`
- ✅ `src/middleware/adminKey.js`
- ✅ `src/services/sessionStore.js`
- ✅ `src/services/i18n.js`
- ✅ `src/services/areasCache.js`
- ✅ `src/db/preferences.js`
- ✅ `src/db/members.js`
- ✅ `src/routes/metrics.js`
- ✅ `src/routes/adminAreas.js`

## 🔧 Integration Steps

### Step 1: Update .env

Add these to your `.env` file:

```env
# Admin & Security
ADMIN_EXPORT_KEY=kyamatu-secure-2024-change-this
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX=30
VERIFY_SIGNATURE=false
AT_API_KEY=your-at-api-key
METRICS_ENABLED=true

# PostgreSQL (if not already set)
PGHOST=localhost
PGPORT=5432
PGDATABASE=voo_db
PGUSER=postgres
PGPASSWORD=23748124
```

### Step 2: Run Database Migrations

```powershell
cd C:\Users\Admin\USSD\backend

# Set environment
$env:PGPASSWORD='23748124'

# Run migrations
psql -h localhost -U postgres -d voo_db -f src/db/migrations/001_preferences.sql
psql -h localhost -U postgres -d voo_db -f src/db/migrations/002_audit_index.sql
```

Or use the migration runner if exists.

### Step 3: Update src/index.js

The key changes needed in your `index.js`:

1. **Import new modules** (add near top):
```javascript
const { checkRateLimit } = require('./middleware/rateLimit');
const areasCache = require('./services/areasCache');
const sessionStore = require('./services/sessionStore');
```

2. **Add metrics object** (after fastify app creation):
```javascript
app.decorate('metrics', {
  requests_total: 0,
  ussd_active_sessions: 0,
  registrations_total: 0,
  applications_total: 0,
  issues_total: 0,
  rate_limited_total: 0
});
```

3. **Add rate limiting to /ussd route**:
```javascript
app.post('/ussd', async (request, reply) => {
  // Rate limit check
  const rateLimitCheck = checkRateLimit(request);
  if (rateLimitCheck.blocked) {
    reply.type('text/plain; charset=utf-8');
    if (rateLimitCheck.reason === 'phone_limit') {
      return reply.send('END Too many requests. Please try again later.');
    } else {
      return reply.send('END Session limit reached. Please start again.');
    }
  }

  // Your existing USSD handler
  return handleUssd(request, reply);
});
```

4. **Register metrics route** (before app.listen):
```javascript
app.register(require('./routes/metrics'), { prefix: '/metrics' });
```

5. **Register admin areas route** (if not already):
```javascript
app.register(require('./routes/adminAreas'), { prefix: '/admin/areas' });
```

### Step 4: Update USSD Handler (src/routes/ussd.js)

Add language toggle and hints. Here's the pattern:

```javascript
const { getLang, setLang } = require('../db/preferences');
const { getDict } = require('../services/i18n');

async function handleUssd(request, reply) {
  const { phoneNumber, text } = request.body;
  
  // Get user's language preference
  const db = require('../lib/db').getCloudDb();
  let userLang = 'EN';
  try {
    const result = await db.query('SELECT lang FROM preferences WHERE phone=$1', [phoneNumber]);
    if (result.rows.length > 0) {
      userLang = result.rows[0].lang;
    }
  } catch (e) {
    // Default to EN if error
  }

  const dict = getDict(userLang);
  const hint = dict.HINT;

  // Parse input
  const parts = text.split('*');
  
  // Main menu
  if (text === '') {
    reply.type('text/plain; charset=utf-8');
    return reply.send(`CON ${dict.MAIN}\n${hint}`);
  }

  // Language selection (Option 7)
  if (parts[0] === '7') {
    if (parts.length === 1) {
      reply.type('text/plain; charset=utf-8');
      return reply.send(`CON ${dict.LANG}\n${hint}`);
    }
    if (parts[1] === '1') {
      await db.query(
        `INSERT INTO preferences(phone,lang) VALUES($1,'EN')
         ON CONFLICT(phone) DO UPDATE SET lang='EN', updated_at=NOW()`,
        [phoneNumber]
      );
      reply.type('text/plain; charset=utf-8');
      return reply.send(`END Language set to English.\n${getDict('EN').HINT}`);
    }
    if (parts[1] === '2') {
      await db.query(
        `INSERT INTO preferences(phone,lang) VALUES($1,'SW')
         ON CONFLICT(phone) DO UPDATE SET lang='SW', updated_at=NOW()`,
        [phoneNumber]
      );
      reply.type('text/plain; charset=utf-8');
      return reply.send(`END Lugha imewekwa Kiswahili.\n${getDict('SW').HINT}`);
    }
  }

  // Rest of your existing USSD logic...
  // Just add ${hint} to the end of all CON responses
}
```

### Step 5: Update Admin Exports (src/routes/adminExports.js)

Make sure it uses filters:

```javascript
const { listMembersWithArea } = require('../db/members');

// In your CSV/JSON export handlers:
const { q, from, to, area_id } = request.query;
const members = await listMembersWithArea({ q, from, to, area_id });
```

### Step 6: Test Everything

```powershell
cd C:\Users\Admin\USSD\backend

# Start server
$env:DB_URL='postgresql://postgres:23748124@localhost:5432/voo_db'
$env:NODE_ENV='production'
$env:PORT='4000'
node src\index.js
```

Test endpoints:
```powershell
# Health check
Invoke-RestMethod http://localhost:4000/health

# Metrics
Invoke-RestMethod http://localhost:4000/metrics

# USSD (with rate limiting)
$body = 'phoneNumber=254712345678&text='
Invoke-RestMethod -Uri http://localhost:4000/ussd -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded'

# Admin exports (with filters)
$headers = @{'X-ADMIN-KEY'='kyamatu-secure-2024'}
Invoke-RestMethod -Uri 'http://localhost:4000/admin/exports/members.json?q=john' -Headers $headers

# Areas cache refresh
Invoke-RestMethod -Uri 'http://localhost:4000/admin/areas/refresh' -Headers $headers
```

## 📊 Features Now Available

### 1. Rate Limiting
- ✅ 30 requests per 5 minutes per phone
- ✅ 20 steps per 2 minutes per session
- ✅ Automatic cleanup of old entries

### 2. Multilingual (EN/SW)
- ✅ User preference stored in database
- ✅ Option 7 to toggle language
- ✅ "0:Back 00:Home" hints in user's language

### 3. Admin Export Filters
- ✅ Query: `?q=john` (searches all text fields)
- ✅ Date range: `?from=2025-01-01&to=2025-12-31`
- ✅ Area: `?area_id=5`
- ✅ CSV and JSON formats

### 4. Areas Cache
- ✅ 10-minute TTL
- ✅ Manual refresh via `/admin/areas/refresh`
- ✅ Reduces database queries

### 5. Metrics Endpoint
- ✅ `/metrics` returns system stats
- ✅ Uptime, request counts, registrations, etc.

### 6. Session Store
- ✅ LRU cache for transient state
- ✅ 10k capacity, 10-minute TTL
- ✅ Use for multi-step flows

### 7. Security
- ✅ Admin key authentication
- ✅ Optional HMAC signature verification
- ✅ CORS headers

### 8. Backups
- ✅ Windows PowerShell script
- ✅ Linux bash script
- ✅ Automated with retention

## 🚀 Deployment Checklist

- [ ] Update .env with production values
- [ ] Run database migrations
- [ ] Change ADMIN_EXPORT_KEY to strong random value
- [ ] Test rate limiting
- [ ] Test language toggle (dial *384*8481#, select option 7)
- [ ] Test admin exports with filters
- [ ] Setup automated backups (Task Scheduler/cron)
- [ ] Monitor /metrics endpoint
- [ ] Enable signature verification if using Africa's Talking

## 📞 Support

All files are modular and can be enabled/disabled via environment variables.

- Rate limiting: Set `RATE_LIMIT_MAX` to very high number to effectively disable
- Signature verification: Keep `VERIFY_SIGNATURE=false` until production
- Metrics: Toggle with `METRICS_ENABLED=true/false`

## 🔧 Troubleshooting

**Metrics not showing:**
- Check `METRICS_ENABLED=true` in .env
- Verify route is registered: `app.register(require('./routes/metrics'))`

**Rate limiting too strict:**
- Increase `RATE_LIMIT_MAX` (default 30)
- Increase `RATE_LIMIT_WINDOW_MS` (default 300000 = 5 min)

**Admin exports unauthorized:**
- Check `X-ADMIN-KEY` header matches .env value
- Ensure `ADMIN_EXPORT_KEY` is set in .env

**Language not saving:**
- Run migrations to create `preferences` table
- Check database connection

---

**Next:** Once integrated, test with Africa's Talking simulator and go live!
