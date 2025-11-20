/**
 * Audit Trail Module
 * Comprehensive activity tracking and logging
 */

window.AuditTrail = (function() {
    'use strict';
    
    // State
    let auditLogs = [];
    let filteredLogs = [];
    let currentPage = 1;
    const logsPerPage = 20;
    
    /**
     * Initialize audit trail
     */
    function init() {
        loadAuditLogs();
        attachEventListeners();
    }
    
    /**
     * Load audit logs from API
     */
    async function loadAuditLogs(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`/api/admin/audit-logs?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to load audit logs');
            
            auditLogs = await response.json();
            filteredLogs = [...auditLogs];
            currentPage = 1;
            renderAuditTrail();
        } catch (error) {
            console.error('Error loading audit logs:', error);
            showError('Failed to load audit trail. Please try again.');
        }
    }
    
    /**
     * Render audit trail timeline
     */
    function renderAuditTrail() {
        const container = document.getElementById('auditTimeline');
        if (!container) return;
        
        const startIdx = (currentPage - 1) * logsPerPage;
        const endIdx = startIdx + logsPerPage;
        const pageLogs = filteredLogs.slice(startIdx, endIdx);
        
        if (pageLogs.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 48px;">
                    <i class="fas fa-history" style="font-size: 48px; color: #9ca3af; margin-bottom: 16px;"></i>
                    <p style="color: #6b7280; font-size: 16px;">No audit logs found</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = pageLogs.map(log => `
            <div class="audit-item" data-log-id="${log._id}">
                <div class="audit-item-header">
                    <div class="audit-item-title">
                        <i class="${getActionIcon(log.action)}"></i>
                        ${escapeHtml(log.title || getActionTitle(log.action))}
                    </div>
                    <div class="audit-item-time">${formatTimeAgo(log.timestamp)}</div>
                </div>
                
                <div class="audit-item-user">
                    <i class="fas fa-user"></i>
                    ${escapeHtml(log.userName || log.userId)}
                    ${log.userRole ? `<span style="color: #7c3aed; font-weight: 600;">(${log.userRole})</span>` : ''}
                </div>
                
                ${log.description ? `
                    <div style="font-size: 13px; color: #4b5563; margin-top: 8px;">
                        ${escapeHtml(log.description)}
                    </div>
                ` : ''}
                
                ${log.details ? `
                    <div class="audit-item-details">
                        ${formatDetails(log.details)}
                    </div>
                ` : ''}
                
                <span class="audit-item-badge ${log.action.toLowerCase()}">
                    ${log.action}
                </span>
                
                ${log.ipAddress ? `
                    <div style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
                        <i class="fas fa-network-wired"></i> ${log.ipAddress}
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        renderPagination();
    }
    
    /**
     * Render pagination controls
     */
    function renderPagination() {
        const container = document.getElementById('auditPagination');
        if (!container) return;
        
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = '<div class="pagination-controls">';
        
        // Previous button
        html += `
            <button class="pagination-btn" 
                    onclick="AuditTrail.goToPage(${currentPage - 1})" 
                    ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;
        
        // Page numbers
        html += '<div class="pagination-numbers">';
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                html += `
                    <button class="pagination-number ${i === currentPage ? 'active' : ''}" 
                            onclick="AuditTrail.goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                html += '<span class="pagination-ellipsis">...</span>';
            }
        }
        html += '</div>';
        
        // Next button
        html += `
            <button class="pagination-btn" 
                    onclick="AuditTrail.goToPage(${currentPage + 1})" 
                    ${currentPage === totalPages ? 'disabled' : ''}>
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    /**
     * Go to specific page
     */
    function goToPage(page) {
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        if (page < 1 || page > totalPages) return;
        
        currentPage = page;
        renderAuditTrail();
        
        // Scroll to top of timeline
        document.getElementById('auditTimeline')?.scrollIntoView({ behavior: 'smooth' });
    }
    
    /**
     * Filter audit logs
     */
    function filterLogs(filters) {
        filteredLogs = auditLogs.filter(log => {
            // Filter by action type
            if (filters.action && log.action !== filters.action) return false;
            
            // Filter by user
            if (filters.userId && log.userId !== filters.userId) return false;
            
            // Filter by date range
            if (filters.startDate && new Date(log.timestamp) < new Date(filters.startDate)) return false;
            if (filters.endDate && new Date(log.timestamp) > new Date(filters.endDate)) return false;
            
            // Filter by search term
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const matchesTitle = log.title?.toLowerCase().includes(searchLower);
                const matchesDescription = log.description?.toLowerCase().includes(searchLower);
                const matchesUser = log.userName?.toLowerCase().includes(searchLower);
                
                if (!matchesTitle && !matchesDescription && !matchesUser) return false;
            }
            
            return true;
        });
        
        currentPage = 1;
        renderAuditTrail();
    }
    
    /**
     * Export audit logs
     */
    async function exportLogs(format = 'csv') {
        try {
            const response = await fetch(`/api/admin/audit-logs/export?format=${format}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to export logs');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showSuccess(`Audit logs exported successfully as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Error exporting logs:', error);
            showError('Failed to export audit logs. Please try again.');
        }
    }
    
    /**
     * Attach event listeners
     */
    function attachEventListeners() {
        // Action filter
        const actionFilter = document.getElementById('auditActionFilter');
        if (actionFilter) {
            actionFilter.addEventListener('change', () => {
                applyFilters();
            });
        }
        
        // Date filters
        const startDate = document.getElementById('auditStartDate');
        const endDate = document.getElementById('auditEndDate');
        if (startDate) startDate.addEventListener('change', () => applyFilters());
        if (endDate) endDate.addEventListener('change', () => applyFilters());
        
        // Search input
        const searchInput = document.getElementById('auditSearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => applyFilters(), 300);
            });
        }
    }
    
    /**
     * Apply all filters
     */
    function applyFilters() {
        const filters = {
            action: document.getElementById('auditActionFilter')?.value,
            startDate: document.getElementById('auditStartDate')?.value,
            endDate: document.getElementById('auditEndDate')?.value,
            search: document.getElementById('auditSearchInput')?.value
        };
        
        filterLogs(filters);
    }
    
    // Helper functions
    function getActionIcon(action) {
        const icons = {
            'CREATE': 'fas fa-plus-circle',
            'UPDATE': 'fas fa-edit',
            'DELETE': 'fas fa-trash-alt',
            'LOGIN': 'fas fa-sign-in-alt',
            'LOGOUT': 'fas fa-sign-out-alt',
            'EXPORT': 'fas fa-download',
            'IMPORT': 'fas fa-upload'
        };
        return icons[action] || 'fas fa-info-circle';
    }
    
    function getActionTitle(action) {
        const titles = {
            'CREATE': 'Created Record',
            'UPDATE': 'Updated Record',
            'DELETE': 'Deleted Record',
            'LOGIN': 'User Login',
            'LOGOUT': 'User Logout',
            'EXPORT': 'Exported Data',
            'IMPORT': 'Imported Data'
        };
        return titles[action] || action;
    }
    
    function formatDetails(details) {
        if (typeof details === 'string') return escapeHtml(details);
        if (typeof details === 'object') {
            return Object.entries(details)
                .map(([key, value]) => `<strong>${key}:</strong> ${escapeHtml(String(value))}`)
                .join('<br>');
        }
        return '';
    }
    
    function formatTimeAgo(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
    
    function showSuccess(message) {
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
    
    // Public API
    return {
        init,
        goToPage,
        filterLogs,
        exportLogs
    };
})();

// Auto-initialize if on audit trail page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('auditTimeline')) {
            AuditTrail.init();
        }
    });
} else {
    if (document.getElementById('auditTimeline')) {
        AuditTrail.init();
    }
}
