// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configuración de alto rendimiento para Santos Web (Limpia y sin advertencias)
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) requiere manualChunks como función
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('framer-motion') || id.includes('canvas-confetti')) return 'animations';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor';
        },
      },
    },
  },
})