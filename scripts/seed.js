require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'fleet_db',
};

async function seed() {
  console.log('--- Starting Seed Process ---');
  console.log(`Connecting to ${dbConfig.host}:${dbConfig.port}...`);

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('[DB] Connection verified.');

    // ── Users ──────────────────────────────────────────────
    const adminHash    = await bcrypt.hash('admin1234', 10);
    const dispatchHash = await bcrypt.hash('dispatch1234', 10);

    await conn.execute(
      `INSERT IGNORE INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'admin', adminHash, 'ADMIN']
    );
    await conn.execute(
      `INSERT IGNORE INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)`,
      [uuidv4(), 'dispatcher', dispatchHash, 'DISPATCHER']
    );
    console.log('✅ Users seeded');

    // ── Drivers ────────────────────────────────────────────
    const drivers = [
      { id: uuidv4(), name: 'สมชาย ใจดี',       license: 'DRV-001', expires: '2026-12-31', phone: '0811111111' },
      { id: uuidv4(), name: 'วิชัย แข็งแกร่ง',   license: 'DRV-002', expires: '2025-06-30', phone: '0822222222' },
      { id: uuidv4(), name: 'ประสิทธิ์ เร็วไว',  license: 'DRV-003', expires: '2027-03-15', phone: '0833333333' },
      { id: uuidv4(), name: 'มานะ อดทน',         license: 'DRV-004', expires: '2025-04-10', phone: '0844444444' },
      { id: uuidv4(), name: 'สุรชัย ขยัน',       license: 'DRV-005', expires: '2026-09-20', phone: '0855555555' },
    ];

    for (const d of drivers) {
      await conn.execute(
        `INSERT IGNORE INTO drivers (id, name, license_number, license_expires_at, phone, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [d.id, d.name, d.license, d.expires, d.phone]
      );
    }
    console.log('✅ Drivers seeded');

    // ── Vehicles ───────────────────────────────────────────
    const vehicles = [
      { id: uuidv4(), plate: 'กข-1234',  type: 'TRUCK',      status: 'ACTIVE',      driver: drivers[0].id, brand: 'Isuzu',      model: 'D-Max',   year: 2020, fuel: 'DIESEL',   mileage: 45230,  lastSvc: 40000,  nextSvc: 50000  },
      { id: uuidv4(), plate: 'ขค-5678',  type: 'VAN',        status: 'IDLE',        driver: drivers[1].id, brand: 'Toyota',     model: 'Commuter',year: 2021, fuel: 'DIESEL',   mileage: 28500,  lastSvc: 25000,  nextSvc: 30000  },
      { id: uuidv4(), plate: 'คง-9012',  type: 'PICKUP',     status: 'MAINTENANCE', driver: null,          brand: 'Ford',       model: 'Ranger',  year: 2019, fuel: 'DIESEL',   mileage: 72000,  lastSvc: 70000,  nextSvc: 75000  },
      { id: uuidv4(), plate: 'งจ-3456',  type: 'MOTORCYCLE', status: 'IDLE',        driver: drivers[2].id, brand: 'Honda',      model: 'CRF300L', year: 2022, fuel: 'GASOLINE', mileage: 12000,  lastSvc: 10000,  nextSvc: 15000  },
      { id: uuidv4(), plate: 'จฉ-7890',  type: 'TRUCK',      status: 'ACTIVE',      driver: drivers[3].id, brand: 'Hino',       model: '700',     year: 2018, fuel: 'DIESEL',   mileage: 98000,  lastSvc: 95000,  nextSvc: 100000 },
      { id: uuidv4(), plate: 'ฉช-2345',  type: 'VAN',        status: 'IDLE',        driver: drivers[4].id, brand: 'Nissan',     model: 'Urvan',   year: 2023, fuel: 'DIESEL',   mileage: 8500,   lastSvc: 5000,   nextSvc: 10000  },
      { id: uuidv4(), plate: 'ชซ-6789',  type: 'PICKUP',     status: 'RETIRED',     driver: null,          brand: 'Mitsubishi', model: 'Triton',  year: 2015, fuel: 'DIESEL',   mileage: 210000, lastSvc: 205000, nextSvc: null   },
    ];

    for (const v of vehicles) {
      await conn.execute(
        `INSERT IGNORE INTO vehicles
           (id, license_plate, type, status, driver_id, brand, model, year, fuel_type, mileage_km, last_service_km, next_service_km)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, v.plate, v.type, v.status, v.driver, v.brand, v.model, v.year, v.fuel, v.mileage, v.lastSvc, v.nextSvc]
      );
    }
    console.log('✅ Vehicles seeded');

    // ── Trips ──────────────────────────────────────────────
    const trip1Id = uuidv4();
    const trip2Id = uuidv4();
    const trip3Id = uuidv4();
    const trip4Id = uuidv4();

    const trips = [
      { id: trip1Id, vehicle: vehicles[0].id, driver: drivers[0].id, status: 'COMPLETED',   origin: 'กรุงเทพฯ', destination: 'เชียงใหม่', distance: 696, cargo: 'GENERAL',     weight: 1500, started: '2026-03-20 08:00:00', ended: '2026-03-20 22:00:00' },
      { id: trip2Id, vehicle: vehicles[1].id, driver: drivers[1].id, status: 'COMPLETED',   origin: 'กรุงเทพฯ', destination: 'ขอนแก่น',   distance: 445, cargo: 'FRAGILE',      weight: 800,  started: '2026-03-22 07:00:00', ended: '2026-03-22 16:30:00' },
      { id: trip3Id, vehicle: vehicles[0].id, driver: drivers[0].id, status: 'IN_PROGRESS', origin: 'กรุงเทพฯ', destination: 'ภูเก็ต',    distance: 862, cargo: 'REFRIGERATED', weight: 2000, started: '2026-03-29 06:00:00', ended: null },
      { id: trip4Id, vehicle: vehicles[4].id, driver: drivers[3].id, status: 'SCHEDULED',   origin: 'กรุงเทพฯ', destination: 'หาดใหญ่',   distance: 950, cargo: 'HAZARDOUS',    weight: 3000, started: null,                  ended: null },
    ];

    for (const t of trips) {
      await conn.execute(
        `INSERT IGNORE INTO trips
           (id, vehicle_id, driver_id, status, origin, destination, distance_km, cargo_type, cargo_weight_kg, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.vehicle, t.driver, t.status, t.origin, t.destination, t.distance, t.cargo, t.weight, t.started, t.ended]
      );
    }
    console.log('✅ Trips seeded');

    // ── Checkpoints ────────────────────────────────────────
    const checkpoints = [
      { id: uuidv4(), trip: trip1Id, seq: 1, name: 'นครสวรรค์',       lat: 15.7047, lng: 100.1372, purpose: 'FUEL',     status: 'DEPARTED', arrived: '2026-03-20 11:00:00', departed: '2026-03-20 11:30:00' },
      { id: uuidv4(), trip: trip1Id, seq: 2, name: 'ลำปาง',           lat: 18.2888, lng: 99.4878,  purpose: 'REST',     status: 'DEPARTED', arrived: '2026-03-20 16:00:00', departed: '2026-03-20 16:45:00' },
      { id: uuidv4(), trip: trip1Id, seq: 3, name: 'เชียงใหม่',       lat: 18.7883, lng: 98.9853,  purpose: 'DELIVERY', status: 'DEPARTED', arrived: '2026-03-20 20:00:00', departed: '2026-03-20 22:00:00' },
      { id: uuidv4(), trip: trip2Id, seq: 1, name: 'สระบุรี',         lat: 14.5289, lng: 100.9106, purpose: 'FUEL',     status: 'DEPARTED', arrived: '2026-03-22 09:00:00', departed: '2026-03-22 09:20:00' },
      { id: uuidv4(), trip: trip2Id, seq: 2, name: 'นครราชสีมา',      lat: 14.9799, lng: 102.0978, purpose: 'REST',     status: 'DEPARTED', arrived: '2026-03-22 12:00:00', departed: '2026-03-22 12:40:00' },
      { id: uuidv4(), trip: trip3Id, seq: 1, name: 'ประจวบคีรีขันธ์', lat: 11.8126, lng: 99.7957,  purpose: 'FUEL',     status: 'ARRIVED',  arrived: '2026-03-29 12:00:00', departed: null },
      { id: uuidv4(), trip: trip3Id, seq: 2, name: 'ชุมพร',           lat: 10.4930, lng: 99.1800,  purpose: 'REST',     status: 'PENDING',  arrived: null, departed: null },
      { id: uuidv4(), trip: trip3Id, seq: 3, name: 'ภูเก็ต',          lat: 7.8804,  lng: 98.3923,  purpose: 'DELIVERY', status: 'PENDING',  arrived: null, departed: null },
      { id: uuidv4(), trip: trip4Id, seq: 1, name: 'ชุมพร',           lat: 10.4930, lng: 99.1800,  purpose: 'FUEL',     status: 'PENDING',  arrived: null, departed: null },
      { id: uuidv4(), trip: trip4Id, seq: 2, name: 'หาดใหญ่',         lat: 7.0086,  lng: 100.4747, purpose: 'DELIVERY', status: 'PENDING',  arrived: null, departed: null },
    ];

    for (const cp of checkpoints) {
      await conn.execute(
        `INSERT IGNORE INTO checkpoints
           (id, trip_id, sequence, status, location_name, latitude, longitude, purpose, arrived_at, departed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cp.id, cp.trip, cp.seq, cp.status, cp.name, cp.lat, cp.lng, cp.purpose, cp.arrived, cp.departed]
      );
    }
    console.log('✅ Checkpoints seeded');

    // ── Maintenance ────────────────────────────────────────
    const maintenances = [
      { id: uuidv4(), vehicle: vehicles[2].id, status: 'IN_PROGRESS', type: 'ENGINE',     scheduled: '2026-03-25 09:00:00', tech: 'ช่างสมชาย',    cost: 15000, notes: 'เปลี่ยนเครื่องยนต์' },
      { id: uuidv4(), vehicle: vehicles[0].id, status: 'SCHEDULED',   type: 'OIL_CHANGE', scheduled: '2026-04-05 09:00:00', tech: 'ช่างวิชัย',     cost: 2500,  notes: 'เปลี่ยนถ่ายน้ำมันเครื่อง' },
      { id: uuidv4(), vehicle: vehicles[4].id, status: 'SCHEDULED',   type: 'TIRE',       scheduled: '2026-03-20 09:00:00', tech: 'ช่างประสิทธิ์', cost: 8000,  notes: 'เปลี่ยนยางทั้ง 4 เส้น' },
      { id: uuidv4(), vehicle: vehicles[1].id, status: 'COMPLETED',   type: 'BRAKE',      scheduled: '2026-03-01 09:00:00', tech: 'ช่างมานะ',      cost: 4500,  notes: 'เปลี่ยนผ้าเบรก' },
      { id: uuidv4(), vehicle: vehicles[3].id, status: 'SCHEDULED',   type: 'INSPECTION', scheduled: '2026-04-15 09:00:00', tech: null,             cost: null,  notes: 'ตรวจสภาพประจำปี' },
    ];

    for (const m of maintenances) {
      await conn.execute(
        `INSERT IGNORE INTO maintenance
           (id, vehicle_id, status, type, scheduled_at, technician, cost_thb, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.vehicle, m.status, m.type, m.scheduled, m.tech, m.cost, m.notes]
      );
    }
    console.log('✅ Maintenance seeded');

    console.log('\n✅ All seed data inserted successfully!');
    console.log('─────────────────────────────────────');
    console.log('👤 admin      / admin1234');
    console.log('👤 dispatcher / dispatch1234');
    console.log(`🚛 ${vehicles.length} vehicles | 🧑 ${drivers.length} drivers | 🗺️  ${trips.length} trips`);

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error(`เชื่อมต่อไม่ได้ที่ ${dbConfig.host}:${dbConfig.port} — ตรวจสอบว่า Docker รันอยู่`);
    }
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

seed();