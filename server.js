import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleApiRequest } from './backend-api.js';

const PORT = process.env.PORT || 5173;
const PUBLIC_DIR = process.cwd();
// Dotfiles and dot-folders, the data and dependency folders, and the server's own code
const PRIVATE_PATH = /(^|\/)\.|^\/(data|api|node_modules)(\/|$)|^\/(backend-api|server|vite\.config)\.js$|^\/package(-lock)?\.json$/i;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  // 1. Check if this is an API endpoint
  if (req.url.startsWith('/api/')) {
    const handled = await handleApiRequest(req, res);
    if (handled) return;
  }

  // 2. Handle /admin route rewrite to admin.html
  let pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (pathname === '/admin' || pathname === '/admin/') {
    pathname = '/admin.html';
  } else if (pathname === '/') {
    pathname = '/index.html';
  }

  // 3. Serve static file
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (_) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }
  const filePath = path.join(PUBLIC_DIR, decodedPath);

  // Security: prevent directory traversal, and never serve private or server-side files
  // (.env.local, .git, the data folder, the server code)
  const relativePath = '/' + path.relative(PUBLIC_DIR, filePath).split(path.sep).join('/');
  if (!filePath.startsWith(PUBLIC_DIR) || PRIVATE_PATH.test(relativePath)) {
    res.statusCode = 403;
    res.end('Access Denied');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback to index.html
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n✨ Server running at: http://localhost:${PORT}/`);
  console.log(`👑 Admin Dashboard at: http://localhost:${PORT}/admin`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('🔒 Admin sign-in: the account created on /admin (it asks for one while none exists), or ADMIN_USERNAME and ADMIN_PASSWORD in .env.local (see .env.example).\n');
  }
});
