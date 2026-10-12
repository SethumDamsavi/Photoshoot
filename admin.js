/**
 * Admin Studio Client - Birthday Shoot Photo Archive
 * Handles Authentication, Photo Uploads & Curation, Album Management.
 * Zero Pricing - Dedicated to Photography & Milestone Memories.
 */

// State
let authToken = localStorage.getItem('admin_token') || '';
let currentUser = null;
let allProducts = [];
let allCategories = [];

// DOM References
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const togglePasswordBtn = document.getElementById('toggle-password-btn');
const loginErrorAlert = document.getElementById('login-error');
const currentUserNameEl = document.getElementById('current-user-name');
const logoutBtn = document.getElementById('logout-btn');

// Stats
const statProductsCount = document.getElementById('stat-products-count');
const statCategoriesCount = document.getElementById('stat-categories-count');
const statFeaturedCount = document.getElementById('stat-featured-count');
const statLocationsCount = document.getElementById('stat-locations-count');

// Table & Toolbar
const productsTableBody = document.getElementById('products-table-body');
const searchInput = document.getElementById('admin-search-input');
const categoryFilter = document.getElementById('admin-category-filter');
const sortFilter = document.getElementById('admin-sort-filter');
const openAddProductBtn = document.getElementById('open-add-product-btn');
const openCategoryModalBtn = document.getElementById('open-category-modal-btn');

// Photo Modal
const productModal = document.getElementById('product-modal');
const productModalBackdrop = document.getElementById('product-modal-backdrop');
const closeProductModalBtn = document.getElementById('close-product-modal');
const cancelProductModalBtn = document.getElementById('cancel-product-modal-btn');
const productModalTitle = document.getElementById('product-modal-title');
const productForm = document.getElementById('product-form');
const productEditId = document.getElementById('product-edit-id');
const prodNameInput = document.getElementById('prod-name');
const prodCategoryInput = document.getElementById('prod-category');
const categoriesDatalist = document.getElementById('categories-datalist');
const prodDateInput = document.getElementById('prod-date');
const prodLocationInput = document.getElementById('prod-location');
const prodPublishedCheckbox = document.getElementById('prod-published');
const prodFeaturedCheckbox = document.getElementById('prod-featured');
const prodShortDescInput = document.getElementById('prod-short-desc');
const prodDescInput = document.getElementById('prod-desc');
const prodImageUrlInput = document.getElementById('prod-image-url');
const prodFileInput = document.getElementById('prod-file-input');
const adminDropZone = document.getElementById('admin-drop-zone');
const imagePreviewImg = document.getElementById('image-preview-img');
const addAttributeBtn = document.getElementById('add-attribute-btn');
const attributesList = document.getElementById('attributes-list');

// Category Modal
const categoryModal = document.getElementById('category-modal');
const categoryModalBackdrop = document.getElementById('category-modal-backdrop');
const closeCategoryModalBtn = document.getElementById('close-category-modal');
const addCategoryForm = document.getElementById('add-category-form');
const newCategoryNameInput = document.getElementById('new-category-name');
const categoryListBody = document.getElementById('category-list-body');

// Hero Settings Modal & Elements
let currentHeroSettings = {
  heroImage: 'assets/portrait.jpg',
  heroChapter: 'Chapter 21',
  heroSubtitle: 'Milestone Portrait',
  heroName: 'RAVEESHA',
  heroDate: 'OCTOBER 2026'
};

const openHeroSettingsBtn = document.getElementById('open-hero-settings-btn');
const heroSettingsModal = document.getElementById('hero-settings-modal');
const heroSettingsModalBackdrop = document.getElementById('hero-settings-modal-backdrop');
const closeHeroSettingsModalBtn = document.getElementById('close-hero-settings-modal');
const cancelHeroSettingsBtn = document.getElementById('cancel-hero-settings-btn');
const heroSettingsForm = document.getElementById('hero-settings-form');
const heroPreviewImg = document.getElementById('hero-preview-img');
const heroDropZone = document.getElementById('hero-drop-zone');
const heroFileInput = document.getElementById('hero-file-input');
const heroBrowseLink = document.getElementById('hero-browse-link');
const heroImageUrlInput = document.getElementById('hero-image-url-input');
const heroChapterInput = document.getElementById('hero-chapter-input');
const heroSubtitleInput = document.getElementById('hero-subtitle-input');
const heroNameInput = document.getElementById('hero-name-input');
const heroDateInput = document.getElementById('hero-date-input');

