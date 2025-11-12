# USSD SERVICE APPLICATION - KYAMATU WARD

## 1. SERVICE DETAILS

**Service Name:** Kyamatu Ward Citizen Services  
**Service Provider:** Kyamatu Ward Administration  
**Service Type:** Information & Citizen Engagement  
**Target Audience:** Residents of Kyamatu Ward  

---

## 2. TECHNICAL SPECIFICATIONS

**USSD Short Code:** (To be assigned by Safaricom)  
**Callback URL:** `https://voo-ward-ussd.onrender.com/ussd`  
**Protocol:** HTTPS (TLS 1.2+)  
**Method:** POST  
**Content-Type:** application/x-www-form-urlencoded  

### Expected Request Parameters:
- `sessionId` - Unique session identifier
- `phoneNumber` - User's phone number (format: 254XXXXXXXXX)
- `text` - User input string (menu selections separated by *)

### Response Format:
- `CON` prefix for continuation (show menu)
- `END` prefix for termination (end session)

---

## 3. SERVICE MENU STRUCTURE

### Main Menu (3 Languages)
1. English
2. Swahili  
3. Kamba

### Service Options:
1. **Register as Constituent** - Citizen registration
2. **Report an Issue** - Report ward problems
3. **Announcements** - View ward announcements
4. **Projects** - View ongoing projects
0. **Back/Exit**

---

## 4. TECHNICAL REQUIREMENTS MET

✅ HTTPS encryption enabled  
✅ Response time < 3 seconds  
✅ 99.9% uptime on Render.com infrastructure  
✅ Rate limiting implemented  
✅ Session management enabled  
✅ Error handling implemented  
✅ Multi-language support (EN/SW/KM)  

---

## 5. SERVER INFRASTRUCTURE

**Hosting Provider:** Render.com  
**Server Location:** Oregon, USA (US West)  
**Runtime:** Node.js 22.16.0  
**Database:** MongoDB Atlas (Cloud)  
**Backup:** Daily automated backups  

---

## 6. CONTACT INFORMATION

**Technical Contact:**  
Name: Musa Muthami  
Role: System Administrator  
Phone: _________________  
Email: _________________  

**Ward Contact:**  
Name: _________________  
Role: Ward Administrator  
Phone: _________________  
Email: _________________  

---

## 7. TESTING ENDPOINTS

**Health Check:**  
`GET https://voo-ward-ussd.onrender.com/health`

**USSD Endpoint:**  
`POST https://voo-ward-ussd.onrender.com/ussd`

---

## 8. SAMPLE USSD FLOW

```
User dials: *XXX#

Response 1 (CON):
KYAMATU WARD - FREE SERVICE
Select Language:
1. English
2. Swahili
3. Kamba

User enters: 1

Response 2 (CON):
Language: English
1. Register as Constituent
2. Report an Issue
3. Announcements
4. Projects
0. Back

User enters: 2

Response 3 (CON):
Report an Issue
Please describe the issue:
(Use keypad to type)

User enters: Road damage

Response 4 (END):
Thank you! Your issue has been recorded.
Reference: #12345
```

---

## 9. SECURITY MEASURES

- HTTPS/TLS encryption
- Input sanitization
- Rate limiting (90 requests/minute)
- Session timeout (5 minutes)
- No storage of sensitive user data
- GDPR compliant data handling

---

## 10. SERVICE COMMITMENT

**Availability:** 24/7/365  
**Support Hours:** 8 AM - 5 PM EAT (Mon-Fri)  
**Response Time:** < 1 hour for critical issues  
**Maintenance Window:** Sundays 2 AM - 4 AM EAT  

---

## 11. APPROVAL CHECKLIST

- [ ] Service concept approved
- [ ] USSD short code assigned
- [ ] Callback URL whitelisted
- [ ] Testing period completed
- [ ] Commercial agreement signed
- [ ] Service goes live

---

**Date:** November 4, 2025  
**Version:** 1.0  
**Status:** Pending Approval
