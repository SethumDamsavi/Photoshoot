/**
 * e-Globe Showcase - WordPress & WooCommerce Backend Integration
 * Dynamically fetches live products from LocalWP (http://localhost:10004)
 */

// Backend API Endpoints (Direct and Vite proxy fallbacks)
const WP_BACKEND_URL = 'http://localhost:10004';
const PRODUCTS_API = `${WP_BACKEND_URL}/wp-json/wc/store/products?per_page=100`;
const CATEGORIES_API = `${WP_BACKEND_URL}/wp-json/wc/store/products/categories?per_page=100`;
const PROXY_PRODUCTS_API = '/wp-json/wc/store/products?per_page=100';
const PROXY_CATEGORIES_API = '/wp-json/wc/store/products/categories?per_page=100';

// SVG Icons
const ICONS = {
  heartOutline: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartFilled: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  zoom: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  cart: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  external: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
};

// Application State (Purely dynamic from backend)
let products = [];
let categories = [];
let currentCategory = 'all';
let searchQuery = '';
let currentSort = 'newest';
let currentLayout = 'masonry';
let bookmarkedIds = new Set(JSON.parse(localStorage.getItem('eglobe_bookmarks') || '[]'));

// Lightbox state
let currentLightboxIndex = -1;
let filteredProducts = [];

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadBackendData();
});

