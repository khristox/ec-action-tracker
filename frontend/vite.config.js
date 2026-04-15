import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load env files based on mode (development/production)
  const env = loadEnv(mode, __dirname, '');
  
  // Determine base URL based on environment
  // For production: use VITE_BASE_URL from .env.production or default to '/ec/'
  // For development: use '/'
  const base = mode === 'production' 
    ? (env.VITE_BASE_URL || '/ec/')  // Production subfolder
    : '/';  // Development always uses root
  
  console.log(`Building for ${mode} mode with base: ${base}`);
  
  return {
    base: base,  // Use dynamic base
    
    plugins: [react()],
    
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8001',
          changeOrigin: true,
        },
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
  };
});