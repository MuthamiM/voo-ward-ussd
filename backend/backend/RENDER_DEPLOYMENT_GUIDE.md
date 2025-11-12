# 🚀 Render Deployment Guide - VOO Kyamatu Ward USSD

## ✅ What's Already Ready

Your backend is **Render-ready** with:
- ✅ `process.env.PORT` support (Render assigns this)
- ✅ PostgreSQL connection via `process.env.DATABASE_URL`
- ✅ Health check endpoint at `/health`
- ✅ Production-ready `npm start` script
- ✅ Express server with USSD routes

---

## 📋 Deployment Steps

### 1️⃣ **Push to GitHub**
```powershell
# From USSD directory
git init
git add .
git commit -m "Initial commit - Voo Ward USSD system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/voo-ward-ussd.git
git push -u origin main
```

### 2️⃣ **Create Render Account**
- Go to: https://render.com
- Sign up (free tier available)
- Connect your GitHub account

### 3️⃣ **Deploy PostgreSQL Database**
1. Click **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name**: `voo-ward-db`
   - **Database**: `voo_db`
   - **User**: `postgres` (auto-generated)
   - **Region**: Oregon (Free)
   - **Plan**: Free
3. Click **"Create Database"**
4. **Copy the Internal Database URL** (starts with `postgresql://`)

### 4️⃣ **Deploy Backend Service**
1. Click **"New +"** → **"Web Service"**
2. Select your GitHub repository
3. Configure:
   - **Name**: `voo-ward-backend`
   - **Region**: Oregon (Free)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 5️⃣ **Set Environment Variables**
In the **Environment** tab, add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Paste the PostgreSQL Internal URL from step 3 |
| `JWT_SECRET` | Generate a random string (e.g., `openssl rand -base64 32`) |
| `MONGO_URI` | Your MongoDB Atlas URI (optional) |

### 6️⃣ **Configure Health Check**
In **Settings** → **Health Check**:
- **Health Check Path**: `/health`
- Save changes

### 7️⃣ **Deploy!**
- Click **"Manual Deploy"** → **"Deploy latest commit"**
- Wait 3-5 minutes for build to complete
- Your service URL will be: `https://voo-ward-backend.onrender.com`

---

## 🔗 Africa's Talking Integration

Once deployed, configure Africa's Talking:

1. Go to: https://account.africastalking.com/apps/sandbox/ussd/
2. Set **Callback URL**:
   ```
   https://voo-ward-backend.onrender.com/ussd
   ```
3. Set **Method**: POST
4. Save and test with: `*384*44647#`

---

## 🧪 Testing Your Deployment

### Health Check
```powershell
Invoke-RestMethod -Uri "https://voo-ward-backend.onrender.com/health"
```

Expected response:
```json
{
  "ok": true,
  "service": "voo-ward-ussd"
}
```

### USSD Endpoint Test
```powershell
$headers = @{"Content-Type" = "application/x-www-form-urlencoded"}
$body = "sessionId=TEST123&serviceCode=*384*44647%23&phoneNumber=%2B254700000000&text="
Invoke-RestMethod -Uri "https://voo-ward-backend.onrender.com/ussd" -Method POST -Headers $headers -Body $body
```

Expected response:
```
CON KYAMATU WARD - FREE SERVICE

Select Language:
1. English
2. Swahili
3. Kamba
```

---

## 📊 Database Setup

After first deployment, you may need to run migrations:

### Option 1: Via Render Shell
1. In Render dashboard → **Shell** tab
2. Run:
   ```bash
   npm run migrate:cloud
   ```

### Option 2: Connect Locally
1. Copy **External Database URL** from Render
2. Update your local `DATABASE_URL`
3. Run migrations from your machine:
   ```powershell
   $env:DATABASE_URL="paste-external-url-here"
   cd backend
   npm run migrate:cloud
   ```

---

## 🆓 Free Tier Limitations

**Render Free Tier:**
- ✅ 750 hours/month (enough for 1 service 24/7)
- ✅ Automatic HTTPS
- ⚠️ Spins down after 15 minutes of inactivity
- ⚠️ Cold start takes ~30 seconds

**PostgreSQL Free Tier:**
- ✅ 1 GB storage
- ✅ 90 days retention
- ⚠️ Database expires after 90 days (backup regularly!)

---

## 🔄 Keep Service Alive (Optional)

To prevent cold starts, use a cron job or uptime monitor:

### UptimeRobot (Free)
1. Go to: https://uptimerobot.com
2. Add monitor:
   - **Type**: HTTP(S)
   - **URL**: `https://voo-ward-backend.onrender.com/health`
   - **Interval**: Every 5 minutes
3. This pings your service to keep it warm

---

## 🐛 Troubleshooting

### Service Won't Start
- Check **Logs** tab in Render dashboard
- Verify all environment variables are set
- Ensure `DATABASE_URL` is correct

### Database Connection Failed
- Verify database is running in Render
- Check `DATABASE_URL` format: `postgresql://user:pass@host:5432/db`
- Ensure database and service are in same region

### USSD Returns 404
- Check callback URL has `/ussd` at the end
- Verify service is running (not cold start)

---

## 📱 Frontend Deployment (Optional)

If you want to deploy the frontend (admin dashboard):

1. **New Static Site**:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Publish Directory: `dist`

2. **Environment Variables**:
   - `VITE_API_URL`: `https://voo-ward-backend.onrender.com`

---

## 🎯 Next Steps

1. ✅ Push code to GitHub
2. ✅ Create Render account
3. ✅ Deploy PostgreSQL database
4. ✅ Deploy backend service
5. ✅ Set environment variables
6. ✅ Test endpoints
7. ✅ Configure Africa's Talking callback URL
8. ✅ Test USSD with real phone

**Your USSD service will be live at:**
```
https://voo-ward-backend.onrender.com/ussd
```

---

## 📞 Support

- Render Docs: https://render.com/docs
- Africa's Talking Docs: https://developers.africastalking.com/docs/ussd/overview

Good luck with your deployment! 🚀
