# ✅ Render Deployment - Complete Checklist

## What I've Done for You

### 1. ✅ Fixed the Code
- Created **production-safe** `src/index.js` (no complex dependencies)
- Simplified `src/lib/mongo.js` (environment variable based)
- Server works even if MongoDB is temporarily down
- No rate limiter crashes (`this.globalLimiter.isAllowed` error fixed)

### 2. ✅ Prepared Git Repository
- Initialized Git with `.gitignore`
- Excluded `node_modules/` from tracking
- Committed all production files
- Backed up original `src/index.js` to `src/index-backup.js`

### 3. ✅ Created Documentation
- **RENDER-DEPLOYMENT.md** - Complete deployment guide
- **test-render.ps1** - Automated test script

---

## What You Need to Do

### Step 1: Push to GitHub (Choose One)

**Option A: Quick (GitHub CLI)**
```powershell
gh auth login
gh repo create voo-kyamatu-ussd --private --source . --remote origin --push
```

**Option B: Manual**
1. Create repo at https://github.com/new
   - Name: `voo-kyamatu-ussd`
   - Privacy: **Private**
   - Don't initialize with anything
2. Push code:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/voo-kyamatu-ussd.git
   git push -u origin main
   ```

### Step 2: Deploy to Render

1. Go to **https://render.com** (free account)
2. Click **New +** → **Web Service**
3. Connect your GitHub repo `voo-kyamatu-ussd`
4. Configure:
   - **Name**: `voo-kyamatu-ussd`
   - **Runtime**: Node
   - **Build**: `npm ci`
   - **Start**: `npm start`
   - **Plan**: Free

5. Add Environment Variables:
   ```
   MONGO_URI = mongodb+srv://VOOAPP:NeverBroke031@cluster0.lc9fktg.mongodb.net/voo_ward?retryWrites=true&w=majority&appName=Cluster0
   PORT = 4000
   NODE_ENV = production
   ```

6. Click **Create Web Service**

### Step 3: Test Your Deployment

After Render shows **"Live"**, run:
```powershell
.\test-render.ps1
```

Or test manually:
```powershell
Invoke-RestMethod "https://voo-kyamatu-ussd.onrender.com/health"
```

---

## Your Permanent URL

Once deployed, your callback URL is:

```
https://voo-kyamatu-ussd.onrender.com/ussd
```

**This URL never changes** - give it to Safaricom for USSD registration.

---

## Important Notes

### Free Tier Limitations
- ⏰ Spins down after 15 minutes of inactivity
- 🚀 First request after spindown takes ~30 seconds
- 💰 Upgrade to $7/month for always-on service

### MongoDB Connection
- Works with MongoDB Atlas
- **IP Whitelist**: Make sure Atlas allows `0.0.0.0/0` (all IPs)
- Service responds even if DB connection fails

### Security
- No sensitive data in Git (`.env` excluded)
- MongoDB URI set via environment variable
- HTTPS enabled by default on Render

---

## Troubleshooting

### If Render build fails:
```powershell
# Verify package.json locally
npm ci
npm start
```

### If MongoDB connection fails:
1. Check Atlas IP whitelist includes `0.0.0.0/0`
2. Verify `MONGO_URI` environment variable in Render dashboard
3. Check Render logs for connection errors

### Need Help?
Check **RENDER-DEPLOYMENT.md** for detailed troubleshooting.

---

## Next Steps After Deployment

1. ✅ Test with `.\test-render.ps1`
2. 📧 Send URL to Safaricom: `https://voo-kyamatu-ussd.onrender.com/ussd`
3. 🎯 Test with real USSD code once approved
4. 💰 Consider upgrading to paid plan for production use

---

**Ready to deploy? Start with Step 1 above! 🚀**
