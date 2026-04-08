import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({

  base: './',
  
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // For Rolldown, use different configuration
    rollupOptions: {
      output: {
        // Rolldown uses a different API for manual chunks
        manualChunks(id) {
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