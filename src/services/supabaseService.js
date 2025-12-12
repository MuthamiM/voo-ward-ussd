/**
 * Supabase Service for USSD Dashboard
 * Connects dashboard to Supabase app_users table (shared with mobile app)
 * Keeps MongoDB as fallback but Supabase is primary for mobile users
 */

const https = require('https');
const crypto = require('crypto');

// Supabase credentials (same as mobile app)
const SUPABASE_URL = 'https://xzhmdxtzpuxycvsatjoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aG1keHR6cHV4eWN2c2F0am9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTYwNzAsImV4cCI6MjA4MDczMjA3MH0.2tZ7eu6DtBg2mSOitpRa4RNvgCGg3nvMWeDmn9fPJY0';

class SupabaseService {
    constructor() {
        this.baseUrl = SUPABASE_URL;
        this.apiKey = SUPABASE_ANON_KEY;
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
            // Try to update by id (numeric) or by matching ticket pattern
            let query = `/rest/v1/issues?id=eq.${issueId}`;
            
            const result = await this.request('PATCH', query, {
                status: updates.status,
                resolution_notes: updates.action_note,
                resolved_at: updates.resolved_at,
                updated_at: new Date().toISOString(),
            });
            
            return { success: true, result };
        } catch (e) {
            console.error('[Supabase] updateIssue error:', e);
            return { success: false, error: 'Update failed' };
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
     */
    async createAnnouncement({ title, body, priority = 'normal', target_audience = 'all' }) {
        try {
            const data = {
                title,
                body,
                content: body,
                priority,
                target_audience,
                is_active: true,
                created_at: new Date().toISOString(),
            };
            
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
     * Delete issue
     */
    async deleteIssue(issueId) {
        try {
            await this.request('DELETE', `/rest/v1/issues?id=eq.${issueId}`);
            return { success: true };
        } catch (e) {
            console.error('[Supabase] deleteIssue error:', e);
            return { success: false, error: 'Delete failed' };
        }
    }

    /**
     * Delete resolved issues older than timestamp
     */
    async deleteResolvedIssuesBefore(timestamp) {
        try {
            // Format timestamp for Supabase (ISO string)
            const isoTime = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
            
            // Query: status=Resolved AND resolved_at < timestamp
            // Note: Use 'eq.Resolved' or 'eq.resolved' depending on your case convention. 
            // The dashboard uses 'Resolved' (Title Case) but let's try to capture both if possible or stick to one.
            // Since dashboard sets it to 'Resolved', we use that.
            
            // Delete requests with filters
            await this.request('DELETE', `/rest/v1/issues?status=eq.Resolved&resolved_at=lt.${isoTime}`);
            
            return { success: true };
        } catch (e) {
            console.error('[Supabase] deleteResolvedIssuesBefore error:', e);
            return { success: false, error: 'Auto-deletion failed' };
        }
    }
}

// Export singleton instance
const supabaseService = new SupabaseService();
module.exports = supabaseService;
