/**
 * The Birthday Archive - Web Application
 * Refined, Editorial Monograph & Photo Keepsake
 */

// Storage Keys (v2 incorporates humanized archival defaults)
const STORAGE_KEY_PHOTOS = 'birthday_archive_photos_v2';
const STORAGE_KEY_PROFILE = 'birthday_archive_profile_v2';

// Humanized, Authentic Sample Photos
const DEFAULT_PHOTOS = [
  {
    id: 'sample-1',
    url: 'assets/portrait.jpg',
    title: 'Studio Portraits in White',
    category: 'Portraits',
    date: '2026-10-24',
    favorite: true,
    caption: 'Quiet studio portraits right before everyone arrived. The afternoon light through the sheer curtains was hitting the room just right.'
  },
  {
    id: 'sample-2',
    url: 'assets/cake.jpg',
    title: 'Strawberry Vanilla Cake',
    category: 'Cake & Candles',
    date: '2026-10-24',
    favorite: true,
    caption: 'Vintage piped cake with fresh strawberries. Took everyone three tries to get the matches to light.'
  },
  {
    id: 'sample-3',
    url: 'assets/golden_hour.jpg',
    title: 'Golden Hour on the Roof',
    category: 'Golden Hour',
    date: '2026-10-24',
    favorite: false,
    caption: 'Catching the last 15 minutes of sunlight over Brooklyn right as the evening breeze picked up.'
  }
];

const DEFAULT_PROFILE = {
  name: "Maya's Portrait Monograph",
  milestone: "Twenty-Fourth Birthday Session",
  quote: "“An afternoon in the city, golden light through linen curtains, vintage cake, and the people who make it all feel like home.”",
  date: "October 24, 2026",
  location: "The Conservatory, Brooklyn",
  photographer: "Shot by Elena Vance",
  avatar: "assets/portrait.jpg"
};

// SVG Icon Helpers
const ICONS = {
  heartOutline: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartFilled: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  delete: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  zoom: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
};

// Application State
let photos = [];
let currentCategory = 'all';
let searchQuery = '';
let currentSort = 'newest';
let currentLayout = 'masonry';
let pendingUploadFiles = [];

// Lightbox state
let currentLightboxIndex = -1;
let filteredPhotos = [];
let slideshowTimer = null;

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupEventListeners();
  renderGallery();
  updateStats();
});

function loadData() {
  try {
    const savedPhotos = localStorage.getItem(STORAGE_KEY_PHOTOS);
    if (savedPhotos) {
      photos = JSON.parse(savedPhotos);
    } else {
      // Check if user had non-sample photos in v1 to migrate
      const oldPhotos = localStorage.getItem('birthday_shoot_photos_v1');
      if (oldPhotos) {
        try {
          const parsedOld = JSON.parse(oldPhotos);
          const customOnly = parsedOld.filter(p => !p.id.startsWith('sample-'));
          if (customOnly.length > 0) {
            photos = [...customOnly, ...DEFAULT_PHOTOS];
          } else {
            photos = [...DEFAULT_PHOTOS];
          }
        } catch (_) {
          photos = [...DEFAULT_PHOTOS];
        }
      } else {
        photos = [...DEFAULT_PHOTOS];
      }
      savePhotos();
    }

    const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      applyProfile(profile);
    } else {
      applyProfile(DEFAULT_PROFILE);
      saveProfile();
    }
  } catch (e) {
    console.error('Error loading data:', e);
    photos = [...DEFAULT_PHOTOS];
  }
}

function savePhotos() {
  try {
    localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(photos));
  } catch (e) {
    console.warn('Storage limit reached:', e);
    showToast('Browser storage quota reached. Consider compressing images before upload.');
  }
}

function saveProfile() {
  const profile = {
    name: document.getElementById('display-name').innerText.trim(),
    milestone: document.getElementById('display-milestone').innerText.trim(),
    quote: document.getElementById('display-quote').innerText.trim(),
    date: document.getElementById('display-date').innerText.trim(),
    location: document.getElementById('display-location').innerText.trim(),
    photographer: document.getElementById('display-photographer').innerText.trim(),
    avatar: document.getElementById('profile-avatar-img').src
  };
  localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
}

