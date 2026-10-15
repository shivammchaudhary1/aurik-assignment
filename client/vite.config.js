import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The proxy lets this React client call the existing backend without adding
// another backend dependency or changing server CORS configuration.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/health': 'http://127.0.0.1:5000',
    },
  },
});
