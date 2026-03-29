const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const auth = require('../middleware/auth');
const auditLog = require('../middleware/audit');
const { errorResponse, successResponse } = require('../utils/response');

// POST /api/trips — create trip (ข้อ 3.1)
router.post(
  '/',
  auth(['ADMIN', 'DISPATCHER']),
  auditLog('CREATE_TRIP', 'TRIP', (req, body) => body?.data?.id),
  async (req, res) => {
    const {
      vehicle_id, driver_id, origin, destination,
      distance_km, cargo_type, cargo_weight_kg, checkpoints = [],
    } = req.body;

    const errors = {};
    if (!vehicle_id) errors.vehicle_id = 'required';
    if (!driver_id) errors.driver_id = 'required';
    if (!origin) errors.origin = 'required';
    if (!destination) errors.destination = 'required';
    if (Object.keys(errors).length)
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', errors));

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Check vehicle has no active trip (ข้อ 3.1)
      const [activeTrips] = await conn.execute(
        "SELECT id FROM trips WHERE vehicle_id = ? AND status = 'IN_PROGRESS'",
        [vehicle_id]
      );
      if (activeTrips.length > 0) {
        await conn.rollback();
        return res.status(409).json(
          errorResponse('VEHICLE_BUSY', 'Vehicle already has an active trip in progress')
        );
      }

      // Check vehicle exists and is not MAINTENANCE/RETIRED
      const [vehicles] = await conn.execute('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
      if (!vehicles[0]) { await conn.rollback(); return res.status(404).json(errorResponse('NOT_FOUND', 'Vehicle not found')); }
      if (['MAINTENANCE', 'RETIRED'].includes(vehicles[0].status)) {
        await conn.rollback();
        return res.status(409).json(errorResponse('VEHICLE_UNAVAILABLE', `Vehicle is ${vehicles[0].status}`));
      }

      // Check driver license
      const [drivers] = await conn.execute('SELECT * FROM drivers WHERE id = ?', [driver_id]);
      if (!drivers[0]) { await conn.rollback(); return res.status(404).json(errorResponse('NOT_FOUND', 'Driver not found')); }
      if (new Date(drivers[0].license_expires_at) < new Date()) {
        await conn.rollback();
        return res.status(400).json(errorResponse('DRIVER_LICENSE_EXPIRED', 'Driver license has expired'));
      }

      const tripId = uuidv4();
      await conn.execute(
        `INSERT INTO trips (id, vehicle_id, driver_id, status, origin, destination, distance_km, cargo_type, cargo_weight_kg)
         VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?)`,
        [tripId, vehicle_id, driver_id, origin, destination,
         distance_km || null, cargo_type || null, cargo_weight_kg || null]
      );

      // Update vehicle status to ACTIVE and assign driver
      await conn.execute("UPDATE vehicles SET status = 'ACTIVE', driver_id = ? WHERE id = ?", [driver_id, vehicle_id]);

      // Insert checkpoints if provided
      for (let i = 0; i < checkpoints.length; i++) {
        const cp = checkpoints[i];
        await conn.execute(
          `INSERT INTO checkpoints (id, trip_id, sequence, status, location_name, latitude, longitude, purpose, notes)
           VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
          [uuidv4(), tripId, i + 1, cp.location_name, cp.latitude || null,
           cp.longitude || null, cp.purpose || null, cp.notes || null]
        );
      }

      await conn.commit();
      return res.status(201).json(successResponse({ id: tripId, status: 'SCHEDULED' }));
    } catch (err) {
      await conn.rollback();
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    } finally {
      conn.release();
    }
  }
);

// GET /api/trips
router.get('/', auth(), async (req, res) => {
  const { status, vehicle_id, driver_id } = req.query;
  let query = `
    SELECT t.*, v.license_plate, v.type as vehicle_type, d.name as driver_name
    FROM trips t
    LEFT JOIN vehicles v ON t.vehicle_id = v.id
    LEFT JOIN drivers d ON t.driver_id = d.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (vehicle_id) { query += ' AND t.vehicle_id = ?'; params.push(vehicle_id); }
  if (driver_id) { query += ' AND t.driver_id = ?'; params.push(driver_id); }
  query += ' ORDER BY t.created_at DESC';

  try {
    const [rows] = await db.execute(query, params);
    return res.json(successResponse(rows));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// GET /api/trips/:id with checkpoints
router.get('/:id', auth(), async (req, res) => {
  try {
    const [trips] = await db.execute(
      `SELECT t.*, v.license_plate, v.type as vehicle_type, d.name as driver_name
       FROM trips t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       LEFT JOIN drivers d ON t.driver_id = d.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!trips[0]) return res.status(404).json(errorResponse('NOT_FOUND', 'Trip not found'));

    const [checkpoints] = await db.execute(
      'SELECT * FROM checkpoints WHERE trip_id = ? ORDER BY sequence ASC',
      [req.params.id]
    );
    return res.json(successResponse({ ...trips[0], checkpoints }));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// PATCH /api/trips/:id/start
router.patch(
  '/:id/start',
  auth(['ADMIN', 'DISPATCHER']),
  auditLog('START_TRIP', 'TRIP'),
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [trips] = await conn.execute('SELECT * FROM trips WHERE id = ?', [req.params.id]);
      if (!trips[0]) { await conn.rollback(); return res.status(404).json(errorResponse('NOT_FOUND', 'Trip not found')); }
      if (trips[0].status !== 'SCHEDULED') {
        await conn.rollback();
        return res.status(409).json(errorResponse('INVALID_STATUS', 'Only SCHEDULED trips can be started'));
      }

      await conn.execute(
        "UPDATE trips SET status = 'IN_PROGRESS', started_at = NOW() WHERE id = ?",
        [req.params.id]
      );
      await conn.commit();
      return res.json(successResponse({ message: 'Trip started', status: 'IN_PROGRESS' }));
    } catch (err) {
      await conn.rollback();
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    } finally { conn.release(); }
  }
);

// PATCH /api/trips/:id/complete — update mileage + check service (ข้อ 3.1)
router.patch(
  '/:id/complete',
  auth(['ADMIN', 'DISPATCHER']),
  auditLog('COMPLETE_TRIP', 'TRIP'),
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [trips] = await conn.execute('SELECT * FROM trips WHERE id = ?', [req.params.id]);
      if (!trips[0]) { await conn.rollback(); return res.status(404).json(errorResponse('NOT_FOUND', 'Trip not found')); }
      if (trips[0].status !== 'IN_PROGRESS') {
        await conn.rollback();
        return res.status(409).json(errorResponse('INVALID_STATUS', 'Only IN_PROGRESS trips can be completed'));
      }

      const { vehicle_id, distance_km } = trips[0];

      // 1. Update trip status
      await conn.execute(
        "UPDATE trips SET status = 'COMPLETED', ended_at = NOW() WHERE id = ?",
        [req.params.id]
      );

      // 2. Update mileage
      await conn.execute(
        'UPDATE vehicles SET mileage_km = mileage_km + ? WHERE id = ?',
        [distance_km || 0, vehicle_id]
      );

      // 3. Check for auto maintenance
      const [vehicles] = await conn.execute('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
      const v = vehicles[0];
      let newStatus = 'IDLE';
      let maintenanceCreated = false;

      if (v.next_service_km && v.mileage_km >= v.next_service_km) {
        newStatus = 'MAINTENANCE';
        await conn.execute(
          `INSERT INTO maintenance (id, vehicle_id, status, type, scheduled_at, mileage_at_service, notes)
           VALUES (?, ?, 'SCHEDULED', 'INSPECTION', NOW(), ?, 'Auto-created: mileage exceeded service threshold')`,
          [uuidv4(), vehicle_id, v.mileage_km]
        );
        maintenanceCreated = true;
      }

      // 4. Update vehicle status and RESET driver_id (เพื่อให้รถว่าง)
      await conn.execute(
        "UPDATE vehicles SET status = ?, driver_id = NULL WHERE id = ?", 
        [newStatus, vehicle_id]
      );

      await conn.commit();

      return res.json(successResponse({
        message: 'Trip completed',
        vehicle_status: newStatus,
        maintenance_scheduled: maintenanceCreated,
      }));
    } catch (err) {
      await conn.rollback();
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    } finally { conn.release(); }
  }
);

// PATCH /api/trips/:id/cancel
router.patch(
  '/:id/cancel',
  auth(['ADMIN', 'DISPATCHER']),
  auditLog('CANCEL_TRIP', 'TRIP'),
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [trips] = await conn.execute('SELECT * FROM trips WHERE id = ?', [req.params.id]);
      if (!trips[0]) { await conn.rollback(); return res.status(404).json(errorResponse('NOT_FOUND', 'Trip not found')); }
      if (!['SCHEDULED', 'IN_PROGRESS'].includes(trips[0].status)) {
        await conn.rollback();
        return res.status(409).json(errorResponse('INVALID_STATUS', 'Cannot cancel this trip'));
      }

      await conn.execute("UPDATE trips SET status = 'CANCELLED', ended_at = NOW() WHERE id = ?", [req.params.id]);
      
      // Reset vehicle status to IDLE and RESET driver_id เมื่อยกเลิก trip
      await conn.execute("UPDATE vehicles SET status = 'IDLE', driver_id = NULL WHERE id = ?", [trips[0].vehicle_id]);
      
      await conn.commit();
      return res.json(successResponse({ message: 'Trip cancelled', status: 'CANCELLED' }));
    } catch (err) {
      await conn.rollback();
      return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
    } finally { conn.release(); }
  }
);

module.exports = router;