function applyProfile(p) {
  if (p.name) document.getElementById('display-name').innerText = p.name;
  if (p.milestone) document.getElementById('display-milestone').innerText = p.milestone;
  if (p.quote) document.getElementById('display-quote').innerText = p.quote;
  if (p.date) document.getElementById('display-date').innerText = p.date;
  if (p.location) document.getElementById('display-location').innerText = p.location;
  if (p.photographer) document.getElementById('display-photographer').innerText = p.photographer;
  if (p.avatar) document.getElementById('profile-avatar-img').src = p.avatar;
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  // Editable profile fields
  const editableIds = ['display-name', 'display-milestone', 'display-quote', 'display-date', 'display-location', 'display-photographer'];
  editableIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('blur', () => {
        saveProfile();
        showToast('Profile information updated');
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          el.blur();
        }
      });
    }
  });

  // Avatar Cover Photo Upload
  const changeAvatarBtn = document.getElementById('change-avatar-btn');
  const avatarFileInput = document.getElementById('avatar-file-input');
  if (changeAvatarBtn && avatarFileInput) {
    changeAvatarBtn.addEventListener('click', () => avatarFileInput.click());
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        readFileAsOptimizedDataURL(file, 600, (dataUrl) => {
          document.getElementById('profile-avatar-img').src = dataUrl;
          saveProfile();
          showToast('Cover portrait updated');
        });
      }
    });
  }

  // Category Filtering
  const catTabs = document.querySelectorAll('.cat-tab');
  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      catTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentCategory = tab.dataset.category;
      renderGallery();
    });
  });

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

  // Layout View Switch (Masonry vs Grid)
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

  // Modal open/close
  const openUploadBtn = document.getElementById('open-upload-btn');
  const emptyAddBtn = document.getElementById('empty-add-btn');
  const uploadModal = document.getElementById('upload-modal');
  const closeUploadModal = document.getElementById('close-upload-modal');
  const cancelUploadBtn = document.getElementById('cancel-upload-btn');
  const modalBackdrop = document.getElementById('modal-backdrop');

  const openModal = () => {
    uploadModal.classList.add('open');
    uploadModal.setAttribute('aria-hidden', 'false');
    document.getElementById('photo-title-input').focus();
    const dateInput = document.getElementById('photo-date-input');
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  };

  const closeModal = () => {
    uploadModal.classList.remove('open');
    uploadModal.setAttribute('aria-hidden', 'true');
    resetUploadForm();
  };

  if (openUploadBtn) openUploadBtn.addEventListener('click', openModal);
  if (emptyAddBtn) emptyAddBtn.addEventListener('click', openModal);
  if (closeUploadModal) closeUploadModal.addEventListener('click', closeModal);
  if (cancelUploadBtn) cancelUploadBtn.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  // Setup drag-and-drop
  setupDropZone();

  // Load URL
  const loadUrlBtn = document.getElementById('load-url-btn');
  if (loadUrlBtn) {
    loadUrlBtn.addEventListener('click', () => {
      const urlInput = document.getElementById('image-url-input');
      const url = urlInput.value.trim();
      if (!url) {
        showToast('Please enter an image URL');
        return;
      }
      addPreviewThumbnail(url, 'url');
    });
  }

  // Upload Form Submission
  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleUploadSubmit);
  }

  // Lightbox & Slideshow
  setupLightboxEvents();

  // Slideshow trigger button in header
  const heroSlideshowBtn = document.getElementById('hero-slideshow-btn');
  if (heroSlideshowBtn) {
    heroSlideshowBtn.addEventListener('click', () => {
      if (filteredPhotos.length === 0) {
        showToast('No photographs in this collection to display');
        return;
      }
      openLightbox(0);
      startSlideshow();
    });
  }

  // Print Keepsake Memory Book
  const printNavBtn = document.getElementById('print-nav-btn');
  const printAlbumBtn = document.getElementById('print-album-btn');
  if (printNavBtn) printNavBtn.addEventListener('click', () => window.print());
  if (printAlbumBtn) printAlbumBtn.addEventListener('click', () => window.print());

  // Export JSON Backup
  const exportBtn = document.getElementById('export-album-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportAlbumJSON);

  // Reset sample photos
  const resetBtn = document.getElementById('hero-reset-demo-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset the archive to the default sample collection?')) {
        photos = [...DEFAULT_PHOTOS];
        savePhotos();
        applyProfile(DEFAULT_PROFILE);
        saveProfile();
        renderGallery();
        updateStats();
        showToast('Archive reset to curated defaults');
      }
    });
  }

  // Clear all photos
  const clearAllBtn = document.getElementById('clear-all-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete all photographs from this archive? This action cannot be undone.')) {
        photos = [];
        savePhotos();
        renderGallery();
        updateStats();
        showToast('Archive cleared');
      }
    });
  }
}

