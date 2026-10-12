import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { handleApiRequest } from './backend-api.js';

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    host: true
  },
  plugins: [
    {
      name: 'local-backend-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Check API endpoints
          if (req.url && req.url.startsWith('/api/')) {
            try {
              const handled = await handleApiRequest(req, res);
              if (handled) return;
            } catch (err) {
              console.error('API Error in Vite middleware:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Internal API Server Error' }));
              return;
            }
          }

          // Serve uploaded files directly from uploads/
          if (req.url && req.url.startsWith('/uploads/')) {
            const cleanPath = req.url.split('?')[0].replace(/^\//, '');
            const filePath = path.join(process.cwd(), cleanPath);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath).toLowerCase();
              const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
              res.setHeader('Content-Type', mime);
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }

          // Rewrite /admin to /admin.html
          if (req.url === '/admin' || req.url === '/admin/') {
            req.url = '/admin.html';
          }

          next();
        });
      }
    }
  ]
});
