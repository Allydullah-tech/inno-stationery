/* Tracking page logic */
const ORDER_STEPS = ['pending', 'confirmed', 'processing', 'ready', 'out_for_delivery', 'completed'];
const PRINT_STEPS = ['received', 'printing', 'ready', 'out_for_delivery', 'completed'];
const STATUS_LABELS = {
    pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', ready: 'Ready',
    out_for_delivery: 'Out for delivery', completed: 'Completed', cancelled: 'Cancelled',
    received: 'Received', printing: 'Printing',
};

// Remembers the phone number used for the current search, so the confirmation/
// payment actions below (which need it for authentication) don't have to ask again.
let lastSearchPhone = '';

document.addEventListener('DOMContentLoaded', () => {
    renderHeader('track');

    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) {
        document.getElementById('trackCode').value = params.get('code');
    }

    document.querySelectorAll('input[name="trackMode"]').forEach(r => {
        r.addEventListener('change', updateTrackMode);
    });

    document.getElementById('trackForm').addEventListener('submit', doTrack);
});

function updateTrackMode() {
    const mode = document.querySelector('input[name="trackMode"]:checked').value;
    const codeField = document.getElementById('codeField');
    const phoneField = document.getElementById('phoneField');
    const codeInput = document.getElementById('trackCode');
    const phoneInput = document.getElementById('trackPhone');

    if (mode === 'code') {
        codeField.style.display = 'block';
        phoneField.style.display = 'none';
        codeInput.required = true;
        phoneInput.required = false;
    } else {
        codeField.style.display = 'none';
        phoneField.style.display = 'block';
        codeInput.required = false;
        phoneInput.required = true;
    }
}

