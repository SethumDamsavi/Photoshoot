import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/wp-json': {
        target: 'http://localhost:10004',
        changeOrigin: true,
      },
      '/wp-content': {
        target: 'http://localhost:10004',
        changeOrigin: true,
      }
    }
  }
});
