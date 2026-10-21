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
  if (!categories || categories.length === 0) {
    categories = [...defaultCategories];
  }

  renderCategoryTabs();
  renderGallery();
  renderHighlightReel();
  updateStats();

  setupEventListeners();
  setupReelStripAutoRotation();
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
    const categoryName = p.category || (p.categories && p.categories[0] ? p.categories[0].name : 'Portraits');
    const categorySlug = p.categorySlug || (p.categories && p.categories[0] ? p.categories[0].slug : categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

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
      name: p.name || 'Untitled Moment',
      slug: p.slug || (p.name || 'moment').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: categoryName,
      categorySlug: categorySlug,
      categories: p.categories || [{ name: categoryName, slug: categorySlug }],
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
async function fetchProducts() {
  const response = await fetch(PRODUCTS_API, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching photos`);
  const text = await response.text();
  if (text === lastProductsText) return;
  lastProductsText = text;
  const rawProducts = JSON.parse(text);

  if (Array.isArray(rawProducts) && rawProducts.length > 0) {
    products = mapRawProducts(rawProducts);
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
function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  container.innerHTML = `
    <button class="cat-tab ${currentCategory === 'all' ? 'active' : ''}" data-category="all" role="tab" aria-selected="${currentCategory === 'all'}">
      All Moments
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

  // Click handler for All Moments
  const allBtn = container.querySelector('.cat-tab[data-category="all"]');
  if (allBtn) {
    allBtn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      allBtn.classList.add('active');
      allBtn.setAttribute('aria-selected', 'true');
      currentCategory = 'all';
      renderGallery();
    });
  }
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
    if (currentSort === 'title') return a.name.localeCompare(b.name);
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

const SCRAPBOOK_TAPES = [
  { text: "chapter 21 ♡", variant: "rose", pinType: "gold", quote: "Stepping into 21 with grace, laughter, and an open heart" },
  { text: "21 sweet wishes", variant: "blush", pinType: "clip", quote: "Candlelit moments, blush peonies, and twenty-one heartfelt wishes" },
  { text: "golden hour glow", variant: "slate", pinType: "gold", quote: "Sun-drenched birthday memories wrapped in golden amber warmth" },
  { text: "twenty-one & free", variant: "cream", pinType: "clip", quote: "Barefoot along the shoreline, chasing dreams and stepping into twenty-one" },
  { text: "roses & keepsakes", variant: "sage", pinType: "heart", quote: "Artisan French garden roses and cherished 21st celebration keepsakes" },
  { text: "birthday joy ♡", variant: "rose", pinType: "gold", quote: "Ocean breezes, pure birthday smiles, and golden horizon sunsets" }
];

function createPhotoCard(product, index) {
  const card = document.createElement('article');
  card.className = `photo-card polaroid-scrapbook-card polaroid-rot-${(index % 6) + 1}`;
  card.id = `photo-${product.id}`;

  const isBookmarked = bookmarkedIds.has(product.id);
  const mainImage = product.image || 'assets/portrait.jpg';
  const tape = SCRAPBOOK_TAPES[index % SCRAPBOOK_TAPES.length];
  const poeticQuote = tape.quote || product.shortDescription || '';

  // Render pin or clip accent
  let pinAccentHtml = '';
  if (tape.pinType === 'gold') {
    pinAccentHtml = '<div class="scrapbook-pin-accent" title="Pinned memory" aria-hidden="true"></div>';
  } else if (tape.pinType === 'clip') {
    pinAccentHtml = '<div class="scrapbook-paperclip-accent" title="Clipped moment" aria-hidden="true"></div>';
  } else if (tape.pinType === 'heart') {
    pinAccentHtml = '<div class="scrapbook-heart-seal" title="Cherished seal" aria-hidden="true">♥</div>';
  }

  card.innerHTML = `
    <!-- Scrapbook Washi Tape Header Strip -->
    <div class="scrapbook-tape tape-${tape.variant}" aria-hidden="true">
      <span class="tape-script-text">${escapeHtml(tape.text)}</span>
    </div>
    ${pinAccentHtml}

    <!-- Polaroid Photo Frame -->
    <div class="card-media-wrapper polaroid-photo-frame" role="button" tabindex="0" aria-label="View ${escapeHtml(product.name)} photo in lightbox">
      <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.src='assets/portrait.jpg'">
      <div class="card-hover-overlay">
        <span class="quick-view-badge">
          ${ICONS.zoom}
          <span>View Moment</span>
        </span>
      </div>
    </div>

    <!-- Polaroid Bottom Paper Section -->
    <div class="polaroid-paper-bottom">
      <div class="polaroid-caption-header">
        <h3 class="polaroid-title">${escapeHtml(product.name)}</h3>
        <button class="card-fav-btn polaroid-fav-btn ${isBookmarked ? 'is-favorite' : ''}" title="${isBookmarked ? 'Remove from favorites' : 'Add to favorites'}" aria-label="Favorite toggle">
          ${isBookmarked ? ICONS.heartFilled : ICONS.heartOutline}
        </button>
      </div>

      <!-- Poetic Typewriter Reflection (from User Reference 2) -->
      ${poeticQuote ? `<p class="polaroid-typewriter-quote">“${escapeHtml(poeticQuote)}”</p>` : ''}

      <div class="polaroid-meta-line">
        <span class="polaroid-meta-chip">${ICONS.calendar} ${escapeHtml(product.date)}</span>
        <span class="meta-dot-sep">•</span>
        <span class="polaroid-meta-chip">${ICONS.pin} ${escapeHtml(product.location)}</span>
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
          title: p.name,
          text: `Check out "${p.name}" from Raveesha's 21st Birthday Archive!`,
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
      lbImage.alt = product.name;
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

  // Search input
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      if (clearSearchBtn) clearSearchBtn.style.display = searchQuery ? 'inline-block' : 'none';
      renderGallery();
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
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

  if (viewMasonryBtn && viewGridBtn && photosGrid) {
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


  // Hearted memories quick links (Header and Hero)
  const navBookmarksBtn = document.getElementById('nav-bookmarks-btn');
  const heroHeartedBtn = document.getElementById('hero-hearted-btn');

  function openHeartedMemories() {
    currentCategory = 'bookmarks';
    document.querySelectorAll('.cat-tab').forEach(b => {
      const isMatch = b.dataset.category === 'bookmarks';
      b.classList.toggle('active', isMatch);
      b.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });
    renderGallery();
    const gallerySection = document.getElementById('gallery-controls');
    if (gallerySection) {
      gallerySection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (navBookmarksBtn) navBookmarksBtn.addEventListener('click', openHeartedMemories);
  if (heroHeartedBtn) heroHeartedBtn.addEventListener('click', openHeartedMemories);

  setupReelStripAutoRotation();
  setupLightboxEvents();
}

// ================= HIGHLIGHT REEL DYNAMIC BACKEND & ROTATABLE SCROLL =================
let reelAnimFrame = null;
let isReelPaused = false;
let touchResumeTimer = null;

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

function renderHighlightReel() {
  const reel = document.getElementById('story-photo-reel-strip') || document.querySelector('.story-photo-reel-strip');
  if (!reel) return;

  const validPhotos = products.filter(p => p.published !== false);
  if (validPhotos.length === 0) return;

  // Repeat sequence so there are always at least 15 items for smooth infinite rotation
  const repeatCount = Math.max(3, Math.ceil(15 / validPhotos.length));
  reel.innerHTML = '';

  for (let r = 0; r < repeatCount; r++) {
    validPhotos.forEach((photo, pIdx) => {
      const globalIndex = products.findIndex(p => p.id === photo.id);
      const item = document.createElement('div');
      item.className = 'reel-item';
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `View ${photo.name || '21st Birthday Milestone'}`);
      item.dataset.photoId = String(photo.id);
      item.dataset.photoIndex = String(globalIndex >= 0 ? globalIndex : pIdx);

      const img = document.createElement('img');
      img.src = photo.image || (photo.images && photo.images[0]?.src) || '/assets/portrait.jpg';
      img.alt = photo.name || '21st Birthday Milestone photo';
      img.className = 'reel-photo';
      img.loading = 'lazy';
      item.appendChild(img);

      reel.appendChild(item);
    });
  }

  setupReelStripAutoRotation(reel);
}

function setupReelStripAutoRotation(targetReel) {
  const reel = targetReel || document.getElementById('story-photo-reel-strip') || document.querySelector('.story-photo-reel-strip');
  if (!reel) return;

  if (reelAnimFrame) {
    cancelAnimationFrame(reelAnimFrame);
    reelAnimFrame = null;
  }
  if (touchResumeTimer) {
    clearTimeout(touchResumeTimer);
    touchResumeTimer = null;
  }

  // Optimized rotation speed with subpixel accumulator for mobile browsers
  const isMobile = window.innerWidth <= 768;
  const speed = isMobile ? 0.95 : 0.75; // Clean, visible auto-rotation on mobile & desktop
  let accumulatedScroll = reel.scrollLeft || 0;
  let isDown = false;
  let isTouchActive = false;
  let hasMoved = false;
  let suppressClick = false;
  let startX = 0;
  let startY = 0;
  let scrollStart = 0;
  let isHorizontalDrag = null; // null = undetermined, true = horizontal, false = vertical

  function pauseRotation() {
    isReelPaused = true;
    if (touchResumeTimer) clearTimeout(touchResumeTimer);
  }

  function resumeRotation(delay = 1200) {
    if (touchResumeTimer) clearTimeout(touchResumeTimer);
    touchResumeTimer = setTimeout(() => {
      isReelPaused = false;
      accumulatedScroll = reel.scrollLeft;
    }, delay);
  }

  // Hover pauses ONLY on desktop mouse devices (never on mobile touch screens)
  reel.onmouseenter = () => {
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      pauseRotation();
    }
  };
  reel.onmouseleave = () => {
    if (!isDown && !isTouchActive) {
      isReelPaused = false;
      accumulatedScroll = reel.scrollLeft;
    }
  };

  // Infinite wrap-around calculation
  function wrapLoop() {
    const totalW = reel.scrollWidth;
    const viewW = reel.clientWidth;
    if (totalW <= viewW || totalW <= 0) return;
    const oneThird = totalW / 3;

    if (reel.scrollLeft >= oneThird * 2) {
      reel.scrollLeft -= oneThird;
      accumulatedScroll = reel.scrollLeft;
    } else if (reel.scrollLeft <= 10) {
      reel.scrollLeft += oneThird;
      accumulatedScroll = reel.scrollLeft;
    }
  }

  // Ensure initial scroll position starts in the middle set (Set B)
  requestAnimationFrame(() => {
    if (reel.scrollWidth > reel.clientWidth && reel.scrollLeft < 10) {
      reel.scrollLeft = Math.round(reel.scrollWidth / 3);
      accumulatedScroll = reel.scrollLeft;
    }
  });

  // Attach wrapLoop on native scroll event
  reel.onscroll = () => {
    if (isDown || isTouchActive) {
      accumulatedScroll = reel.scrollLeft;
    }
    wrapLoop();
  };

  // --- DESKTOP MOUSE DRAG ---
  reel.onmousedown = (e) => {
    if (e.button !== 0) return;
    isDown = true;
    hasMoved = false;
    suppressClick = false;
    pauseRotation();
    reel.classList.add('is-dragging');
    startX = e.pageX;
    scrollStart = reel.scrollLeft;
    accumulatedScroll = reel.scrollLeft;
  };

  const onMouseMove = (e) => {
    if (!isDown) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 5) {
      hasMoved = true;
      suppressClick = true;
    }
    reel.scrollLeft = scrollStart - dx * 1.3;
    accumulatedScroll = reel.scrollLeft;
    wrapLoop();
  };

  const onMouseUp = () => {
    if (!isDown) return;
    isDown = false;
    reel.classList.remove('is-dragging');
    accumulatedScroll = reel.scrollLeft;
    setTimeout(() => {
      suppressClick = false;
      hasMoved = false;
    }, 150);
    resumeRotation(1200);
  };

  window.removeEventListener('mousemove', onMouseMove);
  window.addEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.addEventListener('mouseup', onMouseUp);

  // --- MOBILE TOUCH SWIPE & SCROLL ---
  reel.ontouchstart = (e) => {
    if (e.touches.length !== 1) return;
    isTouchActive = true;
    hasMoved = false;
    suppressClick = false;
    isHorizontalDrag = null;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    scrollStart = reel.scrollLeft;
    accumulatedScroll = reel.scrollLeft;
    pauseRotation();
  };

  reel.ontouchmove = (e) => {
    if (!isTouchActive || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - startX;
    const dy = currentY - startY;

    // Detect direction on first movement beyond 6px
    if (isHorizontalDrag === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        isHorizontalDrag = Math.abs(dx) >= Math.abs(dy);
      }
    }

    // If vertical gesture, do NOT touch reel.scrollLeft and let normal page scrolling happen naturally!
    if (isHorizontalDrag === false) {
      return;
    }

    // If horizontal gesture, scroll the reel smoothly
    if (isHorizontalDrag === true) {
      hasMoved = true;
      suppressClick = true;
      reel.scrollLeft = scrollStart - dx * 1.3;
      accumulatedScroll = reel.scrollLeft;
      wrapLoop();
    }
  };

  const endTouch = () => {
    if (!isTouchActive) return;
    isTouchActive = false;
    isHorizontalDrag = null;
    accumulatedScroll = reel.scrollLeft;
    setTimeout(() => {
      suppressClick = false;
      hasMoved = false;
    }, 250);
    resumeRotation(1200);
  };

  reel.ontouchend = endTouch;
  reel.ontouchcancel = endTouch;

  // --- LIGHTBOX CLICKS ---
  reel.querySelectorAll('.reel-item').forEach(item => {
    item.onclick = (e) => {
      if (suppressClick || hasMoved) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      const photoId = parseInt(item.dataset.photoId, 10);
      const photoIndex = parseInt(item.dataset.photoIndex, 10);
      if (!isNaN(photoId)) {
        openLightboxForPhotoId(photoId);
      } else if (!isNaN(photoIndex) && photoIndex >= 0) {
        openLightbox(photoIndex);
      }
    };

    item.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const photoId = parseInt(item.dataset.photoId, 10);
        const photoIndex = parseInt(item.dataset.photoIndex, 10);
        if (!isNaN(photoId)) {
          openLightboxForPhotoId(photoId);
        } else if (!isNaN(photoIndex) && photoIndex >= 0) {
          openLightbox(photoIndex);
        }
      }
    };
  });

  // --- ARROW BUTTONS ---
  const prevBtn = document.getElementById('reel-nav-prev');
  const nextBtn = document.getElementById('reel-nav-next');
  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.preventDefault();
      pauseRotation();
      const scrollStep = reel.clientWidth > 480 ? 320 : 220;
      reel.scrollBy({ left: -scrollStep, behavior: 'smooth' });
      accumulatedScroll = reel.scrollLeft - scrollStep;
      resumeRotation(2000);
    };
  }
  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.preventDefault();
      pauseRotation();
      const scrollStep = reel.clientWidth > 480 ? 320 : 220;
      reel.scrollBy({ left: scrollStep, behavior: 'smooth' });
      accumulatedScroll = reel.scrollLeft + scrollStep;
      resumeRotation(2000);
    };
  }

  // --- 60FPS CONTINUOUS ROTATION (FLUID MOBILE & DESKTOP) ---
  function step() {
    if (!isReelPaused && !isDown && !isTouchActive) {
      accumulatedScroll += speed;
      reel.scrollLeft = Math.round(accumulatedScroll);
      wrapLoop();
    } else {
      accumulatedScroll = reel.scrollLeft;
    }
    reelAnimFrame = requestAnimationFrame(step);
  }

  reelAnimFrame = requestAnimationFrame(step);
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
