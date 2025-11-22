import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MyIssues.css';

function MyIssues({ user, apiUrl }) {
    const navigate = useNavigate();
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, open, in_progress, resolved

    useEffect(() => {
        fetchIssues();
    }, []);

    const fetchIssues = async () => {
        try {
            const token = localStorage.getItem('citizen_token');
            const response = await fetch(`${apiUrl}/api/citizen/issues`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setIssues(data);
            }
        } catch (err) {
            console.error('Failed to fetch issues:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredIssues = issues.filter(issue => {
        if (filter === 'all') return true;
        return issue.status === filter;
    });

    const getStatusBadgeClass = (status) => {
        const classes = {
            'open': 'badge-open',
            'in_progress': 'badge-in-progress',
            'resolved': 'badge-resolved',
            'closed': 'badge-closed'
        };
        return classes[status] || 'badge-open';
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="issues-container">
                <div className="container">
                    <div className="loading-screen">
                        <div className="spinner"></div>
                        <p>Loading your issues...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="issues-container">
            <div className="container">
                <div className="page-header">
                    <button onClick={() => navigate('/dashboard')} className="back-btn">
                        ← Back
                    </button>
                    <h2>📊 My Issues</h2>
                </div>

                <div className="filter-bar card">
                    <button
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All ({issues.length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'open' ? 'active' : ''}`}
                        onClick={() => setFilter('open')}
                    >
                        Open ({issues.filter(i => i.status === 'open').length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
                        onClick={() => setFilter('in_progress')}
                    >
                        In Progress ({issues.filter(i => i.status === 'in_progress').length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'resolved' ? 'active' : ''}`}
                        onClick={() => setFilter('resolved')}
                    >
                        Resolved ({issues.filter(i => i.status === 'resolved').length})
                    </button>
                </div>

                {filteredIssues.length === 0 ? (
                    <div className="empty-state card">
                        <div className="empty-icon">📭</div>
                        <h3>No issues found</h3>
                        <p>
                            {filter === 'all'
                                ? "You haven't reported any issues yet."
                                : `No ${filter.replace('_', ' ')} issues.`}
                        </p>
                        <button
                            onClick={() => navigate('/report-issue')}
                            className="btn btn-primary"
                        >
                            Report an Issue
                        </button>
                    </div>
                ) : (
                    <div className="issues-list">
                        {filteredIssues.map(issue => (
                            <div key={issue.id} className="issue-card card">
                                <div className="issue-header">
                                    <div>
                                        <h3>{issue.ticket}</h3>
                                        <span className={`badge ${getStatusBadgeClass(issue.status)}`}>
                                            {issue.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <span className="issue-date">{formatDate(issue.created_at)}</span>
                                </div>

                                <div className="issue-body">
                                    <p className="issue-category">📋 {issue.category}</p>
                                    <p className="issue-description">{issue.message}</p>
                                    {issue.location && (
                                        <p className="issue-location">📍 {issue.location}</p>
                                    )}
                                    {issue.photo_url && (
                                        <img
                                            src={issue.photo_url}
                                            alt="Issue"
                                            className="issue-photo"
                                        />
                                    )}
                                </div>

                                {issue.comments && issue.comments.length > 0 && (
                                    <div className="issue-comments">
                                        <h4>Updates:</h4>
                                        {issue.comments.map((comment, idx) => (
                                            <p key={idx} className="comment">{comment}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MyIssues;
