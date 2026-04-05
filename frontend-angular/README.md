# Fleet OS — Angular Frontend

แปลง frontend จาก HTML/Vanilla JS → **Angular 17** (Standalone Components)

## โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── core/
│   │   ├── guards/
│   │   │   └── auth.guard.ts          # ป้องกัน route สำหรับผู้ไม่ได้ login
│   │   ├── interceptors/
│   │   │   └── auth.interceptor.ts    # Auto token refresh (เหมือน apiFetch เดิม)
│   │   ├── services/
│   │   │   ├── api.service.ts         # HTTP wrapper (เทียบเท่า api.js เดิม)
│   │   │   ├── auth.service.ts        # จัดการ session/token
│   │   │   ├── theme.service.ts       # Dark/Light mode
│   │   │   └── toast.service.ts       # Toast notifications
│   │   └── models.ts                  # TypeScript interfaces ทุกตัว
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── sidebar.component.ts   # Sidebar nav (เทียบเท่า nav.js เดิม)
│   │   │   ├── main-layout.component.ts
│   │   │   └── toast.component.ts
│   │   └── pipes/
│   │       └── format.pipes.ts        # fmt.date / fmt.km / fmt.thb / etc.
│   │
│   ├── features/
│   │   ├── login/        → login.component.ts
│   │   ├── dashboard/    → dashboard.component.ts
│   │   ├── vehicles/     → vehicles.component.ts
│   │   ├── drivers/      → drivers.component.ts
│   │   ├── trips/        → trips.component.ts
│   │   ├── maintenance/  → maintenance.component.ts
│   │   └── audit/        → audit.component.ts
│   │
│   ├── app.component.ts
│   ├── app.config.ts     # provideRouter, provideHttpClient (withInterceptors)
│   └── app.routes.ts     # Lazy-loadable routes + authGuard
│
├── environments/
│   ├── environment.ts          # { apiUrl: '/api' }
│   └── environment.prod.ts
└── styles.scss                 # Global styles (port จาก fleet.css)
```

## ความแตกต่างจาก HTML เดิม

| เดิม (HTML/Vanilla JS) | ใหม่ (Angular 17) |
|---|---|
| `api.js` — global fetch wrapper | `ApiService` + `HttpClient` |
| `nav.js` — DOM injection | `SidebarComponent` |
| `requireAuth()` | `AuthGuard` (CanActivateFn) |
| Token refresh ใน `apiFetch` | `AuthInterceptor` (HttpInterceptorFn) |
| `fmt.date()`, `fmt.km()` | Angular Pipes: `fmtDate`, `fmtKm`, `fmtThb` |
| `toast()` function | `ToastService` + `ToastComponent` |
| `initTheme()` / `toggleTheme()` | `ThemeService` |
| Multi-page HTML | Single Page App (SPA) + Router |
| `sessionStorage` การจัดการโดยตรง | `AuthService` (encapsulated) |
| Chart.js ใน `<script>` | Chart.js ใน `DashboardComponent` lifecycle |

## วิธีติดตั้งและรัน

### 1. ติดตั้ง dependencies
```bash
cd fleet-angular
npm install
```

### 2. รัน Backend ก่อน
```bash
cd ../backend
npm install
npm start
# Backend รันที่ port 3000
```

### 3. รัน Angular Dev Server
```bash
cd ../fleet-angular
npm start
# Angular รันที่ http://localhost:4200
# Proxy /api → http://localhost:3000/api (proxy.conf.json)
```

### 4. Build สำหรับ Production
```bash
npm run build:prod
# Output: dist/fleet-angular/
```

## การ Deploy

### Docker (รวมกับ backend เดิม)

เพิ่มใน `docker-compose.yml`:
```yaml
frontend:
  build:
    context: ./fleet-angular
    dockerfile: Dockerfile
  ports:
    - "4200:80"
  depends_on:
    - backend
```

สร้าง `fleet-angular/Dockerfile`:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:prod

FROM nginx:alpine
COPY --from=build /app/dist/fleet-angular/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

สร้าง `fleet-angular/nginx.conf`:
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://backend:3000/api/;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `apiUrl` | `/api` | Base URL ของ Backend API |

แก้ใน `src/environments/environment.ts` สำหรับ dev  
แก้ใน `src/environments/environment.prod.ts` สำหรับ production
