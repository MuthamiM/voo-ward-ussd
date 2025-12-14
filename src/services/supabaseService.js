/**
 * Supabase Service for USSD Dashboard
 * Connects dashboard to Supabase app_users table (shared with mobile app)
 * Uses SERVICE_ROLE key to bypass RLS for admin dashboard access
 */

const https = require('https');
const crypto = require('crypto');

// Supabase credentials - use service_role for dashboard (bypasses RLS)
const SUPABASE_URL = 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aG1keHR6cHV4eWN2c2F0am9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTYwNzAsImV4cCI6MjA4MDczMjA3MH0.2tZ7eu6DtBg2mSOitpRa4RNvgCGg3nvMWeDmn9fPJY0';
// Service role key bypasses RLS - set via env var SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

class SupabaseService {
    constructor() {
        this.baseUrl = SUPABASE_URL;
        // Use service_role key for admin dashboard access (bypasses RLS)
        this.apiKey = SUPABASE_SERVICE_KEY;
    }

    /**
     * Make a REST API request to Supabase
     */
    async request(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.baseUrl}${path}`);

            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'apikey': this.apiKey,
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation',
                },
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        const result = body ? JSON.parse(body) : {};
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(result);
                        } else {
                            reject({ status: res.statusCode, error: result });
                        }
                    } catch (e) {
                        resolve(body);
                    }
                });
            });

            req.on('error', reject);

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    // ============ PASSWORD HASHING (matches mobile app) ============

    /**
     * Generate random salt
     */
    generateSalt() {
        return crypto.randomBytes(16).toString('base64');
    }

    /**
     * Hash password with SHA-256 and salt (matches mobile app format)
     */
    hashPassword(password, salt = null) {
        if (!salt) salt = this.generateSalt();
        const saltedPassword = `${salt}:${password}`;
        const hash = crypto.createHash('sha256').update(saltedPassword).digest('hex');
        return `${salt}:${hash}`;
    }

    /**
     * Verify password against stored hash
     */
    verifyPassword(password, storedHash) {
        if (!storedHash || !storedHash.includes(':')) {
            // Legacy hash format - simple comparison
            return this._legacyHash(password) === storedHash;
        }
        const [salt] = storedHash.split(':');
        const expectedHash = this.hashPassword(password, salt);
        return expectedHash === storedHash;
    }

    /**
     * Legacy hash for backwards compatibility
     */
    _legacyHash(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            hash = ((hash << 5) - hash) + password.charCodeAt(i);
            hash = hash & 0xFFFFFFFF;
        }
        return (hash >>> 0).toString(16).padStart(16, '0');
    }

    // ============ USER OPERATIONS ============

    /**
     * Get all mobile app users
     */
    async getAllUsers() {
        try {
            const result = await this.request('GET', '/rest/v1/app_users?select=*&order=created_at.desc');
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.error('[Supabase] getAllUsers error:', e);
            return [];
        }
    }

    /**
     * Get user by phone
     */
    async getUserByPhone(phone) {
        try {
            // Format phone
            let formattedPhone = phone;
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = `+254${formattedPhone.replace(/^0/, '')}`;
            }

            const result = await this.request('GET', `/rest/v1/app_users?phone=eq.${encodeURIComponent(formattedPhone)}&select=*`);
            return Array.isArray(result) && result.length > 0 ? result[0] : null;
        } catch (e) {
            console.error('[Supabase] getUserByPhone error:', e);
            return null;
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(userId) {
        try {
            const result = await this.request('GET', `/rest/v1/app_users?id=eq.${userId}&select=*`);
            return Array.isArray(result) && result.length > 0 ? result[0] : null;
        } catch (e) {
            console.error('[Supabase] getUserById error:', e);
            return null;
        }
    }

    /**
     * Get user by username or phone
     */
    async getUserByUsernameOrPhone(username) {
        try {
            let formattedPhone = username;
            if (!username.startsWith('+') && !isNaN(username.replace(/^0/, ''))) {
                formattedPhone = `+254${username.replace(/^0/, '')}`;
            }

            const query = encodeURIComponent(`(phone.eq.${formattedPhone},username.eq.${username})`);
            const result = await this.request('GET', `/rest/v1/app_users?or=${query}&select=*`);
            return Array.isArray(result) && result.length > 0 ? result[0] : null;
        } catch (e) {
            console.error('[Supabase] getUserByUsernameOrPhone error:', e);
            return null;
        }
    }

    /**
     * Login user
     */
    async loginUser(username, password) {
        try {
            const user = await this.getUserByUsernameOrPhone(username);

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            if (!this.verifyPassword(password, user.password_hash)) {
                return { success: false, error: 'Invalid password' };
            }

            return {
                success: true,
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    phone: user.phone,
                    username: user.username,
                    village: user.village,
                    email: user.email,
                }
            };
        } catch (e) {
            console.error('[Supabase] loginUser error:', e);
            return { success: false, error: 'Login failed' };
        }
    }

    /**
     * Register new user
     */
    async registerUser({ fullName, phone, idNumber, password, village, username }) {
        try {
            // Format phone
            let formattedPhone = phone;
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = `+254${formattedPhone.replace(/^0/, '')}`;
            }

            // Check if exists
            const existing = await this.getUserByPhone(formattedPhone);
            if (existing) {
                return { success: false, error: 'Phone number already registered' };
            }

            // Hash password
            const passwordHash = this.hashPassword(password);

            // Insert user
            const result = await this.request('POST', '/rest/v1/app_users', {
                full_name: fullName,
                phone: formattedPhone,
                id_number: idNumber,
                password_hash: passwordHash,
                village: village,
                username: username || formattedPhone.replace('+254', ''),
                created_at: new Date().toISOString(),
            });

            const userData = Array.isArray(result) ? result[0] : result;

            return {
                success: true,
                user: {
                    id: userData.id,
                    fullName: userData.full_name,
                    phone: userData.phone,
                    username: userData.username,
                }
            };
        } catch (e) {
            console.error('[Supabase] registerUser error:', e);
            return { success: false, error: 'Registration failed' };
        }
    }

    // ============ ISSUES ============

    /**
     * Get issues by user ID
     */
    async getIssuesByUserId(userId) {
        try {
            const result = await this.request('GET', `/rest/v1/issues?user_id=eq.${userId}&select=*&order=created_at.desc`);
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.error('[Supabase] getIssuesByUserId error:', e);
            return [];
        }
    }

    /**
     * Get single issue by ID or Ticket Number
     */
    async getIssue(issueId) {
        try {
            // Determine if issueId is a UUID or an issue_number
            const isUUID = issueId.includes('-') && issueId.length > 10 && !issueId.startsWith('ISS-');
            
            let path;
            if (isUUID) {
                path = `/rest/v1/issues?id=eq.${issueId}&select=*`;
            } else {
                path = `/rest/v1/issues?issue_number=eq.${encodeURIComponent(issueId)}&select=*`;
            }
            
            const result = await this.request('GET', path);
            return Array.isArray(result) && result.length > 0 ? result[0] : null;
        } catch (e) {
            console.error('[Supabase] getIssue error:', e);
            return null;
        }
    }

    /**
     * Get all issues
     */
    async getAllIssues() {
        try {
            const result = await this.request('GET', '/rest/v1/issues?select=*&order=created_at.desc&limit=100');
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.error('[Supabase] getAllIssues error:', e);
            return [];
        }
    }

    /**
     * Update issue status
     */
    async updateIssue(issueId, updates) {
        try {
            // Build update payload with only columns that exist in Supabase issues table
            // NOTE: issues table only has: status, updated_at (no action_note, no resolved_at)
            const payload = {
                updated_at: new Date().toISOString(),
            };
            
            // Only include fields that exist in Supabase schema
            if (updates.status) payload.status = updates.status;
            // resolved_at and action_note columns don't exist - skip them
            
            console.log(`[Supabase] Updating issue ${issueId} with:`, JSON.stringify(payload));
            
            const query = `/rest/v1/issues?id=eq.${issueId}`;
            const result = await this.request('PATCH', query, payload);
            
            console.log(`[Supabase] Update result:`, JSON.stringify(result));
            return { success: true, result };
        } catch (e) {
            console.error('[Supabase] updateIssue error:', e);
            console.error('[Supabase] Error details:', JSON.stringify(e));
            return { success: false, error: e.error?.message || e.error?.hint || 'Update failed' };
        }
    }

    /**
     * Create new issue (from mobile app)
     */
    async createIssue(data) {
        try {
            const result = await this.request('POST', '/rest/v1/issues', {
                issue_number: data.issue_number,
                title: data.title,
                category: data.category,
                description: data.description,
                location: data.location,
                images: data.images || [],
                user_phone: data.phone || data.user_phone || '',
                user_id: data.user_id || null,
                status: data.status || 'Pending',
                created_at: new Date().toISOString()
            });
            
            return { success: true, data: result };
        } catch (e) {
            console.error('[Supabase] createIssue error:', e);
            return { success: false, error: 'Insert failed' };
        }
    }

    // ============ BURSARY APPLICATIONS ============

    /**
     * Get all bursary applications
     */
    async getAllBursaries() {
        try {
            const result = await this.request('GET', '/rest/v1/bursary_applications?select=*&order=created_at.desc&limit=100');
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.error('[Supabase] getAllBursaries error:', e);
            return [];
        }
    }

    /**
     * Get bursary by ID
     */
    async getBursaryById(bursaryId) {
        try {
            const result = await this.request('GET', `/rest/v1/bursary_applications?id=eq.${bursaryId}&select=*`);
            return Array.isArray(result) && result.length > 0 ? result[0] : null;
        } catch (e) {
            console.error('[Supabase] getBursaryById error:', e);
            return null;
        }
    }

    /**
     * Update bursary status (approve/reject)
     * Uses 'id' field only (ref_code doesn't exist in Supabase)
     */
    async updateBursary(bursaryId, updates) {
        try {
            // Ensure status is lowercase to match schema
            if (updates.status) {
                updates.status = updates.status.toLowerCase();
            }
            
            const result = await this.request('PATCH', `/rest/v1/bursary_applications?id=eq.${bursaryId}`, {
                ...updates,
                updated_at: new Date().toISOString()
            });
            
            return { success: true, result };
        } catch (e) {
            console.error('[Supabase] updateBursary error:', e);
            return { success: false, error: 'Update failed' };
        }
    }

    /**
     * Approve bursary application
     */
    async approveBursary(bursaryId, amount, notes, approvedBy) {
        return this.updateBursary(bursaryId, {
            status: 'Approved',
            approved_amount: amount,
            approval_notes: notes,
            approved_by: approvedBy,
            approved_at: new Date().toISOString()
        });
    }

    /**
     * Reject bursary application
     */
    async rejectBursary(bursaryId, reason, rejectedBy) {
        return this.updateBursary(bursaryId, {
            status: 'Rejected',
            rejection_reason: reason,
            rejected_by: rejectedBy,
            rejected_at: new Date().toISOString()
        });
    }

    /**
     * Create new bursary application (from mobile app)
     * Supabase columns: user_id, institution_name, course, year_of_study, institution_type, reason, status, amount_requested, amount_approved, admin_notes, created_at, updated_at
     */
    async createBursaryApplication(data) {
        try {
            const result = await this.request('POST', '/rest/v1/bursary_applications', {
                user_id: data.user_id || null,
                institution_name: data.institution_name || data.school_name || data.institutionName,
                course: data.course || '',
                year_of_study: data.year_of_study || data.yearOfStudy || '',
                institution_type: data.institution_type || data.institutionType || 'university',
                reason: data.reason || '',
                status: (data.status || 'pending').toLowerCase(),
                amount_requested: data.amount_requested || data.amountRequested || 0,
                amount_approved: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            
            return { success: true, data: result };
        } catch (e) {
            console.error('[Supabase] createBursaryApplication error:', e);
            return { success: false, error: 'Insert failed' };
        }
    }

    // ============ ANNOUNCEMENTS ============

    /**
     * Get active announcements
     */
    async getAnnouncements() {
        try {
            const result = await this.request('GET', '/rest/v1/announcements?is_active=eq.true&select=*&order=created_at.desc&limit=20');
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.error('[Supabase] getAnnouncements error:', e);
            return [];
        }
    }

    /**
     * Create announcement
     * Note: Supabase announcements table uses 'content' not 'body'
     */
    async createAnnouncement({ title, body, content, priority = 'normal', target_audience = 'all', image_url = null }) {
        try {
            const data = {
                title,
                content: content || body, // Supabase uses 'content' not 'body'
                priority,
                target_audience,
                is_active: true,
                created_at: new Date().toISOString(),
            };
            
            if (image_url) data.image_url = image_url;
            
            const result = await this.request('POST', '/rest/v1/announcements', data);
            return { success: true, result };
        } catch (e) {
            console.error('[Supabase] createAnnouncement error:', e);
            return { success: false, error: 'Creation failed' };
        }
    }

    // ============ APP CONFIG ============

    /**
     * Get app config
     */
    async getAppConfig() {
        try {
            const result = await this.request('GET', '/rest/v1/app_config?select=*');
            const configMap = {};
            if (Array.isArray(result)) {
                result.forEach(item => {
                    configMap[item.key] = item.value;
                });
            }
            return configMap;
        } catch (e) {
            console.error('[Supabase] getAppConfig error:', e);
            return {};
        }
    }

    /**
     * Update app config
     */
    async updateAppConfig(key, value) {
        try {
            await this.request('PATCH', `/rest/v1/app_config?key=eq.${key}`, { value });
            return { success: true };
        } catch (e) {
            console.error('[Supabase] updateAppConfig error:', e);
            return { success: false, error: 'Update failed' };
        }
    }

    /**
     * Delete issue - handles both UUID (id) and issue_number formats
     */
    async deleteIssue(issueId) {
        try {
            console.log(`[Supabase] deleteIssue called with: ${issueId}`);
            
            // Determine if issueId is a UUID or an issue_number (like ISS-123456)
            const isUUID = issueId.includes('-') && issueId.length > 10 && !issueId.startsWith('ISS-');
            
            let deletePath;
            if (isUUID) {
                // It's a UUID, use id field
                deletePath = `/rest/v1/issues?id=eq.${issueId}`;
            } else {
                // It's an issue_number like ISS-123456
                deletePath = `/rest/v1/issues?issue_number=eq.${encodeURIComponent(issueId)}`;
            }
            
            console.log(`[Supabase] Deleting via path: ${deletePath}`);
            await this.request('DELETE', deletePath);
            console.log(`[Supabase] Issue ${issueId} deleted successfully`);
            return { success: true };
        } catch (e) {
            console.error('[Supabase] deleteIssue error:', e);
            // Try the other field if first one failed
            try {
                const isUUID = issueId.includes('-') && issueId.length > 10 && !issueId.startsWith('ISS-');
                const fallbackPath = isUUID 
                    ? `/rest/v1/issues?issue_number=eq.${encodeURIComponent(issueId)}`
                    : `/rest/v1/issues?id=eq.${issueId}`;
                console.log(`[Supabase] Trying fallback delete path: ${fallbackPath}`);
                await this.request('DELETE', fallbackPath);
                console.log(`[Supabase] Issue ${issueId} deleted via fallback`);
                return { success: true };
            } catch (e2) {
                console.error('[Supabase] Fallback delete also failed:', e2);
                return { success: false, error: e.error?.message || 'Delete failed' };
            }
        }
    }

    /**
     * Delete resolved issues older than timestamp
     */
    async deleteResolvedIssuesBefore(timestamp) {
        try {
            // Format timestamp for Supabase (ISO string)
            const isoTime = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
            
            // Query: status=Resolved AND updated_at < timestamp
            // Note: 'resolved_at' column does not exist, so we use 'updated_at' 
            // assuming the status change to 'Resolved' was the last update.
            
            // Delete requests with filters
            await this.request('DELETE', `/rest/v1/issues?status=eq.Resolved&updated_at=lt.${isoTime}`);
            
            return { success: true };
        } catch (e) {
            console.error('[Supabase] deleteResolvedIssuesBefore error:', e);
            return { success: false, error: 'Auto-deletion failed' };
        }
    }

    // ============ LOST IDs ============

    /**
     * Report a lost ID
     */
    async reportLostId(data) {
        try {
            const result = await this.request('POST', '/rest/v1/lost_ids', {
                reporter_phone: data.reporter_phone,
                reporter_name: data.reporter_name,
                id_owner_name: data.id_owner_name,
                id_owner_phone: data.id_owner_phone,
                is_for_self: data.is_for_self !== false,
                id_number: data.id_number,
                last_seen_location: data.last_seen_location,
                date_lost: data.date_lost,
                additional_info: data.additional_info,
                status: 'pending',
                created_at: new Date().toISOString()
            });
            return { success: true, data: result };
        } catch (e) {
            console.error('[Supabase] reportLostId error:', e);
            return { success: false, error: 'Failed to report lost ID' };
        }
    }

    /**
     * Get all lost ID reports
     */
    async getAllLostIds() {
        try {
            const result = await this.request('GET', '/rest/v1/lost_ids?select=*&order=created_at.desc&limit=100');
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.error('[Supabase] getAllLostIds error:', e);
            return [];
        }
    }

    /**
     * Update lost ID status
     */
    async updateLostIdStatus(id, status, adminNotes = null) {
        try {
            const updateData = { status, updated_at: new Date().toISOString() };
            if (status === 'found') updateData.found_at = new Date().toISOString();
            if (adminNotes) updateData.admin_notes = adminNotes;
            
            const result = await this.request('PATCH', `/rest/v1/lost_ids?id=eq.${id}`, updateData);
            return { success: true, result };
        } catch (e) {
            console.error('[Supabase] updateLostIdStatus error:', e);
            return { success: false, error: 'Update failed' };
        }
    }

    // ============ FEEDBACK ============

    /**
     * Submit feedback
     */
    async submitFeedback(data) {
        try {
            const result = await this.request('POST', '/rest/v1/feedback', {
                user_id: data.user_id,
                user_phone: data.user_phone,
                user_name: data.user_name,
                category: data.category || 'general',
                message: data.message,
                rating: data.rating,
                status: 'new',
                created_at: new Date().toISOString()
            });
            return { success: true, data: result };
        } catch (e) {
            console.error('[Supabase] submitFeedback error:', e);
            return { success: false, error: 'Failed to submit feedback' };
        }
    }

    /**
     * Get all feedback
     */
    async getAllFeedback() {
        try {
            const result = await this.request('GET', '/rest/v1/feedback?select=*&order=created_at.desc&limit=100');
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.error('[Supabase] getAllFeedback error:', e);
            return [];
        }
    }

    /**
     * Respond to feedback
     */
    async respondToFeedback(id, response) {
        try {
            const result = await this.request('PATCH', `/rest/v1/feedback?id=eq.${id}`, {
                admin_response: response,
                status: 'responded',
                responded_at: new Date().toISOString()
            });
            return { success: true, result };
        } catch (e) {
            console.error('[Supabase] respondToFeedback error:', e);
            return { success: false, error: 'Response failed' };
        }
    }
}

// Export singleton instance
const supabaseService = new SupabaseService();
module.exports = supabaseService;
