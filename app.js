/**
 * The Birthday Archive - Editorial Monograph & Photo Gallery
 * Living photo gallery for birthday photoshoot moments.
 * Zero Pricing - Dedicated exclusively to photography, memories & milestones.
 */

import { defaultProducts, defaultCategories, defaultSettings } from './default-data.js';

// Backend API Endpoints
const PRODUCTS_API = '/api/products';
const CATEGORIES_API = '/api/categories';
const SETTINGS_API = '/api/settings';

// SVG Icons
const ICONS = {
  heartOutline: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartFilled: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  zoom: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  pin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  calendar: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
};

// Application State
let products = [];
let categories = [];
let currentCategory = 'all';
let searchQuery = '';
let currentSort = 'newest';
let currentLayout = 'grid';
let bookmarkedIds = new Set(JSON.parse(localStorage.getItem('birthday_favorites') || '[]'));

// Lightbox State
let currentLightboxIndex = -1;
let filteredProducts = [];

// Settings State
let siteSettings = {
  ...defaultSettings
};

function applyHeroSettings(settings) {
  if (!settings) return;
  siteSettings = { ...siteSettings, ...settings };

  const heroImg = document.getElementById('profile-avatar-img');
  if (heroImg && settings.heroImage) {
    heroImg.src = settings.heroImage;
  }

  const chapterEl = document.getElementById('hero-plaque-chapter');
  if (chapterEl && settings.heroChapter) {
    chapterEl.textContent = settings.heroChapter;
  }

  const subtitleEl = document.getElementById('hero-plaque-subtitle');
  if (subtitleEl && settings.heroSubtitle) {
    subtitleEl.textContent = settings.heroSubtitle;
  }

  const nameEl = document.getElementById('hero-plaque-name');
  if (nameEl && settings.heroName) {
    nameEl.textContent = settings.heroName;
  }

  const dateEl = document.getElementById('hero-plaque-date');
  if (dateEl && settings.heroDate) {
    dateEl.textContent = settings.heroDate;
  }

  // Story Greeting & Polaroid Photo
  const storyImg = document.getElementById('story-polaroid-img');
  if (storyImg) {
    const targetStoryImg = settings.storyImage || settings.heroImage || 'assets/portrait.jpg';
    if (targetStoryImg) {
      storyImg.src = targetStoryImg;
    }
  }

  const storyHeading = document.getElementById('story-heading');
  if (storyHeading && settings.storyHeading) {
    storyHeading.textContent = settings.storyHeading;
  }

  const storyText = document.getElementById('story-body-text');
  if (storyText && settings.storyText) {
    storyText.textContent = settings.storyText;
  }

  const storyNote = document.getElementById('story-handwritten-note-text');
  if (storyNote && settings.storyNote) {
    storyNote.textContent = settings.storyNote;
  }
}

let lastSettingsText = '';
async function fetchSettings() {
  try {
    const res = await fetch(SETTINGS_API, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      if (text === lastSettingsText) return;
      lastSettingsText = text;
      const data = JSON.parse(text);
      applyHeroSettings(data);
      try {
        localStorage.setItem('birthday_settings_cache', JSON.stringify(data));
        localStorage.setItem('birthday_settings_updated_at', data.updatedAt || new Date().toISOString());
      } catch (_) {}
    } else {
      const cached = localStorage.getItem('birthday_settings_cache');
      if (cached) applyHeroSettings(JSON.parse(cached));
    }
  } catch (err) {
    console.warn('Could not load dynamic settings:', err.message);
    try {
      const cached = localStorage.getItem('birthday_settings_cache');
      if (cached) applyHeroSettings(JSON.parse(cached));
    } catch (_) {}
  }
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  // Apply default or cached settings immediately to prevent flash or old photos
  let initialSettings = { ...siteSettings };
  try {
    const cachedSettings = localStorage.getItem('birthday_settings_cache');
    if (cachedSettings) {
      initialSettings = { ...initialSettings, ...JSON.parse(cachedSettings) };
    }
  } catch (_) {}
  applyHeroSettings(initialSettings);

  // Initialize products from cache or bundled defaults
  try {
    const cachedProds = localStorage.getItem('birthday_products_cache');
    if (cachedProds) {
      const parsedProds = JSON.parse(cachedProds);
      if (Array.isArray(parsedProds) && parsedProds.length > 0) {
        products = parsedProds;
      }
    }
  } catch (_) {}

  if (!products || products.length === 0) {
    products = mapRawProducts(defaultProducts);
  }
  renderedProductsSnapshot = JSON.stringify(products);
  if (!categories || categories.length === 0) {
    categories = [...defaultCategories];
  }

  renderCategoryTabs();
  renderGallery();
  renderHighlightReel();
  updateStats();

  setupEventListeners();
  startCountdownTimer();
  initPetals();
  loadBackendData();
});

// Listen for cross-tab updates from Admin Studio in real time (Storage Event + BroadcastChannel)
let syncChannel = null;
try {
  syncChannel = new BroadcastChannel('birthday_archive_channel');
  syncChannel.onmessage = (event) => {
    if (event.data?.type === 'SETTINGS_UPDATED' && event.data.settings) {
      applyHeroSettings(event.data.settings);
    } else if (event.data?.type === 'PRODUCTS_UPDATED' && Array.isArray(event.data.products)) {
      products = mapRawProducts(event.data.products);
      renderCategoryTabs();
      renderGallery();
      renderHighlightReel();
      updateStats();
    }
  };
} catch (_) {}

window.addEventListener('storage', (e) => {
  if (e.key === 'birthday_settings_cache' && e.newValue) {
    try { applyHeroSettings(JSON.parse(e.newValue)); } catch (_) {}
  }
  if (e.key === 'birthday_products_cache' && e.newValue) {
    try {
      products = JSON.parse(e.newValue);
      renderGallery();
      renderHighlightReel();
      updateStats();
    } catch (_) {}
  }
});

