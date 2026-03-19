import { MantiqError } from '@mantiq/core'

/** Thrown when the Vite manifest file cannot be found (forgot to run `vite build`). */
export class ViteManifestNotFoundError extends MantiqError {
  constructor(manifestPath: string) {
    super(
      `Vite manifest not found at "${manifestPath}". Did you run "vite build"?`,
      { manifestPath },
    )
  }
}

/** Thrown when a requested entrypoint is not present in the Vite manifest. */
export class ViteEntrypointNotFoundError extends MantiqError {
  constructor(entrypoint: string, manifestPath: string) {
    super(
      `Entrypoint "${entrypoint}" not found in Vite manifest at "${manifestPath}".`,
      { entrypoint, manifestPath },
    )
  }
}

/** Thrown when the SSR bundle cannot be found in production. */
export class ViteSSRBundleNotFoundError extends MantiqError {
  constructor(bundlePath: string) {
    super(
      `SSR bundle not found at "${bundlePath}". Did you run "vite build --ssr"?`,
      { bundlePath },
    )
  }
}

/** Thrown when the SSR module does not export a valid render() function. */
export class ViteSSREntryError extends MantiqError {
  constructor(entry: string, reason: string) {
    super(
      `SSR entry "${entry}" is invalid: ${reason}`,
      { entry, reason },
    )
  }
}
