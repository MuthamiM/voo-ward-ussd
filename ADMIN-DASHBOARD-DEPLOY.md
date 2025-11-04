# 🏛️ MCA ADMIN DASHBOARD - DEPLOYMENT GUIDE

## Overview

The Admin Dashboard allows the MCA to view and manage:
- 📋 **Reported Issues** (roads, water, security, etc.)
- 🎓 **Bursary Applications** (student name, school, amount requested)
- 👥 **Registered Constituents**
- 📢 **Announcements**
- 📥 **CSV Exports** for all data

---

## 🖥️ Local Development (Current Setup)

**File:** `backend/src/admin-dashboard.js`

**Run Locally:**
```bash
cd C:\Users\Admin\USSD\backend
node src/admin-dashboard.js
```

**Access Dashboard:**
- URL: http://localhost:5000
- Health: http://localhost:5000/health

---

## 🚀 Deploy to Production (Render.com)

### Step 1: Create New Web Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account (if not already)
4. Select repository: **MusaMuthami1/voo-ward-ussd**

### Step 2: Configure Service

**Basic Settings:**
- **Name:** `voo-ward-admin` (or any name you want)
- **Region:** Oregon (US West) - Free tier
- **Branch:** main
- **Root Directory:** `backend`
- **Runtime:** Node
- **Build Command:** `npm ci`
- **Start Command:** `node src/admin-dashboard.js`

**Instance Type:**
- Free tier: $0/month (512 MB RAM, 0.1 CPU)
- OR Starter: $7/month (512 MB RAM, always on)

### Step 3: Environment Variables

Add these environment variables:

| Key | Value |
|-----|-------|
| `MONGO_URI` | `mongodb+srv://VOOAPP:NeverBroke031@cluster0.lc9fktg.mongodb.net/voo_ward` |
| `NODE_ENV` | `production` |
| `ADMIN_PORT` | `10000` (Render default) |

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (~2 minutes)
3. You'll get a URL like: `https://voo-ward-admin.onrender.com`

---

## 📋 What the Dashboard Shows

### 1. Statistics (Top Cards)
- Total Constituents
- Total Reported Issues
- Total Bursary Applications
- Active Announcements

### 2. Issues Tab
Shows all reported issues from USSD:
- Ticket number (ISS-001, ISS-002...)
- Category (Roads, Water, Security, Health, etc.)
- Message/Description
- Phone number of reporter
- Status (open, in_progress, resolved)
- Created date/time

**Export:** CSV file with all issues

### 3. Bursaries Tab
Shows all bursary applications from USSD:
- Reference code (BUR-001, BUR-002...)
- Student name
- School/Institution name
- Amount requested (in KES)
- Phone number of applicant
- Status (Pending, Approved, Rejected, Disbursed)
- Created date/time

**Export:** CSV file with all applications

### 4. Constituents Tab
Shows all registered ward members:
- Phone number
- National ID number
- Full name
- Location (area)
- Village
- Registration date/time

**Export:** CSV file with all constituents

### 5. Announcements Tab
Shows all ward announcements:
- Title
- Body/Message
- Created date/time

---

## 🔗 API Endpoints

### Statistics
- `GET /api/admin/stats` - Dashboard statistics

### Issues
- `GET /api/admin/issues` - List all issues
- `PATCH /api/admin/issues/:id` - Update issue status
- `GET /api/admin/export/issues` - Export CSV

### Bursaries
- `GET /api/admin/bursaries` - List all applications
- `PATCH /api/admin/bursaries/:id` - Update status
- `GET /api/admin/export/bursaries` - Export CSV

### Constituents
- `GET /api/admin/constituents` - List all constituents
- `GET /api/admin/export/constituents` - Export CSV

### Announcements
- `GET /api/admin/announcements` - List announcements
- `POST /api/admin/announcements` - Create announcement
- `DELETE /api/admin/announcements/:id` - Delete announcement

---

## 💾 Database Structure

The dashboard reads from MongoDB collections:

