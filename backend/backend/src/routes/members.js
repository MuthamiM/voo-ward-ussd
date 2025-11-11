const logger = require('../lib/logger');
const { getCloudDb } = require('../lib/db');

// Dev mode sample data (matches current 2 registered constituents)
const devMembers = [
  {
    id: 1,
    phone: '+254712345678',
    national_id: '12345678',
    first_name: 'John',
    middle_name: 'K',
    last_name: 'Doe',
    full_name: 'John K Doe',
    area: 'Kyamatu',
    village: 'Ndili',
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    created_at: new Date('2025-11-01').toISOString(),
    updated_at: new Date('2025-11-01').toISOString()
  },
  {
    id: 2,
    phone: '+254723456789',
    national_id: '23456789',
    first_name: 'Jane',
    middle_name: 'W',
    last_name: 'Smith',
    full_name: 'Jane W Smith',
    area: 'Kyamatu',
    village: 'Katulani',
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    created_at: new Date('2025-11-02').toISOString(),
    updated_at: new Date('2025-11-02').toISOString()
  }
];

// Get all members with full details (admin only)
async function handleGetMembers(req, reply) {
  // Only super_admin (ZAK) can view all member details
  if (req.user.role !== 'super_admin') {
    return reply.status(403).send({ 
      error: 'Access denied. Only ZAK (MCA) can view constituent details.',
      reason: 'Data privacy - constituents consented to MCA access only'
    });
  }

  // Dev mode: return sample data
  if (process.env.NODE_ENV === 'development') {
    logger.info(`Member details accessed by ${req.user.name} (${req.user.role})`);
    return reply.send({
      total: devMembers.length,
      members: devMembers,
      privacy_note: 'These details are confidential. Members consented to MCA access only.'
    });
  }

  // Production mode: query database
  const db = getCloudDb();
  try {
    const query = `
      SELECT 
        m.id,
        m.phone,
        m.national_id,
        m.first_name,
        m.middle_name,
        m.last_name,
        m.full_name,
        COALESCE(a.name, m.area) as area,
        m.village,
        m.terms_accepted,
        m.terms_accepted_at,
        m.created_at,
        m.updated_at
      FROM members m
      LEFT JOIN areas a ON m.area_id = a.id
      ORDER BY m.created_at DESC
    `;
    
    const res = await db.query(query);
    
    logger.info(`Member details accessed by ${req.user.name} (${req.user.role}) - ${res.rows.length} records`);
    
    return reply.send({
      total: res.rows.length,
      members: res.rows,
      privacy_note: 'These details are confidential. Members consented to MCA access only.'
    });
  } catch(err) {
    logger.error('Get members error:', err);
    return reply.status(500).send({ error: 'Failed to fetch member details' });
  }
}

// Get single member details by ID (admin only)
async function handleGetMemberById(req, reply) {
  const { id } = req.params;

  // Only super_admin (ZAK) can view member details
  if (req.user.role !== 'super_admin') {
    return reply.status(403).send({ 
      error: 'Access denied. Only ZAK (MCA) can view constituent details.'
    });
  }

  // Dev mode
  if (process.env.NODE_ENV === 'development') {
    const member = devMembers.find(m => m.id === parseInt(id));
    if (!member) {
      return reply.status(404).send({ error: 'Member not found' });
    }
    
    logger.info(`Member #${id} details viewed by ${req.user.name}`);
    return reply.send({
      member,
      privacy_note: 'This data is confidential. Member consented to MCA access only.'
    });
  }

  // Production mode
  const db = getCloudDb();
  try {
    const query = `
      SELECT 
        m.id,
        m.phone,
        m.national_id,
        m.first_name,
        m.middle_name,
        m.last_name,
        m.full_name,
        COALESCE(a.name, m.area) as area,
        m.village,
        m.terms_accepted,
        m.terms_accepted_at,
        m.created_at,
        m.updated_at
      FROM members m
      LEFT JOIN areas a ON m.area_id = a.id
      WHERE m.id = $1
    `;
    
    const res = await db.query(query, [id]);
    
    if (res.rows.length === 0) {
      return reply.status(404).send({ error: 'Member not found' });
    }
    
    logger.info(`Member #${id} details viewed by ${req.user.name}`);
    
    return reply.send({
      member: res.rows[0],
      privacy_note: 'This data is confidential. Member consented to MCA access only.'
    });
  } catch(err) {
    logger.error(`Get member #${id} error:`, err);
    return reply.status(500).send({ error: 'Failed to fetch member details' });
  }
}

// Export all members with full details (CSV format)
async function handleExportMembers(req, reply) {
  // Only super_admin (ZAK) can export
  if (req.user.role !== 'super_admin') {
    return reply.status(403).send({ 
      error: 'Access denied. Only ZAK (MCA) can export constituent data.'
    });
  }

  // Dev mode
  if (process.env.NODE_ENV === 'development') {
    let csv = 'ID,Phone,National ID,First Name,Middle Name,Last Name,Area,Village,Terms Accepted,Registration Date\n';
    devMembers.forEach(m => {
      csv += `${m.id},"${m.phone}","${m.national_id}","${m.first_name}","${m.middle_name}","${m.last_name}","${m.area}","${m.village}",${m.terms_accepted ? 'Yes' : 'No'},"${m.created_at}"\n`;
    });
    
    logger.info(`Member data exported by ${req.user.name} - ${devMembers.length} records`);
    
    return reply
      .type('text/csv')
      .header('Content-Disposition', `attachment; filename="members_${new Date().toISOString().split('T')[0]}.csv"`)
      .send(csv);
  }

  // Production mode
  const db = getCloudDb();
  try {
    const query = `
      SELECT 
        m.id,
        m.phone,
        m.national_id,
        m.first_name,
        m.middle_name,
        m.last_name,
        COALESCE(a.name, m.area) as area,
        m.village,
        m.terms_accepted,
        m.created_at
      FROM members m
      LEFT JOIN areas a ON m.area_id = a.id
      ORDER BY m.created_at DESC
    `;
    
    const res = await db.query(query);
    
    let csv = 'ID,Phone,National ID,First Name,Middle Name,Last Name,Area,Village,Terms Accepted,Registration Date\n';
    res.rows.forEach(m => {
      csv += `${m.id},"${m.phone}","${m.national_id}","${m.first_name || ''}","${m.middle_name || ''}","${m.last_name || ''}","${m.area}","${m.village || ''}",${m.terms_accepted ? 'Yes' : 'No'},"${m.created_at}"\n`;
    });
    
    logger.info(`Member data exported by ${req.user.name} - ${res.rows.length} records`);
    
    return reply
      .type('text/csv')
      .header('Content-Disposition', `attachment; filename="members_${new Date().toISOString().split('T')[0]}.csv"`)
      .send(csv);
  } catch(err) {
    logger.error('Export members error:', err);
    return reply.status(500).send({ error: 'Failed to export member data' });
  }
}

module.exports = { 
  handleGetMembers, 
  handleGetMemberById,
  handleExportMembers
};
