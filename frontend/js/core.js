/* ==========================================================================
   INNO's STATIONERY — core.js
   Shared across all customer-facing pages: API helper, cart state (stored
   in-memory + localStorage), toasts, header/footer injection, and the
   delivery payment modal.
   ========================================================================== */

// ---- Icon set (inline SVG line icons — no external icon font/CDN needed) ----
const ICON_PATHS = {
    truck: '<rect x="1" y="7" width="14" height="9"/><path d="M15 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
    printer: '<rect x="5" y="8" width="14" height="7"/><path d="M7 8V4h10v4"/><path d="M7 16v4h10v-4"/>',
    package: '<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8"/><line x1="12" y1="13" x2="12" y2="22"/>',
    check: '<polyline points="4 12 9 17 20 6"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    users: '<circle cx="8.5" cy="8" r="3"/><path d="M2 20c0-3.3 2.9-6 6.5-6S15 16.7 15 20"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 20c.2-2.6 2-4.7 4.5-5.3"/>',
    zap: '<polygon points="12 2 4 14 11 14 10 22 20 9 13 9 14 2"/>',
    file: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>',
    basket: '<path d="M4 10h16l-1.5 9a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 10z"/><path d="M8 10 12 4l4 6"/><line x1="9" y1="13" x2="9.6" y2="17"/><line x1="15" y1="13" x2="14.4" y2="17"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h2l2.6 12.6a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H6"/>',
    phone: '<path d="M5 4h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 3 6.2 2 2 0 0 1 5 4z"/>',
    'map-pin': '<path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15.3" y2="15.3"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    pencil: '<path d="M3 21l1.5-5.5L16 4l4 4L8.5 19.5 3 21z"/><line x1="14" y1="6" x2="18" y2="10"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="13" cy="15" r="1.1" fill="currentColor" stroke="none"/>',
    briefcase: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    backpack: '<path d="M7 8V6a5 5 0 0 1 10 0v2"/><path d="M5 8h14a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1z"/><rect x="9" y="12" width="6" height="4"/>',
    tag: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="6.5" cy="6.5" r="1.3" fill="currentColor" stroke="none"/>',
    star: '<polygon points="12 2 15 9 22 9.5 16.5 14 18 21 12 17.3 6 21 7.5 14 2 9.5 9 9"/>',
};
function icon(name, size = 18) {
    const paths = ICON_PATHS[name] || '';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;flex-shrink:0;">${paths}</svg>`;
}

// ---- API base: relative path, works whether the site is deployed at the
// domain root or inside a subfolder (e.g. /inno-stationery/frontend/...).
// This mirrors admin-core.js's ADMIN_API_BASE, which already used a
// relative path and is why the admin panel worked while customer pages didn't.
const API_BASE = '../backend/api';

async function apiRequest(path, { method = 'GET', body = null, isForm = false } = {}) {
    const opts = { method, credentials: 'include', headers: {} };
    if (body && !isForm) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    } else if (body && isForm) {
        opts.body = body; // FormData sets its own content-type
    }
    let res, data;
    try {
        res = await fetch(API_BASE + path, opts);
        data = await res.json();
    } catch (e) {
        return { success: false, message: 'Network error. Please check your connection and try again.' };
    }
    if (!res.ok && data && data.message === undefined) {
        data.message = 'Something went wrong (HTTP ' + res.status + ').';
    }
    return data;
}

// ---------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------
function ensureToastWrap() {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'toast-wrap';
        document.body.appendChild(wrap);
    }
    return wrap;
}
function showToast(message, type = 'info', duration = 3800) {
    const wrap = ensureToastWrap();
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
}

