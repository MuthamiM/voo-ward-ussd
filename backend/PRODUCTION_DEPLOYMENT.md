# Africa's Talking USSD Production Setup Guide

## 🌍 Making Your USSD Accessible on Real Network (Safaricom)

### Overview
To make your USSD accessible from real mobile networks (Safaricom, Airtel, Telkom), you need to:
1. Register with Africa's Talking
2. Apply for a USSD short code
3. Expose your server to the internet
4. Configure webhook URL

---

## Step 1: Africa's Talking Account Setup

### 1.1 Create Account
1. Go to https://account.africastalking.com/auth/register
2. Sign up for an account
3. Verify your email
4. Complete KYC (Business documents required for production)

### 1.2 Get API Credentials
1. Login to https://account.africastalking.com/
2. Go to "Settings" → "API Key"
3. Generate your API Key
4. Note down:
   - **Username**: Your AT username
   - **API Key**: Your secret key (keep secure!)

---

## Step 2: Apply for USSD Short Code

### 2.1 USSD Code Types

**Dedicated Code** (Recommended for Production)
- Format: `*384*YOUR_CODE#` (Kenya)
- Example: `*384*8481#`
- Cost: ~KES 15,000-30,000/month + setup fees
- Processing time: 2-4 weeks
- Requires: Business registration, tax compliance

**Shared Code** (For Testing/Small Scale)
- Format: `*384*SHARED*YOUR_CODE#`
- Example: `*384*SHARED*8481#`
- Cost: Lower (usage-based)
- Approval: Faster (few days)

### 2.2 Application Process

1. **Login to Africa's Talking Dashboard**
   - Go to https://account.africastalking.com/

2. **Navigate to USSD Section**
   - Click "USSD" in left sidebar
   - Click "Launch USSD"

3. **Fill Application Form**
   ```
   Service Name: Kyamatu Ward Services
   Service Description: Community portal for Kyamatu Ward residents
   Short Code Type: Dedicated / Shared
   Preferred Code: 8481 (or your choice)
   Expected Users: [Estimate]
   Use Case: Civic engagement, bursary applications, issue reporting
   ```

4. **Submit Documents** (for Dedicated Code)
   - Business registration certificate
   - KRA PIN certificate
   - ID/Passport of directors
   - Service description document
   - Sample USSD flow screenshots

5. **Wait for Approval**
   - Shared: 2-5 business days
   - Dedicated: 2-4 weeks
   - You'll receive email confirmation

---

## Step 3: Expose Server to Internet

You have several options:

### Option A: Ngrok (Quick Testing - Already Available!)

**You already have ngrok installed!** Just run:

```powershell
# Terminal 1: Start your backend
cd C:\Users\Admin\USSD\backend
$env:DB_URL='postgresql://postgres:23748124@localhost:5432/voo_db'
$env:NODE_ENV='production'
$env:PORT='4000'
node src\index.js

# Terminal 2: Start ngrok
ngrok http 4000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

**Pros:**
- ✅ Already installed
- ✅ Works immediately
- ✅ Free tier available
- ✅ HTTPS included

**Cons:**
- ❌ URL changes on restart (free tier)
- ❌ Not for long-term production

**For Permanent URL:**
```powershell
# Sign up at ngrok.com and get auth token
ngrok config add-authtoken YOUR_TOKEN

# Reserve a domain (paid plan ~$8/month)
ngrok http 4000 --domain=your-subdomain.ngrok-free.app
```

### Option B: Cloudflare Tunnel (Free, Permanent)

**You also have cloudflared installed!**

1. **Authenticate:**
```powershell
cloudflared tunnel login
```

2. **Create Tunnel:**
```powershell
cloudflared tunnel create kyamatu-ussd
```

3. **Create Config File:** `C:\Users\Admin\.cloudflared\config.yml`
```yaml
tunnel: <TUNNEL-ID>
credentials-file: C:\Users\Admin\.cloudflared\<TUNNEL-ID>.json

ingress:
  - hostname: kyamatu-ussd.your-domain.com
    service: http://localhost:4000
  - service: http_status:404
