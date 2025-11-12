# SAFARICOM USSD SERVICE REQUEST

**To:** Safaricom Business Team  
**From:** Kyamatu Ward Administration  
**Date:** November 4, 2025  
**Subject:** USSD Short Code Application - Kyamatu Ward Citizen Services

---

## 1. SERVICE OVERVIEW

We are requesting a USSD short code to provide essential citizen services to Kyamatu Ward residents. The service will enable:

- Constituent registration
- Issue reporting (roads, water, security, etc.)
- Access to ward announcements
- Information on ongoing projects

**Service is completely FREE for users** - no charges apply.

---

## 2. CALLBACK INFORMATION

**Production Callback URL:**
```
https://voo-ward-ussd.onrender.com/ussd
```

**Technical Details:**
- Protocol: HTTPS (TLS 1.2+)
- Method: POST
- Content-Type: application/x-www-form-urlencoded
- Response Format: Plain text with CON/END prefix

**Health Check Endpoint:**
```
https://voo-ward-ussd.onrender.com/health
```

---

## 3. REQUESTED SHORT CODE

**Preferred Format:** `*XXX#` (Any available 3-digit code)  
**Alternative:** `*XXXX#` (4-digit if 3-digit unavailable)

**Usage Pattern:** Low to moderate (estimated 100-500 users/day)

---

## 4. SERVICE FEATURES

### Multi-Language Support
- English
- Swahili
- Kamba

### Main Services
1. **Constituent Registration**
   - Name and ID collection
   - Database storage for ward records

2. **Issue Reporting**
   - Roads, water, security, sanitation
   - Categorized complaints with tracking

3. **Announcements**
   - Ward events and notices
   - Public meetings information

4. **Projects**
   - Ongoing development projects
   - Budget allocation transparency

---

## 5. TECHNICAL COMPLIANCE

✅ Server hosted on Render.com (99.9% uptime)  
✅ HTTPS encryption enabled  
✅ Response time < 3 seconds  
✅ Rate limiting implemented  
✅ Error handling tested  
✅ Session management active  
✅ Health monitoring in place  

**System has been tested and is production-ready.**

---

## 6. CONTACT DETAILS

### Technical Contact
**Name:** Musa Muthami  
**Role:** System Administrator  
**Phone:** _________________  
**Email:** _________________  

### Administrative Contact
**Organization:** Kyamatu Ward Office  
**Name:** _________________  
**Role:** Ward Administrator  
**Phone:** _________________  
**Email:** _________________  
**Physical Address:** _________________

---

## 7. TESTING ACCESS

**Test Endpoint Available:** Yes  
**Test URL:** Same as production (`https://voo-ward-ussd.onrender.com/ussd`)  
**Test Account:** Not required - service is public  

**Sample Test Flow:**
```
1. User dials *XXX#
2. System shows language menu
3. User selects language (1, 2, or 3)
4. System shows service menu
5. User navigates through options
6. System processes and responds
```

---

## 8. COMMERCIAL DETAILS

**Service Type:** Public Service (Non-commercial)  
**User Charges:** FREE (No charges to users)  
**Revenue Model:** Funded by Ward Administration  
**Target Launch Date:** Within 2 weeks of approval  

---

## 9. COMPLIANCE & LEGAL

- Service complies with Kenya Data Protection Act 2019
- No sensitive personal data stored beyond registration
- Users can request data deletion
- Privacy policy available on request
- Service terms provided to users

---

## 10. SUPPORTING DOCUMENTS

Attached:
1. ✅ Technical Integration Guide
2. ✅ Service Application Form
3. ✅ API Documentation
4. ⬜ Certificate of Registration (if required)
5. ⬜ KRA PIN Certificate (if required)

---

## 11. NEXT STEPS REQUESTED

1. Review and approve service concept
2. Assign USSD short code (*XXX#)
3. Whitelist callback URL
4. Provide testing period (7 days)
5. Sign commercial agreement
6. Launch service

---

## 12. DECLARATION

I hereby declare that:
- All information provided is accurate
- Service complies with Safaricom terms
- Technical infrastructure is production-ready
- Service will be maintained and supported

**Signature:** _________________  
**Name:** _________________  
**Title:** _________________  
**Date:** November 4, 2025

---

## 13. SAFARICOM USE ONLY

**Application Reference:** _________________  
**Short Code Assigned:** _________________  
**Approval Date:** _________________  
**Account Manager:** _________________  
**Notes:** _________________

---

**For Safaricom Inquiries:**  
Email: businesscare@safaricom.co.ke  
Phone: 0722 000 000

**Callback URL (Ready for Production):**
```
https://voo-ward-ussd.onrender.com/ussd
```
