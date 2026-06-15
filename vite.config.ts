import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

const belongsToPackage = (id: string, pkg: string) =>
  id.includes(`/node_modules/${pkg}/`) || id.includes(`\\node_modules\\${pkg}\\`)

const isDocPreviewDependency = (id: string) =>
  [
    'mammoth',
    'jszip',
    '@xmldom/xmldom',
    'xmlbuilder',
    'dingbat-to-unicode',
    'base64-js',
    'lop',
    'path-is-absolute',
    'underscore',
    'bluebird',
  ].some((pkg) => belongsToPackage(id, pkg))

export default defineConfig({
  plugins: [// The React and Tailwind plugins are both required for Make, even if
  // Tailwind is not being actively used – do not remove them
  react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/media": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('recharts')) {
            return 'vendor-charts'
          }
          if (id.includes('sweetalert2')) {
            return 'vendor-alerts'
          }
          if (id.includes('@radix-ui')) {
            return 'vendor-radix'
          }
          if (id.includes('@mui') || id.includes('@emotion')) {
            return 'vendor-mui'
          }
          if (id.includes('react-router')) {
            return 'vendor-router'
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }
          if (isDocPreviewDependency(id)) {
            return 'vendor-doc-preview'
          }
          return 'vendor'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
  },
})