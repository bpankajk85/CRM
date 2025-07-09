import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['react', 'react-dom']
  },
  build: {
    // Disable any GUI-related features during build
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          charts: ['recharts']
        }
      }
    },
    // Reduce memory usage during build
    rollupOptions: {
      ...this.rollupOptions,
      onwarn(warning, warn) {
        // Suppress certain warnings that might cause issues
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        if (warning.code === 'SOURCEMAP_ERROR') return;
        warn(warning);
      }
    }
  },
  // Disable any development server features that might require GUI
  server: {
    strictPort: false,
    hmr: false
  },
  // Ensure no GUI dependencies are loaded
  define: {
    'process.env.DISPLAY': '""',
    'process.env.XDG_RUNTIME_DIR': '""',
    'process.env.CI': '"true"',
    'process.env.NODE_ENV': '"production"'
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
});