async function doTrack(e) {
    e.preventDefault();
    const alertBox = document.getElementById('trackAlert');
    const resultBox = document.getElementById('trackResult');
    alertBox.innerHTML = '';
    resultBox.innerHTML = '';

    const mode = document.querySelector('input[name="trackMode"]:checked').value;
    const code = document.getElementById('trackCode').value.trim().toUpperCase();
    const phone = document.getElementById('trackPhone').value.trim();

    if (mode === 'code' && !code) {
        alertBox.innerHTML = `<div class="alert alert-error">Please enter your tracking code.</div>`;
        return;
    }
    if (mode === 'phone' && !phone) {
        alertBox.innerHTML = `<div class="alert alert-error">Please enter your phone number.</div>`;
        return;
    }

    const btn = document.getElementById('trackBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Searching…';

    const query = mode === 'code' ? `code=${encodeURIComponent(code)}` : `phone=${encodeURIComponent(phone)}`;
    const res = await apiRequest(`/track.php?${query}`);

    btn.disabled = false;
    btn.textContent = 'Track';

    if (!res.success) {
        alertBox.innerHTML = `<div class="alert alert-error">${escapeHtml(res.message || 'Not found.')}</div>`;
        return;
    }

    // Remember a phone number we can use for follow-up actions (confirm/pay).
    // If they searched by code, ask for phone only when an action actually needs it.
    lastSearchPhone = mode === 'phone' ? phone : '';

    if (res.type === 'list') {
        resultBox.innerHTML = `<p style="margin:0 0 -4px;font-size:13.5px;color:var(--ink-soft);">Found ${res.records.length} result${res.records.length === 1 ? '' : 's'}:</p>`
            + res.records.map(r => r.record_type === 'order' ? renderOrderResult(r) : renderPrintResult(r)).join('');
    } else if (res.type === 'order') {
        resultBox.innerHTML = renderOrderResult(res.record);
    } else {
        resultBox.innerHTML = renderPrintResult(res.record);
    }
}

function progressBar(steps, current) {
    if (current === 'cancelled') {
        return `<div class="alert alert-error" style="margin-top:16px;">This request was cancelled.</div>`;
    }
    const idx = steps.indexOf(current);
    return `<div style="display:flex;gap:6px;margin:14px 0;">
      ${steps.map((s, i) => `<div style="flex:1;height:7px;border-radius:4px;background:${i <= idx ? 'var(--emerald)' : 'var(--line-soft)'};"></div>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink-soft);flex-wrap:wrap;gap:4px;">
      ${steps.map(s => `<span>${STATUS_LABELS[s] || s}</span>`).join('')}
    </div>`;
}

function paymentDetailsHtml(record) {
    if (record.fulfillment_type !== 'delivery') return '';
    if (record.payment_status === 'not_required') return '';
    return `
      <div class="ticket-row"><span class="k">Payment</span><span class="v"><span class="status-pill status-${record.payment_status}">${(record.payment_status || '').replace(/_/g, ' ')}</span></span></div>
      ${record.payment_payer_name ? `<div class="ticket-row"><span class="k">Paid by</span><span class="v">${escapeHtml(record.payment_payer_name)}</span></div>` : ''}
      ${record.payment_phone ? `<div class="ticket-row"><span class="k">From number</span><span class="v">${escapeHtml(record.payment_phone)}</span></div>` : ''}
      ${record.payment_reference ? `<div class="ticket-row"><span class="k">Transaction ID</span><span class="v mono">${escapeHtml(record.payment_reference)}</span></div>` : ''}
    `;
}

/** DOM-safe id fragment from a tracking code, e.g. "ORD-7F3K2Q" -> "ORD_7F3K2Q" */
function safeId(code) { return code.replace(/[^A-Z0-9]/g, '_'); }

function renderOrderResult(o) {
    const itemsHtml = o.items.map(i => `
      <div class="ticket-row"><span class="k">${escapeHtml(i.product_name)} × ${i.quantity}</span><span class="v">${formatMoney(i.line_total)}</span></div>
    `).join('');

    return `
    <div class="ticket">
      <div class="ticket-main">
        <span class="ticket-label">Order</span>
        <div class="ticket-code">${o.order_code}</div>
        <span class="status-pill status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
        ${progressBar(ORDER_STEPS, o.status)}
        <h4 style="margin-top:14px;font-size:13px;">Items</h4>
        ${itemsHtml}
      </div>
      <div class="ticket-stub">
        <div class="ticket-row"><span class="k">Fulfillment</span><span class="v" style="text-transform:capitalize;">${o.fulfillment_type}</span></div>
        <div class="ticket-row"><span class="k">Subtotal</span><span class="v">${formatMoney(o.subtotal)}</span></div>
        <div class="ticket-row"><span class="k">Delivery fee</span><span class="v">${formatMoney(o.delivery_fee)}</span></div>
        <div class="ticket-row"><span class="k" style="font-weight:700;">Total</span><span class="v ticket-total">${formatMoney(o.total_amount)}</span></div>
        ${paymentDetailsHtml(o)}
        <p style="font-size:11.5px;margin-top:10px;">Placed on ${new Date(o.created_at).toLocaleString()}</p>
      </div>
    </div>
    ${confirmationBlockHtml(o, 'ORD')}`;
}

function renderPrintResult(r) {
    return `
    <div class="ticket">
      <div class="ticket-main">
        <span class="ticket-label">Print request</span>
        <div class="ticket-code">${r.request_code}</div>
        <span class="status-pill status-${r.status}">${STATUS_LABELS[r.status] || r.status}</span>
        ${progressBar(PRINT_STEPS, r.status)}
        <div class="ticket-row" style="margin-top:12px;"><span class="k">File</span><span class="v">${escapeHtml(r.original_file_name)}</span></div>
        <div class="ticket-row"><span class="k">Copies</span><span class="v">${r.copies}</span></div>
        <div class="ticket-row"><span class="k">Colour</span><span class="v">${r.color_mode === 'color' ? 'Colour' : 'Black & White'}</span></div>
        <div class="ticket-row"><span class="k">Paper</span><span class="v">${r.paper_size}${r.double_sided ? ', double-sided' : ''}</span></div>
        <div class="ticket-row"><span class="k">Binding</span><span class="v" style="text-transform:capitalize;">${r.binding}</span></div>
      </div>
      <div class="ticket-stub">
        <div class="ticket-row"><span class="k">Fulfillment</span><span class="v" style="text-transform:capitalize;">${r.fulfillment_type}</span></div>
        <div class="ticket-row"><span class="k">Estimated cost</span><span class="v">${r.estimated_cost !== null ? formatMoney(r.estimated_cost) : 'Pending review'}</span></div>
        ${r.total_amount !== null ? `<div class="ticket-row"><span class="k" style="font-weight:700;">Total</span><span class="v ticket-total">${formatMoney(r.total_amount)}</span></div>` : ''}
        ${paymentDetailsHtml(r)}
        <p style="font-size:11.5px;margin-top:10px;">Submitted on ${new Date(r.created_at).toLocaleString()}</p>
      </div>
    </div>
    ${payNowBlockHtml(r)}
    ${confirmationBlockHtml(r, 'PRT')}`;
}

// ===================================================================
// Pay Now — for print requests: no payment is collected at submission
// time since the cost isn't known yet. Once the shop sets a cost and
// the request needs delivery, the customer pays here.
// ===================================================================
function payNowBlockHtml(r) {
    if (r.fulfillment_type !== 'delivery') return '';
    if (r.payment_status !== 'awaiting_payment') return '';

    const code = r.request_code;
    const id = safeId(code);
    const total = (r.estimated_cost || 0) + (r.delivery_fee || 0);

    return `
    <div class="ticket" style="margin-top:14px;">
      <div class="ticket-main">
        <span class="ticket-label">Payment needed</span>
        <p style="margin-top:8px;">Your printing cost has been confirmed. Please pay to have it delivered.</p>
        <div class="ticket-row"><span class="k">Printing cost</span><span class="v">${formatMoney(r.estimated_cost)}</span></div>
        <div class="ticket-row"><span class="k">Delivery fee</span><span class="v">${formatMoney(r.delivery_fee)}</span></div>
        <div class="ticket-row"><span class="k" style="font-weight:700;">Total to pay</span><span class="v ticket-total">${formatMoney(total)}</span></div>
        <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="startPrintPayment('${code}', ${total})">Pay Now</button>
      </div>
    </div>`;
}

async function startPrintPayment(code, total) {
    let phone = lastSearchPhone;
    if (!phone) {
        phone = prompt('Please enter the phone number used for this print request, to confirm it\'s yours:');
        if (!phone) return;
    }

    const result = await openPaymentModal(formatMoney(total));
    if (!result) return;

    const res = await apiRequest('/print_payment.php', {
        method: 'POST',
        body: {
            request_code: code,
            phone: phone,
            payment_reference: result.payment_reference,
            payment_phone: result.payment_phone,
            payment_payer_name: result.payment_payer_name,
        },
    });

    if (!res.success) {
        showToast(res.message || 'Could not submit payment.', 'error');
        lastSearchPhone = ''; // phone may have been wrong — ask again next time
        return;
    }

    showToast('Payment submitted! We will verify it shortly.', 'success');
    document.getElementById('trackForm').requestSubmit();
}

// ===================================================================
// Confirmation & feedback — shown once an order/print request is
// marked completed, so the customer can confirm receipt or flag a
// problem (e.g. a delivery mistake), plus leave an optional comment.
// ===================================================================
function confirmationBlockHtml(record, prefix) {
    if (record.status !== 'completed') return '';

    const code = prefix === 'ORD' ? record.order_code : record.request_code;
    const id = safeId(code);
    const state = record.customer_confirmed || 'pending';

    if (state === 'received') {
        return `
        <div class="ticket" style="margin-top:14px;">
          <div class="ticket-main">
            <span class="ticket-label">Your feedback</span>
            <p style="margin-top:8px;color:var(--emerald);font-weight:700;display:flex;align-items:center;gap:6px;">${icon('check', 18)} You confirmed you received this. Thank you!</p>
            ${record.customer_rating ? `<div class="ticket-row"><span class="k">Your rating</span><span class="v" style="display:inline-flex;gap:2px;">${[1,2,3,4,5].map(n => `<span style="color:${n <= record.customer_rating ? 'var(--gold)' : 'var(--line-strong)'};">${icon('star', 15)}</span>`).join('')}</span></div>` : ''}
            ${record.customer_comment ? `<div class="ticket-row"><span class="k">Your comment</span><span class="v">${escapeHtml(record.customer_comment)}</span></div>` : ''}
          </div>
        </div>`;
    }

    if (state === 'issue_reported') {
        return `
        <div class="ticket" style="margin-top:14px;">
          <div class="ticket-main">
            <span class="ticket-label">Your report</span>
            ${record.customer_comment ? `<div class="ticket-row"><span class="k">What you told us</span><span class="v">${escapeHtml(record.customer_comment)}</span></div>` : ''}
            ${record.admin_response ? `
              <div class="alert alert-info" style="margin-top:12px;">
                <strong>Reply from INNO's Stationery:</strong><br>${escapeHtml(record.admin_response)}
              </div>
              <p style="margin-top:8px;">Has this been sorted out for you?</p>
              <div id="resolveAlert_${id}"></div>
              <button class="btn btn-primary btn-sm" onclick="confirmIssueResolved('${code}', '${id}')">Yes, it's resolved</button>
            ` : `
              <p style="margin-top:8px;">We're sorry — let us check and we'll come back to you as soon as possible.</p>
            `}
          </div>
        </div>`;
    }

    if (state === 'issue_resolved') {
        return `
        <div class="ticket" style="margin-top:14px;">
          <div class="ticket-main">
            <span class="ticket-label">Your report</span>
            <p style="margin-top:8px;color:var(--emerald);font-weight:700;display:flex;align-items:center;gap:6px;">${icon('check', 18)} Marked as resolved. Thanks for letting us know!</p>
            ${record.admin_response ? `<div class="ticket-row"><span class="k">Reply</span><span class="v">${escapeHtml(record.admin_response)}</span></div>` : ''}
          </div>
        </div>`;
    }

    // state === 'pending' — ask the customer to confirm
    return `
    <div class="ticket" style="margin-top:14px;">
      <div class="ticket-main">
        <span class="ticket-label">Welcome again</span>
        <p style="margin-top:8px;">Did you receive your ${prefix === 'ORD' ? 'order' : 'printed document'}?</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="showFeedbackForm('${code}', '${prefix}', 'received')">Yes, I received it</button>
          <button class="btn btn-outline btn-sm" onclick="showFeedbackForm('${code}', '${prefix}', 'issue_reported')">No, there's a problem</button>
        </div>
        <div id="feedbackFormWrap_${id}" style="margin-top:14px;"></div>
      </div>
    </div>`;
}

async function confirmIssueResolved(code, id) {
    const alertBox = document.getElementById(`resolveAlert_${id}`);
    let phone = lastSearchPhone;
    if (!phone) {
        phone = prompt('Please enter the phone number used for this order, to confirm it\'s yours:');
        if (!phone) return;
    }

    const res = await apiRequest('/feedback.php', {
        method: 'POST',
        body: { code, phone, confirmed: 'issue_resolved' },
    });

    if (!res.success) {
        if (alertBox) alertBox.innerHTML = `<div class="alert alert-error">${escapeHtml(res.message || 'Could not submit.')}</div>`;
        lastSearchPhone = '';
        return;
    }

    showToast(res.message, 'success');
    document.getElementById('trackForm').requestSubmit();
}

function starRatingHtml(id) {
    return `
    <div class="field">
      <label>Rate your experience (optional)</label>
      <div id="starRow_${id}" style="display:flex;gap:6px;">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn" data-value="${n}" onclick="setStarRating('${id}', ${n})" style="background:none;border:none;cursor:pointer;color:var(--line-strong);padding:2px;">${icon('star', 22)}</button>`).join('')}
      </div>
      <input type="hidden" id="starValue_${id}" value="0">
    </div>`;
}

function setStarRating(id, value) {
    document.getElementById(`starValue_${id}`).value = value;
    document.querySelectorAll(`#starRow_${id} .star-btn`).forEach(btn => {
        const isFilled = Number(btn.dataset.value) <= value;
        btn.style.color = isFilled ? 'var(--gold)' : 'var(--line-strong)';
    });
}

