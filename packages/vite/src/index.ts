// @mantiq/vite — public API exports

// ── Contracts ────────────────────────────────────────────────────────────────
export type {
  ViteConfig,
  ViteManifest,
  ManifestChunk,
  PageOptions,
  SSRResult,
  SSRModule,
  RenderOptions,
} from './contracts/Vite.ts'

// ── Errors ───────────────────────────────────────────────────────────────────
export {
  ViteManifestNotFoundError,
  ViteEntrypointNotFoundError,
  ViteSSRBundleNotFoundError,
  ViteSSREntryError,
} from './errors/ViteError.ts'

// ── Main Class ───────────────────────────────────────────────────────────────
export { Vite, escapeHtml } from './Vite.ts'

// ── Service Provider ─────────────────────────────────────────────────────────
export { ViteServiceProvider, VITE } from './ViteServiceProvider.ts'

// ── Middleware ────────────────────────────────────────────────────────────────
export { ServeStaticFiles } from './middleware/ServeStaticFiles.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────
export { vite } from './helpers/vite.ts'

// ── Vite Plugins ─────────────────────────────────────────────────────────────
export { mantiq } from './plugins/mantiq.ts'
