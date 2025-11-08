# VOO KYAMATU WARD - ADMIN ACCESS CONFIGURATION

## 🔐 Official Admin User

### ZAK (Super Admin - MCA)
- **Name:** ZAK
- **Login PIN:** 827700
- **Role:** Super Admin (MCA) - Full Access
- **Permissions:**
  - ✓ View all data (registrations, bursaries, issues)
  - ✓ Create/delete announcements
  - ✓ Update issue status
  - ✓ Export data (CSV/JSON)
  - ✓ **Add ONE PA (Personal Assistant)**
  - ✓ Delete PA user
  - ✓ Full system access

---

## 👥 User Management Rules

### Adding a PA (Personal Assistant)
- **Only ZAK can add users**
- **Maximum: ONE PA allowed**
- **PA Role:** Admin (limited access compared to ZAK)

### How ZAK Adds a PA:
1. Login to dashboard at: http://localhost:5173
2. Enter PIN: **827700**
3. Navigate to "Admin Users" tab
4. Click "Add New User"
5. Fill in:
   - Name: (PA's name)
   - PIN: (6-digit PIN for PA)
   - Role: **admin** (PA)
6. Click "Create User"

### PA Permissions:
- ✓ View registrations, bursaries, issues
- ✓ Create announcements
- ✓ Update issue status
- ✗ Cannot delete announcements
- ✗ Cannot add/delete users
- ✗ Limited compared to ZAK

---

## 🚀 Login Instructions

### For ZAK (Super Admin):
```
URL: http://localhost:5173
PIN: 827700
```

### For PA (After ZAK creates account):
```
URL: http://localhost:5173
PIN: [6-digit PIN set by ZAK]
```

---

## 🔒 Security Features

1. **PIN Authentication:** 
   - 6-digit PIN required for login
   - Hashed with bcrypt (industry standard)
   - No passwords stored in plain text

2. **Role-Based Access:**
   - Super Admin (ZAK): Full access
   - Admin (PA): Limited access

3. **Session Management:**
   - JWT tokens for authentication
   - Auto-logout after 45 minutes of inactivity
   - Secure token storage

4. **Audit Trail:**
   - All user actions logged
   - Timestamps for all activities
   - User identification in logs

---

## 📝 Current Users

### Development Mode (Current):
- **ZAK** (super_admin) - PIN: 827700

### Production Mode:
- Will use PostgreSQL database
- Same rules apply: 1 Super Admin (ZAK) + 1 PA maximum

---

## 🛠️ Technical Details

### Database Schema:
```sql
admin_users table:
- id (primary key)
- name (e.g., "ZAK")
- pin_hash (bcrypt hash of PIN)
- role (super_admin or admin)
- phone (identifier, e.g., "827700")
- created_at (timestamp)
```

### API Endpoints:
- `POST /auth/login` - Login with PIN
- `GET /admin/users` - List all users (requires auth)
- `POST /admin/users` - Create new user (ZAK only)
- `DELETE /admin/users/:id` - Delete user (ZAK only)

---

## ⚠️ Important Notes

1. **Only ZAK has full access** - Cannot create another super_admin
2. **Maximum 1 PA** - System enforces this limit
3. **ZAK cannot delete himself** - System protection
4. **PIN must be 6 digits** - Validation enforced
5. **PA can be replaced** - ZAK can delete and create new PA

---

## 📞 Support

For technical issues or questions:
- Check logs in backend terminal
- View system metrics: http://localhost:4000/metrics
- Health check: http://localhost:4000/health

---

**Last Updated:** November 2, 2025
**System Status:** ✓ Active and Running
