# DigitalOcean Deployment Guide - Kyamatu USSD

Complete step-by-step guide to deploy your USSD system on DigitalOcean.

---

## [LIST] What You'll Get

- **Cost:** $6/month (Basic Droplet)
- **Server:** Ubuntu 22.04 with 1GB RAM, 25GB SSD
- **Full Control:** Root access, custom domain, SSL
- **Reliability:** 99.99% uptime SLA
- **Location:** Choose datacenter (London recommended for Kenya)

---

## [LAUNCH] Step 1: Create DigitalOcean Account

1. Go to https://www.digitalocean.com
2. Sign up (get $200 credit for 60 days with this link: https://m.do.co/c/freecredit)
3. Verify email and add payment method
4. Complete identity verification

---

## [DESKTOP] Step 2: Create a Droplet (5 minutes)

### From DigitalOcean Dashboard

1. **Click "Create" → "Droplets"**

2. **Choose Region:**
   - Select **London** (closest to Kenya, ~40ms latency)
   - Alternative: Frankfurt or Amsterdam

3. **Choose Image:**
   - Select **Ubuntu 22.04 LTS**

4. **Choose Size:**
   - **Basic Plan** → **Regular** → **$6/month**
   - 1 GB RAM / 1 CPU / 25 GB SSD / 1000 GB transfer

5. **Choose Authentication:**
   - **SSH Key** (recommended) or **Password**

   **To create SSH key on Windows:**
   ```powershell
   # Generate SSH key
   ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
   # Press Enter for default location (C:\Users\Admin\.ssh\id_rsa)
   # Set a passphrase (optional)
   
   # Copy public key
   Get-Content C:\Users\Admin\.ssh\id_rsa.pub | clip
   # Paste in DigitalOcean "New SSH Key" field
   ```

6. **Hostname:**
   - Name: `kyamatu-ussd-prod`

7. **Click "Create Droplet"**

Wait 1-2 minutes for droplet to be created. Note the **IP address** (e.g., 146.190.123.45)

---

## [SECURE] Step 3: Connect to Your Server

### From PowerShell

```powershell
# Connect via SSH
ssh root@YOUR_DROPLET_IP

# Example:
ssh root@146.190.123.45

# Type 'yes' when prompted about fingerprint
```

You're now connected to your Ubuntu server!

---

## [TOOL] Step 4: Install Required Software

### On your server (run these commands)

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x

# Install PostgreSQL 15
apt install -y postgresql postgresql-contrib

# Install Nginx (web server / reverse proxy)
apt install -y nginx

# Install Git
apt install -y git

# Install PM2 (process manager for Node.js)
npm install -g pm2
```

---

## [DATABASE] Step 5: Setup Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL console, run:
CREATE DATABASE voo_db;
CREATE USER postgres WITH PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE voo_db TO postgres;
\q

# Edit PostgreSQL config to allow connections
nano /etc/postgresql/15/main/pg_hba.conf

# Change this line:
# local   all   postgres   peer
# TO:
# local   all   postgres   md5

# Save (Ctrl+O, Enter) and exit (Ctrl+X)

# Restart PostgreSQL
systemctl restart postgresql
```

---

## [PACKAGE] Step 6: Deploy Your Application

### Option A: From GitHub (Recommended)

```bash
# Navigate to web directory
cd /var/www

# Clone your repository (if you have one)
git clone https://github.com/yourusername/kyamatu-ussd.git
cd kyamatu-ussd/backend

# Install dependencies
npm install
```

### Option B: Upload from Your Computer

**On your Windows machine:**

```powershell
# Navigate to your project
cd C:\Users\Admin\USSD

# Upload backend to server
scp -r backend root@YOUR_DROPLET_IP:/var/www/kyamatu-ussd/

# Example:
scp -r backend root@146.190.123.45:/var/www/kyamatu-ussd/
```

**Back on the server:**

```bash
cd /var/www/kyamatu-ussd/backend
npm install
```

---

## [TOOL] Step 7: Configure Environment Variables

```bash
# Create .env file
cd /var/www/kyamatu-ussd/backend
nano .env
```

**Add this content:**

```env
NODE_ENV=production
DB_URL=postgresql://postgres:YourSecurePassword123!@localhost:5432/voo_db
PORT=4000
JWT_SECRET=your-random-secret-here-change-this
ADMIN_EXPORT_KEY=kyamatu-secure-2024-change-this

# Rate limiting
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX=30

# Metrics
METRICS_ENABLED=true

# Africa's Talking (optional)
VERIFY_SIGNATURE=false
AT_API_KEY=your-api-key-here
```

**Save:** Ctrl+O, Enter, Ctrl+X

---

## [RUN] Step 8: Run Database Migrations

```bash
cd /var/www/kyamatu-ussd/backend

# Set environment
export PGPASSWORD='YourSecurePassword123!'
export DB_URL='postgresql://postgres:YourSecurePassword123!@localhost:5432/voo_db'

# Run migrations (if you have any)
psql -h localhost -U postgres -d voo_db -f db/migrations/001_preferences.sql
psql -h localhost -U postgres -d voo_db -f db/migrations/002_audit_index.sql
```

---

## [LAUNCH] Step 9: Start Application with PM2

```bash
cd /var/www/kyamatu-ussd/backend

# Start application
pm2 start src/index.js --name kyamatu-ussd

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Copy and run the command that PM2 outputs

# Check status
pm2 status
pm2 logs kyamatu-ussd

# Useful PM2 commands:
# pm2 restart kyamatu-ussd  # Restart app
# pm2 stop kyamatu-ussd     # Stop app
# pm2 logs kyamatu-ussd     # View logs
# pm2 monit                 # Monitor all processes
```

---

## [NETWORK] Step 10: Configure Nginx (Reverse Proxy)

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/kyamatu-ussd
```

**Add this content:**

```nginx
server {
    listen 80;
    server_name YOUR_DROPLET_IP;  # Change to your domain later

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/kyamatu-ussd-access.log;
    error_log /var/log/nginx/kyamatu-ussd-error.log;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no buffering)
    location /health {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        access_log off;
    }

    # Metrics endpoint (optional - restrict access)
    location /metrics {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        # Uncomment to restrict by IP:
        # allow YOUR_OFFICE_IP;
        # deny all;
    }
}
```

**Save:** Ctrl+O, Enter, Ctrl+X

```bash
# Enable the site
ln -s /etc/nginx/sites-available/kyamatu-ussd /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# If OK, restart Nginx
systemctl restart nginx