// Toast
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
let toastTimer = null;

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuthSession();
});

// Toast notification helper
function showToast(msg) {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = msg;
  toast.classList.add('active');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('active');
  }, 3200);
}

// Authenticated fetch wrapper
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  if (res.status === 401 && !endpoint.includes('/api/auth/login')) {
    handleLogout();
    throw new Error('Session expired. Please log in again.');
  }

  return res;
}

// Check session on startup
async function checkAuthSession() {
  if (!authToken) {
    showLoginView();
    return;
  }

  try {
    const res = await apiRequest('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      showDashboardView();
      loadDashboardData();
    } else {
      showLoginView();
    }
  } catch (_) {
    showLoginView();
  }
}

function showLoginView() {
  loginSection.style.display = 'flex';
  dashboardSection.style.display = 'none';
}

function showDashboardView() {
  loginSection.style.display = 'none';
  dashboardSection.style.display = 'flex';
  if (currentUserNameEl && currentUser) {
    currentUserNameEl.textContent = currentUser.name || currentUser.username;
  }
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  // Password Visibility Toggle with Clean SVGs
  const EYE_SHOW_SVG = `<svg class="password-eye-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const EYE_HIDE_SVG = `<svg class="password-eye-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

  if (togglePasswordBtn && loginPasswordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = loginPasswordInput.type === 'password';
      loginPasswordInput.type = isPassword ? 'text' : 'password';
      togglePasswordBtn.innerHTML = isPassword ? EYE_HIDE_SVG : EYE_SHOW_SVG;
      togglePasswordBtn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
      togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  // Login Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginErrorAlert.style.display = 'none';
      const username = loginUsernameInput.value.trim();
      const password = loginPasswordInput.value.trim();

      const submitBtn = document.getElementById('login-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Verifying...</span>';
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          authToken = data.token;
          currentUser = data.user;
          localStorage.setItem('admin_token', authToken);
          showToast(`Welcome back, ${currentUser.name || currentUser.username}!`);
          showDashboardView();
          loadDashboardData();
        } else {
          loginErrorAlert.textContent = data.error || 'Authentication failed. Please check credentials.';
          loginErrorAlert.style.display = 'block';
        }
      } catch (err) {
        loginErrorAlert.textContent = 'Server connection failed. Make sure backend is running.';
        loginErrorAlert.style.display = 'block';
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Sign In to Studio</span>';
        }
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Search & Filtering
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(fetchProducts, 250);
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', fetchProducts);
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', fetchProducts);
  }

  // Modal Open/Close Controls
  if (openAddProductBtn) {
    openAddProductBtn.addEventListener('click', openAddProductModal);
  }

  if (closeProductModalBtn) {
    closeProductModalBtn.addEventListener('click', closeProductModal);
  }

  if (cancelProductModalBtn) {
    cancelProductModalBtn.addEventListener('click', closeProductModal);
  }

  if (productModalBackdrop) {
    productModalBackdrop.addEventListener('click', closeProductModal);
  }

  // Category Modal Controls
  if (openCategoryModalBtn) {
    openCategoryModalBtn.addEventListener('click', openCategoryModal);
  }

  if (closeCategoryModalBtn) {
    closeCategoryModalBtn.addEventListener('click', closeCategoryModal);
  }

  if (categoryModalBackdrop) {
    categoryModalBackdrop.addEventListener('click', closeCategoryModal);
  }

  if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', handleAddCategory);
  }

  // Hero Settings Modal Controls
  if (openHeroSettingsBtn) {
    openHeroSettingsBtn.addEventListener('click', openHeroSettingsModal);
  }

  if (closeHeroSettingsModalBtn) {
    closeHeroSettingsModalBtn.addEventListener('click', closeHeroSettingsModal);
  }

  if (cancelHeroSettingsBtn) {
    cancelHeroSettingsBtn.addEventListener('click', closeHeroSettingsModal);
  }

  if (heroSettingsModalBackdrop) {
    heroSettingsModalBackdrop.addEventListener('click', closeHeroSettingsModal);
  }

  if (heroSettingsForm) {
    heroSettingsForm.addEventListener('submit', handleHeroSettingsSubmit);
  }

  if (heroImageUrlInput) {
    heroImageUrlInput.addEventListener('input', () => {
      if (heroPreviewImg) {
        heroPreviewImg.src = heroImageUrlInput.value.trim() || 'assets/portrait.jpg';
      }
    });
  }

  setupHeroImageUploader();

  // Esc key close modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProductModal();
      closeCategoryModal();
      closeHeroSettingsModal();
    }
  });

  // Photo Form Submission
  if (productForm) {
    productForm.addEventListener('submit', handleProductFormSubmit);
  }

  // Dynamic Attribute Button
  if (addAttributeBtn) {
    addAttributeBtn.addEventListener('click', () => addAttributeRow('', ''));
  }

  // Image Upload Handling
  setupImageUploader();
}

