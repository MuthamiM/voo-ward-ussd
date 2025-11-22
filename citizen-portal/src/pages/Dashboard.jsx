import { Link } from 'react-router-dom';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="container">
                    <div className="header-content">
                        <div>
                            <h1>🏛️ Kyamatu Ward</h1>
                            <p>Welcome, {user?.phoneNumber || 'Citizen'}</p>
                        </div>
                        <button onClick={onLogout} className="btn btn-secondary">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="dashboard-main">
                <div className="container">
                    <div className="dashboard-grid">
                        <Link to="/report-issue" className="dashboard-card glass-card">
                            <div className="card-icon">📋</div>
                            <h3>Report Issue</h3>
                            <p>Report roads, water, security, or health issues</p>
                        </Link>

                        <Link to="/my-issues" className="dashboard-card glass-card">
                            <div className="card-icon">📊</div>
                            <h3>My Issues</h3>
                            <p>Track status of your reported issues</p>
                        </Link>

                        <Link to="/bursary-status" className="dashboard-card glass-card">
                            <div className="card-icon">🎓</div>
                            <h3>Bursary Status</h3>
                            <p>Check your bursary application status</p>
                        </Link>

                        <div className="dashboard-card glass-card">
                            <div className="card-icon">📢</div>
                            <h3>Announcements</h3>
                            <p>View latest ward announcements</p>
                        </div>
                    </div>

                    <div className="info-section">
                        <div className="card">
                            <h3>📞 Contact Information</h3>
                            <p><strong>Ward Office:</strong> +254 XXX XXX XXX</p>
                            <p><strong>Email:</strong> kyamatu@ward.go.ke</p>
                            <p><strong>Office Hours:</strong> Mon-Fri, 8:00 AM - 5:00 PM</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
