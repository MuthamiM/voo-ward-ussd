# Quick Deployment Options for Kyamatu USSD

## 🚀 Fast & Free Options (Ready in 5-10 minutes)

### Option 1: Cloudflare Tunnel (RECOMMENDED - Already Installed!)
**Cost:** FREE forever  
**URL:** Permanent  
**Best for:** Production-ready immediately

```powershell
cd C:\Users\Admin\USSD\backend

# Start with Cloudflare instead of ngrok
.\launch-production.ps1 -UseCloudflare
```

**Advantages:**
- ✅ Already installed on your system
- ✅ Free forever (no credit card)
- ✅ Permanent URL (doesn't change)
- ✅ DDoS protection built-in
- ✅ Automatic HTTPS
- ✅ No bandwidth limits

**Webhook URL:** `https://your-tunnel-name.trycloudflare.com/ussd`

---

### Option 2: Heroku (Free Tier)
**Cost:** FREE (or $5/month for always-on)  
**Setup Time:** 10 minutes

```powershell
# Install Heroku CLI
winget install Heroku.HerokuCLI

# Login and deploy
cd C:\Users\Admin\USSD\backend
heroku login
heroku create kyamatu-ussd

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-here
heroku config:set ADMIN_EXPORT_KEY=kyamatu-secure-2024

# Deploy
git init
git add .
git commit -m "Initial deployment"
git push heroku main

# Get your URL
heroku info
```

**Webhook URL:** `https://kyamatu-ussd.herokuapp.com/ussd`

**Advantages:**
- ✅ Professional hosting
- ✅ Free PostgreSQL database included
- ✅ Automatic SSL
- ✅ Easy to scale
- ✅ Logs and monitoring built-in

---

### Option 3: Railway.app
**Cost:** $5/month  
**Setup Time:** 5 minutes

1. Go to https://railway.app
2. Click "Deploy from GitHub"
3. Connect your GitHub repo
4. Add PostgreSQL database (1-click)
5. Set environment variables in dashboard
6. Deploy!

**Webhook URL:** `https://kyamatu-ussd.railway.app/ussd`

**Advantages:**
- ✅ Simplest deployment (no CLI needed)
- ✅ PostgreSQL included
- ✅ $5 free credit monthly
- ✅ Great developer experience

---

## 🏢 Production-Grade Options

### Option 4: DigitalOcean Droplet
**Cost:** $6/month  
**Full control, traditional server**

```bash
# On your droplet (Ubuntu 22.04)
# Install Node.js and PostgreSQL
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-contrib nginx

# Clone your code
git clone https://github.com/your-repo/kyamatu-ussd.git
cd kyamatu-ussd/backend
npm install

# Setup PostgreSQL
sudo -u postgres createdb voo_db
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '23748124';"

# Setup systemd service for auto-restart
sudo nano /etc/systemd/system/ussd.service
```

**Service file:**
```ini
[Unit]
Description=Kyamatu USSD Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/kyamatu-ussd/backend
Environment="DB_URL=postgresql://postgres:23748124@localhost:5432/voo_db"
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStart=/usr/bin/node src/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable ussd
sudo systemctl start ussd

# Setup Nginx reverse proxy
sudo nano /etc/nginx/sites-available/ussd
```

**Nginx config:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/ussd /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install SSL certificate (free)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

**Webhook URL:** `https://your-domain.com/ussd`

---

### Option 5: AWS EC2 (Free Tier 12 months)
**Cost:** FREE for 1 year, then ~$10/month  
**Same setup as DigitalOcean**

1. Launch t2.micro instance (Ubuntu 22.04)
2. Open port 80 and 443 in Security Groups
3. Follow DigitalOcean instructions above

---

### Option 6: Render.com
**Cost:** FREE tier available  
**Setup Time:** 5 minutes

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repo
4. Add PostgreSQL database (free tier)
5. Set environment variables
6. Deploy!

**Webhook URL:** `https://kyamatu-ussd.onrender.com/ussd`

**Advantages:**
- ✅ Free tier (sleeps after inactivity)
- ✅ Auto-deploy on git push
- ✅ PostgreSQL included
- ✅ Easy to upgrade to paid ($7/month)

---

## 📊 Quick Comparison

| Option | Cost/Month | Setup Time | Permanent URL | Best For |
|--------|------------|------------|---------------|----------|
| **Cloudflare Tunnel** | FREE | 2 min | ✅ Yes | Quick production |
| **Ngrok (Free)** | FREE | 2 min | ❌ Changes | Testing only |
| **Ngrok (Paid)** | $8 | 2 min | ✅ Yes | Small production |
| **Heroku** | FREE-$5 | 10 min | ✅ Yes | Easy start |
| **Railway** | $5 | 5 min | ✅ Yes | Simplest |
| **Render** | FREE-$7 | 5 min | ✅ Yes | Auto-deploy |
| **DigitalOcean** | $6 | 30 min | ✅ Yes | Full control |
| **AWS EC2** | FREE-$10 | 30 min | ✅ Yes | Enterprise |

---

## 🎯 My Recommendations

### For Testing (Right Now):
```powershell
cd C:\Users\Admin\USSD\backend
.\launch-production.ps1 -UseCloudflare
```
- ✅ Free forever
- ✅ Takes 2 minutes
- ✅ Already installed
- ✅ Production-ready

### For Production (Long-term):
1. **Best for Ease:** Railway.app ($5/month)
2. **Best for Budget:** Render.com (free tier)
3. **Best for Scale:** DigitalOcean ($6/month)

---

## 🚦 Quick Start Commands

### Cloudflare (RIGHT NOW - 2 minutes):
```powershell
cd C:\Users\Admin\USSD\backend
.\launch-production.ps1 -UseCloudflare
# Copy the trycloudflare.com URL
# Paste in Africa's Talking webhook
```

### Heroku (10 minutes):
```powershell
winget install Heroku.HerokuCLI
cd C:\Users\Admin\USSD\backend
heroku login
heroku create kyamatu-ussd
heroku addons:create heroku-postgresql:mini
git init
git add .
git commit -m "Deploy"
git push heroku main
```

### Railway (5 minutes via browser):
1. https://railway.app → Sign up
2. "New Project" → "Deploy from GitHub"
3. Add PostgreSQL → Set env vars → Deploy
4. Copy URL

---

## 💡 What I Recommend RIGHT NOW

**Use Cloudflare Tunnel for immediate production:**

1. Run: `.\launch-production.ps1 -UseCloudflare`
2. You get URL like: `https://abc-def-ghi.trycloudflare.com`
3. That URL is **permanent** and **free forever**
4. Configure in Africa's Talking webhook
5. Start receiving calls immediately

**Then migrate to Railway/DigitalOcean later when you want:**
- Custom domain (kyamatu.co.ke)
- Advanced monitoring
- Multiple environments (staging/production)

---

## 📱 Next Steps After Deployment

1. **Test in Africa's Talking Simulator:**
   - Login to AT dashboard
   - Go to USSD → Simulator
   - Enter your webhook URL
   - Test full flow

2. **Apply for USSD Short Code:**
   - AT Dashboard → USSD → Apply
   - Choose code: `*384*8481#` or similar
   - Submit documents
   - Wait for approval (2-7 days)

3. **Monitor Your Service:**
   - Check: `https://your-url/metrics`
   - Set up UptimeRobot for downtime alerts
   - Monitor logs

---

## 🔧 Troubleshooting

**If Cloudflare tunnel disconnects:**
```powershell
# Just restart the script
.\launch-production.ps1 -UseCloudflare
```

**If you need a custom domain:**
```powershell
# Use Cloudflare Argo Tunnel with your domain
cloudflared tunnel create kyamatu-ussd
cloudflared tunnel route dns kyamatu-ussd ussd.kyamatu.co.ke
cloudflared tunnel --url http://localhost:4000 --hostname ussd.kyamatu.co.ke
```

---

## 📞 Support

- **Africa's Talking:** support@africastalking.com
- **Cloudflare:** https://community.cloudflare.com
- **Heroku:** https://help.heroku.com
- **Railway:** https://railway.app/help

