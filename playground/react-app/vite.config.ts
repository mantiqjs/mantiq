import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { writeFileSync, unlinkSync } from 'node:fs'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Write public/hot so the backend knows the dev server is running
    {
      name: 'mantiq-hot',
      configureServer(server) {
        const hotPath = path.resolve(__dirname, 'public/hot')
        server.httpServer?.once('listening', () => {
          const addr = server.httpServer!.address()
          const url = typeof addr === 'string' ? addr : `http://localhost:${addr?.port}`
          writeFileSync(hotPath, url)
        })
        const cleanup = () => { try { unlinkSync(hotPath) } catch {} }
        process.on('exit', cleanup)
        process.on('SIGINT', () => { cleanup(); process.exit() })
        process.on('SIGTERM', () => { cleanup(); process.exit() })
      },
    },
  ],
  publicDir: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'public/build',
    manifest: true,
    emptyOutDir: true,
    rolldownOptions: {
      input: ['src/main.tsx', 'src/style.css'],
    },
  },
})
