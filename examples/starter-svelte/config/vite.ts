import { env } from '@mantiq/core'

export default {
  devServerUrl: env('VITE_DEV_SERVER_URL', 'http://localhost:5173'),
  buildDir: 'build',
  publicDir: import.meta.dir + '/../public',
  manifest: '.vite/manifest.json',
  reactRefresh: false,
  rootElement: 'app',
  ssr: {
    entry: 'src/ssr.ts',
    bundle: 'bootstrap/ssr/ssr.js',
  },
}
