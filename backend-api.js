import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { defaultProducts, defaultCategories, defaultSettings } from './default-data.js';

// Local development: private settings (the admin sign-in) can live in .env.local, which git
// ignores. On Vercel they come from the project's environment variables instead.
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
    process.loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  }
} catch (err) {
  console.warn('Could not read .env.local:', err.message);
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
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

// Album keys: the same rule as albums created in the album manager
function albumSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// A photo's album is optional. Blank means no album (the photo shows only under "All").
// A typed album reuses the existing album with that name, or is created.
async function resolveAlbum(rawName) {
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!name) return { category: '', categorySlug: '' };

  const categories = await readJSON(CATEGORIES_FILE);
  const slug = albumSlug(name);
  const existing =
    categories.find(c => typeof c.name === 'string' && c.name.trim().toLowerCase() === name.toLowerCase()) ||
    (slug ? categories.find(c => c.slug === slug) : null);
  if (existing) return { category: existing.name, categorySlug: existing.slug };

  // A name made only of symbols still needs a key of its own
  const newSlug = slug || `album-${Date.now().toString(36)}`;
  categories.push({ id: newSlug, name, slug: newSlug });
  await writeJSON(CATEGORIES_FILE, categories);
  return { category: name, categorySlug: newSlug };
}

function cleanTitle(rawName) {
  return typeof rawName === 'string' ? rawName.trim() : '';
}

// Keep default-data.js in step with data/*.json during local development
function syncDefaultDataFile() {
  try {
    const defaultDataPath = path.resolve(process.cwd(), 'default-data.js');
    if (!fs.existsSync(defaultDataPath)) return;
    const content = `export const defaultCategories = ${JSON.stringify(readLocalJSON(CATEGORIES_FILE), null, 2)};\n\n` +
      `export const defaultProducts = ${JSON.stringify(readLocalJSON(PRODUCTS_FILE), null, 2)};\n\n` +
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

// ================= ADMIN SIGN-IN =================
// The admin account is never kept in this repository (it is public on GitHub). It comes
// from one of two places:
//  1. The environment variables ADMIN_USERNAME and ADMIN_PASSWORD (Vercel → Settings →
//     Environment Variables, or .env.local on this computer). When ADMIN_PASSWORD is set,
//     it is the only way in.
//  2. Otherwise, an account the owner creates once on the /admin page with a one-time
//     setup code. It is saved in the site's shared storage (Redis on Vercel, the git-ignored
//     .admin-account.json on this computer) with the password scrypt-hashed.
// Only the SHA-256 of the setup code is in this file; the code itself was given to the
// owner privately. Each code works once. To let the owner choose a new username and
// password (for example after forgetting it), put the hash of a new code here.
// Passwords may be any length (the owner's choice).
const ENV_USERNAME = (process.env.ADMIN_USERNAME || 'admin').trim() || 'admin';
const ENV_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SETUP_CODE_SHA256 = 'c8df0446b961a5f17a95230232f9f9bf4cdc788f6159e0dd11c79bfcc919fbaa';
const ACCOUNT_KEY = REDIS_PREFIX + 'admin-account';
const ACCOUNT_FILE = path.resolve(process.cwd(), '.admin-account.json');
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const MAX_USERNAME_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 1024;
const FAILED_SIGN_IN_DELAY_MS = 900;

const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Compares fixed-length digests in constant time, so a wrong guess reveals nothing about
// how close it was
function sameSecret(a, b) {
  const da = crypto.createHash('sha256').update(String(a)).digest();
  const db = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(da, db);
}

function hashPassword(password, salt, params = SCRYPT_PARAMS) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 32, { N: params.N, r: params.r, p: params.p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key.toString('base64'))));
  });
}

// The setup code is compared without its dashes, spaces or letter case
function setupCodeMatches(code) {
  const typed = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digest = crypto.createHash('sha256').update(`admin-setup|${typed}`).digest('hex');
  return sameSecret(digest, SETUP_CODE_SHA256);
}

