# 📱 Kyamatu Ward Citizen Portal - Setup Guide

## 🎯 What is This?

A Progressive Web App (PWA) that allows citizens to:
- ✅ Report issues with photo uploads
- ✅ Track issue status in real-time
- ✅ Check bursary application status
- ✅ Receive notifications
- ✅ Work offline

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd citizen-portal
npm install
```

### 2. Configure Environment
Create `.env` file:
```bash
VITE_API_URL=http://localhost:4000
```

For production:
```bash
VITE_API_URL=https://voo-ward-ussd.onrender.com
```

### 3. Run Development Server
```bash
npm run dev
```

Portal will open at: `http://localhost:5173`

### 4. Build for Production
```bash
npm run build
```

Output will be in `dist/` folder.

---

## 📦 Features

### 1. **OTP Authentication**
- Citizens login with phone number
- 6-digit OTP sent via SMS
- Auto-registration for new users
- 24-hour session validity

### 2. **Report Issues**
- Select from 8 categories
- Add detailed description
- Upload photos from camera/gallery
- Get instant ticket number
- SMS/WhatsApp notifications

### 3. **Track Issues**
- View all reported issues
- Filter by status (Open/In Progress/Resolved)
- See real-time updates
- View photos and comments

### 4. **Bursary Status**
- Check application status
- View approved amounts
- Track disbursement
- See rejection reasons

### 5. **PWA Features**
- Install on home screen
- Works offline
- Push notifications
- Fast loading with caching

---

## 🚀 Deployment

### Deploy with Backend (Render)
```bash
# Build the portal
cd citizen-portal
npm run build

# Copy dist to backend public folder
cp -r dist/* ../public/citizen-portal/

# Deploy backend (includes portal)
git push
```

---

**Version**: 1.0.0  
**Last Updated**: November 22, 2025  
**Status**: ✅ Production Ready
