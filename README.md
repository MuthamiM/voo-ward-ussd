# 🏛️ VOO Kyamatu Ward - USSD Service

Production-ready USSD backend for Kyamatu Ward citizen services.

## 📋 Overview

This service provides USSD access (*XXX#) for ward citizens to:
- Register as constituents
- Report issues (roads, water, security, health)
- Apply for bursaries
- View announcements
- Access ward projects information

## 🚀 Deployed Services

| Service | URL | Purpose |
|---------|-----|---------|
| **USSD API** | https://voo-ward-ussd.onrender.com/ussd | Safaricom callback |
| **Admin Dashboard** | Deploy separately | MCA portal (view issues, bursaries) |

## 🛠️ Technology Stack

- **Framework:** Express.js 5
- **Database:** MongoDB Atlas
- **Hosting:** Render.com (free tier)
- **Language Support:** English, Swahili, Kamba

## 📦 Project Structure

```
backend/
├── src/
│   ├── index.js                 # USSD API server (production)
│   ├── admin-dashboard.js       # MCA Admin Dashboard (production)
│   ├── lib/
│   │   ├── mongo.js            # MongoDB client
│   │   ├── crypto.js           # Password hashing
│   │   ├── logger.js           # Logging utilities
│   │   └── validators.js       # Input validation
│   └── middleware/              # Security & rate limiting
├── package.json                 # Dependencies (Express + MongoDB)
├── .env.example                 # Environment template
└── README.md                    # This file
```

## 🔧 Local Development

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account (or local MongoDB)

### Setup

1. Clone repository:
```bash
git clone https://github.com/MusaMuthami1/voo-ward-ussd.git
cd voo-ward-ussd/backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add your MONGO_URI
```

4. Start USSD server:
```bash
npm start
# Server runs on http://localhost:4000
```

5. Start Admin Dashboard (optional):
```bash
npm run admin
# Dashboard runs on http://localhost:5000
```

## 🌐 Deployment

### USSD API (Render.com)

**Already Deployed:** https://voo-ward-ussd.onrender.com/ussd

**Configuration:**
- Build Command: `npm ci`
- Start Command: `npm start`
- Environment Variables:
  - `MONGO_URI` = Your MongoDB connection string
  - `NODE_ENV` = `production`
  - `PORT` = `4000` (auto-set by Render)

### Admin Dashboard (Render.com)

**To Deploy:**

1. Go to https://dashboard.render.com
2. Create new Web Service
3. Connect GitHub repo: `MusaMuthami1/voo-ward-ussd`
4. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm ci`
   - **Start Command:** `npm run admin`
   - **Environment Variables:**
     - `MONGO_URI` = Your MongoDB connection string
     - `NODE_ENV` = `production`
     - `ADMIN_PORT` = `10000`

## 📊 Admin Dashboard Features

- 📋 View all reported issues (category, message, status)
- 🎓 View bursary applications (student name, school, amount)
- 👥 View registered constituents
- 📢 Manage announcements
- 📥 Export data as CSV

## 🔌 API Endpoints

### USSD API

**POST /ussd**
- Safaricom callback endpoint
- Receives: `sessionId`, `phoneNumber`, `text`
- Returns: USSD menu responses

**GET /health**
- Health check endpoint
- Returns: `{ ok: true, service: "voo-kyamatu-ussd" }`

### Admin Dashboard API

**GET /api/admin/issues**
- List all reported issues

**GET /api/admin/bursaries**
- List all bursary applications

**GET /api/admin/constituents**
- List all registered constituents

**GET /api/admin/stats**
- Dashboard statistics

**GET /api/admin/export/issues**
- Export issues as CSV

## 📱 USSD Flow

```
*XXX# → Language Selection
   ├── 1. English
   ├── 2. Swahili
   └── 3. Kamba

→ Main Menu
   ├── 1. Register as Constituent
   ├── 2. Report an Issue
   │   ├── 1. Roads
   │   ├── 2. Water
   │   ├── 3. Security
   │   ├── 4. Health
   │   └── 5. Other
   ├── 3. Announcements
   └── 4. Projects
```

## 🗄️ Database Collections

### `constituents`
- Phone number, National ID, Full name
- Location, Village
- Registration timestamp

### `issues`
- Ticket number, Category, Message
- Phone number, Status
- Creation timestamp

### `bursary_applications`
- Reference code, Student name, Institution
- Amount requested, Status
- Applicant phone, Creation timestamp

### `announcements`
- Title, Body, Creation timestamp

## 🔒 Environment Variables

Required environment variables (see `.env.example`):

```bash
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database
NODE_ENV=production
PORT=4000
```

## 📄 Dependencies

```json
{
  "express": "^5.1.0",
  "body-parser": "^2.2.0",
  "morgan": "^1.10.1",
  "mongodb": "^6.20.0",
  "dotenv": "^16.3.1"
}
```

## 🚦 Health Monitoring

Check service status:
```bash
# USSD API
curl https://voo-ward-ussd.onrender.com/health

# Admin Dashboard (after deployment)
curl https://your-admin-url.onrender.com/health
```

## 📝 Safaricom Integration

**Callback URL:** `https://voo-ward-ussd.onrender.com/ussd`

**Request Format:**
```
POST /ussd
Content-Type: application/x-www-form-urlencoded

sessionId=SESSION123&phoneNumber=254712345678&text=1*2
```

**Response Format:**
```
CON Menu text here...
```
or
```
END Final message
```

## 🔧 Troubleshooting

### USSD API not responding
- Check Render logs
- Verify MONGO_URI is set correctly
- Test health endpoint

### Admin Dashboard shows no data
- Verify MongoDB connection
- Check collections exist in database
- Test API endpoints directly

### Deployment failed
- Check `package.json` for missing dependencies
- Verify build command: `npm ci`
- Check environment variables are set

## 📚 Documentation

- **Production Cleanup:** [PRODUCTION-CLEAN.md](../PRODUCTION-CLEAN.md)
- **Admin Dashboard:** [ADMIN-DASHBOARD-DEPLOY.md](../ADMIN-DASHBOARD-DEPLOY.md)
- **Render Deployment:** [RENDER-DEPLOYMENT.md](RENDER-DEPLOYMENT.md)
- **Safaricom Application:** [SAFARICOM-APPLICATION.md](../SAFARICOM-APPLICATION.md)
- **Technical Integration:** [TECHNICAL-INTEGRATION.md](../TECHNICAL-INTEGRATION.md)

## 🤝 Support

For issues or questions:
- GitHub: https://github.com/MusaMuthami1/voo-ward-ussd
- Create an issue on GitHub

## 📜 License

MIT License - See [LICENSE](LICENSE) file

---

**Production Status:** ✅ Live on Render.com  
**Last Updated:** November 4, 2025  
**Version:** 1.0.0
