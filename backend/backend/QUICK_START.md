# DigitalOcean Deployment - Quick Start Checklist

## ✅ Step-by-Step Guide (30 minutes)

### PART 1: On Your Windows Machine (5 minutes)

**1. Your files are ready!**
```
Location: C:\Users\Admin\USSD\deploy-package
Size: 0.2 MB
Contains: src/, db/, scripts/, package.json, package-lock.json
```

**2. Sign up for DigitalOcean**
- Go to: https://www.digitalocean.com
- Click "Sign Up"
- Use this link for $200 credit: https://m.do.co/c/freecredit
- Complete verification

---

### PART 2: Create Your Server (5 minutes)

**3. Create a Droplet**
- Login to DigitalOcean
- Click **"Create"** → **"Droplets"**
- **Choose Region:** London (best for Kenya)
- **Choose Image:** Ubuntu 22.04 LTS
- **Choose Size:** Basic - $6/month
  - 1 GB RAM / 1 CPU / 25 GB SSD
- **Authentication:** Password (easier for first time)
  - Set a strong root password
- **Hostname:** kyamatu-ussd-prod
- Click **"Create Droplet"**
- **Wait 1-2 minutes**

**4. Note Your IP Address**
```
You'll see something like: 146.190.123.45
WRITE IT DOWN! You need it for everything else.
```

---

### PART 3: Connect & Setup Server (20 minutes)

**5. Connect via SSH**

From PowerShell on Windows:
```powershell
# Replace YOUR_IP with actual IP (e.g., 146.190.123.45)
ssh root@YOUR_IP

# Type 'yes' when asked about fingerprint
# Enter the root password you set
```

You're now on the Ubuntu server! All commands below run **ON THE SERVER**.

---

**6. Update System**
```bash
apt update && apt upgrade -y
```

**7. Install Node.js 20**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

**8. Install PostgreSQL**
```bash
apt install -y postgresql postgresql-contrib

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql
```

**9. Install Nginx & Other Tools**
```bash
apt install -y nginx git

# Install PM2 (process manager)
npm install -g pm2
```

**10. Setup Database**
```bash
# Switch to postgres user and create database
sudo -u postgres psql << EOF
CREATE DATABASE voo_db;
CREATE USER postgres WITH PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE voo_db TO postgres;
\q
EOF

# Configure PostgreSQL authentication
sed -i 's/local   all   postgres   peer/local   all   postgres   md5/' /etc/postgresql/15/main/pg_hba.conf

# Restart PostgreSQL
systemctl restart postgresql

# Test connection
PGPASSWORD='YourSecurePassword123!' psql -h localhost -U postgres -d voo_db -c "SELECT 1;"
```

---

### PART 4: Upload Your Application (Back to Windows)

**11. Upload Files from Windows**

Open **NEW PowerShell window** (keep server SSH connection open in another):

```powershell
cd C:\Users\Admin\USSD

# Upload your application (replace YOUR_IP)
scp -r deploy-package/* root@YOUR_IP:/var/www/kyamatu-ussd/

# Enter root password when prompted
```

---

### PART 5: Configure & Start Application (Back on Server)

**12. Install Dependencies**
```bash
cd /var/www/kyamatu-ussd
npm install --production
```

**13. Create .env File**
```bash
cat > .env << 'EOF'
NODE_ENV=production
DB_URL=postgresql://postgres:YourSecurePassword123!@localhost:5432/voo_db
PORT=4000
JWT_SECRET=CHANGE-THIS-TO-RANDOM-VALUE-$(date +%s | sha256sum | head -c 32)
ADMIN_EXPORT_KEY=kyamatu-secure-2024-CHANGE-THIS

# Rate limiting
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX=30

# Metrics
METRICS_ENABLED=true

# Africa's Talking
VERIFY_SIGNATURE=false
AT_API_KEY=your-api-key-here
EOF

# Make sure to change the passwords and secrets!
nano .env
```

**14. Run Migrations**
```bash
export PGPASSWORD='YourSecurePassword123!'
psql -h localhost -U postgres -d voo_db -f db/migrations/001_preferences.sql
psql -h localhost -U postgres -d voo_db -f db/migrations/002_audit_index.sql

# If you don't have migrations yet, skip this step
```

**15. Start Application with PM2**
```bash
cd /var/www/kyamatu-ussd

# Start the app
pm2 start src/index.js --name kyamatu-ussd

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# IMPORTANT: Copy and run the command that PM2 outputs!

# Check status
pm2 status
pm2 logs kyamatu-ussd
```

