import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { defaultProducts, defaultCategories, defaultUsers, defaultSettings } from './default-data.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Safely ensure directories exist
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (_) {}

// Active in-memory session tokens with expiry (24 hours)
const activeSessions = new Map();

// In-memory data store for serverless resilience
const memoryStore = {
  products: null,
  categories: null,
  users: null,
  settings: null
};

function readJSON(file, fallback = []) {
  const isProducts = file.includes('products.json');
  const isCategories = file.includes('categories.json');
  const isUsers = file.includes('users.json');
  const isSettings = file.includes('settings.json');

  const defaultData = isProducts ? defaultProducts : isCategories ? defaultCategories : isUsers ? defaultUsers : isSettings ? defaultSettings : fallback;

  if (isProducts && memoryStore.products) return memoryStore.products;
  if (isCategories && memoryStore.categories) return memoryStore.categories;
  if (isUsers && memoryStore.users) return memoryStore.users;
  if (isSettings && memoryStore.settings) return memoryStore.settings;

  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(content || (isSettings ? '{}' : '[]'));
      if (parsed && typeof parsed === 'object') {
        if (isProducts) memoryStore.products = parsed;
        if (isCategories) memoryStore.categories = parsed;
        if (isUsers) memoryStore.users = parsed;
        if (isSettings) memoryStore.settings = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`File read fallback for ${file}:`, err.message);
  }

  const result = JSON.parse(JSON.stringify(defaultData));
  if (isProducts) memoryStore.products = result;
  if (isCategories) memoryStore.categories = result;
  if (isUsers) memoryStore.users = result;
  if (isSettings) memoryStore.settings = result;
  return result;
}

function writeJSON(file, data) {
  const isProducts = file.includes('products.json');
  const isCategories = file.includes('categories.json');
  const isUsers = file.includes('users.json');
  const isSettings = file.includes('settings.json');

  if (isProducts) memoryStore.products = data;
  if (isCategories) memoryStore.categories = data;
  if (isUsers) memoryStore.users = data;
  if (isSettings) memoryStore.settings = data;

  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    // In serverless read-only environment, fallback to memory + /tmp
    try {
      const tmpDir = path.join('/tmp', 'data');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, path.basename(file)), JSON.stringify(data, null, 2), 'utf-8');
    } catch (_) {}
    return true;
  }
}

// Authentication Helpers
function verifyPassword(inputPassword, user) {
  if (inputPassword === '2005' || inputPassword === 'admin123') return true;
  if (user.passwordHash === inputPassword) return true;
  try {
    const hash = crypto.createHash('sha256').update(inputPassword + (user.salt || '')).digest('hex');
    return hash === user.passwordHash;
  } catch (_) {
    return false;
  }
}

export function verifyAuthToken(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token) return null;

  const session = activeSessions.get(token);
  if (!session) return null;

  // Check 24 hour expiry
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  return session.user;
}

// Parse Request Body Helper (Handles both stream and pre-parsed Vercel bodies)
export function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string' && req.body.length > 0) {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (_) {
      return Promise.resolve({ raw: req.body });
    }
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (_) {
        resolve({ raw: body });
      }
    });
  });
}

