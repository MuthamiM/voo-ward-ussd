# Provider-Side Engineering Checklist (PSEC)

## Service Information
**Service Name**: VOO Kyamatu Ward USSD  
**Service Type**: USSD Interactive Application  
**Callback URL**: https://voo-ward-ussd.onrender.com/ussd  
**Health Endpoint**: https://voo-ward-ussd.onrender.com/health  
**Protocol**: HTTP/HTTPS POST  
**Content-Type**: application/x-www-form-urlencoded

## Technical Requirements

### 1. Callback Configuration
- [ ] Callback URL configured in aggregator
- [ ] POST method enabled
- [ ] Form-encoded content type set
- [ ] Timeout set to 20 seconds minimum
- [ ] Retry logic: 2 retries with 2-second delay

### 2. Request Format
Required POST parameters:
- [ ] `sessionId` - Session identifier (string, max 50 chars)
- [ ] `serviceCode` - USSD code dialed (string, e.g., *384*44647#)
- [ ] `phoneNumber` - E.164 format (string, e.g., +254114945842)
- [ ] `text` - User input (string, empty on first request, asterisk-separated)

### 3. Response Handling
- [ ] Parse plain text responses
- [ ] Detect CON prefix (continue session)
- [ ] Detect END prefix (terminate session)
- [ ] Handle UTF-8 encoding
- [ ] Support newlines (\n) for menu display
- [ ] Maximum response length: 182 characters per screen

### 4. Session Management
- [ ] Maintain session state per sessionId
- [ ] Session timeout: 60 seconds of inactivity
- [ ] Clear session on END response
- [ ] Handle concurrent sessions per user

### 5. Error Handling
- [ ] HTTP 200 OK: Normal response
- [ ] HTTP 500: Show generic error to user ("Service unavailable")
- [ ] Timeout: Show "Service not responding"
- [ ] Network error: Retry up to 2 times
- [ ] Invalid response format: Log and show error

### 6. Security
- [ ] HTTPS/TLS 1.2+ for callback
- [ ] IP whitelisting (if required by provider)
- [ ] Rate limiting: 10 requests/second per user
- [ ] DDoS protection enabled
- [ ] No SQL injection vectors (validated on server)

### 7. Logging & Monitoring
- [ ] Log all requests (sessionId, phoneNumber, timestamp)
- [ ] Log all responses (status, response time)
- [ ] Alert on 5xx errors (> 5% error rate)
- [ ] Monitor response times (< 3 seconds target)
- [ ] Track session completion rates

### 8. Data Format Examples

**Initial Request** (text=""):
```
POST /ussd HTTP/1.1
Host: voo-ward-ussd.onrender.com
Content-Type: application/x-www-form-urlencoded

sessionId=ATUid_12345&serviceCode=*384*44647%23&phoneNumber=%2B254114945842&text=
```

**Response** (CON):
```
CON KYAMATU WARD - FREE SERVICE

Select Language:
1. English
2. Swahili
3. Kamba
```

**Follow-up Request** (text="1"):
```
POST /ussd HTTP/1.1
Content-Type: application/x-www-form-urlencoded

sessionId=ATUid_12345&serviceCode=*384*44647%23&phoneNumber=%2B254114945842&text=1
```

**Final Response** (END):
```
END Registration complete. Thank you.
```

### 9. Performance Requirements
- [ ] Response time: < 3 seconds (95th percentile)
- [ ] Uptime: 99.9% availability
- [ ] Concurrent sessions: 100+ simultaneous
- [ ] Peak load: 1000 requests/minute

### 10. Testing Checklist
- [ ] Test initial dial (empty text)
- [ ] Test menu navigation (text="1", text="1*2", etc.)
- [ ] Test session timeout
- [ ] Test invalid input handling
- [ ] Test database connection failure scenarios
- [ ] Test concurrent sessions from same number
- [ ] Load test with 100+ concurrent users
- [ ] Test character encoding (special characters)
- [ ] Test response length limits

### 11. Compliance & Data Protection
- [ ] User data encrypted in transit (TLS)
- [ ] User data encrypted at rest (MongoDB)
- [ ] Data retention: 12 months maximum
- [ ] GDPR compliance verified
- [ ] Kenya Data Protection Act compliance
- [ ] No third-party data sharing
- [ ] User consent logged for registration

### 12. Contacts & Support

**Technical Support**:
- Primary: support@kyamatuward.go.ke
- Emergency: +254114945842
- Response Time: 4 hours (business hours)

**Escalation**:
- L1: System health check (5 minutes)
- L2: Application logs review (15 minutes)
- L3: Database connectivity check (30 minutes)
- L4: Code deployment rollback (1 hour)

### 13. Maintenance Windows
- **Scheduled**: First Sunday of month, 2:00 AM - 4:00 AM EAT
- **Notice Period**: 48 hours advance notice
- **Emergency Maintenance**: Immediate notification via email/SMS

### 14. Disaster Recovery
- [ ] Daily database backups
- [ ] 24-hour backup retention
- [ ] Auto-failover to backup region
- [ ] Recovery Time Objective (RTO): 1 hour
- [ ] Recovery Point Objective (RPO): 24 hours

---

## Sign-Off

**Provider Representative**:  
Name: _______________________  
Title: _______________________  
Signature: ___________________  
Date: _______________________

**Service Provider Representative**:  
Name: _______________________  
Title: _______________________  
Signature: ___________________  
Date: _______________________

**Document Version**: 1.0  
**Date Issued**: November 4, 2025  
**Review Date**: February 4, 2026
