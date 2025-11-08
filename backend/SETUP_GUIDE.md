# 🚀 Quick Setup for Enhanced Features

## ✅ What's Already Done

- ✅ All middleware files created (rateLimit, signature, adminKey)
- ✅ All service files created (sessionStore, i18n, areasCache)
- ✅ All route files created (metrics, adminAreas)
- ✅ index.js updated with integrations
- ✅ .env updated with new variables
- ✅ Database migration files created

## 🔧 Setup Steps

### Step 1: Run Database Migrations

```powershell
cd C:\Users\Admin\USSD\backend
.\run-migrations.ps1
```

This creates the `preferences` table for language settings.

### Step 2: Restart Backend

Stop your current server (Ctrl+C) and restart:

```powershell
node src\index.js
```

You should see:
```
✅ Metrics endpoint enabled: /metrics
✅ Admin areas cache management enabled
✅ Voo Kyamatu backend started (PRODUCTION mode)
```

### Step 3: Test Enhanced Features

```powershell
.\test-enhancements.ps1
```

This tests:
- ✅ Rate limiting (30 requests/5min)
- ✅ Metrics endpoint
- ✅ Admin areas cache
- ✅ Admin exports with filters

## 📊 New Endpoints

### 1. Metrics (System Stats)
```
GET http://localhost:4000/metrics
```

Returns:
```json
{
  "uptime_seconds": 3600,
  "requests_total": 450,
  "ussd_active_sessions": 12,
  "registrations_total": 35,
  "applications_total": 18,
  "issues_total": 7,
  "rate_limited_total": 3,
  "timestamp": "2025-05-15T10:30:00Z"
}
```

### 2. Admin Areas Cache Refresh
```
POST http://localhost:4000/admin/areas/refresh
Header: X-ADMIN-KEY: kyamatu-secure-2024-change-this
```

### 3. Admin Exports with Filters
```
GET http://localhost:4000/admin/exports/members.json?q=john&from=2025-01-01&to=2025-12-31&area_id=5
Header: X-ADMIN-KEY: kyamatu-secure-2024-change-this
```

Query params:
- `q` - Search all text fields
- `from` - Start date (YYYY-MM-DD)
- `to` - End date (YYYY-MM-DD)
- `area_id` - Filter by area ID

## 🌍 USSD Language Toggle

### **Option 7 needs to be added to your USSD handler!**

Edit `src/routes/ussd.js` and add Option 7 to main menu:

```javascript
const { getDict } = require('../services/i18n');

async function handleUssd(req, reply) {
  const { phoneNumber, text } = req.body;
  const db = require('../lib/db').getCloudDb();
  
  // Get user's language
  let userLang = 'EN';
  try {
    const result = await db.query('SELECT lang FROM preferences WHERE phone=$1', [phoneNumber]);
    if (result.rows.length > 0) {
      userLang = result.rows[0].lang;
    }
  } catch (e) {}

  const dict = getDict(userLang);

  // Main menu
  if (text === '') {
    const menu = `CON ${dict.MAIN}\n${dict.HINT}`;
    reply.type('text/plain; charset=utf-8');
    return reply.send(menu);
  }

  const parts = text.split('*');

  // Option 7: Language selection
  if (parts[0] === '7') {
    if (parts.length === 1) {
      reply.type('text/plain; charset=utf-8');
      return reply.send(`CON ${dict.LANG}\n${dict.HINT}`);
    }
    if (parts[1] === '1') {
      await db.query(
        `INSERT INTO preferences(phone,lang) VALUES($1,'EN')
         ON CONFLICT(phone) DO UPDATE SET lang='EN'`,
        [phoneNumber]
      );
      reply.type('text/plain; charset=utf-8');
      return reply.send(`END Language set to English.`);
    }
    if (parts[1] === '2') {
      await db.query(
        `INSERT INTO preferences(phone,lang) VALUES($1,'SW')
         ON CONFLICT(phone) DO UPDATE SET lang='SW'`,
        [phoneNumber]
      );
      reply.type('text/plain; charset=utf-8');
      return reply.send(`END Lugha imewekwa Kiswahili.`);
    }
  }

  // Rest of your USSD logic...
}
```

## 🔒 Security Features

### Rate Limiting
- **Phone limit:** 30 requests per 5 minutes
- **Session limit:** 20 steps per 2 minutes
- Auto-cleanup of old entries

### Admin Authentication
- All `/admin/*` routes require `X-ADMIN-KEY` header
- Set in `.env` as `ADMIN_EXPORT_KEY`
- **Change default key before production!**

### HMAC Signature (Optional)
- Set `VERIFY_SIGNATURE=true` when using Africa's Talking
- Requires `AT_API_KEY` in `.env`

## 📦 Features Summary

| Feature | Status | Endpoint |
|---------|--------|----------|
| Rate Limiting | ✅ Active | `/ussd` |
| Metrics | ✅ Active | `/metrics` |
| Admin Areas Cache | ✅ Active | `/admin/areas/*` |
| Export Filters | ✅ Active | `/admin/exports/*` |
| Language Toggle | ⏳ Needs USSD update | Option 7 |
| Navigation Hints | ⏳ Needs USSD update | All menus |
| Session Store | ✅ Ready | Used in middleware |
| i18n Support | ✅ Ready | EN/SW dicts |

## [NOTE] Production Checklist

- [ ] Run migrations (`.\run-migrations.ps1`)
- [ ] Restart backend (`node src\index.js`)
- [ ] Check metrics at http://localhost:4000/metrics
- [ ] Check health at http://localhost:4000/health
- [ ] Update USSD handler for Option 7
- [ ] Change `ADMIN_EXPORT_KEY` to strong random value

## 📝 Environment Variables

Check your `.env` has these:

```env
# Core
NODE_ENV=production
DB_URL=postgresql://postgres:23748124@localhost:5432/voo_db
JWT_SECRET=5f072785-a058-4a84-92e2-c2cc4f158395
PORT=4000

# Enhanced Features
ADMIN_EXPORT_KEY=kyamatu-secure-2024-change-this-to-random-key
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX=30
VERIFY_SIGNATURE=false
AT_API_KEY=your-africa-talking-api-key
METRICS_ENABLED=true
```

## 🚀 Deployment

When ready for production:

1. **Change secrets:**
   ```env
   ADMIN_EXPORT_KEY=generate-strong-random-key-here
   JWT_SECRET=use-long-random-string
   ```

2. **Enable signature verification:**
   ```env
   VERIFY_SIGNATURE=true
   AT_API_KEY=your-actual-at-key
   ```

3. **Follow DigitalOcean guide:**
   - See `QUICK_START.md` for step-by-step
   - See `DIGITALOCEAN_DEPLOYMENT.md` for server setup
   - Package ready at: `C:\Users\Admin\USSD\deploy-package`

## 🆘 Troubleshooting

**Metrics not showing:**
- Check `METRICS_ENABLED=true` in .env
- Restart server after changes

**Rate limiting too strict:**
- Increase `RATE_LIMIT_MAX` (default 30)
- Increase `RATE_LIMIT_WINDOW_MS` (default 300000)

**Admin exports fail:**
- Check `X-ADMIN-KEY` header matches .env
- Ensure `ADMIN_EXPORT_KEY` is set

**Language not saving:**
- Run migrations to create `preferences` table
- Check database connection

---

**Need help?** Check `FASTIFY_INTEGRATION.md` for detailed explanations.
