const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const auth = require('../middleware/auth');
const auditLog = require('../middleware/audit');
const { errorResponse, successResponse } = require('../utils/response');

// PATCH /api/checkpoints/:id/status (ข้อ 3.2)
router.patch(
  '/:id/status',
  auth(['ADMIN', 'DISPATCHER']),
  auditLog('UPDATE_CHECKPOINT', 'CHECKPOINT'),
  async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'ARRIVED', 'DEPARTED', 'SKIPPED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(
        errorResponse('VALIDATION_ERROR', `Status must be one of: ${validStatuses.join(', ')}`)
      );
    }

    try {
      const [checkpoints] = await db.execute('SELECT * FROM checkpoints WHERE id = ?', [req.params.id]);
      if (!checkpoints[0]) return res.status(404).json(errorResponse('NOT_FOUND', 'Checkpoint not found'));

      const cp = checkpoints[0];

      // 1. ARRIVED must come before DEPARTED
      if (status === 'DEPARTED' && cp.status !== 'ARRIVED') {
        return res.status(422).json(
          errorResponse('INVALID_TRANSITION', 'Checkpoint must be ARRIVED before DEPARTED')
        );
      }

      // 2. Sequence enforcement (ข้อ 3.2)
      // ตรวจสอบว่ามี checkpoint ลำดับก่อนหน้าหรือไม่ (sequence - 1)
      if (status === 'ARRIVED') {
        const [prev] = await db.execute(
          'SELECT * FROM checkpoints WHERE trip_id = ? AND sequence = ?',
          [cp.trip_id, cp.sequence - 1]
        );

        // ถ้ามีลำดับก่อนหน้า (ไม่ว่าจะเป็น 0 หรือเลขอื่น) ต้องไม่ใช่ PENDING
        if (prev[0] && prev[0].status === 'PENDING') {
          return res.status(422).json(
            errorResponse(
              'SEQUENCE_VIOLATION',
              `Checkpoint #${cp.sequence - 1} (${prev[0].location_name}) is not yet completed`,
              { blocking_checkpoint: prev[0] }
            )
          );
        }
      }

      const updates = { status };
      if (status === 'ARRIVED') updates.arrived_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (status === 'DEPARTED') updates.departed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), req.params.id];

      await db.execute(`UPDATE checkpoints SET ${fields} WHERE id = ?`, values);
      const [updated] = await db.execute('SELECT * FROM checkpoints WHERE id = ?', [req.params.id]);

      return res.json(successResponse(updated[0]));
    } catch (err) {
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    }
  }
);

// GET /api/checkpoints?trip_id=
router.get('/', auth(), async (req, res) => {
  const { trip_id } = req.query;
  if (!trip_id) return res.status(400).json(errorResponse('VALIDATION_ERROR', 'trip_id is required'));

  try {
    const [rows] = await db.execute(
      'SELECT * FROM checkpoints WHERE trip_id = ? ORDER BY sequence ASC',
      [trip_id]
    );
    return res.json(successResponse(rows));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// POST /api/checkpoints — add checkpoint to trip
router.post(
  '/',
  auth(['ADMIN', 'DISPATCHER']),
  auditLog('CREATE_CHECKPOINT', 'CHECKPOINT', (req, body) => body?.data?.id),
  async (req, res) => {
    const { trip_id, sequence, location_name, latitude, longitude, purpose, notes } = req.body;
    const errors = {};
    if (!trip_id) errors.trip_id = 'required';
    if (!location_name) errors.location_name = 'required';
    if (sequence === undefined) errors.sequence = 'required'; // แก้ให้เช็ค undefined เผื่อเลข 0
    
    if (Object.keys(errors).length)
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', errors));

    try {
      const id = uuidv4();
      await db.execute(
        `INSERT INTO checkpoints (id, trip_id, sequence, status, location_name, latitude, longitude, purpose, notes)
         VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
        [id, trip_id, sequence, location_name, latitude || null, longitude || null, purpose || null, notes || null]
      );
      const [created] = await db.execute('SELECT * FROM checkpoints WHERE id = ?', [id]);
      return res.status(201).json(successResponse(created[0]));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json(errorResponse('DUPLICATE', 'Sequence already exists for this trip'));
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    }
  }
);

module.exports = router;