async function readAccount() {
  let account = null;
  try {
    if (USE_REDIS) {
      const stored = await redisCommand(['GET', ACCOUNT_KEY]);
      account = stored ? JSON.parse(stored) : null;
    } else if (fs.existsSync(ACCOUNT_FILE)) {
      account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf-8'));
    }
  } catch (err) {
    if (err instanceof SyntaxError) return null;
    throw err;
  }
  const valid = account && typeof account.username === 'string' && account.username &&
    typeof account.salt === 'string' && typeof account.hash === 'string';
  return valid ? account : null;
}

async function saveAccount(account) {
  if (USE_REDIS) {
    await redisCommand(['SET', ACCOUNT_KEY, JSON.stringify(account)]);
    return;
  }
  try {
    fs.writeFileSync(ACCOUNT_FILE, JSON.stringify(account, null, 2), 'utf-8');
  } catch (_) {
    throw new Error('Storage is read-only. Connect an Upstash Redis store to this Vercel project so the sign-in can be saved.');
  }
}

// Sessions are signed tokens, so every serverless instance accepts them without shared memory.
// The signing key mixes a private secret with the current sign-in, so a new password signs
// everyone out. "v2" (environment variables) and "v3" (account made with a setup code)
// retired every session issued before sign-in moved out of the repository.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const TOKEN_SECRET_BASE = process.env.ADMIN_TOKEN_SECRET || REDIS_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || 'birthday-shoot';

function tokenKeyFor(material) {
  return crypto.createHmac('sha256', TOKEN_SECRET_BASE).update(material).digest();
}

function signInFromAccount(account) {
  return {
    mode: 'account',
    username: account.username,
    account,
    tokenKey: tokenKeyFor(`admin-session-v3|${account.username.toLowerCase()}|${account.hash}`)
  };
}

// Today's sign-in: { mode: 'env' | 'account' | 'none', username, tokenKey, account }
async function currentSignIn() {
  if (ENV_PASSWORD) {
    return {
      mode: 'env',
      username: ENV_USERNAME,
      tokenKey: tokenKeyFor(`admin-session-v2|${ENV_USERNAME.toLowerCase()}|${ENV_PASSWORD}`)
    };
  }
  const account = await readAccount();
  return account ? signInFromAccount(account) : { mode: 'none' };
}

async function checkCredentials(signIn, username, password) {
  if (signIn.mode === 'none') return false;
  const typedPassword = typeof password === 'string' ? password : '';
  if (typedPassword.length > MAX_PASSWORD_LENGTH) return false;

  const nameOk = sameSecret(String(username || '').trim().toLowerCase(), signIn.username.toLowerCase());
  let passwordOk;
  if (signIn.mode === 'env') {
    passwordOk = sameSecret(typedPassword, ENV_PASSWORD);
  } else {
    const { salt, hash, params } = signIn.account;
    passwordOk = sameSecret(await hashPassword(typedPassword, Buffer.from(salt, 'base64'), params || SCRYPT_PARAMS), hash);
  }
  return nameOk && passwordOk;
}

function sessionUser(signIn) {
  return { username: signIn.username, name: signIn.username, role: 'administrator' };
}