// Load products and categories from WordPress Backend
async function loadBackendData() {
  setConnectionStatus('loading', 'Connecting to WordPress backend...');
  const syncBtn = document.getElementById('sync-backend-btn');
  if (syncBtn) syncBtn.classList.add('syncing');

  try {
    // 1. Fetch categories
    await fetchCategories();
    // 2. Fetch products
    await fetchProducts();

    setConnectionStatus('online', `WordPress Backend: Connected (${products.length} products)`);
    showToast(`Loaded ${products.length} products from WordPress backend!`);
    
    const syncTimeEl = document.getElementById('sync-time-text');
    if (syncTimeEl) {
      syncTimeEl.innerText = `Synced at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (error) {
    console.error('Failed to connect to WordPress backend:', error);
    setConnectionStatus('offline', 'WordPress Backend: Offline (Check LocalWP)');
    showToast('Could not reach LocalWP backend. Make sure site is running at localhost:10004');
    renderOfflineState();
  } finally {
    if (syncBtn) syncBtn.classList.remove('syncing');
  }
}

// Fetch WooCommerce categories
async function fetchCategories() {
  let response;
  try {
    response = await fetch(CATEGORIES_API);
  } catch (_) {
    response = await fetch(PROXY_CATEGORIES_API);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status} fetching categories`);
  const rawCategories = await response.json();
  categories = rawCategories.filter(c => c.count > 0 || c.id);
  renderCategoryTabs();
}

// Fetch WooCommerce products
async function fetchProducts() {
  let response;
  try {
    response = await fetch(PRODUCTS_API);
  } catch (_) {
    response = await fetch(PROXY_PRODUCTS_API);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status} fetching products`);
  const rawProducts = await response.json();
  
  // Transform backend WooCommerce format to standardized model
  products = rawProducts.map(p => {
    const rawPrice = parseInt(p.prices?.price || '0', 10);
    const minorUnit = p.prices?.currency_minor_unit || 2;
    const priceNum = rawPrice / Math.pow(10, minorUnit);

    const rawRegularPrice = parseInt(p.prices?.regular_price || '0', 10);
    const regularPriceNum = rawRegularPrice / Math.pow(10, minorUnit);

    const currencyPrefix = p.prices?.currency_prefix || p.prices?.currency_symbol || 'රු';

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      permalink: p.permalink || `${WP_BACKEND_URL}/product/${p.slug}/`,
      sku: p.sku || 'N/A',
      price: priceNum,
      regularPrice: regularPriceNum,
      formattedPrice: formatCurrency(priceNum, currencyPrefix),
      formattedRegularPrice: formatCurrency(regularPriceNum, currencyPrefix),
      onSale: p.on_sale,
      inStock: p.is_in_stock,
      images: (p.images && p.images.length > 0) ? p.images : [{ src: 'assets/portrait.jpg', alt: p.name }],
      category: p.categories && p.categories.length > 0 ? p.categories[0].name : 'General',
      categorySlug: p.categories && p.categories.length > 0 ? p.categories[0].slug : 'general',
      categories: p.categories || [],
      shortDescription: stripHtml(p.short_description || ''),
      description: stripHtml(p.description || ''),
      attributes: p.attributes || [],
      createdAt: p.date_created || ''
    };
  });

  renderGallery();
  updateStats();
}

// ================= UI RENDERING =================
function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  container.innerHTML = `
    <button class="cat-tab ${currentCategory === 'all' ? 'active' : ''}" data-category="all" role="tab" aria-selected="${currentCategory === 'all'}">
      All Products
    </button>
    <button class="cat-tab ${currentCategory === 'bookmarks' ? 'active' : ''}" data-category="bookmarks" role="tab" aria-selected="${currentCategory === 'bookmarks'}">
      Bookmarked
    </button>
  `;

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `cat-tab ${currentCategory === cat.slug ? 'active' : ''}`;
    btn.dataset.category = cat.slug;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', currentCategory === cat.slug);
    btn.innerHTML = `${cat.name} <span class="cat-count">(${cat.count})</span>`;
    
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentCategory = cat.slug;
      renderGallery();
    });

    container.appendChild(btn);
  });

  // Re-bind click for default "all" and "bookmarks"
  container.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentCategory = btn.dataset.category;
      renderGallery();
    });
  });
}

function renderGallery() {
  const container = document.getElementById('photos-grid');
  const emptyState = document.getElementById('empty-state');
  if (!container) return;

  // Filter
  filteredProducts = products.filter(p => {
    const matchCategory = 
      currentCategory === 'all' ? true :
      currentCategory === 'bookmarks' ? bookmarkedIds.has(p.id) :
      p.categories.some(c => c.slug === currentCategory);

    const matchSearch = searchQuery === '' || 
      p.name.toLowerCase().includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery) ||
      p.shortDescription.toLowerCase().includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery);

    return matchCategory && matchSearch;
  });

  // Sort
  filteredProducts.sort((a, b) => {
    if (currentSort === 'newest') return b.id - a.id;
    if (currentSort === 'price-asc') return a.price - b.price;
    if (currentSort === 'price-desc') return b.price - a.price;
    if (currentSort === 'sale') return (b.onSale ? 1 : 0) - (a.onSale ? 1 : 0);
    if (currentSort === 'title') return a.name.localeCompare(b.name);
    return 0;
  });

  if (filteredProducts.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = '';

  filteredProducts.forEach((product, index) => {
    const card = createProductCard(product, index);
    container.appendChild(card);
  });
}

function createProductCard(product, index) {
  const card = document.createElement('article');
  card.className = 'photo-card product-card';
  card.id = `product-${product.id}`;

  const isBookmarked = bookmarkedIds.has(product.id);
  const mainImage = product.images[0]?.src || 'assets/portrait.jpg';

  card.innerHTML = `
    <div class="card-media-wrapper" role="button" tabindex="0" aria-label="View ${product.name} specifications">
      <div class="card-floating-bar">
        <span class="card-badge">${product.category}</span>
        <button class="card-fav-btn ${isBookmarked ? 'is-favorite' : ''}" title="${isBookmarked ? 'Remove bookmark' : 'Bookmark product'}" aria-label="Bookmark toggle">
          ${isBookmarked ? ICONS.heartFilled : ICONS.heartOutline}
        </button>
      </div>
      <img src="${mainImage}" alt="${product.name}" loading="lazy" onerror="this.src='assets/portrait.jpg'">
      <div class="card-hover-overlay">
        <span class="quick-view-badge">
          ${ICONS.zoom}
          <span>Quick View & Specs</span>
        </span>
      </div>
    </div>
    <div class="card-content">
      <div class="card-title-row">
        <h3 class="card-title">${product.name}</h3>
        <span class="card-date stock-indicator ${product.inStock ? 'in-stock' : 'out-of-stock'}">
          ${product.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>

      <div class="product-price-row">
        <span class="product-price">${product.formattedPrice}</span>
        ${product.onSale && product.price < product.regularPrice ? `<span class="product-regular-price">${product.formattedRegularPrice}</span>` : ''}
        ${product.onSale ? `<span class="sale-pill">Sale</span>` : ''}
      </div>

      ${product.shortDescription ? `<p class="card-story">${product.shortDescription}</p>` : ''}
      
      <div class="card-actions-row">
        <span class="card-sku">SKU: ${product.sku}</span>
        <a href="${product.permalink}" target="_blank" rel="noopener noreferrer" class="card-action-btn external-store-link" title="Open product on WordPress">
          ${ICONS.external}
          <span>View on Store</span>
        </a>
      </div>
    </div>
  `;

  // Media click -> Open Lightbox
  const mediaWrapper = card.querySelector('.card-media-wrapper');
  mediaWrapper.addEventListener('click', (e) => {
    if (!e.target.closest('.card-fav-btn')) {
      openLightbox(index);
    }
  });

  // Bookmark toggle
  const favBtn = card.querySelector('.card-fav-btn');
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleBookmark(product.id);
  });

  return card;
}

function updateStats() {
  const summaryEl = document.getElementById('stat-summary-text');
  if (summaryEl) {
    summaryEl.innerText = `${products.length} live products loaded from WordPress backend • ${categories.length} categories active`;
  }
}

// ================= FULLSCREEN LIGHTBOX & PRODUCT DETAILS =================
function setupLightboxEvents() {
  const lbModal = document.getElementById('lightbox-modal');
  const lbBackdrop = document.getElementById('lightbox-backdrop');
  const lbCloseBtn = document.getElementById('lb-close-btn');
  const lbPrevBtn = document.getElementById('lb-prev-btn');
  const lbNextBtn = document.getElementById('lb-next-btn');
  const lbFavBtn = document.getElementById('lb-favorite-btn');

  const closeLb = () => {
    lbModal.classList.remove('open');
    lbModal.setAttribute('aria-hidden', 'true');
  };

  lbCloseBtn.addEventListener('click', closeLb);
  lbBackdrop.addEventListener('click', closeLb);

  lbPrevBtn.addEventListener('click', () => navigateLightbox(-1));
  lbNextBtn.addEventListener('click', () => navigateLightbox(1));

  lbFavBtn.addEventListener('click', () => {
    if (currentLightboxIndex >= 0 && filteredProducts[currentLightboxIndex]) {
      const p = filteredProducts[currentLightboxIndex];
      toggleBookmark(p.id);
      updateLightboxContent();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!lbModal.classList.contains('open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });
}

function openLightbox(index) {
  if (index < 0 || index >= filteredProducts.length) return;
  currentLightboxIndex = index;
  const lbModal = document.getElementById('lightbox-modal');
  lbModal.classList.add('open');
  lbModal.setAttribute('aria-hidden', 'false');
  updateLightboxContent();
}

function navigateLightbox(direction) {
  if (filteredProducts.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex + direction + filteredProducts.length) % filteredProducts.length;
  updateLightboxContent();
}

function updateLightboxContent() {
  const product = filteredProducts[currentLightboxIndex];
  if (!product) return;

  const lbImage = document.getElementById('lightbox-image');
  const lbCounter = document.getElementById('lightbox-counter');
  const lbCatBadge = document.getElementById('lb-category-badge');
  const lbStockBadge = document.getElementById('lb-stock-badge');
  const lbSkuText = document.getElementById('lb-sku-text');
  const lbTitle = document.getElementById('lb-title');
  const lbPrice = document.getElementById('lb-price');
  const lbCaption = document.getElementById('lb-caption');
  const lbFavBtn = document.getElementById('lb-favorite-btn');
  const lbStoreLink = document.getElementById('lb-store-link');
  const lbAttributesContainer = document.getElementById('lb-attributes-container');

  const mainImage = product.images[0]?.src || 'assets/portrait.jpg';
  lbImage.style.opacity = '0';
  setTimeout(() => {
    lbImage.src = mainImage;
    lbImage.alt = product.name;
    lbImage.style.opacity = '1';
  }, 80);

  lbCounter.innerText = `Product ${currentLightboxIndex + 1} of ${filteredProducts.length}`;
  lbCatBadge.innerText = product.category;
  lbStockBadge.innerText = product.inStock ? 'In Stock' : 'Out of Stock';
  lbStockBadge.className = `badge-pill ${product.inStock ? 'stock-pill' : 'out-of-stock-pill'}`;
  lbSkuText.innerText = `SKU: ${product.sku}`;
  lbTitle.innerText = product.name;
  lbPrice.innerHTML = `
    <span>${product.formattedPrice}</span>
    ${product.onSale && product.price < product.regularPrice ? `<del>${product.formattedRegularPrice}</del>` : ''}
  `;
  lbCaption.innerText = product.description || product.shortDescription || 'No description provided in WordPress backend.';
  lbStoreLink.href = product.permalink;

  const isBookmarked = bookmarkedIds.has(product.id);
  if (isBookmarked) {
    lbFavBtn.classList.add('is-favorite');
    lbFavBtn.innerHTML = ICONS.heartFilled;
  } else {
    lbFavBtn.classList.remove('is-favorite');
    lbFavBtn.innerHTML = ICONS.heartOutline;
  }

  // Render specifications / attributes from WordPress backend
  if (product.attributes && product.attributes.length > 0) {
    lbAttributesContainer.style.display = 'grid';
    lbAttributesContainer.innerHTML = product.attributes.map(attr => `
      <div class="attr-box">
        <span class="attr-name">${attr.name}</span>
        <span class="attr-val">${attr.terms && attr.terms.length > 0 ? attr.terms.map(t => t.name).join(', ') : 'Yes'}</span>
      </div>
    `).join('');
  } else {
    lbAttributesContainer.style.display = 'none';
    lbAttributesContainer.innerHTML = '';
  }
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  // Sync live products button
  const syncBtn = document.getElementById('sync-backend-btn');
  if (syncBtn) syncBtn.addEventListener('click', loadBackendData);

  const forceReloadBtn = document.getElementById('force-reload-btn');
  if (forceReloadBtn) forceReloadBtn.addEventListener('click', loadBackendData);

  // Search input
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      clearSearchBtn.style.display = searchQuery ? 'inline-block' : 'none';
      renderGallery();
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      renderGallery();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderGallery();
    });
  }

  // View switch (Masonry vs Grid)
  const viewMasonryBtn = document.getElementById('view-masonry-btn');
  const viewGridBtn = document.getElementById('view-grid-btn');
  const photosGrid = document.getElementById('photos-grid');

  if (viewMasonryBtn && viewGridBtn) {
    viewMasonryBtn.addEventListener('click', () => {
      viewMasonryBtn.classList.add('active');
      viewGridBtn.classList.remove('active');
      currentLayout = 'masonry';
      photosGrid.className = 'photos-grid masonry-mode';
    });

    viewGridBtn.addEventListener('click', () => {
      viewGridBtn.classList.add('active');
      viewMasonryBtn.classList.remove('active');
      currentLayout = 'grid';
      photosGrid.className = 'photos-grid uniform-grid-mode';
    });
  }

  // Export JSON backup
  const exportBtn = document.getElementById('export-album-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = {
        exportDate: new Date().toISOString(),
        source: WP_BACKEND_URL,
        totalProducts: products.length,
        products: products
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eglobe_wordpress_products_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Exported catalog data as JSON');
    });
  }

  setupLightboxEvents();
}

// ================= HELPERS =================
function toggleBookmark(id) {
  if (bookmarkedIds.has(id)) {
    bookmarkedIds.delete(id);
    showToast('Removed from bookmarks');
  } else {
    bookmarkedIds.add(id);
    showToast('Product bookmarked');
  }
  localStorage.setItem('eglobe_bookmarks', JSON.stringify([...bookmarkedIds]));
  renderGallery();
}

function setConnectionStatus(state, message) {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  if (!dot || !label) return;

  dot.className = `status-indicator-dot ${state}`;
  label.innerText = message;
}

function formatCurrency(amount, prefix = 'රු') {
  if (isNaN(amount) || amount === 0) return `${prefix} 0.00`;
  return `${prefix} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function renderOfflineState() {
  const container = document.getElementById('photos-grid');
  if (!container) return;
  container.innerHTML = `
    <div class="offline-warning-box">
      <div class="offline-icon">⚠️</div>
      <h3>WordPress Backend is Offline</h3>
      <p>The frontend is attempting to connect to <strong>http://localhost:10004</strong> (LocalWP).</p>
      <p>Please open <strong>Local</strong> and ensure your site <em>Eglobe</em> is started.</p>
      <button onclick="loadBackendData()" class="btn btn-primary" style="margin-top:14px;">Retry Connection</button>
    </div>
  `;
}

let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  toastMsg.innerText = msg;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}
