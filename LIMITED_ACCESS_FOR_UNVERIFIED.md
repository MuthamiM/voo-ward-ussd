# LIMITED ACCESS FOR UNVERIFIED USERS

## 🎯 Purpose
Allow **unverified users** (pending/rejected registration) to report issues, but block them from bursary applications and projects list.

## ✅ What's Implemented

### **Unverified Users CAN:**
- ✅ **Report Issues** - Full access to issue reporting
  - Select category
  - Enter description
  - Get ticket number
  - Issues saved to database

### **Unverified Users CANNOT:**
- ❌ **Apply for Bursary** - Blocked with message
- ❌ **View Projects List** - Blocked with message
- ❌ **View News** - Blocked (verified users only)

---

## 📱 User Experience

### **Pending User Flow:**
```
*384*8481#
→ Select Language: 1 (English)
→ Menu:
   ⏳ Pending Verification
   
   1. Report Issue (Allowed)
   0. Contact Office
   
   MCA: 0706757140
```

### **If they select 1 (Report Issue):**
```
→ Select Category:
   1. Water
   2. Roads
   3. Health
   4. Education
   5. Security
   6. Other
→ Enter description (max 100 chars)
→ ✅ Issue Reported!
   Ticket: INC-XXXXXX
```

### **Rejected User Flow:**
```
*384*8481#
→ Select Language: 1 (English)
→ Menu:
   ❌ Registration REJECTED
   
   1. Report Issue (Allowed)
   0. Contact Office
   
   MCA: 0706757140
```

---

## 🔒 Verified User Flow (Full Access)

### **Verified users get the FULL menu:**
```
*384*8481#
→ Select Language: 1 (English)
→ KYAMATU WARD
   
   1. News
   2. Report Issue
   3. Apply Bursary
   4. Projects
   0. Exit
```

All 4 options work for verified users only.

---

## 💻 Technical Implementation

### **Code Changes in `ussd.js`:**

#### 1. **Modified Language Selection Response (Lines 230-255)**
```javascript
// After language selection, check verification status
if (!isRegistered) {
  return reply.send('CON ' + msg.register_menu);
} else if (isRegistered && !isVerified) {
  // Show limited menu
  if (verificationStatus === 'rejected') {
    return reply.send('CON ❌ Registration REJECTED\n\n1. Report Issue (Allowed)\n0. Contact Office\n\nMCA: 0706757140');
  } else {
    return reply.send('CON ⏳ Pending Verification\n\n1. Report Issue (Allowed)\n0. Contact Office\n\nMCA: 0706757140');
  }
} else {
  return reply.send('CON ' + msg.main_menu); // Full menu
}
```

#### 2. **Check Verification Status (Lines 260-278)**
```javascript
// Check if user is registered AND verification status
const db = getCloudDb();
let isRegistered = false;
let isVerified = false;
let userVerificationStatus = null;
if (db && getUserLanguage(phoneNumber)) {
  try {
    const result = await db.query('SELECT id, verification_status FROM constituents WHERE phone_number = $1', [phoneNumber]);
    isRegistered = result.rows.length > 0;
    if (isRegistered) {
      userVerificationStatus = result.rows[0].verification_status;
      isVerified = userVerificationStatus === 'verified';
    }
  } catch (err) {
    logger.error({ err, phone: phoneNumber }, 'Error checking registration status');
  }
}
```

#### 3. **Handle Option 1 - Context-Dependent (Lines 301-320)**
```javascript
// OPTION 1: For verified users = NEWS, For unverified users = REPORT ISSUE
if (menuChoice === '1' && !isVerified) {
  // UNVERIFIED USERS: Allow Issue Reporting
  if (segments.length === 2) {
    const categoryMenu = `CON ${msg.select_issue_category}\n\n` + issueCategories.map((c, i) => `${i+1}. ${c.name}`).join('\n') + `\n\n${msg.back}`;
    return reply.type('text/plain').send(categoryMenu);
  }
}

if (menuChoice === '1' && isVerified) {
  // VERIFIED USERS: Show News
  const newsMenu = `CON ${msg.news_title}\n\n` + announcements.map((a, i) => `${i+1}. ${a.title} (${a.date})`).join('\n') + `\n\n${msg.back}`;
  return reply.type('text/plain').send(newsMenu);
}
```

#### 4. **Option 2 - Issue Reporting (All Users) (Lines 322-380)**
```javascript
// OPTION 2: REPORT ISSUE (Allowed for all registered users - verified and unverified)
if (menuChoice === '2' || (menuChoice === '1' && !isVerified)) {
  // Full issue reporting flow for everyone
  // ... (existing issue reporting code)
}
```

#### 5. **Option 3 - Bursary (Verified Only) (Lines 382-387)**
```javascript
// OPTION 3: APPLY FOR BURSARY (Requires Verification)
if (menuChoice === '3') {
  // Check if user is verified
  if (!isVerified) {
    return reply.type('text/plain').send('END ⏳ Bursary applications require verification.\n\nYour registration is PENDING.\n\nContact MCA Office: 0706757140');
  }
  // ... (bursary flow for verified users)
}
```

