# 🏛️ VOO Kyamatu Ward - USSD Service Platform# 🔒 Voo Kyamatu Ward Development Platform



Production USSD platform for Kyamatu Ward citizen services deployed on Render.com.Production-grade USSD + SMS + Offline Admin with **Enterprise Security** for rural ward development.



## 🚀 Live Services## 🛡️ SECURITY STATUS: MAXIMUM PROTECTION

- **🔐 AES-256-GCM Encryption** for all PII data

| Service | URL | Status |- **🛡️ Progressive Rate Limiting** with IP blocking  

|---------|-----|--------|- **📋 GDPR + Kenya DPA Compliance** with automated reporting

| **USSD API** | https://voo-ward-ussd.onrender.com/ussd | ✅ LIVE |- **🔍 Real-time Security Monitoring** with audit logging

| **Admin Dashboard** | Deploy separately | ⏳ Deploy guide below |- **⚡ Advanced Input Validation** against injection attacks



## 📋 What This Platform Provides## Architecture



Citizens can access ward services via USSD (*XXX#):### Components

- 📝 Register as ward constituents

- 📋 Report issues (roads, water, security, health)- **Backend**: Fastify (Node.js 20) on port 4000

- 🎓 Apply for education bursaries  - USSD handler (*340*75#)

- 📢 View ward announcements  - JWT admin API

- 🏗️ Check ongoing projects  - PostgreSQL integration

  - Structured logging (pino)

MCA can manage via Admin Dashboard:  

- View all reported issues- **Frontend**: React 18 + Vite 5 on port 5173

- Review bursary applications (with school details)  - Offline-capable PWA

- Manage announcements  - Admin dashboard

- Export data as CSV  - Service Worker cache



## 🛠️ Technology- **Databases**

  - **Cloud**: PostgreSQL 14+ (primary)

- **Backend:** Express.js 5 (Node.js)  - **Edge**: SQLite WAL (Raspberry Pi, offline-first)

- **Database:** MongoDB Atlas

- **Hosting:** Render.com (free tier, upgradeable)### Sync Strategy

- **Languages:** English, Swahili, Kamba

- Edge SQLite maintains full data copy with WAL mode

## 📦 Repository Structure- 5-minute sync job exports NDJSON to cloud

- Cloud upserts by unique keys (last-write-wins)

```- Offline queue preserved; no data loss

voo-ward-ussd/

├── backend/                       # Production backend## Quick Start

│   ├── src/

│   │   ├── index.js              # USSD API (Safaricom callback)### Backend

│   │   ├── admin-dashboard.js    # MCA Admin Portal

│   │   ├── lib/                  # MongoDB, logging, validation\\\ash

│   │   └── middleware/           # Security, rate limitingcd backend

│   ├── package.json              # Express + MongoDB onlynpm install

│   ├── .env.example              # Environment templatenpm run migrate:cloud        # Init PostgreSQL

│   └── README.md                 # Technical documentationnpm run start                # Start on :4000

│\\\

├── SAFARICOM-APPLICATION.md      # Service application form

├── SAFARICOM-REQUEST-LETTER.MD   # Formal request letter### Frontend

├── TECHNICAL-INTEGRATION.md      # Integration specs for Safaricom

├── ADMIN-DASHBOARD-DEPLOY.md     # MCA dashboard deployment\\\ash

├── PRODUCTION-CLEAN.md           # Cleanup summarycd frontend

└── README.md                     # This filenpm install

```npm run dev                  # Start on :5173

\\\

## 🚀 Quick Start

### Health Check

### Run Locally

\\\ash

```bashcurl <http://localhost:4000/health>

# Clone repository

git clone https://github.com/MusaMuthami1/voo-ward-ussd.git# { ok: true, ussd: '*340*75#' }

cd voo-ward-ussd/backend

\\\

# Install dependencies

npm install## Directory Structure



# Create .env file\\\

cp .env.example .env.

# Edit .env and add MONGO_URI backend/

    src/

# Start USSD server       index.js             # Fastify server

npm start       lib/                 # Utilities (logger, crypto, db, validators)

# Runs on http://localhost:4000       routes/              # USSD, admin, sync endpoints

    migrations/              # SQL migrations (cloud + edge)

# Or start Admin Dashboard    bin/                     # CLI tools

npm run admin    package.json

# Runs on http://localhost:5000    Makefile

```    .env



### Deploy to Production frontend/

    src/

See deployment guides:       App.jsx              # Admin dashboard

- **USSD API:** Already deployed to https://voo-ward-ussd.onrender.com       main.jsx

- **Admin Dashboard:** See [ADMIN-DASHBOARD-DEPLOY.md](ADMIN-DASHBOARD-DEPLOY.md)       index.css

    index.html

## 📱 USSD Flow    vite.config.js

    package.json

```

Dial *XXX# docs/

    api.md                   # Endpoint reference

Step 1: Language Selection    1. English    2. Swahili    3. Kamba README.md

\\\

Step 2: Main Menu

   1. Register as Constituent## Production Checklist

   2. Report an Issue

      → Roads, Water, Security, Health, Other- [ ] Set JWT_KEY in /etc/voo-ward/jwt_key (root-owned, 0400)

   3. View Announcements- [ ] Set AT_API_KEY in /etc/voo-ward/at_api_key

   4. Projects- [ ] Configure PostgreSQL: DB_URL=/etc/voo-ward/db_url

```- [ ] Install systemd service: \make install-systemd\

- [ ] Enable nightly backups: \in/backup-cloud\

## 🔌 Integration- [ ] Set up edge sync timer: \systemctl enable voo-ward-sync.timer\

- [ ] CORS restricted to 127.0.0.1 (admin) or ward LAN

### For Safaricom- [ ] Rate limiting: 10 USSD/SMS per phone per minute



**Callback URL:** `https://voo-ward-ussd.onrender.com/ussd`## 🔒 Enterprise Security Features



**Request Format:**### Implemented Security Enhancements (November 2025)

```http- **AES-256-GCM Encryption**: Field-level PII encryption at rest

POST /ussd HTTP/1.1- **Progressive Rate Limiting**: Multi-tier protection (USSD: 10/10s, Admin: 20/20s, Global: 100/1s)

Content-Type: application/x-www-form-urlencoded- **IP Blocking**: Automatic 24-hour blocks after 10 failed attempts

- **Enhanced Authentication**: bcrypt cost 14, JWT 8-hour expiration

sessionId=SESSION123&phoneNumber=254712345678&text=1*2- **Input Validation**: SQL injection and XSS protection with pattern detection

```- **Audit Logging**: Comprehensive security event tracking with severity levels

- **Privacy Protection**: GDPR Article 25 compliance with data subject rights

**Response Format:**- **Real-time Monitoring**: Security dashboard with automated threat detection

```

CON Menu text...    # Continue session### Security Testing

END Final message   # End session```bash

```# Verify all security features

node backend/test-security.js

**Documentation:**

- [SAFARICOM-APPLICATION.md](SAFARICOM-APPLICATION.md) - Service details# Expected output: MAXIMUM PROTECTION status

- [TECHNICAL-INTEGRATION.md](TECHNICAL-INTEGRATION.md) - Technical specs```

- [SAFARICOM-REQUEST-LETTER.md](SAFARICOM-REQUEST-LETTER.md) - Formal request

### Security Documentation

## 🗄️ Database Schema- **Full Security Guide**: [SECURITY_DOCUMENTATION.md](./SECURITY_DOCUMENTATION.md)

- **Environment Setup**: Production-grade security keys configured

### MongoDB Collections- **Compliance Reports**: Automated GDPR/Kenya DPA reporting available



**constituents**## Compliance

- Phone number, National ID, Full name

- Location, Sub-location, Village- **GDPR/Kenya DPA 2019**: Enhanced with automated compliance reporting and data retention

- Registration timestamp- **Security**: Multi-layer protection with AES-256-GCM, progressive rate limiting, IP blocking

- **Privacy**: Data subject rights implementation (access, rectification, erasure, portability)

**issues**- **Auditing**: Enhanced logging with security event tracking and admin change monitoring

- Ticket (ISS-001, ISS-002...)- **Availability**: 99.9% SLA via edge caching + cloud sync + security protection

- Category, Message, Status- **Recovery**: Automated daily backups to encrypted store with security event preservation

- Reporter phone, Timestamp

## Support

**bursary_applications**

- Reference code (BUR-001...)Email: <voo-ward-support@example.com>

- Student name, Institution, Amount
- Status, Applicant phone, Timestamp

**announcements**
- Title, Body, Timestamp

## 🔒 Security

- HTTPS only (TLS 1.2+)
- Rate limiting on all endpoints
- Input validation and sanitization
- MongoDB connection encryption
- Environment variables for secrets

## 📊 Monitoring

**Health Checks:**
```bash
# USSD API
curl https://voo-ward-ussd.onrender.com/health

# Admin Dashboard (after deployment)
curl https://your-admin-url.onrender.com/health
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [backend/README.md](backend/README.md) | Technical API documentation |
| [ADMIN-DASHBOARD-DEPLOY.md](ADMIN-DASHBOARD-DEPLOY.md) | Deploy MCA dashboard |
| [PRODUCTION-CLEAN.md](PRODUCTION-CLEAN.md) | Production cleanup summary |
| [RENDER-DEPLOYMENT.md](backend/RENDER-DEPLOYMENT.md) | Render.com deployment |
| [SAFARICOM-APPLICATION.md](SAFARICOM-APPLICATION.md) | Service application |
| [TECHNICAL-INTEGRATION.md](TECHNICAL-INTEGRATION.md) | Integration guide |

## 🔑 Admin Password Recovery & Login Troubleshooting

If you cannot log in to the admin dashboard, follow these steps:

### 1. Ensure MongoDB Connection

Set your MongoDB URI in your environment before starting the server:

```powershell
$env:MONGO_URI = "<your-mongodb-uri>"
```

### 2. Reset the Admin Password

Use the provided script to reset the admin user password:

```powershell
$env:MONGO_URI = "<your-mongodb-uri>"
$env:ADMIN_PASS = "yournewpassword"  # Optional, default is admin123
node .\backend\scripts\reset-admin.js
```

This will create or update the `admin` user with the password you specify.

### 3. Start the Main Server

Always start the main server, not the dashboard directly:

```powershell
node src/index.js
```

The dashboard will be available at: [http://localhost:4000/admin-dashboard.html](http://localhost:4000/admin-dashboard.html)

### 4. Change Password from Dashboard

After login, use the "Change Password" button in the dashboard navbar to set a new password securely.

### 5. Common Issues

- **404 on /api/admin/**: Make sure you are running only `src/index.js` and not `admin-dashboard.js` directly.
- **MONGO_URI not set**: Set your MongoDB URI as shown above.
- **Password not working**: Reset using the script, then log in and change it from the dashboard.

---

## 🛠️ Development

**Dependencies:**
- Node.js 18+
- MongoDB Atlas account (free tier works)

**Install:**
```bash
cd backend
npm install
```

**Run:**
```bash
npm start        # USSD API on :4000
npm run admin    # Admin Dashboard on :5000
```

## 📦 Deployment Status

✅ **USSD API:** Deployed to Render.com  
✅ **GitHub:** https://github.com/MusaMuthami1/voo-ward-ussd  
✅ **Production URL:** https://voo-ward-ussd.onrender.com/ussd  
⏳ **Admin Dashboard:** Ready to deploy (see guide)  
⏳ **Safaricom Approval:** Pending submission  

## 🤝 Contributing

This is a production government service. For changes:
1. Test locally first
2. Commit to GitHub
3. Render auto-deploys from `main` branch

## 📜 License

MIT License - See [LICENSE](LICENSE)

---

**Organization:** Kyamatu Ward Administration  
**GitHub:** MusaMuthami1/voo-ward-ussd  
**Status:** Production Ready ✅  
**Last Updated:** November 4, 2025
