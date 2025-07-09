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
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          charts: ['recharts']
        }
      },
      onwarn(warning, warn) {
        // Suppress all warnings that might cause issues
        return;
      }
    },
    emptyOutDir: true,
    reportCompressedSize: false,
    // Completely disable terser to avoid any native dependencies
    minify: false
  },
  server: {
    strictPort: false,
    hmr: false
  },
  define: {
    'process.env.DISPLAY': '""',
    'process.env.XDG_RUNTIME_DIR': '""',
    'process.env.CI': '"true"',
    'process.env.NODE_ENV': '"production"',
    'process.env.HEADLESS': '"true"',
    'global': 'globalThis'
  },
  esbuild: {
    logOverride: { 
      'this-is-undefined-in-esm': 'silent',
      'commonjs-proxy': 'silent'
    },
    keepNames: false,
    minifyIdentifiers: false,
    minifySyntax: false,
    minifyWhitespace: false,
    // Disable all optimizations that might require native deps
    target: 'es2015'
  },
  logLevel: 'error',
  clearScreen: false,
  // Ensure no native dependencies are used
  resolve: {
    alias: {
      // Prevent any potential native module loading
    }
  }
});