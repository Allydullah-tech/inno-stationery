/* Admin orders page logic */
let ordersCache = [];

(async () => {
    const admin = await guardAdminPage();
    if (!admin) return;
    renderAdminShell('orders', 'Orders', admin);

    loadOrders();
    document.getElementById('statusFilter').addEventListener('change', loadOrders);
    document.getElementById('paymentFilter').addEventListener('change', loadOrders);
    document.getElementById('orderModalClose').addEventListener('click', () => document.getElementById('orderModalBackdrop').classList.remove('open'));
    document.getElementById('orderModalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'orderModalBackdrop') e.target.classList.remove('open'); });
})();

async function loadOrders() {
    const tbody = document.getElementById('ordersTbody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;">Loading…</td></tr>`;

    const status = document.getElementById('statusFilter').value;
    const payment = document.getElementById('paymentFilter').value;
    let query = '?';
    if (status) query += `status=${status}&`;
    if (payment) query += `payment_status=${payment}&`;

    const res = await adminApi('/orders.php' + query);
    ordersCache = res.success ? res.orders : [];

    if (!ordersCache.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:34px;color:var(--ink-soft);">No orders found.</td></tr>`;
        return;
    }

    tbody.innerHTML = ordersCache.map(o => `
      <tr>
        <td class="mono">${o.order_code}</td>
        <td>${adminEscapeHtml(o.customer_name)}${o.customer_confirmed === 'issue_reported' ? ` <span class="status-pill status-cancelled" title="Customer reported an issue">${adminIcon('eye', 11)} Issue</span>` : ''}<br><span style="color:var(--ink-soft);font-size:12px;">${adminEscapeHtml(o.phone)}</span></td>
        <td style="text-transform:capitalize;">${o.fulfillment_type}</td>
        <td class="mono">${adminFormatMoney(o.total_amount)}</td>
        <td><span class="status-pill status-${o.payment_status}">${STATUS_LABEL_MAP[o.payment_status] || o.payment_status}</span></td>
        <td>
          <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
            ${['pending','confirmed','processing','ready','out_for_delivery','completed','cancelled'].map(s => `<option value="${s}" ${o.status===s?'selected':''}>${STATUS_LABEL_MAP[s]}</option>`).join('')}
          </select>
        </td>
        <td style="font-size:12.5px;color:var(--ink-soft);">${new Date(o.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="icon-btn" onclick="viewOrder(${o.id})" aria-label="View">${adminIcon('eye', 15)}</button>
            ${o.payment_status === 'pending_verification' ? `<button class="icon-btn" onclick="verifyPayment(${o.id})" title="Verify payment" aria-label="Verify payment">${adminIcon('check', 15)}</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
}

async function updateOrderStatus(id, status) {
    const res = await adminApi('/orders.php', { method: 'PUT', body: { id, status } });
    if (res.success) adminToast('Order status updated.', 'success');
    else adminToast(res.message || 'Could not update.', 'error');
}

async function verifyPayment(id) {
    if (!confirm('Mark this payment as verified?')) return;
    const res = await adminApi('/orders.php', { method: 'PUT', body: { id, payment_status: 'verified' } });
    if (res.success) { adminToast('Payment verified.', 'success'); loadOrders(); }
    else adminToast(res.message || 'Could not update.', 'error');
}

async function sendOrderResponse(id) {
    const text = document.getElementById(`responseInput_${id}`).value.trim();
    if (!text) { adminToast('Please write a response first.', 'error'); return; }
    const res = await adminApi('/orders.php', { method: 'PUT', body: { id, admin_response: text } });
    if (res.success) {
        adminToast('Response sent to customer.', 'success');
        document.getElementById('orderModalBackdrop').classList.remove('open');
        loadOrders();
    } else {
        adminToast(res.message || 'Could not send response.', 'error');
    }
}

function viewOrder(id) {
    const o = ordersCache.find(x => x.id === id);
    if (!o) return;
    const body = document.getElementById('orderModalBody');
    body.innerHTML = `
      <div class="ticket-row"><span class="k">Customer</span><span class="v">${adminEscapeHtml(o.customer_name)}</span></div>
      <div class="ticket-row"><span class="k">Phone</span><span class="v">${adminEscapeHtml(o.phone)}</span></div>
      ${o.email ? `<div class="ticket-row"><span class="k">Email</span><span class="v">${adminEscapeHtml(o.email)}</span></div>` : ''}
      <div class="ticket-row"><span class="k">Fulfillment</span><span class="v" style="text-transform:capitalize;">${o.fulfillment_type}</span></div>
      ${o.address ? `<div class="ticket-row"><span class="k">Address</span><span class="v">${adminEscapeHtml(o.address)}</span></div>` : ''}
      ${o.notes ? `<div class="ticket-row"><span class="k">Notes</span><span class="v">${adminEscapeHtml(o.notes)}</span></div>` : ''}
      <h4 style="margin:16px 0 6px;font-size:14px;">Items</h4>
      ${o.items.map(i => `<div class="ticket-row"><span class="k">${adminEscapeHtml(i.product_name)} × ${i.quantity}</span><span class="v">${adminFormatMoney(i.line_total)}</span></div>`).join('')}
      <div class="ticket-row"><span class="k">Subtotal</span><span class="v">${adminFormatMoney(o.subtotal)}</span></div>
      <div class="ticket-row"><span class="k">Delivery fee</span><span class="v">${adminFormatMoney(o.delivery_fee)}</span></div>
      <div class="ticket-row"><span class="k" style="font-weight:700;">Total</span><span class="v ticket-total">${adminFormatMoney(o.total_amount)}</span></div>
      ${o.fulfillment_type === 'delivery' ? `
        <h4 style="margin:16px 0 6px;font-size:14px;">Payment</h4>
        <div class="ticket-row"><span class="k">Status</span><span class="v"><span class="status-pill status-${o.payment_status}">${STATUS_LABEL_MAP[o.payment_status]}</span></span></div>
        <div class="ticket-row"><span class="k">Paid by</span><span class="v">${adminEscapeHtml(o.payment_payer_name || '—')}</span></div>
        <div class="ticket-row"><span class="k">Paid from</span><span class="v">${adminEscapeHtml(o.payment_phone || '—')}</span></div>
        <div class="ticket-row"><span class="k">Transaction ID</span><span class="v mono">${adminEscapeHtml(o.payment_reference || '—')}</span></div>
      ` : ''}
      ${o.customer_confirmed && o.customer_confirmed !== 'pending' ? `
        <h4 style="margin:16px 0 6px;font-size:14px;">Customer feedback</h4>
        <div class="ticket-row"><span class="k">Status</span><span class="v">${
            o.customer_confirmed === 'received' ? `<span class="status-pill status-completed">Confirmed received</span>`
            : o.customer_confirmed === 'issue_resolved' ? `<span class="status-pill status-completed">Issue resolved</span>`
            : `<span class="status-pill status-cancelled">Issue reported</span>`
        }</span></div>
        ${o.customer_rating ? `<div class="ticket-row"><span class="k">Rating</span><span class="v">${o.customer_rating} / 5</span></div>` : ''}
        ${o.customer_comment ? `<div class="ticket-row"><span class="k">Customer said</span><span class="v">${adminEscapeHtml(o.customer_comment)}</span></div>` : ''}
        ${o.customer_confirmed === 'issue_reported' ? `
          <div class="field" style="margin-top:12px;">
            <label for="responseInput_${o.id}">Your response to the customer</label>
            <textarea id="responseInput_${o.id}" placeholder="e.g. We're very sorry for the mistake — a replacement is on its way and will arrive as soon as possible.">${adminEscapeHtml(o.admin_response || '')}</textarea>
          </div>
          <button class="btn btn-primary btn-sm" onclick="sendOrderResponse(${o.id})">Send Response</button>
        ` : o.admin_response ? `
          <div class="ticket-row"><span class="k">Your response</span><span class="v">${adminEscapeHtml(o.admin_response)}</span></div>
        ` : ''}
      ` : ''}
    `;
    document.getElementById('orderModalBackdrop').classList.add('open');
}
