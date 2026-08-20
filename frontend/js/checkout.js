/* Checkout page logic */
let deliveryFee = 0;

document.addEventListener('DOMContentLoaded', async () => {
    renderHeader('products');

    if (Cart.items.length === 0) {
        document.getElementById('checkoutContent').innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <div class="es-icon" style="color:var(--emerald);">${icon('basket', 40)}</div>
            <p>Your cart is empty.</p>
            <a href="products.html" class="btn btn-primary" style="margin-top:10px;">Shop products</a>
          </div>`;
        document.getElementById('checkoutContent').style.gridTemplateColumns = '1fr';
        return;
    }

    const settings = await loadPaymentSettings();
    deliveryFee = Number(settings.delivery_fee) || 0;

    renderSummary();

    document.querySelectorAll('input[name="fulfillment"]').forEach(r => {
        r.addEventListener('change', () => {
            const isDelivery = document.querySelector('input[name="fulfillment"]:checked').value === 'delivery';
            document.getElementById('addressField').style.display = isDelivery ? 'block' : 'none';
            document.getElementById('custAddress').required = isDelivery;
            renderSummary();
        });
    });

    document.getElementById('checkoutForm').addEventListener('submit', submitOrder);
});

function renderSummary() {
    const wrap = document.getElementById('summaryItems');
    wrap.innerHTML = Cart.items.map(i => `
      <div class="ticket-row"><span class="k">${escapeHtml(i.name)} × ${i.quantity}</span><span class="v">${formatMoney(i.price * i.quantity)}</span></div>
    `).join('');

    const isDelivery = document.querySelector('input[name="fulfillment"]:checked')?.value === 'delivery';
    const subtotal = Cart.subtotal();
    const fee = isDelivery ? deliveryFee : 0;

    document.getElementById('sumSubtotal').textContent = formatMoney(subtotal);
    document.getElementById('sumDelivery').textContent = isDelivery ? formatMoney(fee) : 'Free (pickup)';
    document.getElementById('sumTotal').textContent = formatMoney(subtotal + fee);
}

async function submitOrder(e) {
    e.preventDefault();
    const alertBox = document.getElementById('checkoutAlert');
    alertBox.innerHTML = '';

    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const fulfillment = document.querySelector('input[name="fulfillment"]:checked').value;
    const address = document.getElementById('custAddress').value.trim();
    const notes = document.getElementById('custNotes').value.trim();

    if (fulfillment === 'delivery' && !address) {
        alertBox.innerHTML = `<div class="alert alert-error">Please enter a delivery address.</div>`;
        return;
    }

    let paymentInfo = { payment_reference: '', payment_phone: '', payment_payer_name: '' };

    if (fulfillment === 'delivery') {
        const subtotal = Cart.subtotal();
        const total = subtotal + deliveryFee;
        const result = await openPaymentModal(formatMoney(total));
        if (!result) {
            alertBox.innerHTML = `<div class="alert alert-info">Payment was not completed, so the order wasn't placed. You can try again anytime.</div>`;
            return;
        }
        paymentInfo = result;
    }

    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Placing order…';

    const payload = {
        customer_name: name,
        phone,
        email,
        fulfillment_type: fulfillment,
        address,
        notes,
        items: Cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        payment_reference: paymentInfo.payment_reference,
        payment_phone: paymentInfo.payment_phone,
        payment_payer_name: paymentInfo.payment_payer_name,
    };

    const res = await apiRequest('/orders.php', { method: 'POST', body: payload });

    btn.disabled = false;
    btn.textContent = 'Place Order';

    if (!res.success) {
        alertBox.innerHTML = `<div class="alert alert-error">${escapeHtml(res.message || 'Could not place order.')}</div>`;
        return;
    }

    Cart.clear();
    showSuccessView(res.order_code, res.total_amount, fulfillment, fulfillment === 'delivery' ? paymentInfo : null);
}

function showSuccessView(code, total, fulfillment, paymentInfo) {
    document.getElementById('checkoutContent').style.display = 'none';
    const view = document.getElementById('successView');
    view.style.display = 'block';
    view.innerHTML = `
      <div class="ticket">
        <div class="ticket-main">
          <span class="ticket-label">Order confirmed</span>
          <div class="ticket-code">${code}</div>
          <p style="margin-top:10px;">Thank you! ${fulfillment === 'delivery' ? "We're verifying your payment and will begin preparing your order shortly." : 'Your order is being prepared — you can collect it once it\'s ready.'}</p>
        </div>
        <div class="ticket-stub">
          <div class="ticket-row"><span class="k">Total</span><span class="v ticket-total">${formatMoney(total)}</span></div>
          <div class="ticket-row"><span class="k">Fulfillment</span><span class="v" style="text-transform:capitalize;">${fulfillment}</span></div>
          ${paymentInfo ? `
            <h4 style="margin:14px 0 4px;font-size:13px;">Payment details submitted</h4>
            <div class="ticket-row"><span class="k">Paid by</span><span class="v">${escapeHtml(paymentInfo.payment_payer_name)}</span></div>
            <div class="ticket-row"><span class="k">From number</span><span class="v">${escapeHtml(paymentInfo.payment_phone)}</span></div>
            <div class="ticket-row"><span class="k">Transaction ID</span><span class="v mono">${escapeHtml(paymentInfo.payment_reference)}</span></div>
          ` : ''}
          <p style="font-size:13px;margin-top:14px;">Save your tracking code above — you'll need it, or your phone number, to track this order.</p>
          <a href="track.html?code=${encodeURIComponent(code)}" class="btn btn-primary btn-block" style="margin-top:6px;">Track this order</a>
          <a href="products.html" class="btn btn-ghost btn-block" style="margin-top:10px;">Continue shopping</a>
        </div>
      </div>`;
}
