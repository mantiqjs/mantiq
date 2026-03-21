import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  publicDir: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '$lib': path.resolve(__dirname, './src/lib'),
    },
  },
  build: {
    outDir: 'public/build',
    manifest: true,
    emptyOutDir: true,
    rollupOptions: {
      input: ['src/main.ts', 'src/style.css'],
    },
  },
})
