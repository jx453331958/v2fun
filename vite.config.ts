import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

let commitHash = process.env.COMMIT_HASH || ''
if (!commitHash) {
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    commitHash = 'dev'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3210',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3210',
        changeOrigin: true,
      },
      '/web': {
        target: 'http://localhost:3210',
        changeOrigin: true,
      },
    },
  },
})
