import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ReportIssue from './pages/ReportIssue'
import MyIssues from './pages/MyIssues'
import BursaryStatus from './pages/BursaryStatus'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('citizen_token');
    const userData = localStorage.getItem('citizen_user');

    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('citizen_token', token);
    localStorage.setItem('citizen_user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('citizen_token');
    localStorage.removeItem('citizen_user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ?
              <Navigate to="/dashboard" /> :
              <Login onLogin={handleLogin} apiUrl={API_URL} />
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ?
              <Dashboard user={user} onLogout={handleLogout} /> :
              <Navigate to="/login" />
          }
        />
        <Route
          path="/report-issue"
          element={
            isAuthenticated ?
              <ReportIssue user={user} apiUrl={API_URL} /> :
              <Navigate to="/login" />
          }
        />
        <Route
          path="/my-issues"
          element={
            isAuthenticated ?
              <MyIssues user={user} apiUrl={API_URL} /> :
              <Navigate to="/login" />
          }
        />
        <Route
          path="/bursary-status"
          element={
            isAuthenticated ?
              <BursaryStatus user={user} apiUrl={API_URL} /> :
              <Navigate to="/login" />
          }
        />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
