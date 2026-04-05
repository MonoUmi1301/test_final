const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const auth = require('../middleware/auth');
const { canDeleteVehicle } = require('../middleware/auth');
const auditLog = require('../middleware/audit');
const { errorResponse, successResponse } = require('../utils/response');

// Valid status transitions (ข้อ 2.5)
const VALID_TRANSITIONS = {
  IDLE: ['ACTIVE', 'MAINTENANCE' ,'RETIRED'],
  ACTIVE: ['IDLE', 'MAINTENANCE', 'RETIRED'],
  MAINTENANCE: ['IDLE', 'RETIRED'],
  RETIRED: [],
};

// POST /api/vehicles — create vehicle (ข้อ 2.1, 2.2)
router.post(
  '/',
  auth(['ADMIN']),
  auditLog('CREATE_VEHICLE', 'VEHICLE', (req, body) => body?.data?.id),
  async (req, res) => {
    const {
      license_plate, type, driver_id, brand, model, year, fuel_type,
      mileage_km = 0, last_service_km, next_service_km,
    } = req.body;

    // Validation
    const errors = {};
    if (!license_plate) errors.license_plate = 'required';
    if (!type || !['TRUCK', 'VAN', 'MOTORCYCLE', 'PICKUP'].includes(type))
      errors.type = 'must be TRUCK | VAN | MOTORCYCLE | PICKUP';
    if (Object.keys(errors).length)
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', errors));

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Check driver license not expired (ข้อ 2.2)
      if (driver_id) {
        const [drivers] = await conn.execute(
          'SELECT license_expires_at, status FROM drivers WHERE id = ?',
          [driver_id]
        );
        if (!drivers[0]) {
          await conn.rollback();
          return res.status(400).json(errorResponse('DRIVER_NOT_FOUND', 'Driver not found'));
        }
        if (new Date(drivers[0].license_expires_at) < new Date()) {
          await conn.rollback();
          return res.status(400).json(
            errorResponse('DRIVER_LICENSE_EXPIRED', 'Cannot assign driver with expired license')
          );
        }
        if (drivers[0].status !== 'ACTIVE') {
          await conn.rollback();
          return res.status(400).json(
            errorResponse('DRIVER_INACTIVE', 'Driver is not active')
          );
        }
      }

      const vId = uuidv4();
      let status = 'IDLE';

      // Auto-maintenance if mileage exceeded (ข้อ 2.2) — same transaction
      if (next_service_km && mileage_km >= next_service_km) {
        status = 'MAINTENANCE';
        await conn.execute(
          `INSERT INTO maintenance (id, vehicle_id, status, type, scheduled_at)
           VALUES (?, ?, 'SCHEDULED', 'INSPECTION', NOW())`,
          [uuidv4(), vId]
        );
      }

      await conn.execute(
        `INSERT INTO vehicles
           (id, license_plate, type, status, driver_id, brand, model, year, fuel_type, mileage_km, last_service_km, next_service_km)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vId, license_plate, type, status, driver_id || null, brand || null, model || null,
          year || null, fuel_type || null, mileage_km, last_service_km || null, next_service_km || null]
      );

      await conn.commit();
      return res.status(201).json(successResponse({ id: vId, status }));
    } catch (err) {
      await conn.rollback();
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json(errorResponse('DUPLICATE', 'License plate already exists'));
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    } finally {
      conn.release();
    }
  }
);

// GET /api/vehicles — list with filters
router.get('/', auth(), async (req, res) => {
  const { status, type, driver_id, q } = req.query;
  let query = `
    SELECT v.*, d.name as driver_name, d.license_number
    FROM vehicles v
    LEFT JOIN drivers d ON v.driver_id = d.id
    WHERE 1=1
  `;
  const params = [];

  if (status) { query += ' AND v.status = ?'; params.push(status); }
  if (type) { query += ' AND v.type = ?'; params.push(type); }
  if (driver_id) { query += ' AND v.driver_id = ?'; params.push(driver_id); }
  if (q) {
    query += ' AND (v.license_plate LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  query += ' ORDER BY v.created_at DESC';

  try {
    const [rows] = await db.execute(query, params);
    return res.json(successResponse(rows));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// GET /api/vehicles/:id
router.get('/:id', auth(), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT v.*, d.name as driver_name, d.phone as driver_phone
       FROM vehicles v LEFT JOIN drivers d ON v.driver_id = d.id
       WHERE v.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json(errorResponse('NOT_FOUND', 'Vehicle not found'));
    return res.json(successResponse(rows[0]));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// GET /api/vehicles/:id/history — trips + maintenance merged (ข้อ 2.3)
router.get('/:id/history', auth(), async (req, res) => {
  try {
    const [trips] = await db.execute(
      `SELECT id, 'trip' as type, status, origin, destination, distance_km,
              started_at as date, created_at
       FROM trips WHERE vehicle_id = ?`,
      [req.params.id]
    );
    const [maintenance] = await db.execute(
      `SELECT id, 'maintenance' as type, status, type as maintenance_type,
              scheduled_at as date, completed_at, cost_thb, created_at
       FROM maintenance WHERE vehicle_id = ?`,
      [req.params.id]
    );

    const history = [...trips, ...maintenance].sort(
      (a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at)
    );

    return res.json(successResponse(history));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// PATCH /api/vehicles/:id — update vehicle
router.patch(
  '/:id',
  auth(['ADMIN', 'DISPATCHER']),
  auditLog('UPDATE_VEHICLE', 'VEHICLE'),
  async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    try {
      const [vehicles] = await db.execute('SELECT * FROM vehicles WHERE id = ?', [id]);
      if (!vehicles[0]) return res.status(404).json(errorResponse('NOT_FOUND', 'Vehicle not found'));

      const current = vehicles[0];

      // Status transition validation (ข้อ 2.5) พร้อม Guard ดักค่าแปลกปลอม
      if (status && status !== current.status) {
        // Guard: เช็คว่าสถานะปัจจุบันมีในสารบบไหม
        if (!VALID_TRANSITIONS[current.status]) {
          return res.status(422).json(
            errorResponse('INVALID_TRANSITION', `Current status in DB is unknown: ${current.status}`)
          );
        }

        const allowed = VALID_TRANSITIONS[current.status];
        
        // Guard: เช็คว่าสถานะใหม่ที่ส่งมา เป็นสถานะที่มีนิยามไว้จริงหรือไม่
        if (!VALID_TRANSITIONS[status] && status !== 'RETIRED') {
          return res.status(400).json(
            errorResponse('INVALID_VALUE', `Status '${status}' is not a valid vehicle status`)
          );
        }

        if (!allowed.includes(status)) {
          return res.status(422).json(
            errorResponse('INVALID_TRANSITION',
              `Cannot transition from ${current.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
              { current_status: current.status, allowed_transitions: allowed }
            )
          );
        }
      }

      const {
        license_plate, type, driver_id, brand, model, year,
        fuel_type, mileage_km, last_service_km, next_service_km,
      } = req.body;

      // Check driver license if assigning new driver
      if (driver_id && driver_id !== current.driver_id) {
        const [drivers] = await db.execute(
          'SELECT license_expires_at, status FROM drivers WHERE id = ?', [driver_id]
        );
        if (!drivers[0]) return res.status(400).json(errorResponse('DRIVER_NOT_FOUND', 'Driver not found'));
        if (new Date(drivers[0].license_expires_at) < new Date())
          return res.status(400).json(errorResponse('DRIVER_LICENSE_EXPIRED', 'Driver license expired'));
      }

      const fields = [];
      const values = [];
      const dataToUpdate = {
        license_plate, type, status, driver_id, brand, model, year,
        fuel_type, mileage_km, last_service_km, next_service_km,
      };
      for (const [k, v] of Object.entries(dataToUpdate)) {
        if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
      }
      values.push(id);

      if (fields.length > 0) {
        await db.execute(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`, values);
      }

      // Log ASSIGN_DRIVER separately when driver changes (ข้อ 5.3)
      if (driver_id !== undefined && driver_id !== current.driver_id) {
        try {
          const { v4: uuidv4 } = require('uuid');
          await db.execute(
            `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, result, detail)
             VALUES (?, ?, 'ASSIGN_DRIVER', 'VEHICLE', ?, ?, 'SUCCESS', ?)`,
            [
              uuidv4(),
              req.user?.id || null,
              id,
              req.ip || null,
              JSON.stringify({ vehicle_id: id, old_driver_id: current.driver_id, new_driver_id: driver_id }),
            ]
          );
        } catch (auditErr) {
          console.warn('[Audit] ASSIGN_DRIVER log failed:', auditErr.message);
        }
      }

      const [updated] = await db.execute('SELECT * FROM vehicles WHERE id = ?', [id]);
      return res.json(successResponse(updated[0]));
    } catch (err) {
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    }
  }
);

// DELETE /api/vehicles/:id — ADMIN only, cannot delete if trip IN_PROGRESS (ข้อ 2.2)
router.delete(
  '/:id',
  auth(),
  canDeleteVehicle,
  auditLog('DELETE_VEHICLE', 'VEHICLE'),
  async (req, res) => {
    try {
      const [active] = await db.execute(
        "SELECT id FROM trips WHERE vehicle_id = ? AND status = 'IN_PROGRESS'",
        [req.params.id]
      );
      if (active.length > 0)
        return res.status(409).json(
          errorResponse('VEHICLE_IN_TRIP', 'Cannot delete vehicle with an active trip in progress')
        );

      await db.execute('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
      return res.json(successResponse({ message: 'Vehicle deleted successfully' }));
    } catch (err) {
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    }
  }
);

module.exports = router;