// Load photo collection and albums from Backend
function mapRawProducts(rawProducts) {
  return rawProducts.map(p => {
    // Title and album are optional in Studio Admin. A blank album means the photo shows only
    // under "All", so it must not fall back to an album (or keep an old album key).
    const legacyAlbum = Array.isArray(p.categories) && p.categories[0] ? p.categories[0] : null;
    const categoryName = typeof p.category === 'string' ? p.category.trim() : (legacyAlbum ? legacyAlbum.name : '');
    const categorySlug = !categoryName ? '' :
      p.categorySlug || (legacyAlbum ? legacyAlbum.slug : categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

    let imageList = [];
    if (Array.isArray(p.images) && p.images.length > 0) {
      imageList = p.images;
    } else if (p.image) {
      imageList = [{ src: p.image, alt: p.name }];
    } else {
      imageList = [{ src: 'assets/portrait.jpg', alt: p.name }];
    }

    return {
      id: p.id,
      name: typeof p.name === 'string' ? p.name.trim() : '',
      slug: p.slug || (p.name || 'moment').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: categoryName,
      categorySlug: categorySlug,
      categories: categoryName ? [{ name: categoryName, slug: categorySlug }] : [],
      date: p.date || 'October 9, 2026',
      location: p.location || 'Rosewood Botanical Gardens',
      image: imageList[0].src,
      images: imageList,
      shortDescription: stripHtml(p.shortDescription || p.short_description || ''),
      description: stripHtml(p.description || ''),
      featured: Boolean(p.featured),
      published: p.published !== false,
      attributes: Array.isArray(p.attributes) ? p.attributes : [],
      createdAt: p.createdAt || ''
    };
  });
}

// Fallback data if API is unreachable
const FALLBACK_CATEGORIES = defaultCategories;
const FALLBACK_PRODUCTS = defaultProducts;

// Load photo collection and albums from Backend
async function loadBackendData() {
  setConnectionStatus('loading', 'Connecting to birthday archive...');
  const syncBtn = document.getElementById('sync-backend-btn');
  if (syncBtn) syncBtn.classList.add('syncing');

  try {
    // Parallel fetch: retrieve categories, photos, and cover settings concurrently
    await Promise.all([
      fetchCategories(),
      fetchProducts(),
      fetchSettings()
    ]);

    setConnectionStatus('online', `Archive Live • ${products.length} Moments`);
    showToast(`Loaded ${products.length} birthday moments from archive!`);

    const syncTimeEl = document.getElementById('sync-time-text');
    if (syncTimeEl) {
      syncTimeEl.innerText = `Synced at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (error) {
    console.warn('Backend API connection note:', error.message);
    
    // Check localStorage cache first if network is unavailable
    try {
      const cachedProds = localStorage.getItem('birthday_products_cache');
      const cachedCats = localStorage.getItem('birthday_categories_cache');
      if (cachedProds && cachedCats) {
        products = JSON.parse(cachedProds);
        categories = JSON.parse(cachedCats);
        renderCategoryTabs();
        renderGallery();
        renderHighlightReel();
        updateStats();
        setConnectionStatus('online', `Archive Live • ${products.length} Moments`);
        return;
      }
    } catch (_) {}

    // Fallback to embedded moments so visitors ALWAYS see the gallery
    categories = [...FALLBACK_CATEGORIES];
    renderCategoryTabs();
    products = mapRawProducts(FALLBACK_PRODUCTS);
    renderGallery();
    renderHighlightReel();
    updateStats();
    setConnectionStatus('online', `Archive Live • ${products.length} Moments`);
  } finally {
    if (syncBtn) syncBtn.classList.remove('syncing');
  }
}

// Keep the live site in step with Admin Studio changes made on any device
const LIVE_REFRESH_MS = 20000;
async function refreshLiveData() {
  if (document.hidden) return;
  try {
    await Promise.all([fetchCategories(), fetchProducts(), fetchSettings()]);
  } catch (_) {}
}
setInterval(refreshLiveData, LIVE_REFRESH_MS);
document.addEventListener('visibilitychange', refreshLiveData);

// Fetch photo albums
async function fetchCategories() {
  const response = await fetch(CATEGORIES_API, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching albums`);
  const rawCategories = await response.json();
  categories = rawCategories.filter(c => c.count > 0 || c.id);
  renderCategoryTabs();
}

// Fetch birthday photos directly from live backend (skips re-render when nothing changed)
let lastProductsText = '';
let renderedProductsSnapshot = '';
async function fetchProducts() {
  const response = await fetch(PRODUCTS_API, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching photos`);
  const text = await response.text();
  if (text === lastProductsText) return;
  lastProductsText = text;
  const rawProducts = JSON.parse(text);

  if (Array.isArray(rawProducts) && rawProducts.length > 0) {
    const mapped = mapRawProducts(rawProducts);
    // The page already shows these exact photos (from cache or bundled defaults): skip the
    // full gallery + carousel rebuild and the large localStorage write.
    const snapshot = JSON.stringify(mapped);
    if (snapshot === renderedProductsSnapshot) return;
    renderedProductsSnapshot = snapshot;
    products = mapped;
    renderCategoryTabs();
    renderGallery();
    renderHighlightReel();
    updateStats();

    // Cache to localStorage
    try {
      localStorage.setItem('birthday_products_cache', JSON.stringify(products));
      localStorage.setItem('birthday_products_updated_at', new Date().toISOString());
    } catch (_) {}
  }
}

// ================= UI RENDERING =================
const isInCategory = (p, slug) => p.categorySlug === slug || p.category === slug;
let renderedTabsSignature = '';

// Album filter rail. Counts come from the photos visitors can actually see, so each badge
// matches what the grid shows. The live refresh calls this every 20s; when nothing changed
// the buttons are kept, so keyboard focus and the indicator stay put.
function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  const visible = products.filter(p => p.published !== false);
  const tabs = [{ slug: 'all', name: 'All', count: visible.length }].concat(
    categories.map(cat => ({
      slug: cat.slug,
      name: cat.name,
      count: visible.filter(p => isInCategory(p, cat.slug)).length
    }))
  );

  // An album that disappeared from the archive falls back to "All"
  if (currentCategory !== 'bookmarks' && !tabs.some(tab => tab.slug === currentCategory)) {
    currentCategory = 'all';
    renderGallery();
  }

  const signature = JSON.stringify(tabs);
  if (signature === renderedTabsSignature && container.querySelector('.cat-tab')) {
    setActiveCategoryTab({ instant: true });
    return;
  }
  renderedTabsSignature = signature;

  // A rebuild (album added, counts changed) must not drop a keyboard user's place
  const focusedSlug = container.contains(document.activeElement) ? document.activeElement.dataset.category : null;

  container.innerHTML = '<span class="cat-tab-indicator" aria-hidden="true"></span>';
  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-tab';
    btn.dataset.category = tab.slug;
    btn.innerHTML = `<span class="cat-tab-label">${escapeHtml(tab.name)}</span>` +
      (tab.count === null ? '' : `<span class="cat-count" aria-hidden="true">${tab.count}</span>`);
    if (tab.count !== null) {
      btn.setAttribute('aria-label', `${tab.name}, ${tab.count} ${tab.count === 1 ? 'photo' : 'photos'}`);
    }

    btn.addEventListener('click', () => {
      if (currentCategory === tab.slug) return;
      currentCategory = tab.slug;
      setActiveCategoryTab();
      renderGallery();
      animateGalleryIn();
    });

    container.appendChild(btn);
  });

  setActiveCategoryTab({ instant: true });
  if (focusedSlug) {
    const again = [...container.querySelectorAll('.cat-tab')].find(b => b.dataset.category === focusedSlug);
    if (again) again.focus({ preventScroll: true });
  }
}

function setActiveCategoryTab({ instant = false } = {}) {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  let activeTab = null;
  container.querySelectorAll('.cat-tab').forEach(btn => {
    const isActive = btn.dataset.category === currentCategory;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
    if (isActive) activeTab = btn;
  });

  moveTabIndicator(container, activeTab, instant);
  if (activeTab) revealActiveTab(activeTab, instant);
}

// Slide the peony pill under the active tab. Until it is placed, the active tab paints
// its own fill (see .has-indicator in style.css), so the state never depends on JS.
function moveTabIndicator(container, activeTab, instant) {
  const indicator = container.querySelector('.cat-tab-indicator');
  if (!indicator) return;
  if (!activeTab || !activeTab.offsetWidth) {
    container.classList.remove('has-indicator');
    return;
  }

  const firstPlacement = !container.classList.contains('has-indicator');
  if (instant || firstPlacement) container.classList.add('is-instant');
  indicator.style.width = `${activeTab.offsetWidth}px`;
  indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
  container.classList.add('has-indicator');

  if (instant || firstPlacement) {
    void indicator.offsetWidth;
    requestAnimationFrame(() => container.classList.remove('is-instant'));
  }
}

// Keep the chosen album in view when the rail scrolls sideways (phones, many albums)
function revealActiveTab(tab, instant) {
  const rail = tab.closest('.categories-scroll-wrapper');
  if (!rail || rail.scrollWidth <= rail.clientWidth) return;

  const edge = 44;
  const railBox = rail.getBoundingClientRect();
  const tabBox = tab.getBoundingClientRect();
  let delta = 0;
  if (tabBox.left < railBox.left + edge) delta = tabBox.left - railBox.left - edge;
  else if (tabBox.right > railBox.right - edge) delta = tabBox.right - railBox.right + edge;
  if (!delta) return;

  rail.scrollBy({ left: delta, behavior: instant || prefersReducedMotion() ? 'auto' : 'smooth' });
}

function updateRailFades(rail) {
  const maxScroll = rail.scrollWidth - rail.clientWidth;
  rail.classList.toggle('can-scroll-start', rail.scrollLeft > 2);
  rail.classList.toggle('can-scroll-end', maxScroll - rail.scrollLeft > 2);
}

function setupCategoryRail() {
  const rail = document.getElementById('category-rail');
  const tabs = document.getElementById('category-tabs');
  if (!rail || !tabs) return;

  rail.addEventListener('scroll', () => updateRailFades(rail), { passive: true });

  // Re-measure when fonts land or the layout changes size
  const remeasure = () => {
    updateRailFades(rail);
    moveTabIndicator(tabs, tabs.querySelector('.cat-tab.active'), true);
  };
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(remeasure);
    observer.observe(rail);
    observer.observe(tabs);
  } else {
    window.addEventListener('resize', remeasure);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  remeasure();
}

// Replay the cards' rise after an album or layout switch (not while typing a search)
let galleryEnterTimer = null;
function animateGalleryIn() {
  const grid = document.getElementById('photos-grid');
  if (!grid || prefersReducedMotion()) return;
  grid.classList.remove('is-entering');
  void grid.offsetWidth;
  grid.classList.add('is-entering');
  clearTimeout(galleryEnterTimer);
  galleryEnterTimer = setTimeout(() => grid.classList.remove('is-entering'), 1100);
}

function renderGallery() {
  const container = document.getElementById('photos-grid');
  const emptyState = document.getElementById('empty-state');
  if (!container) return;

  // Filter
  filteredProducts = products.filter(p => {
    if (p.published === false) return false;

    const matchCategory =
      currentCategory === 'all' ? true :
        currentCategory === 'bookmarks' ? bookmarkedIds.has(p.id) :
          p.categorySlug === currentCategory || p.category === currentCategory;

    const matchSearch = searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery) ||
      p.location.toLowerCase().includes(searchQuery) ||
      p.shortDescription.toLowerCase().includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery);

    return matchCategory && matchSearch;
  });

  // Sort
  filteredProducts.sort((a, b) => {
    if (currentSort === 'featured') return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    if (currentSort === 'oldest') return a.id - b.id;
    if (currentSort === 'title') {
      // Untitled photos go after the titled ones
      if (!a.name !== !b.name) return a.name ? -1 : 1;
      return a.name.localeCompare(b.name);
    }
    return b.id - a.id; // newest first
  });

  if (filteredProducts.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = '';

  filteredProducts.forEach((product, index) => {
    const card = createPhotoCard(product, index);
    container.appendChild(card);
  });
}

// Image description for photos saved without a title (the title is optional in Studio Admin)
const UNTITLED_PHOTO_ALT = "Photo from Raveesha's 21st birthday shoot";

// Short lines shown on each card (the same set the scrapbook cards used).
const CARD_QUOTES = [
  'Stepping into 21 with grace, laughter, and an open heart',
  'Candlelit moments, blush peonies, and twenty-one heartfelt wishes',
  'Sun-drenched birthday memories wrapped in golden amber warmth',
  'Barefoot along the shoreline, chasing dreams and stepping into twenty-one',
  'Artisan French garden roses and cherished 21st celebration keepsakes',
  'Ocean breezes, pure birthday smiles, and golden horizon sunsets'
];

// Glass photo card: the photo fills the card and a frosted caption panel floats over its
// lower edge. The frost is a blurred copy of the same photo (painted once), not a live
// backdrop-filter, so scrolling past many cards stays smooth.
function createPhotoCard(product, index) {
  const card = document.createElement('article');
  // The title is optional; an untitled card shows no caption text (phones then hide its caption panel)
  card.className = product.name ? 'photo-card' : 'photo-card photo-card--untitled';
  card.id = `photo-${product.id}`;
  card.style.setProperty('--i', index);

  const isBookmarked = bookmarkedIds.has(product.id);
  const src = escapeHtml(getShowcaseSrc(product.image || 'assets/portrait.jpg'));
  const name = escapeHtml(product.name);
  const alt = escapeHtml(product.name || UNTITLED_PHOTO_ALT);
  const openLabel = product.name ? `View ${name} photo` : 'View this birthday photo';
  const quote = CARD_QUOTES[index % CARD_QUOTES.length] || product.shortDescription || '';
  const favLabel = isBookmarked ? 'Remove from favorites' : 'Add to favorites';

  card.innerHTML = `
    <div class="photo-card-frame">
      <div class="card-media-wrapper" role="button" tabindex="0" aria-label="${openLabel}">
        <img class="photo-card-img" src="${src}" alt="${alt}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='assets/portrait.jpg'">
      </div>
      ${product.category ? `<span class="photo-card-album">${escapeHtml(product.category)}</span>` : ''}
      <button type="button" class="card-fav-btn ${isBookmarked ? 'is-favorite' : ''}" aria-pressed="${isBookmarked}" aria-label="${favLabel}" title="${favLabel}">
        ${isBookmarked ? ICONS.heartFilled : ICONS.heartOutline}
      </button>
      <div class="photo-card-glass">
        <img class="photo-card-frost" src="${src}" alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="this.remove()">
        <div class="photo-card-copy">
          ${product.name ? `<h3 class="photo-card-title">${name}</h3>` : ''}
          ${quote ? `<p class="photo-card-quote">${escapeHtml(quote)}</p>` : ''}
          <p class="photo-card-meta">
            <span class="photo-card-meta-item">${ICONS.calendar}<span>${escapeHtml(product.date)}</span></span>
            <span class="photo-card-meta-item photo-card-place">${ICONS.pin}<span>${escapeHtml(product.location)}</span></span>
          </p>
        </div>
      </div>
    </div>
  `;

  // Favorite toggle
  const favBtn = card.querySelector('.card-fav-btn');
  if (favBtn) {
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBookmark(product.id);
    });
  }

  // Lightbox trigger
  const mediaWrapper = card.querySelector('.card-media-wrapper');
  if (mediaWrapper) {
    mediaWrapper.addEventListener('click', () => {
      openLightbox(index);
    });

    mediaWrapper.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(index);
      }
    });
  }

  return card;
}


function updateStats() {
  const summaryEl = document.getElementById('stat-summary-text');
  if (summaryEl) {
    const totalCount = products.length;
    const albumCount = categories.length;
    summaryEl.textContent = `Displaying ${totalCount} milestone photos across ${albumCount} albums.`;
  }
}

// ================= LIGHTBOX MODAL =================
function setupLightboxEvents() {
  const lbModal = document.getElementById('lightbox-modal');
  const lbCloseBtn = document.getElementById('lb-close-btn');
  const lbBackdrop = document.getElementById('lightbox-backdrop');
  const lbPrevBtn = document.getElementById('lb-prev-btn');
  const lbNextBtn = document.getElementById('lb-next-btn');
  const lbFavBtn = document.getElementById('lb-favorite-btn');
  const lbDrawerFavBtn = document.getElementById('lb-drawer-fav-btn');
  const lbCinemaBtn = document.getElementById('lb-cinema-btn');
  const lbShareBtn = document.getElementById('lb-share-btn');
  const lbImage = document.getElementById('lightbox-image');
  const lbSheetHandle = document.getElementById('lb-sheet-handle');

  if (!lbModal) return;

  const closeLb = () => {
    document.documentElement.classList.remove('lb-open');
    lbModal.classList.remove('open');
    lbModal.classList.remove('cinema-mode');
    lbModal.setAttribute('aria-hidden', 'true');
    if (lbCinemaBtn) lbCinemaBtn.classList.remove('is-active');
  };

  const toggleCinemaMode = () => {
    lbModal.classList.toggle('cinema-mode');
    const isCinema = lbModal.classList.contains('cinema-mode');
    if (lbCinemaBtn) {
      lbCinemaBtn.classList.toggle('is-active', isCinema);
      lbCinemaBtn.setAttribute('title', isCinema ? 'Show Details (I)' : 'Cinema View (I)');
    }
    showToast(isCinema ? 'Cinema Mode: Details hidden' : 'Dossier View: Details restored');
  };

  const toggleCurrentFavorite = () => {
    if (currentLightboxIndex >= 0 && filteredProducts[currentLightboxIndex]) {
      const p = filteredProducts[currentLightboxIndex];
      toggleBookmark(p.id);
      updateLightboxContent();
    }
  };

  const shareCurrentMoment = async () => {
    if (currentLightboxIndex < 0 || !filteredProducts[currentLightboxIndex]) return;
    const p = filteredProducts[currentLightboxIndex];
    const shareUrl = window.location.origin + window.location.pathname + `?moment=${encodeURIComponent(p.id)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: p.name || "Raveesha's 21st Birthday Shoot",
          text: p.name
            ? `Check out "${p.name}" from Raveesha's 21st Birthday Archive!`
            : "Check out this photo from Raveesha's 21st Birthday Archive!",
          url: shareUrl
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Moment link copied to clipboard!');
    } catch {
      showToast('Moment ready to share!');
    }
  };

  if (lbCloseBtn) lbCloseBtn.addEventListener('click', closeLb);
  if (lbBackdrop) lbBackdrop.addEventListener('click', closeLb);
  if (lbPrevBtn) lbPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(-1); });
  if (lbNextBtn) lbNextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(1); });
  if (lbFavBtn) lbFavBtn.addEventListener('click', toggleCurrentFavorite);
  if (lbDrawerFavBtn) lbDrawerFavBtn.addEventListener('click', toggleCurrentFavorite);
  if (lbCinemaBtn) lbCinemaBtn.addEventListener('click', toggleCinemaMode);
  if (lbShareBtn) lbShareBtn.addEventListener('click', shareCurrentMoment);

  // Click image on desktop to toggle cinema full-bleed view
  if (lbImage) {
    lbImage.addEventListener('click', () => {
      if (window.innerWidth > 900) {
        toggleCinemaMode();
      }
    });
  }

  // Mobile sheet handle
  if (lbSheetHandle) {
    lbSheetHandle.addEventListener('click', () => {
      const drawer = document.getElementById('lightbox-info-drawer');
      if (drawer) {
        drawer.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Keyboard navigation & shortcuts
  window.addEventListener('keydown', (e) => {
    if (!lbModal.classList.contains('open')) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
    if (e.key === 'f' || e.key === 'F') toggleCurrentFavorite();
    if (e.key === 'c' || e.key === 'C' || e.key === 'i' || e.key === 'I') toggleCinemaMode();
  });

  // Touch Swipe Gestures for Mobile
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchEndX = touchStartX;
      touchEndY = touchStartY;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchEndX = e.touches[0].clientX;
      touchEndY = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = () => {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    if (absX > 45 && absX > absY) {
      if (diffX < 0) {
        navigateLightbox(1); // Swipe left -> Next
      } else {
        navigateLightbox(-1); // Swipe right -> Prev
      }
    } else if (diffY > 90 && absY > absX) {
      closeLb(); // Swipe down -> Close
    }
  };

  const mediaWrapper = document.getElementById('lightbox-media-wrapper');
  if (mediaWrapper) {
    mediaWrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
    mediaWrapper.addEventListener('touchmove', handleTouchMove, { passive: true });
    mediaWrapper.addEventListener('touchend', handleTouchEnd, { passive: true });
  }
}

function openLightbox(index) {
  if (index < 0 || index >= filteredProducts.length) return;
  currentLightboxIndex = index;
  const lbModal = document.getElementById('lightbox-modal');
  if (lbModal) {
    // Lock the page behind the viewer and start each visit at the top of the viewer
    document.documentElement.classList.add('lb-open');
    lbModal.scrollTop = 0;
    lbModal.classList.add('open');
    lbModal.setAttribute('aria-hidden', 'false');
    updateLightboxContent();
    preloadAdjacentImages();
  }
}
window.openLightbox = openLightbox;

function navigateLightbox(direction) {
  if (filteredProducts.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex + direction + filteredProducts.length) % filteredProducts.length;
  updateLightboxContent();
  preloadAdjacentImages();
}

function preloadAdjacentImages() {
  if (filteredProducts.length <= 1) return;
  const nextIdx = (currentLightboxIndex + 1) % filteredProducts.length;
  const prevIdx = (currentLightboxIndex - 1 + filteredProducts.length) % filteredProducts.length;

  [nextIdx, prevIdx].forEach(idx => {
    const item = filteredProducts[idx];
    if (item && item.image) {
      const img = new Image();
      img.src = item.image;
    }
  });
}

function updateLightboxContent() {
  const product = filteredProducts[currentLightboxIndex];
  if (!product) return;

  const lbImage = document.getElementById('lightbox-image');
  const lbCounter = document.getElementById('lightbox-counter');
  const lbCatBadge = document.getElementById('lb-category-badge');
  const lbDateText = document.getElementById('lb-date-text');
  const lbLocationText = document.getElementById('lb-location-text');
  const lbTitle = document.getElementById('lb-title');
  const lbCaption = document.getElementById('lb-caption');
  const lbFavBtn = document.getElementById('lb-favorite-btn');
  const lbDrawerFavBtn = document.getElementById('lb-drawer-fav-btn');
  const lbDrawerFavText = document.getElementById('lb-drawer-fav-text');
  const lbAttributesContainer = document.getElementById('lb-attributes-container');

  const mainImage = product.image || 'assets/portrait.jpg';
  if (lbImage) {
    lbImage.style.opacity = '0';
    lbImage.style.transform = 'scale(0.97)';
    setTimeout(() => {
      lbImage.src = mainImage;
      lbImage.alt = product.name || UNTITLED_PHOTO_ALT;
      lbImage.style.opacity = '1';
      lbImage.style.transform = 'scale(1)';
    }, 90);
  }

  if (lbCounter) lbCounter.innerText = `Moment ${currentLightboxIndex + 1} of ${filteredProducts.length}`;
  if (lbCatBadge) lbCatBadge.innerText = product.category;
  if (lbDateText) lbDateText.innerText = product.date;
  if (lbLocationText) lbLocationText.innerText = product.location;
  if (lbTitle) lbTitle.innerText = product.name;
  if (lbCaption) lbCaption.innerText = product.description || product.shortDescription || 'A cherished 21st birthday milestone memory.';

  const isBookmarked = bookmarkedIds.has(product.id);
  if (lbFavBtn) {
    if (isBookmarked) {
      lbFavBtn.classList.add('is-favorite');
      lbFavBtn.innerHTML = ICONS.heartFilled;
    } else {
      lbFavBtn.classList.remove('is-favorite');
      lbFavBtn.innerHTML = ICONS.heartOutline;
    }
  }

  if (lbDrawerFavBtn) {
    if (isBookmarked) {
      lbDrawerFavBtn.classList.add('is-favorite');
      const svg = lbDrawerFavBtn.querySelector('svg');
      if (svg) svg.outerHTML = ICONS.heartFilled;
      if (lbDrawerFavText) lbDrawerFavText.innerText = 'Favorited';
    } else {
      lbDrawerFavBtn.classList.remove('is-favorite');
      const svg = lbDrawerFavBtn.querySelector('svg');
      if (svg) svg.outerHTML = ICONS.heartOutline;
      if (lbDrawerFavText) lbDrawerFavText.innerText = 'Favorite';
    }
  }

  // Render technical shot details / attributes
  if (lbAttributesContainer) {
    if (product.attributes && product.attributes.length > 0) {
      lbAttributesContainer.style.display = 'grid';
      lbAttributesContainer.innerHTML = product.attributes.map(attr => {
        const val = attr.terms && attr.terms[0] ? attr.terms[0].name : (attr.value || 'Yes');
        return `
          <div class="attr-box">
            <span class="attr-name">${escapeHtml(attr.name)}</span>
            <span class="attr-val">${escapeHtml(val)}</span>
          </div>
        `;
      }).join('');
    } else {
      lbAttributesContainer.style.display = 'none';
      lbAttributesContainer.innerHTML = '';
    }
  }
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  const syncBtn = document.getElementById('sync-backend-btn');
  if (syncBtn) syncBtn.addEventListener('click', loadBackendData);

  const forceReloadBtn = document.getElementById('force-reload-btn');
  if (forceReloadBtn) forceReloadBtn.addEventListener('click', loadBackendData);

  // Hero Cover Frame Lightbox Trigger
  const heroCoverFrame = document.getElementById('hero-cover-frame');
  if (heroCoverFrame) {
    heroCoverFrame.addEventListener('click', () => {
      openLightbox(0);
    });
    heroCoverFrame.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(0);
      }
    });
  }

  // Hero Real Pink Roses Card Lightbox Trigger
  const heroRosesCard = document.querySelector('.hero-roses-floating-card');
  if (heroRosesCard) {
    heroRosesCard.addEventListener('click', () => {
      const roseIdx = filteredProducts.findIndex(p => p.id === 5 || p.name.includes('Roses'));
      if (roseIdx !== -1) {
        openLightbox(roseIdx);
      } else {
        openLightbox(0);
      }
    });
  }

  // Album rail: edge fades and indicator re-measuring
  setupCategoryRail();

  // Search input
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const applySearch = (value) => {
    searchQuery = value.toLowerCase().trim();
    if (clearSearchBtn) clearSearchBtn.hidden = !searchQuery;
    renderGallery();
  };
  if (searchInput) {
    searchInput.addEventListener('input', (e) => applySearch(e.target.value));
    // Esc clears the field first; a second Esc leaves it
    searchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (searchInput.value) {
        e.preventDefault();
        searchInput.value = '';
        applySearch('');
      } else {
        searchInput.blur();
      }
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      applySearch('');
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

  // View switch (Grid vs Masonry)
  const viewMasonryBtn = document.getElementById('view-masonry-btn');
  const viewGridBtn = document.getElementById('view-grid-btn');
  const photosGrid = document.getElementById('photos-grid');

  if (viewMasonryBtn && viewGridBtn && photosGrid) {
    const setLayout = (layout) => {
      if (currentLayout === layout) return;
      currentLayout = layout;
      const isMasonry = layout === 'masonry';
      viewMasonryBtn.classList.toggle('active', isMasonry);
      viewMasonryBtn.setAttribute('aria-pressed', String(isMasonry));
      viewGridBtn.classList.toggle('active', !isMasonry);
      viewGridBtn.setAttribute('aria-pressed', String(!isMasonry));
      photosGrid.className = isMasonry ? 'photos-grid masonry-mode' : 'photos-grid uniform-grid-mode';
      animateGalleryIn();
    };

    viewMasonryBtn.addEventListener('click', () => setLayout('masonry'));
    viewGridBtn.addEventListener('click', () => setLayout('grid'));
  }


  // Hearted memories quick links (Header and Hero)
  const navBookmarksBtn = document.getElementById('nav-bookmarks-btn');
  const heroHeartedBtn = document.getElementById('hero-hearted-btn');

  function openHeartedMemories() {
    currentCategory = 'bookmarks';
    setActiveCategoryTab();
    renderGallery();
    const gallerySection = document.getElementById('gallery-controls');
    if (gallerySection) {
      gallerySection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (navBookmarksBtn) navBookmarksBtn.addEventListener('click', openHeartedMemories);
  if (heroHeartedBtn) heroHeartedBtn.addEventListener('click', openHeartedMemories);
  setupLightboxEvents();
}

// ================= HIGHLIGHT SHOWCASE: PHOTO REEL =================
// A 3D carousel: the photo in front is sharp and full size, its neighbours step back.
const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const finePointerQuery = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
const prefersReducedMotion = () => Boolean(reducedMotionQuery && reducedMotionQuery.matches);
const hasFinePointer = () => Boolean(finePointerQuery && finePointerQuery.matches);
const wrapMod = (v, m) => ((v % m) + m) % m;

let reelController = null;
const showcaseSrcCache = new Map();

function openLightboxForPhotoId(photoId) {
  let idx = filteredProducts.findIndex(p => p.id === photoId);
  if (idx < 0) {
    currentCategory = 'all';
    renderCategoryTabs();
    renderGallery();
    idx = filteredProducts.findIndex(p => p.id === photoId);
  }
  if (idx >= 0) {
    openLightbox(idx);
  } else if (filteredProducts.length > 0) {
    openLightbox(0);
  }
}

// Base64 photos become one shared blob URL each, so the repeated carousel cards
// don't each carry their own copy of a large data string.
function getShowcaseSrc(src) {
  if (!src || !src.startsWith('data:')) return src;
  const cached = showcaseSrcCache.get(src);
  if (cached) return cached;
  let url = src;
  try {
    const comma = src.indexOf(',');
    const meta = src.slice(5, comma);
    if (comma > 0 && meta.includes(';base64')) {
      const binary = atob(src.slice(comma + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      url = URL.createObjectURL(new Blob([bytes], { type: meta.split(';')[0] || 'image/jpeg' }));
    }
  } catch (_) {
    url = src;
  }
  showcaseSrcCache.set(src, url);
  return url;
}

function getShowcasePhotos() {
  return products
    .filter(p => p && p.published !== false)
    .map(photo => ({
      id: photo.id,
      // Title and album are optional in Studio Admin, so either can be blank
      title: typeof photo.name === 'string' ? photo.name.trim() : '',
      album: typeof photo.category === 'string' ? photo.category.trim() : '',
      desc: typeof photo.shortDescription === 'string' ? photo.shortDescription.trim() : '',
      rawSrc: photo.image || (photo.images && photo.images[0]?.src) || '/assets/portrait.jpg'
    }));
}

function createShowcaseImage(src, className) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.className = className;
  img.decoding = 'async';
  img.draggable = false;
  return img;
}

function renderHighlightReel() {
  if (reelController) reelController.destroy();
  if (storyStripController) storyStripController.destroy();

  const photos = getShowcasePhotos();
  const liveSources = new Set(photos.map(p => p.rawSrc));
  showcaseSrcCache.forEach((url, key) => {
    if (!liveSources.has(key)) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      showcaseSrcCache.delete(key);
    }
  });
  photos.forEach(p => { p.src = getShowcaseSrc(p.rawSrc); });

  renderHeroMoments(photos);
  reelController = createPhotoReel(photos);
  storyStripController = createStoryStrip();
}

// Hero frame's gallery rail: three thumbnails (featured photos first) plus the photo and album
// counts. Reuses the showcase list above, so embedded images come through as cached blob URLs.
function renderHeroMoments(photos) {
  const stack = document.getElementById('hero-moments-stack');
  const countEl = document.getElementById('hero-moments-count');
  const labelEl = document.getElementById('hero-moments-label');
  if (!stack || !countEl || !labelEl) return;

  const featuredIds = new Set(products.filter(p => p && p.featured).map(p => p.id));
  const picks = [...photos]
    .sort((a, b) => featuredIds.has(b.id) - featuredIds.has(a.id))
    .slice(0, 3);
  stack.replaceChildren(...picks.map(photo => createShowcaseImage(photo.src, 'hero-moments-thumb')));

  const albumCount = new Set(
    products
      .filter(p => p && p.published !== false)
      .map(p => p.categorySlug || p.category)
      .filter(Boolean)
  ).size;
  const noun = photos.length === 1 ? 'moment' : 'moments';
  countEl.textContent = String(photos.length);
  labelEl.textContent = albumCount > 1 ? `${noun} · ${albumCount} albums` : `${noun} in the gallery`;
}

// ---------- Her story: stepped photo strip ----------
// The photo in focus is large; the others step down in size the further they are from it
// (CSS reads each photo's data-d). Tapping a smaller photo brings it into focus; tapping the
// photo in focus opens it: the portrait or a photo in the lightbox, an album in the gallery.
// Photo 01 (the admin-set story portrait) lives in index.html; album covers come next, then
// photos (featured first) until the strip holds five, repeating photos only when there are
// fewer than five different ones.
const STORY_STRIP_MAX = 5;
let storyStripController = null;
let storyStripActive = 0;

function getStoryAlbums() {
  const albums = new Map();
  products.forEach(p => {
    if (!p || p.published === false) return;
    const slug = p.categorySlug || p.category;
    if (!slug) return;
    let album = albums.get(slug);
    if (!album) {
      album = { slug, name: p.category || slug, count: 0, cover: null };
      albums.set(slug, album);
    }
    album.count += 1;
    if (!album.cover || (p.featured && !album.cover.featured)) album.cover = p;
  });
  return [...albums.values()].slice(0, 4);
}

function showAlbumInGallery(slug) {
  currentCategory = slug;
  renderCategoryTabs();
  renderGallery();
  const target = document.getElementById('gallery-controls');
  if (target) target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function getStoryStripEntries() {
  const portrait = document.getElementById('story-polaroid-img');
  const portraitSrc = portrait ? portrait.getAttribute('src') : '';
  const entries = [];
  const used = new Set();
  getStoryAlbums().forEach(album => {
    entries.push({ kind: 'album', slug: album.slug, name: album.name, count: album.count, src: album.cover.image, coverId: album.cover.id });
    used.add(album.cover.id);
  });
  const want = STORY_STRIP_MAX - 1;
  const photos = products
    .filter(p => p && p.published !== false && p.image && !used.has(p.id))
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  const toEntry = (p) => ({ kind: 'photo', id: p.id, name: p.name || p.category || 'Birthday moment', src: p.image });

  // Photos fill the rest, featured first: different images before any repeats
  const seenImages = new Set([portraitSrc, ...entries.map(entry => entry.src)]);
  for (const p of photos) {
    if (entries.length >= want) break;
    if (seenImages.has(p.image)) continue;
    seenImages.add(p.image);
    entries.push(toEntry(p));
  }

  // Fewer different photos than slots: the strip still shows five, cycling through the
  // different images (the portrait's included) and never putting the same image side by
  // side unless there is only one
  if (entries.length < want) {
    const pool = [];
    const pooled = new Set();
    photos.forEach(p => {
      if (pooled.has(p.image)) return;
      pooled.add(p.image);
      pool.push(p);
    });
    let prevSrc = entries.length ? entries[entries.length - 1].src : portraitSrc;
    for (let k = 0; pool.length && entries.length < want; k++) {
      let p = pool[k % pool.length];
      if (pool.length > 1 && p.image === prevSrc) p = pool[++k % pool.length];
      entries.push(toEntry(p));
      prevSrc = p.image;
    }
  }
  return entries.slice(0, want);
}

function createStoryStrip() {
  const strip = document.getElementById('story-strip');
  const portraitItem = strip ? strip.querySelector('[data-kind="portrait"]') : null;
  if (!strip || !portraitItem) return null;

  strip.querySelectorAll('[data-added]').forEach(el => el.remove());
  const entries = [{ kind: 'portrait', name: 'The Birthday Girl', el: portraitItem }];
  getStoryStripEntries().forEach(entry => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'story-strip-item';
    item.dataset.added = 'true';
    item.dataset.kind = entry.kind;
    item.appendChild(createShowcaseImage(getShowcaseSrc(entry.src), 'story-strip-img'));
    strip.appendChild(item);
    entries.push({ ...entry, el: item });
  });
  strip.dataset.count = String(entries.length);

  // Phones hide the album tabs, so an album there opens its cover photo instead of filtering
  // the gallery (which would leave no way back to "All")
  const albumTabsShown = () => {
    const bar = document.querySelector('.gallery-filter-bar');
    return Boolean(bar && getComputedStyle(bar).display !== 'none');
  };
  const actionText = (entry) => (entry.kind === 'album' ? (albumTabsShown() ? 'View album' : 'Open photo')
    : entry.kind === 'portrait' ? 'Open portrait' : 'Open photo');

  let active = -1;
  function setActive(index) {
    const next = Math.max(0, Math.min(entries.length - 1, index));
    if (next === active) return;
    active = next;
    storyStripActive = next;
    entries.forEach((entry, i) => {
      const on = i === next;
      entry.el.dataset.d = String(Math.min(Math.abs(i - next), 4));
      entry.el.tabIndex = on ? 0 : -1;
      if (on) entry.el.setAttribute('aria-current', 'true');
      else entry.el.removeAttribute('aria-current');
      entry.el.setAttribute('aria-label', on ? `${actionText(entry)}: ${entry.name}` : `Show ${entry.name}`);
    });
  }

  function openEntry(entry) {
    if (entry.kind === 'album') {
      if (albumTabsShown()) showAlbumInGallery(entry.slug);
      else openLightboxForPhotoId(entry.coverId);
      return;
    }
    if (entry.kind === 'photo') {
      openLightboxForPhotoId(entry.id);
      return;
    }
    // The story portrait: open it in the lightbox when it is one of the archive photos
    const storyImg = document.getElementById('story-polaroid-img');
    const src = storyImg ? storyImg.getAttribute('src') : '';
    const match = products.find(p => p.published !== false && p.image === src);
    if (match) openLightboxForPhotoId(match.id); else openLightbox(0);
  }

  const onClick = (e) => {
    const item = e.target.closest('.story-strip-item');
    if (!item || !strip.contains(item)) return;
    const index = entries.findIndex(entry => entry.el === item);
    if (index < 0) return;
    if (index === active) openEntry(entries[index]);
    else setActive(index);
  };
  // Arrow keys move the focus along the strip (and bring that photo into focus)
  const onKeyDown = (e) => {
    if (!e.target.closest('.story-strip-item')) return;
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (step) next = (active + step + entries.length) % entries.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = entries.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    entries[next].el.focus();
  };

  setActive(Math.min(storyStripActive, entries.length - 1));
  strip.addEventListener('click', onClick);
  strip.addEventListener('keydown', onKeyDown);

  return {
    destroy() {
      strip.removeEventListener('click', onClick);
      strip.removeEventListener('keydown', onKeyDown);
    }
  };
}

// ---------- Photo reel: 3D carousel ----------
// CSS places each card from its data-pos: 0 is the front photo, ±1 and ±2 step back and turn
// in toward it, ±3 are hidden staging spots. Only the cards from -3 to +3 exist, so the loop
// from the last photo back to the first has no seam and any number of photos stays light.
// Autoplay moves on every 2 seconds; it holds while the mouse rests on the front photo,
// while keyboard focus is inside, during a drag, with the lightbox open, off screen, and
// for reduced motion.
const REEL_AUTOPLAY_MS = 2000;
const REEL_MOVE_MS = 950;        // matches --reel-move
const REEL_REACH = 3;
const REEL_SETTLE_MS = 520;      // the front card has all but landed
const REEL_SHINE_GAP_MS = 5600;  // the light streak crosses the front photo now and then
let reelPhotoId = null;          // keeps the same photo in front when the archive refreshes

function createPhotoReel(photos) {
  const section = document.getElementById('photo-reel');
  const region = document.getElementById('reel');
  const stage = document.getElementById('reel-stage');
  const track = document.getElementById('reel-track');
  const status = document.getElementById('reel-status');
  if (!section || !region || !stage || !track) return null;

  track.replaceChildren();
  section.hidden = photos.length === 0;
  if (photos.length === 0) return null;

  const count = photos.length;
  const single = count === 1;
  region.classList.toggle('is-single', single);

  const slides = photos.map((photo, index) => {
    const n = index + 1;
    const what = photo.title || `Photo ${n} of ${count}`;
    return {
      id: photo.id,
      index,
      src: photo.src,
      num: String(n).padStart(2, '0'),
      label: photo.album || photo.title || 'Chapter 21',
      alt: photo.desc || `${what}${photo.album ? ` from the ${photo.album} album` : ''}, Raveesha's 21st birthday shoot`
    };
  });
  const photoAt = (v) => slides[wrapMod(v, count)];
  const lightboxOpen = () => Boolean(document.getElementById('lightbox-modal')?.classList.contains('open'));
  const isKeyboardFocus = (el) => {
    try { return el.matches(':focus-visible'); } catch (_) { return true; }
  };

  let pos = Math.max(0, slides.findIndex(s => s.id === reelPhotoId)); // front card's place in the loop
  const cards = new Map(); // place in the loop -> card
  let visible = false;
  let hovering = false;
  let keyboardInside = false;
  let drag = null;
  let suppressClick = false;
  let autoTimer = 0;
  let settleTimer = 0;
  let lastChange = 0;
  let lastShine = 0;

  function makeCard(v) {
    const slide = photoAt(v);
    const el = document.createElement('div');
    el.className = 'reel-card';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-roledescription', 'slide');
    el.setAttribute('aria-label', `${slide.index + 1} of ${count}`);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reel-card-btn';

    const img = document.createElement('img');
    img.className = 'reel-card-img';
    img.src = slide.src;
    img.alt = slide.alt;
    img.decoding = 'async';
    img.draggable = false;

    const shade = document.createElement('span');
    shade.className = 'reel-card-shade';
    const shine = document.createElement('span');
    shine.className = 'reel-card-shine';
    const meta = document.createElement('span');
    meta.className = 'reel-card-meta';
    meta.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'reel-card-label';
    label.textContent = slide.label;
    const num = document.createElement('span');
    num.className = 'reel-card-num';
    num.textContent = slide.num;
    meta.append(label, num);

    btn.append(img, shade, shine, meta);
    el.appendChild(btn);
    const card = { v, el, btn, slide, leaving: false, removeTimer: 0 };
    btn.addEventListener('click', (e) => onCardClick(e, card));
    return card;
  }

  function place(card, d) {
    card.el.dataset.pos = String(d);
  }

  function setFront(card, front) {
    card.el.classList.toggle('is-active', front);
    if (!front) card.el.classList.remove('is-shining');
    if (front) card.el.removeAttribute('aria-hidden');
    else card.el.setAttribute('aria-hidden', 'true');
    card.btn.tabIndex = front ? 0 : -1;
    card.btn.setAttribute('aria-label', front
      ? `${card.slide.alt}. Open full size`
      : `Bring photo ${card.slide.index + 1} to the front`);
  }

  function layout(prevPos) {
    const lo = pos - REEL_REACH;
    const hi = pos + REEL_REACH;

    // Cards that dropped out of range glide to the hidden spot on their side, then go
    cards.forEach((card) => {
      if (card.leaving || (card.v >= lo && card.v <= hi)) return;
      card.leaving = true;
      place(card, card.v < pos ? -REEL_REACH : REEL_REACH);
      setFront(card, false);
      card.removeTimer = setTimeout(() => {
        card.el.remove();
        if (cards.get(card.v) === card) cards.delete(card.v);
      }, REEL_MOVE_MS + 120);
    });

    // New cards start from the hidden spot on the side they come in from
    let added = false;
    for (let v = lo; v <= hi; v++) {
      let card = cards.get(v);
      if (card && card.leaving) {
        clearTimeout(card.removeTimer);
        card.leaving = false;
      }
      if (!card) {
        card = makeCard(v);
        place(card, Math.max(-REEL_REACH, Math.min(REEL_REACH, v - prevPos)));
        track.appendChild(card.el);
        cards.set(v, card);
        added = true;
      }
    }
    if (added) void track.offsetWidth; // commit the starting spots so the move animates

    for (let v = lo; v <= hi; v++) {
      const card = cards.get(v);
      place(card, v - pos);
      setFront(card, v === pos);
    }
  }

  // --- Moving ---
  function goTo(target, byUser) {
    if (single || target === pos) return;
    const prevPos = pos;
    pos = target;
    reelPhotoId = photoAt(pos).id;
    lastChange = performance.now();
    layout(prevPos);
    if (status) {
      // Autoplay changes stay silent; changes the visitor asked for are announced
      status.setAttribute('aria-live', byUser ? 'polite' : 'off');
      status.textContent = `Photo ${photoAt(pos).index + 1} of ${count}: ${photoAt(pos).label}`;
    }
    clearTimeout(settleTimer);
    settleTimer = setTimeout(maybeShine, REEL_SETTLE_MS);
    schedule();
  }

  const step = (dir, byUser) => goTo(pos + dir, byUser);

  // --- Autoplay: a fresh 2 seconds after every change; a held reel checks back later ---
  function schedule() {
    clearTimeout(autoTimer);
    autoTimer = 0;
    if (single || !visible || document.hidden || prefersReducedMotion()) return;
    autoTimer = setTimeout(() => {
      autoTimer = 0;
      if (hovering || keyboardInside || drag || lightboxOpen()) schedule();
      else step(1, false);
    }, REEL_AUTOPLAY_MS);
  }

  // --- Shine: on a front card that has landed, at most every few seconds ---
  function maybeShine() {
    if (prefersReducedMotion() || !visible || document.hidden) return;
    const now = performance.now();
    if (now - lastShine < REEL_SHINE_GAP_MS || now - lastChange < REEL_SETTLE_MS - 20) return;
    // While autoplay runs, only start right after landing so the streak ends before the next move
    const held = hovering || keyboardInside || drag || lightboxOpen();
    if (autoTimer && !held && now - lastChange > REEL_SETTLE_MS + 200) return;
    const front = cards.get(pos);
    if (!front) return;
    lastShine = now;
    front.el.classList.remove('is-shining');
    void front.el.offsetWidth;
    front.el.classList.add('is-shining');
  }
  const shineTimer = setInterval(maybeShine, 1500);
  const onAnimationEnd = (e) => {
    if (e.animationName === 'reelShine') e.target.closest('.reel-card')?.classList.remove('is-shining');
  };

  // --- Cards: the front one opens full size; any other one comes to the front ---
  function onCardClick(e, card) {
    if (suppressClick) {
      e.preventDefault();
      return;
    }
    if (card.leaving) return;
    if (card.v === pos) openLightboxForPhotoId(card.slide.id);
    else goTo(card.v, true);
  }

  // --- Drag / swipe: one photo per meaningful horizontal swipe; vertical scrolling stays native ---
  const swipeThreshold = () => Math.max(44, (cards.get(pos)?.el.offsetWidth || 300) * 0.14);

  function stopDrag() {
    drag = null;
    stage.classList.remove('is-dragging');
    track.style.removeProperty('--drag');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  const onPointerDown = (e) => {
    if (single || drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, axis: null };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // still a tap
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'x') stage.classList.add('is-dragging');
    }
    if (drag.axis !== 'x') return;
    drag.dx = dx;
    // Follow the pointer with some resistance so the drag feels attached
    const pull = Math.sign(dx) * Math.min(72, Math.abs(dx) * 0.35);
    track.style.setProperty('--drag', `${pull.toFixed(1)}px`);
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { axis, dx } = drag;
    stopDrag();
    if (!axis) return; // a plain tap: the card's click handles it
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
    if (axis === 'x' && e.type === 'pointerup' && Math.abs(dx) >= swipeThreshold()) {
      step(dx < 0 ? 1 : -1, true); // swipe left = next
    } else {
      schedule();
    }
  }

  const onDragStart = (e) => e.preventDefault();

  // --- Hold autoplay while the mouse rests on the front photo or keyboard focus is inside ---
  const onPointerOver = (e) => {
    if (e.pointerType !== 'mouse' || !hasFinePointer()) return;
    const over = Boolean(e.target.closest('.reel-card.is-active'));
    if (over === hovering) return;
    hovering = over;
    if (!over) schedule();
  };
  const onPointerLeave = () => {
    if (!hovering) return;
    hovering = false;
    schedule();
  };
  const onFocusIn = (e) => {
    const keyboard = isKeyboardFocus(e.target);
    if (keyboard === keyboardInside) return;
    keyboardInside = keyboard;
    if (!keyboard) schedule();
  };
  const onFocusOut = (e) => {
    if (region.contains(e.relatedTarget) || !keyboardInside) return;
    keyboardInside = false;
    schedule();
  };

  // --- Keyboard: arrows move the reel when focus is inside it, or when nothing has focus
  //     and the reel is on screen ---
  const onKeyDown = (e) => {
    if (single || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (lightboxOpen()) return;
    const t = e.target;
    const inside = region.contains(t);
    if (!inside && !(visible && (t === document.body || t === document.documentElement))) return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1, true);
    // Focus stays on the front card when that is what was focused
    if (inside && t.classList.contains('reel-card-btn')) cards.get(pos)?.btn.focus({ preventScroll: true });
  };

  const onVisibility = () => schedule();
  const onMotionChange = () => schedule();

  const io = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    const nowVisible = entry.isIntersecting && entry.intersectionRatio >= 0.3;
    if (nowVisible === visible) return;
    visible = nowVisible;
    schedule();
  }, { threshold: [0, 0.3, 0.6] });

  layout(pos);
  if (status) status.textContent = `Photo ${photoAt(pos).index + 1} of ${count}: ${photoAt(pos).label}`;

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerover', onPointerOver);
  stage.addEventListener('pointerleave', onPointerLeave);
  stage.addEventListener('dragstart', onDragStart);
  track.addEventListener('animationend', onAnimationEnd);
  region.addEventListener('focusin', onFocusIn);
  region.addEventListener('focusout', onFocusOut);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);
  if (reducedMotionQuery && reducedMotionQuery.addEventListener) reducedMotionQuery.addEventListener('change', onMotionChange);
  io.observe(region);

  return {
    destroy() {
      clearTimeout(autoTimer);
      clearTimeout(settleTimer);
      clearInterval(shineTimer);
      cards.forEach(card => clearTimeout(card.removeTimer));
      io.disconnect();
      stopDrag();
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointerover', onPointerOver);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.removeEventListener('dragstart', onDragStart);
      track.removeEventListener('animationend', onAnimationEnd);
      region.removeEventListener('focusin', onFocusIn);
      region.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      if (reducedMotionQuery && reducedMotionQuery.removeEventListener) reducedMotionQuery.removeEventListener('change', onMotionChange);
      region.classList.remove('is-single');
      track.replaceChildren();
    }
  };
}

