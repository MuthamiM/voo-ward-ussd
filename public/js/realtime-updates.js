/**
 * Real-time Updates Module
 * WebSocket-based live notifications and data updates
 */

window.RealTimeUpdates = (function() {
    'use strict';
    
    // State
    let socket = null;
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 5;
    let reconnectDelay = 3000;
    let isConnected = false;
    let listeners = {};
    
    /**
     * Initialize real-time connection
     */
    function init() {
        // For now, use polling as fallback
        // In production, implement WebSocket server
        startPolling();
        addConnectionIndicator();
    }
    
    /**
     * Start polling for updates (fallback for WebSocket)
     */
    function startPolling() {
        // Poll for new issues every 30 seconds
        setInterval(() => {
            checkForNewIssues();
            checkForNewNotifications();
        }, 30000);
        
        isConnected = true;
        updateConnectionStatus('connected');
    }
    
    /**
     * Check for new issues
     */
    async function checkForNewIssues() {
        try {
            const response = await fetch('/api/issues/recent?minutes=1', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) return;
            
            const newIssues = await response.json();
            
            if (newIssues.length > 0) {
                newIssues.forEach(issue => {
                    notifyNewIssue(issue);
                    emit('new-issue', issue);
                });
            }
        } catch (error) {
            console.error('Error checking for new issues:', error);
        }
    }
    
    /**
     * Check for new notifications
     */
    async function checkForNewNotifications() {
        try {
            const response = await fetch('/api/notifications/recent?minutes=1', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) return;
            
            const newNotifications = await response.json();
            
            if (newNotifications.length > 0) {
                newNotifications.forEach(notification => {
                    showNotification(notification);
                    emit('new-notification', notification);
                });
            }
        } catch (error) {
            console.error('Error checking for notifications:', error);
        }
    }
    
    /**
     * Notify about new issue
     */
    function notifyNewIssue(issue) {
        // Desktop notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Issue Reported', {
                body: `${issue.title || issue.type} - ${issue.area || 'Unknown area'}`,
                icon: '/images/logo.png',
                tag: `issue-${issue._id}`
            });
        }
        
        // In-app notification
        if (window.DashboardEnhancements?.Notifications) {
            window.DashboardEnhancements.Notifications.add({
                title: 'New Issue Reported',
                message: `${issue.title || issue.type} in ${issue.area || 'your ward'}`,
                type: 'info',
                action: () => {
                    viewIssue(issue._id);
                }
            });
        }
        
        // Play sound
        playNotificationSound();
        
        // Update badge count
        updateIssueBadge();
    }
    
    /**
     * Show notification
     */
    function showNotification(notification) {
        if (window.DashboardEnhancements?.Notifications) {
            window.DashboardEnhancements.Notifications.add({
                title: notification.title,
                message: notification.message,
                type: notification.type || 'info'
            });
        }
    }
    
    /**
     * Add connection status indicator
     */
    function addConnectionIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'realtimeIndicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            background: white;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 600;
            z-index: 9999;
            transition: all 0.3s ease;
        `;
        
        indicator.innerHTML = `
            <div id="connectionDot" style="
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #10b981;
                animation: pulse 2s infinite;
            "></div>
            <span id="connectionText">Live</span>
        `;
        
        document.body.appendChild(indicator);
        
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Update connection status
     */
    function updateConnectionStatus(status) {
        const dot = document.getElementById('connectionDot');
        const text = document.getElementById('connectionText');
        
        if (!dot || !text) return;
        
        if (status === 'connected') {
            dot.style.background = '#10b981';
            text.textContent = 'Live';
            text.style.color = '#10b981';
        } else if (status === 'connecting') {
            dot.style.background = '#f59e0b';
            text.textContent = 'Connecting...';
            text.style.color = '#f59e0b';
        } else {
            dot.style.background = '#ef4444';
            text.textContent = 'Offline';
            text.style.color = '#ef4444';
        }
    }
    
    /**
     * Request notification permission
     */
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Notification permission granted');
                }
            });
        }
    }
    
    /**
     * Play notification sound
     */
    function playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZizcIGWi77eefTRAMUKfj8LZjHAY4ktfyzHksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQUrgs7y2Ys3CBlou+3nn00QDFCn4/C2YxwGOJLX8sx5LAUkd8fw3ZBAChddu+vrrFoXC0qj4fK/bSMGLITQ8tuLOAcZabzt6aBOEQ1Sq+Txu2kcBjqV2vPOey4GJHnJ8+CRQgsWYLft7KpWFQtIoeDyvmwhBSuBzvLZizcIGWi77eefTRAMUKfj8LZjHAY4ktfyzHksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQUrgs7y2Ys3CBlou+3nn00QDFCn4/C2YxwGOJLX8sx5LAUkd8fw3ZBAChddu+vrrFoXC0qj4fK/bSMGLITQ8tuLOAcZabzt6aBOEQ1Sq+Txu2kcBjqV2vPOey4GJHnJ8+CRQgsWYLft7KpWFQtIoeDyvmwhBSuBzvLZizcIGWi77eefTRAMUKfj8LZjHAY4ktfyzHksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQUrgs7y2Ys3CBlou+3nn00QDFCn4/C2YxwGOJLX8sx5LAUkd8fw3ZBAChddu+vrrFoXC0qj4fK/bSMGLITQ8tuLOAcZabzt6aBOEQ1Sq+Txu2kcBjqV2vPOey4GJHnJ8+CRQg==');
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Silently fail if audio playback is blocked
            });
        } catch (error) {
            // Ignore audio errors
        }
    }
    
    /**
     * Update issue badge count
     */
    function updateIssueBadge() {
        const badge = document.querySelector('.sidebar-item[data-page="issues"] .badge');
        if (badge) {
            const current = parseInt(badge.textContent) || 0;
            badge.textContent = current + 1;
            badge.style.display = 'inline-block';
        }
    }
    
    /**
     * View issue details
     */
    function viewIssue(issueId) {
        if (window.DashboardEnhancements?.Sidebar) {
            window.DashboardEnhancements.Sidebar.navigate('issues');
        }
        
        setTimeout(() => {
            const row = document.querySelector(`tr[data-issue-id="${issueId}"]`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.style.background = 'rgba(124, 58, 237, 0.1)';
                setTimeout(() => {
                    row.style.background = '';
                }, 2000);
            }
        }, 500);
    }
    
    /**
     * Event system
     */
    function on(event, callback) {
        if (!listeners[event]) {
            listeners[event] = [];
        }
        listeners[event].push(callback);
    }
    
    function off(event, callback) {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(cb => cb !== callback);
    }
    
    function emit(event, data) {
        if (!listeners[event]) return;
        listeners[event].forEach(callback => callback(data));
    }
    
    /**
     * Refresh data in current view
     */
    function refreshCurrentView() {
        // Refresh issues table if visible
        if (document.getElementById('issuesTable')?.style.display !== 'none') {
            if (window.loadIssues) window.loadIssues();
        }
        
        // Refresh announcements if visible
        if (document.getElementById('announcementsTable')?.style.display !== 'none') {
            if (window.loadAnnouncements) window.loadAnnouncements();
        }
        
        // Refresh map if visible
        if (document.getElementById('issueMap')?.style.display !== 'none') {
            if (window.IssueMap?.refresh) window.IssueMap.refresh();
        }
        
        // Refresh analytics if visible
        if (document.getElementById('analyticsCharts')?.style.display !== 'none') {
            if (window.AnalyticsCharts?.refresh) window.AnalyticsCharts.refresh();
        }
    }
    
    // Public API
    return {
        init,
        on,
        off,
        requestNotificationPermission,
        refreshCurrentView,
        isConnected: () => isConnected
    };
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        RealTimeUpdates.init();
        RealTimeUpdates.requestNotificationPermission();
    });
} else {
    RealTimeUpdates.init();
    RealTimeUpdates.requestNotificationPermission();
}
