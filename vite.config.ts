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
        // Suppress warnings that might cause build to hang
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        if (warning.code === 'SOURCEMAP_ERROR') return;
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        if (warning.message.includes('Use of eval')) return;
        warn(warning);
      }
    },
    // Prevent build from hanging
    emptyOutDir: true,
    reportCompressedSize: false,
    // Reduce memory usage
    terserOptions: undefined
  },
  server: {
    strictPort: false,
    hmr: false
  },
  define: {
    'process.env.DISPLAY': '""',
    'process.env.XDG_RUNTIME_DIR': '""',
    'process.env.CI': '"true"',
    'process.env.NODE_ENV': '"production"'
  },
  esbuild: {
    logOverride: { 
      'this-is-undefined-in-esm': 'silent',
      'commonjs-proxy': 'silent'
    },
    // Prevent esbuild from hanging
    keepNames: false,
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true
  },
  // Add timeout and memory limits
  logLevel: 'error',
  clearScreen: false
});