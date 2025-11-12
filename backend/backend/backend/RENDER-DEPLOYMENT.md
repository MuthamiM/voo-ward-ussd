# 🚀 Render.com Deployment Guide

## ✅ What's Done
- ✓ Production-safe code created (`src/index.js`)
- ✓ Simplified MongoDB client (`src/lib/mongo.js`)
- ✓ Git repository initialized and committed
- ✓ `.gitignore` added (node_modules excluded)

---

## 📋 Step 1: Create GitHub Repository

### Option A: Using GitHub CLI (Recommended)
```powershell
# Login first
gh auth login

# Create private repo and push
gh repo create voo-kyamatu-ussd --private --source . --remote origin --push
```

### Option B: Manual (If GitHub CLI not working)

1. Go to **https://github.com/new**
2. Fill in:
   - Repository name: `voo-kyamatu-ussd`
   - Privacy: **Private**
   - **DO NOT** initialize with README, .gitignore, or license
3. Click **Create repository**
4. In your terminal, run:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/voo-kyamatu-ussd.git
   git branch -M main
   git push -u origin main
   ```

---

## 🌐 Step 2: Deploy to Render.com

1. **Go to https://render.com/** and sign in (or create free account)

2. Click **New +** → **Web Service**

3. **Connect GitHub**:
   - Click "Connect GitHub"
   - Authorize Render to access your repos
   - Search for `voo-kyamatu-ussd` and click "Connect"

4. **Configure Service**:
   ```
   Name:           voo-kyamatu-ussd
   Region:         Oregon (US West) or nearest
   Branch:         main
   Runtime:        Node
   Build Command:  npm ci
   Start Command:  npm start
   ```

5. **Select Free Plan**:
   - Instance Type: **Free** (0.1 CPU, 512 MB RAM)
   - Note: Free tier spins down after 15 min of inactivity

6. **Environment Variables** - Click "Add Environment Variable" and add:

   | Key | Value |
   |-----|-------|
   | `MONGO_URI` | `mongodb+srv://VOOAPP:NeverBroke031@cluster0.lc9fktg.mongodb.net/voo_ward?retryWrites=true&w=majority&appName=Cluster0` |
   | `PORT` | `4000` |
   | `NODE_ENV` | `production` |

7. **Click "Create Web Service"**

---

## ⏳ Step 3: Wait for Deployment

Render will:
- Clone your repo
- Run `npm ci` (install deps)
- Run `npm start`
- Show you real-time logs

**Wait until you see**: ✅ **Live** (green status)

---

## 🎯 Step 4: Get Your Permanent USSD URL

Once live, your permanent callback URL will be:

```
https://voo-kyamatu-ussd.onrender.com/ussd
```

### Test it:
```powershell
# Test health endpoint
Invoke-RestMethod "https://voo-kyamatu-ussd.onrender.com/health" -UseBasicParsing

# Test USSD endpoint
$body = @{
    sessionId = "TEST123"
    phoneNumber = "254700000000"
    text = ""
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://voo-kyamatu-ussd.onrender.com/ussd" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
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

## 📝 Step 5: Give URL to Safaricom

**Share this with Safaricom for USSD registration:**

```
USSD Callback URL: https://voo-kyamatu-ussd.onrender.com/ussd
```

---

## 🔧 Troubleshooting

### If build fails:
1. Check Render logs for errors
2. Verify `package.json` has `"start": "node src/index.js"`
3. Ensure all imports use `require()` not `import`

### If MongoDB connection fails:
1. Verify `MONGO_URI` environment variable is set correctly
2. Check MongoDB Atlas IP whitelist (add `0.0.0.0/0` for all IPs)
3. The app should still respond even if DB is down

### Free tier limitations:
- Spins down after 15 min inactivity
- First request after spindown takes ~30 seconds
- **Upgrade to $7/month for always-on service**

---

## 🎉 Success!

Your USSD service is now live at:
**https://voo-kyamatu-ussd.onrender.com/ussd**

This URL is **permanent** and won't change unless you delete the service.
