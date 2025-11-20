/**
 * VOO Kyamatu Ward Dashboard - Analytics & Charts Module
 * Chart.js integration with animated counters and visualizations
 */

// ========================================
// ANIMATED COUNTERS
// ========================================
const AnimatedCounter = {
    animate(element, start, end, duration = 2000, prefix = '', suffix = '') {
        if (!element) return;
        
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = prefix + Math.round(current).toLocaleString() + suffix;
        }, 16);
    },
    
    initAll() {
        document.querySelectorAll('[data-counter]').forEach(el => {
            const target = parseInt(el.dataset.counter);
            const prefix = el.dataset.prefix || '';
            const suffix = el.dataset.suffix || '';
            this.animate(el, 0, target, 2000, prefix, suffix);
        });
    }
};

// ========================================
// CHART CONFIGURATIONS
// ========================================
const ChartConfig = {
    defaultColors: [
        'rgba(124, 58, 237, 0.8)',   // Purple
        'rgba(236, 72, 153, 0.8)',    // Pink
        'rgba(251, 146, 60, 0.8)',    // Orange
        'rgba(34, 197, 94, 0.8)',     // Green
        'rgba(59, 130, 246, 0.8)',    // Blue
        'rgba(245, 158, 11, 0.8)',    // Amber
        'rgba(239, 68, 68, 0.8)',     // Red
        'rgba(20, 184, 166, 0.8)'     // Teal
    ],
    
    defaultOptions: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 15,
                    font: {
                        size: 13,
                        family: "'Inter', sans-serif",
                        weight: 500
                    },
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(31, 41, 55, 0.95)',
                padding: 12,
                borderColor: 'rgba(124, 58, 237, 0.5)',
                borderWidth: 1,
                titleFont: {
                    size: 14,
                    weight: 600
                },
                bodyFont: {
                    size: 13
                },
                displayColors: true,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        label += context.parsed.toLocaleString();
                        if (context.dataset.percentage) {
                            label += ' (' + context.dataset.percentage[context.dataIndex] + '%)';
                        }
                        return label;
                    }
                }
            }
        },
        animation: {
            duration: 1500,
            easing: 'easeInOutQuart'
        }
    }
};

