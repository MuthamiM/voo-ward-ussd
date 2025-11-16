# 🚀 RENDER DEPLOYMENT - QUICK REFERENCE

## ✅ WHAT'S DONE
- [x] Git repository initialized
- [x] All files committed (164 files)
- [x] .gitignore configured
- [x] Backend is Render-ready

---

## 📋 YOUR ACTION ITEMS

### 1️⃣ CREATE GITHUB REPOSITORY (2 minutes)
1. Go to: **https://github.com/new**
2. Repository name: **`voo-ward-ussd`**
3. Select: **Private** ✅ (recommended for security)
4. **DON'T** check any boxes (README, .gitignore, license)
5. Click **"Create repository"**

### 2️⃣ PUSH YOUR CODE (1 minute)
After creating the repo, GitHub shows you a URL like:
```
https://github.com/YOUR_USERNAME/voo-ward-ussd.git
```

**Run these commands in PowerShell:**
```powershell
cd C:\Users\Admin\USSD
git remote add origin https://github.com/YOUR_USERNAME/voo-ward-ussd.git
git branch -M main
git push -u origin main
```

*(Replace `YOUR_USERNAME` with your actual GitHub username)*

---

### 3️⃣ DEPLOY TO RENDER (10 minutes)

#### A. Sign Up & Connect GitHub
1. Go to: **https://render.com**
2. Click **"Get Started"** (free tier)
3. Sign up with GitHub account
4. Authorize Render to access your repositories

#### B. Create PostgreSQL Database
1. Click **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name**: `voo-ward-db`
   - **Database**: `voo_db`
   - **Region**: Oregon (Free)
   - **Plan**: Free
3. Click **"Create Database"**
4. **⚠️ IMPORTANT**: Copy the **Internal Database URL**
   - It looks like: `postgresql://username:password@dpg-xxxxx:5432/voo_ward_db`
   - Save it in your notepad!

#### C. Create Web Service
1. Click **"New +"** → **"Web Service"**
2. Select your **`voo-ward-ussd`** repository
3. Configure:
   - **Name**: `voo-ward-backend`
   - **Region**: Oregon (Free)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

#### D. Add Environment Variables
In the **Environment** section, add these 3 variables:

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | Paste the PostgreSQL Internal URL | From step B.4 |
| `JWT_SECRET` | Generate below ⬇️ | Any random 32+ character string |
| `NODE_ENV` | `production` | Exactly as shown |

**Generate JWT_SECRET:** Run this in PowerShell:
```powershell
-join ((1..48) | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 126) })
```
Copy the output and paste it as JWT_SECRET value.

#### E. Deploy!
1. Click **"Create Web Service"**
2. Wait 3-5 minutes for deployment
3. Watch the logs for "Build successful"
4. Your service will be at: `https://voo-ward-backend.onrender.com`

#### F. Configure Health Check (Optional but Recommended)
1. Go to **Settings** → **Health & Alerts**
2. Set **Health Check Path**: `/health`
3. Save changes

---

### 4️⃣ TEST YOUR DEPLOYMENT (2 minutes)

Once deployment completes, test these URLs in your browser:

**Health Check:**
```
https://voo-ward-backend.onrender.com/health
```
Expected: `{"ok":true,"service":"voo-ward-ussd"}`

**Test USSD Endpoint:**
Open PowerShell and run:
```powershell
$headers = @{"Content-Type" = "application/x-www-form-urlencoded"}
$body = "sessionId=TEST123&serviceCode=*384*44647%23&phoneNumber=%2B254700000000&text="
Invoke-RestMethod -Uri "https://voo-ward-backend.onrender.com/ussd" -Method POST -Headers $headers -Body $body
```
Expected: Language selection menu in Swahili/English/Kamba

---

### 5️⃣ CONFIGURE AFRICA'S TALKING (3 minutes)

