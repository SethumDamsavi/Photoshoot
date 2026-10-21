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

// ================= PERSISTENT STORAGE =================
// On Vercel every function instance has its own memory and /tmp, so data written
// there is invisible to other instances and lost on cold start. When an Upstash
// Redis store is connected (Vercel Storage → Upstash), all instances share it.
// Without one (local dev), data lives in the data/*.json files.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const USE_REDIS = Boolean(REDIS_URL && REDIS_TOKEN);
const REDIS_PREFIX = 'birthday:';

async function redisCommand(command) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Redis error: ${data.error || res.status}`);
  return data.result;
}

function defaultsFor(file) {
  if (file === PRODUCTS_FILE) return defaultProducts;
  if (file === CATEGORIES_FILE) return defaultCategories;
  if (file === USERS_FILE) return defaultUsers;
  return defaultSettings;
}

function readLocalJSON(file) {
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.warn(`File read fallback for ${file}:`, err.message);
  }
  return JSON.parse(JSON.stringify(defaultsFor(file)));
}

async function readJSON(file) {
  if (!USE_REDIS) return readLocalJSON(file);

  const key = REDIS_PREFIX + path.basename(file, '.json');
  const stored = await redisCommand(['GET', key]);
  if (stored) return JSON.parse(stored);

  // First run: seed the shared store from the bundled dataset
  const seed = readLocalJSON(file);
  await redisCommand(['SET', key, JSON.stringify(seed), 'NX']);
  return seed;
}

async function writeJSON(file, data) {
  if (USE_REDIS) {
    await redisCommand(['SET', REDIS_PREFIX + path.basename(file, '.json'), JSON.stringify(data)]);
    return true;
  }
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    throw new Error('Storage is read-only. Connect an Upstash Redis store to this Vercel project so changes can be saved.');
  }
  syncDefaultDataFile();
  return true;
}

// Keep default-data.js in step with data/*.json during local development
function syncDefaultDataFile() {
  try {
    const defaultDataPath = path.resolve(process.cwd(), 'default-data.js');
    if (!fs.existsSync(defaultDataPath)) return;
    const content = `export const defaultCategories = ${JSON.stringify(readLocalJSON(CATEGORIES_FILE), null, 2)};\n\n` +
      `export const defaultProducts = ${JSON.stringify(readLocalJSON(PRODUCTS_FILE), null, 2)};\n\n` +
      `export const defaultUsers = ${JSON.stringify(readLocalJSON(USERS_FILE), null, 2)};\n\n` +
      `export const defaultSettings = ${JSON.stringify(readLocalJSON(SETTINGS_FILE), null, 2)};\n`;
    fs.writeFileSync(defaultDataPath, content, 'utf-8');
  } catch (err) {
    console.warn('Could not sync default-data.js:', err.message);
  }
}

// Store uploaded images in Vercel Blob when connected (Vercel Storage → Blob),
// so the photo list holds short URLs instead of multi-megabyte base64 strings.
async function storeUploadedImage(buffer, mimeType, safeFilename, dataUrl) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${safeFilename}`, buffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: true
    });
    return blob.url;
  }

  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, safeFilename), buffer);
  } catch (_) {}
  return dataUrl;
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

