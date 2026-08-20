/* ==========================================================================
   INNO's STATIONERY — admin/core.js
   Shared across all admin pages: session guard, sidebar shell, API helper.
   ========================================================================== */

// ---- Icon set (inline SVG line icons — no external icon font/CDN needed) ----
const ADMIN_ICON_PATHS = {
    'bar-chart': '<line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="19" y1="20" x2="19" y2="15"/>',
    package: '<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8"/><line x1="12" y1="13" x2="12" y2="22"/>',
    receipt: '<path d="M6 2h12v19l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5z"/><line x1="8.5" y1="7" x2="15.5" y2="7"/><line x1="8.5" y1="11" x2="15.5" y2="11"/>',
    printer: '<rect x="5" y="8" width="14" height="7"/><path d="M7 8V4h10v4"/><path d="M7 16v4h10v-4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.2-1.6l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.8-1.6L13 2h-2l-.6 2.8a7 7 0 0 0-2.8 1.6l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .5 0 1.1.2 1.6l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.8 1.6L11 22h2l.6-2.8a7 7 0 0 0 2.8-1.6l2.4 1 2-3.4-2-1.6c.2-.5.2-1.1.2-1.6z"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
    check: '<polyline points="4 12 9 17 20 6"/>',
    edit: '<path d="M3 21l1.5-5.5L16 4l4 4L8.5 19.5 3 21z"/><line x1="14" y1="6" x2="18" y2="10"/>',
    star: '<polygon points="12 2 15 9 22 9.5 16.5 14 18 21 12 17.3 6 21 7.5 14 2 9.5 9 9"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
};
function adminIcon(name, size = 17) {
    const paths = ADMIN_ICON_PATHS[name] || '';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;flex-shrink:0;">${paths}</svg>`;
}

const ADMIN_API_BASE = '../../backend/api';

async function adminApi(path, { method = 'GET', body = null, isForm = false } = {}) {
    const opts = { method, credentials: 'include', headers: {} };
    if (body && !isForm) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    } else if (body && isForm) {
        opts.body = body;
    }
    let res, data;
    try {
        res = await fetch(ADMIN_API_BASE + path, opts);
        data = await res.json();
    } catch (e) {
        return { success: false, message: 'Network error.' };
    }
    if (res.status === 401 && !path.includes('admin_auth')) {
        window.location.href = 'login.html';
    }
    return data;
}

function adminFormatMoney(amount) {
    const n = Number(amount) || 0;
    return 'TSh ' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function adminEscapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}
function adminToast(message, type = 'info', duration = 3500) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
}

const NAV_ITEMS = [
    { href: 'dashboard.html', icon: 'bar-chart', label: 'Dashboard', key: 'dashboard' },
    { href: 'products.html', icon: 'package', label: 'Products', key: 'products' },
    { href: 'orders.html', icon: 'receipt', label: 'Orders', key: 'orders' },
    { href: 'print-requests.html', icon: 'printer', label: 'Print Requests', key: 'print' },
    { href: 'admins.html', icon: 'user', label: 'Admins', key: 'admins' },
    { href: 'settings.html', icon: 'gear', label: 'Settings', key: 'settings' },
];

/** Guards a page: redirects to login if not authenticated. Returns admin info. */
async function guardAdminPage() {
    const res = await adminApi('/admin_auth.php?action=session');
    if (!res.authenticated) {
        window.location.href = 'login.html';
        return null;
    }
    return res.admin;
}

/** Renders the sidebar + topbar shell into #adminHeader / #adminSidebarWrap, given the active nav key and page title. */
function renderAdminShell(activeKey, pageTitle, admin) {
    const sidebarWrap = document.getElementById('adminSidebarWrap');
    const topbar = document.getElementById('adminTopbar');
    if (sidebarWrap) {
        sidebarWrap.innerHTML = `
        <aside class="admin-sidebar" id="adminSidebar">
          <div class="brand-row">
            <span class="mark">I</span>
            <span class="brand-text">INNO's<br><small>Admin Panel</small></span>
          </div>
          <nav class="admin-nav">
            ${NAV_ITEMS.map(item => `
              <a href="${item.href}" class="${activeKey === item.key ? 'active' : ''}">
                <span class="nav-icon">${adminIcon(item.icon, 16)}</span> ${item.label}
              </a>`).join('')}
          </nav>
          <div class="admin-sidebar-foot">
            <div class="admin-user-chip">
              <span class="av">${(admin?.full_name || 'A').charAt(0).toUpperCase()}</span>
              <div>
                <div class="name">${adminEscapeHtml(admin?.full_name || '')}</div>
                <div class="role">${adminEscapeHtml(admin?.role?.replace('_',' ') || '')}</div>
              </div>
            </div>
            <div class="logout-link" id="logoutLink">Log out</div>
          </div>
        </aside>`;
        document.getElementById('logoutLink').addEventListener('click', doLogout);
    }
    if (topbar) {
        topbar.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;">
          <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Open menu"><span></span><span></span><span></span></button>
          <h1>${pageTitle}</h1>
        </div>
        <a href="../index.html" target="_blank" class="btn btn-ghost btn-sm">View site ↗</a>`;

        // Backdrop overlay so tapping outside the sidebar closes it too
        if (!document.getElementById('sidebarBackdrop')) {
            const backdrop = document.createElement('div');
            backdrop.id = 'sidebarBackdrop';
            backdrop.className = 'sidebar-backdrop';
            document.body.appendChild(backdrop);
        }
        const backdropEl = document.getElementById('sidebarBackdrop');
        const sidebarEl = document.getElementById('adminSidebar');
        const menuBtnEl = document.getElementById('mobileMenuBtn');

        const openSidebar = () => { sidebarEl.classList.add('open'); backdropEl.classList.add('open'); menuBtnEl.classList.add('open'); };
        const closeSidebar = () => { sidebarEl.classList.remove('open'); backdropEl.classList.remove('open'); menuBtnEl.classList.remove('open'); };
        const toggleSidebar = () => { sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar(); };

        menuBtnEl.addEventListener('click', toggleSidebar);
        backdropEl.addEventListener('click', closeSidebar);
        // Close automatically once a nav link is tapped on mobile
        sidebarEl.querySelectorAll('.admin-nav a').forEach(a => a.addEventListener('click', closeSidebar));
    }
}

async function doLogout() {
    await adminApi('/admin_auth.php?action=logout', { method: 'POST' });
    window.location.href = 'login.html';
}

const STATUS_LABEL_MAP = {
    pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', ready: 'Ready',
    out_for_delivery: 'Out for delivery', completed: 'Completed', cancelled: 'Cancelled',
    received: 'Received', printing: 'Printing',
    not_required: 'Not required', awaiting_payment: 'Awaiting payment', pending_verification: 'Awaiting verification', verified: 'Verified', rejected: 'Rejected',
};
