const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';

let pool = null;

function getPool() {
    if (!pool && DATABASE_URL) {
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
        pool.on('error', (err) => console.error('PostgreSQL error:', err));
    }
    return pool;
}

async function query(text, params) {
    const p = getPool();
    if (!p) throw new Error('Database not configured');
    const result = await p.query(text, params);
    return result.rows;
}

async function queryOne(text, params) {
    const rows = await query(text, params);
    return rows[0] || null;
}

async function getStats() {
    try {
        const [issuesResult, usersResult, feedbackResult, issuesTrend] = await Promise.all([
            queryOne('SELECT COUNT(*) as count FROM issues'),
            queryOne('SELECT COUNT(*) as count FROM app_users'),
            queryOne('SELECT COUNT(*) as count FROM app_feedback'),
            query(`SELECT DATE(created_at) as date, COUNT(*) as count 
                   FROM issues 
                   WHERE created_at >= NOW() - INTERVAL '7 days'
                   GROUP BY DATE(created_at) 
                   ORDER BY date`)
        ]);

        const labels = [];
        const data = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));

            const found = issuesTrend.find(t => t.date && t.date.toISOString().split('T')[0] === dateStr);
            data.push(found ? parseInt(found.count) : 0);
        }

        return {
            counts: {
                issues: parseInt(issuesResult?.count || 0),
                users: parseInt(usersResult?.count || 0),
                feedback: parseInt(feedbackResult?.count || 0)
            },
            trends: { labels, data }
        };
    } catch (e) {
        console.error('[PostgreSQL] getStats error:', e.message);
        return { counts: { issues: 0, users: 0, feedback: 0 }, trends: { labels: [], data: [] } };
    }
}

async function getIssues(options = {}) {
    try {
        const { status, limit = 50, offset = 0 } = options;
        let sql = 'SELECT * FROM issues';
        const params = [];
        
        if (status) {
            sql += ' WHERE status = $1';
            params.push(status);
        }
        
        sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);
        
        return await query(sql, params);
    } catch (e) {
        console.error('[PostgreSQL] getIssues error:', e.message);
        return [];
    }
}

async function getIssueById(id) {
    return await queryOne('SELECT * FROM issues WHERE id = $1', [id]);
}

async function updateIssue(id, updates) {
    try {
        const fields = [];
        const values = [];
        let idx = 1;
        
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = $${idx}`);
            values.push(value);
            idx++;
        }
        
        values.push(id);
        const sql = `UPDATE issues SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
        const result = await query(sql, values);
        return result[0];
    } catch (e) {
        console.error('[PostgreSQL] updateIssue error:', e.message);
        return null;
    }
}

async function getBursaries(options = {}) {
    try {
        const { status, limit = 50, offset = 0 } = options;
        let sql = 'SELECT * FROM bursary_applications';
        const params = [];
        
        if (status) {
            sql += ' WHERE status = $1';
            params.push(status);
        }
        
        sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);
        
        return await query(sql, params);
    } catch (e) {
        console.error('[PostgreSQL] getBursaries error:', e.message);
        return [];
    }
}

async function getAnnouncements() {
    try {
        return await query('SELECT * FROM announcements WHERE is_active = true ORDER BY created_at DESC');
    } catch (e) {
        console.error('[PostgreSQL] getAnnouncements error:', e.message);
        return [];
    }
}

async function createAnnouncement(data) {
    try {
        const result = await query(
            `INSERT INTO announcements (title, content, priority, is_active, created_at)
             VALUES ($1, $2, $3, true, NOW()) RETURNING *`,
            [data.title, data.content, data.priority || 'normal']
        );
        return result[0];
    } catch (e) {
        console.error('[PostgreSQL] createAnnouncement error:', e.message);
        return null;
    }
}

async function getUsers(options = {}) {
    try {
        const { limit = 50, offset = 0 } = options;
        return await query(
            'SELECT id, full_name, username, phone, email, village, role, created_at FROM app_users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
    } catch (e) {
        console.error('[PostgreSQL] getUsers error:', e.message);
        return [];
    }
}

async function getFeedback(options = {}) {
    try {
        const { limit = 50, offset = 0 } = options;
        return await query(
            'SELECT * FROM app_feedback ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
    } catch (e) {
        console.error('[PostgreSQL] getFeedback error:', e.message);
        return [];
    }
}

async function getLostIds(options = {}) {
    try {
        const { limit = 50, offset = 0 } = options;
        return await query(
            'SELECT * FROM lost_ids ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
    } catch (e) {
        console.error('[PostgreSQL] getLostIds error:', e.message);
        return [];
    }
}

module.exports = {
    getPool,
    query,
    queryOne,
    getStats,
    getIssues,
    getIssueById,
    updateIssue,
    getBursaries,
    getAnnouncements,
    createAnnouncement,
    getUsers,
    getFeedback,
    getLostIds
};