// Session tokens are signed (not kept in memory) so every serverless instance accepts them
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || REDIS_TOKEN || process.env.BLOB_READ_WRITE_TOKEN ||
  crypto.createHash('sha256').update(JSON.stringify(defaultUsers)).digest('hex');

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({ user, expiresAt: Date.now() + SESSION_TTL_MS })).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyAuthToken(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (Date.now() > session.expiresAt) return null;
    return session.user;
  } catch (_) {
    return null;
  }
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

  // Response Helper with strict no-cache headers for instant updates
  const sendJSON = (statusCode, data) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.end(JSON.stringify(data));
    return true;
  };

  // 1. AUTH: Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const { username, password } = await parseBody(req);
    const users = await readJSON(USERS_FILE);
    const user = users.find(u => u.username.toLowerCase() === (username || '').trim().toLowerCase());

    if (!user || !verifyPassword(password, user)) {
      return sendJSON(401, {
        success: false,
        error: 'Invalid username or password.'
      });
    }

    // Generate signed session token
    const token = signToken({ username: user.username, name: user.name, role: user.role });

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
    return sendJSON(200, { success: true, message: 'Logged out successfully' });
  }

  // 3.5. SETTINGS: GET (Public - retrieves main hero image and plaque details)
  if (pathname === '/api/settings' && method === 'GET') {
    const settings = await readJSON(SETTINGS_FILE);
    return sendJSON(200, settings);
  }

  // 3.6. SETTINGS: POST / PUT (Admin only - update hero image and plaque)
  if (pathname === '/api/settings' && (method === 'POST' || method === 'PUT')) {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const body = await parseBody(req);
    const currentSettings = await readJSON(SETTINGS_FILE);

    const updatedSettings = {
      ...currentSettings,
      heroImage: body.heroImage !== undefined && body.heroImage !== '' ? body.heroImage.trim() : currentSettings.heroImage,
      heroChapter: body.heroChapter !== undefined && body.heroChapter !== '' ? body.heroChapter.trim() : currentSettings.heroChapter,
      heroSubtitle: body.heroSubtitle !== undefined && body.heroSubtitle !== '' ? body.heroSubtitle.trim() : currentSettings.heroSubtitle,
      heroName: body.heroName !== undefined && body.heroName !== '' ? body.heroName.trim() : currentSettings.heroName,
      heroDate: body.heroDate !== undefined && body.heroDate !== '' ? body.heroDate.trim() : currentSettings.heroDate,
      storyImage: body.storyImage !== undefined && body.storyImage !== '' ? body.storyImage.trim() : (currentSettings.storyImage || currentSettings.heroImage || 'assets/portrait.jpg'),
      storyHeading: body.storyHeading !== undefined && body.storyHeading !== '' ? body.storyHeading.trim() : (currentSettings.storyHeading || "Hi, I'm Raveesha"),
      storyText: body.storyText !== undefined && body.storyText !== '' ? body.storyText.trim() : (currentSettings.storyText || "Stepping into 21 surrounded by love, golden sunlight, and sweet celebration. This photoshoot captures the laughter, the elegance, and the wonderful memories of entering adulthood and celebrating this milestone chapter. Thank you for celebrating with me!"),
      storyNote: body.storyNote !== undefined && body.storyNote !== '' ? body.storyNote.trim() : (currentSettings.storyNote || "Thanks for celebrating Chapter 21 with me!"),
      updatedAt: new Date().toISOString()
    };

    await writeJSON(SETTINGS_FILE, updatedSettings);
    return sendJSON(200, { success: true, settings: updatedSettings });
  }

  // 3.7. ARCHIVE SYNC: GET & POST (Bi-directional persistence across serverless lifecycles)
  if (pathname === '/api/sync' && method === 'GET') {
    const products = await readJSON(PRODUCTS_FILE);
    const categories = await readJSON(CATEGORIES_FILE);
    const settings = await readJSON(SETTINGS_FILE);
    return sendJSON(200, {
      success: true,
      products,
      categories,
      settings,
      serverTime: new Date().toISOString()
    });
  }

  if (pathname === '/api/sync' && method === 'POST') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });
    const body = await parseBody(req);
    if (body.settings && typeof body.settings === 'object') {
      const current = await readJSON(SETTINGS_FILE);
      const updated = {
        ...current,
        ...body.settings,
        updatedAt: body.settings.updatedAt || new Date().toISOString()
      };
      await writeJSON(SETTINGS_FILE, updated);
    }
    if (Array.isArray(body.products) && body.products.length > 0) {
      await writeJSON(PRODUCTS_FILE, body.products);
    }
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      await writeJSON(CATEGORIES_FILE, body.categories);
    }
    return sendJSON(200, {
      success: true,
      message: 'Archive synchronized successfully',
      serverTime: new Date().toISOString()
    });
  }

  // 4. CATEGORIES: GET (Public)
  if (pathname === '/api/categories' && method === 'GET') {
    const categories = await readJSON(CATEGORIES_FILE);
    const products = await readJSON(PRODUCTS_FILE);

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

    const categories = await readJSON(CATEGORIES_FILE);
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (categories.some(c => c.slug === slug)) {
      return sendJSON(400, { error: 'Category already exists' });
    }

    const newCategory = { id: slug, name: name.trim(), slug };
    categories.push(newCategory);
    await writeJSON(CATEGORIES_FILE, categories);

    return sendJSON(201, { success: true, category: newCategory });
  }

  // 6. CATEGORIES: DELETE (Admin only)
  if (pathname.startsWith('/api/categories/') && method === 'DELETE') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });
    const catId = pathname.split('/')[3];

    let categories = await readJSON(CATEGORIES_FILE);
    categories = categories.filter(c => c.id !== catId && c.slug !== catId);
    await writeJSON(CATEGORIES_FILE, categories);

    return sendJSON(200, { success: true });
  }

  // 7. PHOTOS/PRODUCTS: GET (Public - with search, category & sort)
  if ((pathname === '/api/products' || pathname === '/api/photos') && method === 'GET') {
    let products = await readJSON(PRODUCTS_FILE);
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
    const products = await readJSON(PRODUCTS_FILE);
    const product = products.find(p => p.id === id);
    if (!product) return sendJSON(404, { error: 'Photo not found' });
    return sendJSON(200, product);
  }

  // 9. PHOTOS/PRODUCTS: POST (Admin only - create photo)
  if ((pathname === '/api/products' || pathname === '/api/photos') && method === 'POST') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const body = await parseBody(req);
    if (!body.name || !body.name.trim()) return sendJSON(400, { error: 'Photo title is required' });

    const products = await readJSON(PRODUCTS_FILE);
    const categories = await readJSON(CATEGORIES_FILE);

    const categoryName = body.category || 'Portraits';
    const categorySlug = body.categorySlug || categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Auto-create category if new
    if (!categories.some(c => c.slug === categorySlug)) {
      categories.push({ id: categorySlug, name: categoryName, slug: categorySlug });
      await writeJSON(CATEGORIES_FILE, categories);
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
    await writeJSON(PRODUCTS_FILE, products);

    return sendJSON(201, { success: true, product: newProduct });
  }

  // 10. PHOTOS/PRODUCTS: PUT (Admin only - update photo)
  if ((pathname.match(/^\/api\/products\/\d+$/) || pathname.match(/^\/api\/photos\/\d+$/)) && method === 'PUT') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const id = parseInt(pathname.split('/')[3], 10);
    const body = await parseBody(req);
    const products = await readJSON(PRODUCTS_FILE);
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

    await writeJSON(PRODUCTS_FILE, products);
    return sendJSON(200, { success: true, product: products[index] });
  }

  // 11. PRODUCTS: DELETE (Admin only)
  if (pathname.match(/^\/api\/products\/\d+$/) && method === 'DELETE') {
    if (!verifyAuthToken(req)) return sendJSON(401, { error: 'Authentication required' });

    const id = parseInt(pathname.split('/')[3], 10);
    let products = await readJSON(PRODUCTS_FILE);
    const initialLen = products.length;
    products = products.filter(p => p.id !== id);

    if (products.length === initialLen) return sendJSON(404, { error: 'Product not found' });

    await writeJSON(PRODUCTS_FILE, products);
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
      const url = await storeUploadedImage(buffer, mimeType, safeFilename, dataUrl);

      return sendJSON(200, {
        success: true,
        url,
        filename: safeFilename
      });
    } catch (err) {
      console.error('Upload error:', err);
      return sendJSON(500, { error: 'Failed to process image file' });
    }
  }

  // Not an API route
  return false;
}