```

4. **Run Tunnel:**
```powershell
cloudflared tunnel run kyamatu-ussd
```

**Pros:**
- ✅ Free forever
- ✅ Permanent URL
- ✅ DDoS protection
- ✅ No bandwidth limits

**Cons:**
- ⚠️ Requires custom domain (or use trycloudflare.com for testing)

### Option C: Cloud Deployment (Production Recommended)

**Deploy to Heroku (Free tier available):**

1. **Install Heroku CLI:**
```powershell
# Download from: https://devcenter.heroku.com/articles/heroku-cli
```

2. **Create Heroku App:**
```powershell
cd C:\Users\Admin\USSD\backend
heroku login
heroku create kyamatu-ussd
```

3. **Add PostgreSQL:**
```powershell
heroku addons:create heroku-postgresql:mini
```

4. **Set Environment Variables:**
```powershell
heroku config:set NODE_ENV=production
heroku config:set ADMIN_EXPORT_KEY=kyamatu-secure-2024
heroku config:set RATE_LIMIT_MAX=30
```

5. **Deploy:**
```powershell
git init
git add .
git commit -m "Initial deploy"
git push heroku main
```

6. **Get URL:**
```powershell
heroku open
# URL: https://kyamatu-ussd.herokuapp.com
```

**Other Options:**
- **Railway.app** - $5/month, very easy
- **Render.com** - Free tier available
- **DigitalOcean** - $6/month droplet
- **AWS EC2** - Free tier 12 months

---

## Step 4: Configure Africa's Talking Webhook

### 4.1 Set Callback URL

1. **Login to Africa's Talking**
   - Go to https://account.africastalking.com/

2. **Navigate to USSD Settings**
   - Click "USSD" → Your service
   - Find "Callback URL" field

3. **Enter Your Webhook URL**
   ```
   https://your-domain.ngrok.io/ussd
   
   OR
   
   https://kyamatu-ussd.herokuapp.com/ussd
   ```

4. **Test Connection**
   - Africa's Talking will send test request
   - Must return "CON " or "END " response

### 4.2 Update Environment Variables

Add to your `.env`:

```bash
# Africa's Talking Credentials
AT_USERNAME=sandbox  # Change to your username in production
AT_API_KEY=your_actual_api_key_here

# Enable signature verification (production)
VERIFY_SIGNATURE=true

# Your public URL
PUBLIC_URL=https://kyamatu-ussd.herokuapp.com
```

---

## Step 5: Testing on Real Network

### 5.1 Sandbox Testing (Before Approval)

Africa's Talking provides a **simulator** for testing:

1. **Go to Simulator:**
   - https://account.africastalking.com/apps/simulator

2. **Select USSD Service:**
   - Choose your service from dropdown

3. **Enter Test Phone Number:**
   ```
   +254712345678  (use your actual number)
   ```

4. **Dial the Code:**
   ```
   *384*8481#  (your short code)
   ```

5. **Interact with USSD:**
   - System will call your webhook
   - You can see requests/responses in dashboard

### 5.2 Production Testing (After Approval)

**Once approved, test from real phone:**

1. **Ensure server is running:**
```powershell
# Check if accessible
curl https://your-domain.com/health
```

2. **Dial from Safaricom/Airtel phone:**
```
*384*8481#
```

3. **Monitor Logs:**
```powershell
# View real-time logs
tail -f logs/app.log  # Linux
Get-Content logs\app.log -Tail 50 -Wait  # Windows
```

4. **Check Africa's Talking Logs:**
   - Dashboard → USSD → Logs
   - See all requests/responses

---

## Step 6: Production Checklist

### 6.1 Security

- [ ] Change `ADMIN_EXPORT_KEY` to strong random value
- [ ] Enable `VERIFY_SIGNATURE=true`
- [ ] Use HTTPS (automatic with ngrok/Cloudflare/Heroku)
- [ ] Set strong `PGPASSWORD`
- [ ] Restrict admin endpoints by IP (optional)
- [ ] Enable rate limiting (already implemented)

### 6.2 Performance

- [ ] Database connection pooling (check `db/index.js`)
- [ ] Run database migrations:
  ```powershell
  .\scripts\run-migrations.ps1
  ```
- [ ] Test with multiple concurrent users
- [ ] Monitor `/metrics` endpoint

### 6.3 Monitoring

- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure log aggregation (Papertrail, Loggly)
- [ ] Set up error alerts
- [ ] Monitor database size/performance

### 6.4 Backup

- [ ] Set up automated database backups:
  ```powershell
  # Add to Windows Task Scheduler
  .\scripts\backup.ps1
  ```
- [ ] Test restore procedure
- [ ] Store backups off-site

---

## Quick Start Commands

### Start with Ngrok (Fastest)

```powershell
# Terminal 1: Start backend
cd C:\Users\Admin\USSD\backend
$env:DB_URL='postgresql://postgres:23748124@localhost:5432/voo_db'
$env:NODE_ENV='production'
$env:PORT='4000'
node src\index.js

