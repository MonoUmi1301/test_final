const alertEngine = require('./alertEngine');

// Rule 1: Vehicle mileage exceeds next_service_km → "Vehicle Due for Service"
// ตรวจสอบจากตาราง vehicles โดยตรง (ข้อ 4.1)
alertEngine.registerRule(async (db) => {
  const [rows] = await db.execute(
    `SELECT id, license_plate, mileage_km, next_service_km
     FROM vehicles
     WHERE status != 'RETIRED' 
       AND next_service_km IS NOT NULL 
       AND mileage_km >= next_service_km`
  );
  return rows.map(v => ({
    severity: 'CRITICAL',
    affected_resource_type: 'VEHICLE',
    affected_resource_id: v.id,
    message: `Vehicle ${v.license_plate} is due for service (${v.mileage_km.toLocaleString()} / ${v.next_service_km.toLocaleString()} km)`,
  }));
});

// Rule 2: Maintenance OVERDUE by > 3 days (ข้อ 4.3)
// แก้ไขให้เช็คทั้งสถานะ SCHEDULED และ OVERDUE เพื่อให้ Alert ไม่หายไปเมื่อมีการเปลี่ยนสถานะ
alertEngine.registerRule(async (db) => {
  const [rows] = await db.execute(
    `SELECT m.id, m.vehicle_id, m.scheduled_at, v.license_plate
     FROM maintenance m
     JOIN vehicles v ON m.vehicle_id = v.id
     WHERE m.status IN ('SCHEDULED', 'OVERDUE') 
       AND m.scheduled_at < DATE_SUB(NOW(), INTERVAL 3 DAY)`
  );
  return rows.map(m => ({
    severity: 'CRITICAL',
    affected_resource_type: 'MAINTENANCE',
    affected_resource_id: m.id,
    message: `Maintenance for vehicle ${m.license_plate} is overdue (scheduled: ${new Date(m.scheduled_at).toLocaleDateString()})`,
  }));
});

// Rule 3: Driver license expires within 30 days (ข้อ 4.1)
// Rule 3: ปรับปรุงให้เช็คคนที่หมดอายุแล้วด้วย
alertEngine.registerRule(async (db) => {
  const [rows] = await db.execute(
    `SELECT id, name, license_number, license_expires_at
     FROM drivers
     WHERE status = 'ACTIVE'
       AND license_expires_at <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)` // ✅ เปลี่ยนเป็น <= เพื่อเอาคนที่หมดไปแล้วด้วย
  );
  
  return rows.map(d => {
    const isExpired = new Date(d.license_expires_at) < new Date();
    return {
      severity: isExpired ? 'CRITICAL' : 'WARNING', // ✅ ถ้าหมดแล้วให้เป็นสีแดง (Critical)
      affected_resource_type: 'DRIVER',
      affected_resource_id: d.id,
      message: isExpired 
        ? `Driver ${d.name} license HAS EXPIRED!` 
        : `Driver ${d.name} license expires soon (${new Date(d.license_expires_at).toLocaleDateString()})`,
    };
  });
});
// Rule 4: Trip IN_PROGRESS duration exceeds 150% of estimated (ข้อ 4.1)
alertEngine.registerRule(async (db) => {
  const [rows] = await db.execute(
    `SELECT id, vehicle_id, driver_id, started_at, distance_km
     FROM trips
     WHERE status = 'IN_PROGRESS' AND started_at IS NOT NULL`
  );
  
  const delayed = [];
  const now = new Date();
  
  for (const t of rows) {
    // ถ้าไม่มีระยะทาง ให้ข้ามการเช็ค Rule นี้ (หรืออาจตั้งเป็นค่า Default)
    if (!t.distance_km) {
      console.warn(`[AlertRule] Trip ${t.id} skipped delay check: no distance_km`);
      continue;
    }

    // Estimate: ความเร็วเฉลี่ย 60 km/h → เวลาที่ควรใช้ (ชั่วโมง)
    const estimatedHours = t.distance_km / 60;
    const elapsedHours = (now - new Date(t.started_at)) / (1000 * 3600);
    
    // ถ้าใช้เวลาเกิน 1.5 เท่าของที่คาดการณ์ไว้
    if (elapsedHours > estimatedHours * 1.5) {
      delayed.push({
        severity: 'WARNING',
        affected_resource_type: 'TRIP',
        affected_resource_id: t.id,
        message: `Trip ${t.id} is delayed (elapsed ${elapsedHours.toFixed(1)}h vs estimated ${estimatedHours.toFixed(1)}h)`,
      });
    }
  }
  return delayed;
});