1. Log in to: **https://account.africastalking.com**
2. Go to: **Apps** → **Sandbox/Production** → **USSD**
3. Find **"Callback URL"** setting
4. Enter: `https://voo-ward-backend.onrender.com/ussd`
5. Set **Method**: `POST`
6. Click **"Save"**
7. Test by dialing: **`*384*44647#`** (or your assigned code)

---

## 🎉 YOU'RE LIVE!

Your USSD service is now:
- ✅ Deployed on Render (free tier)
- ✅ Accessible via HTTPS
- ✅ Connected to PostgreSQL database
- ✅ Ready for Africa's Talking integration

**Your Live URLs:**
- **Health Check**: https://voo-ward-backend.onrender.com/health
- **USSD Endpoint**: https://voo-ward-backend.onrender.com/ussd
- **Admin Dashboard**: Deploy frontend separately (optional)

---

## ⚠️ IMPORTANT NOTES

### Free Tier Limitations
- **Spin Down**: Service sleeps after 15 minutes of inactivity
- **Cold Start**: Takes ~30 seconds to wake up
- **Database**: Expires after 90 days (backup regularly!)

### Keep Service Alive (Optional)
Use **UptimeRobot** (free):
1. Go to: https://uptimerobot.com
2. Add HTTP(S) monitor
3. URL: `https://voo-ward-backend.onrender.com/health`
4. Interval: Every 5 minutes
5. This pings your service to prevent sleep

### Database Backups
Render's free PostgreSQL expires after 90 days:
1. Set a calendar reminder for 85 days
2. Export your data before expiration
3. Consider upgrading to paid plan ($7/month) for persistence

---

## 🐛 TROUBLESHOOTING

### Service Won't Start
- Check **Logs** tab in Render dashboard
- Verify all 3 environment variables are set
- Ensure `DATABASE_URL` format is correct

### Database Connection Failed
- Verify database is "Available" in Render
- Check `DATABASE_URL` is the **Internal** URL (not External)
- Ensure database and service are in same region (Oregon)

### USSD Returns 404
- Verify callback URL has `/ussd` at the end
- Check service is "Live" (not sleeping)
- Test health endpoint first

### Need Help?
- Render Docs: https://render.com/docs
- Africa's Talking Docs: https://developers.africastalking.com/docs/ussd/overview
- Your full guide: `RENDER_DEPLOYMENT_GUIDE.md`

---

## 📞 NEXT STEPS AFTER DEPLOYMENT

1. **Test with Real Phone**: Dial your USSD code
2. **Monitor Logs**: Watch Render dashboard for activity
3. **Admin Dashboard**: Deploy frontend to Render Static Site (optional)
4. **Custom Domain**: Add your own domain in Render (optional)
5. **Upgrade Plan**: Consider paid plans for always-on service

---

## 💡 PRO TIPS

- **Test in Sandbox First**: Use Africa's Talking sandbox before going live
- **Monitor Usage**: Check Render dashboard for resource usage
- **Set Up Alerts**: Configure Render email alerts for service issues
- **Document Changes**: Keep track of environment variable changes
- **Regular Backups**: Export database monthly

---

**Time to Complete**: ~20 minutes total
**Cost**: $0 (free tier for everything)
**Result**: Production-ready USSD service! 🚀

Good luck with your deployment!

---

## OpenAI assistant (admin)

- To enable OpenAI-powered replies from the admin assistant set the following env vars in your deployment:
   - `OPENAI_API_KEY` = your OpenAI API key (secret)
   - `OPENAI_MODEL` = optional (defaults to `gpt-4o-mini` in the code)

- After adding `OPENAI_API_KEY`, click **Save, rebuild, and deploy** in your host UI so the server process picks up the variable.

- Verify the assistant: log in to the admin dashboard, then check the bottom-right assistant button — a small badge will read `AI: OpenAI` when the key is active, otherwise `AI: Local`.

- Quick test: use `scripts/test-chatbot.ps1` or run the PowerShell commands in the checklist to `POST /api/admin/chatbot` with a bearer token obtained from `/api/auth/login`.

---
