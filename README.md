# 🏛️ VOO Kyamatu Ward - Enterprise Development Platform

Production-grade USSD + SMS + Modern Admin Dashboard with **Maximum Security** for rural ward development and citizen services.

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)]()
[![Security](https://img.shields.io/badge/Security-Maximum%20Protection-blue)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## 🚀 Live Services

| Service | URL | Status |
|---------|-----|--------|
| **USSD API** | https://voo-ward-ussd.onrender.com/ussd | ✅ LIVE |
| **Admin Dashboard** | https://voo-ward-ussd-1.onrender.com/admin-dashboard.html | ✅ LIVE |
| **Health Check** | https://voo-ward-ussd.onrender.com/health | ✅ ACTIVE |

---

## ✨ Platform Features

### 📱 For Citizens (via USSD *XXX#)
- 📝 **Register** as ward constituents with full details
- 📋 **Report Issues** - Roads, Water, Security, Health, Infrastructure
- 🎓 **Apply for Bursaries** - Education funding applications
- 📢 **View Announcements** - Ward news and updates
- 🏗️ **Check Projects** - Ongoing ward development initiatives
- 🌍 **Multi-language** - English, Swahili, Kamba support

### 💼 For Administrators (Admin Dashboard)

#### Core Management
- 📊 **Dashboard Analytics** - Real-time statistics and trends
- 🎯 **Issue Tracking** - Complete lifecycle management (New → In Progress → Resolved → Closed)
- 🎓 **Bursary Processing** - Application review and approval workflow
- 👥 **User Management** - Role-based access control (MCA, PA, Clerk)
- 📢 **Announcement System** - Broadcast communications to citizens
- 📍 **Constituent Database** - Complete registration records

#### Advanced Features
- 📈 **Analytics Dashboard** - Interactive charts and visual insights
  - Issues timeline (30-day trends)
  - Status distribution (pie charts)
  - Bursary application analytics
  - Resolution time metrics
  - Animated stat counters
  
- 🗺️ **Interactive Maps** - Geographic issue visualization
  - Leaflet-powered interactive maps
  - Color-coded markers by status
  - Priority indicators
  - Filter by status/priority
  - Click markers for details
  
- 📜 **Audit Trail** - Complete activity logging
  - Timeline view of all actions
  - Filter by user, action type, date
  - Export audit logs (CSV/JSON)
  - Security event tracking
  
- 🔔 **Real-time Updates** - Live data synchronization
  - Auto-polling every 30 seconds
  - Desktop notifications
  - Connection status indicator
  - Toast notifications
  
- 📊 **Data Export** - Multiple format support
  - CSV export for all data types
  - Date range filtering
  - Bulk data operations
  - Report generation

---

## 🛡️ Enterprise Security

### Security Status: MAXIMUM PROTECTION ✅

#### Implemented Security Features
- **🔐 AES-256-GCM Encryption** - Field-level PII data protection
- **🛡️ Progressive Rate Limiting** - Multi-tier protection
  - USSD: 10 requests/10 seconds
  - Admin API: 20 requests/20 seconds
  - Global: 100 requests/second
- **🚫 IP Blocking** - Automatic 24-hour blocks after 10 failed attempts
- **🔑 Enhanced Authentication** 
  - bcrypt cost 14 for password hashing
  - JWT tokens with 8-hour expiration
  - Token-based API authentication
- **🔍 Input Validation** - SQL injection and XSS protection
- **📋 Audit Logging** - Complete security event tracking
- **🌍 GDPR + Kenya DPA Compliance** - Data subject rights implementation
- **📊 Real-time Monitoring** - Security dashboard with threat detection

### Security Testing
```bash
# Verify security features
node backend/test-security.js
# Expected output: MAXIMUM PROTECTION status
```

---

## 🏗️ Architecture

### Technology Stack

#### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Fastify (high-performance)
- **Database**: 
  - Cloud: PostgreSQL 14+ (primary)
  - Edge: SQLite WAL (offline-first)
- **Authentication**: JWT tokens
- **Logging**: Pino (structured logging)
- **Security**: bcrypt, AES-256-GCM encryption

#### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 5
- **Charts**: Chart.js 4.4.0
- **Maps**: Leaflet 1.9.4
- **UI**: Bootstrap 5.1.3
- **Icons**: Font Awesome 6
- **Design**: Glassmorphism + Purple gradient theme

#### Database Schema

**Constituents**
- Phone number, National ID, Full name
- Location details (Sub-location, Village)
- Registration timestamp
- Encrypted PII fields

**Issues**
- Ticket number (ISS-001, ISS-002...)
- Category, Description, Status, Priority
- Location coordinates (for mapping)
- Reporter phone, Timestamps
- Resolution notes and history

**Bursary Applications**
- Reference code (BUR-001...)
- Student details, Institution, Amount
- Status workflow tracking
- Applicant contact information

**Users**
- Username, hashed password, role
- Full name, phone, email
- Last login, activity stats
- Role-based permissions

**Audit Logs**
- Action type (CREATE/UPDATE/DELETE/LOGIN/LOGOUT)
- User ID, IP address
- Details, timestamp
- Security event classification

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- MongoDB Atlas account (free tier)
- PostgreSQL 14+ (for cloud deployment)

### Local Development

```bash
# Clone repository
git clone https://github.com/MusaMuthami1/voo-ward-ussd.git
cd voo-ward-ussd

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Add your MongoDB URI to .env
# MONGO_URI=mongodb+srv://...

# Initialize database
npm run migrate:cloud

# Start development server
npm run dev
# Server runs on http://localhost:4000
# Admin dashboard: http://localhost:4000/admin-dashboard.html
```

### Admin Login
Default credentials:
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Change the password immediately after first login!**

### Reset Admin Password
```bash
$env:MONGO_URI = "your-mongodb-uri"
$env:ADMIN_PASS = "newpassword"
node scripts/reset-admin.js
```

---

## 📱 USSD Flow

```
Dial *XXX#

┌─────────────────────────────────────┐
│   VOO Kyamatu Ward Services         │
│                                     │
│   Select Language:                  │
│   1. English                        │
│   2. Swahili                        │
│   3. Kamba                          │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│   Main Menu:                        │
│   1. Register as Constituent        │
│   2. Report an Issue                │
│   3. View Announcements             │
│   4. Projects                       │
│   5. Apply for Bursary              │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│   Report Issue:                     │
│   1. Roads & Infrastructure         │
│   2. Water & Sanitation             │
│   3. Security Concerns              │
│   4. Health Services                │
│   5. Other Issues                   │
└─────────────────────────────────────┘
```

---

## 🎨 Dashboard Features

### Modern UI/UX
- **Glassmorphism Design** - Frosted glass effect with backdrop blur
- **Purple Gradient Theme** - Consistent #7c3aed to #ec4899 gradients
- **Responsive Layout** - Works on desktop, tablet, and mobile
- **Dark Mode Ready** - Theme switching capability
- **Smooth Animations** - CSS transitions and loading states

### Navigation
- **Collapsible Sidebar** - Expand/collapse with smooth transitions
- **Active State Highlighting** - Clear visual indication of current page
- **Notification Bell** - Real-time notification dropdown
- **Profile Menu** - Quick access to settings and logout
- **Breadcrumb Navigation** - Clear page hierarchy

### Data Tables
- **Sortable Columns** - Click headers to sort ascending/descending
- **Advanced Filtering** - Multi-criteria search and filters
- **Pagination** - Efficient large dataset handling
- **Bulk Actions** - Select multiple items for batch operations
- **Row Highlighting** - Hover effects and status colors
- **Expandable Rows** - View details without leaving page

### Charts & Analytics
- **Animated Counters** - Smooth number transitions
- **Interactive Charts** - Hover for details, click for drill-down
- **Date Range Filtering** - Custom time period selection
- **Trend Indicators** - Growth percentages and arrows
- **Export Reports** - Download analytics as PDF/CSV

### Maps
- **Interactive Leaflet Map** - Pan, zoom, and explore
- **Status-Coded Markers** - Red (Pending), Orange (In Progress), Green (Resolved)
- **Priority Indicators** - Visual priority levels
- **Popup Details** - Click markers for full issue information
- **Filter Controls** - Filter by status, priority, date
- **Legend** - Clear marker meaning explanation

---

## 🔌 API Integration

### Safaricom USSD Integration

**Callback URL**: `https://voo-ward-ussd.onrender.com/ussd`

**Request Format**:
```http
POST /ussd HTTP/1.1
Content-Type: application/x-www-form-urlencoded

sessionId=SESSION123&phoneNumber=254712345678&text=1*2
```

**Response Format**:
```
CON Menu text...    # Continue session
END Final message   # End session
```

### Admin API Endpoints

Authentication required: `Authorization: Bearer <JWT_TOKEN>`

```
# Authentication
POST   /api/auth/login              - Admin login
POST   /api/auth/signup             - Create new user

# Issues
GET    /api/issues                  - List all issues
POST   /api/issues                  - Create issue
PUT    /api/issues/:id              - Update issue
DELETE /api/issues/:id              - Delete issue

# Bursaries
GET    /api/bursaries               - List applications
PUT    /api/bursaries/:id/status    - Update status

# Users
GET    /api/admin/users             - List users (MCA only)
POST   /api/admin/users             - Create user (MCA only)
DELETE /api/admin/users/:id         - Delete user (MCA only)

# Analytics
GET    /api/analytics/stats         - Dashboard statistics
GET    /api/analytics/trends        - Historical trends

# Export
GET    /api/admin/export/issues     - Export issues CSV
GET    /api/admin/export/bursaries  - Export bursaries CSV
GET    /api/admin/export/constituents - Export constituents CSV

# Audit
GET    /api/admin/audit-logs        - Audit trail (MCA only)
GET    /api/admin/audit-logs/export - Export audit logs
```

---

## 📊 Monitoring & Health

### Health Checks
```bash
# Main API
curl https://voo-ward-ussd.onrender.com/health
# Response: { "ok": true, "ussd": "*340*75#" }

# Database connection
curl https://voo-ward-ussd.onrender.com/health/db
# Response: { "ok": true, "database": "connected" }
```

### Metrics
- **Uptime**: 99.9% SLA target
- **Response Time**: < 500ms average
- **USSD Sessions**: Real-time monitoring
- **Active Users**: Concurrent session tracking
- **Error Rate**: < 0.1% target

---

## 🔒 Compliance & Privacy

### GDPR Compliance
- ✅ Data subject access rights
- ✅ Right to rectification
- ✅ Right to erasure
- ✅ Data portability
- ✅ Automated compliance reporting

### Kenya DPA 2019
- ✅ Data protection registration
- ✅ Privacy notice implementation
- ✅ Consent management
- ✅ Data retention policies
- ✅ Security safeguards

### Audit & Accountability
- ✅ Complete audit trail
- ✅ User activity monitoring
- ✅ Security event logging
- ✅ Automated backup (daily)
- ✅ Disaster recovery plan

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [ADVANCED_FEATURES.md](ADVANCED_FEATURES.md) | Advanced dashboard features guide |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Implementation overview |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture diagram |
| [SECURITY_DOCUMENTATION.md](SECURITY_DOCUMENTATION.md) | Security implementation guide |
| [SAFARICOM-APPLICATION.md](SAFARICOM-APPLICATION.md) | USSD service application |
| [TECHNICAL-INTEGRATION.md](TECHNICAL-INTEGRATION.md) | Integration specifications |

---

## 🛠️ Development

### Available Scripts
```bash
npm start                    # Start production server
npm run dev                  # Start development server
npm run migrate:cloud        # Run database migrations
npm test                     # Run test suite
npm run test:security        # Security feature tests
npm run lint                 # Code quality check
```

### Project Structure
```
voo-ward-ussd/
├── src/
│   ├── index.js                 # Main server
│   ├── ussd-handler.js          # USSD logic
│   ├── routes/                  # API endpoints
│   │   ├── admin.js
│   │   ├── issues.js
│   │   └── bursaries.js
│   ├── lib/                     # Utilities
│   │   ├── db.js
│   │   ├── crypto.js
│   │   └── validators.js
│   └── middleware/              # Security, auth
├── public/
│   ├── admin-dashboard.html     # Admin UI
│   ├── js/                      # Frontend modules
│   │   ├── dashboard-enhancements.js
│   │   ├── analytics-charts.js
│   │   ├── user-management.js
│   │   ├── audit-trail.js
│   │   ├── map-integration.js
│   │   └── realtime-updates.js
│   └── css/
│       └── dashboard-enhancements.css
├── migrations/                  # Database migrations
├── scripts/                     # CLI tools
└── docs/                        # Documentation
```

---

## 🚀 Deployment

### Render.com (Current)
- Auto-deploys from `main` branch
- Environment variables configured
- Free tier (upgradable)
- Custom domain ready

### Alternative Platforms
- **Railway**: Easy deployment, similar to Render
- **Heroku**: Classic PaaS, paid tiers
- **DigitalOcean App Platform**: Affordable, reliable
- **AWS Elastic Beanstalk**: Enterprise-grade

---

## 🤝 Contributing

### Contribution Guidelines
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Code Standards
- ESLint configuration enforced
- Prettier for code formatting
- Comprehensive commit messages
- Test coverage required

---

## 📞 Support

**Technical Support**:
- Email: voo-ward-support@example.com
- GitHub Issues: https://github.com/MusaMuthami1/voo-ward-ussd/issues

**Documentation**:
- Full docs in `/docs` folder
- API reference available
- Video tutorials (coming soon)

---

## 📜 License

MIT License - See [LICENSE](LICENSE) for details

---

## 🏆 Project Status

- ✅ **USSD Integration**: Fully functional
- ✅ **Admin Dashboard**: Production ready
- ✅ **Security**: Maximum protection implemented
- ✅ **Analytics**: Complete with Chart.js
- ✅ **Maps**: Leaflet integration complete
- ✅ **Real-time**: Polling system active
- ✅ **Audit Trail**: Full activity logging
- ⏳ **Safaricom Approval**: Pending submission
- ⏳ **Mobile App**: Roadmap planned

---

**Organization**: Kyamatu Ward Administration  
**Developer**: MusaMuthami1  
**Repository**: https://github.com/MusaMuthami1/voo-ward-ussd  
**Status**: ✅ Production Ready  
**Version**: 2.0.0  
**Last Updated**: November 20, 2025

---

*Building digital solutions for rural development. Empowering communities through technology.*



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
