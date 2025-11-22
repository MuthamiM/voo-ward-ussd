#!/usr/bin/env node
/**
 * Database Backup Script
 * Exports MongoDB data to JSON files
 * Usage: node scripts/backup-db.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups');
const MONGO_URI = process.env.MONGO_URI;

// Collections to backup
const COLLECTIONS = [
    'constituents',
    'issues',
    'bursaries',
    'announcements',
    'admin_users',
    'citizen_messages'
];

async function backupDatabase() {
    if (!MONGO_URI) {
        console.error('❌ MONGO_URI not set in environment variables');
        process.exit(1);
    }

    console.log('🔄 Starting database backup...');

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);
    fs.mkdirSync(backupPath);

    let client;

    try {
        // Connect to MongoDB
        client = new MongoClient(MONGO_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();

        // Backup each collection
        for (const collectionName of COLLECTIONS) {
            try {
                const collection = db.collection(collectionName);
                const count = await collection.countDocuments();

                if (count === 0) {
                    console.log(`⏭️  Skipping empty collection: ${collectionName}`);
                    continue;
                }

                const documents = await collection.find({}).toArray();
                const filePath = path.join(backupPath, `${collectionName}.json`);

                fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
                console.log(`✅ Backed up ${collectionName}: ${count} documents`);
            } catch (err) {
                console.warn(`⚠️  Could not backup ${collectionName}:`, err.message);
            }
        }

        // Create metadata file
        const metadata = {
            timestamp: new Date().toISOString(),
            mongoUri: MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials
            collections: COLLECTIONS,
            backupPath: backupPath
        };

        fs.writeFileSync(
            path.join(backupPath, 'metadata.json'),
            JSON.stringify(metadata, null, 2)
        );

        console.log(`\n✅ Backup completed successfully!`);
        console.log(`📁 Backup location: ${backupPath}`);

        // Clean up old backups (keep last 7 days)
        cleanOldBackups();

    } catch (err) {
        console.error('❌ Backup failed:', err);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

function cleanOldBackups() {
    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(name => name.startsWith('backup-'))
        .map(name => ({
            name,
            path: path.join(BACKUP_DIR, name),
            time: fs.statSync(path.join(BACKUP_DIR, name)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    // Keep last 7 backups
    const toDelete = backups.slice(7);

    for (const backup of toDelete) {
        try {
            fs.rmSync(backup.path, { recursive: true, force: true });
            console.log(`🗑️  Deleted old backup: ${backup.name}`);
        } catch (err) {
            console.warn(`⚠️  Could not delete ${backup.name}:`, err.message);
        }
    }
}

// Run backup
backupDatabase().catch(console.error);
