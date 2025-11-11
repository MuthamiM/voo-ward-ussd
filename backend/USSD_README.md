USSD webhook and admin dashboard — quick operations

What I changed
- Added USSD endpoint at POST /api/ussd that supports JSON and plain text payloads.
- Added robust parsing for provider variants (spaces, `*` separators), and per-IP rate limiting (in-memory by default, Redis when REDIS_URL is set).
- Added bcrypt password hashing and automatic migration for legacy SHA-256 passwords on successful login.
- Optional Redis-backed sessions and rate-limiter (set `REDIS_URL` to enable).
- Dashboard: lightweight login that stores token in localStorage and uses `GET /api/auth/me` to read `fullAccess`.

How to test the USSD endpoint (examples)

PowerShell (JSON):
$body = @{ text = "" } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://voo-ward-ussd.onrender.com/api/ussd' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing

PowerShell (simulate 1*REF lookup):
Invoke-RestMethod -Uri 'https://voo-ward-ussd.onrender.com/api/ussd' -Method POST -Body (ConvertTo-Json @{ text = "1*REF123" }) -ContentType 'application/json'

curl.exe (Windows):
curl.exe -i -X POST -H "Content-Type: application/json" -d "{\"text\":\"1*REF123\"}" https://voo-ward-ussd.onrender.com/api/ussd

Notes for USSD gateway providers
- Africa's Talking: set callback URL to https://<your-host>/api/ussd and choose POST. AT sends `text` payload in body (application/x-www-form-urlencoded by default). We've enabled JSON and text/plain handlers; if your provider sends urlencoded, Render's Express urlencoded middleware will parse it.
- Twilio: Twilio sends form-encoded parameters; the server will parse them via urlencoded middleware. The text field can be `Body` or `text` — our handler checks common names.

Environment variables
- MONGO_URI (required) - MongoDB connection string
- SEED_ADMIN_TOKEN (recommended) - token protecting the /api/auth/seed-admin endpoint
- REDIS_URL (optional) - if set, sessions and rate-limiter use Redis; otherwise in-memory Map is used

Production hardening recommendations
- Rotate and remove SEED_ADMIN_TOKEN when not needed.
- Add HTTPS termination or ensure provider traffic is TLS.
- Use Redis for sessions when running multiple instances.
- Move from prompt() login UI to a proper modal and secure cookie/session handling.

If you want, I can now:
- Add Redis wiring to Render environment and enable it, or
- Replace the prompt() login UI with a small modal, or
- Rotate SEED_ADMIN_TOKEN for you (I can generate a token and you must set it in Render env), or
- Migrate all passwords immediately (dangerous) — currently they migrate on first successful login.

