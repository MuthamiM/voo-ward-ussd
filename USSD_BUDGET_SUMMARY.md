# USSD Budget Summary (extracted from repository)

This file summarizes every budget-related mention and relevant implementation details found in the repository (collected 2025-11-16).

## Key cost numbers
- Recommended production USSD monthly cost: $50-70 / month (source: `START_HERE_USSD_REALITY.md`).
- Annual: $600-840 (same source).
- Per-voter estimate: ~$0.14 per voter per year (source: `START_HERE_USSD_REALITY.md`, based on ~5000 voters).

## Database schema
- `backend/migrations/cloud/01_init.sql` declares a `projects` table with a `budget DECIMAL(12, 2)` column. This is the primary storage field for project budgets in the SQL schema.

Excerpt:
```
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'planning',
  budget DECIMAL(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Backend handling (Mongo routes)
- `src/routes/mongo-crud.js` (projects endpoints) parses and persists `budget` values for projects:
  - On create: `budget: parseFloat(budget) || 0`
  - On update: coerces `updates.budget = parseFloat(updates.budget)` when provided

This indicates both SQL and Mongo parts of the code base treat `budget` as a numeric value and accept decimal amounts.

## Documentation / Recommendations
- `START_HERE_USSD_REALITY.md` (top-level) / `backend/START_HERE_USSD_REALITY.md` contain the project budget recommendations and funding options. Key points:
  - Production setup one-time: $50-100 (setup fee)
  - Monthly: $50-70
  - Annual: $600-840
  - Funding suggestions: county budget, community contributions (M-Pesa), sponsors, cost-sharing

- `MASTER_GUIDE.md` describes the Budget & Finance feature (menu #6) and shows sample budget numbers in KES (e.g., FY 2024-25: 450M KES with breakdowns). This is the content displayed to users via USSD for transparency.

## Files containing "budget"
- `START_HERE_USSD_REALITY.md` (top-level)
- `backend/START_HERE_USSD_REALITY.md`
- `MASTER_GUIDE.md`
- `backend/MASTER_GUIDE.md`
- `backend/migrations/cloud/01_init.sql`
- `src/routes/mongo-crud.js`
- `backend/src/routes/mongo-crud.js` (duplicate paths exist)

## Notes & Observations
- The repository includes both SQL schema and MongoDB route implementations; `budget` appears in the SQL `projects` table and in Mongo project documents. That suggests multiple data backends or duplicate code paths — verify which DB is active in your production configuration (`POSTGRESQL` vs `MONGO_URI`).
- The documented operational cost (~$60/mo) corresponds to the Africa's Talking USSD channel fees and recommended hosting fees (Render/Railway) noted elsewhere.

## Suggested next steps
1. Confirm which database is active in production (Postgres vs Mongo) and ensure the `projects` table or collection is the canonical source of budgets.
2. If you want, I can extract the full git history for budget-related changes (e.g., `git log -S budget --pretty=oneline -- src | sed -n '1,200p'`) and present relevant commits.
3. I can also add an API endpoint (admin-only) to export all budgets/transactions and commit it if you'd like an on-demand CSV export.

---
Generated automatically from repository scan on 2025-11-16.