// ---------------------------------------------------------------
// Money formatting (Tanzanian Shillings)
// ---------------------------------------------------------------
function formatMoney(amount) {
    const n = Number(amount) || 0;
    return 'TSh ' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------
// Cart (localStorage-backed so it survives refresh)
// ---------------------------------------------------------------
const Cart = {
    KEY: 'inno_cart_v1',
    items: [],

    load() {
        try {
            this.items = JSON.parse(localStorage.getItem(this.KEY)) || [];
        } catch (e) { this.items = []; }
        return this.items;
    },
    save() {
        localStorage.setItem(this.KEY, JSON.stringify(this.items));
        this.updateBadge();
    },
    add(product, qty = 1) {
        const existing = this.items.find(i => i.product_id === product.id);
        if (existing) {
            existing.quantity += qty;
        } else {
            this.items.push({
                product_id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                quantity: qty,
                stock: product.stock,
            });
        }
        this.save();
    },
    updateQty(productId, qty) {
        const item = this.items.find(i => i.product_id === productId);
        if (!item) return;
        item.quantity = Math.max(1, qty);
        this.save();
    },
    remove(productId) {
        this.items = this.items.filter(i => i.product_id !== productId);
        this.save();
    },
    clear() {
        this.items = [];
        this.save();
    },
    count() {
        return this.items.reduce((sum, i) => sum + i.quantity, 0);
    },
    subtotal() {
        return this.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    },
    updateBadge() {
        document.querySelectorAll('.cart-count').forEach(el => {
            const c = this.count();
            el.textContent = c;
            el.style.display = c > 0 ? 'flex' : 'none';
        });
    },
};
Cart.load();

// ---------------------------------------------------------------
// Header + Footer (injected into any page with a #site-header / #site-footer placeholder)
// ---------------------------------------------------------------
function renderHeader(activePage = '') {
    const el = document.getElementById('site-header');
    if (!el) return;
    el.innerHTML = `
    <header class="site-header">
      <div class="container nav-row">
        <a href="index.html" class="brand">
          <span class="mark">I</span>
          <span>INNO's<br><small>Stationery</small></span>
        </a>
        <nav class="nav-links" id="navLinks">
          <a href="index.html" ${activePage === 'home' ? 'class="active"' : ''}>Home</a>
          <a href="products.html" ${activePage === 'products' ? 'class="active"' : ''}>Shop</a>
          <a href="print.html" ${activePage === 'print' ? 'class="active"' : ''}>Print a Document</a>
          <a href="track.html" ${activePage === 'track' ? 'class="active"' : ''}>Track Order</a>
          <a href="about.html" ${activePage === 'about' ? 'class="active"' : ''}>About</a>
        </nav>
        <div class="nav-actions">
          <button class="btn btn-ghost btn-sm" id="installAppBtn" style="display:none;" aria-label="Install app">
            ${icon('package', 15)} Install App
          </button>
          <button class="btn btn-outline btn-sm cart-btn" onclick="Cart.openDrawer && Cart.openDrawer()" aria-label="Open cart">
            ${icon('cart', 17)} Cart <span class="cart-count">0</span>
          </button>
          <button class="nav-toggle" id="navToggle" aria-label="Toggle menu"><span></span><span></span><span></span></button>
        </div>
      </div>
    </header>`;
    initInstallPrompt();
    const navToggleBtn = document.getElementById('navToggle');
    const navLinksEl = document.getElementById('navLinks');
    navToggleBtn.addEventListener('click', () => {
        navLinksEl.classList.toggle('open');
        navToggleBtn.classList.toggle('open');
    });
    navLinksEl.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        navLinksEl.classList.remove('open');
        navToggleBtn.classList.remove('open');
    }));
    Cart.updateBadge();
}

function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const year = new Date().getFullYear();
    el.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">INNO's STATIONERY</div>
            <p style="color:#B9BFDA;font-size:14px;max-width:32ch;">Everything you need to write, print &amp; create — quality stationery and fast printing, delivered.</p>
          </div>
          <div>
            <h4>Shop</h4>
            <a href="products.html">All Products</a>
            <a href="print.html">Print a Document</a>
            <a href="track.html">Track an Order</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="about.html">About Us</a>
            <a href="admin/login.html">Admin Login</a>
          </div>
          <div>
            <h4>Get in touch</h4>
            <a href="tel:0620839640">${icon('phone', 15)} 0620 839 640</a>
            <a href="#">${icon('map-pin', 15)} Mbeya, Tanzania</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${year} INNO's Stationery. All rights reserved.</span>
          <span>Built for makers, students &amp; offices.</span>
        </div>
      </div>
    </footer>`;
}

// ---------------------------------------------------------------
// Cart drawer (shared markup injected once)
// ---------------------------------------------------------------
function injectCartDrawer() {
    if (document.getElementById('cartDrawer')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="modal-backdrop" id="cartDrawerBackdrop"></div>
    <aside class="cart-drawer" id="cartDrawer">
      <div class="cart-drawer-head">
        <h3>Your Cart</h3>
        <button class="modal-close" id="cartDrawerClose" aria-label="Close cart">&times;</button>
      </div>
      <div class="cart-items" id="cartItemsWrap"></div>
      <div class="cart-drawer-foot" id="cartDrawerFoot"></div>
    </aside>`;
    document.body.appendChild(wrap);

    document.getElementById('cartDrawerClose').addEventListener('click', closeCartDrawer);
    document.getElementById('cartDrawerBackdrop').addEventListener('click', closeCartDrawer);

    Cart.openDrawer = openCartDrawer;
}

