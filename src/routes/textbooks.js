// TEXTBOOK DISTRIBUTION SYSTEM - BACKEND IMPLEMENTATION
// Add this to backend/src/routes/admin.js

// ============================================
// TEXTBOOK MANAGEMENT ENDPOINTS
// ============================================

// GET all textbook requests
async function handleGetTextbookRequests(req, reply) {
  try {
    await req.jwtVerify();
    
    if (process.env.NODE_ENV === 'development') {
      // Mock data for development
      return reply.send([
        {
          id: 1,
          student_name: 'Jane Wanjiru',
          student_id: 'VOO2025001',
          phone_number: '0712345678',
          school_name: 'Kyamatu Primary',
          class_level: 'Grade 8',
          subject: 'Mathematics',
          book_title: 'Math Grade 8',
          quantity_requested: 1,
          reason: 'Inadequate supply',
          status: 'pending',
          request_date: new Date(),
          tracking_number: 'TBK001234'
        }
      ]);
    }
    
    const db = getCloudDb();
    const result = await db.query(`
      SELECT tr.*, s.name as school_name
      FROM textbook_requests tr
      JOIN schools s ON tr.school_id = s.id
      ORDER BY tr.request_date DESC
    `);
    
    return reply.send(result.rows);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Failed to fetch textbook requests' });
  }
}

// CREATE textbook request (via USSD or admin)
async function handleCreateTextbookRequest(req, reply) {
  try {
    const {
      student_name,
      student_id,
      phone_number,
      school_id,
      class_level,
      subject,
      book_title,
      quantity_requested,
      reason
    } = req.body;
    
    // Validate required fields
    if (!student_name || !phone_number || !school_id || !subject || !book_title) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }
    
    if (process.env.NODE_ENV === 'development') {
      // Mock response for development
      const mockRequest = {
        id: Math.floor(Math.random() * 10000),
        student_name,
        student_id,
        phone_number,
        school_id,
        class_level,
        subject,
        book_title,
        quantity_requested: quantity_requested || 1,
        reason,
        status: 'pending',
        request_date: new Date(),
        tracking_number: 'TBK' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
      };
      return reply.send(mockRequest);
    }
    
    const db = getCloudDb();
    const tracking_number = 'TBK' + String(Date.now()).slice(-6);
    
    const result = await db.query(`
      INSERT INTO textbook_requests (
        student_name, student_id, phone_number, school_id, 
        class_level, subject, book_title, quantity_requested, 
        reason, tracking_number
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      student_name, student_id, phone_number, school_id,
      class_level, subject, book_title, quantity_requested || 1,
      reason, tracking_number
    ]);
    
    return reply.send(result.rows[0]);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Failed to create textbook request' });
  }
}

// UPDATE textbook request status
async function handleUpdateTextbookStatus(req, reply) {
  try {
    await req.jwtVerify();
    
    const { id } = req.params;
    const { status, dispatch_date, delivery_date, notes } = req.body;
    
    if (!status) {
      return reply.code(400).send({ error: 'Status is required' });
    }
    
    if (process.env.NODE_ENV === 'development') {
      // Mock response for development
      return reply.send({
        id: parseInt(id),
        status,
        dispatch_date,
        delivery_date,
        updated_at: new Date()
      });
    }
    
    const db = getCloudDb();
    
    let query = `
      UPDATE textbook_requests
      SET status = $1, dispatch_date = $2, delivery_date = $3
      WHERE id = $4
      RETURNING *
    `;
    
    const result = await db.query(query, [status, dispatch_date, delivery_date, id]);
    
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Request not found' });
    }
    
    return reply.send(result.rows[0]);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Failed to update textbook status' });
  }
}

// GET textbook inventory
async function handleGetTextbookInventory(req, reply) {
  try {
    await req.jwtVerify();
    
    if (process.env.NODE_ENV === 'development') {
      // Mock inventory data
      return reply.send([
        {
          id: 1,
          book_title: 'Math Grade 8',
          subject: 'Mathematics',
          class_level: 'Grade 8',
          publisher: 'Longhorn Publishers',
          total_quantity: 500,
          available_quantity: 234,
          reserved_quantity: 156,
          damaged_quantity: 110
        },
        {
          id: 2,
          book_title: 'English Grade 7',
          subject: 'English',
          class_level: 'Grade 7',
          publisher: 'Oxford University Press',
          total_quantity: 600,
          available_quantity: 456,
          reserved_quantity: 89,
          damaged_quantity: 55
        }
      ]);
    }
    
    const db = getCloudDb();
    const result = await db.query(`
      SELECT * FROM textbook_inventory
      ORDER BY subject, class_level
    `);
    
    return reply.send(result.rows);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Failed to fetch inventory' });
  }
}

// CREATE book shortage report
async function handleCreateShortageReport(req, reply) {
  try {
    const {
      school_id,
      reporter_name,
      reporter_phone,
      class_level,
      subject,
      students_affected,
      books_needed,
      books_available,
      description
    } = req.body;
    
    if (!school_id || !class_level || !subject || !students_affected) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }
    
    if (process.env.NODE_ENV === 'development') {
      // Mock response
      return reply.send({
        id: Math.floor(Math.random() * 10000),
        school_id,
        reporter_name,
        reporter_phone,
        class_level,
        subject,
        students_affected,
        books_needed,
        books_available,
        description,
        status: 'pending',
        reported_at: new Date(),
        reference_number: 'SHT' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
      });
    }
    
    const db = getCloudDb();
    
    const result = await db.query(`
      INSERT INTO book_shortage_reports (
        school_id, reporter_name, reporter_phone, class_level,
        subject, students_affected, books_needed, books_available,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      school_id, reporter_name, reporter_phone, class_level,
      subject, students_affected, books_needed, books_available,
      description
    ]);
    
    return reply.send(result.rows[0]);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Failed to create shortage report' });
  }
}

