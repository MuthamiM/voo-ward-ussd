/**
 * Map Integration Module
 * Interactive issue location mapping with Leaflet
 */

window.IssueMap = (function() {
    'use strict';
    
    // State
    let map = null;
    let markers = [];
    let issuesData = [];
    let markerClusterGroup = null;
    
    /**
     * Initialize map
     */
    function init(containerId = 'issueMap') {
        if (!window.L) {
            console.error('Leaflet library not loaded');
            return;
        }
        
        // Initialize map centered on Kyamatu Ward (approximate coordinates)
        map = L.map(containerId).setView([-1.2921, 36.8219], 13);
        
        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);
        
        // Add custom controls
        addMapControls();
        
        // Load issues data
        loadIssuesData();
    }
    
    /**
     * Load issues data from API
     */
    async function loadIssuesData() {
        try {
            const response = await fetch('/api/issues?includeLocation=true', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to load issues');
            
            issuesData = await response.json();
            plotIssuesOnMap(issuesData);
        } catch (error) {
            console.error('Error loading issues:', error);
            showError('Failed to load issue locations');
        }
    }
    
    /**
     * Plot issues on map
     */
    function plotIssuesOnMap(issues) {
        // Clear existing markers
        clearMarkers();
        
        // Filter issues with valid coordinates
        const issuesWithLocation = issues.filter(issue => 
            issue.location && 
            issue.location.latitude && 
            issue.location.longitude
        );
        
        if (issuesWithLocation.length === 0) {
            showInfo('No issues with location data found');
            return;
        }
        
        // Create markers
        issuesWithLocation.forEach(issue => {
            const marker = createMarker(issue);
            markers.push(marker);
            marker.addTo(map);
        });
        
        // Fit map to show all markers
        if (markers.length > 0) {
            const group = L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
        }
        
        updateMapStats();
    }
    
    /**
     * Create marker for issue
     */
    function createMarker(issue) {
        const { latitude, longitude } = issue.location;
        const status = issue.status || 'Pending';
        
        // Get marker color based on status
        const color = getStatusColor(status);
        
        // Create custom icon
        const icon = L.divIcon({
            className: 'custom-map-marker',
            html: `
                <div style="
                    background: ${color};
                    width: 30px;
                    height: 30px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                ">
                    <div style="
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 12px;
                        font-weight: bold;
                        transform: rotate(45deg);
                    ">
                        ${getPriorityIcon(issue.priority)}
                    </div>
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });
        
        // Create marker
        const marker = L.marker([latitude, longitude], { icon });
        
        // Create popup content
        const popupContent = `
            <div class="map-marker-popup" style="min-width: 200px;">
                <div class="map-marker-title">${escapeHtml(issue.title || issue.type)}</div>
                
                <div class="map-marker-info">
                    <strong>Status:</strong> 
                    <span style="color: ${color}; font-weight: 600;">${status}</span>
                </div>
                
                <div class="map-marker-info">
                    <strong>Priority:</strong> 
                    <span style="color: ${getPriorityColor(issue.priority)}; font-weight: 600;">
                        ${issue.priority || 'Normal'}
                    </span>
                </div>
                
                ${issue.area ? `
                    <div class="map-marker-info">
                        <strong>Area:</strong> ${escapeHtml(issue.area)}
                    </div>
                ` : ''}
                
                ${issue.description ? `
                    <div class="map-marker-info" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                        ${escapeHtml(issue.description).substring(0, 100)}${issue.description.length > 100 ? '...' : ''}
                    </div>
                ` : ''}
                
                <div class="map-marker-info" style="margin-top: 8px;">
                    <strong>Reported:</strong> ${formatDate(issue.createdAt)}
                </div>
                
                <button onclick="IssueMap.viewIssueDetails('${issue._id}')" 
                        style="
                            width: 100%;
                            margin-top: 12px;
                            padding: 8px;
                            background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-weight: 600;
                            cursor: pointer;
                        ">
                    View Details
                </button>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Store issue data with marker
        marker.issueData = issue;
        
        return marker;
    }
    
    /**
     * Add custom map controls
     */
    function addMapControls() {
        // Legend control
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'map-legend');
            div.innerHTML = `
                <div class="map-legend-title">Issue Status</div>
                <div class="map-legend-item">
                    <span class="map-legend-icon" style="background: #ef4444;"></span>
                    Pending
                </div>
                <div class="map-legend-item">
                    <span class="map-legend-icon" style="background: #f59e0b;"></span>
                    In Progress
                </div>
                <div class="map-legend-item">
                    <span class="map-legend-icon" style="background: #10b981;"></span>
                    Resolved
                </div>
                <div class="map-legend-item">
                    <span class="map-legend-icon" style="background: #6b7280;"></span>
                    Closed
                </div>
            `;
            return div;
        };
        legend.addTo(map);
        
        // Stats control
        const stats = L.control({ position: 'topleft' });
        stats.onAdd = function() {
            const div = L.DomUtil.create('div', 'map-stats-control');
            div.id = 'mapStatsControl';
            div.innerHTML = `
                <div style="padding: 12px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                    <div style="font-weight: 700; margin-bottom: 8px;">Map Statistics</div>
                    <div id="mapStatsContent">Loading...</div>
                </div>
            `;
            return div;
        };
        stats.addTo(map);
    }
    
    /**
     * Update map statistics
     */
    function updateMapStats() {
        const statsContent = document.getElementById('mapStatsContent');
        if (!statsContent) return;
        
        const total = markers.length;
        const pending = markers.filter(m => m.issueData.status === 'Pending').length;
        const inProgress = markers.filter(m => m.issueData.status === 'In Progress').length;
        const resolved = markers.filter(m => m.issueData.status === 'Resolved').length;
        
        statsContent.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px;">
                <div>
                    <div style="color: #6b7280;">Total</div>
                    <div style="font-weight: 700; font-size: 18px; color: #7c3aed;">${total}</div>
                </div>
                <div>
                    <div style="color: #6b7280;">Pending</div>
                    <div style="font-weight: 700; font-size: 18px; color: #ef4444;">${pending}</div>
                </div>
                <div>
                    <div style="color: #6b7280;">In Progress</div>
                    <div style="font-weight: 700; font-size: 18px; color: #f59e0b;">${inProgress}</div>
                </div>
                <div>
                    <div style="color: #6b7280;">Resolved</div>
                    <div style="font-weight: 700; font-size: 18px; color: #10b981;">${resolved}</div>
                </div>
            </div>
        `;
    }
    
    /**
     * Filter markers by status
     */
    function filterByStatus(status) {
        clearMarkers();
        
        const filtered = status === 'all' 
            ? issuesData 
            : issuesData.filter(issue => issue.status === status);
            
        plotIssuesOnMap(filtered);
    }
    
    /**
     * Filter markers by priority
     */
    function filterByPriority(priority) {
        clearMarkers();
        
        const filtered = priority === 'all'
            ? issuesData
            : issuesData.filter(issue => issue.priority === priority);
            
        plotIssuesOnMap(filtered);
    }
    
    /**
     * Clear all markers
     */
    function clearMarkers() {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
    }
    
    /**
     * View issue details
     */
    function viewIssueDetails(issueId) {
        // Navigate to issue in main dashboard
        if (window.DashboardEnhancements?.Sidebar) {
            window.DashboardEnhancements.Sidebar.navigate('issues');
        }
        
        // Highlight the issue in the table
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
    
    // Helper functions
    function getStatusColor(status) {
        const colors = {
            'Pending': '#ef4444',
            'In Progress': '#f59e0b',
            'Resolved': '#10b981',
            'Closed': '#6b7280'
        };
        return colors[status] || '#6b7280';
    }
    
    function getPriorityColor(priority) {
        const colors = {
            'High': '#dc2626',
            'Medium': '#f59e0b',
            'Low': '#10b981',
            'Normal': '#6b7280'
        };
        return colors[priority] || '#6b7280';
    }
    
    function getPriorityIcon(priority) {
        const icons = {
            'High': '!',
            'Medium': '●',
            'Low': '○',
            'Normal': '●'
        };
        return icons[priority] || '●';
    }
    
    function formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleDateString();
    }
    
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text || '').replace(/[&<>"']/g, m => map[m]);
    }
    
    function showError(message) {
        if (window.DashboardEnhancements?.Notifications) {
            window.DashboardEnhancements.Notifications.add({
                title: 'Error',
                message,
                type: 'error'
            });
        } else {
            console.error(message);
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
            console.info(message);
        }
    }
    
    // Public API
    return {
        init,
        filterByStatus,
        filterByPriority,
        viewIssueDetails,
        refresh: loadIssuesData
    };
})();

// Auto-initialize if map container exists
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('issueMap')) {
            IssueMap.init();
        }
    });
} else {
    if (document.getElementById('issueMap')) {
        IssueMap.init();
    }
}
