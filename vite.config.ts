import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Disable any GUI-related features during build
    rollupOptions: {
      external: [],
    },
    // Ensure build runs in headless mode
    minify: 'terser',
    target: 'es2015',
    // Disable source maps in production to reduce build complexity
    sourcemap: false,
  },
  // Disable any development server features that might require GUI
  server: {
    strictPort: false,
  },
  // Ensure no GUI dependencies are loaded
  define: {
    'process.env.DISPLAY': '""',
    'process.env.XDG_RUNTIME_DIR': '""',
  },
});