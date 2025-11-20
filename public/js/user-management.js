/**
 * User Management Module
 * Comprehensive user administration interface
 */

window.UserManagement = (function() {
    'use strict';
    
    // State
    let users = [];
    let currentUser = null;
    let filteredUsers = [];
    
    /**
     * Initialize user management
     */
    function init() {
        loadUsers();
        attachEventListeners();
    }
    
    /**
     * Load all users from API
     */
    async function loadUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to load users');
            
            users = await response.json();
            filteredUsers = [...users];
            renderUsers();
        } catch (error) {
            console.error('Error loading users:', error);
            showError('Failed to load users. Please try again.');
        }
    }
    
    /**
     * Render users grid
     */
    function renderUsers() {
        const container = document.getElementById('userManagementGrid');
        if (!container) return;
        
        if (filteredUsers.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 48px;">
                    <i class="fas fa-users" style="font-size: 48px; color: #9ca3af; margin-bottom: 16px;"></i>
                    <p style="color: #6b7280; font-size: 16px;">No users found</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredUsers.map(user => `
            <div class="user-card" data-user-id="${user._id}">
                <div class="user-card-header">
                    <img src="${user.avatar || '/images/default-avatar.png'}" 
                         alt="${user.name}" 
                         class="user-avatar-large"
                         onerror="this.src='/images/default-avatar.png'">
                    <div class="user-info">
                        <div class="user-name">${escapeHtml(user.name || user.username)}</div>
                        <div class="user-role-badge ${user.role.toLowerCase()}">${user.role}</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">
                        <i class="fas fa-envelope"></i> ${escapeHtml(user.email || 'No email')}
                    </div>
                    <div style="font-size: 13px; color: #6b7280;">
                        <i class="fas fa-phone"></i> ${escapeHtml(user.phone || 'No phone')}
                    </div>
                </div>
                
                <div class="user-stats">
                    <div class="user-stat">
                        <div class="user-stat-value">${user.issuesResolved || 0}</div>
                        <div class="user-stat-label">Resolved</div>
                    </div>
                    <div class="user-stat">
                        <div class="user-stat-value">${user.activeIssues || 0}</div>
                        <div class="user-stat-label">Active</div>
                    </div>
                    <div class="user-stat">
                        <div class="user-stat-value">${user.loginCount || 0}</div>
                        <div class="user-stat-label">Logins</div>
                    </div>
                </div>
                
                <div style="font-size: 12px; color: #9ca3af; margin-top: 12px;">
                    <i class="fas fa-clock"></i> Last login: ${formatDateTime(user.lastLogin)}
                </div>
                
                <div class="user-actions">
                    <button onclick="UserManagement.editUser('${user._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="UserManagement.resetPassword('${user._id}')">
                        <i class="fas fa-key"></i> Reset
                    </button>
                    ${user.role !== 'MCA' ? `
                        <button onclick="UserManagement.deleteUser('${user._id}')" 
                                style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2);">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Show add user modal
     */
    function showAddUserModal() {
        const modal = document.getElementById('addUserModal');
        if (!modal) createAddUserModal();
        
        document.getElementById('addUserForm').reset();
        document.getElementById('addUserModal').style.display = 'flex';
    }
    
    /**
     * Create add user modal
     */
    function createAddUserModal() {
        const modal = document.createElement('div');
        modal.id = 'addUserModal';
        modal.className = 'modal-backdrop';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <span>Add New User</span>
                    <button onclick="UserManagement.closeModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <form id="addUserForm" onsubmit="UserManagement.saveNewUser(event)">
                    <div style="padding: 24px;">
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Name *</label>
                            <input type="text" name="name" required 
                                   style="width: 100%; padding: 10px; border: 2px solid rgba(124, 58, 237, 0.2); border-radius: 8px;">
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Username *</label>
                            <input type="text" name="username" required 
                                   style="width: 100%; padding: 10px; border: 2px solid rgba(124, 58, 237, 0.2); border-radius: 8px;">
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Email</label>
                            <input type="email" name="email" 
                                   style="width: 100%; padding: 10px; border: 2px solid rgba(124, 58, 237, 0.2); border-radius: 8px;">
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phone</label>
                            <input type="tel" name="phone" placeholder="+254..." 
                                   style="width: 100%; padding: 10px; border: 2px solid rgba(124, 58, 237, 0.2); border-radius: 8px;">
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Role *</label>
                            <select name="role" required 
                                    style="width: 100%; padding: 10px; border: 2px solid rgba(124, 58, 237, 0.2); border-radius: 8px;">
                                <option value="PA">Personal Assistant (PA)</option>
                                <option value="CLERK">Clerk</option>
                            </select>
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Password *</label>
                            <input type="password" name="password" required minlength="6" 
                                   style="width: 100%; padding: 10px; border: 2px solid rgba(124, 58, 237, 0.2); border-radius: 8px;">
                            <small style="color: #6b7280;">Minimum 6 characters</small>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn-sm" onclick="UserManagement.closeModal()">Cancel</button>
                        <button type="submit" class="btn-sm btn-primary">Create User</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    /**
     * Save new user
     */
    async function saveNewUser(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const userData = Object.fromEntries(formData.entries());
        
        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create user');
            }
            
            const newUser = await response.json();
            users.push(newUser);
            filteredUsers = [...users];
            renderUsers();
            closeModal();
            showSuccess('User created successfully!');
        } catch (error) {
            console.error('Error creating user:', error);
            showError(error.message);
        }
    }
    
    /**
     * Edit user
     */
    async function editUser(userId) {
        // Implementation for edit user modal
        console.log('Edit user:', userId);
        showInfo('Edit user feature coming soon');
    }
    
    /**
     * Reset password
     */
    async function resetPassword(userId) {
        if (!confirm('Send password reset email to this user?')) return;
        
        try {
            const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to reset password');
            
            showSuccess('Password reset email sent!');
        } catch (error) {
            console.error('Error resetting password:', error);
            showError('Failed to reset password. Please try again.');
        }
    }
    
    /**
     * Delete user
     */
    async function deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
        
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to delete user');
            
            users = users.filter(u => u._id !== userId);
            filteredUsers = filteredUsers.filter(u => u._id !== userId);
            renderUsers();
            showSuccess('User deleted successfully');
        } catch (error) {
            console.error('Error deleting user:', error);
            showError('Failed to delete user. Please try again.');
        }
    }
    
    /**
     * Filter users
     */
    function filterUsers(searchTerm, role) {
        filteredUsers = users.filter(user => {
            const matchesSearch = !searchTerm || 
                user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchTerm.toLowerCase());
                
            const matchesRole = !role || user.role === role;
            
            return matchesSearch && matchesRole;
        });
        
        renderUsers();
    }
    
    /**
     * Close modal
     */
    function closeModal() {
        const modal = document.getElementById('addUserModal');
        if (modal) modal.style.display = 'none';
    }
    
    /**
     * Attach event listeners
     */
    function attachEventListeners() {
        // Search input
        const searchInput = document.getElementById('userSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const roleFilter = document.getElementById('userRoleFilter');
                filterUsers(e.target.value, roleFilter?.value);
            });
        }
        
        // Role filter
        const roleFilter = document.getElementById('userRoleFilter');
        if (roleFilter) {
            roleFilter.addEventListener('change', (e) => {
                const searchInput = document.getElementById('userSearchInput');
                filterUsers(searchInput?.value, e.target.value);
            });
        }
    }
    
    // Helper functions
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    function formatDateTime(date) {
        if (!date) return 'Never';
        const d = new Date(date);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    }
    
    function showSuccess(message) {
        // Use existing notification system
        if (window.DashboardEnhancements?.Notifications) {
            window.DashboardEnhancements.Notifications.add({
                title: 'Success',
                message,
                type: 'success'
            });
        } else {
            alert(message);
        }
    }
    
    function showError(message) {
        if (window.DashboardEnhancements?.Notifications) {
            window.DashboardEnhancements.Notifications.add({
                title: 'Error',
                message,
                type: 'error'
            });
        } else {
            alert(message);
        }
    }
    
    function showInfo(message) {
        if (window.DashboardEnhancements?.Notifications) {
            window.DashboardEnhancements.Notifications.add({
                title: 'Info',
                message,
                type: 'info'
            });
        } else {
            alert(message);
        }
    }
    
    // Public API
    return {
        init,
        showAddUserModal,
        saveNewUser,
        editUser,
        resetPassword,
        deleteUser,
        filterUsers,
        closeModal
    };
})();

// Auto-initialize if on user management page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Don't auto-initialize, let dashboard call init when needed
    });
} else {
    // Don't auto-initialize, let dashboard call init when needed
}
