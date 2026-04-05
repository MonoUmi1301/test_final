function renderNav(activePage) {
  const user = getUser();

  const navItems = [
    { id: 'dashboard',   href: 'dashboard.html',   label: 'Dashboard',   icon: `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>` },
    { id: 'vehicles',    href: 'vehicles.html',    label: 'Vehicles',    icon: `<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>` },
    { id: 'drivers',     href: 'drivers.html',     label: 'Drivers',     icon: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>` },
    { id: 'trips',       href: 'trips.html',       label: 'Trips',       icon: `<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>` },
    { id: 'maintenance', href: 'maintenance.html', label: 'Maintenance', icon: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>` },
    { id: 'audit',       href: 'audit.html',       label: 'Audit Log',   icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>` },
  ];

  const sidebarHtml = `
    <button class="mobile-menu-btn" onclick="toggleSidebar()" aria-label="Toggle menu">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
    </button>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <span class="sidebar-logo-text">Fleet OS</span>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-label">Overview</div>
          ${navItems.slice(0,1).map(i => navLink(i, activePage)).join('')}
        </div>
        <div class="nav-section">
          <div class="nav-section-label">Fleet</div>
          ${navItems.slice(1,3).map(i => navLink(i, activePage)).join('')}
        </div>
        <div class="nav-section">
          <div class="nav-section-label">Operations</div>
          ${navItems.slice(3,5).map(i => navLink(i, activePage)).join('')}
        </div>
        <div class="nav-section">
          <div class="nav-section-label">System</div>
          ${navItems.slice(5).map(i => navLink(i, activePage)).join('')}
        </div>
      </nav>
      <div class="sidebar-footer">
        <div class="user-row" onclick="doLogout()" title="Sign out">
          <div class="user-avatar">${(user?.username || 'U')[0].toUpperCase()}</div>
          <div style="flex:1;min-width:0;">
            <div class="user-name truncate-1">${user?.username || '—'}</div>
            <div class="user-role">${user?.role || ''}</div>
          </div>
          <button class="theme-toggle" id="theme-toggle" onclick="event.stopPropagation();toggleTheme()" title="Toggle theme">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
      </div>
    </aside>
  `;

  // inject sidebar ก่อน
  document.body.insertAdjacentHTML('afterbegin', sidebarHtml);

  // รอ DOM โหลดครบแล้วค่อย wrap
  window.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'main-content';
    wrapper.id = 'page-content';

    const toMove = [...document.body.childNodes].filter(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      return (
        !node.classList.contains('sidebar') &&
        !node.classList.contains('sidebar-overlay') &&
        !node.classList.contains('mobile-menu-btn')
      );
    });

    toMove.forEach(node => wrapper.appendChild(node));
    document.body.appendChild(wrapper);
  });

  updateThemeIcon();
}

function navLink(item, activePage) {
  const active = item.id === activePage;
  return `
    <a href="${item.href}" class="nav-item${active ? ' active' : ''}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
      ${item.label}
    </a>
  `;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

async function doLogout() {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
  sessionStorage.clear();
  window.location.href = 'login.html';
}