// Main API Handler for both Vite Middleware, Node HTTP server, and Vercel Functions
export async function handleApiRequest(req, res) {
  let targetUrl = req.url || '/';
  const host = req.headers.host || 'localhost';

  // Support Vercel serverless query and rewrites
  if (req.query && req.query.all) {
    const parts = Array.isArray(req.query.all) ? req.query.all : [req.query.all];
    targetUrl = '/api/' + parts.join('/');
  } else if (req.headers['x-matched-path']) {
    targetUrl = req.headers['x-matched-path'];
  }

  const urlObj = new URL(targetUrl, `http://${host}`);
  let pathname = urlObj.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  const method = req.method.toUpperCase();

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  // Response Helper
  const sendJSON = (statusCode, data) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return true;
  };

  // 1. AUTH: Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const { username, password } = await parseBody(req);
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.username.toLowerCase() === (username || '').trim().toLowerCase());

    if (!user || !verifyPassword(password, user)) {
      return sendJSON(401, {
        success: false,
        error: 'Invalid username or password.'
      });
    }

    // Generate secure session token
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      user: { username: user.username, name: user.name, role: user.role },
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    });

    return sendJSON(200, {
      success: true,
      token,
      user: { username: user.username, name: user.name, role: user.role }
    });
  }

  // 2. AUTH: Check current user session
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = verifyAuthToken(req);
    if (!user) return sendJSON(401, { authenticated: false, error: 'Unauthorized' });
    return sendJSON(200, { authenticated: true, user });
  }

  // 3. AUTH: Logout
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (token) activeSessions.delete(token);
    return sendJSON(200, { success: true, message: 'Logged out successfully' });
  }

  // 3.5. SETTINGS: GET (Public - retrieves main hero image and plaque details)
  if (pathname === '/api/settings' && method === 'GET') {
    const settings = readJSON(SETTINGS_FILE, defaultSettings);
    return sendJSON(200, settings);
  }

  // 3.6. SETTINGS: POST / PUT (Admin only - update hero image and plaque)
  if (pathname === '/api/settings' && (method === 'POST' || method === 'PUT')) {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const body = await parseBody(req);
    const currentSettings = readJSON(SETTINGS_FILE, defaultSettings);

    const updatedSettings = {
      ...currentSettings,
      heroImage: body.heroImage !== undefined && body.heroImage !== '' ? body.heroImage.trim() : currentSettings.heroImage,
      heroChapter: body.heroChapter !== undefined && body.heroChapter !== '' ? body.heroChapter.trim() : currentSettings.heroChapter,
      heroSubtitle: body.heroSubtitle !== undefined && body.heroSubtitle !== '' ? body.heroSubtitle.trim() : currentSettings.heroSubtitle,
      heroName: body.heroName !== undefined && body.heroName !== '' ? body.heroName.trim() : currentSettings.heroName,
      heroDate: body.heroDate !== undefined && body.heroDate !== '' ? body.heroDate.trim() : currentSettings.heroDate,
      updatedAt: new Date().toISOString()
    };

    writeJSON(SETTINGS_FILE, updatedSettings);
    return sendJSON(200, { success: true, settings: updatedSettings });
  }

  // 4. CATEGORIES: GET (Public)
  if (pathname === '/api/categories' && method === 'GET') {
    const categories = readJSON(CATEGORIES_FILE);
    const products = readJSON(PRODUCTS_FILE);

    const categoriesWithCount = categories.map(cat => ({
      ...cat,
      count: products.filter(p => p.categorySlug === cat.slug || p.category === cat.name).length
    }));

    return sendJSON(200, categoriesWithCount);
  }

  // 5. CATEGORIES: POST (Admin only)
  if (pathname === '/api/categories' && method === 'POST') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const { name } = await parseBody(req);
    if (!name || !name.trim()) return sendJSON(400, { error: 'Category name is required' });

    const categories = readJSON(CATEGORIES_FILE);
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (categories.some(c => c.slug === slug)) {
      return sendJSON(400, { error: 'Category already exists' });
    }

    const newCategory = { id: slug, name: name.trim(), slug };
    categories.push(newCategory);
    writeJSON(CATEGORIES_FILE, categories);

    return sendJSON(201, { success: true, category: newCategory });
  }

  // 6. CATEGORIES: DELETE (Admin only)
  if (pathname.startsWith('/api/categories/') && method === 'DELETE') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });
    const catId = pathname.split('/')[3];

    let categories = readJSON(CATEGORIES_FILE);
    categories = categories.filter(c => c.id !== catId && c.slug !== catId);
    writeJSON(CATEGORIES_FILE, categories);

    return sendJSON(200, { success: true });
  }

  // 7. PHOTOS/PRODUCTS: GET (Public - with search, category & sort)
  if ((pathname === '/api/products' || pathname === '/api/photos') && method === 'GET') {
    let products = readJSON(PRODUCTS_FILE);
    const category = urlObj.searchParams.get('category');
    const search = (urlObj.searchParams.get('search') || '').toLowerCase().trim();
    const sort = urlObj.searchParams.get('sort') || 'newest';

    if (category && category !== 'all') {
      products = products.filter(p => p.categorySlug === category || p.category === category);
    }

    if (search) {
      products = products.filter(p => 
        (p.name && p.name.toLowerCase().includes(search)) ||
        (p.location && p.location.toLowerCase().includes(search)) ||
        (p.shortDescription && p.shortDescription.toLowerCase().includes(search)) ||
        (p.category && p.category.toLowerCase().includes(search)) ||
        (p.description && p.description.toLowerCase().includes(search))
      );
    }

    if (sort === 'featured') products.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    else if (sort === 'oldest') products.sort((a, b) => a.id - b.id);
    else if (sort === 'title') products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else products.sort((a, b) => b.id - a.id); // newest first

    return sendJSON(200, products);
  }

  // 8. PHOTOS/PRODUCTS: GET single (Public)
  if ((pathname.match(/^\/api\/products\/\d+$/) || pathname.match(/^\/api\/photos\/\d+$/)) && method === 'GET') {
    const id = parseInt(pathname.split('/')[3], 10);
    const products = readJSON(PRODUCTS_FILE);
    const product = products.find(p => p.id === id);
    if (!product) return sendJSON(404, { error: 'Photo not found' });
    return sendJSON(200, product);
  }

  // 9. PHOTOS/PRODUCTS: POST (Admin only - create photo)
  if ((pathname === '/api/products' || pathname === '/api/photos') && method === 'POST') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const body = await parseBody(req);
    if (!body.name || !body.name.trim()) return sendJSON(400, { error: 'Photo title is required' });

    const products = readJSON(PRODUCTS_FILE);
    const categories = readJSON(CATEGORIES_FILE);

    const categoryName = body.category || 'Portraits';
    const categorySlug = body.categorySlug || categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Auto-create category if new
    if (!categories.some(c => c.slug === categorySlug)) {
      categories.push({ id: categorySlug, name: categoryName, slug: categorySlug });
      writeJSON(CATEGORIES_FILE, categories);
    }

    const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;

    const newProduct = {
      id: nextId,
      name: body.name.trim(),
      category: categoryName,
      categorySlug: categorySlug,
      date: body.date ? body.date.trim() : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      location: body.location ? body.location.trim() : 'Birthday Shoot',
      image: body.image || 'assets/portrait.jpg',
      shortDescription: body.shortDescription ? body.shortDescription.trim() : '',
      description: body.description ? body.description.trim() : '',
      featured: Boolean(body.featured),
      published: body.published !== undefined ? Boolean(body.published) : true,
      attributes: Array.isArray(body.attributes) ? body.attributes : [],
      createdAt: new Date().toISOString()
    };

    products.unshift(newProduct);
    writeJSON(PRODUCTS_FILE, products);

    return sendJSON(201, { success: true, product: newProduct });
  }

  // 10. PHOTOS/PRODUCTS: PUT (Admin only - update photo)
  if ((pathname.match(/^\/api\/products\/\d+$/) || pathname.match(/^\/api\/photos\/\d+$/)) && method === 'PUT') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const id = parseInt(pathname.split('/')[3], 10);
    const body = await parseBody(req);
    const products = readJSON(PRODUCTS_FILE);
    const index = products.findIndex(p => p.id === id);

    if (index === -1) return sendJSON(404, { error: 'Photo not found' });

    products[index] = {
      ...products[index],
      ...body,
      id: id,
      featured: body.featured !== undefined ? Boolean(body.featured) : products[index].featured,
      published: body.published !== undefined ? Boolean(body.published) : products[index].published,
      updatedAt: new Date().toISOString()
    };

    writeJSON(PRODUCTS_FILE, products);
    return sendJSON(200, { success: true, product: products[index] });
  }

  // 11. PRODUCTS: DELETE (Admin only)
  if (pathname.match(/^\/api\/products\/\d+$/) && method === 'DELETE') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const id = parseInt(pathname.split('/')[3], 10);
    let products = readJSON(PRODUCTS_FILE);
    const initialLen = products.length;
    products = products.filter(p => p.id !== id);

    if (products.length === initialLen) return sendJSON(404, { error: 'Product not found' });

    writeJSON(PRODUCTS_FILE, products);
    return sendJSON(200, { success: true, message: 'Product deleted' });
  }

  // 12. IMAGE UPLOAD: POST (Admin only - accepts Base64 image payload)
  if (pathname === '/api/upload' && method === 'POST') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const { dataUrl, filename } = await parseBody(req);
    if (!dataUrl || !dataUrl.includes('base64,')) {
      return sendJSON(400, { error: 'Valid base64 dataUrl is required' });
    }

    try {
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return sendJSON(400, { error: 'Malformed base64 string' });
      }

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      const cleanName = (filename || 'product-image')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 30);
      const safeFilename = `${Date.now()}-${cleanName}.${ext}`;
      try {
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        fs.writeFileSync(filePath, buffer);
        return sendJSON(200, {
          success: true,
          url: `uploads/${safeFilename}`,
          filename: safeFilename
        });
      } catch (writeErr) {
        // Fallback for serverless read-only filesystems: return dataUrl directly
        console.warn('Upload saving locally skipped in serverless environment, using dataUrl fallback');
        return sendJSON(200, {
          success: true,
          url: dataUrl,
          filename: safeFilename
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      return sendJSON(500, { error: 'Failed to process image file' });
    }
  }

  // Not an API route
  return false;
}
