# 🎯 Quick Reference - Admin Dashboard

## 🔐 Login Credentials

### MCA (Full Access)
- **Username**: `admin`
- **Password**: `admin123`
- **Access**: All 5 tabs + User Management

### PA (Limited Access)
- **Username**: `pa`
- **Password**: `pa123`
- **Access**: Issues, Bursaries, Announcements only

---

## 👥 Permission Matrix

| Feature | MCA | PA |
|---------|-----|-----|
| **View Issues** | ✅ Yes | ✅ Yes |
| **Update Issue Status** | ✅ Yes | ✅ Yes |
| **View Bursaries** | ✅ Yes | ✅ Yes |
| **View Constituents** | ✅ Yes | ❌ No |
| **Create Announcements** | ✅ Yes | ✅ Yes |
| **User Management** | ✅ Yes | ❌ No |
| **Create PA Users** | ✅ Yes | ❌ No |
| **Delete Users** | ✅ Yes (except main admin) | ❌ No |

---

## 🛡️ Security Features

### ✅ Fixed Issues

1. **Main Admin Protected**
   - Cannot delete username 'admin'
   - Prevents accidental lockout

2. **Password Hints Removed**
   - Before: "Invalid credentials. Use admin/admin123 or pa/pa123"
   - After: "Invalid username or password"
   - No credential leakage

3. **Database Connection Checks**
   - Returns 503 error if MongoDB unavailable
   - Clear error messages

### 🔒 Security Rules

- MCA cannot delete own account
- MCA cannot delete main admin (username: 'admin')
- PA cannot access user management
- PA cannot view constituents list
- All passwords stored in MongoDB (not hardcoded)

---

## 🎨 UI/UX Improvements

### Font Changes
- **Before**: Poppins (decorative)
- **After**: Segoe UI (clean, professional, Windows-native)
- **Impact**: Better readability, modern look

### Announcements Styling
- **Title**: Large (16px), bold, purple (#7c3aed)
- **Message**: Clean (15px), line-height 1.6, Segoe UI
- **Creator Badge**: Gradient purple background
- **Date Format**: "Nov 4, 2025, 9:34 PM"
- **Border**: 4px purple left border
- **Overall**: Professional, easy-to-read

---

## 📋 Testing Checklist

### After Seeding Users (`npm run seed:users`)

#### MCA Tests
- [ ] Login with admin/admin123
- [ ] See all 5 tabs (Issues, Bursaries, Constituents, Announcements, User Management)
- [ ] Create new PA user
- [ ] Try to delete main admin (should fail with error)
- [ ] Create announcement
- [ ] Update issue status
- [ ] View all statistics (4 cards)

#### PA Tests
- [ ] Login with pa/pa123
- [ ] See 3 tabs (Issues, Bursaries, Announcements)
- [ ] Update issue status (pending → in-progress → resolved)
- [ ] View bursary applicants
- [ ] Create announcement "HAKUNA MAJI HII MWEZI"
- [ ] Verify NO access to Constituents
- [ ] Verify NO access to User Management
- [ ] View 3 statistics cards (Issues, Bursaries, Announcements)

#### Security Tests
- [ ] Login with wrong password → Generic error (no hints)
- [ ] Login with non-existent user → Same generic error
- [ ] Check browser console (no password info leaked)

#### USSD Integration Tests
- [ ] Dial *384*800*11#
- [ ] Press 3 (News and Announcements)
- [ ] Verify announcement appears in USSD
- [ ] Message should show "HAIKO"

---

## 🚀 Production URLs

- **Dashboard**: https://voo-ward-ussd.onrender.com
- **USSD Endpoint**: https://voo-ward-ussd.onrender.com/ussd
- **Health Check**: https://voo-ward-ussd.onrender.com/health
- **Render Dashboard**: https://dashboard.render.com

---

## 🗄️ MongoDB Collections

1. **users** (Authentication)
   - username, password, fullName, role, createdAt

2. **constituents** (Registered Users)
   - phone, name, ward, nationalId, dateOfBirth, createdAt

3. **issues** (Reported Issues)
   - ticketNo, phone, reporterName, title, description, location, status, createdAt, updatedAt

4. **announcements** (Public Notices)
   - title, body, created_by, created_by_role, created_at

5. **bursary_applications** (Student Aid)
   - ref, fullName, institution, level, feeBalance, status

6. **projects** (Ward Projects)
   - name, status

---

## 🛠️ Common Tasks

### Add New PA User (MCA Only)
1. Login as admin
2. Go to "User Management" tab
3. Click "Add PA User"
4. Fill: username, fullName, password, role (PA)
5. Click "Create User"

### Create Announcement
1. Login (MCA or PA)
2. Go to "Announcements" tab
3. Click "New Announcement"
4. Fill: Title, Message
5. Click "Publish"
6. Announcement appears in USSD (Option 3)

### Update Issue Status
1. Login (MCA or PA)
2. Go to "Issues" tab
3. Find issue in table
4. Click "Actions" dropdown
5. Select: Pending / In Progress / Resolved
6. Status updates automatically

---

## 📞 Support

### Issue: "Database not connected"
**Solution**: 
- Check MongoDB connection string in Render env vars
- Verify `MONGO_URI` is set correctly
- Check Render logs for connection errors

### Issue: "Session expired"
**Solution**: 
- Logout and login again
- Clear browser localStorage
- Check if token expired (24 hours)

### Issue: Can't see announcements in USSD
**Solution**:
- Verify announcement saved in MongoDB
- Check USSD endpoint: Option 3
- Ensure phone number allowed (+254114945842)

---

## 🎉 All Fixed!

✅ Main admin cannot be deleted  
✅ Password hints removed (security)  
✅ PA has correct permissions (Issues, Bursaries, Announcements)  
✅ Clean Segoe UI font  
✅ Modern announcement styling  
✅ Authentication uses MongoDB  
✅ Database connection validated  

**Your dashboard is production-ready!** 🚀