function handleLogout() {
  if (authToken) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    }).catch(() => {});
  }
  authToken = '';
  currentUser = null;
  localStorage.removeItem('admin_token');
  showLoginView();
  showToast('Logged out securely.');
}

// ================= DATA LOADING =================
async function loadDashboardData() {
  await fetchCategories();
  await fetchProducts();
  await fetchHeroSettings();
}

async function fetchCategories() {
  try {
    const res = await apiRequest('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch albums');
    allCategories = await res.json();

    // Populate Datalist
    if (categoriesDatalist) {
      categoriesDatalist.innerHTML = allCategories
        .map(c => `<option value="${escapeHtml(c.name)}">`)
        .join('');
    }

    // Populate Category Filter dropdown
    if (categoryFilter) {
      const currentSelected = categoryFilter.value;
      categoryFilter.innerHTML = '<option value="all">All Albums</option>' +
        allCategories.map(c => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)} (${c.count || 0})</option>`).join('');
      categoryFilter.value = currentSelected || 'all';
    }

    // Update Category Stat
    if (statCategoriesCount) {
      statCategoriesCount.textContent = allCategories.length;
    }

    renderCategoryModalList();
  } catch (err) {
    console.error('Error loading albums:', err);
  }
}

async function fetchProducts() {
  const searchVal = searchInput ? searchInput.value.trim() : '';
  const catVal = categoryFilter ? categoryFilter.value : 'all';
  const sortVal = sortFilter ? sortFilter.value : 'newest';

  const params = new URLSearchParams();
  if (searchVal) params.set('search', searchVal);
  if (catVal && catVal !== 'all') params.set('category', catVal);
  if (sortVal) params.set('sort', sortVal);

  if (productsTableBody) {
    productsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-loading">Loading photo collection...</td>
      </tr>
    `;
  }

  try {
    const res = await apiRequest(`/api/products?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch photos');
    allProducts = await res.json();
    renderProductsTable(allProducts);
    updateDashboardStats(allProducts);
  } catch (err) {
    console.error('Error loading photos:', err);
    if (productsTableBody) {
      productsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading" style="color: #be123c;">
            Failed to load photos. ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }
}

function updateDashboardStats(prods) {
  if (statProductsCount) statProductsCount.textContent = prods.length;

  const featured = prods.filter(p => p.featured).length;
  if (statFeaturedCount) statFeaturedCount.textContent = featured;

  const uniqueLocations = new Set(prods.map(p => p.location).filter(Boolean));
  if (statLocationsCount) {
    statLocationsCount.textContent = Math.max(uniqueLocations.size, 1);
  }
}

// ================= TABLE RENDERING =================
function renderProductsTable(prods) {
  if (!productsTableBody) return;

  if (prods.length === 0) {
    productsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-loading">
          No photos found. Click <strong>"Upload / Add Photo"</strong> to add memorable shots!
        </td>
      </tr>
    `;
    return;
  }

  productsTableBody.innerHTML = prods.map(prod => {
    const imgSrc = prod.image || (prod.images && prod.images[0] ? prod.images[0].src : '/assets/portrait.jpg');
    const isFeatured = Boolean(prod.featured);
    const isPublished = prod.published !== false;
    const dateStr = prod.date || 'October 9, 2026';
    const locationStr = prod.location || 'Birthday Shoot';

    return `
      <tr data-id="${prod.id}">
        <td>
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(prod.name)}" class="table-thumb" onerror="this.onerror=null; this.src='/assets/portrait.jpg';">
        </td>
        <td>
          <div class="product-cell-details">
            <span class="product-cell-name">${escapeHtml(prod.name)}</span>
            ${prod.shortDescription ? `<span class="product-cell-desc">${escapeHtml(prod.shortDescription)}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="badge-category">${escapeHtml(prod.category || 'Portraits')}</span>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 0.15rem;">
            <span style="font-weight: 500; font-size: 0.85rem;">${escapeHtml(dateStr)}</span>
            <span style="font-size: 0.775rem; color: var(--ink-muted);">${escapeHtml(locationStr)}</span>
          </div>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <span class="status-badge ${isPublished ? 'in-stock' : 'out-of-stock'}">
              ● ${isPublished ? 'Published' : 'Archived'}
            </span>
            ${isFeatured ? '<span class="status-badge on-sale">★ Featured Cover</span>' : ''}
          </div>
        </td>
        <td style="text-align: right;">
          <div class="row-actions">
            <button class="action-btn-icon edit-prod-btn" data-id="${prod.id}" title="Edit Photo">
              ✏️
            </button>
            <button class="action-btn-icon delete-btn delete-prod-btn" data-id="${prod.id}" title="Delete Photo">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach row event listeners
  productsTableBody.querySelectorAll('.edit-prod-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      openEditProductModal(id);
    });
  });

  productsTableBody.querySelectorAll('.delete-prod-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      handleDeleteProduct(id);
    });
  });
}