// ========================================
// PIE CHART - Issue Status Distribution
// ========================================
const StatusPieChart = {
    chart: null,
    
    init(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        const statusData = this.processData(data);
        
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: statusData.labels,
                datasets: [{
                    label: 'Issues by Status',
                    data: statusData.values,
                    backgroundColor: statusData.colors,
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 3,
                    hoverOffset: 15,
                    percentage: statusData.percentages
                }]
            },
            options: {
                ...ChartConfig.defaultOptions,
                cutout: '60%',
                plugins: {
                    ...ChartConfig.defaultOptions.plugins,
                    legend: {
                        ...ChartConfig.defaultOptions.plugins.legend,
                        position: 'right'
                    },
                    tooltip: {
                        ...ChartConfig.defaultOptions.plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },
    
    processData(issues) {
        const statusCount = {
            'Pending': 0,
            'In Progress': 0,
            'Resolved': 0,
            'Closed': 0
        };
        
        issues.forEach(issue => {
            const status = issue.status || 'Pending';
            const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
            if (statusCount[normalizedStatus] !== undefined) {
                statusCount[normalizedStatus]++;
            } else {
                statusCount[normalizedStatus] = 1;
            }
        });
        
        const total = Object.values(statusCount).reduce((a, b) => a + b, 0);
        
        return {
            labels: Object.keys(statusCount),
            values: Object.values(statusCount),
            percentages: Object.values(statusCount).map(v => ((v / total) * 100).toFixed(1)),
            colors: [
                'rgba(251, 146, 60, 0.8)',    // Pending - Orange
                'rgba(59, 130, 246, 0.8)',    // In Progress - Blue
                'rgba(34, 197, 94, 0.8)',     // Resolved - Green
                'rgba(156, 163, 175, 0.8)'    // Closed - Gray
            ]
        };
    },
    
    update(data) {
        const statusData = this.processData(data);
        if (this.chart) {
            this.chart.data.labels = statusData.labels;
            this.chart.data.datasets[0].data = statusData.values;
            this.chart.data.datasets[0].percentage = statusData.percentages;
            this.chart.update();
        }
    }
};

// ========================================
// LINE CHART - Issues Over Time
// ========================================
const IssuesTimelineChart = {
    chart: null,
    
    init(canvasId, data, days = 30) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        const timelineData = this.processData(data, days);
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timelineData.labels,
                datasets: [
                    {
                        label: 'New Issues',
                        data: timelineData.newIssues,
                        borderColor: 'rgba(124, 58, 237, 1)',
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(124, 58, 237, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    },
                    {
                        label: 'Resolved Issues',
                        data: timelineData.resolvedIssues,
                        borderColor: 'rgba(34, 197, 94, 1)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(34, 197, 94, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }
                ]
            },
            options: {
                ...ChartConfig.defaultOptions,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    },
    
    processData(issues, days) {
        const today = new Date();
        const labels = [];
        const newIssues = [];
        const resolvedIssues = [];
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            const dayNewIssues = issues.filter(issue => {
                const issueDate = new Date(issue.created_at).toISOString().split('T')[0];
                return issueDate === dateStr;
            }).length;
            
            const dayResolvedIssues = issues.filter(issue => {
                if (issue.status !== 'resolved' && issue.status !== 'Resolved') return false;
                const resolvedDate = new Date(issue.updated_at || issue.created_at).toISOString().split('T')[0];
                return resolvedDate === dateStr;
            }).length;
            
            newIssues.push(dayNewIssues);
            resolvedIssues.push(dayResolvedIssues);
        }
        
        return { labels, newIssues, resolvedIssues };
    },
    
    update(data, days = 30) {
        const timelineData = this.processData(data, days);
        if (this.chart) {
            this.chart.data.labels = timelineData.labels;
            this.chart.data.datasets[0].data = timelineData.newIssues;
            this.chart.data.datasets[1].data = timelineData.resolvedIssues;
            this.chart.update();
        }
    }
};

// ========================================
// BAR CHART - Bursary Applications by Status
// ========================================
const BursaryBarChart = {
    chart: null,
    
    init(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        const bursaryData = this.processData(data);
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: bursaryData.labels,
                datasets: [{
                    label: 'Applications',
                    data: bursaryData.values,
                    backgroundColor: bursaryData.colors,
                    borderColor: bursaryData.colors.map(c => c.replace('0.8', '1')),
                    borderWidth: 2,
                    borderRadius: 8,
                    barThickness: 40
                }]
            },
            options: {
                ...ChartConfig.defaultOptions,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: { size: 12 }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    },
    
    processData(applications) {
        const statusCount = {
            'Pending': 0,
            'Approved': 0,
            'Rejected': 0,
            'Received': 0
        };
        
        applications.forEach(app => {
            const status = (app.status || 'Pending').charAt(0).toUpperCase() + (app.status || 'Pending').slice(1);
            if (statusCount[status] !== undefined) {
                statusCount[status]++;
            } else {
                statusCount[status] = 1;
            }
        });
        
        return {
            labels: Object.keys(statusCount),
            values: Object.values(statusCount),
            colors: [
                'rgba(251, 146, 60, 0.8)',   // Pending
                'rgba(34, 197, 94, 0.8)',    // Approved
                'rgba(239, 68, 68, 0.8)',    // Rejected
                'rgba(59, 130, 246, 0.8)'    // Received
            ]
        };
    },
    
    update(data) {
        const bursaryData = this.processData(data);
        if (this.chart) {
            this.chart.data.labels = bursaryData.labels;
            this.chart.data.datasets[0].data = bursaryData.values;
            this.chart.update();
        }
    }
};

// ========================================
// ANALYTICS STATS CALCULATOR
// ========================================
const AnalyticsStats = {
    calculateIssueStats(issues) {
        const total = issues.length;
        const pending = issues.filter(i => i.status === 'pending' || i.status === 'Pending').length;
        const inProgress = issues.filter(i => i.status === 'in_progress' || i.status === 'In Progress').length;
        const resolved = issues.filter(i => i.status === 'resolved' || i.status === 'Resolved').length;
        
        // Calculate average resolution time
        const resolvedWithTime = issues.filter(i => {
            return (i.status === 'resolved' || i.status === 'Resolved') && i.created_at && i.updated_at;
        });
        
        let avgResolutionTime = 0;
        if (resolvedWithTime.length > 0) {
            const totalTime = resolvedWithTime.reduce((sum, issue) => {
                const created = new Date(issue.created_at);
                const updated = new Date(issue.updated_at);
                return sum + (updated - created);
            }, 0);
            avgResolutionTime = Math.round((totalTime / resolvedWithTime.length) / (1000 * 60 * 60 * 24)); // days
        }
        
        return {
            total,
            pending,
            inProgress,
            resolved,
            avgResolutionTime,
            resolutionRate: total > 0 ? ((resolved / total) * 100).toFixed(1) : 0
        };
    },
    
    calculateBursaryStats(applications) {
        const total = applications.length;
        const pending = applications.filter(a => a.status === 'pending' || a.status === 'Pending').length;
        const approved = applications.filter(a => a.status === 'approved' || a.status === 'Approved').length;
        const rejected = applications.filter(a => a.status === 'rejected' || a.status === 'Rejected').length;
        
        const totalAmount = applications.reduce((sum, app) => sum + (parseFloat(app.fee_balance) || 0), 0);
        const approvedAmount = applications
            .filter(a => a.status === 'approved' || a.status === 'Approved')
            .reduce((sum, app) => sum + (parseFloat(app.fee_balance) || 0), 0);
        
        return {
            total,
            pending,
            approved,
            rejected,
            totalAmount,
            approvedAmount,
            approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : 0
        };
    }
};

// ========================================
// DATE RANGE FILTER
// ========================================
const DateRangeFilter = {
    currentRange: 'all',
    customStart: null,
    customEnd: null,
    
    init(onFilterChange) {
        this.onFilterChange = onFilterChange;
        this.render();
        this.attachEvents();
    },
    
    render() {
        const container = document.getElementById('dateRangeFilter');
        if (!container) return;
        
        container.innerHTML = `
            <div class="date-range-filter">
                <select id="dateRangeSelect" class="filter-dropdown">
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="quarter">Last 90 Days</option>
                    <option value="custom">Custom Range</option>
                </select>
                <div id="customDateRange" style="display:none; margin-left:12px; display:flex; gap:8px;">
                    <input type="date" id="startDate" class="date-input" />
                    <span style="line-height:40px;">to</span>
                    <input type="date" id="endDate" class="date-input" />
                    <button onclick="DateRangeFilter.applyCustomRange()" class="btn-sm btn-primary">Apply</button>
                </div>
            </div>
        `;
    },
    
    attachEvents() {
        const select = document.getElementById('dateRangeSelect');
        const customDiv = document.getElementById('customDateRange');
        
        select?.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value === 'custom') {
                customDiv.style.display = 'flex';
            } else {
                customDiv.style.display = 'none';
                this.currentRange = value;
                this.filterData(value);
            }
        });
    },
    
    filterData(range) {
        const now = new Date();
        let startDate = null;
        
        switch(range) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setDate(now.getDate() - 30));
                break;
            case 'quarter':
                startDate = new Date(now.setDate(now.getDate() - 90));
                break;
            default:
                startDate = null;
        }
        
        if (this.onFilterChange) {
            this.onFilterChange(startDate, new Date());
        }
    },
    
    applyCustomRange() {
        const start = document.getElementById('startDate')?.value;
        const end = document.getElementById('endDate')?.value;
        
        if (!start || !end) {
            alert('Please select both start and end dates');
            return;
        }
        
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (startDate > endDate) {
            alert('Start date must be before end date');
            return;
        }
        
        this.customStart = startDate;
        this.customEnd = endDate;
        
        if (this.onFilterChange) {
            this.onFilterChange(startDate, endDate);
        }
    }
};

// ========================================
// EXPORT FOR GLOBAL USE
// ========================================
window.AnalyticsCharts = {
    AnimatedCounter,
    StatusPieChart,
    IssuesTimelineChart,
    BursaryBarChart,
    AnalyticsStats,
    DateRangeFilter
};
