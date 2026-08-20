/* Admin products page logic */
let adminCategories = [];

(async () => {
    const admin = await guardAdminPage();
    if (!admin) return;
    renderAdminShell('products', 'Products', admin);

    await loadCategoriesForAdmin();
    loadProductsAdmin();

    document.getElementById('newProductBtn').addEventListener('click', () => openProductModal());
    document.getElementById('productModalClose').addEventListener('click', closeProductModal);
    document.getElementById('productModalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'productModalBackdrop') closeProductModal(); });
    document.getElementById('productForm').addEventListener('submit', saveProduct);
    document.getElementById('filterCategory').addEventListener('change', loadProductsAdmin);
    document.getElementById('newCategoryForm').addEventListener('submit', addCategory);
})();

async function loadCategoriesForAdmin() {
    const res = await adminApi('/categories.php');
    adminCategories = res.success ? res.categories : [];

    const filterSel = document.getElementById('filterCategory');
    filterSel.innerHTML = '<option value="">All categories</option>' + adminCategories.map(c => `<option value="${c.slug}">${adminEscapeHtml(c.name)}</option>`).join('');

    const formSel = document.getElementById('pf_category');
    formSel.innerHTML = '<option value="">— none —</option>' + adminCategories.map(c => `<option value="${c.id}">${adminEscapeHtml(c.name)}</option>`).join('');

    document.getElementById('categoryChipsAdmin').innerHTML = adminCategories.map(c => `
      <span class="status-pill status-confirmed" style="display:inline-flex;align-items:center;gap:8px;">
        ${adminEscapeHtml(c.name)} (${c.product_count})
        <button onclick="deleteCategory(${c.id})" style="background:none;border:none;cursor:pointer;color:inherit;font-weight:700;">×</button>
      </span>
    `).join('') || '<p style="color:var(--ink-soft);font-size:13.5px;">No categories yet.</p>';
}

async function addCategory(e) {
    e.preventDefault();
    const name = document.getElementById('newCategoryName').value.trim();
    if (!name) return;
    const res = await adminApi('/categories.php', { method: 'POST', body: { name } });
    if (res.success) {
        document.getElementById('newCategoryName').value = '';
        adminToast('Category added.', 'success');
        loadCategoriesForAdmin();
    } else {
        adminToast(res.message || 'Could not add category.', 'error');
    }
}

async function deleteCategory(id) {
    if (!confirm('Delete this category? Products in it will become uncategorised.')) return;
    const res = await adminApi('/categories.php?id=' + id, { method: 'DELETE' });
    if (res.success) { adminToast('Category deleted.', 'success'); loadCategoriesForAdmin(); loadProductsAdmin(); }
    else adminToast(res.message || 'Could not delete.', 'error');
}

async function loadProductsAdmin() {
    const tbody = document.getElementById('productsTbody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;">Loading…</td></tr>`;

    const cat = document.getElementById('filterCategory').value;
    const res = await adminApi('/products.php' + (cat ? `?category=${encodeURIComponent(cat)}` : ''));
    const products = res.success ? res.products : [];

    if (!products.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:34px;color:var(--ink-soft);">No products yet. Click "Add Product" to get started.</td></tr>`;
        return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td><img src="${p.image_url || '../assets/placeholder.svg'}" class="table-thumb" onerror="this.src='../assets/placeholder.svg'"></td>
        <td><strong>${adminEscapeHtml(p.name)}</strong>${p.is_featured ? ` <span style="color:var(--gold-deep);font-size:11px;">${adminIcon('star', 12)} Featured</span>` : ''}</td>
        <td>${adminEscapeHtml(p.category_name || '—')}</td>
        <td class="mono">${adminFormatMoney(p.price)}</td>
        <td>${p.stock}</td>
        <td><span class="status-pill status-${p.status === 'active' ? 'completed' : 'cancelled'}">${p.status}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="icon-btn" onclick='openProductModal(${JSON.stringify(p).replace(/'/g, "&apos;")})' aria-label="Edit">${adminIcon('edit', 15)}</button>
            <button class="icon-btn danger" onclick="deleteProduct(${p.id})" aria-label="Delete">${adminIcon('trash', 15)}</button>
          </div>
        </td>
      </tr>
    `).join('');
}

function openProductModal(product = null) {
    document.getElementById('productFormAlert').innerHTML = '';
    document.getElementById('productForm').reset();
    document.getElementById('pf_id').value = product ? product.id : '';
    document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';

    if (product) {
        document.getElementById('pf_name').value = product.name;
        document.getElementById('pf_description').value = product.description || '';
        document.getElementById('pf_price').value = product.price;
        document.getElementById('pf_stock').value = product.stock;
        document.getElementById('pf_category').value = product.category_id || '';
        document.getElementById('pf_status').value = product.status;
        document.getElementById('pf_featured').checked = !!product.is_featured;
    }

    document.getElementById('productModalBackdrop').classList.add('open');
}
function closeProductModal() {
    document.getElementById('productModalBackdrop').classList.remove('open');
}

async function saveProduct(e) {
    e.preventDefault();
    const alertBox = document.getElementById('productFormAlert');
    alertBox.innerHTML = '';

    const id = document.getElementById('pf_id').value;
    const fd = new FormData();
    fd.append('name', document.getElementById('pf_name').value.trim());
    fd.append('description', document.getElementById('pf_description').value.trim());
    fd.append('price', document.getElementById('pf_price').value);
    fd.append('stock', document.getElementById('pf_stock').value);
    fd.append('category_id', document.getElementById('pf_category').value);
    fd.append('status', document.getElementById('pf_status').value);
    fd.append('is_featured', document.getElementById('pf_featured').checked ? '1' : '');
    const imgFile = document.getElementById('pf_image').files[0];
    if (imgFile) fd.append('image', imgFile);

    const btn = document.getElementById('productSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    let res;
    if (id) {
        fd.append('id', id);
        fd.append('_method', 'PUT'); // multipart PUT isn't parsed by PHP, so we POST with an override flag
        res = await adminApi('/products.php', { method: 'POST', body: fd, isForm: true });
    } else {
        res = await adminApi('/products.php', { method: 'POST', body: fd, isForm: true });
    }

    btn.disabled = false;
    btn.textContent = 'Save Product';

    if (!res.success) {
        alertBox.innerHTML = `<div class="alert alert-error">${adminEscapeHtml(res.message || 'Could not save product.')}</div>`;
        return;
    }

    adminToast(id ? 'Product updated.' : 'Product added.', 'success');
    closeProductModal();
    loadProductsAdmin();
    loadCategoriesForAdmin();
}

async function deleteProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    const res = await adminApi('/products.php?id=' + id, { method: 'DELETE' });
    if (res.success) { adminToast('Product deleted.', 'success'); loadProductsAdmin(); }
    else adminToast(res.message || 'Could not delete.', 'error');
}