# Enable Nginx to start on boot
systemctl enable nginx
```

---

## [LOCKED] Step 11: Install SSL Certificate (HTTPS)

### With Certbot (Let's Encrypt - FREE)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate (if you have a domain)
certbot --nginx -d ussd.kyamatu.co.ke

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose: Redirect HTTP to HTTPS (option 2)

# Auto-renewal test
certbot renew --dry-run

# Certificate auto-renews every 90 days
```

**If you don't have a domain yet:**
- Use HTTP for now (http://YOUR_DROPLET_IP)
- Add SSL later when you get a domain

---

## [TEST] Step 12: Test Your Deployment

### From your Windows machine

```powershell
# Test health endpoint
Invoke-RestMethod -Uri "http://YOUR_DROPLET_IP/health"

# Test USSD endpoint
$body = 'phoneNumber=254712345678&text='
Invoke-RestMethod -Uri "http://YOUR_DROPLET_IP/ussd" -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded'

# Test metrics
Invoke-RestMethod -Uri "http://YOUR_DROPLET_IP/metrics"
```

**Expected Results:**
- Health: `{"status":"healthy","uptime":123}`
- USSD: Returns language selection menu
- Metrics: Returns system metrics JSON

---

## [GLOBAL] Step 13: Configure Africa's Talking

1. **Login to Africa's Talking Dashboard**
   - https://account.africastalking.com

2. **Go to USSD → Callback URL**

3. **Enter your webhook URL:**
   - If using IP: `http://YOUR_DROPLET_IP/ussd`
   - If using domain: `https://ussd.kyamatu.co.ke/ussd`

4. **Test in Simulator:**
   - Apps → Simulator
   - Dial your USSD code
   - Test full flow

5. **Apply for Short Code:**
   - Dashboard → Apply for USSD Code
   - Choose: `*384*8481#` (or available)
   - Submit required documents

---

## [STATS] Step 14: Setup Monitoring

### Server Monitoring

```bash
# Install htop (system monitor)
apt install -y htop

# Check system resources
htop

# Check disk space
df -h

# Check memory
free -h

# Check logs
pm2 logs kyamatu-ussd
tail -f /var/log/nginx/kyamatu-ussd-access.log
```

### Uptime Monitoring (Free)

1. **Sign up at UptimeRobot:** https://uptimerobot.com
2. **Add Monitor:**
   - Type: HTTP(s)
   - URL: `http://YOUR_DROPLET_IP/health`
   - Interval: 5 minutes
   - Alert contacts: Your email/SMS

### Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# Or use PM2 Plus (free tier)
pm2 plus

# Follow instructions to connect
```

---

## [DATABASE] Step 15: Setup Automated Backups

### Database Backups

```bash
# Create backup directory
mkdir -p /var/backups/postgres

# Create backup script
nano /usr/local/bin/backup-db.sh
```

**Add this content:**

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/postgres"
DB_NAME="voo_db"
DB_USER="postgres"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M)

# Create backup
export PGPASSWORD='YourSecurePassword123!'
pg_dump -h localhost -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz

# Remove old backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: ${DB_NAME}_${DATE}.sql.gz"
```

**Save and make executable:**

```bash
chmod +x /usr/local/bin/backup-db.sh

# Test backup
/usr/local/bin/backup-db.sh

# Check backup
ls -lh /var/backups/postgres
```

### Schedule Daily Backups

```bash
# Edit crontab
crontab -e

# Add this line (backup daily at 2 AM)
0 2 * * * /usr/local/bin/backup-db.sh >> /var/log/backup.log 2>&1

# Save and exit
```

### Optional: Upload Backups to DigitalOcean Spaces

```bash
# Install s3cmd
apt install -y s3cmd

# Configure (you'll need Spaces access keys)
s3cmd --configure

# Modify backup script to upload
nano /usr/local/bin/backup-db.sh

# Add at the end:
# s3cmd put $BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz s3://your-bucket-name/backups/
```

---

## [FIREWALL] Step 16: Setup Firewall

```bash
# Install UFW (Uncomplicated Firewall)
apt install -y ufw

# Allow SSH (important - don't lock yourself out!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow PostgreSQL (only from localhost)
# ufw allow from 127.0.0.1 to any port 5432

# Enable firewall
ufw enable

# Check status
ufw status
```

---

## [PERFORMANCE] Performance Optimization

### Enable Gzip Compression

```bash
nano /etc/nginx/nginx.conf

# Add in http block:
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

# Restart Nginx
systemctl restart nginx
```

### Increase PM2 Instances (if needed)

```bash
# Stop current instance
pm2 stop kyamatu-ussd

# Start in cluster mode (uses all CPU cores)
pm2 start src/index.js --name kyamatu-ussd -i max

# Save configuration
pm2 save
```

---

## [HELP] Troubleshooting

### Application won't start

```bash
# Check logs
pm2 logs kyamatu-ussd

# Check if port is in use
netstat -tlnp | grep 4000

# Check environment variables
pm2 show kyamatu-ussd

# Restart
pm2 restart kyamatu-ussd
```

### Database connection fails

```bash
# Test PostgreSQL
psql -h localhost -U postgres -d voo_db

# Check PostgreSQL status
systemctl status postgresql

# Check logs
tail -f /var/log/postgresql/postgresql-15-main.log
```

### Nginx issues

```bash
# Check Nginx status
systemctl status nginx

# Test configuration
nginx -t

# Check logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/kyamatu-ussd-error.log
```

### High memory usage

```bash
# Check processes
htop

# Check PM2 memory
pm2 monit

# Restart application
pm2 restart kyamatu-ussd
```

---

## [RELOAD] Deploying Updates

### Method 1: Git Pull (if using GitHub)

```bash
cd /var/www/kyamatu-ussd/backend
git pull origin main
npm install  # If dependencies changed
pm2 restart kyamatu-ussd
```

### Method 2: SCP Upload

**From your Windows machine:**

```powershell
cd C:\Users\Admin\USSD
scp -r backend/src root@YOUR_DROPLET_IP:/var/www/kyamatu-ussd/backend/
```

**On the server:**

```bash
pm2 restart kyamatu-ussd
```

### Zero-Downtime Deployment

```bash
# Reload instead of restart (graceful reload)
pm2 reload kyamatu-ussd
```

---

## [COST] Cost Breakdown

| Item | Cost (USD/month) |
|------|------------------|
| Droplet (1GB RAM) | $6.00 |
| Backups (Optional) | $1.20 |
| Spaces (Optional) | $5.00 |
| Domain (Optional) | $1.00 |
| **Total** | **$6-13** |

**Kenyan Equivalent:** ~KES 800-1,700/month

---

## [NOTE] Quick Command Reference

```bash
# Application Management
pm2 status                    # Check status
pm2 logs kyamatu-ussd        # View logs
pm2 restart kyamatu-ussd     # Restart app
pm2 stop kyamatu-ussd        # Stop app
pm2 monit                    # Monitor resources

# System Management
systemctl status nginx       # Nginx status
systemctl status postgresql  # PostgreSQL status
htop                        # System monitor
df -h                       # Disk space
free -h                     # Memory usage

# Logs
tail -f /var/log/nginx/kyamatu-ussd-access.log  # Nginx access
tail -f /var/log/nginx/kyamatu-ussd-error.log   # Nginx errors
pm2 logs kyamatu-ussd --lines 100               # App logs

# Database
psql -h localhost -U postgres -d voo_db         # Connect to DB
pg_dump voo_db | gzip > backup.sql.gz          # Manual backup

# Firewall
ufw status                   # Check firewall
ufw allow 80/tcp            # Open port 80
ufw deny 8080/tcp           # Close port 8080
```

---

## [TARGET] Next Steps

1. [SUCCESS] **Deploy to DigitalOcean** (you're here!)
2. [PENDING] **Test thoroughly** in Africa's Talking simulator
3. [PENDING] **Apply for USSD short code**
4. [PENDING] **Get custom domain** (optional but recommended)
5. [PENDING] **Setup monitoring alerts**
6. [PENDING] **Configure automated backups**
7. [PENDING] **Go live!** [LAUNCH]

---

## [SUPPORT] Support

- **DigitalOcean Docs:** https://docs.digitalocean.com
- **Community:** https://www.digitalocean.com/community
- **Support:** Create ticket in dashboard
- **Africa's Talking:** support@africastalking.com

---

## [SECURE] Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Generate secure JWT_SECRET and ADMIN_EXPORT_KEY
- [ ] Setup UFW firewall
- [ ] Install SSL certificate (if using domain)
- [ ] Disable root SSH login (use sudo user instead)
- [ ] Setup automated backups
- [ ] Enable fail2ban (brute force protection)
- [ ] Regular updates: `apt update && apt upgrade`
- [ ] Monitor logs regularly
- [ ] Setup uptime monitoring

---

## [SUCCESS] You're Production-Ready

Your USSD system is now deployed on DigitalOcean with:
- [SUCCESS] Full control over infrastructure
- [SUCCESS] Automatic restarts with PM2
- [SUCCESS] Nginx reverse proxy
- [SUCCESS] SSL/HTTPS support
- [SUCCESS] Automated backups
- [SUCCESS] Process monitoring
- [SUCCESS] Professional setup

**Webhook URL for Africa's Talking:**
```
http://YOUR_DROPLET_IP/ussd
```

Or with domain:
```
https://ussd.kyamatu.co.ke/ussd
```

Good luck! [LAUNCH]
