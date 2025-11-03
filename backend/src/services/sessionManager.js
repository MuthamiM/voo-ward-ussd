/**
 * Session Manager - Enforces single browser login
 * Only one active session allowed per user at a time
 */

const activeSessions = new Map(); // userId -> {token, loginTime, lastActivity}

// Add new session (invalidates previous session)
function addSession(userId, token) {
  const session = {
    token,
    loginTime: Date.now(),
    lastActivity: Date.now()
  };
  
  activeSessions.set(userId, session);
  
  return session;
}

// Check if token is the active session for user
function isActiveSession(userId, token) {
  const session = activeSessions.get(userId);
  
  if (!session) {
    return false;
  }
  
  if (session.token !== token) {
    return false;
  }
  
  // Update last activity
  session.lastActivity = Date.now();
  
  return true;
}

// Remove session (logout)
function removeSession(userId) {
  activeSessions.delete(userId);
}

// Get session info
function getSession(userId) {
  return activeSessions.get(userId);
}

// Clear expired sessions (older than 45 minutes)
function clearExpiredSessions() {
  const now = Date.now();
  const TIMEOUT = 45 * 60 * 1000; // 45 minutes
  
  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > TIMEOUT) {
      activeSessions.delete(userId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(clearExpiredSessions, 5 * 60 * 1000);

module.exports = {
  addSession,
  isActiveSession,
  removeSession,
  getSession
};
