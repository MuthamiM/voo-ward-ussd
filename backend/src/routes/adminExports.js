// Admin Export Endpoints - CSV and JSON exports with X-ADMIN-KEY authentication
const logger = require('../lib/logger');
const { getCloudDb } = require('../lib/db');
const { requireAdminKey } = require('../middleware/adminKey');
const { listMembersWithArea } = require('../db/members');

async function setupAdminExports(app) {
  // GET /admin/exports/members.csv - Export members as CSV with filters
  app.get('/admin/exports/members.csv', async (req, reply) => {
    try {
      // Check auth inline
      const providedKey = req.headers['x-admin-key'];
      const validKey = process.env.ADMIN_EXPORT_KEY || 'kyamatu-admin-2024';
      
      if (!providedKey || providedKey !== validKey) {
        logger.warn({ ip: req.ip }, 'Unauthorized CSV export attempt');
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      
      // Extract query filters
      const { q, from, to, area_id } = req.query;
      
      // Get filtered members
      const members = await listMembersWithArea({
        q,
        from,
        to,
        area_id,
        limit: 10000 // Max export size
      });
      
      // Generate CSV
      const headers = ['Phone', 'National ID', 'First Name', 'Middle Name', 'Last Name', 'Full Name', 'Area', 'Village', 'Registered At'];
      const csvLines = [headers.join(',')];
      
      members.forEach(row => {
        const line = [
          row.phone_number,
          row.national_id || '',
          row.first_name || '',
          row.middle_name || '',
          row.last_name || '',
          row.full_name || '',
          row.area_name || row.area || '',
          row.village || '',
          row.created_at ? new Date(row.created_at).toISOString() : ''
        ].map(field => {
          // Escape fields containing commas or quotes
          const str = String(field);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',');
        csvLines.push(line);
      });
      
      const csv = csvLines.join('\n');
      
      logger.info({ 
        ip: req.ip, 
        count: members.length,
        filters: { q, from, to, area_id },
        action: 'EXPORT_CSV'
      }, 'Members exported to CSV');
      
      return reply
        .type('text/csv')
        .header('Content-Disposition', `attachment; filename="kyamatu-members-${Date.now()}.csv"`)
        .send(csv);
        
    } catch (err) {
      logger.error({ err, ip: req.ip }, 'CSV export error');
      return reply.code(500).send({ error: 'Export failed' });
    }
  });
  
  // GET /admin/exports/members.json - Export members as JSON with filters
  app.get('/admin/exports/members.json', async (req, reply) => {
    try {
      // Check auth inline
      const providedKey = req.headers['x-admin-key'];
      const validKey = process.env.ADMIN_EXPORT_KEY || 'kyamatu-admin-2024';
      
      if (!providedKey || providedKey !== validKey) {
        logger.warn({ ip: req.ip }, 'Unauthorized JSON export attempt');
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      
      // Extract query filters
      const { q, from, to, area_id } = req.query;
      
      // Get filtered members
      const members = await listMembersWithArea({
        q,
        from,
        to,
        area_id,
        limit: 10000 // Max export size
      });
      
      logger.info({ 
        ip: req.ip, 
        count: members.length,
        filters: { q, from, to, area_id },
        action: 'EXPORT_JSON'
      }, 'Members exported to JSON');
      
      return reply.send({
        success: true,
        count: members.length,
        exported_at: new Date().toISOString(),
        filters: { q, from, to, area_id },
        data: members
      });
        
    } catch (err) {
      logger.error({ err, ip: req.ip }, 'JSON export error');
      return reply.code(500).send({ error: 'Export failed' });
    }
  });
  
  logger.info('✅ Admin export endpoints mounted at /admin/exports/*');
}

module.exports = { setupAdminExports };