function showFeedbackForm(code, prefix, type) {
    const id = safeId(code);
    const wrap = document.getElementById(`feedbackFormWrap_${id}`);

    if (type === 'received') {
        wrap.innerHTML = `
          ${starRatingHtml(id)}
          <div class="field">
            <label for="comment_${id}">Leave a comment (optional)</label>
            <textarea id="comment_${id}" placeholder="Tell us how it went…"></textarea>
          </div>
          <div id="feedbackAlert_${id}"></div>
          <button class="btn btn-primary btn-block" onclick="submitFeedback('${code}', '${prefix}', 'received', '${id}')">Submit</button>
        `;
    } else {
        wrap.innerHTML = `
          <div class="alert alert-info" style="margin-top:0;">We're sorry to hear that. Please tell us what happened so we can make it right.</div>
          <div class="field">
            <label for="comment_${id}">What went wrong? *</label>
            <textarea id="comment_${id}" placeholder="e.g. item damaged, wrong product, delivery never arrived…" required></textarea>
          </div>
          <div id="feedbackAlert_${id}"></div>
          <button class="btn btn-primary btn-block" onclick="submitFeedback('${code}', '${prefix}', 'issue_reported', '${id}')">Report Issue</button>
        `;
    }
}

async function submitFeedback(code, prefix, type, id) {
    const alertBox = document.getElementById(`feedbackAlert_${id}`);
    alertBox.innerHTML = '';

    const commentEl = document.getElementById(`comment_${id}`);
    const comment = commentEl ? commentEl.value.trim() : '';
    const ratingEl = document.getElementById(`starValue_${id}`);
    const rating = ratingEl ? Number(ratingEl.value) : 0;

    if (type === 'issue_reported' && !comment) {
        alertBox.innerHTML = `<div class="alert alert-error">Please tell us what went wrong.</div>`;
        return;
    }

    let phone = lastSearchPhone;
    if (!phone) {
        phone = prompt('Please enter the phone number used for this order, to confirm it\'s yours:');
        if (!phone) return;
    }

    const res = await apiRequest('/feedback.php', {
        method: 'POST',
        body: {
            code,
            phone,
            confirmed: type,
            comment,
            rating: rating > 0 ? rating : null,
        },
    });

    if (!res.success) {
        alertBox.innerHTML = `<div class="alert alert-error">${escapeHtml(res.message || 'Could not submit feedback.')}</div>`;
        lastSearchPhone = '';
        return;
    }

    showToast(res.message, type === 'received' ? 'success' : 'info');
    document.getElementById('trackForm').requestSubmit();
}
