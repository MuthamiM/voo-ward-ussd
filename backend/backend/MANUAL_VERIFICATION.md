# MANUAL VERIFICATION GUIDE (Until Dashboard is Ready)

## 🔐 How to Approve/Reject Registrations

### 1. VIEW PENDING REGISTRATIONS

Run this in PowerShell:
```powershell
cd C:\Users\Admin\USSD\backend
node -e "const {Pool}=require('pg');const db=new Pool({connectionString:'postgresql://postgres:23748124@localhost:5432/voo_db'});db.query(`SELECT phone_number, national_id, full_name, location, sublocation, village, verification_status, created_at FROM constituents WHERE verification_status='pending' ORDER BY created_at DESC`).then(r=>{console.log('\n=== PENDING REGISTRATIONS ===\n');r.rows.forEach((row,i)=>{console.log(`${i+1}. ${row.full_name}`);console.log(`   Phone: ${row.phone_number}`);console.log(`   ID: ${row.national_id}`);console.log(`   Location: ${row.location} > ${row.sublocation} > ${row.village}`);console.log(`   Date: ${row.created_at}\n`);});db.end()}).catch(e=>{console.error(e.message);db.end()})"
```

### 2. APPROVE A USER

```powershell
cd C:\Users\Admin\USSD\backend
node -e "const {Pool}=require('pg');const db=new Pool({connectionString:'postgresql://postgres:23748124@localhost:5432/voo_db'});db.query(`UPDATE constituents SET verification_status='verified', verified_by='ZAK', verified_at=NOW() WHERE phone_number='+254XXXXXXXXX'`).then(r=>{console.log('✅ User APPROVED!');db.end()}).catch(e=>{console.error(e.message);db.end()})"
```

**Replace:** `+254XXXXXXXXX` with actual phone number

### 3. REJECT A USER

```powershell
cd C:\Users\Admin\USSD\backend
node -e "const {Pool}=require('pg');const db=new Pool({connectionString:'postgresql://postgres:23748124@localhost:5432/voo_db'});db.query(`UPDATE constituents SET verification_status='rejected', verified_by='ZAK', verified_at=NOW(), rejection_reason='Invalid ID' WHERE phone_number='+254XXXXXXXXX'`).then(r=>{console.log('❌ User REJECTED!');db.end()}).catch(e=>{console.error(e.message);db.end()})"
```

**Replace:**
- `+254XXXXXXXXX` with actual phone number
- `'Invalid ID'` with actual reason

### 4. VIEW ALL VERIFIED USERS

```powershell
cd C:\Users\Admin\USSD\backend
node -e "const {Pool}=require('pg');const db=new Pool({connectionString:'postgresql://postgres:23748124@localhost:5432/voo_db'});db.query(`SELECT phone_number, full_name, location, verification_status FROM constituents WHERE verification_status='verified' ORDER BY verified_at DESC`).then(r=>{console.log('\n=== VERIFIED USERS ===\n');r.rows.forEach((row,i)=>{console.log(`${i+1}. ${row.full_name} (${row.phone_number})`);console.log(`   Location: ${row.location}\n`);});console.log(`Total: ${r.rows.length} verified users`);db.end()}).catch(e=>{console.error(e.message);db.end()})"
```

### 5. CHECK A SPECIFIC USER

```powershell
cd C:\Users\Admin\USSD\backend
node -e "const {Pool}=require('pg');const db=new Pool({connectionString:'postgresql://postgres:23748124@localhost:5432/voo_db'});db.query(`SELECT * FROM constituents WHERE phone_number='+254XXXXXXXXX'`).then(r=>{if(r.rows.length===0){console.log('User not found');}else{const u=r.rows[0];console.log('\n=== USER DETAILS ===\n');console.log('Name:',u.full_name);console.log('ID:',u.national_id);console.log('Phone:',u.phone_number);console.log('Location:',u.location,'>',u.sublocation,'>',u.village);console.log('Status:',u.verification_status);console.log('Verified by:',u.verified_by||'N/A');console.log('Verified at:',u.verified_at||'N/A');console.log('Registered:',u.created_at);}db.end()}).catch(e=>{console.error(e.message);db.end()})"
```

**Replace:** `+254XXXXXXXXX` with actual phone number

---

## 🎯 QUICK WORKFLOW

### When a new registration comes in:

1. **View pending:** Run command #1
2. **Verify ID:** Check if National ID is real
3. **Verify Location:** Confirm person is from stated location
4. **Decision:**
   - ✅ **Valid?** → Run command #2 (Approve)
   - ❌ **Invalid?** → Run command #3 (Reject with reason)

### User experience after approval:

```
*384*8481#
→ 1 (English)
→ 
KYAMATU WARD

1. News
2. Report Issue
3. Apply Bursary
4. Projects
0. Exit
```

---

## 📊 COMING SOON: Admin Dashboard

- Visual interface for all above commands
- One-click approve/reject
- Bulk operations
- SMS notifications
- Verification history
- Export reports

---

## 🚨 IMPORTANT NOTES

1. **Always verify ID before approving!**
2. **Check location is actually in Kyamatu Ward**
3. **Document rejection reasons clearly**
4. **Keep track of who verified (verified_by)**

---

## 🎯 CURRENT STATUS

✅ **WORKING NOW:**
- Registration with location validation
- Pending status system
- Manual verification via PowerShell
- Access control (only verified users)

📋 **COMING SOON:**
- Admin dashboard UI
- Bulk approval
- SMS notifications
- Verification reports