**16. Configure Nginx**
```bash
cat > /etc/nginx/sites-available/kyamatu-ussd << 'EOF'
server {
    listen 80;
    server_name YOUR_IP;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Replace YOUR_IP with actual IP
sed -i 's/YOUR_IP/REPLACE_WITH_YOUR_ACTUAL_IP/' /etc/nginx/sites-available/kyamatu-ussd

# Enable site
ln -s /etc/nginx/sites-available/kyamatu-ussd /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx
```

**17. Setup Firewall**
```bash
apt install -y ufw

# Allow SSH (IMPORTANT - don't lock yourself out!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw --force enable

# Check status
ufw status
```

---

### PART 6: Test Your Deployment

**18. Test from Windows**

```powershell
# Replace YOUR_IP with actual IP

# Test health endpoint
Invoke-RestMethod -Uri "http://YOUR_IP/health"

# Test USSD endpoint
$body = 'phoneNumber=254712345678&text='
Invoke-RestMethod -Uri "http://YOUR_IP/ussd" -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded'

# Test metrics
Invoke-RestMethod -Uri "http://YOUR_IP/metrics"
```

**Expected Results:**
- Health: `{"status":"healthy"}`
- USSD: Returns language selection menu
- Metrics: Returns system stats

---

### PART 7: Configure Africa's Talking

**19. Setup Webhook**
- Login to: https://account.africastalking.com
- Go to: **USSD** → **Callback URL**
- Enter: `http://YOUR_IP/ussd` (replace YOUR_IP)
- Click **Save**

**20. Test in Simulator**
- Dashboard → **Sandbox** → **Launch Simulator**
- Dial your USSD code (e.g., `*384*8481#`)
- Test the full menu flow

**21. Apply for Production Short Code**
- Dashboard → **Apply for USSD Code**
- Choose code: `*384*YOUR_CODE#`
- Submit required documents
- Wait for approval (2-7 days)

---

## 🎉 YOU'RE LIVE!

Your USSD system is now running on DigitalOcean!

**Access URLs:**
- Health Check: `http://YOUR_IP/health`
- USSD Webhook: `http://YOUR_IP/ussd`
- Metrics: `http://YOUR_IP/metrics`
- Admin CSV: `http://YOUR_IP/admin/exports/members.csv`

---

## 📊 Useful Commands

### On the Server:

```bash
# View logs
pm2 logs kyamatu-ussd

# Restart application
pm2 restart kyamatu-ussd

# Check application status
pm2 status

# Monitor resources
pm2 monit
htop

# Check Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Check disk space
df -h

# Check memory
free -h

# Restart services
systemctl restart nginx
systemctl restart postgresql
```

---

## 🔄 Deploying Updates

**From Windows:**
```powershell
cd C:\Users\Admin\USSD\backend
scp -r src root@YOUR_IP:/var/www/kyamatu-ussd/
```

**On Server:**
```bash
cd /var/www/kyamatu-ussd
pm2 restart kyamatu-ussd
```

---

## 🆘 Troubleshooting

**Application won't start:**
```bash
pm2 logs kyamatu-ussd  # Check for errors
pm2 restart kyamatu-ussd
```

**Can't connect to database:**
```bash
systemctl status postgresql
PGPASSWORD='YourPassword' psql -h localhost -U postgres -d voo_db
```

**Nginx issues:**
```bash
nginx -t  # Test configuration
systemctl status nginx
tail -f /var/log/nginx/error.log
```

**Port already in use:**
```bash
netstat -tlnp | grep 4000
pm2 stop kyamatu-ussd
pm2 delete kyamatu-ussd
pm2 start src/index.js --name kyamatu-ussd
```

---

## 💰 Monthly Cost

| Item | Cost |
|------|------|
| DigitalOcean Droplet | $6 |
| Africa's Talking USSD | KES 5,000-30,000 |
| **Total** | **~KES 6,000-31,000** |

---

## 📞 Support

- **DigitalOcean:** https://docs.digitalocean.com
- **Africa's Talking:** support@africastalking.com
- **Full Guide:** `backend\DIGITALOCEAN_DEPLOYMENT.md`

---

## ✅ Checklist

- [ ] Created DigitalOcean account
- [ ] Created droplet (Ubuntu 22.04, $6/month)
- [ ] Noted IP address: _________________
- [ ] Connected via SSH
- [ ] Installed Node.js, PostgreSQL, Nginx
- [ ] Uploaded application files
- [ ] Installed npm dependencies
- [ ] Created .env file
- [ ] Started with PM2
- [ ] Configured Nginx
- [ ] Setup firewall
- [ ] Tested endpoints
- [ ] Configured Africa's Talking webhook
- [ ] Tested in simulator
- [ ] Applied for USSD short code

**You're production-ready! 🚀**
