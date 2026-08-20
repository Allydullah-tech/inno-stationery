/* Products (shop) page logic */
let allCategories = [];
let activeCategory = '';
let activeSearch = '';

document.addEventListener('DOMContentLoaded', async () => {
    renderHeader('products');

    const params = new URLSearchParams(window.location.search);
    activeCategory = params.get('category') || '';

    await loadCategoryChips();
    loadProducts();

    document.getElementById('searchBtn').addEventListener('click', runSearch);
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSearch();
    });
});

function runSearch() {
    activeSearch = document.getElementById('searchInput').value.trim();
    loadProducts();
}

async function loadCategoryChips() {
    const res = await apiRequest('/categories.php');
    allCategories = res.success ? res.categories : [];
    renderCategoryChips();
}

function renderCategoryChips() {
    const wrap = document.getElementById('categoryRow');
    const chips = [`<button class="cat-chip ${activeCategory === '' ? 'active' : ''}" data-slug="">All</button>`]
        .concat(allCategories.map(c => `<button class="cat-chip ${activeCategory === c.slug ? 'active' : ''}" data-slug="${c.slug}">${escapeHtml(c.name)} <span style="opacity:.6;">(${c.product_count})</span></button>`));
    wrap.innerHTML = chips.join('');
    wrap.querySelectorAll('.cat-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            activeCategory = btn.dataset.slug;
            renderCategoryChips();
            loadProducts();
        });
    });
}

async function loadProducts() {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = Array(8).fill('<div class="skeleton" style="height:280px;"></div>').join('');

    let query = '?';
    if (activeCategory) query += `category=${encodeURIComponent(activeCategory)}&`;
    if (activeSearch) query += `search=${encodeURIComponent(activeSearch)}&`;

    const res = await apiRequest('/products.php' + query);
    const products = res.success ? res.products : [];

    if (!products.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <div class="es-icon" style="color:var(--emerald);">${icon('search', 40)}</div>
            <p>No products matched. Try a different search or category.</p>
        </div>`;
        return;
    }

    grid.innerHTML = products.map(productCardHtml).join('');
}
