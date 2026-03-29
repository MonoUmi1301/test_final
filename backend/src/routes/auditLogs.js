const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../utils/db');
const { errorResponse, successResponse } = require('../utils/response');

// GET /api/audit-logs (ข้อ 5.4)
// DISPATCHER: sees only own logs. ADMIN: sees all.
router.get('/', auth(), async (req, res) => {
  const { user_id, action, resource_type, date_from, date_to, page = 1, limit = 50 } = req.query;

  let query = 'SELECT a.*, u.username FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1';
  const params = [];

  if (req.user.role === 'DISPATCHER') {
    query += ' AND a.user_id = ?';
    params.push(req.user.id);
  } else if (user_id) {
    query += ' AND a.user_id = ?';
    params.push(user_id);
  }

  if (action) { query += ' AND a.action = ?'; params.push(action); }
  if (resource_type) { query += ' AND a.resource_type = ?'; params.push(resource_type); }
  if (date_from) { query += ' AND a.created_at >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND a.created_at <= ?'; params.push(date_to); }

 try {
    const countQuery = query.replace('SELECT a.*, u.username', 'SELECT COUNT(*) as total');
    const [[{ total }]] = await db.execute(countQuery, params);

    // แก้ไขตรงนี้: เปลี่ยนจากการใช้ ? เป็นการใส่ตัวเลขโดยตรง
    const limitNum = parseInt(limit) || 50;
    const offsetNum = (parseInt(page) - 1) * limitNum;
    
    query += ` ORDER BY a.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const [rows] = await db.execute(query, params); // params ตอนนี้จะเหลือแค่ตัวแปร Filter
    
    return res.json(successResponse(rows, {
      total,
      page: parseInt(page),
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    }));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

module.exports = router;
