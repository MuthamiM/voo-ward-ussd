import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ReportIssue.css';

function ReportIssue({ user, apiUrl }) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        category: '',
        description: '',
        location: ''
    });
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [ticketNumber, setTicketNumber] = useState('');

    const categories = [
        'Roads & Infrastructure',
        'Water & Sanitation',
        'Security',
        'Health Services',
        'Education',
        'Electricity',
        'Waste Management',
        'Other'
    ];

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = localStorage.getItem('citizen_token');

            // Create FormData for file upload
            const submitData = new FormData();
            submitData.append('category', formData.category);
            submitData.append('description', formData.description);
            submitData.append('location', formData.location);
            submitData.append('phoneNumber', user.phoneNumber);
            if (photo) {
                submitData.append('photo', photo);
            }

            const response = await fetch(`${apiUrl}/api/citizen/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: submitData
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(true);
                setTicketNumber(data.ticket);
                setFormData({ category: '', description: '', location: '' });
                setPhoto(null);
                setPhotoPreview(null);
            } else {
                alert(data.error || 'Failed to submit issue');
            }
        } catch (err) {
            alert('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="report-container">
                <div className="container">
                    <div className="success-card glass-card">
                        <div className="success-icon">✅</div>
                        <h2>Issue Reported Successfully!</h2>
                        <p>Your issue has been recorded.</p>
                        <div className="ticket-box">
                            <p>Ticket Number:</p>
                            <h3>{ticketNumber}</h3>
                        </div>
                        <p className="success-message">
                            You will receive updates via SMS and WhatsApp.
                        </p>
                        <div className="success-actions">
                            <button
                                onClick={() => navigate('/my-issues')}
                                className="btn btn-primary"
                            >
                                View My Issues
                            </button>
                            <button
                                onClick={() => setSuccess(false)}
                                className="btn btn-secondary"
                            >
                                Report Another Issue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="report-container">
            <div className="container">
                <div className="page-header">
                    <button onClick={() => navigate('/dashboard')} className="back-btn">
                        ← Back
                    </button>
                    <h2>📋 Report an Issue</h2>
                </div>

                <div className="card">
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="category">Category *</label>
                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Select category</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="description">Description *</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows="5"
                                placeholder="Describe the issue in detail..."
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="location">Location *</label>
                            <input
                                type="text"
                                id="location"
                                name="location"
                                value={formData.location}
                                onChange={handleInputChange}
                                placeholder="e.g., Near Chief's Office, Main Street"
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="photo">Photo (Optional)</label>
                            <input
                                type="file"
                                id="photo"
                                accept="image/*"
                                capture="environment"
                                onChange={handlePhotoChange}
                            />
                            {photoPreview && (
                                <div className="photo-preview">
                                    <img src={photoPreview} alt="Preview" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPhoto(null);
                                            setPhotoPreview(null);
                                        }}
                                        className="remove-photo"
                                    >
                                        ✕ Remove
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Submitting...' : 'Submit Issue'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ReportIssue;