// ================= ADD / EDIT PHOTO MODAL =================
function openAddProductModal() {
  productForm.reset();
  productEditId.value = '';
  productModalTitle.textContent = 'Upload Birthday Photo';
  imagePreviewImg.src = '/assets/portrait.jpg';
  prodImageUrlInput.value = '/assets/portrait.jpg';
  prodDateInput.value = 'October 9, 2026';
  prodLocationInput.value = 'Rosewood Botanical Gardens';
  prodPublishedCheckbox.checked = true;
  prodFeaturedCheckbox.checked = false;

  productModal.classList.add('open');
  productModal.setAttribute('aria-hidden', 'false');
  prodNameInput.focus();
}

function openEditProductModal(id) {
  const prod = allProducts.find(p => p.id === id);
  if (!prod) return;

  productForm.reset();
  productEditId.value = prod.id;
  productModalTitle.textContent = 'Edit Birthday Photo';

  prodNameInput.value = prod.name || '';
  prodCategoryInput.value = prod.category || 'Portraits';
  prodDateInput.value = prod.date || 'October 9, 2026';
  prodLocationInput.value = prod.location || '';
  prodPublishedCheckbox.checked = prod.published !== false;
  prodFeaturedCheckbox.checked = Boolean(prod.featured);
  prodShortDescInput.value = prod.shortDescription || '';
  prodDescInput.value = prod.description || '';

  const imgSrc = prod.image || (prod.images && prod.images[0] ? prod.images[0].src : '/assets/portrait.jpg');
  prodImageUrlInput.value = imgSrc;
  imagePreviewImg.src = imgSrc;

  productModal.classList.add('open');
  productModal.setAttribute('aria-hidden', 'false');
  prodNameInput.focus();
}

