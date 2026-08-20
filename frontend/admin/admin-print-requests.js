/* Admin print requests page logic */
let printsCache = [];

(async () => {
    const admin = await guardAdminPage();
    if (!admin) return;
    renderAdminShell('print', 'Print Requests', admin);

    loadPrints();
    document.getElementById('printStatusFilter').addEventListener('change', loadPrints);
    document.getElementById('printModalClose').addEventListener('click', () => document.getElementById('printModalBackdrop').classList.remove('open'));
    document.getElementById('printModalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'printModalBackdrop') e.target.classList.remove('open'); });
})();

async function loadPrints() {
    const tbody = document.getElementById('printsTbody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;">Loading…</td></tr>`;

    const status = document.getElementById('printStatusFilter').value;
    const res = await adminApi('/print_requests.php' + (status ? `?status=${status}` : ''));
    printsCache = res.success ? res.print_requests : [];

    if (!printsCache.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:34px;color:var(--ink-soft);">No print requests found.</td></tr>`;
        return;
    }

    tbody.innerHTML = printsCache.map(p => `
      <tr>
        <td class="mono">${p.request_code}</td>
        <td>${adminEscapeHtml(p.customer_name)}${p.customer_confirmed === 'issue_reported' ? ` <span class="status-pill status-cancelled" title="Customer reported an issue">${adminIcon('eye', 11)} Issue</span>` : ''}<br><span style="color:var(--ink-soft);font-size:12px;">${adminEscapeHtml(p.phone)}</span></td>
        <td><a href="../../backend/uploads/print_docs/${encodeURIComponent(p.file_path)}" target="_blank" style="color:var(--navy);font-weight:600;">${adminEscapeHtml(p.original_file_name.slice(0,22))}${p.original_file_name.length>22?'…':''}</a></td>
        <td>${p.copies}</td>
        <td class="mono">${p.estimated_cost !== null ? adminFormatMoney(p.estimated_cost) : '—'}</td>
        <td><span class="status-pill status-${p.payment_status}">${STATUS_LABEL_MAP[p.payment_status] || p.payment_status}</span></td>
        <td>
          <select class="status-select" onchange="updatePrintStatus(${p.id}, this.value)">
            ${['received','printing','ready','out_for_delivery','completed','cancelled'].map(s => `<option value="${s}" ${p.status===s?'selected':''}>${STATUS_LABEL_MAP[s]}</option>`).join('')}
          </select>
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="icon-btn" onclick="viewPrint(${p.id})" aria-label="View">${adminIcon('eye', 15)}</button>
            ${p.payment_status === 'pending_verification' ? `<button class="icon-btn" onclick="verifyPrintPayment(${p.id})" title="Verify payment" aria-label="Verify payment">${adminIcon('check', 15)}</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
}

async function updatePrintStatus(id, status) {
    const res = await adminApi('/print_requests.php', { method: 'PUT', body: { id, status } });
    if (res.success) adminToast('Status updated.', 'success');
    else adminToast(res.message || 'Could not update.', 'error');
}

async function verifyPrintPayment(id) {
    if (!confirm('Mark this payment as verified?')) return;
    const res = await adminApi('/print_requests.php', { method: 'PUT', body: { id, payment_status: 'verified' } });
    if (res.success) { adminToast('Payment verified.', 'success'); loadPrints(); }
    else adminToast(res.message || 'Could not update.', 'error');
}

function viewPrint(id) {
    const p = printsCache.find(x => x.id === id);
    if (!p) return;
    const body = document.getElementById('printModalBody');
    body.innerHTML = `
      <div class="ticket-row"><span class="k">Customer</span><span class="v">${adminEscapeHtml(p.customer_name)}</span></div>
      <div class="ticket-row"><span class="k">Phone</span><span class="v">${adminEscapeHtml(p.phone)}</span></div>
      <div class="ticket-row"><span class="k">File</span><span class="v"><a href="../../backend/uploads/print_docs/${encodeURIComponent(p.file_path)}" target="_blank" style="color:var(--navy);">${adminEscapeHtml(p.original_file_name)}</a></span></div>
      <div class="ticket-row"><span class="k">Copies</span><span class="v">${p.copies}</span></div>
      <div class="ticket-row"><span class="k">Colour</span><span class="v">${p.color_mode === 'color' ? 'Colour' : 'Black & White'}</span></div>
      <div class="ticket-row"><span class="k">Paper</span><span class="v">${p.paper_size}${p.double_sided ? ', double-sided' : ''}</span></div>
      <div class="ticket-row"><span class="k">Binding</span><span class="v" style="text-transform:capitalize;">${p.binding}</span></div>
      ${p.instructions ? `<div class="ticket-row"><span class="k">Instructions</span><span class="v">${adminEscapeHtml(p.instructions)}</span></div>` : ''}
      <div class="ticket-row"><span class="k">Fulfillment</span><span class="v" style="text-transform:capitalize;">${p.fulfillment_type}</span></div>
      ${p.address ? `<div class="ticket-row"><span class="k">Address</span><span class="v">${adminEscapeHtml(p.address)}</span></div>` : ''}

      <h4 style="margin:16px 0 6px;font-size:14px;">Set cost</h4>
      <div style="display:flex;gap:10px;">
        <input type="number" id="costInput_${p.id}" placeholder="Estimated cost (TSh)" value="${p.estimated_cost ?? ''}" style="flex:1;padding:9px 12px;border:1.5px solid var(--line-strong);border-radius:8px;">
        <button class="btn btn-primary btn-sm" onclick="setPrintCost(${p.id})">Save</button>
      </div>
      ${p.fulfillment_type === 'delivery' ? `<p class="hint" style="margin-top:6px;">Saving a cost here notifies the customer to pay — they'll see a "Pay Now" prompt on the tracking page.</p>` : ''}

      ${p.fulfillment_type === 'delivery' ? `
        <h4 style="margin:16px 0 6px;font-size:14px;">Payment</h4>
        <div class="ticket-row"><span class="k">Status</span><span class="v"><span class="status-pill status-${p.payment_status}">${STATUS_LABEL_MAP[p.payment_status]}</span></span></div>
        <div class="ticket-row"><span class="k">Paid by</span><span class="v">${adminEscapeHtml(p.payment_payer_name || '—')}</span></div>
        <div class="ticket-row"><span class="k">Paid from</span><span class="v">${adminEscapeHtml(p.payment_phone || '—')}</span></div>
        <div class="ticket-row"><span class="k">Transaction ID</span><span class="v mono">${adminEscapeHtml(p.payment_reference || '—')}</span></div>
      ` : ''}
      ${p.customer_confirmed && p.customer_confirmed !== 'pending' ? `
        <h4 style="margin:16px 0 6px;font-size:14px;">Customer feedback</h4>
        <div class="ticket-row"><span class="k">Status</span><span class="v">${
            p.customer_confirmed === 'received' ? `<span class="status-pill status-completed">Confirmed received</span>`
            : p.customer_confirmed === 'issue_resolved' ? `<span class="status-pill status-completed">Issue resolved</span>`
            : `<span class="status-pill status-cancelled">Issue reported</span>`
        }</span></div>
        ${p.customer_rating ? `<div class="ticket-row"><span class="k">Rating</span><span class="v">${p.customer_rating} / 5</span></div>` : ''}
        ${p.customer_comment ? `<div class="ticket-row"><span class="k">Customer said</span><span class="v">${adminEscapeHtml(p.customer_comment)}</span></div>` : ''}
        ${p.customer_confirmed === 'issue_reported' ? `
          <div class="field" style="margin-top:12px;">
            <label for="responseInput_${p.id}">Your response to the customer</label>
            <textarea id="responseInput_${p.id}" placeholder="e.g. We're very sorry for the mistake — your document will arrive as soon as possible.">${adminEscapeHtml(p.admin_response || '')}</textarea>
          </div>
          <button class="btn btn-primary btn-sm" onclick="sendPrintResponse(${p.id})">Send Response</button>
        ` : p.admin_response ? `
          <div class="ticket-row"><span class="k">Your response</span><span class="v">${adminEscapeHtml(p.admin_response)}</span></div>
        ` : ''}
      ` : ''}
    `;
    document.getElementById('printModalBackdrop').classList.add('open');
}

async function setPrintCost(id) {
    const val = document.getElementById(`costInput_${id}`).value;
    if (val === '') return;
    const res = await adminApi('/print_requests.php', { method: 'PUT', body: { id, estimated_cost: val } });
    if (res.success) { adminToast('Cost saved.', 'success'); loadPrints(); document.getElementById('printModalBackdrop').classList.remove('open'); }
    else adminToast(res.message || 'Could not save.', 'error');
}

async function sendPrintResponse(id) {
    const text = document.getElementById(`responseInput_${id}`).value.trim();
    if (!text) { adminToast('Please write a response first.', 'error'); return; }
    const res = await adminApi('/print_requests.php', { method: 'PUT', body: { id, admin_response: text } });
    if (res.success) {
        adminToast('Response sent to customer.', 'success');
        document.getElementById('printModalBackdrop').classList.remove('open');
        loadPrints();
    } else {
        adminToast(res.message || 'Could not send response.', 'error');
    }
}
