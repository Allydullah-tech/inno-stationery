/* Home page logic */
document.addEventListener('DOMContentLoaded', async () => {
    renderHeader('home');
    loadHomeCategories();
    loadFeaturedProducts();
});

const CATEGORY_ICONS = {
    'books-notebooks': icon('book', 16),
    'pens-pencils': icon('pencil', 16),
    'files-folders': icon('folder', 16),
    'art-craft': icon('palette', 16),
    'office-supplies': icon('briefcase', 16),
    'school-supplies': icon('backpack', 16),
};

async function loadHomeCategories() {
    const wrap = document.getElementById('homeCategoryRow');
    const section = document.getElementById('categorySection');
    const res = await apiRequest('/categories.php');
    if (!res.success || !res.categories.length) {
        if (section) section.style.display = 'none';
        return;
    }
    wrap.innerHTML = res.categories.map(c => `
      <a href="products.html?category=${encodeURIComponent(c.slug)}" class="cat-chip">
        <span style="display:inline-flex;">${CATEGORY_ICONS[c.slug] || icon('tag', 16)}</span> ${escapeHtml(c.name)}
      </a>
    `).join('');
}

async function loadFeaturedProducts() {
    const grid = document.getElementById('featuredGrid');
    const res = await apiRequest('/products.php?featured=1&limit=8');
    let products = (res.success && res.products.length) ? res.products : null;

    if (!products) {
        // fall back to latest products if nothing is marked featured yet
        const fallback = await apiRequest('/products.php?limit=8');
        products = fallback.success ? fallback.products : [];
    }

    if (!products.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <div class="es-icon" style="color:var(--emerald);">${icon('package', 40)}</div>
            <p>No products yet. Check back soon — the shop owner is stocking up!</p>
        </div>`;
        return;
    }

    grid.innerHTML = products.map(productCardHtml).join('');
}

function productCardHtml(p) {
    const outOfStock = p.stock <= 0;
    return `
    <div class="product-card">
      <div class="product-thumb">
        ${p.image_url ? `<img src="${p.image_url}" alt="${escapeHtml(p.name)}" onerror="this.parentElement.innerHTML='<span class=\\'ph-icon\\'>${icon('package', 32)}</span>'">` : `<span class="ph-icon">${icon('package', 32)}</span>`}
        ${p.is_featured ? '<span class="badge-featured">Featured</span>' : ''}
        ${outOfStock ? '<span class="badge-stock">Out of stock</span>' : (p.stock <= 5 ? `<span class="badge-stock">Only ${p.stock} left</span>` : '')}
      </div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(p.category_name || 'Stationery')}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="product-desc">${escapeHtml((p.description || '').slice(0, 70))}${(p.description||'').length > 70 ? '…' : ''}</p>
        <div class="product-foot">
          <span class="product-price">${formatMoney(p.price)}</span>
          <button class="add-btn" ${outOfStock ? 'disabled' : ''} onclick='quickAddToCart(${JSON.stringify(p).replace(/'/g, "&apos;")})' aria-label="Add ${escapeHtml(p.name)} to cart">+</button>
        </div>
      </div>
    </div>`;
}

function quickAddToCart(product) {
    Cart.add(product, 1);
    showToast(`Added "${product.name}" to your cart.`, 'success');
}
