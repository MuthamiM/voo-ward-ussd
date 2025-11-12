// TEXTBOOK MANAGEMENT DASHBOARD - REACT COMPONENT
// Add this tab to your admin dashboard

import React, { useState, useEffect } from 'react';
import './TextbookDashboard.css';

function TextbookDashboard({ token }) {
  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [shortages, setShortages] = useState([]);
  const [activeTab, setActiveTab] = useState('requests');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = 'http://127.0.0.1:4000';

  // Fetch all data
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch textbook requests
      const reqResponse = await fetch(`${API_URL}/admin/textbooks/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const reqData = await reqResponse.json();
      setRequests(reqData);

      // Fetch inventory
      const invResponse = await fetch(`${API_URL}/admin/textbooks/inventory`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const invData = await invResponse.json();
      setInventory(invData);

      // Fetch shortage reports
      const shortResponse = await fetch(`${API_URL}/admin/textbooks/shortages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const shortData = await shortResponse.json();
      setShortages(shortData);

      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching textbook data:', err);
      setError('Failed to load textbook data');
      setLoading(false);
    }
  };

  // Update request status
  const updateRequestStatus = async (id, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/admin/textbooks/requests/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          dispatch_date: newStatus === 'dispatched' ? new Date().toISOString() : null,
          delivery_date: newStatus === 'delivered' ? new Date().toISOString() : null
        })
      });

      if (response.ok) {
        fetchData(); // Refresh data
        showToast(`Request updated to ${newStatus}`, 'success');
      } else {
        showToast('Failed to update request', 'error');
      }
    } catch (err) {
      console.error('Error updating request:', err);
      showToast('Error updating request', 'error');
    }
  };

  // small toast helper for feedback
  function showToast(message, type = 'info', ttl = 4000) {
    try {
      const containerId = 'vk-tb-toast';
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.position = 'fixed';
        container.style.right = '18px';
        container.style.top = '18px';
        container.style.zIndex = 99999;
        document.body.appendChild(container);
      }
      const el = document.createElement('div');
      el.textContent = message;
      el.style.padding = '8px 12px';
      el.style.marginTop = '8px';
      el.style.borderRadius = '6px';
      el.style.color = '#fff';
      el.style.fontSize = '13px';
      el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
      el.style.maxWidth = '320px';
      el.style.wordBreak = 'break-word';
      el.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb';
      container.appendChild(el);
      setTimeout(() => { try { container.removeChild(el); } catch (e) {} }, ttl);
    } catch (e) { if (type === 'error') console.error(message); else console.log(message); }
  }

  // Statistics calculations
  const stats = {
    totalRequests: requests.length,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
    dispatchedRequests: requests.filter(r => r.status === 'dispatched').length,
    deliveredRequests: requests.filter(r => r.status === 'delivered').length,
    totalShortages: shortages.length,
    studentsAffected: shortages.reduce((sum, s) => sum + s.students_affected, 0),
    totalInventory: inventory.reduce((sum, i) => sum + i.total_quantity, 0),
    availableBooks: inventory.reduce((sum, i) => sum + i.available_quantity, 0)
  };

  if (loading && requests.length === 0) {
    return (
      <div className="textbook-dashboard loading">
        <div className="spinner"></div>
        <p>Loading textbook data...</p>
      </div>
    );
  }

  return (
    <div className="textbook-dashboard">
      {/* Header with Statistics */}
      <div className="dashboard-header">
        <h2>📚 Textbook Distribution System</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalRequests}</div>
            <div className="stat-label">Total Requests</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-value">{stats.pendingRequests}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card dispatched">
            <div className="stat-value">{stats.dispatchedRequests}</div>
            <div className="stat-label">Dispatched</div>
          </div>
          <div className="stat-card delivered">
            <div className="stat-value">{stats.deliveredRequests}</div>
            <div className="stat-label">Delivered</div>
          </div>
          <div className="stat-card shortage">
            <div className="stat-value">{stats.totalShortages}</div>
            <div className="stat-label">Shortages</div>
          </div>
          <div className="stat-card students">
            <div className="stat-value">{stats.studentsAffected}</div>
            <div className="stat-label">Students Affected</div>
          </div>
          <div className="stat-card inventory">
            <div className="stat-value">{stats.availableBooks}/{stats.totalInventory}</div>
            <div className="stat-label">Books Available</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={activeTab === 'requests' ? 'active' : ''}
          onClick={() => setActiveTab('requests')}
        >
          📝 Requests ({stats.totalRequests})
        </button>
        <button 
          className={activeTab === 'inventory' ? 'active' : ''}
          onClick={() => setActiveTab('inventory')}
        >
          📦 Inventory ({inventory.length})
        </button>
        <button 
          className={activeTab === 'shortages' ? 'active' : ''}
          onClick={() => setActiveTab('shortages')}
        >
          ⚠️ Shortages ({stats.totalShortages})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="requests-section">
            <div className="section-header">
              <h3>Textbook Requests</h3>
              <button className="refresh-btn" onClick={fetchData}>
                🔄 Refresh
              </button>
            </div>
            
            {requests.length === 0 ? (
              <div className="empty-state">
                <p>No textbook requests yet</p>
              </div>
            ) : (
              <div className="requests-table">
                <table>
                  <thead>
                    <tr>
                      <th>Tracking #</th>
                      <th>Student</th>
                      <th>School</th>
                      <th>Book</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(req => (
                      <tr key={req.id} className={`status-${req.status}`}>
                        <td className="tracking">{req.tracking_number}</td>
                        <td>
                          <div className="student-info">
                            <strong>{req.student_name}</strong>
                            <small>{req.phone_number}</small>
                          </div>
                        </td>
                        <td>{req.school_name}</td>
                        <td>{req.book_title}</td>
                        <td>{req.class_level}</td>
                        <td>{req.subject}</td>
                        <td>
                          <span className={`status-badge ${req.status}`}>
                            {req.status}
                          </span>
                        </td>
                        <td>{new Date(req.request_date).toLocaleDateString()}</td>
                        <td>
                          <div className="action-buttons">
                            {req.status === 'pending' && (
                              <>
                                <button 
                                  className="btn-approve"
                                  onClick={() => updateRequestStatus(req.id, 'approved')}
                                >
                                  ✓ Approve
                                </button>
                                <button 
                                  className="btn-reject"
                                  onClick={() => updateRequestStatus(req.id, 'rejected')}
                                >
                                  ✗ Reject
                                </button>
                              </>
                            )}
                            {req.status === 'approved' && (
                              <button 
                                className="btn-dispatch"
                                onClick={() => updateRequestStatus(req.id, 'dispatched')}
                              >
                                📦 Dispatch
                              </button>
                            )}
                            {req.status === 'dispatched' && (
                              <button 
                                className="btn-deliver"
                                onClick={() => updateRequestStatus(req.id, 'delivered')}
                              >
                                ✅ Mark Delivered
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="inventory-section">
            <div className="section-header">
              <h3>Book Inventory</h3>
            </div>
            
            {inventory.length === 0 ? (
              <div className="empty-state">
                <p>No inventory data</p>
              </div>
            ) : (
              <div className="inventory-grid">
                {inventory.map(book => {
                  const availabilityPercent = Math.round((book.available_quantity / book.total_quantity) * 100);
                  const isLow = availabilityPercent < 20;
                  
                  return (
                    <div key={book.id} className={`inventory-card ${isLow ? 'low-stock' : ''}`}>
                      <div className="book-header">
                        <h4>{book.book_title}</h4>
                        {isLow && <span className="low-stock-badge">⚠️ Low Stock</span>}
                      </div>
                      <div className="book-details">
                        <p><strong>Subject:</strong> {book.subject}</p>
                        <p><strong>Class:</strong> {book.class_level}</p>
                        <p><strong>Publisher:</strong> {book.publisher}</p>
                      </div>
                      <div className="book-quantities">
                        <div className="quantity-bar">
                          <div 
                            className="quantity-fill" 
                            style={{width: `${availabilityPercent}%`}}
                          ></div>
                        </div>
                        <div className="quantity-stats">
                          <span className="available">{book.available_quantity} Available</span>
                          <span className="reserved">{book.reserved_quantity} Reserved</span>
                          <span className="damaged">{book.damaged_quantity} Damaged</span>
                          <span className="total">{book.total_quantity} Total</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SHORTAGES TAB */}
        {activeTab === 'shortages' && (
          <div className="shortages-section">
            <div className="section-header">
              <h3>Book Shortages</h3>
            </div>
            
            {shortages.length === 0 ? (
              <div className="empty-state success">
                <h3>✅ No Active Shortages</h3>
                <p>All schools have adequate textbooks</p>
              </div>
            ) : (
              <div className="shortages-list">
                {shortages.map(shortage => (
                  <div key={shortage.id} className="shortage-card">
                    <div className="shortage-header">
                      <h4>🏫 {shortage.school_name}</h4>
                      <span className="students-badge">
                        {shortage.students_affected} students affected
                      </span>
                    </div>
                    <div className="shortage-details">
                      <div className="detail-row">
                        <span className="label">Class:</span>
                        <span className="value">{shortage.class_level}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Subject:</span>
                        <span className="value">{shortage.subject}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Books Needed:</span>
                        <span className="value critical">{shortage.books_needed}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Books Available:</span>
                        <span className="value">{shortage.books_available}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Shortage:</span>
                        <span className="value critical">
                          {shortage.books_needed - shortage.books_available} books
                        </span>
                      </div>
                    </div>
                    <div className="shortage-description">
                      <p><strong>Description:</strong></p>
                      <p>{shortage.description}</p>
                    </div>
                    <div className="shortage-reporter">
                      <small>
                        Reported by {shortage.reporter_name} ({shortage.reporter_phone})
                        on {new Date(shortage.reported_at).toLocaleString()}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

export default TextbookDashboard;
