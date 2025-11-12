#!/usr/bin/env node
// Simple utility to inspect or reset the default admin user in the DB.
// Usage (PowerShell):
//   $env:MONGO_URI = "your_conn_string"; node .\backend\scripts\reset-admin.js
// Optional env vars:
//   ADMIN_USER (default: admin)
//   ADMIN_PASS (default: admin123)
//   ADMIN_FULLNAME (default: Zak)
//   ADMIN_ROLE (default: MCA)
//   DRY_RUN=1  -> only show what would change (no writes)

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function hashSha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function isBcryptHash(s) {
  return typeof s === 'string' && s.startsWith('$2');
}

(async function main() {
  try {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!MONGO_URI) {
      console.error('MONGO_URI (or MONGODB_URI) is required in env');
      process.exit(2);
    }

    const ADMIN_USER = (process.env.ADMIN_USER || 'admin').toLowerCase();
    const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
    const ADMIN_FULLNAME = process.env.ADMIN_FULLNAME || 'Zak';
    const ADMIN_ROLE = process.env.ADMIN_ROLE || 'MCA';
    const DRY_RUN = !!process.env.DRY_RUN;

    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    // Use the default DB from the connection string, or 'voo_ward' as fallback
    const db = client.db();
    const col = db.collection('admin_users');

    console.log(`Looking up user: ${ADMIN_USER}`);
    const existing = await col.findOne({ username: ADMIN_USER });

    if (!existing) {
      console.log('User does not exist. It will be created.');
      if (DRY_RUN) {
        console.log('[DRY RUN] Would insert user:', { username: ADMIN_USER, full_name: ADMIN_FULLNAME, role: ADMIN_ROLE });
      } else {
        const hash = await bcrypt.hash(ADMIN_PASS, 10);
        const doc = {
          username: ADMIN_USER,
          password: hash,
          full_name: ADMIN_FULLNAME,
          role: ADMIN_ROLE,
          created_at: new Date(),
          immutable: true
        };
        const r = await col.insertOne(doc);
        console.log('Inserted user with _id', r.insertedId.toString());
      }
    } else {
      console.log('Existing user found:');
      console.log('  username:', existing.username);
      console.log('  full_name:', existing.full_name);
      console.log('  role:', existing.role);
      console.log('  password appears to be:', isBcryptHash(existing.password) ? 'bcrypt' : 'sha256/legacy/unknown');

      // If password already bcrypt and matches ADMIN_PASS, nothing more to do
      if (isBcryptHash(existing.password)) {
        const ok = await bcrypt.compare(ADMIN_PASS, existing.password);
        if (ok) {
          console.log('Password already matches the desired ADMIN_PASS (bcrypt). No change needed.');
          await client.close();
          process.exit(0);
        }
      } else {
        // If legacy sha256, check if ADMIN_PASS matches legacy hash
        const legacyMatch = existing.password === hashSha256(ADMIN_PASS);
        if (legacyMatch) {
          console.log('Existing legacy SHA-256 password matches ADMIN_PASS. Will migrate to bcrypt.');
          if (!DRY_RUN) {
            const newHash = await bcrypt.hash(ADMIN_PASS, 10);
            await col.updateOne({ _id: existing._id }, { $set: { password: newHash, full_name: ADMIN_FULLNAME, role: ADMIN_ROLE, updated_at: new Date(), immutable: true } });
            console.log('Password migrated to bcrypt and user updated.');
            await client.close();
            process.exit(0);
          } else {
            console.log('[DRY RUN] Would migrate legacy hash to bcrypt and set full_name/role/immutable.');
            await client.close();
            process.exit(0);
          }
        }
      }

      // Otherwise, replace password with bcrypt of ADMIN_PASS and update metadata
      console.log('Replacing password with bcrypt hash of ADMIN_PASS and updating metadata.');
      if (!DRY_RUN) {
        const newHash = await bcrypt.hash(ADMIN_PASS, 10);
        await col.updateOne({ _id: existing._id }, { $set: { password: newHash, full_name: ADMIN_FULLNAME, role: ADMIN_ROLE, updated_at: new Date(), immutable: true } });
        console.log('User updated.');
      } else {
        console.log('[DRY RUN] Would set bcrypt password and update full_name/role/immutable.');
      }
    }

    await client.close();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