function openCartDrawer() {
    injectCartDrawer();
    renderCartDrawer();
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartDrawerBackdrop').classList.add('open');
}
function closeCartDrawer() {
    const d = document.getElementById('cartDrawer');
    const b = document.getElementById('cartDrawerBackdrop');
    if (d) d.classList.remove('open');
    if (b) b.classList.remove('open');
}

function renderCartDrawer() {
    const itemsWrap = document.getElementById('cartItemsWrap');
    const foot = document.getElementById('cartDrawerFoot');
    if (!itemsWrap) return;

    if (Cart.items.length === 0) {
        itemsWrap.innerHTML = `<div class="cart-empty"><div style="color:var(--emerald);margin-bottom:8px;">${icon('basket', 40)}</div><p>Your cart is empty.<br>Browse our products to get started.</p></div>`;
        foot.innerHTML = `<a href="products.html" class="btn btn-primary btn-block">Shop Products</a>`;
        return;
    }

    itemsWrap.innerHTML = Cart.items.map(i => `
      <div class="cart-item">
        <img src="${i.image_url || 'assets/placeholder.svg'}" alt="${escapeHtml(i.name)}" onerror="this.src='assets/placeholder.svg'">
        <div class="cart-item-info">
          <h4>${escapeHtml(i.name)}</h4>
          <div class="product-price">${formatMoney(i.price)}</div>
          <div class="qty-control">
            <button onclick="cartDrawerChangeQty(${i.product_id}, ${i.quantity - 1})" aria-label="Decrease quantity">−</button>
            <span>${i.quantity}</span>
            <button onclick="cartDrawerChangeQty(${i.product_id}, ${i.quantity + 1})" aria-label="Increase quantity">+</button>
            <button onclick="cartDrawerRemove(${i.product_id})" style="border:none;background:none;color:var(--red);cursor:pointer;font-size:12px;margin-left:auto;">Remove</button>
          </div>
        </div>
      </div>
    `).join('');

    foot.innerHTML = `
      <div class="ticket-row"><span class="k">Subtotal</span><span class="v">${formatMoney(Cart.subtotal())}</span></div>
      <a href="checkout.html" class="btn btn-primary btn-block" style="margin-top:14px;">Checkout →</a>
    `;
}