// GET shortage reports
async function handleGetShortageReports(req, reply) {
  try {
    await req.jwtVerify();
    
    if (process.env.NODE_ENV === 'development') {
      // Mock data
      return reply.send([
        {
          id: 1,
          school_name: 'Kyamatu Primary',
          reporter_name: 'Principal John Doe',
          reporter_phone: '0722334455',
          class_level: 'Grade 8',
          subject: 'Mathematics',
          students_affected: 156,
          books_needed: 156,
          books_available: 0,
          description: 'Completely out of Math Grade 8 textbooks',
          status: 'pending',
          reported_at: new Date()
        }
      ]);
    }
    
    const db = getCloudDb();
    const result = await db.query(`
      SELECT bsr.*, s.name as school_name
      FROM book_shortage_reports bsr
      JOIN schools s ON bsr.school_id = s.id
      WHERE bsr.status != 'resolved'
      ORDER BY bsr.reported_at DESC
    `);
    
    return reply.send(result.rows);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Failed to fetch shortage reports' });
  }
}

// ============================================
// USSD TEXTBOOK HANDLERS
// ============================================

// Handle textbook request via USSD
function handleTextbookRequestUSSD(sessionId, serviceCode, phoneNumber, text) {
  let response = '';
  const textParts = text.split('*');
  
  // User selected "Request textbooks" (option 3)
  if (text === '9*3') {
    response = 'CON Enter your full name:';
  }
  // User entered name
  else if (text.startsWith('9*3*') && textParts.length === 3) {
    response = 'CON Enter student ID (or 0 if none):';
  }
  // User entered student ID
  else if (text.startsWith('9*3*') && textParts.length === 4) {
    response = `CON Select subject:
1. Mathematics
2. English
3. Kiswahili
4. Science
5. Social Studies`;
  }
  // User selected subject
  else if (text.startsWith('9*3*') && textParts.length === 5) {
    const subject = textParts[4];
    response = `CON Select class level:
1. Grade 7
2. Grade 8
3. Grade 9
4. Form 1
5. Form 2`;
  }
  // User selected class level
  else if (text.startsWith('9*3*') && textParts.length === 6) {
    response = `CON Reason for request:
1. Never received
2. Lost/damaged
3. Inadequate supply
4. Other`;
  }
  // Final submission
  else if (text.startsWith('9*3*') && textParts.length === 7) {
    const studentName = textParts[2];
    const studentId = textParts[3];
    const trackingNumber = 'TBK' + String(Date.now()).slice(-6);
    
    // In production, save to database here
    
    response = `END Request received!
Ref: ${trackingNumber}

You'll receive your textbook within 7 days.
SMS notification when ready.`;
  }
  
  return response;
}

// Check textbook delivery status via USSD
function handleTextbookStatusUSSD(sessionId, serviceCode, phoneNumber, text) {
  let response = '';
  
  // User selected "Check textbook delivery" (option 4)
  if (text === '9*4') {
    response = 'CON Enter tracking number (e.g., TBK001234):';
  }
  // User entered tracking number
  else if (text.startsWith('9*4*')) {
    const trackingNumber = text.split('*')[2];
    
    // In production, query database
    // Mock response:
    response = `END Tracking: ${trackingNumber}

Status: Dispatched
Book: Math Grade 8
Dispatch: Nov 1, 2025
Expected: Nov 5, 2025

Collect from Ward Office
Mon-Fri 8am-5pm`;
  }
  
  return response;
}

// Export all handlers
module.exports = {
  handleGetTextbookRequests,
  handleCreateTextbookRequest,
  handleUpdateTextbookStatus,
  handleGetTextbookInventory,
  handleCreateShortageReport,
  handleGetShortageReports,
  handleTextbookRequestUSSD,
  handleTextbookStatusUSSD
};
