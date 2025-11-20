/**
 * VOO Kyamatu Ward Dashboard - Enhancement Module
 * Provides: Sidebar, Notifications, Analytics, Pagination, Sorting, Filters
 */

// ========================================
// SIDEBAR NAVIGATION
// ========================================
const Sidebar = {
    isCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
    
    init() {
        this.render();
        this.attachEvents();
        if (this.isCollapsed) {
            document.getElementById('sidebar')?.classList.add('collapsed');
        }
    },
    
    render() {
        const sidebarHTML = `
            <div class="sidebar" id="sidebar">
                <button class="sidebar-toggle" id="sidebarToggle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <nav class="sidebar-nav">
                    <a href="#" class="sidebar-link active" data-tab="dashboard">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                        <span>Dashboard</span>
                    </a>
                    <a href="#" class="sidebar-link" data-tab="issues">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>Issues</span>
                    </a>
                    <a href="#" class="sidebar-link" data-tab="bursaries">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                        <span>Bursaries</span>
                    </a>
                    <a href="#" class="sidebar-link" data-tab="analytics">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                        <span>Analytics</span>
                    </a>
                    <a href="#" class="sidebar-link" data-tab="users">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span>Users</span>
                    </a>
                    <a href="#" class="sidebar-link" data-tab="settings">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M12 1v6m0 6v6m6-12a9 9 0 1 1-12 0"></path>
                        </svg>
                        <span>Settings</span>
                    </a>
                </nav>
            </div>
        `;
        
        // Insert before main container
        const container = document.querySelector('.container');
        if (container && !document.getElementById('sidebar')) {
            container.insertAdjacentHTML('beforebegin', sidebarHTML);
        }
    },
    
    attachEvents() {
        const toggleBtn = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        
        toggleBtn?.addEventListener('click', () => {
            sidebar?.classList.toggle('collapsed');
            this.isCollapsed = sidebar?.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', this.isCollapsed);
        });
        
        // Handle navigation clicks
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.getAttribute('data-tab');
                this.navigate(tab);
            });
        });
    },
    
    navigate(tabName) {
        // Remove active class from all sidebar links
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        
        // Add active to clicked link
        const activeLink = document.querySelector(`.sidebar-link[data-tab="${tabName}"]`);
        if (activeLink) activeLink.classList.add('active');
        
        // Call the main openTab function if it exists
        if (typeof window.openTab === 'function') {
            window.openTab(tabName);
        } else {
            // Fallback: manually show/hide content
            document.querySelectorAll('.tab-content').forEach(div => div.style.display = 'none');
            const content = document.getElementById(tabName + '-content');
            if (content) content.style.display = 'block';
            
            // Load data based on tab
            if (tabName === 'issues' && typeof window.loadIssues === 'function') window.loadIssues();
            else if (tabName === 'bursaries' && typeof window.loadBursaries === 'function') window.loadBursaries();
            else if (tabName === 'constituents' && typeof window.loadConstituents === 'function') window.loadConstituents();
            else if (tabName === 'announcements' && typeof window.loadAnnouncements === 'function') window.loadAnnouncements();
            else if (tabName === 'users' && typeof window.loadUsers === 'function') window.loadUsers();
        }
    }
};

