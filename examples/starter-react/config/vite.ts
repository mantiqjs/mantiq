import { env } from '@mantiq/core'

export default {
  devServerUrl: env('VITE_DEV_SERVER_URL', 'http://localhost:5173'),
  buildDir: 'build',
  publicDir: import.meta.dir + '/../public',
  manifest: '.vite/manifest.json',
  reactRefresh: true,
  rootElement: 'app',
  ssr: {
    entry: 'src/ssr.tsx',
    bundle: 'bootstrap/ssr/ssr.js',
  },
}