function cartDrawerChangeQty(productId, qty) {
    if (qty <= 0) { Cart.remove(productId); } else { Cart.updateQty(productId, qty); }
    renderCartDrawer();
}
function cartDrawerRemove(productId) {
    Cart.remove(productId);
    renderCartDrawer();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

// ---------------------------------------------------------------
// Delivery payment modal (shared: used by checkout.html and print.html)
// Shows the fixed payment number/name and collects a payment reference.
// ---------------------------------------------------------------
let paymentModalSettings = null;

async function loadPaymentSettings() {
    if (paymentModalSettings) return paymentModalSettings;
    const res = await apiRequest('/settings.php');
    if (res.success) {
        paymentModalSettings = res.settings;
    } else {
        paymentModalSettings = {
            payment_phone: '0620839640',
            payment_name: 'Yahya Juma Is-haka',
            payment_method_label: 'Mobile Money',
            delivery_fee: '2000',
        };
    }
    return paymentModalSettings;
}

/**
 * Opens the payment modal. Resolves with { payment_reference, payment_phone, payment_payer_name }
 * when the customer confirms, or null if they cancel.
 */
function openPaymentModal(amountLabel) {
    return new Promise(async (resolve) => {
        const s = await loadPaymentSettings();
        let backdrop = document.getElementById('paymentModalBackdrop');
        if (backdrop) backdrop.remove();

        backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop open';
        backdrop.id = 'paymentModalBackdrop';
        backdrop.innerHTML = `
        <div class="modal">
          <div class="modal-head">
            <h3>Complete Payment for Delivery</h3>
            <button class="modal-close" id="pmClose" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">Delivery orders are prepaid. Send payment using the details below, then fill in your payment details so we can confirm it.</div>
            <div class="ticket" style="box-shadow:none;">
              <div class="ticket-main">
                <div class="ticket-row"><span class="k">Amount to pay</span><span class="v ticket-total">${amountLabel}</span></div>
                <div class="ticket-row"><span class="k">Method</span><span class="v">${escapeHtml(s.payment_method_label || 'Mobile Money')}</span></div>
                <div class="ticket-row"><span class="k">Send to number</span><span class="v" style="font-family:var(--font-mono);">${escapeHtml(s.payment_phone)}</span></div>
                <div class="ticket-row"><span class="k">Account name</span><span class="v">${escapeHtml(s.payment_name)}</span></div>
              </div>
            </div>
            <form id="pmForm" style="margin-top:20px;">
              <div class="field">
                <label for="pmPayerName">Name used for the payment *</label>
                <input type="text" id="pmPayerName" required placeholder="Name shown on the payment">
              </div>
              <div class="field">
                <label for="pmPhone">The phone number you paid from *</label>
                <input type="tel" id="pmPhone" required placeholder="e.g. 07XXXXXXXX">
              </div>
              <div class="field">
                <label for="pmRef">Transaction ID / payment reference *</label>
                <input type="text" id="pmRef" required placeholder="e.g. QF7X9K2LP">
                <div class="hint">Find this in the confirmation SMS you receive after sending payment.</div>
              </div>
              <div id="pmAlert"></div>
              <button type="submit" class="btn btn-primary btn-block">Confirm Payment &amp; Submit</button>
              <button type="button" class="btn btn-ghost btn-block" id="pmCancel" style="margin-top:10px;">Cancel</button>
            </form>
          </div>
        </div>`;
        document.body.appendChild(backdrop);

        const cleanup = (result) => { backdrop.remove(); resolve(result); };
        document.getElementById('pmClose').addEventListener('click', () => cleanup(null));
        document.getElementById('pmCancel').addEventListener('click', () => cleanup(null));
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(null); });
        document.getElementById('pmForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const payerName = document.getElementById('pmPayerName').value.trim();
            const phone = document.getElementById('pmPhone').value.trim();
            const ref = document.getElementById('pmRef').value.trim();
            if (!payerName || !phone || !ref) {
                document.getElementById('pmAlert').innerHTML = `<div class="alert alert-error">Please fill in all three payment details.</div>`;
                return;
            }
            cleanup({ payment_reference: ref, payment_phone: phone, payment_payer_name: payerName });
        });
    });
}

// ---------------------------------------------------------------
// PWA: install prompt + service worker registration
// ---------------------------------------------------------------
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('installAppBtn');
    if (btn) btn.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('installAppBtn');
    if (btn) btn.style.display = 'none';
});

function isRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIosSafari() {
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    return isIos && isSafari;
}

function showIosInstallInstructions() {
    let backdrop = document.getElementById('installModalBackdrop');
    if (backdrop) backdrop.remove();
    backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.id = 'installModalBackdrop';
    backdrop.innerHTML = `
    <div class="modal" style="max-width:380px;">
      <div class="modal-head">
        <h3>Install this app</h3>
        <button class="modal-close" id="installModalClose" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:14px;">To add INNO's Stationery to your Home Screen:</p>
        <div class="ticket-row"><span class="k">1.</span><span class="v">Tap the Share icon in Safari's toolbar</span></div>
        <div class="ticket-row"><span class="k">2.</span><span class="v">Scroll down and tap "Add to Home Screen"</span></div>
        <div class="ticket-row"><span class="k">3.</span><span class="v">Tap "Add" to confirm</span></div>
      </div>
    </div>`;
    document.body.appendChild(backdrop);
    document.getElementById('installModalClose').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
}

function initInstallPrompt() {
    const btn = document.getElementById('installAppBtn');
    if (!btn || isRunningStandalone()) return;

    if (deferredInstallPrompt) {
        btn.style.display = 'inline-flex';
    } else if (isIosSafari()) {
        btn.style.display = 'inline-flex';
    }

    btn.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            btn.style.display = 'none';
        } else if (isIosSafari()) {
            showIosInstallInstructions();
        }
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // Silently ignore — installability just won't be offered, rest of the site still works.
        });
    });
}

// Auto-inject header/footer if placeholders exist
document.addEventListener('DOMContentLoaded', () => {
    renderFooter();
    injectCartDrawer();
    Cart.updateBadge();
});
