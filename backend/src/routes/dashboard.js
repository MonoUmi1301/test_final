const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../utils/db');
const { errorResponse, successResponse } = require('../utils/response');

// GET /api/dashboard/metrics — summary cards (ข้อ 5.1)
router.get('/metrics', auth(), async (req, res) => {
  try {
    const [[{ total_vehicles }]] = await db.execute('SELECT COUNT(*) as total_vehicles FROM vehicles WHERE status != "RETIRED"');
    const [[{ active_trips_today }]] = await db.execute(
      `SELECT COUNT(*) as active_trips_today FROM trips
       WHERE status = 'IN_PROGRESS' AND DATE(started_at) = CURDATE()`
    );
    const [[{ total_distance_today }]] = await db.execute(
      `SELECT COALESCE(SUM(distance_km), 0) as total_distance_today FROM trips
       WHERE status = 'COMPLETED' AND DATE(ended_at) = CURDATE()`
    );
    const [[{ maintenance_overdue }]] = await db.execute(
      `SELECT COUNT(*) as maintenance_overdue FROM maintenance
       WHERE status = 'SCHEDULED' AND scheduled_at < DATE_SUB(NOW(), INTERVAL 3 DAY)`
    );

    return res.json(successResponse({
      total_vehicles,
      active_trips_today,
      total_distance_today: parseFloat(total_distance_today),
      maintenance_overdue,
    }));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// GET /api/dashboard/vehicles-by-status — pie chart data (ข้อ 5.2)
router.get('/vehicles-by-status', auth(), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT status, COUNT(*) as count FROM vehicles GROUP BY status`
    );
    return res.json(successResponse(rows));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// GET /api/dashboard/trip-distance-trend — 7 day line chart (ข้อ 5.2)
router.get('/trip-distance-trend', auth(), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
          DATE(ended_at) as date,
          COUNT(*) as trip_count,
          COALESCE(SUM(distance_km), 0) as total_distance
        FROM trips
        WHERE status = 'COMPLETED'
          AND ended_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(ended_at)
        ORDER BY date ASC`
    );

    // Fill in missing days with zeros
    const trend = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      // ✅ แก้ไขให้เปรียบเทียบวันที่อย่างแม่นยำ (Consistent comparison)
      const found = rows.find(r => {
        if (!r.date) return false;
        const rowDate = r.date instanceof Date 
          ? r.date.toISOString().slice(0, 10) 
          : String(r.date).slice(0, 10);
        return rowDate === dateStr;
      });

      trend.push({
        date: dateStr,
        trip_count: found ? found.trip_count : 0,
        total_distance: found ? parseFloat(found.total_distance) : 0,
      });
    }

    return res.json(successResponse(trend));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

// GET /api/dashboard/active-trips — for live map view
router.get('/active-trips', auth(), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.id, t.vehicle_id, t.driver_id, t.origin, t.destination,
              t.status, t.started_at, t.distance_km, t.cargo_type,
              v.license_plate, v.type as vehicle_type,
              d.name as driver_name,
              (SELECT c.latitude FROM checkpoints c
               WHERE c.trip_id = t.id AND c.status IN ('ARRIVED','DEPARTED')
               ORDER BY c.sequence DESC LIMIT 1) as last_lat,
              (SELECT c.longitude FROM checkpoints c
               WHERE c.trip_id = t.id AND c.status IN ('ARRIVED','DEPARTED')
               ORDER BY c.sequence DESC LIMIT 1) as last_lng
       FROM trips t
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       LEFT JOIN drivers d ON t.driver_id = d.id
       WHERE t.status = 'IN_PROGRESS'`
    );
    return res.json(successResponse(rows));
  } catch (err) {
    return res.status(500).json(errorResponse('SERVER_ERROR', err.message));
  }
});

module.exports = router;