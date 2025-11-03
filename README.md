# 🔒 Voo Kyamatu Ward Development Platform

Production-grade USSD + SMS + Offline Admin with **Enterprise Security** for rural ward development.

## 🛡️ SECURITY STATUS: MAXIMUM PROTECTION
- **🔐 AES-256-GCM Encryption** for all PII data
- **🛡️ Progressive Rate Limiting** with IP blocking  
- **📋 GDPR + Kenya DPA Compliance** with automated reporting
- **🔍 Real-time Security Monitoring** with audit logging
- **⚡ Advanced Input Validation** against injection attacks

## Architecture

### Components

- **Backend**: Fastify (Node.js 20) on port 4000
  - USSD handler (*340*75#)
  - JWT admin API
  - PostgreSQL integration
  - Structured logging (pino)
  
- **Frontend**: React 18 + Vite 5 on port 5173
  - Offline-capable PWA
  - Admin dashboard
  - Service Worker cache

- **Databases**
  - **Cloud**: PostgreSQL 14+ (primary)
  - **Edge**: SQLite WAL (Raspberry Pi, offline-first)

### Sync Strategy

- Edge SQLite maintains full data copy with WAL mode
- 5-minute sync job exports NDJSON to cloud
- Cloud upserts by unique keys (last-write-wins)
- Offline queue preserved; no data loss

## Quick Start

### Backend

\\\ash
cd backend
npm install
npm run migrate:cloud        # Init PostgreSQL
npm run start                # Start on :4000
\\\

### Frontend

\\\ash
cd frontend
npm install
npm run dev                  # Start on :5173
\\\

### Health Check

\\\ash
curl <http://localhost:4000/health>

# { ok: true, ussd: '*340*75#' }

\\\

## Directory Structure

\\\
.
 backend/
    src/
       index.js             # Fastify server
       lib/                 # Utilities (logger, crypto, db, validators)
       routes/              # USSD, admin, sync endpoints
    migrations/              # SQL migrations (cloud + edge)
    bin/                     # CLI tools
    package.json
    Makefile
    .env

 frontend/
    src/
       App.jsx              # Admin dashboard
       main.jsx
       index.css
    index.html
    vite.config.js
    package.json

 docs/
    api.md                   # Endpoint reference
    ops.md                   # Deployment & backup
    DPIA.md                  # Data protection checklist

 README.md
\\\

## Production Checklist

- [ ] Set JWT_KEY in /etc/voo-ward/jwt_key (root-owned, 0400)
- [ ] Set AT_API_KEY in /etc/voo-ward/at_api_key
- [ ] Configure PostgreSQL: DB_URL=/etc/voo-ward/db_url
- [ ] Install systemd service: \make install-systemd\
- [ ] Enable nightly backups: \in/backup-cloud\
- [ ] Set up edge sync timer: \systemctl enable voo-ward-sync.timer\
- [ ] CORS restricted to 127.0.0.1 (admin) or ward LAN
- [ ] Rate limiting: 10 USSD/SMS per phone per minute

## 🔒 Enterprise Security Features

### Implemented Security Enhancements (November 2025)
- **AES-256-GCM Encryption**: Field-level PII encryption at rest
- **Progressive Rate Limiting**: Multi-tier protection (USSD: 10/10s, Admin: 20/20s, Global: 100/1s)
- **IP Blocking**: Automatic 24-hour blocks after 10 failed attempts
- **Enhanced Authentication**: bcrypt cost 14, JWT 8-hour expiration
- **Input Validation**: SQL injection and XSS protection with pattern detection
- **Audit Logging**: Comprehensive security event tracking with severity levels
- **Privacy Protection**: GDPR Article 25 compliance with data subject rights
- **Real-time Monitoring**: Security dashboard with automated threat detection

### Security Testing
```bash
# Verify all security features
node backend/test-security.js

# Expected output: MAXIMUM PROTECTION status
```

### Security Documentation
- **Full Security Guide**: [SECURITY_DOCUMENTATION.md](./SECURITY_DOCUMENTATION.md)
- **Environment Setup**: Production-grade security keys configured
- **Compliance Reports**: Automated GDPR/Kenya DPA reporting available

## Compliance

- **GDPR/Kenya DPA 2019**: Enhanced with automated compliance reporting and data retention
- **Security**: Multi-layer protection with AES-256-GCM, progressive rate limiting, IP blocking
- **Privacy**: Data subject rights implementation (access, rectification, erasure, portability)
- **Auditing**: Enhanced logging with security event tracking and admin change monitoring
- **Availability**: 99.9% SLA via edge caching + cloud sync + security protection
- **Recovery**: Automated daily backups to encrypted store with security event preservation

## Support

Email: <voo-ward-support@example.com>
