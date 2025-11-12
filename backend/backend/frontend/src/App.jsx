import React, { useState, useEffect } from "react";
import "./App.css";

const API_BASE = "http://localhost:4000";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = localStorage.getItem("currentUser");
    return stored ? JSON.parse(stored) : null;
  });

  // Centralized fetch wrapper that handles session expiration
  const authenticatedFetch = async (url, options = {}) => {
    // Don't make requests if no token
    if (!token) {
      throw new Error('No token available');
    }
    
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    });

    // Handle session expiration silently (no alerts about other browsers)
    if (res.status === 401) {
      // Only logout once to prevent blinking
      if (token) {
        handleLogout();
      }
      throw new Error('Authentication failed');
    }

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return res;
  };

  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState("checking");
  const [announcements, setAnnouncements] = useState([]);
  const [issues, setIssues] = useState([]);
  const [users, setUsers] = useState([]);
  const [constituents, setConstituents] = useState([]);
  const [bursaries, setBursaries] = useState([]);
  const [activeTab, setActiveTab] = useState("announcements");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", body: "" });
  const [newIssue, setNewIssue] = useState({ category: "", message: "", phone_number: "" });
  const [newUser, setNewUser] = useState({ name: "", pin: "", role: "admin" });
  const [editingIssueId, setEditingIssueId] = useState(null);
  const [issueComment, setIssueComment] = useState("");
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Auto-logout after 45 minutes of inactivity
  useEffect(() => {
    if (!token) return;

    const INACTIVITY_TIMEOUT = 45 * 60 * 1000; // 45 minutes in milliseconds

    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastActivity > INACTIVITY_TIMEOUT) {
        handleLogout();
        showToast("You have been logged out due to inactivity (45 minutes).", 'info');
      }
    };

    const resetActivity = () => {
      setLastActivity(Date.now());
    };

    // Check every minute
    const interval = setInterval(checkInactivity, 60000);

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetActivity);
    });

    return () => {
      clearInterval(interval);
      events.forEach(event => {
        document.removeEventListener(event, resetActivity);
      });
    };
  }, [token, lastActivity]);

  useEffect(() => {
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      setServerStatus(res.ok ? "online" : "error");
    } catch (e) {
      setServerStatus("offline");
    }
  };

  useEffect(() => {
    if (token && serverStatus === "online") {
      fetchAnnouncements();
      fetchIssues();
      fetchUsers();
      fetchConstituents();
      fetchBursaries();
      const interval = setInterval(() => {
        fetchAnnouncements();
        fetchIssues();
        fetchUsers();
        fetchConstituents();
        fetchBursaries();
      }, 3000); // Auto-refresh every 3 seconds
      return () => clearInterval(interval);
    }
  }, [token, serverStatus]);

  const fetchAnnouncements = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/announcements`);
      const data = await res.json();
      setAnnouncements(data);
    } catch (e) {
      // Silent fail - don't clear data on refresh errors
    }
  };

  const fetchIssues = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/issues`);
      const data = await res.json();
      setIssues(data);
    } catch (e) {
      // Silent fail - don't clear data on refresh errors
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/users`);
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      // Silent fail - don't clear data on refresh errors
    }
  };

  const fetchConstituents = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/constituents`);
      const data = await res.json();
      setConstituents(data);
    } catch (e) {
      // Silent fail - don't clear data on refresh errors
    }
  };

  const fetchBursaries = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/bursaries`);
      const data = await res.json();
      setBursaries(data);
    } catch (e) {
      // Silent fail - don't clear data on refresh errors
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    // Validate username (min 3 chars, letters and numbers only)
    if (!username || username.length < 3) {
      setError("Username must be at least 3 characters");
      setLoading(false);
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      setError("Username can only contain letters and numbers");
      setLoading(false);
      return;
    }
    
    // Validate PIN
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError("PIN must be 6 digits");
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setCurrentUser(data.user);
        localStorage.setItem("token", data.token);
        localStorage.setItem("currentUser", JSON.stringify(data.user));
        setUsername("");
        setPin("");
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Invalid credentials");
      }
    } catch (e) {
      setError("Connection failed");
      setServerStatus("offline");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      // Call backend to terminate session
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
      // Continue with local cleanup even if API call fails
    } finally {
      // Always clear local state and storage
      setToken(null);
      setCurrentUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      setUsername("");
      setPin("");
      setError("");
      setAnnouncements([]);
      setIssues([]);
      setUsers([]);
      setConstituents([]);
    }
  };

  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!newAnnouncement.title.trim() || !newAnnouncement.body.trim()) {
      setFormError("Title and message required");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newAnnouncement)
      });
      if (res.ok) {
        const newAnn = await res.json();
        setAnnouncements([newAnn, ...announcements]);
        setNewAnnouncement({ title: "", body: "" });
        setShowAddForm(false);
      } else {
        setFormError("Failed to add");
      }
    } catch (e) {
      setFormError("Error adding");
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    try {
      await fetch(`${API_BASE}/announcements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnnouncements(announcements.filter(a => a.id !== id));
    } catch (e) {}
  };

  const handleReportIssue = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!newIssue.category || !newIssue.message.trim() || !newIssue.phone_number.trim()) {
      setFormError("All fields required");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/issues`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newIssue)
      });
      if (res.ok) {
        const newIss = await res.json();
        setIssues([newIss, ...issues]);
        setNewIssue({ category: "", message: "", phone_number: "" });
        setShowAddForm(false);
      }
    } catch (e) {}
  };

  const handleUpdateIssueStatus = async (issueId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/issues/${issueId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, comment: issueComment })
      });
      if (res.ok) {
        const updated = await res.json();
        setIssues(issues.map(i => i.id === issueId ? updated : i));
        setEditingIssueId(null);
        setIssueComment("");
      }
    } catch (e) {}
  };

  const handleUpdateBursaryStatus = async (bursaryId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/admin/bursaries/${bursaryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setBursaries(bursaries.map(b => b.id === bursaryId ? updated : b));
      }
    } catch (e) {
      console.error('Error updating bursary status:', e);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!newUser.name.trim() || !newUser.pin.trim()) {
      setFormError("Name and PIN required");
      return;
    }
    if (newUser.pin.length !== 6 || !/^\d+$/.test(newUser.pin)) {
      setFormError("PIN must be 6 digits");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        const created = await res.json();
        setUsers([...users, created]);
        setNewUser({ name: "", pin: "", role: "admin" });
        setShowAddForm(false);
      }
    } catch (e) {}
  };

  const handleDeleteUser = async (userId) => {
    const userToDelete = users.find(u => u.id === userId);
    
    // Only MCA (super_admin or mca) can delete users
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'mca') {
      showToast("Only the MCA (Super Admin) can delete user accounts.", 'error');
      return;
    }
    
    // MCA cannot delete themselves
    if (userId === currentUser.id) {
      showToast("You cannot delete your own account.", 'error');
      return;
    }

    const confirmed = await confirmDialog(`Are you sure you want to delete ${userToDelete.name}?`);
    if (!confirmed) return;
    
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        showToast('User deleted', 'success');
      } else {
        const error = await res.json();
        showToast(error.error || "Failed to delete user", 'error');
      }
    } catch (e) {
      showToast("Error deleting user", 'error');
    }
  };

  // Lightweight toast helper (DOM-based) to avoid adding a dependency
  function showToast(message, type = 'info', ttl = 5000) {
    try {
      const containerId = 'vk-toast-container';
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.position = 'fixed';
        container.style.right = '20px';
        container.style.top = '20px';
        container.style.zIndex = 99999;
        document.body.appendChild(container);
      }

      const el = document.createElement('div');
      el.textContent = message;
      el.style.marginTop = '8px';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '6px';
      el.style.color = '#fff';
      el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
      el.style.fontSize = '13px';
      el.style.maxWidth = '320px';
      el.style.wordBreak = 'break-word';

      switch (type) {
        case 'success': el.style.background = '#16a34a'; break;
        case 'error': el.style.background = '#dc2626'; break;
        case 'warn': el.style.background = '#f59e0b'; el.style.color = '#111827'; break;
        default: el.style.background = '#2563eb'; break;
      }

      container.appendChild(el);

      setTimeout(() => {
        try { container.removeChild(el); } catch (e) {}
      }, ttl);
    } catch (e) {
      // Fallback to console
      if (type === 'error') console.error(message);
      else if (type === 'warn') console.warn(message);
      else console.log(message);
    }
  }

  // Promise-based confirm dialog (DOM) to avoid blocking confirm()
  function confirmDialog(message) {
    return new Promise((resolve) => {
      try {
        const id = `vk-confirm-${Date.now()}`;
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.style.position = 'fixed';
        overlay.style.left = 0;
        overlay.style.top = 0;
        overlay.style.right = 0;
        overlay.style.bottom = 0;
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = 100000;

        const box = document.createElement('div');
        box.style.background = '#fff';
        box.style.padding = '18px';
        box.style.borderRadius = '8px';
        box.style.boxShadow = '0 6px 24px rgba(0,0,0,0.16)';
        box.style.maxWidth = '420px';
        box.style.width = '90%';

        const msg = document.createElement('div');
        msg.textContent = message;
        msg.style.marginBottom = '12px';

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.justifyContent = 'flex-end';
        controls.style.gap = '8px';

        const noBtn = document.createElement('button');
        noBtn.textContent = 'Cancel';
        noBtn.style.padding = '8px 12px';

        const yesBtn = document.createElement('button');
        yesBtn.textContent = 'Yes';
        yesBtn.style.padding = '8px 12px';
        yesBtn.style.background = '#dc2626';
        yesBtn.style.color = '#fff';
        yesBtn.style.border = 'none';
        yesBtn.style.borderRadius = '6px';

        controls.appendChild(noBtn);
        controls.appendChild(yesBtn);
        box.appendChild(msg);
        box.appendChild(controls);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        function cleanup(result) {
          try { document.body.removeChild(overlay); } catch (e) {}
          resolve(result);
        }

        noBtn.addEventListener('click', () => cleanup(false));
        yesBtn.addEventListener('click', () => cleanup(true));
      } catch (e) {
        // If something goes wrong, fallback to window.confirm (rare)
        resolve(window.confirm(message));
      }
    });
  }

  if (!token) {
    return (
      <div className="login-wrapper">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <div className="login-icon">V</div>
              <h1 className="login-title">Voo Kyamatu</h1>
              <p className="login-subtitle">Ward Admin Portal</p>
            </div>
            {serverStatus === "offline" && (
              <div className="server-offline-banner">
                <span>Server offline</span>
              </div>
            )}
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                  className="form-input"
                  placeholder="e.g., zak, admin123"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label>PIN Code</label>
                <input
                  type="password"
                  maxLength="6"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="form-input"
                  placeholder="000000"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="dashboard-title">Voo Kyamatu</h1>
            <p className="dashboard-subtitle">Ward Portal</p>
          </div>
          <div className="header-right">
            <div className={`status-indicator ${serverStatus}`}>
              <span className="status-dot"></span>
              <span className="status-text">
                {serverStatus === "online" ? "Connected" : "Offline"}
              </span>
            </div>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <div className="dashboard-container">
        <nav className="tab-navigation">
          {["announcements", "issues", "bursaries", "constituents", "stats", "users"].map((tab) => (
            <button key={tab} className={`tab-btn ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        <div className="tab-content">
          {activeTab === "announcements" && (
            <div className="tab-pane">
              <div className="section-header">
                <h2>Announcements</h2>
                <button onClick={() => setShowAddForm(!showAddForm)} className="add-btn">
                  {showAddForm ? "Cancel" : "+ New"}
                </button>
              </div>
              {showAddForm && (
                <form onSubmit={handleAddAnnouncement} className="add-form">
                  <div className="form-group">
                    <label>Title</label>
                    <input type="text" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} className="form-input" placeholder="Announcement title" />
                  </div>
                  <div className="form-group">
                    <label>Message</label>
                    <textarea value={newAnnouncement.body} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })} className="form-textarea" placeholder="Enter message" rows="4" />
                  </div>
                  {formError && <div className="error-message">{formError}</div>}
                  <button type="submit" className="submit-btn">Publish</button>
                </form>
              )}
              <div className="announcements-list">
                {announcements.length === 0 ? <p className="empty-state">No announcements</p> : announcements.map((ann) => (
                  <div key={ann.id} className="card">
                    <div className="card-header">
                      <h3>{ann.title}</h3>
                      <button onClick={() => handleDeleteAnnouncement(ann.id)} className="delete-btn">X</button>
                    </div>
                    <p className="card-body">{ann.body}</p>
                    <div className="card-footer">{new Date(ann.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === "issues" && (
            <div className="tab-pane">
              <div className="section-header">
                <h2>Issues</h2>
                <button onClick={() => setShowAddForm(!showAddForm)} className="add-btn">
                  {showAddForm ? "Cancel" : "+ New"}
                </button>
              </div>
              {showAddForm && (
                <form onSubmit={handleReportIssue} className="add-form">
                  <div className="form-group">
                    <label>Category</label>
                    <select value={newIssue.category} onChange={(e) => setNewIssue({ ...newIssue, category: e.target.value })} className="form-input">
                      <option value="">Select</option>
                      <option value="Water">Water</option>
                      <option value="Health">Health</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Security">Security</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea value={newIssue.message} onChange={(e) => setNewIssue({ ...newIssue, message: e.target.value })} className="form-textarea" placeholder="Describe" rows="4" />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="tel" value={newIssue.phone_number} onChange={(e) => setNewIssue({ ...newIssue, phone_number: e.target.value })} className="form-input" placeholder="0712345678" />
                  </div>
                  {formError && <div className="error-message">{formError}</div>}
                  <button type="submit" className="submit-btn">Report</button>
                </form>
              )}
              <div className="issues-list">
                {issues.length === 0 ? <p className="empty-state">No issues</p> : issues.map((issue) => (
                  <div key={issue.id} className="card">
                    <div className="card-header">
                      <h3>{issue.category}</h3>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <span className={`source-badge source-${(issue.source || 'Dashboard').toLowerCase()}`}>
                          {issue.source || 'Dashboard'}
                        </span>
                        <span className={`status-badge status-${(issue.status || "open").replace("_", "-")}`}>{issue.status || "open"}</span>
                      </div>
                    </div>
                    <p className="card-body">{issue.message}</p>
                    <div className="card-meta">
                      <span>📱 {issue.phone_number}</span>
                      <span>🎫 {issue.ticket}</span>
                    </div>
                    <div className="card-footer">
                      <label style={{fontWeight: 'bold', marginBottom: '8px', display: 'block'}}>Change Status:</label>
                      <select 
                        value={issue.status || "open"}
                        onChange={(e) => handleUpdateIssueStatus(issue.id, e.target.value)} 
                        className="form-input"
                        style={{width: '100%', padding: '10px', fontSize: '16px'}}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === "bursaries" && (
            <div className="tab-pane">
              <div className="section-header">
                <h2>Bursary Applications</h2>
                <div style={{display: 'flex', gap: '10px'}}>
                  <a 
                    href={`${API_BASE}/admin/export/bursaries`}
                    className="add-btn"
                    style={{textDecoration: 'none'}}
                    onClick={(e) => {
                      e.preventDefault();
                      fetch(`${API_BASE}/admin/export/bursaries`, {
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      .then(res => res.blob())
                      .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `bursaries-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                      });
                    }}
                  >
                    📥 Download CSV
                  </a>
                  <span className="stat-badge" style={{padding: '8px 16px', background: '#10b981', color: 'white', borderRadius: '6px', fontWeight: 'bold'}}>
                    Total: {bursaries.length}
                  </span>
                </div>
              </div>
              <div className="issues-list">
                {bursaries.length === 0 ? (
                  <p className="empty-state">No bursary applications yet. They will appear here when someone applies via USSD.</p>
                ) : (
                  bursaries.map((bursary) => (
                    <div key={bursary.id} className="card">
                      <div className="card-header">
                        <h3>{bursary.category}</h3>
                        <span className={`status-badge status-${(bursary.status || "Pending").toLowerCase().replace(" ", "-")}`}>
                          {bursary.status || "Pending"}
                        </span>
                      </div>
                      <div className="card-body">
                        <div style={{display: 'grid', gap: '12px', marginTop: '10px'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '140px'}}>📄 App Number:</span>
                            <span>{bursary.application_number}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '140px'}}>👤 Applicant:</span>
                            <span>{bursary.applicant_name || 'Not registered'}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '140px'}}>📱 Phone:</span>
                            <span>{bursary.phone_number}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '140px'}}>🎓 Student:</span>
                            <span>{bursary.student_name}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '140px'}}>🏫 Institution:</span>
                            <span>{bursary.institution}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '140px'}}>💰 Amount:</span>
                            <span style={{fontWeight: 'bold', color: '#059669'}}>KSh {bursary.amount_requested?.toLocaleString()}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '140px'}}>📍 Location:</span>
                            <span>{bursary.applicant_location || 'N/A'}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '140px'}}>📅 Applied:</span>
                            <span>{new Date(bursary.created_at).toLocaleString()}</span>
                          </div>
                          {bursary.admin_notes && (
                            <div style={{marginTop: '8px', padding: '12px', background: '#f9fafb', borderRadius: '6px', borderLeft: '3px solid #3b82f6'}}>
                              <span style={{fontWeight: 'bold', display: 'block', marginBottom: '4px'}}>📝 Admin Notes:</span>
                              <span style={{fontSize: '14px', color: '#6b7280'}}>{bursary.admin_notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="card-footer">
                        <label style={{fontWeight: 'bold', marginBottom: '8px', display: 'block'}}>Update Status:</label>
                        <select 
                          value={bursary.status || "Pending"}
                          onChange={(e) => handleUpdateBursaryStatus(bursary.id, e.target.value)} 
                          className="form-input"
                          style={{width: '100%', padding: '10px', fontSize: '16px', marginBottom: '10px'}}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                          <option value="Disbursed">Disbursed</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {activeTab === "constituents" && (
            <div className="tab-pane">
              <div className="section-header">
                <h2>Registered Constituents</h2>
                <div style={{display: 'flex', gap: '10px'}}>
                  <a 
                    href={`${API_BASE}/admin/export/constituents`}
                    className="add-btn"
                    style={{textDecoration: 'none'}}
                    onClick={(e) => {
                      e.preventDefault();
                      fetch(`${API_BASE}/admin/export/constituents`, {
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      .then(res => res.blob())
                      .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `constituents-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                      });
                    }}
                  >
                    📥 Download CSV
                  </a>
                  <span className="stat-badge" style={{padding: '8px 16px', background: '#10b981', color: 'white', borderRadius: '6px', fontWeight: 'bold'}}>
                    Total: {constituents.length}
                  </span>
                </div>
              </div>
              <div className="users-list">
                {constituents.length === 0 ? (
                  <p className="empty-state">No constituents registered yet. They will appear here when someone registers via USSD.</p>
                ) : (
                  constituents.map((person) => (
                    <div 
                      key={person.id} 
                      className="card constituent-card"
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      style={{userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none'}}
                    >
                      <div className="card-header">
                        <h3>{person.full_name}</h3>
                        <span className="status-badge" style={{background: '#10b981'}}>
                          ✓ Registered
                        </span>
                      </div>
                      <div className="card-body">
                        <div style={{display: 'grid', gap: '12px', marginTop: '10px'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '120px'}}>📱 Phone:</span>
                            <span style={{userSelect: 'none'}}>{person.phone}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '120px'}}>🆔 National ID:</span>
                            <span style={{userSelect: 'none'}}>{person.national_id}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '120px'}}>📍 Village:</span>
                            <span style={{userSelect: 'none'}}>{person.village}, {person.area}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span style={{fontWeight: 'bold', width: '120px'}}>📅 Registered:</span>
                            <span style={{userSelect: 'none'}}>{new Date(person.created_at).toLocaleString()}</span>
                          </div>
                          {person.terms_accepted && (
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', padding: '8px', background: '#f0fdf4', borderRadius: '6px'}}>
                              <span style={{fontSize: '12px', color: '#059669'}}>
                                🔒 Consented to MCA-only data access
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {activeTab === "stats" && (
            <div className="tab-pane">
              <h2>Statistics</h2>
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-number">{announcements.length}</div><div className="stat-label">Announcements</div></div>
                <div className="stat-card"><div className="stat-number">{issues.length}</div><div className="stat-label">Issues</div></div>
                <div className="stat-card"><div className="stat-number">{constituents.length}</div><div className="stat-label">Constituents</div></div>
                <div className="stat-card"><div className="stat-number">{users.length}</div><div className="stat-label">Users</div></div>
              </div>
            </div>
          )}
          {activeTab === "users" && (
            <div className="tab-pane">
              <div className="section-header">
                <h2>Admin Users</h2>
                <button onClick={() => setShowAddForm(!showAddForm)} className="add-btn">
                  {showAddForm ? "Cancel" : "+ New"}
                </button>
              </div>
              {showAddForm && (
                <form onSubmit={handleCreateUser} className="add-form">
                  <div style={{padding: '15px', background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', marginBottom: '20px'}}>
                    <strong>⚠️ Maximum 2 Admins Only:</strong>
                    <ul style={{marginTop: '10px', marginLeft: '20px'}}>
                      <li><strong>Super Admin (MCA)</strong> - Full access to all features</li>
                      <li><strong>Admin (PA)</strong> - Manage issues and announcements</li>
                    </ul>
                  </div>
                  <div className="form-group">
                    <label>Name</label>
                    <input 
                      type="text" 
                      value={newUser.name} 
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} 
                      className="form-input" 
                      placeholder="Enter full name" 
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>PIN (6 digits)</label>
                    <input 
                      type="password" 
                      maxLength="6" 
                      value={newUser.pin} 
                      onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, "") })} 
                      className="form-input" 
                      placeholder="123456" 
                      required
                    />
                    <small style={{color: '#6b7280', fontSize: '0.85em'}}>User will login with this 6-digit PIN</small>
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="form-input">
                      <option value="super_admin">Super Admin (MCA) - Full Access</option>
                      <option value="admin">Admin (PA) - Manage Issues</option>
                    </select>
                  </div>
                  {formError && <div className="error-message">{formError}</div>}
                  <button type="submit" className="submit-btn" disabled={users.length >= 2}>
                    {users.length >= 2 ? 'Maximum Admins Reached' : 'Create User'}
                  </button>
                </form>
              )}
              <div className="users-list">
                <div style={{padding: '15px', background: '#e0f2fe', border: '2px solid #0284c7', borderRadius: '8px', marginBottom: '20px'}}>
                  <strong>Current Admin Count: {users.length} / 2 Maximum</strong>
                  {users.length < 2 && <p style={{marginTop: '5px', color: '#0369a1'}}>You can add {2 - users.length} more admin(s)</p>}
                </div>
                {users.length === 0 ? <p className="empty-state">No users yet. Create your first admin.</p> : users.map((user) => (
                  <div key={user.id} className="card">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div style={{flex: 1}}>
                        <h3>
                          {user.name}
                          {currentUser && user.id === currentUser.id && (
                            <span style={{marginLeft: '10px', fontSize: '0.8em', color: '#059669', fontWeight: 'normal'}}>(You)</span>
                          )}
                        </h3>
                        <span className={`role-badge role-${user.role.replace("_", "-")}`}>
                          {(user.role === 'super_admin' || user.role === 'mca') ? 'Super Admin (MCA)' : 'Admin (PA)'}
                        </span>
                        {(user.role === 'super_admin' || user.role === 'mca') && (
                          <div style={{marginTop: '10px', fontSize: '0.9em', color: '#6b7280'}}>
                            <strong>Permissions:</strong> Full access - Manage all features, users, and settings
                          </div>
                        )}
                        {user.role === 'admin' && (
                          <div style={{marginTop: '10px', fontSize: '0.9em', color: '#6b7280'}}>
                            <strong>Permissions:</strong> Manage issues, announcements, and view statistics
                          </div>
                        )}
                      </div>
                      {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'mca') && user.id !== currentUser.id && (
                        <button onClick={() => handleDeleteUser(user.id)} className="delete-btn">Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}