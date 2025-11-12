# VOO Kyamatu Ward USSD - Operator Handover Documentation

## Service Overview
**Service Name**: VOO Kyamatu Ward Constituent Services  
**Service Type**: USSD Application  
**Target Operator**: Safaricom / Airtel Kenya  
**Callback URL**: `https://voo-ward-ussd.onrender.com/ussd`  
**Service Code**: *384*44647# (to be assigned by operator)

## Purpose
This USSD application provides free constituent services for Kyamatu Ward residents, including:
- Constituent registration
- Issue reporting to ward office
- Ward announcements access
- Project status updates

## Technical Specifications

### Callback URL
```
POST https://voo-ward-ussd.onrender.com/ussd
Content-Type: application/x-www-form-urlencoded
```

### Request Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| sessionId | string | Unique session identifier | ABC123 |
| serviceCode | string | USSD code dialed | *384*44647# |
| phoneNumber | string | User's phone number (E.164) | +254114945842 |
| text | string | User input (empty for first request) | 1*2*MyIssue |

### Response Format
All responses are plain text strings prefixed with:
- **CON** - Continue (show menu and wait for input)
- **END** - End session (final message)

### Example Request
```http
POST /ussd HTTP/1.1
Host: voo-ward-ussd.onrender.com
Content-Type: application/x-www-form-urlencoded

sessionId=ATUid_12345&serviceCode=*384*44647%23&phoneNumber=%2B254114945842&text=
```

### Example Response (Initial)
```
CON KYAMATU WARD - FREE SERVICE

Select Language:
1. English
2. Swahili
3. Kamba
```

### Example Response (Menu)
```
CON Main Menu:
1. Register constituent
2. Report issue
3. Announcements
4. Projects
0. Exit
```

### Example Response (End)
```
END Registration complete. Thank you.
```

## User Flow
1. **Dial Code**: User dials *384*44647#
2. **Language Selection**: Choose English/Swahili/Kamba
3. **Main Menu**: Select service option
4. **Interactive Forms**: Multi-step data collection
5. **Confirmation**: Success/failure message

## Access Control
- **Allowed Numbers**: Currently restricted to +254114945842 (ward administrator)
- **Expansion**: Can be opened to all numbers in ward constituency
- **Restriction Message**: "Access restricted to VOO Kyamatu Ward."

## Testing

### Test with cURL (Initial Screen)
```bash
curl -X POST https://voo-ward-ussd.onrender.com/ussd \
  -d "sessionId=TEST123" \
  -d "serviceCode=*384*44647#" \
  -d "phoneNumber=%2B254114945842" \
  -d "text="
```

**Expected Response**:
```
CON KYAMATU WARD - FREE SERVICE

Select Language:
1. English
2. Swahili
3. Kamba
```

### Test Main Menu
```bash
curl -X POST https://voo-ward-ussd.onrender.com/ussd \
  -d "sessionId=TEST123" \
  -d "serviceCode=*384*44647#" \
  -d "phoneNumber=%2B254114945842" \
  -d "text=1"
```

**Expected Response**:
```
CON Main Menu:
1. Register constituent
2. Report issue
3. Announcements
4. Projects
0. Exit
```

## Technical Contacts
**Developer**: VOO Kyamatu Ward Technical Team  
**Email**: support@kyamatuward.go.ke  
**Emergency Contact**: +254114945842

## Deployment Details
- **Platform**: Render.com (Web Service)
- **Uptime**: 99.9% SLA
- **Health Check**: https://voo-ward-ussd.onrender.com/health
- **Monitoring**: Automated health checks every 5 minutes
- **Database**: MongoDB Atlas (secure, encrypted)

## Service Availability
- **24/7 Operation**: Always available
- **Maintenance Windows**: Announced 48 hours in advance
- **Fallback**: Graceful degradation if database unavailable

## Compliance
- Data retention: 12 months
- GDPR/DPA compliant
- No PII shared with third parties
- Secure TLS encryption (all connections)

## Next Steps for Operator
1. Assign USSD short code (*384*44647# or alternative)
2. Configure callback URL in aggregator: `https://voo-ward-ussd.onrender.com/ussd`
3. Whitelist IP addresses (if required)
4. Test with provided test numbers
5. Submit test reports for validation
6. Go-live approval

## Support
For technical support or integration issues:
- Check health endpoint: https://voo-ward-ussd.onrender.com/health
- Review server logs on Render dashboard
- Contact technical team via email

---
**Document Version**: 1.0  
**Last Updated**: November 4, 2025  
**Prepared for**: Safaricom/Airtel Kenya Integration
