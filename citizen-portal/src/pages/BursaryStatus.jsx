import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './BursaryStatus.css';

function BursaryStatus({ user, apiUrl }) {
    const navigate = useNavigate();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchApplications();
    }, []);

    const fetchApplications = async () => {
        try {
            const token = localStorage.getItem('citizen_token');
            const response = await fetch(`${apiUrl}/api/citizen/bursaries`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setApplications(data);
            }
        } catch (err) {
            console.error('Failed to fetch bursary applications:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        const classes = {
            'pending': 'badge-open',
            'approved': 'badge-resolved',
            'rejected': 'badge-closed',
            'disbursed': 'badge-in-progress'
        };
        return classes[status] || 'badge-open';
    };

    const getStatusIcon = (status) => {
        const icons = {
            'pending': '⏳',
            'approved': '✅',
            'rejected': '❌',
            'disbursed': '💰'
        };
        return icons[status] || '📄';
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES'
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="bursary-container">
                <div className="container">
                    <div className="loading-screen">
                        <div className="spinner"></div>
                        <p>Loading bursary applications...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bursary-container">
            <div className="container">
                <div className="page-header">
                    <button onClick={() => navigate('/dashboard')} className="back-btn">
                        ← Back
                    </button>
                    <h2>🎓 Bursary Status</h2>
                </div>

                {applications.length === 0 ? (
                    <div className="empty-state card">
                        <div className="empty-icon">📚</div>
                        <h3>No Bursary Applications</h3>
                        <p>You haven't applied for any bursaries yet.</p>
                        <div className="info-box">
                            <h4>How to Apply:</h4>
                            <ol>
                                <li>Dial *340*75# on your phone</li>
                                <li>Select "Apply for Bursary"</li>
                                <li>Follow the prompts to submit your application</li>
                                <li>Check status here anytime</li>
                            </ol>
                        </div>
                    </div>
                ) : (
                    <div className="applications-list">
                        {applications.map(app => (
                            <div key={app.id} className="application-card card">
                                <div className="app-header">
                                    <div>
                                        <h3>{app.reference}</h3>
                                        <span className={`badge ${getStatusBadgeClass(app.status)}`}>
                                            {getStatusIcon(app.status)} {app.status}
                                        </span>
                                    </div>
                                    <span className="app-date">{formatDate(app.created_at)}</span>
                                </div>

                                <div className="app-body">
                                    <div className="app-detail">
                                        <span className="label">Student Name:</span>
                                        <span className="value">{app.student_name}</span>
                                    </div>
                                    <div className="app-detail">
                                        <span className="label">Institution:</span>
                                        <span className="value">{app.institution}</span>
                                    </div>
                                    <div className="app-detail">
                                        <span className="label">Amount Requested:</span>
                                        <span className="value amount">{formatCurrency(app.amount)}</span>
                                    </div>
                                    {app.approved_amount && (
                                        <div className="app-detail">
                                            <span className="label">Approved Amount:</span>
                                            <span className="value amount approved">
                                                {formatCurrency(app.approved_amount)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {app.status === 'pending' && (
                                    <div className="status-message pending">
                                        <p>⏳ Your application is under review. You will be notified once a decision is made.</p>
                                    </div>
                                )}

                                {app.status === 'approved' && (
                                    <div className="status-message approved">
                                        <p>✅ Congratulations! Your bursary has been approved. Disbursement is in progress.</p>
                                    </div>
                                )}

                                {app.status === 'disbursed' && (
                                    <div className="status-message disbursed">
                                        <p>💰 Your bursary has been disbursed. Check your M-Pesa for confirmation.</p>
                                    </div>
                                )}

                                {app.status === 'rejected' && app.rejection_reason && (
                                    <div className="status-message rejected">
                                        <p><strong>Reason:</strong> {app.rejection_reason}</p>
                                        <p>You may reapply in the next application cycle.</p>
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

export default BursaryStatus;
