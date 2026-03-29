/**
 * Fleet OS — Shared API client with automatic token refresh.
 * Include BEFORE page-specific scripts.
 */

const FLEET_API_URL = window.FLEET_API_URL || 'http://localhost:3000/api';

// ── Auth helpers ──────────────────────────────────────────────
function getToken()         { return sessionStorage.getItem('accessToken'); }
function getRefreshToken() { return sessionStorage.getItem('refreshToken'); }
function getUser()          { try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; } }

function forceLogout(expired = false) {
  sessionStorage.clear();
  window.location.href = `login.html${expired ? '?expired=1' : ''}`;
}

// ── Core fetch with auto-refresh (บรีฟ 1.4) ──────────────────────────
let _refreshing = null;

async function apiFetch(path, options = {}) {
  const doReq = (token) => fetch(`${FLEET_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  let res = await doReq(getToken());

  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    const code = body.error?.code;

    // refresh token หมดหรือ invalid → logout ทันที
    if (code === 'REFRESH_EXPIRED' || code === 'INVALID_TOKEN' || code === 'UNAUTHORIZED') {
      forceLogout(true);
      throw new Error('Session expired');
    }

    // access token หมด → ขอ token ใหม่แล้ว retry
    if (code === 'TOKEN_EXPIRED') {
      if (!_refreshing) {
        _refreshing = fetch(`${FLEET_API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: getRefreshToken() }),
        }).then(r => r.json()).finally(() => { _refreshing = null; });
      }

      const rd = await _refreshing;
      if (rd?.data?.accessToken) {
        sessionStorage.setItem('accessToken', rd.data.accessToken);
        res = await doReq(rd.data.accessToken);
      } else {
        forceLogout(true);
        throw new Error('Session expired');
      }
    }
  }
  
  return res;
}

const api = {
  get:     (p)    => apiFetch(p),
  post:    (p, b) => apiFetch(p, { method: 'POST',   body: JSON.stringify(b) }),
  patch:   (p, b) => apiFetch(p, { method: 'PATCH',  body: JSON.stringify(b) }),
  delete: (p)    => apiFetch(p, { method: 'DELETE' }),

  async json(path, options) {
    const res  = await apiFetch(path, options);
    const data = await res.json();
    if (!res.ok) throw Object.assign(
      new Error(data.error?.message || 'API error'),
      { code: data.error?.code, details: data.error?.details, status: res.status }
    );
    return data.data;
  },
  async getJSON(p)    { return this.json(p); },
  async postJSON(p,b) { return this.json(p, { method: 'POST',  body: JSON.stringify(b) }); },
  async patchJSON(p,b){ return this.json(p, { method: 'PATCH', body: JSON.stringify(b) }); },
  async deleteJSON(p) { return this.json(p, { method: 'DELETE' }); },
};

function requireAuth() {
  const token = getToken();
  const expiresAt = sessionStorage.getItem('expiresAt');

  if (!token) { forceLogout(); return false; }

  // ตรวจสอบเวลาหมดอายุของ Session (อ้างอิงตาม Refresh Token 7 วัน)
  if (expiresAt && Date.now() > parseInt(expiresAt)) {
    forceLogout(true);
    return false;
  }

  return true;
}

// ── Format helpers ─────────────────────────────────────────────
const fmt = {
  date(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('th-TH', { day:'2-digit', month:'short', year:'numeric' });
  },
  datetime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('th-TH', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  },
  km(n)  { if (n == null) return '—'; return Number(n).toLocaleString() + ' km'; },
  thb(n) { if (n == null) return '—'; return '฿' + Number(n).toLocaleString(undefined, { minimumFractionDigits:2 }); },
  relative(d) {
    if (!d) return '—';
    const s = (new Date() - new Date(d)) / 1000;
    if (s < 60)    return 'Just now';
    if (s < 3600)  return Math.floor(s/60)   + 'm ago';
    if (s < 86400) return Math.floor(s/3600)  + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  },
};

// ── Badge helper ───────────────────────────────────────────────
function badge(status, label) {
  return `<span class="badge status-${status}">${label || status}</span>`;
}

// ── Toast ──────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const stack = document.getElementById('toast-stack') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-stack';
    el.className = 'toast-stack';
    document.body.appendChild(el);
    return el;
  })();

  const icons = { success: '✓', error: '✕', info: 'i' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'i'}</span><span>${msg}</span>`;
  stack.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(24px)';
    t.style.transition = 'opacity 0.25s, transform 0.25s';
    setTimeout(() => t.remove(), 250);
  }, 3500);
}

// ── Dark mode toggle ───────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('fleet-theme');
  if (saved === 'dark') document.documentElement.classList.add('dark');
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('fleet-theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isDark = document.documentElement.classList.contains('dark');
  btn.innerHTML = isDark
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

initTheme();