function closeProductModal() {
  productModal.classList.remove('open');
  productModal.setAttribute('aria-hidden', 'true');
}

function addAttributeRow(name = '', value = '') {
  if (!attributesList) return;
  const row = document.createElement('div');
  row.className = 'attr-row';
  row.innerHTML = `
    <input type="text" class="form-input attr-key" placeholder="Field" value="${escapeHtml(name)}">
    <input type="text" class="form-input attr-val" placeholder="Value" value="${escapeHtml(value)}">
    <button type="button" class="attr-delete-btn" title="Remove detail row">✕</button>
  `;

  row.querySelector('.attr-delete-btn').addEventListener('click', () => {
    row.remove();
  });

  attributesList.appendChild(row);
}

async function handleProductFormSubmit(e) {
  e.preventDefault();

  const id = productEditId.value ? parseInt(productEditId.value, 10) : null;
  const isEditing = Boolean(id);
  const existingProd = isEditing ? allProducts.find(p => p.id === id) : null;
  const attributes = existingProd && Array.isArray(existingProd.attributes) ? existingProd.attributes : [];

  const payload = {
    name: prodNameInput.value.trim(),
    category: prodCategoryInput.value.trim() || 'Portraits',
    date: prodDateInput.value.trim() || 'October 9, 2026',
    location: prodLocationInput.value.trim() || 'Birthday Shoot',
    image: prodImageUrlInput.value.trim() || 'assets/portrait.jpg',
    shortDescription: prodShortDescInput.value.trim(),
    description: prodDescInput.value.trim(),
    featured: prodFeaturedCheckbox.checked,
    published: prodPublishedCheckbox.checked,
    attributes
  };

  const saveBtn = document.getElementById('save-product-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>Saving Photo...</span>';
  }

  try {
    const endpoint = isEditing ? `/api/products/${id}` : '/api/products';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await apiRequest(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(isEditing ? 'Photo updated successfully!' : 'New photo added to archive!');
      closeProductModal();
      await loadDashboardData();

      // Persist permanently to localStorage and broadcast to open tabs
      try {
        localStorage.setItem('birthday_products_cache', JSON.stringify(allProducts));
        localStorage.setItem('birthday_products_updated_at', new Date().toISOString());
        window.dispatchEvent(new Event('storage'));
      } catch (_) {}

      // Re-hydrate server store so cold lambdas retain latest photos
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: allProducts })
      }).catch(() => {});
    } else {
      alert(`Error saving photo: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Request error: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>Save Photo to Archive</span>';
    }
  }
}

async function handleDeleteProduct(id) {
  const prod = allProducts.find(p => p.id === id);
  const name = prod ? prod.name : `Photo #${id}`;

  if (!confirm(`Are you sure you want to remove "${name}" from the birthday archive?\nThis action cannot be undone.`)) {
    return;
  }

  try {
    const res = await apiRequest(`/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Removed "${name}".`);
      await loadDashboardData();

      try {
        localStorage.setItem('birthday_products_cache', JSON.stringify(allProducts));
        localStorage.setItem('birthday_products_updated_at', new Date().toISOString());
        window.dispatchEvent(new Event('storage'));
      } catch (_) {}

      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: allProducts })
      }).catch(() => {});
    } else {
      alert(`Failed to delete: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Delete error: ${err.message}`);
  }
}

// ================= IMAGE UPLOADER =================
function setupImageUploader() {
  if (prodImageUrlInput && imagePreviewImg) {
    prodImageUrlInput.addEventListener('input', () => {
      const url = prodImageUrlInput.value.trim();
      imagePreviewImg.src = url || '/assets/portrait.jpg';
    });
  }

  if (adminDropZone && prodFileInput) {
    // Click anywhere on dropzone box opens file picker
    adminDropZone.addEventListener('click', (e) => {
      if (e.target !== prodFileInput) {
        prodFileInput.click();
      }
    });

    adminDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      adminDropZone.classList.add('dragover');
    });

    adminDropZone.addEventListener('dragleave', () => {
      adminDropZone.classList.remove('dragover');
    });

    adminDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      adminDropZone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadImageFile(e.dataTransfer.files[0]);
      }
    });

    prodFileInput.addEventListener('change', () => {
      if (prodFileInput.files && prodFileInput.files[0]) {
        uploadImageFile(prodFileInput.files[0]);
      }
    });
  }
}

