# User Registration & Settings Guide

## 🚀 New Features Implemented

### 1. Enhanced Login System
- **Fixed login button issue** - No longer need to press Enter after password
- **Multiple event handlers** - Click, submit, and Enter key all work
- **Text selection prevention** - Login button properly triggers authentication
- **Loading states** - Visual feedback during login process

### 2. Role-Based User Registration System

#### Available Roles:
- **MCA (Main Admin)** - Maximum administrative privileges
- **Clerk** - Administrative user for routine operations  
- **PA (Personal Assistant)** - Support role for administrative tasks

#### Registration Rules:
- **Maximum 3 users total** across all roles
- **One user per role** - Each role (MCA, Clerk, PA) can only have one user
- **MCA Priority** - MCA can only be registered as the first user or by existing MCAs
- **Self-Registration** - Clerk and PA users can register themselves

#### How to Register:
1. Navigate to `/admin/signup.html` or click "Sign Up" from login page
2. Fill out the registration form:
   - Username (3-30 characters, alphanumeric with - or _)
   - Full Name (minimum 2 characters)
   - Phone Number (valid format required)
   - Select Role (MCA/Clerk/PA)
   - Password (minimum 6 characters)
   - Confirm Password
3. Click "Create Account"
4. If successful, you'll be redirected to login

### 3. Profile Management & Settings

#### Access Settings:
1. Login to admin dashboard
2. Click "Settings" in the sidebar navigation
3. Access profile management features

#### Profile Picture Upload:
- **Supported formats**: JPG, PNG, GIF, WebP
- **Maximum file size**: 2MB
- **Automatic processing**: Images are resized to 256x256 and optimized
- **Image storage**: Files stored in `/public/uploads/avatars/`

#### Profile Information:
- Update full name, email, and phone number
- Role is read-only (set during registration)
- Changes are saved to database immediately

#### Password Management:
- Change password with current password verification
- Minimum 6 characters required
- Secure bcrypt hashing

#### System Status:
- Database connectivity indicator
- Refresh system status button
- Real-time health monitoring

## 🔧 Technical Implementation

### Backend Enhancements:
```javascript
// Role validation with user limits
const totalUsers = await database.collection('admin_users').countDocuments({});
if (totalUsers >= 3) {
  return res.status(400).json({ error: 'Maximum number of users reached (3)' });
}

// Role duplication prevention
const roleExists = await database.collection("admin_users").findOne({ role: role });
if (roleExists) {
  return res.status(400).json({ error: `A user with role ${role} already exists` });
}
```

### Frontend Features:
- Modern glassmorphism design
- Real-time form validation
- Image preview and upload progress
- Responsive layout for all screen sizes
- Toast notifications for user feedback

### Security Features:
- Input sanitization and validation
- File type and size restrictions
- Session management
- CSRF protection
- Rate limiting on registration

## 🎯 User Journey

### First Time Setup:
1. **Initial MCA Registration**: First user must be MCA role
2. **Additional Users**: MCA can create or approve Clerk/PA registrations
3. **Profile Setup**: Upload profile picture and complete profile information
4. **System Configuration**: Review settings and system status

### Daily Operations:
1. **Quick Login**: Enhanced login with multiple interaction methods
2. **Profile Updates**: Easy access to profile management via settings
3. **Password Security**: Regular password updates through settings panel
4. **User Management**: View and manage up to 3 system users

## 🛠️ Troubleshooting

### Common Issues:

#### Registration Problems:
- **"Maximum users reached"**: Contact MCA to remove inactive users
- **"Role already exists"**: Each role (MCA/Clerk/PA) can only have one user
- **"Invalid phone format"**: Use format like 0712345678

#### Profile Upload Issues:
- **File too large**: Reduce image size below 2MB
- **Unsupported format**: Use JPG, PNG, GIF, or WebP only
- **Upload failed**: Check internet connection and try again

#### Login Issues:
- **Button not working**: Try clicking directly on button text
- **Password not accepted**: Ensure caps lock is off
- **Session expired**: Re-login after extended inactivity

### Technical Support:
- Check browser console for detailed error messages
- Verify network connectivity for file uploads
- Contact system administrator for user limit increases

## 🔍 Testing Checklist

### Registration Testing:
- [ ] Create MCA user as first user
- [ ] Attempt to create duplicate MCA (should fail)
- [ ] Create Clerk user
- [ ] Create PA user
- [ ] Attempt to create 4th user (should fail)

### Profile Testing:
- [ ] Upload various image formats
- [ ] Test file size limits
- [ ] Update profile information
- [ ] Change password
- [ ] Verify system status display

### Security Testing:
- [ ] Test role-based access restrictions
- [ ] Verify input validation
- [ ] Check session timeout behavior
- [ ] Test file upload security

## 📋 Future Enhancements

### Potential Features:
1. **Bulk User Import**: CSV import for multiple users
2. **Advanced Permissions**: Granular role-based permissions
3. **Profile Templates**: Pre-defined profile setups
4. **Activity Logging**: Track user registration and profile changes
5. **Email Notifications**: User registration confirmations
6. **Two-Factor Authentication**: Enhanced security options

---

*Created: 2024*  
*System: VOO Ward Admin Dashboard*  
*Version: Enhanced Registration & Profile Management*