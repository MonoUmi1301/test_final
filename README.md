# Fleet OS — Fleet Management Platform

A production-grade fleet management dashboard built for logistics dispatchers.

---

## Tech Stack & Decisions

### Backend: Node.js + Express
**Why:** Zero boilerplate overhead, excellent `mysql2` ecosystem, async/await native. For a 3-hour constraint, Express gives the fastest path from schema to working endpoints without sacrificing architectural quality.

### Database: MySQL (via `mysql2/promise`)
**Why:** Matches the provided schema exactly. Connection pooling built-in. Transaction support is first-class and critical for atomicity requirements (mileage update + maintenance auto-create in a single `BEGIN/COMMIT`).

### Auth: JWT (access 15m / refresh 7d) + bcrypt
**Why:** Stateless access tokens allow horizontal scaling later. Refresh token pattern gives seamless UX — user never feels the 15-minute expiry. bcrypt with default rounds (10) provides standard protection without performance penalty.

### Alert Engine: Plugin/Registry Pattern
**Why the core never changes:** `alertEngine.js` only has `registerRule()` and `process()`. All 4 rules live in `alertRules.js` and are simply registered. Adding rule #5 = one `registerRule()` call in `alertRules.js`. The core (`alertEngine.js`) is never touched.

### Frontend: Vanilla JS + Tailwind CDN
**Why:** No build step = instantly runnable static files. The `api.js` shared module handles JWT refresh transparently across all pages. Clean separation: each page is a self-contained HTML file that imports `api.js` and `nav.js`.

### Design: Warm Gray + Sage Green
Inspired by quiet confidence — the palette that works when a dispatcher stares at it for 8 hours. `#F8F6F3` background, `#7C9A7E` sage accent, `#2A2724` near-black for text. DM Sans for body, DM Mono for IDs and numbers.

---

## Setup

### Prerequisites
- Node.js 18+
- MySQL 8+

### 1. Database
```sql
-- Run the provided Schema.sql
mysql -u root -p < Schema.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials and JWT secrets

npm install
npm start
# Or: npm run dev (with nodemon)

# Seed default users
npm run seed
# admin / admin1234
# dispatcher / dispatch1234
```

### 3. Frontend
Serve the `/frontend` directory with any static file server:
```bash
# Option A: Python
cd frontend && python3 -m http.server 8080

# Option B: VS Code Live Server, Nginx, etc.
```

Open `http://localhost:8080/login.html`

---

## Architecture Decisions & Trade-offs

### What I prioritized (given 3 hours)
1. **Correctness of business rules** — transactions, status transitions, sequence enforcement
2. **Consistent error schema** — `{ error: { code, message, details } }` on every single endpoint
3. **Pluggable alert engine** — architectural constraint satisfied without future debt
4. **UX polish** — optimistic updates with rollback, URL-synced filters, auto token refresh

### Acceptable trade-offs
- **No unit tests** — integration tests would require a test DB; acceptable for MVP
- **Frontend is MPA** (multi-page HTML), not SPA — simpler, zero build step, fast to ship
- **No rate limiting** — add `express-rate-limit` before production
- **Refresh token stored in sessionStorage** — httpOnly cookie is more secure but requires CORS cookie config; sessionStorage clears on tab close which is acceptable for dispatcher workstations
- **No WebSockets** — dashboard auto-refreshes every 60s instead of real-time push

---

## API Summary

### Auth
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/login` | — | bcrypt compare, returns JWT pair |
| POST | `/api/auth/refresh` | — | Returns new access token |
| POST | `/api/auth/logout` | Required | Audit log |
| GET | `/api/auth/me` | Required | Current user |

### Vehicles
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/vehicles` | All |
| POST | `/api/vehicles` | ADMIN |
| GET | `/api/vehicles/:id` | All |
| PATCH | `/api/vehicles/:id` | ADMIN, DISPATCHER |
| DELETE | `/api/vehicles/:id` | ADMIN only |
| GET | `/api/vehicles/:id/history` | All |

### Drivers
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/drivers` | All |
| POST | `/api/drivers` | ADMIN |
| PATCH | `/api/drivers/:id` | ADMIN |
| DELETE | `/api/drivers/:id` | ADMIN |

### Trips
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/trips` | All |
| POST | `/api/trips` | ADMIN, DISPATCHER |
| GET | `/api/trips/:id` | All |
| PATCH | `/api/trips/:id/start` | ADMIN, DISPATCHER |
| PATCH | `/api/trips/:id/complete` | ADMIN, DISPATCHER |
| PATCH | `/api/trips/:id/cancel` | ADMIN, DISPATCHER |

### Checkpoints
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/checkpoints?trip_id=` | All |
| POST | `/api/checkpoints` | ADMIN, DISPATCHER |
| PATCH | `/api/checkpoints/:id/status` | ADMIN, DISPATCHER |

### Maintenance
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/maintenance` | All |
| POST | `/api/maintenance` | ADMIN |
| GET | `/api/maintenance/:id` | All |
| PATCH | `/api/maintenance/:id` | ADMIN |

### Alerts & Dashboard
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/alerts?severity=&resource_type=` | Plugin engine |
| GET | `/api/dashboard/metrics` | Summary cards |
| GET | `/api/dashboard/vehicles-by-status` | Donut chart data |
| GET | `/api/dashboard/trip-distance-trend` | 7-day line chart |
| GET | `/api/dashboard/active-trips` | Live trip map |
| GET | `/api/audit-logs` | DISPATCHER: own only |

---

## Constraints Satisfied

| Constraint | How |
|-----------|-----|
| MySQL จริง | `mysql2/promise` pool, real queries |
| Alert engine ต้องเพิ่ม rule ใหม่ได้โดยไม่แก้ core | `alertEngine.js` = pure registry, rules in separate file |
| bcrypt | `bcryptjs` with 10 rounds |
| JWT + refresh | 15m access / 7d refresh, auto-refresh in `api.js` |
| Error schema เดียวกัน | `utils/response.js` `errorResponse()` everywhere |
| Transaction — mileage + maintenance | `conn.beginTransaction()` in `PATCH /trips/:id/complete` |
| Filter → URL → restore on reload | All filter pages sync to `?params` and read on load |
| Status transition block + message | Vehicle patch returns `{ allowed_transitions: [] }` |
| Trip progress visual | Checkpoint step indicator with color coding + optimistic update |