function signToken(user, tokenKey) {
  const payload = Buffer.from(JSON.stringify({ user, expiresAt: Date.now() + SESSION_TTL_MS })).toString('base64url');
  const signature = crypto.createHmac('sha256', tokenKey).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export async function verifyAuthToken(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token || token.split('.').length !== 2) return null;

  let signIn;
  try {
    signIn = await currentSignIn();
  } catch (err) {
    console.warn('Could not read the admin sign-in:', err.message);
    return null;
  }
  if (signIn.mode === 'none') return null;

  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', signIn.tokenKey).update(payload).digest('base64url');
  if (!signature || signature.length !== expected.length ||
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

  // 1. AUTH: Is sign-in ready, or does the owner still need to create it with the setup code?
  if (pathname === '/api/auth/status' && method === 'GET') {
    const signIn = await currentSignIn();
    const setupAvailable = signIn.mode === 'none' ||
      (signIn.mode === 'account' && signIn.account.setupCode !== SETUP_CODE_SHA256);
    return sendJSON(200, { needsSetup: signIn.mode === 'none', setupAvailable });
  }

  // 1.1 AUTH: Create the admin sign-in with the one-time setup code, and sign straight in
  if (pathname === '/api/auth/setup' && method === 'POST') {
    if (ENV_PASSWORD) {
      return sendJSON(409, {
        success: false,
        error: "This site's sign-in is set in its environment variables, so it can't be changed here."
      });
    }

    const { setupCode, username, password } = await parseBody(req);
    if (!setupCodeMatches(setupCode)) {
      await pause(FAILED_SIGN_IN_DELAY_MS);
      return sendJSON(401, { success: false, error: "That setup code isn't right. Check it and try again." });
    }

    const existing = await readAccount();
    if (existing && existing.setupCode === SETUP_CODE_SHA256) {
      return sendJSON(409, {
        success: false,
        alreadyUsed: true,
        error: 'This setup code has already been used. Sign in with the username and password you chose.'
      });
    }

    const name = typeof username === 'string' ? username.trim() : '';
    if (!name || name.length > MAX_USERNAME_LENGTH) {
      return sendJSON(400, { success: false, error: `Choose a username (up to ${MAX_USERNAME_LENGTH} characters).` });
    }
    if (typeof password !== 'string' || !password || password.length > MAX_PASSWORD_LENGTH) {
      return sendJSON(400, { success: false, error: 'Choose a password.' });
    }

    const salt = crypto.randomBytes(16);
    const account = {
      username: name,
      salt: salt.toString('base64'),
      hash: await hashPassword(password, salt),
      params: SCRYPT_PARAMS,
      setupCode: SETUP_CODE_SHA256,
      createdAt: new Date().toISOString()
    };
    await saveAccount(account);

    const signIn = signInFromAccount(account);
    const user = sessionUser(signIn);
    return sendJSON(200, { success: true, token: signToken(user, signIn.tokenKey), user });
  }

  // 1.2 AUTH: Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const signIn = await currentSignIn();
    if (signIn.mode === 'none') {
      return sendJSON(503, {
        success: false,
        needsSetup: true,
        error: "Sign-in isn't set up yet. Enter your setup code to create it."
      });
    }

    const { username, password } = await parseBody(req);
    if (!(await checkCredentials(signIn, username, password))) {
      // A pause after every wrong guess makes guessing passwords slow
      await pause(FAILED_SIGN_IN_DELAY_MS);
      return sendJSON(401, {
        success: false,
        error: 'Invalid username or password.'
      });
    }

    const user = sessionUser(signIn);
    return sendJSON(200, {
      success: true,
      token: signToken(user, signIn.tokenKey),
      user
    });
  }

  // 2. AUTH: Check current user session
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = await verifyAuthToken(req);
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
    if (!(await verifyAuthToken(req))) return sendJSON(401, { error: 'Authentication required' });

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
    if (!(await verifyAuthToken(req))) return sendJSON(401, { error: 'Authentication required' });
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
    if (!(await verifyAuthToken(req))) return sendJSON(401, { error: 'Authentication required' });

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
    if (!(await verifyAuthToken(req))) return sendJSON(401, { error: 'Authentication required' });
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
    if (!(await verifyAuthToken(req))) return sendJSON(401, { error: 'Authentication required' });

    // Title and album are both optional
    const body = await parseBody(req);
    const products = await readJSON(PRODUCTS_FILE);
    const album = await resolveAlbum(body.category);

    const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;

    const newProduct = {
      id: nextId,
      name: cleanTitle(body.name),
      category: album.category,
      categorySlug: album.categorySlug,
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
    if (!(await verifyAuthToken(req))) return sendJSON(401, { error: 'Authentication required' });

    const id = parseInt(pathname.split('/')[3], 10);
    const body = await parseBody(req);
    const products = await readJSON(PRODUCTS_FILE);
    const index = products.findIndex(p => p.id === id);

    if (index === -1) return sendJSON(404, { error: 'Photo not found' });

    // A changed or cleared album moves the photo: its album key has to follow the name,
    // or the photo would stay filed under its old album
    const updates = { ...body };
    if ('name' in body) updates.name = cleanTitle(body.name);
    if ('category' in body) Object.assign(updates, await resolveAlbum(body.category));

    products[index] = {
      ...products[index],
      ...updates,
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
    if (!(await verifyAuthToken(req))) return sendJSON(401, { error: 'Authentication required' });

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
    if (!(await verifyAuthToken(req))) return sendJSON(401, { error: 'Authentication required' });

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