### `issues` Collection
```javascript
{
  ticket: "ISS-001",
  category: "Roads",
  message: "Pothole on main street",
  phone_number: "0712345678",
  status: "open", // or "in_progress", "resolved"
  created_at: ISODate("2025-11-04T...")
}
```

### `bursary_applications` Collection
```javascript
{
  ref_code: "BUR-001",
  student_name: "John Doe",
  institution: "Nairobi University",
  amount_requested: 50000,
  phone_number: "0712345678",
  status: "Pending", // or "Approved", "Rejected", "Disbursed"
  created_at: ISODate("2025-11-04T...")
}
```

### `constituents` Collection
```javascript
{
  phone_number: "0712345678",
  national_id: "12345678",
  full_name: "Jane Doe",
  location: "Kyamatu Central",
  village: "Village A",
  created_at: ISODate("2025-11-04T...")
}
```

### `announcements` Collection
```javascript
{
  title: "Ward Meeting",
  body: "Monthly meeting on Friday at 3 PM",
  created_at: ISODate("2025-11-04T...")
}
```

---

## 🔒 Security Notes

### Current Version (No Authentication)
- Dashboard is publicly accessible
- Anyone with URL can view data
- Suitable for internal use only

### Future Enhancement (Add Authentication)
To add login protection:

1. Add admin login system
2. Use JWT tokens for authentication
3. Protect all `/api/admin/*` routes
4. Add MCA user accounts

---

## 🎨 Features

✅ **Real-time Dashboard** - Auto-refreshes every 30 seconds  
✅ **Responsive Design** - Works on desktop, tablet, mobile  
✅ **CSV Export** - Download all data as spreadsheets  
✅ **Color-coded Status** - Easy to see pending vs completed  
✅ **Search & Filter** - Find specific records quickly  
✅ **Statistics Cards** - Quick overview of all data  

---

## 🌐 Production URLs (After Deployment)

| Service | URL | Purpose |
|---------|-----|---------|
| **USSD API** | https://voo-ward-ussd.onrender.com/ussd | Safaricom callback |
| **Admin Dashboard** | https://voo-ward-admin.onrender.com | MCA portal |

---

## 📊 Usage Example

### Viewing Reported Issues

1. Open dashboard URL
2. Click **"📋 Issues"** tab
3. See all issues reported via USSD
4. View:
   - Ticket number
   - Category (e.g., "Roads", "Water")
   - Full message
   - Reporter's phone number
   - Current status

### Viewing Bursary Applications

1. Click **"🎓 Bursaries"** tab
2. See all applications submitted via USSD
3. View:
   - Student's name
   - School/institution name
   - Amount requested
   - Application status
   - Contact phone number

### Exporting Data

1. Click any tab (Issues, Bursaries, or Constituents)
2. Click **"📥 Export CSV"** button
3. Excel-compatible file downloads
4. Open in Excel/Google Sheets

---

## 🔧 Troubleshooting

### Dashboard shows "Loading..."
- Check MongoDB connection
- Verify MONGO_URI environment variable
- Check Render logs

### No data showing
- Verify USSD service is creating records
- Check MongoDB collections exist
- Test API endpoints directly

### CSV Export not working
- Check browser pop-up blocker
- Try different browser
- Check Render logs for errors

---

## 📝 Next Steps

1. ✅ Dashboard created: `src/admin-dashboard.js`
2. ✅ Tested locally: http://localhost:5000
3. ⏳ **Deploy to Render.com** (follow steps above)
4. ⏳ **Share URL with MCA** for access
5. ⏳ **Add authentication** (optional - for security)

---

## 🎯 Summary

You now have a **complete MCA Admin Dashboard** that:
- Shows all reported issues from citizens
- Displays bursary applications with school details
- Lists registered constituents
- Allows CSV exports for record-keeping
- Auto-refreshes for real-time updates

**File:** `backend/src/admin-dashboard.js`  
**Deploy Command:** `node src/admin-dashboard.js`  
**Port:** 5000 (local) or 10000 (Render)

Ready to deploy! 🚀
