const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const auth = require('../middleware/auth');
const auditLog = require('../middleware/audit');
const { errorResponse, successResponse } = require('../utils/response');

// POST /api/drivers (ข้อ 2.1)
router.post(
  '/',
  auth(['ADMIN']),
  auditLog('CREATE_DRIVER', 'DRIVER', (req, body) => body?.data?.id),
  async (req, res) => {
    const { name, license_number, license_expires_at, phone } = req.body;

    const errors = {};
    if (!name) errors.name = 'required';
    if (!license_number) errors.license_number = 'required';
    if (!license_expires_at) errors.license_expires_at = 'required (YYYY-MM-DD)';
    if (!phone) errors.phone = 'required';

    if (Object.keys(errors).length)
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', errors));

    try {
      const id = uuidv4();
      await db.execute(
        `INSERT INTO drivers (id, name, license_number, license_expires_at, phone, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [id, name, license_number, license_expires_at, phone]
      );
      return res.status(201).json(successResponse({ id, name, status: 'ACTIVE' }));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json(errorResponse('DUPLICATE', 'License number already exists'));
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    }
  }
);

// GET /api/drivers
router.get('/', auth(), async (req, res) => {
  const { status, q } = req.query;
  let query = 'SELECT * FROM drivers WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (q) {
    query += ' AND (name LIKE ? OR license_number LIKE ? OR phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY created_at DESC';

  try {
    const [rows] = await db.execute(query, params);
    return res.json(successResponse(rows));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// GET /api/drivers/:id
router.get('/:id', auth(), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json(errorResponse('NOT_FOUND', 'Driver not found'));
    return res.json(successResponse(rows[0]));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// PATCH /api/drivers/:id
router.patch(
  '/:id',
  auth(['ADMIN']),
  auditLog('UPDATE_DRIVER', 'DRIVER'),
  async (req, res) => {
    const { name, phone, license_number, license_expires_at, status } = req.body;
    const fields = [];
    const values = [];
    const map = { name, phone, license_number, license_expires_at, status };
    for (const [k, v] of Object.entries(map)) {
      if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
    }
    if (!fields.length)
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'No fields to update'));
    values.push(req.params.id);

    try {
      await db.execute(`UPDATE drivers SET ${fields.join(', ')} WHERE id = ?`, values);
      const [updated] = await db.execute('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
      return res.json(successResponse(updated[0]));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json(errorResponse('DUPLICATE', 'License number already exists'));
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    }
  }
);

// DELETE /api/drivers/:id — ADMIN only
router.delete('/:id', auth(['ADMIN']), auditLog('DELETE_DRIVER', 'DRIVER'), async (req, res) => {
  try {
    await db.execute('DELETE FROM drivers WHERE id = ?', [req.params.id]);
    return res.json(successResponse({ message: 'Driver deleted' }));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

module.exports = router;