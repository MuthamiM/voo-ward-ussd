// MongoDB CRUD Routes for Production
// Strict Security Implementation - NO RELAXED SETTINGS

const { getDb } = require('../lib/mongo');
const { ObjectId } = require('mongodb');
const crypto = require('../lib/crypto');
const security = require('../middleware/security');
const privacy = require('../lib/privacy');

// Security event logging
const logSecurityEvent = (eventType, details) => {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${eventType}:`, details);
};

// Input validation middleware
const validateInput = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      logSecurityEvent('VALIDATION_FAILED', {
        missingFields,
        ip: security.getClientIP(req),
        endpoint: req.path
      });
      return res.status(400).json({
        error: 'Missing required fields',
        fields: missingFields
      });
    }
    
    // Sanitize all inputs
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
    
    next();
  };
};

// Authentication middleware for API routes
const apiAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = { username: decoded.username, role: decoded.role || 'user' };
    next();
  } catch (error) {
    logSecurityEvent('API_AUTH_ERROR', {
      error: error.message,
      ip: security.getClientIP(req),
      endpoint: req.path
    });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin authentication
const adminAuth = async (req, res, next) => {
  await apiAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', {
        user: req.user.username,
        ip: security.getClientIP(req),
        endpoint: req.path
      });
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

// Error handler
const handleError = (res, error, operation) => {
  logSecurityEvent('MONGO_OPERATION_ERROR', {
    operation,
    error: error.message,
    timestamp: new Date().toISOString()
  });
  
  // Don't expose internal errors to client
  res.status(500).json({ 
    error: 'Database operation failed',
    operation 
  });
};

// =======================
// CONSTITUENTS ROUTES
// =======================

// Get all constituents (paginated)
const getConstituents = async (req, res) => {
  try {
    const db = await getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100 per page
    const skip = (page - 1) * limit;
    
    const constituents = await db.collection('constituents')
      .find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .toArray();
    
    const total = await db.collection('constituents').countDocuments();
    
    logSecurityEvent('CONSTITUENTS_ACCESSED', {
      user: req.user?.username,
      page,
      limit,
      total,
      ip: security.getClientIP(req)
    });
    
    res.json({
      constituents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleError(res, error, 'getConstituents');
  }
};

// Get single constituent
const getConstituent = async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const constituent = await db.collection('constituents')
      .findOne({ _id: new ObjectId(id) });
    
    if (!constituent) {
      return res.status(404).json({ error: 'Constituent not found' });
    }
    
    logSecurityEvent('CONSTITUENT_ACCESSED', {
      user: req.user?.username,
      constituentId: id,
      ip: security.getClientIP(req)
    });
    
    res.json(constituent);
  } catch (error) {
    handleError(res, error, 'getConstituent');
  }
};

// Create new constituent
const createConstituent = async (req, res) => {
  try {
    const db = await getDb();
    const { name, phoneNumber, nationalId, constituency, location } = req.body;
    
    // Check for existing constituent with same national ID
    const existing = await db.collection('constituents')
      .findOne({ nationalId: crypto.hashData(nationalId) });
    
    if (existing) {
      return res.status(409).json({ error: 'Constituent already exists' });
    }
    
    const constituent = {
      name: crypto.encryptPII(name),
      phoneNumber: crypto.encryptPII(phoneNumber),
      nationalId: crypto.hashData(nationalId), // Hashed for uniqueness check
      constituency,
      location,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user?.username || 'system'
    };
    
    const result = await db.collection('constituents').insertOne(constituent);
    
    logSecurityEvent('CONSTITUENT_CREATED', {
      user: req.user?.username,
      constituentId: result.insertedId,
      ip: security.getClientIP(req)
    });
    
    res.status(201).json({
      id: result.insertedId,
      message: 'Constituent created successfully'
    });
  } catch (error) {
    handleError(res, error, 'createConstituent');
  }
};

// Update constituent
const updateConstituent = async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const updates = { ...req.body };
    
    // Encrypt PII fields if they exist
    if (updates.name) updates.name = crypto.encryptPII(updates.name);
    if (updates.phoneNumber) updates.phoneNumber = crypto.encryptPII(updates.phoneNumber);
    if (updates.nationalId) updates.nationalId = crypto.hashData(updates.nationalId);
    
    updates.updatedAt = new Date();
    updates.updatedBy = req.user?.username || 'system';
    
    const result = await db.collection('constituents')
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Constituent not found' });
    }
    
    logSecurityEvent('CONSTITUENT_UPDATED', {
      user: req.user?.username,
      constituentId: id,
      ip: security.getClientIP(req)
    });
    
    res.json({ message: 'Constituent updated successfully' });
  } catch (error) {
    handleError(res, error, 'updateConstituent');
  }
};

// Delete constituent (soft delete for GDPR compliance)
const deleteConstituent = async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    // Soft delete - mark as deleted but keep for audit
    const result = await db.collection('constituents')
      .updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: {
            deleted: true,
            deletedAt: new Date(),
            deletedBy: req.user?.username || 'system'
          }
        }
      );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Constituent not found' });
    }
    
    logSecurityEvent('CONSTITUENT_DELETED', {
      user: req.user?.username,
      constituentId: id,
      ip: security.getClientIP(req)
    });
    
    res.json({ message: 'Constituent deleted successfully' });
  } catch (error) {
    handleError(res, error, 'deleteConstituent');
  }
};

// =======================
// ISSUES ROUTES
// =======================

// Get all issues (paginated)
const getIssues = async (req, res) => {
  try {
    const db = await getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status;
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    const issues = await db.collection('issues')
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .toArray();
    
    const total = await db.collection('issues').countDocuments(query);
    
    logSecurityEvent('ISSUES_ACCESSED', {
      user: req.user?.username,
      page,
      limit,
      total,
      filter: status,
      ip: security.getClientIP(req)
    });
    
    res.json({
      issues,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleError(res, error, 'getIssues');
  }
};

// Create new issue
const createIssue = async (req, res) => {
  try {
    const db = await getDb();
    const { title, description, category, priority, location, reporterPhone } = req.body;
    
    const issue = {
      title,
      description: crypto.encryptPII(description), // Encrypt sensitive content
      category,
      priority: priority || 'medium',
      location,
      reporterPhone: crypto.encryptPII(reporterPhone),
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user?.username || 'anonymous'
    };
    
    const result = await db.collection('issues').insertOne(issue);
    
    logSecurityEvent('ISSUE_CREATED', {
      user: req.user?.username,
      issueId: result.insertedId,
      category,
      priority,
      ip: security.getClientIP(req)
    });
    
    res.status(201).json({
      id: result.insertedId,
      message: 'Issue reported successfully'
    });
  } catch (error) {
    handleError(res, error, 'createIssue');
  }
};

// Update issue status (admin only)
const updateIssue = async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { status, response, priority } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const updates = {
      updatedAt: new Date(),
      updatedBy: req.user?.username
    };
    
    if (status) updates.status = status;
    if (response) updates.response = response;
    if (priority) updates.priority = priority;
    
    const result = await db.collection('issues')
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    
    logSecurityEvent('ISSUE_UPDATED', {
      user: req.user?.username,
      issueId: id,
      changes: Object.keys(updates),
      ip: security.getClientIP(req)
    });
    
    res.json({ message: 'Issue updated successfully' });
  } catch (error) {
    handleError(res, error, 'updateIssue');
  }
};

// =======================
// ANNOUNCEMENTS ROUTES
// =======================

// Get all announcements (public)
const getAnnouncements = async (req, res) => {
  try {
    const db = await getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;
    
    const announcements = await db.collection('announcements')
      .find({ published: true })
      .skip(skip)
      .limit(limit)
      .sort({ publishedAt: -1 })
      .toArray();
    
    const total = await db.collection('announcements')
      .countDocuments({ published: true });
    
    res.json({
      announcements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleError(res, error, 'getAnnouncements');
  }
};

// Create announcement (admin only)
const createAnnouncement = async (req, res) => {
  try {
    const db = await getDb();
    const { title, content, category, urgent } = req.body;
    
    const announcement = {
      title,
      content,
      category: category || 'general',
      urgent: urgent || false,
      published: true,
      publishedAt: new Date(),
      createdAt: new Date(),
      createdBy: req.user?.username
    };
    
    const result = await db.collection('announcements').insertOne(announcement);
    
    logSecurityEvent('ANNOUNCEMENT_CREATED', {
      user: req.user?.username,
      announcementId: result.insertedId,
      category,
      urgent,
      ip: security.getClientIP(req)
    });
    
    res.status(201).json({
      id: result.insertedId,
      message: 'Announcement created successfully'
    });
  } catch (error) {
    handleError(res, error, 'createAnnouncement');
  }
};

// =======================
// PROJECTS ROUTES
// =======================

// Get all projects (public)
const getProjects = async (req, res) => {
  try {
    const db = await getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;
    
    const projects = await db.collection('projects')
      .find({ status: { $ne: 'draft' } })
      .skip(skip)
      .limit(limit)
      .sort({ startDate: -1 })
      .toArray();
    
    const total = await db.collection('projects')
      .countDocuments({ status: { $ne: 'draft' } });
    
    res.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleError(res, error, 'getProjects');
  }
};

// Create project (admin only)
const createProject = async (req, res) => {
  try {
    const db = await getDb();
    const { name, description, location, budget, startDate, endDate } = req.body;
    
    const project = {
      name,
      description,
      location,
      budget: parseFloat(budget) || 0,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: 'planning',
      progress: 0,
      createdAt: new Date(),
      createdBy: req.user?.username
    };
    
    const result = await db.collection('projects').insertOne(project);
    
    logSecurityEvent('PROJECT_CREATED', {
      user: req.user?.username,
      projectId: result.insertedId,
      budget,
      ip: security.getClientIP(req)
    });
    
    res.status(201).json({
      id: result.insertedId,
      message: 'Project created successfully'
    });
  } catch (error) {
    handleError(res, error, 'createProject');
  }
};

// Update project (admin only)
const updateProject = async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const updates = { ...req.body };
    updates.updatedAt = new Date();
    updates.updatedBy = req.user?.username;
    
    // Parse dates if provided
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);
    if (updates.budget) updates.budget = parseFloat(updates.budget);
    
    const result = await db.collection('projects')
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    logSecurityEvent('PROJECT_UPDATED', {
      user: req.user?.username,
      projectId: id,
      ip: security.getClientIP(req)
    });
    
    res.json({ message: 'Project updated successfully' });
  } catch (error) {
    handleError(res, error, 'updateProject');
  }
};

module.exports = {
  // Constituents
  getConstituents,
  getConstituent,
  createConstituent: [
    validateInput(['name', 'phoneNumber', 'nationalId', 'constituency']),
    createConstituent
  ],
  updateConstituent: [apiAuth, updateConstituent],
  deleteConstituent: [adminAuth, deleteConstituent],
  
  // Issues
  getIssues,
  createIssue: [
    validateInput(['title', 'description', 'category', 'reporterPhone']),
    createIssue
  ],
  updateIssue: [adminAuth, updateIssue],
  
  // Announcements
  getAnnouncements,
  createAnnouncement: [
    adminAuth,
    validateInput(['title', 'content']),
    createAnnouncement
  ],
  
  // Projects
  getProjects,
  createProject: [
    adminAuth,
    validateInput(['name', 'description', 'location', 'startDate']),
    createProject
  ],
  updateProject: [adminAuth, updateProject]
};