// ========================================
// NOTIFICATIONS
// ========================================
const Notifications = {
    notifications: [],
    unreadCount: 0,
    
    init() {
        this.render();
        this.attachEvents();
        this.startPolling();
    },
    
    render() {
        // Notification bell already exists in navbar, just enhance it
        const navbar = document.querySelector('.navbar-user');
        if (!navbar || document.getElementById('notificationBell')) return;
        
        const bellHTML = `
            <div class="notification-bell" id="notificationBell">
                <button class="notification-btn" id="notificationBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span class="notification-badge" id="notificationBadge">0</span>
                </button>
                <div class="notification-dropdown" id="notificationDropdown">
                    <div class="notification-header">
                        <span>Notifications</span>
                        <button class="notification-clear" onclick="DashboardEnhancements.Notifications.markAllRead()">Mark all read</button>
                    </div>
                    <div class="notification-list" id="notificationList">
                        <div class="notification-empty">No new notifications</div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert before logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.parentElement.insertAdjacentHTML('beforebegin', bellHTML);
        }
    },
    
    attachEvents() {
        const btn = document.getElementById('notificationBtn');
        const dropdown = document.getElementById('notificationDropdown');
        
        btn?.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                this.navigate(tab);
            });
        });
    },
    
    navigate(tab) {
        // Update active state
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
        
        // Switch content (integrate with existing tab system)
        if (window.switchTab) {
            window.switchTab(tab);
        }
    }
};

// ========================================
// NOTIFICATION SYSTEM
// ========================================
const Notifications = {
    notifications: [],
    unreadCount: 0,
    
    init() {
        this.render();
        this.loadNotifications();
        this.startPolling();
    },
    
    render() {
        const bellHTML = `
            <div class="notification-container">
                <button class="notification-bell" id="notificationBell">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span class="notification-badge" id="notificationBadge">0</span>
                </button>
                <div class="notification-dropdown" id="notificationDropdown" style="display:none;">
                    <div class="notification-header">
                        <h3>Notifications</h3>
                        <button onclick="Notifications.markAllRead()">Mark all read</button>
                    </div>
                    <div class="notification-list" id="notificationList">
                        <div class="notification-empty">No new notifications</div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert in navbar
        const navbarUser = document.querySelector('.navbar-user > div:first-child');
        if (navbarUser && !document.getElementById('notificationBell')) {
            navbarUser.insertAdjacentHTML('afterbegin', bellHTML);
            this.attachEvents();
        }
    },
    
    attachEvents() {
        const bell = document.getElementById('notificationBell');
        const dropdown = document.getElementById('notificationDropdown');
        
        bell?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-container')) {
                dropdown.style.display = 'none';
            }
        });
    },
    
    async loadNotifications() {
        // Load from API or localStorage
        const stored = localStorage.getItem('notifications');
        if (stored) {
            this.notifications = JSON.parse(stored);
            this.updateUI();
        }
    },
    
    addNotification(notification) {
        this.notifications.unshift({
            id: Date.now(),
            ...notification,
            read: false,
            timestamp: new Date()
        });
        
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }
        
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
        this.updateUI();
    },
    
    updateUI() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        const list = document.getElementById('notificationList');
        
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
        
        if (list) {
            if (this.notifications.length === 0) {
                list.innerHTML = '<div class="notification-empty">No new notifications</div>';
            } else {
                list.innerHTML = this.notifications.slice(0, 10).map(n => `
                    <div class="notification-item ${n.read ? 'read' : ''}" onclick="Notifications.markRead(${n.id})">
                        <div class="notification-icon ${n.type}">${this.getIcon(n.type)}</div>
                        <div class="notification-content">
                            <div class="notification-title">${n.title}</div>
                            <div class="notification-message">${n.message}</div>
                            <div class="notification-time">${this.formatTime(n.timestamp)}</div>
                        </div>
                    </div>
                `).join('');
            }
        }
    },
    
    getIcon(type) {
        const icons = {
            issue: '⚠️',
            bursary: '💰',
            user: '👤',
            system: 'ℹ️',
            success: '✅'
        };
        return icons[type] || 'ℹ️';
    },
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    },
    
    markRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            localStorage.setItem('notifications', JSON.stringify(this.notifications));
            this.updateUI();
        }
    },
    
    markAllRead() {
        this.notifications.forEach(n => n.read = true);
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
        this.updateUI();
    },
    
    startPolling() {
        // Poll for new notifications every 30 seconds
        setInterval(() => {
            // Check for new issues/bursaries
            this.checkForNewItems();
        }, 30000);
    },
    
    async checkForNewItems() {
        // This would connect to your API
        // For now, checking localStorage for changes
        const lastCheck = localStorage.getItem('lastNotificationCheck');
        const now = Date.now();
        
        if (!lastCheck || (now - parseInt(lastCheck)) > 30000) {
            localStorage.setItem('lastNotificationCheck', now);
            // Simulate checking for new items
        }
    }
};

// ========================================
// PAGINATION
// ========================================
class Pagination {
    constructor(containerId, itemsPerPage = 10) {
        this.container = document.getElementById(containerId);
        this.itemsPerPage = itemsPerPage;
        this.currentPage = 1;
        this.totalItems = 0;
        this.allData = [];
    }
    
    setData(data) {
        this.allData = data;
        this.totalItems = data.length;
        this.currentPage = 1;
        this.render();
    }
    
