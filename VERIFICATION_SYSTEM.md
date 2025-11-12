# KYAMATU WARD USSD VERIFICATION SYSTEM

## 🔐 How ID and Location Verification Works

### 1. LOCATION VALIDATION
When a constituent registers, the system validates their location against approved Kyamatu Ward locations:

**Valid Locations:**
- KYAMATU
- KIKIMA  
- MBONDONI
- NGULUNI
- KITHYOKO
- MUTITUNI

If someone enters a location NOT in this list, registration is REJECTED immediately with:
```
Invalid location. Must be in Kyamatu Ward.

Valid: Kyamatu, Kikima, Mbondoni, Nguluni, Kithyoko, Mutituni
```

### 2. PENDING APPROVAL SYSTEM
All new registrations are saved with `verification_status = 'pending'`:

```
✅ REGISTERED!

John Doe Kamau
ID: 12345678
Location: KYAMATU

⏳ Your registration is pending verification by the MCA office.

You will be notified once approved.
```

### 3. ADMIN VERIFICATION PROCESS
In the Admin Dashboard (http://localhost:5173), the MCA office can:

**View Pending Registrations:**
- Full Name
- National ID
- Phone Number
- Location / Sub-Location / Village
- Registration Date

**Verify ID:**
- Check if National ID exists in government database
- Verify ID matches the person's name
- Confirm person is actually from stated location

**Actions:**
1. **APPROVE** ✅
   - Mark as `verification_status = 'verified'`
   - User can now access all ward services
   - Records who approved and when

2. **REJECT** ❌
   - Mark as `verification_status = 'rejected'`
   - Add rejection reason
   - User sees: "Your registration was REJECTED. Contact MCA Office"

### 4. USER EXPERIENCE AFTER REGISTRATION

**PENDING (Waiting for Approval):**
```
*384*8481#
→ Language selection
→ 
⏳ Your registration is PENDING verification.

You will be notified once approved.

MCA Office: 0706757140
```

**REJECTED:**
```
*384*8481#
→ Language selection
→ 
Your registration was REJECTED.

Contact MCA Office: 0706757140
```

**VERIFIED (Approved):**
```
*384*8481#
→ Language selection
→ 
KYAMATU WARD

1. News
2. Report Issue
3. Apply Bursary
4. Projects
0. Exit
```

### 5. DATABASE VERIFICATION COLUMNS

**constituents table:**
- `verification_status` - 'pending', 'verified', or 'rejected'
- `verified_by` - Admin name who approved/rejected
- `verified_at` - Timestamp of verification
- `rejection_reason` - Why registration was rejected

### 6. SECURITY MEASURES

✅ **Location Validation** - Only Kyamatu Ward locations accepted
✅ **ID Uniqueness** - One ID can only register once
✅ **Phone Uniqueness** - One phone can only register once  
✅ **Manual Verification** - Human review of all registrations
✅ **Audit Trail** - Records who verified and when
✅ **Access Control** - Only verified users access services

### 7. ADMIN WORKFLOW

1. **New Registration Arrives**
   - Appears in "Pending Verifications" tab
   - Shows all user details

2. **MCA Office Verifies:**
   - Check National ID card (physical or scanned)
   - Confirm person is from stated location
   - Verify contact details

3. **Approve or Reject:**
   - Click "Approve" ✅ → User can access services
   - Click "Reject" ❌ → Add reason → User cannot access

4. **Notification:**
   - System can send SMS notification (future feature)
   - User dials *384*8481# to check status

### 8. PREVENTING FRAUD

**Multiple Checks:**
1. Location must be in Kyamatu Ward ✓
2. National ID format validated (7-12 digits) ✓
3. ID cannot be used twice ✓
4. Phone cannot be used twice ✓
5. Manual verification by MCA office ✓
6. Admin can reject suspicious registrations ✓

**Red Flags:**
- Location not in Kyamatu Ward
- ID format invalid
- Name doesn't match ID
- Person not known in stated village
- Duplicate registration attempts

### 9. ADDING MORE LOCATIONS

To add more valid locations, edit this line in `backend/src/routes/ussd.js`:

```javascript
const validLocations = ['KYAMATU', 'KIKIMA', 'MBONDONI', 'NGULUNI  ', 'KITHYOKO', 'MUTITUNI', 'NEW_LOCATION'];
```

### 10. REPORTING

Admin dashboard can export:
- **All Constituents** (CSV)
  - Includes verification status
  - Shows who verified and when
  
- **Pending Verifications** (CSV)
  - All unverified registrations
  - Sorted by registration date

---

## 🎯 SUMMARY

**How Verification Works:**
1. User registers → **Location checked** → If valid, saved as PENDING
2. MCA office reviews → **Verifies ID and location** → Approves or Rejects
3. User can only access services after **APPROVAL**

**This ensures:**
✅ Only real Kyamatu Ward constituents get access
✅ All IDs are manually verified
✅ Fraud attempts are blocked
✅ Complete audit trail of all registrations
