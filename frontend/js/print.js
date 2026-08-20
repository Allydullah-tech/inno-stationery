/* Print request page logic */
let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
    renderHeader('print');

    const fileDrop = document.getElementById('fileDrop');
    const fileInput = document.getElementById('fileInput');

    fileDrop.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) setSelectedFile(fileInput.files[0]);
    });
    ['dragover', 'dragenter'].forEach(evt => fileDrop.addEventListener(evt, (e) => { e.preventDefault(); fileDrop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(evt => fileDrop.addEventListener(evt, (e) => { e.preventDefault(); fileDrop.classList.remove('drag'); }));
    fileDrop.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length) setSelectedFile(e.dataTransfer.files[0]);
    });

    document.querySelectorAll('input[name="pFulfillment"]').forEach(r => {
        r.addEventListener('change', () => {
            const isDelivery = document.querySelector('input[name="pFulfillment"]:checked').value === 'delivery';
            document.getElementById('pAddressField').style.display = isDelivery ? 'block' : 'none';
            document.getElementById('pAddress').required = isDelivery;
        });
    });

    document.getElementById('printForm').addEventListener('submit', submitPrintRequest);
});

function setSelectedFile(file) {
    selectedFile = file;
    const sizeKb = Math.round(file.size / 1024);
    document.getElementById('fileDropLabel').innerHTML = `<strong>${escapeHtml(file.name)}</strong><br><small style="color:var(--ink-soft);">${sizeKb.toLocaleString()} KB — click to change</small>`;
}

async function submitPrintRequest(e) {
    e.preventDefault();
    const alertBox = document.getElementById('printAlert');
    alertBox.innerHTML = '';

    if (!selectedFile) {
        alertBox.innerHTML = `<div class="alert alert-error">Please attach the document you want printed.</div>`;
        return;
    }

    const fulfillment = document.querySelector('input[name="pFulfillment"]:checked').value;
    const address = document.getElementById('pAddress').value.trim();
    if (fulfillment === 'delivery' && !address) {
        alertBox.innerHTML = `<div class="alert alert-error">Please enter a delivery address.</div>`;
        return;
    }

    // No payment is collected here — printing cost varies by document, so the
    // shop reviews it first and sets a cost. You'll pay afterwards from the
    // tracking page once that cost is confirmed.

    const btn = document.getElementById('submitPrintBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting…';

    const fd = new FormData();
    fd.append('document', selectedFile);
    fd.append('customer_name', document.getElementById('pName').value.trim());
    fd.append('phone', document.getElementById('pPhone').value.trim());
    fd.append('email', document.getElementById('pEmail').value.trim());
    fd.append('copies', document.getElementById('pCopies').value);
    fd.append('paper_size', document.getElementById('pPaperSize').value);
    fd.append('color_mode', document.querySelector('input[name="colorMode"]:checked').value);
    fd.append('binding', document.getElementById('pBinding').value);
    fd.append('double_sided', document.getElementById('pDoubleSided').checked ? '1' : '');
    fd.append('instructions', document.getElementById('pInstructions').value.trim());
    fd.append('fulfillment_type', fulfillment);
    fd.append('address', address);

    const res = await apiRequest('/print_requests.php', { method: 'POST', body: fd, isForm: true });

    btn.disabled = false;
    btn.textContent = 'Submit Print Request';

    if (!res.success) {
        alertBox.innerHTML = `<div class="alert alert-error">${escapeHtml(res.message || 'Could not submit request.')}</div>`;
        return;
    }

    document.getElementById('printFormWrap').style.display = 'none';
    const view = document.getElementById('printSuccessView');
    view.style.display = 'block';
    view.innerHTML = `
      <div class="ticket">
        <div class="ticket-main">
          <span class="ticket-label">Print request received</span>
          <div class="ticket-code">${res.request_code}</div>
          <p style="margin-top:10px;">We'll review your document and let you know the exact cost. ${fulfillment === 'delivery' ? "You'll be able to pay online once it's confirmed — just check back with your tracking code." : ''}</p>
        </div>
        <div class="ticket-stub">
          <p style="font-size:13px;">Save this code — you'll need it, or your phone number, to track this request and pay once the cost is confirmed.</p>
          <a href="track.html?code=${encodeURIComponent(res.request_code)}" class="btn btn-primary btn-block" style="margin-top:6px;">Track this request</a>
          <a href="index.html" class="btn btn-ghost btn-block" style="margin-top:10px;">Back to home</a>
        </div>
      </div>`;
}