// ================= COUNTDOWN & AMBIENCE =================
function startCountdownTimer() {
  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMinutes = document.getElementById('cd-minutes');
  const cdSeconds = document.getElementById('cd-seconds');
  if (!cdDays || !cdHours || !cdMinutes || !cdSeconds) return;

  // Milestone Celebration Date: October 24, 2026
  const targetDate = new Date('2026-10-24T18:00:00');

  function updateCountdown() {
    const now = new Date();
    let diff = targetDate.getTime() - now.getTime();

    // If target date in the past, loop into next anniversary milestone
    if (diff <= 0) {
      const nextMilestone = new Date(targetDate);
      nextMilestone.setFullYear(now.getFullYear() + (now > nextMilestone ? 1 : 0));
      diff = Math.max(0, nextMilestone.getTime() - now.getTime());
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    cdDays.innerText = String(days).padStart(2, '0');
    cdHours.innerText = String(hours).padStart(2, '0');
    cdMinutes.innerText = String(minutes).padStart(2, '0');
    cdSeconds.innerText = String(seconds).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

function initPetals() {
  const toggleBtn = document.getElementById('petals-toggle-btn');
  const savedState = localStorage.getItem('birthday_petals_disabled');
  if (savedState === 'true') {
    document.body.classList.add('petals-disabled');
    if (toggleBtn) {
      toggleBtn.innerHTML = '<span class="petal-icon">🥀</span><span class="petal-toggle-text">Petals: Off</span>';
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isNowDisabled = document.body.classList.toggle('petals-disabled');
      localStorage.setItem('birthday_petals_disabled', isNowDisabled ? 'true' : 'false');
      if (isNowDisabled) {
        toggleBtn.innerHTML = '<span class="petal-icon">🥀</span><span class="petal-toggle-text">Petals: Off</span>';
        showToast('Falling rose petals paused');
      } else {
        toggleBtn.innerHTML = '<span class="petal-icon">🌸</span><span class="petal-toggle-text">Petals: On</span>';
        showToast('Falling rose petals active');
      }
    });
  }
}

// ================= HELPERS =================
function toggleBookmark(id) {
  if (bookmarkedIds.has(id)) {
    bookmarkedIds.delete(id);
    showToast('Removed from favorites');
  } else {
    bookmarkedIds.add(id);
    showToast('Added to favorites');
  }
  localStorage.setItem('birthday_favorites', JSON.stringify([...bookmarkedIds]));
  renderGallery();
}

function setConnectionStatus(state, message) {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  if (!dot || !label) return;

  dot.className = `status-indicator-dot ${state}`;
  label.innerText = message;
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
      <div class="offline-icon">📷</div>
      <h3>Birthday Archive Offline</h3>
      <p>Could not connect to the internal archive at <strong>/api/products</strong>.</p>
      <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 14px;">
        <button onclick="loadBackendData()" class="btn btn-primary">Retry Connection</button>
        <a href="/admin" class="btn btn-secondary">Open Studio Admin</a>
      </div>
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

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