#### 6. **Option 4 - Projects (Verified Only) (Lines 461-466)**
```javascript
// OPTION 4: PROJECTS (Requires Verification)
if (menuChoice === '4') {
  // Check if user is verified
  if (!isVerified) {
    return reply.type('text/plain').send('END ⏳ Projects list requires verification.\n\nYour registration is PENDING.\n\nContact MCA Office: 0706757140');
  }
  // ... (projects list for verified users)
}
```

---

## 🧪 Testing Guide

### **Test 1: Pending User Reports Issue**
```powershell
# Register a test user (will be pending)
$body = @{
    sessionId = "test123"
    phoneNumber = "+254700000002"
    text = "1*1*John*Doe*Kamau*12345679*KYAMATU*Kikima*Mitaboni"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/ussd" -Method POST -Body $body -ContentType "application/json"

# Expected: Registration pending message

# Try to report issue
$body2 = @{
    sessionId = "test123"
    phoneNumber = "+254700000002"
    text = "1*1*1*3*Road has potholes"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/ussd" -Method POST -Body $body2 -ContentType "application/json"

# Expected: Issue reported successfully with ticket number
```

### **Test 2: Pending User Tries Bursary**
```powershell
# Try to apply for bursary (should be blocked)
$body3 = @{
    sessionId = "test123"
    phoneNumber = "+254700000002"
    text = "1*1*3"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/ussd" -Method POST -Body $body3 -ContentType "application/json"

# Expected: "Bursary applications require verification. Your registration is PENDING."
```

### **Test 3: Pending User Tries Projects**
```powershell
# Try to view projects (should be blocked)
$body4 = @{
    sessionId = "test123"
    phoneNumber = "+254700000002"
    text = "1*1*4"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/ussd" -Method POST -Body $body4 -ContentType "application/json"

# Expected: "Projects list requires verification. Your registration is PENDING."
```

### **Test 4: Verify User and Test Full Access**
```powershell
# Approve the test user
cd C:\Users\Admin\USSD\backend
node -e "require('./src/lib/db').getCloudDb().query('UPDATE constituents SET verification_status=''verified'', verified_at=NOW() WHERE phone_number=''+254700000002''').then(() => console.log('✅ Approved!'))"

# Now test bursary (should work)
$body5 = @{
    sessionId = "test123"
    phoneNumber = "+254700000002"
    text = "1*3"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/ussd" -Method POST -Body $body5 -ContentType "application/json"

# Expected: Bursary category menu
```

---

## 📊 Access Control Matrix

| Feature | Unverified (Pending) | Unverified (Rejected) | Verified |
|---------|---------------------|----------------------|----------|
| **News** | ❌ Blocked | ❌ Blocked | ✅ Allowed |
| **Report Issue** | ✅ **ALLOWED** | ✅ **ALLOWED** | ✅ Allowed |
| **Apply Bursary** | ❌ Blocked | ❌ Blocked | ✅ Allowed |
| **View Projects** | ❌ Blocked | ❌ Blocked | ✅ Allowed |
| **Registration** | ❌ Already registered | ❌ Already registered | ❌ Already registered |

---

## 🚀 Benefits

### **For Citizens:**
- ✅ Can report urgent issues **immediately** without waiting for verification
- ✅ No delays for community problems (water, roads, security)
- ✅ Still maintains security for bursary funds and projects

### **For Admin:**
- ✅ Gets issue reports from entire community (not just verified)
- ✅ Protects bursary applications from fraud
- ✅ Controls access to projects list
- ✅ Can track issues by verification status

### **For System:**
- ✅ Increases community engagement
- ✅ Reduces verification bottleneck for urgent issues
- ✅ Maintains security where it matters (money & data)

---

## 🔐 Security Notes

1. **Why allow unverified users to report issues?**
   - Issues don't involve money/resources
   - Community problems are time-sensitive
   - Still requires registration (not anonymous)
   - Can track by phone number

2. **Why block bursary for unverified?**
   - Involves financial resources
   - Requires ID verification
   - Prevents duplicate/fraudulent applications

3. **Why block projects for unverified?**
   - Sensitive project information
   - Location-specific (Kyamatu Ward only)
   - Admin can update from dashboard

---

## 📞 User Support

**If users ask why they can only report issues:**

> "Your registration is pending verification by the MCA office. While you wait, you can report community issues. For bursary applications and projects, please contact the MCA office at 0706757140 to expedite verification."

---

## ✅ Summary

- ✅ Unverified users **CAN report issues**
- ❌ Unverified users **CANNOT apply for bursary**
- ❌ Unverified users **CANNOT view projects**
- ✅ Verified users get **full access to everything**
- ✅ All changes deployed in **production mode**

**System Status: READY FOR TESTING** 🚀