// Automatically compress high-res camera photos to web-optimized JPEG (~150-250KB)
async function compressImageFile(file, maxDimension = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File is not an image'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file (PNG, JPG, WEBP).');
    return;
  }

  showToast(`Optimizing & loading ${file.name}...`);
  try {
    const dataUrl = await compressImageFile(file);

    // Immediately show the image in preview and populate input
    if (imagePreviewImg) imagePreviewImg.src = dataUrl;
    if (prodImageUrlInput) prodImageUrlInput.value = dataUrl;

    try {
      const res = await apiRequest('/api/upload', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl,
          filename: file.name
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        if (prodImageUrlInput) prodImageUrlInput.value = data.url;
        if (imagePreviewImg) imagePreviewImg.src = data.url;
        showToast('Photo uploaded & ready!');
      } else {
        showToast('Photo optimized & ready to save!');
      }
    } catch (_) {
      showToast('Photo optimized & ready to save!');
    }
  } catch (err) {
    alert(`Error processing photo: ${err.message}`);
  }
}

// ================= ALBUMS / CATEGORIES MODAL =================
function openCategoryModal() {
  categoryModal.classList.add('open');
  categoryModal.setAttribute('aria-hidden', 'false');
  renderCategoryModalList();
  if (newCategoryNameInput) {
    newCategoryNameInput.value = '';
    newCategoryNameInput.focus();
  }
}

function closeCategoryModal() {
  categoryModal.classList.remove('open');
  categoryModal.setAttribute('aria-hidden', 'true');
}

function renderCategoryModalList() {
  if (!categoryListBody) return;

  if (allCategories.length === 0) {
    categoryListBody.innerHTML = '<div style="padding: 1rem; color: #916f7c; text-align: center;">No photo albums found.</div>';
    return;
  }

  categoryListBody.innerHTML = allCategories.map(cat => {
    return `
      <div class="category-item-row">
        <div class="cat-item-info">
          <strong>${escapeHtml(cat.name)}</strong>
          <span class="cat-badge-count">${cat.count || 0} photos</span>
        </div>
        <button class="action-btn-icon delete-btn delete-cat-btn" data-id="${cat.id || cat.slug}" title="Delete Album">
          🗑️
        </button>
      </div>
    `;
  }).join('');

  categoryListBody.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      handleDeleteCategory(id);
    });
  });
}

async function handleAddCategory(e) {
  e.preventDefault();
  const name = newCategoryNameInput.value.trim();
  if (!name) return;

  try {
    const res = await apiRequest('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Added album "${name}".`);
      newCategoryNameInput.value = '';
      await fetchCategories();
    } else {
      alert(`Error: ${data.error || 'Could not add album'}`);
    }
  } catch (err) {
    alert(`Request error: ${err.message}`);
  }
}

