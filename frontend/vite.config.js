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
      sourcemap: 'hidden',
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules')) {
              return;
            }

            // React core and routing
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react-router/') ||
              id.includes('/node_modules/react-router-dom/')
            ) {
              return 'react-vendor';
            }

            // Redux
            if (
              id.includes('/node_modules/@reduxjs/') ||
              id.includes('/node_modules/react-redux/')
            ) {
              return 'redux-vendor';
            }

            // MUI and Emotion
            if (
              id.includes('/node_modules/@mui/') ||
              id.includes('/node_modules/@emotion/')
            ) {
              return 'mui-vendor';
            }

            // Networking / notifications
            if (
              id.includes('/node_modules/axios/') ||
              id.includes('/node_modules/notistack/')
            ) {
              return 'utils-vendor';
            }

            // Everything else
            //return 'vendor';
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