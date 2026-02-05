/**
 * Admin Authentication Routes
 * Handles login, logout, password reset, and profile management
 */

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

// Import middleware
const { 
  requireAuth, 
  loginLimiter, 
  hashPassword, 
  isBcryptHash,
  sessions,
  generateSessionToken
} = require('../../middleware/auth');

// Validation helpers
function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 6 && password.length <= 128;
}

function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}

// Database connection will be injected
let connectDB = null;
let sendSMS = null;

function setDependencies(deps) {
  connectDB = deps.connectDB;
  sendSMS = deps.sendSMS;
}

// ============================================
// LOGIN
// ============================================
router.post('/login', loginLimiter, async (req, res) => {
  try {
    let { username, password, pin } = req.body;

    if (!password && pin) {
      password = pin;
    }

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (!validateUsername(username)) {
      return res.status(400).json({ error: "Invalid username format" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Invalid password format" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const user = await database.collection("admin_users").findOne({
      username: username.toLowerCase().trim()
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Password verification with bcrypt migration
    let passwordMatches = false;
    try {
      if (isBcryptHash(user.password)) {
        passwordMatches = await bcrypt.compare(password, user.password);
      } else {
        passwordMatches = user.password === hashPassword(password);
        if (passwordMatches) {
          // Migrate to bcrypt
          const newHash = await bcrypt.hash(password, 10);
          await database.collection('admin_users').updateOne(
            { _id: user._id }, 
            { $set: { password: newHash } }
          );
        }
      }
    } catch (errCompare) {
      console.error('Password compare error:', errCompare);
      passwordMatches = false;
    }

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Create session
    const token = generateSessionToken();
    const sessionUser = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      photo_url: user.photo_url || null,
      settings: user.settings || {}
    };

    sessions.set(token, { user: sessionUser, createdAt: new Date() });

    res.json({
      success: true,
      token,
      user: sessionUser
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// LOGOUT
// ============================================
router.post('/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    sessions.delete(token);
  }
  res.json({ success: true, message: "Logged out successfully" });
});

// ============================================
// FORGOT PASSWORD
// ============================================
router.post('/forgot-password', loginLimiter, async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ error: "Username or phone number is required" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const user = await database.collection("admin_users").findOne({
      $or: [
        { username: identifier.toLowerCase() },
        { phone: identifier }
      ]
    });

    if (!user) {
      return res.json({
        success: true,
        message: "If an account exists, a reset code has been sent."
      });
    }

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 24 * 3600000);

    await database.collection("password_resets").insertOne({
      user_id: user._id,
      token: resetToken,
      expires_at: expiresAt,
      created_at: new Date()
    });

    if (user.phone && sendSMS) {
      sendSMS(user.phone, `Your VOO Ward reset code is: ${resetToken}`)
        .catch(err => console.error('Background SMS error:', err));
    }

    console.log(`🔓 [RESET PIN] For ${user.username}: ${resetToken}`);

    res.json({
      success: true,
      message: "Reset code has been sent to your phone.",
      dev_token: resetToken
    });

  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// RESET PASSWORD
// ============================================
router.post('/reset-password', loginLimiter, async (req, res) => {
  try {
    const { token, new_pin } = req.body;

    if (!token || !new_pin) {
      return res.status(400).json({ error: "Token and new PIN are required" });
    }

    if (!/^\d+$/.test(new_pin)) {
      return res.status(400).json({ error: "Password must contain only digits" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const resetRecord = await database.collection("password_resets").findOne({
      token: token,
      expires_at: { $gt: new Date() }
    });

    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(new_pin, 10);

    await database.collection("admin_users").updateOne(
      { _id: resetRecord.user_id },
      { $set: { password: hashedPassword, updated_at: new Date() } }
    );

    await database.collection("password_resets").deleteOne({ _id: resetRecord._id });

    res.json({ success: true, message: "Password reset successfully. Please login with your new PIN." });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// UPDATE PROFILE
// ============================================
router.post('/update-profile', requireAuth, async (req, res) => {
  try {
    const { profile_picture, full_name, phone } = req.body;
    const userId = req.user._id || req.user.id;

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const updateData = { updated_at: new Date() };

    if (profile_picture) updateData.profile_picture = profile_picture;
    if (full_name) updateData.full_name = full_name;
    if (phone) updateData.phone = phone;

    await database.collection("admin_users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    res.json({ success: true, message: "Profile updated successfully" });

  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// CHANGE PASSWORD
// ============================================
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user._id || req.user.id;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: "Current and new password are required" });
    }

    const database = await connectDB();
    if (!database) {
      return res.status(503).json({ error: "Database not connected" });
    }

    const user = await database.collection("admin_users").findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    let passwordMatches = false;
    if (isBcryptHash(user.password)) {
      passwordMatches = await bcrypt.compare(current_password, user.password);
    } else {
      passwordMatches = user.password === hashPassword(current_password);
    }

    if (!passwordMatches) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await database.collection("admin_users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashedPassword, updated_at: new Date() } }
    );

    res.json({ success: true, message: "Password changed successfully" });

  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET CURRENT USER
// ============================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const database = await connectDB();
    if (!database) {
      return res.json({ user: req.user });
    }

    const userId = req.user._id || req.user.id;
    const user = await database.collection("admin_users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    if (user) {
      res.json({ user });
    } else {
      res.json({ user: req.user });
    }
  } catch (err) {
    res.json({ user: req.user });
  }
});

module.exports = router;
module.exports.setDependencies = setDependencies;
