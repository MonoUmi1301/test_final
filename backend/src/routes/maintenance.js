const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const auth = require('../middleware/auth');
const auditLog = require('../middleware/audit');
const { errorResponse, successResponse } = require('../utils/response');

// GET /api/maintenance
router.get('/', auth(), async (req, res) => {
  const { vehicle_id, status, type } = req.query;
  let query = `
    SELECT m.*, v.license_plate
    FROM maintenance m
    LEFT JOIN vehicles v ON m.vehicle_id = v.id
    WHERE 1=1
  `;
  const params = [];
  if (vehicle_id) { query += ' AND m.vehicle_id = ?'; params.push(vehicle_id); }
  if (status) { query += ' AND m.status = ?'; params.push(status); }
  if (type) { query += ' AND m.type = ?'; params.push(type); }
  query += ' ORDER BY m.scheduled_at DESC';

  try {
    const [rows] = await db.execute(query, params);

    // Attach parts
    for (const row of rows) {
      const [parts] = await db.execute('SELECT * FROM maintenance_parts WHERE maintenance_id = ?', [row.id]);
      row.parts = parts;
    }

    return res.json(successResponse(rows));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// GET /api/maintenance/:id
router.get('/:id', auth(), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT m.*, v.license_plate FROM maintenance m
       LEFT JOIN vehicles v ON m.vehicle_id = v.id
       WHERE m.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json(errorResponse('NOT_FOUND', 'Maintenance record not found'));

    const [parts] = await db.execute('SELECT * FROM maintenance_parts WHERE maintenance_id = ?', [req.params.id]);
    return res.json(successResponse({ ...rows[0], parts }));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// POST /api/maintenance
router.post(
  '/',
  auth(['ADMIN']),
  auditLog('CREATE_MAINTENANCE', 'MAINTENANCE', (req, body) => body?.data?.id),
  async (req, res) => {
    const { vehicle_id, type, scheduled_at, technician, cost_thb, notes, parts = [] } = req.body;

    const errors = {};
    if (!vehicle_id) errors.vehicle_id = 'required';
    if (!type) errors.type = 'required';
    if (!scheduled_at) errors.scheduled_at = 'required';
    if (Object.keys(errors).length)
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', errors));

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const id = uuidv4();
      await conn.execute(
        `INSERT INTO maintenance (id, vehicle_id, status, type, scheduled_at, technician, cost_thb, notes)
         VALUES (?, ?, 'SCHEDULED', ?, ?, ?, ?, ?)`,
        [id, vehicle_id, type, scheduled_at, technician || null, cost_thb || null, notes || null]
      );

      for (const part of parts) {
        await conn.execute(
          `INSERT INTO maintenance_parts (id, maintenance_id, part_name, part_number, quantity, cost_thb)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), id, part.part_name, part.part_number || null, part.quantity || 1, part.cost_thb || null]
        );
      }

      await conn.commit();
      return res.status(201).json(successResponse({ id, status: 'SCHEDULED' }));
    } catch (err) {
      await conn.rollback();
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    } finally { conn.release(); }
  }
);

// PATCH /api/maintenance/:id
router.patch(
  '/:id',
  auth(['ADMIN']),
  auditLog('UPDATE_MAINTENANCE', 'MAINTENANCE'),
  async (req, res) => {
    const { status, technician, cost_thb, notes, mileage_at_service, completed_at } = req.body;
    const fields = [];
    const values = [];
    const map = { status, technician, cost_thb, notes, mileage_at_service, completed_at };
    for (const [k, v] of Object.entries(map)) {
      if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
    }
    if (!fields.length)
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'No fields to update'));

    // If completing maintenance, update vehicle status back to IDLE
    if (status === 'COMPLETED') {
      fields.push('completed_at = ?');
      values.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
    }

    values.push(req.params.id);

    try {
      const [rows] = await db.execute('SELECT * FROM maintenance WHERE id = ?', [req.params.id]);
      if (!rows[0]) return res.status(404).json(errorResponse('NOT_FOUND', 'Maintenance not found'));

      await db.execute(`UPDATE maintenance SET ${fields.join(', ')} WHERE id = ?`, values);

      if (status === 'COMPLETED') {
        await db.execute("UPDATE vehicles SET status = 'IDLE' WHERE id = ?", [rows[0].vehicle_id]);
      }

      const [updated] = await db.execute('SELECT * FROM maintenance WHERE id = ?', [req.params.id]);
      return res.json(successResponse(updated[0]));
    } catch (err) {
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    }
  }
);

module.exports = router;
