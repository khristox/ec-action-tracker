import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Use absolute path for base (no leading dot)
  base: '/',
  
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy all API requests to backend
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        // Don't rewrite - keep the original path
        // The backend expects /api/v1/...
      },
      // Also proxy action-tracker endpoints
      '/action-tracker': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'mui-vendor';
            }
            if (id.includes('@reduxjs') || id.includes('react-redux')) {
              return 'redux-vendor';
            }
            if (id.includes('axios') || id.includes('notistack')) {
              return 'utils-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@store': '/src/store',
      '@api': '/src/api',
      '@utils': '/src/utils',
    },
  },
});