    getCurrentPageData() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.allData.slice(start, end);
    }
    
    getTotalPages() {
        return Math.ceil(this.totalItems / this.itemsPerPage);
    }
    
    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.render();
        if (this.onPageChange) {
            this.onPageChange(this.getCurrentPageData());
        }
    }
    
    setItemsPerPage(count) {
        this.itemsPerPage = count;
        this.currentPage = 1;
        this.render();
        if (this.onPageChange) {
            this.onPageChange(this.getCurrentPageData());
        }
    }
    
    render() {
        if (!this.container) return;
        
        const totalPages = this.getTotalPages();
        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
        
        this.container.innerHTML = `
            <div class="pagination-container">
                <div class="pagination-info">
                    Showing ${start} to ${end} of ${this.totalItems} entries
                </div>
                <div class="pagination-controls">
                    <select class="pagination-select" onchange="this.pagination.setItemsPerPage(parseInt(this.value))">
                        <option value="10" ${this.itemsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                        <option value="20" ${this.itemsPerPage === 20 ? 'selected' : ''}>20 per page</option>
                        <option value="50" ${this.itemsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                        <option value="100" ${this.itemsPerPage === 100 ? 'selected' : ''}>100 per page</option>
                    </select>
                    <div class="pagination-buttons">
                        <button onclick="this.pagination.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>
                            Previous
                        </button>
                        ${this.renderPageNumbers()}
                        <button onclick="this.pagination.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>
                            Next
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Store reference for event handlers
        this.container.querySelector('.pagination-select').pagination = this;
        this.container.querySelectorAll('.pagination-buttons button').forEach(btn => {
            btn.pagination = this;
        });
    }
    
    renderPageNumbers() {
        const totalPages = this.getTotalPages();
        const pages = [];
        const maxVisible = 5;
        
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            pages.push(`<button onclick="this.pagination.goToPage(1)">1</button>`);
            if (startPage > 2) pages.push(`<span>...</span>`);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pages.push(`<button class="${i === this.currentPage ? 'active' : ''}" onclick="this.pagination.goToPage(${i})">${i}</button>`);
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pages.push(`<span>...</span>`);
            pages.push(`<button onclick="this.pagination.goToPage(${totalPages})">${totalPages}</button>`);
        }
        
        return pages.join('');
    }
}

// ========================================
// TABLE SORTING
// ========================================
const TableSort = {
    init(tableId) {
        const table = document.querySelector(`#${tableId}`);
        if (!table) return;
        
        const headers = table.querySelectorAll('thead th');
        headers.forEach((header, index) => {
            if (header.textContent.trim() && !header.querySelector('input[type="checkbox"]')) {
                header.style.cursor = 'pointer';
                header.title = 'Click to sort';
                header.innerHTML += ' <span class="sort-icon">⇅</span>';
                
                header.addEventListener('click', () => {
                    this.sortTable(table, index);
                });
            }
        });
    },
    
    sortTable(table, columnIndex) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const isAscending = table.dataset.sortOrder !== 'asc';
        
        rows.sort((a, b) => {
            const aValue = a.cells[columnIndex]?.textContent.trim() || '';
            const bValue = b.cells[columnIndex]?.textContent.trim() || '';
            
            // Try to parse as number
            const aNum = parseFloat(aValue.replace(/[^0-9.-]/g, ''));
            const bNum = parseFloat(bValue.replace(/[^0-9.-]/g, ''));
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return isAscending ? aNum - bNum : bNum - aNum;
            }
            
            // Sort as string
            return isAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        });
        
        // Update UI
        rows.forEach(row => tbody.appendChild(row));
        table.dataset.sortOrder = isAscending ? 'asc' : 'desc';
        
        // Update sort icons
        table.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '⇅');
        table.querySelectorAll('th')[columnIndex].querySelector('.sort-icon').textContent = isAscending ? '▲' : '▼';
    }
};

// ========================================
// INITIALIZE ALL MODULES
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Wait for dashboard to be visible
    const initEnhancements = () => {
        if (document.getElementById('dashboardPage')) {
            try {
                Sidebar.init();
                Notifications.init();
                
                // Initialize table sorting for all tables
                TableSort.init('issues-tbody');
                TableSort.init('bursaries-tbody');
                TableSort.init('constituents-tbody');
            } catch (error) {
                console.error('Error initializing dashboard enhancements:', error);
            }
        }
    };
    
    // Try immediately
    initEnhancements();
    
    // Also try after a delay in case dashboard renders later
    setTimeout(initEnhancements, 500);
    setTimeout(initEnhancements, 1000);
});

// Export for use in main dashboard
window.DashboardEnhancements = {
    Sidebar,
    Notifications,
    Pagination,
    TableSort
};

// Also expose init function for manual calls
window.initializeDashboardEnhancements = () => {
    try {
        Sidebar.init();
        Notifications.init();
    } catch (error) {
        console.error('Manual init error:', error);
    }
};
