import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './backend-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    host: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin.html')
      }
    }
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
    },
    (() => {
      // Photos added on this computer are files in uploads/ (their image paths start with
      // "uploads/"), so the build copies that folder into the site. Without it they 404 live.
      let outDir = '';
      return {
        name: 'copy-uploads',
        apply: 'build',
        configResolved(config) {
          outDir = path.resolve(config.root, config.build.outDir);
        },
        closeBundle() {
          const from = path.resolve(__dirname, 'uploads');
          if (fs.existsSync(from)) fs.cpSync(from, path.join(outDir, 'uploads'), { recursive: true });
        }
      };
    })()
  ]
});
