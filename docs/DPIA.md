# Voo Ward Backend API

## Health

\\\
GET /health
Response: { ok: true, ussd: '*340*75#' }
\\\

## USSD

\\\
POST /ussd
Content-Type: application/json

{
  "sessionId": "unique-session-id",
  "phoneNumber": "+254712345678",
  "text": "1*2*3"
}

Response: text/plain
CON Voo Kyamatu...
END Thank you...
\\\

## Admin Auth

\\\
POST /auth/login
{
  "pin": "123456"
}

Response: { token: "jwt-token", role: "admin" }
\\\

## Announcements

\\\
GET /announcements (requires JWT)
Response: [{ id, title, body, created_at }]

POST /announcements (requires JWT + admin)
{ title: "...", body: "..." }
\\\
"@ | Out-File -Encoding UTF8 c:\Users\Admin\USSD\docs\api.md

# docs/ops.md
@"
# Operations Guide

## Deployment

### Prerequisites
- Node.js 20 LTS
- PostgreSQL 14+ (cloud)
- SQLite (edge)

### Setup
1. Clone repository
2. \
pm install\ in backend/
3. Set environment variables in /etc/voo-ward/
4. \
pm run migrate:cloud\ to initialize database
5. \
pm run migrate:edge\ for edge SQLite
6. \
pm run start\ to start server

### Secrets (/etc/voo-ward/)
- at_api_key (Africa's Talking API key)
- jwt_key (JWT signing key)
- db_url (PostgreSQL connection string)

### Systemd Service
Copy \packaging/systemd/voo-ward.service\ to /etc/systemd/system/
\\\
systemctl enable voo-ward
systemctl start voo-ward
\\\

### Monitoring
\\\
curl http://localhost:4000/health
\\\

### Backups
PostgreSQL: \pg_dump -Fc voo_ward > backup.sql\
SQLite: \sqlite3 edge.db \".backup backup.db\"\
"@ | Out-File -Encoding UTF8 c:\Users\Admin\USSD\docs\ops.md

# docs/DPIA.md
@"
# Data Protection Impact Assessment (DPIA)

## Data Collected
- Phone number (MSISDN) - hashed
- National ID (last 4 digits) - hashed
- Name, village, year of birth
- Issue tickets and bursary applications
- Admin audit trail

## Consent
- Explicit opt-in required during registration
- Stored with timestamp
- Can be revoked (data flagged as deleted)

## Storage
- PostgreSQL (cloud, encrypted at rest)
- SQLite (edge, isolated on Raspberry Pi)
- No data leaves Kenya without consent

## Retention
- Issue tickets: 2 years
- Bursary records: 5 years (financial compliance)
- Audit logs: 1 year
- Constituents: Until revoked

## Rights
- Right to access: /api/constituents/me
- Right to erase: bin/delete-constituent {id_hash}
- Right to object: Flag record as do_not_contact

## DPA Contact
Ward: Voo Kyamatu Ward Office
