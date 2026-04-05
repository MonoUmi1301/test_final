const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { errorResponse, successResponse } = require('../utils/response');
const auth = require('../middleware/auth');

const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

const signRefresh = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json(
      errorResponse('VALIDATION_ERROR', 'Username and password are required', {
        username: !username ? 'required' : null,
        password: !password ? 'required' : null,
      })
    );
  }

  try {
    const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    const user = users[0];

    const valid = user && (await bcrypt.compare(password, user.password_hash));

    // Audit log — แยก try/catch ไม่ให้ crash login ถ้า audit fail
    try {
      await db.execute(
        `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, result, detail)
         VALUES (?, ?, 'LOGIN', 'USER', ?, ?, ?, ?)`,
        [
          uuidv4(),
          user?.id || null,           // ✅ null แทน 'unknown' (FK ไม่ error)
          user?.id || null,
          req.ip || null,
          valid ? 'SUCCESS' : 'FAIL',
          JSON.stringify({ username }),
        ]
      );
    } catch (auditErr) {
      console.warn('[Auth] Audit log failed:', auditErr.message);
    }

    if (!valid) {
      return res.status(401).json(
        errorResponse('AUTH_INVALID', 'Invalid username or password')
      );
    }

    const accessToken = signAccess({ id: user.id, username: user.username, role: user.role });
    const refreshToken = signRefresh({ id: user.id });

    return res.json(
      successResponse({
        accessToken,
        refreshToken,
        user: { id: user.id, username: user.username, role: user.role },
      })
    );
  } catch (err) {
    console.error('[Auth Login]', err);
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Refresh token required'));
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    const [users] = await db.execute('SELECT id, username, role FROM users WHERE id = ?', [decoded.id]);
    if (!users[0]) {
      return res.status(401).json(errorResponse('UNAUTHORIZED', 'User not found'));
    }

    const user = users[0];
    const accessToken = signAccess({ id: user.id, username: user.username, role: user.role });

    return res.json(successResponse({ accessToken }));
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json(
        errorResponse('REFRESH_EXPIRED', 'Refresh token expired. Please login again.')
      );
    }
    return res.status(401).json(errorResponse('INVALID_TOKEN', 'Invalid refresh token'));
  }
});

// POST /api/auth/logout
router.post('/logout', auth(), async (req, res) => {
  try {
    await db.execute(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, result, ip_address)
       VALUES (?, ?, 'LOGOUT', 'USER', 'SUCCESS', ?)`,
      [uuidv4(), req.user.id, req.ip || null]
    );
  } catch (auditErr) {
    console.warn('[Auth] Logout audit failed:', auditErr.message);
  }
  return res.json(successResponse({ message: 'Logged out successfully' }));
});

// GET /api/auth/me
router.get('/me', auth(), async (req, res) => {
  const [users] = await db.execute(
    'SELECT id, username, role, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!users[0]) return res.status(404).json(errorResponse('NOT_FOUND', 'User not found'));
  return res.json(successResponse(users[0]));
});

module.exports = router;