// ================= DRAG & DROP & IMAGE PROCESSING =================
function setupDropZone() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');

  if (!dropZone || !fileInput) return;

  browseBtn.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('click', (e) => {
    if (e.target !== browseBtn && !e.target.closest('.preview-thumb-box')) {
      fileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-active');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  });
}

function handleFilesSelected(files) {
  files.forEach(file => {
    readFileAsOptimizedDataURL(file, 1600, (dataUrl) => {
      pendingUploadFiles.push({ file, dataUrl });
      addPreviewThumbnail(dataUrl, 'file', pendingUploadFiles.length - 1);
    });
  });
}

function readFileAsOptimizedDataURL(file, maxWidth, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const optimizedData = canvas.toDataURL('image/jpeg', 0.88);
      callback(optimizedData);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function addPreviewThumbnail(src, type, index) {
  const previewStrip = document.getElementById('file-preview-strip');
  previewStrip.style.display = 'flex';

  const thumb = document.createElement('div');
  thumb.className = 'preview-thumb-box';
  thumb.innerHTML = `
    <img src="${src}" alt="Upload preview">
    <button type="button" class="remove-thumb-btn" title="Remove">✕</button>
  `;

  thumb.querySelector('.remove-thumb-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    thumb.remove();
    if (type === 'file' && index !== undefined) {
      pendingUploadFiles.splice(index, 1);
    }
    if (previewStrip.children.length === 0) {
      previewStrip.style.display = 'none';
    }
  });

  previewStrip.appendChild(thumb);
}

function resetUploadForm() {
  document.getElementById('upload-form').reset();
  pendingUploadFiles = [];
  const previewStrip = document.getElementById('file-preview-strip');
  previewStrip.innerHTML = '';
  previewStrip.style.display = 'none';
}

function handleUploadSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('photo-title-input').value.trim();
  const category = document.getElementById('photo-category-input').value;
  const date = document.getElementById('photo-date-input').value || new Date().toISOString().split('T')[0];
  const favorite = document.getElementById('photo-favorite-input').checked;
  const caption = document.getElementById('photo-caption-input').value.trim();
  const urlInput = document.getElementById('image-url-input').value.trim();

  const imagesToAdd = [];

  if (pendingUploadFiles.length > 0) {
    pendingUploadFiles.forEach(f => imagesToAdd.push(f.dataUrl));
  } else if (urlInput) {
    imagesToAdd.push(urlInput);
  }

  if (imagesToAdd.length === 0) {
    showToast('Please select an image file or enter an image URL');
    return;
  }

  imagesToAdd.forEach((imgUrl, i) => {
    const newPhoto = {
      id: 'photo-' + Date.now() + '-' + i,
      url: imgUrl,
      title: imagesToAdd.length > 1 ? `${title} (${i + 1})` : title,
      category,
      date,
      favorite,
      caption: caption || `Captured during the session under ${category}.`
    };
    photos.unshift(newPhoto);
  });

  savePhotos();
  renderGallery();
  updateStats();

  document.getElementById('upload-modal').classList.remove('open');
  resetUploadForm();
  showToast(`Added ${imagesToAdd.length} photograph${imagesToAdd.length > 1 ? 's' : ''} to archive`);
}

// ================= GALLERY RENDERING =================
function renderGallery() {
  const container = document.getElementById('photos-grid');
  const emptyState = document.getElementById('empty-state');

  // Filter
  filteredPhotos = photos.filter(p => {
    const matchCategory = 
      currentCategory === 'all' ? true :
      currentCategory === 'favorites' ? p.favorite :
      p.category === currentCategory;

    const matchSearch = searchQuery === '' || 
      p.title.toLowerCase().includes(searchQuery) || 
      (p.caption && p.caption.toLowerCase().includes(searchQuery)) ||
      p.category.toLowerCase().includes(searchQuery);

    return matchCategory && matchSearch;
  });

  // Sort
  filteredPhotos.sort((a, b) => {
    if (currentSort === 'newest') return (b.date || '').localeCompare(a.date || '');
    if (currentSort === 'oldest') return (a.date || '').localeCompare(b.date || '');
    if (currentSort === 'favorites') return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
    if (currentSort === 'title') return a.title.localeCompare(b.title);
    return 0;
  });

  if (filteredPhotos.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = '';

  filteredPhotos.forEach((photo, index) => {
    const card = createPhotoCard(photo, index);
    container.appendChild(card);
  });
}

function createPhotoCard(photo, index) {
  const card = document.createElement('article');
  card.className = 'photo-card';
  card.id = `card-${photo.id}`;

  const formattedDate = photo.date ? formatDate(photo.date) : '';

  card.innerHTML = `
    <div class="card-media-wrapper" role="button" tabindex="0" aria-label="View ${photo.title} in full screen">
      <div class="card-floating-bar">
        <span class="card-badge">${photo.category}</span>
        <button class="card-fav-btn ${photo.favorite ? 'is-favorite' : ''}" title="${photo.favorite ? 'Remove from favorites' : 'Mark as favorite'}" aria-label="Favorite toggle">
          ${photo.favorite ? ICONS.heartFilled : ICONS.heartOutline}
        </button>
      </div>
      <img src="${photo.url}" alt="${photo.title}" loading="lazy">
      <div class="card-hover-overlay">
        <span class="quick-view-badge">
          ${ICONS.zoom}
          <span>Expand</span>
        </span>
      </div>
    </div>
    <div class="card-content">
      <div class="card-title-row">
        <h3 class="card-title">${photo.title}</h3>
        ${formattedDate ? `<span class="card-date">${formattedDate}</span>` : ''}
      </div>
      ${photo.caption ? `<p class="card-story">${photo.caption}</p>` : ''}
      <div class="card-actions-row">
        <button class="card-action-btn edit-btn" title="Edit story caption">
          ${ICONS.edit}
          <span>Edit</span>
        </button>
        <button class="card-action-btn delete-btn" title="Delete this photograph">
          ${ICONS.delete}
          <span>Delete</span>
        </button>
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

  // Favorite toggle
  const favBtn = card.querySelector('.card-fav-btn');
  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(photo.id);
  });

  // Edit action
  const editBtn = card.querySelector('.edit-btn');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    editPhotoDetails(photo.id);
  });

  // Delete action
  const delBtn = card.querySelector('.delete-btn');
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deletePhoto(photo.id);
  });

  return card;
}

function formatDate(dateStr) {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
  } catch (_) {
    return dateStr;
  }
}

function toggleFavorite(id) {
  const p = photos.find(item => item.id === id);
  if (p) {
    p.favorite = !p.favorite;
    savePhotos();
    renderGallery();
    updateStats();
    showToast(p.favorite ? `Marked "${p.title}" as favorite` : `Removed "${p.title}" from favorites`);
  }
}

function editPhotoDetails(id) {
  const p = photos.find(item => item.id === id);
  if (!p) return;

  const newTitle = prompt('Edit Title:', p.title);
  if (newTitle === null) return;

  const newCaption = prompt('Edit Story / Caption:', p.caption || '');
  if (newCaption === null) return;

  p.title = newTitle.trim() || p.title;
  p.caption = newCaption.trim();

  savePhotos();
  renderGallery();
  showToast('Photograph details updated');
}

function deletePhoto(id) {
  if (confirm('Delete this photograph from the archive?')) {
    photos = photos.filter(item => item.id !== id);
    savePhotos();
    renderGallery();
    updateStats();
    showToast('Photograph deleted');
  }
}

function updateStats() {
  const summaryEl = document.getElementById('stat-summary-text');
  if (summaryEl) {
    const count = photos.length;
    const favCount = photos.filter(p => p.favorite).length;
    summaryEl.innerText = `${count} photograph${count === 1 ? '' : 's'} archived • ${favCount} favorite${favCount === 1 ? '' : 's'}`;
  }
}

// ================= FULLSCREEN LIGHTBOX & SLIDESHOW =================
function setupLightboxEvents() {
  const lbModal = document.getElementById('lightbox-modal');
  const lbBackdrop = document.getElementById('lightbox-backdrop');
  const lbCloseBtn = document.getElementById('lb-close-btn');
  const lbPrevBtn = document.getElementById('lb-prev-btn');
  const lbNextBtn = document.getElementById('lb-next-btn');
  const lbFavBtn = document.getElementById('lb-favorite-btn');
  const lbSlideshowBtn = document.getElementById('lb-slideshow-toggle-btn');
  const lbDownloadBtn = document.getElementById('lb-download-btn');
  const lbEditBtn = document.getElementById('lb-edit-btn');
  const lbDeleteBtn = document.getElementById('lb-delete-btn');

  const closeLb = () => {
    stopSlideshow();
    lbModal.classList.remove('open');
    lbModal.setAttribute('aria-hidden', 'true');
  };

  lbCloseBtn.addEventListener('click', closeLb);
  lbBackdrop.addEventListener('click', closeLb);

  lbPrevBtn.addEventListener('click', () => navigateLightbox(-1));
  lbNextBtn.addEventListener('click', () => navigateLightbox(1));

  lbFavBtn.addEventListener('click', () => {
    if (currentLightboxIndex >= 0 && filteredPhotos[currentLightboxIndex]) {
      const p = filteredPhotos[currentLightboxIndex];
      toggleFavorite(p.id);
      updateLightboxContent();
    }
  });

  lbSlideshowBtn.addEventListener('click', () => {
    if (slideshowTimer) {
      stopSlideshow();
    } else {
      startSlideshow();
    }
  });

  lbDownloadBtn.addEventListener('click', () => {
    if (currentLightboxIndex >= 0 && filteredPhotos[currentLightboxIndex]) {
      const p = filteredPhotos[currentLightboxIndex];
      const a = document.createElement('a');
      a.href = p.url;
      a.download = `${p.title.replace(/\s+/g, '_')}_archive.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Downloading photograph');
    }
  });

  lbEditBtn.addEventListener('click', () => {
    if (currentLightboxIndex >= 0 && filteredPhotos[currentLightboxIndex]) {
      const p = filteredPhotos[currentLightboxIndex];
      editPhotoDetails(p.id);
      updateLightboxContent();
    }
  });

  lbDeleteBtn.addEventListener('click', () => {
    if (currentLightboxIndex >= 0 && filteredPhotos[currentLightboxIndex]) {
      const p = filteredPhotos[currentLightboxIndex];
      deletePhoto(p.id);
      if (filteredPhotos.length > 0) {
        currentLightboxIndex = Math.min(currentLightboxIndex, filteredPhotos.length - 1);
        updateLightboxContent();
      } else {
        closeLb();
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!lbModal.classList.contains('open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
    if (e.key === ' ') {
      e.preventDefault();
      if (slideshowTimer) stopSlideshow();
      else startSlideshow();
    }
  });
}

function openLightbox(index) {
  if (index < 0 || index >= filteredPhotos.length) return;
  currentLightboxIndex = index;
  const lbModal = document.getElementById('lightbox-modal');
  lbModal.classList.add('open');
  lbModal.setAttribute('aria-hidden', 'false');
  updateLightboxContent();
}

function navigateLightbox(direction) {
  if (filteredPhotos.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex + direction + filteredPhotos.length) % filteredPhotos.length;
  updateLightboxContent();
}

function updateLightboxContent() {
  const photo = filteredPhotos[currentLightboxIndex];
  if (!photo) return;

  const lbImage = document.getElementById('lightbox-image');
  const lbCounter = document.getElementById('lightbox-counter');
  const lbCatBadge = document.getElementById('lb-category-badge');
  const lbDate = document.getElementById('lb-date-text');
  const lbTitle = document.getElementById('lb-title');
  const lbCaption = document.getElementById('lb-caption');
  const lbFavBtn = document.getElementById('lb-favorite-btn');

  lbImage.style.opacity = '0';
  setTimeout(() => {
    lbImage.src = photo.url;
    lbImage.alt = photo.title;
    lbImage.style.opacity = '1';
  }, 80);

  lbCounter.innerText = `${currentLightboxIndex + 1} of ${filteredPhotos.length}`;
  lbCatBadge.innerText = photo.category;
  lbDate.innerText = photo.date ? formatDate(photo.date) : '';
  lbTitle.innerText = photo.title;
  lbCaption.innerText = photo.caption || '';
  
  if (photo.favorite) {
    lbFavBtn.classList.add('is-favorite');
    lbFavBtn.innerHTML = ICONS.heartFilled;
  } else {
    lbFavBtn.classList.remove('is-favorite');
    lbFavBtn.innerHTML = ICONS.heartOutline;
  }
}

function startSlideshow() {
  const lbSlideshowBtn = document.getElementById('lb-slideshow-toggle-btn');
  lbSlideshowBtn.innerHTML = ICONS.pause;
  showToast('Slideshow playing — Press spacebar to pause');
  slideshowTimer = setInterval(() => {
    navigateLightbox(1);
  }, 4000);
}

function stopSlideshow() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
    const lbSlideshowBtn = document.getElementById('lb-slideshow-toggle-btn');
    if (lbSlideshowBtn) lbSlideshowBtn.innerHTML = ICONS.play;
    showToast('Slideshow paused');
  }
}

// ================= TOAST NOTIFICATION HELPER =================
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
  }, 2800);
}

// ================= EXPORT ALBUM JSON BACKUP =================
function exportAlbumJSON() {
  const data = {
    exportDate: new Date().toISOString(),
    profile: JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILE) || '{}'),
    photos: photos
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `birthday_archive_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Archive downloaded as JSON');
}
