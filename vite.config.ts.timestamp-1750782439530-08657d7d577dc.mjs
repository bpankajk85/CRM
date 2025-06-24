// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  build: {
    // Disable any GUI-related features during build
    rollupOptions: {
      external: []
    },
    // Ensure build runs in headless mode
    minify: "terser",
    target: "es2015",
    // Disable source maps in production to reduce build complexity
    sourcemap: false
  },
  // Disable any development server features that might require GUI
  server: {
    strictPort: false
  },
  // Ensure no GUI dependencies are loaded
  define: {
    "process.env.DISPLAY": '""',
    "process.env.XDG_RUNTIME_DIR": '""'
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgLy8gRGlzYWJsZSBhbnkgR1VJLXJlbGF0ZWQgZmVhdHVyZXMgZHVyaW5nIGJ1aWxkXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFtdLFxuICAgIH0sXG4gICAgLy8gRW5zdXJlIGJ1aWxkIHJ1bnMgaW4gaGVhZGxlc3MgbW9kZVxuICAgIG1pbmlmeTogJ3RlcnNlcicsXG4gICAgdGFyZ2V0OiAnZXMyMDE1JyxcbiAgICAvLyBEaXNhYmxlIHNvdXJjZSBtYXBzIGluIHByb2R1Y3Rpb24gdG8gcmVkdWNlIGJ1aWxkIGNvbXBsZXhpdHlcbiAgICBzb3VyY2VtYXA6IGZhbHNlLFxuICB9LFxuICAvLyBEaXNhYmxlIGFueSBkZXZlbG9wbWVudCBzZXJ2ZXIgZmVhdHVyZXMgdGhhdCBtaWdodCByZXF1aXJlIEdVSVxuICBzZXJ2ZXI6IHtcbiAgICBzdHJpY3RQb3J0OiBmYWxzZSxcbiAgfSxcbiAgLy8gRW5zdXJlIG5vIEdVSSBkZXBlbmRlbmNpZXMgYXJlIGxvYWRlZFxuICBkZWZpbmU6IHtcbiAgICAncHJvY2Vzcy5lbnYuRElTUExBWSc6ICdcIlwiJyxcbiAgICAncHJvY2Vzcy5lbnYuWERHX1JVTlRJTUVfRElSJzogJ1wiXCInLFxuICB9LFxufSk7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFHbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxjQUFjO0FBQUEsRUFDMUI7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBLElBRUwsZUFBZTtBQUFBLE1BQ2IsVUFBVSxDQUFDO0FBQUEsSUFDYjtBQUFBO0FBQUEsSUFFQSxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUE7QUFBQSxJQUVSLFdBQVc7QUFBQSxFQUNiO0FBQUE7QUFBQSxFQUVBLFFBQVE7QUFBQSxJQUNOLFlBQVk7QUFBQSxFQUNkO0FBQUE7QUFBQSxFQUVBLFFBQVE7QUFBQSxJQUNOLHVCQUF1QjtBQUFBLElBQ3ZCLCtCQUErQjtBQUFBLEVBQ2pDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