async function handleDeleteCategory(id) {
  if (!confirm(`Delete album "${id}"? Photos in this album will remain intact.`)) {
    return;
  }

  try {
    const res = await apiRequest(`/api/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Album deleted.');
      await fetchCategories();
      await fetchProducts();
    } else {
      alert(`Delete error: ${data.error || 'Failed'}`);
    }
  } catch (err) {
    alert(`Delete error: ${err.message}`);
  }
}

// ================= HERO SETTINGS (MAIN IMAGE & PLAQUE) =================
async function fetchHeroSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      currentHeroSettings = await res.json();
      populateHeroSettingsForm();
    }
  } catch (err) {
    console.warn('Could not load hero settings:', err);
  }
}

function populateHeroSettingsForm() {
  if (heroImageUrlInput) heroImageUrlInput.value = currentHeroSettings.heroImage || 'assets/portrait.jpg';
  if (heroPreviewImg) heroPreviewImg.src = currentHeroSettings.heroImage || 'assets/portrait.jpg';
  if (heroChapterInput) heroChapterInput.value = currentHeroSettings.heroChapter || 'Chapter 21';
  if (heroSubtitleInput) heroSubtitleInput.value = currentHeroSettings.heroSubtitle || 'Milestone Portrait';
  if (heroNameInput) heroNameInput.value = currentHeroSettings.heroName || 'RAVEESHA';
  if (heroDateInput) heroDateInput.value = currentHeroSettings.heroDate || 'OCTOBER 2026';
}

function openHeroSettingsModal() {
  populateHeroSettingsForm();
  if (heroSettingsModal) {
    heroSettingsModal.classList.add('open');
    heroSettingsModal.setAttribute('aria-hidden', 'false');
  }
}

function closeHeroSettingsModal() {
  if (heroSettingsModal) {
    heroSettingsModal.classList.remove('open');
    heroSettingsModal.setAttribute('aria-hidden', 'true');
  }
}

function setupHeroImageUploader() {
  if (!heroDropZone || !heroFileInput) return;

  // Click browse
  heroDropZone.addEventListener('click', (e) => {
    if (e.target !== heroFileInput) {
      heroFileInput.click();
    }
  });

  if (heroBrowseLink) {
    heroBrowseLink.addEventListener('click', (e) => {
      e.stopPropagation();
      heroFileInput.click();
    });
  }

  // File chosen
  heroFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadHeroImageFile(file);
  });

  // Drag and drop
  ['dragenter', 'dragover'].forEach(eventName => {
    heroDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      heroDropZone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    heroDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      heroDropZone.classList.remove('drag-active');
    });
  });

  heroDropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadHeroImageFile(file);
  });
}

async function uploadHeroImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file (PNG, JPG, WEBP).');
    return;
  }

  showToast(`Optimizing & loading ${file.name}...`);
  try {
    const dataUrl = await compressImageFile(file);
    if (heroPreviewImg) heroPreviewImg.src = dataUrl;
    if (heroImageUrlInput) heroImageUrlInput.value = dataUrl;

    try {
      const res = await apiRequest('/api/upload', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl,
          filename: file.name
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        if (heroImageUrlInput) heroImageUrlInput.value = data.url;
        if (heroPreviewImg) heroPreviewImg.src = data.url;
        showToast('Photo uploaded for main image!');
      } else {
        showToast('Photo optimized and ready to save!');
      }
    } catch (_) {
      showToast('Photo optimized and ready to save!');
    }
  } catch (err) {
    alert(`Error processing photo: ${err.message}`);
  }
}

async function handleHeroSettingsSubmit(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('save-hero-settings-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>Saving...</span>';
  }

  try {
    const payload = {
      heroImage: heroImageUrlInput ? heroImageUrlInput.value.trim() : '',
      heroChapter: heroChapterInput ? heroChapterInput.value.trim() : '',
      heroSubtitle: heroSubtitleInput ? heroSubtitleInput.value.trim() : '',
      heroName: heroNameInput ? heroNameInput.value.trim() : '',
      heroDate: heroDateInput ? heroDateInput.value.trim() : '',
      updatedAt: new Date().toISOString()
    };

    const res = await apiRequest('/api/settings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      currentHeroSettings = data.settings;

      // Save to localStorage immediately so it never reverts
      try {
        localStorage.setItem('birthday_settings_cache', JSON.stringify(data.settings));
        localStorage.setItem('birthday_settings_updated_at', data.settings.updatedAt || new Date().toISOString());
        window.dispatchEvent(new Event('storage'));
      } catch (_) {}

      // Re-hydrate server via sync endpoint
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: data.settings })
      }).catch(() => {});

      showToast('Main hero image updated permanently!');
      closeHeroSettingsModal();
    } else {
      alert(`Error: ${data.error || 'Failed to update settings'}`);
    }
  } catch (err) {
    alert(`Error updating settings: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>Save Main Image</span>';
    }
  }
}

// Utility: HTML Escaper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