# Terminal 2: Start ngrok
ngrok http 4000

# Copy the HTTPS URL and paste in Africa's Talking dashboard
# Example: https://abc123.ngrok.io/ussd
```

### Start with Cloudflare (Free, Permanent)

```powershell
# Terminal 1: Start backend
cd C:\Users\Admin\USSD\backend
$env:DB_URL='postgresql://postgres:23748124@localhost:5432/voo_db'
$env:NODE_ENV='production'
node src\index.js

# Terminal 2: Cloudflare Tunnel
cloudflared tunnel --url http://localhost:4000
```

---

## Troubleshooting

### "Connection refused" from Africa's Talking

**Check:**
1. Is your server running? `curl http://localhost:4000/health`
2. Is ngrok/tunnel running? Check tunnel dashboard
3. Is webhook URL correct in AT dashboard?
4. Does URL include `/ussd` path?

### "Invalid response format"

**Ensure responses are:**
- Plain text (not JSON)
- Start with `CON ` or `END `
- Max 160 characters per screen
- No HTML tags

### "Signature verification failed"

**If you enabled `VERIFY_SIGNATURE=true`:**
1. Ensure `AT_API_KEY` is correct
2. Check signature middleware is registered
3. Disable for testing: `VERIFY_SIGNATURE=false`

### Rate Limiting Issues

**If users are getting "Too many requests":**
```bash
# Increase limits temporarily
RATE_LIMIT_MAX=50
RATE_LIMIT_WINDOW_MS=600000
```

---

## Costs Summary

| Item | Cost (Kenya) | Notes |
|------|--------------|-------|
| **Africa's Talking Account** | Free | Registration |
| **Shared USSD Code** | ~KES 5,000-10,000/month | Usage-based |
| **Dedicated USSD Code** | ~KES 15,000-30,000/month | Fixed + setup fee |
| **USSD Sessions** | ~KES 0.50-2.00 per session | Charged by AT |
| **Ngrok (Free)** | Free | URL changes daily |
| **Ngrok (Pro)** | ~$8/month | Fixed domain |
| **Cloudflare Tunnel** | Free | With custom domain |
| **Heroku (Free)** | Free | 550-1000 hrs/month |
| **Heroku (Hobby)** | $7/month | 24/7 uptime |
| **Railway.app** | $5/month | Simple deploy |
| **DigitalOcean** | $6/month | Full control |

---

## Next Steps

1. **Immediate (This Week):**
   - [ ] Create Africa's Talking account
   - [ ] Start with ngrok for testing
   - [ ] Apply for USSD code
   - [ ] Test with simulator

2. **Short-term (This Month):**
   - [ ] Get USSD code approval
   - [ ] Set up permanent hosting (Heroku/Railway)
   - [ ] Run migrations on production database
   - [ ] Test with real phones

3. **Production (Ongoing):**
   - [ ] Monitor metrics and logs
   - [ ] Set up automated backups
   - [ ] Gather user feedback
   - [ ] Iterate on features

---

## Support Contacts

- **Africa's Talking Support:** support@africastalking.com
- **USSD Technical Issues:** +254711082300
- **Documentation:** https://developers.africastalking.com/docs/ussd

---

**Your system is production-ready!** The enhancements we added (rate limiting, security, caching) are designed for real-world usage.

Good luck with your deployment! 🚀
