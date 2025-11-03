# 🌍 Africa's Talking USSD Setup Guide

## ✅ Your Backend is LIVE!

**Public URL:** https://site-accounts-exhibitions-oils.trycloudflare.com

**USSD Endpoint:** https://site-accounts-exhibitions-oils.trycloudflare.com/ussd

**Health Check:** https://site-accounts-exhibitions-oils.trycloudflare.com/health

---

## 🚀 Steps to Configure Africa's Talking

### 1. Login to Africa's Talking
- Go to: https://account.africastalking.com/auth/login
- Use your credentials (or sign up if new)

### 2. Create/Access USSD Code
- Navigate to **USSD** section in the dashboard
- Click **"Create USSD Code"** or select your existing code
- You should get a shortcode like: `*384*1234#`

### 3. Configure Callback URL
- In your USSD code settings, find **"Callback URL"** field
- **PASTE THIS URL:**
  ```
  https://site-accounts-exhibitions-oils.trycloudflare.com/ussd
  ```
- Make sure HTTP Method is set to **POST**
- Save the configuration

### 4. Test the USSD Code
- On your phone, dial: **\*384\*YOUR_CODE#** (replace with your actual code)
- You should see the VOO Kyamatu Ward menu:
  ```
  CON Voo/Kyamatu Ward
  1. Register as Constituent
  2. Request Bursary
  3. Report Issue
  4. Check Projects
  5. View Announcements
  6. Contact MCA Office
  0. Exit
  ```

---

## 🔧 Sandbox Testing (If you don't have live shortcode yet)

### Using Africa's Talking Simulator:
1. Go to **USSD > Simulator** in your AT dashboard
2. Enter the USSD code (e.g., `*384*1234#`)
3. Set callback URL: `https://site-accounts-exhibitions-oils.trycloudflare.com/ussd`
4. Click **"Launch Simulator"**
5. Test all menu options

---

## ✅ Verification Checklist

- [x] Backend is running (Port 4000)
- [x] Cloudflare tunnel is active
- [x] Public URL is accessible: https://site-accounts-exhibitions-oils.trycloudflare.com
- [x] Health check returns: `{"ok":true,"ussd":"active"}`
- [x] USSD endpoint ready: `/ussd` (POST)
- [ ] Africa's Talking USSD code configured
- [ ] Callback URL set in AT dashboard
- [ ] USSD code tested on phone/simulator

---

## 📊 Current System Status

**Database:** 
- 2 Members registered
- 0 Bursary applications
- 0 Issues reported

**Endpoints:**
- `/health` - System health check (GET)
- `/ussd` - USSD menu handler (POST)
- `/auth/login` - Admin login (POST)
- `/admin/*` - Admin dashboard APIs (GET/POST)

---

## ⚠️ Important Notes

1. **Cloudflare URL Changes:** The Cloudflare URL (`site-accounts-exhibitions-oils.trycloudflare.com`) will change every time you restart the tunnel. Update Africa's Talking callback URL when this happens.

2. **Keep Tunnel Running:** Don't close the "VOO-Tunnel" PowerShell window. If it closes, restart with:
   ```powershell
   C:\Users\Admin\USSD\START_ALL_SERVERS.bat
   ```

3. **Production Deployment:** For a permanent URL, consider:
   - Cloudflare Tunnel with named tunnel (persistent URL)
   - Deploy to cloud hosting (Heroku, Railway, AWS, etc.)
   - Use your own domain

---

## 🆘 Troubleshooting

### "Route not found" error:
- ✅ USSD endpoint must be **POST**, not GET
- ✅ URL must be exactly: `https://site-accounts-exhibitions-oils.trycloudflare.com/ussd`

### Connection timeout:
- Check if backend is running (look for VOO-Backend window)
- Check if tunnel is running (look for VOO-Tunnel window)
- Run health check: `https://site-accounts-exhibitions-oils.trycloudflare.com/health`

### Menu not displaying:
- Check backend logs in VOO-Backend window
- Verify database connection (should show "DB: Connected")
- Test with simulator first before live testing

---

## 🎯 Next Steps After USSD is Live

1. **Test Registration Flow:**
   - Dial USSD code
   - Select option 1 (Register)
   - Complete registration form
   - Verify constituent appears in admin dashboard

2. **Test Bursary Application:**
   - Option 2 on USSD menu
   - Fill application details
   - Check admin dashboard for new application

3. **Test Issue Reporting:**
   - Option 3 on USSD menu
   - Report an issue
   - Verify in admin dashboard

4. **Monitor Activity:**
   - Login to admin dashboard: http://localhost:5173
   - PIN: 827700
   - Check constituents, applications, and issues

---

**Your system is LIVE and ready to connect to Africa's Talking! 🎉**

Just configure the callback URL in your AT dashboard and start testing!
