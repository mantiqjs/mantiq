import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/errors/ViteError.ts
import { MantiqError } from "@mantiq/core";

class ViteManifestNotFoundError extends MantiqError {
  constructor(manifestPath) {
    super(`Vite manifest not found at "${manifestPath}". Did you run "vite build"?`, { manifestPath });
  }
}

class ViteEntrypointNotFoundError extends MantiqError {
  constructor(entrypoint, manifestPath) {
    super(`Entrypoint "${entrypoint}" not found in Vite manifest at "${manifestPath}".`, { entrypoint, manifestPath });
  }
}

class ViteSSRBundleNotFoundError extends MantiqError {
  constructor(bundlePath) {
    super(`SSR bundle not found at "${bundlePath}". Did you run "vite build --ssr"?`, { bundlePath });
  }
}

class ViteSSREntryError extends MantiqError {
  constructor(entry, reason) {
    super(`SSR entry "${entry}" is invalid: ${reason}`, { entry, reason });
  }
}
// src/Vite.ts
class Vite {
  config;
  manifestCache = null;
  hotFileCache = null;
  ssrEntry;
  ssrBundle;
  ssrModuleCache = null;
  basePath = "";
  constructor(config = {}) {
    this.config = {
      devServerUrl: config.devServerUrl ?? "http://localhost:5173",
      buildDir: config.buildDir ?? "build",
      publicDir: config.publicDir ?? "public",
      manifest: config.manifest ?? ".vite/manifest.json",
      reactRefresh: config.reactRefresh ?? false,
      rootElement: config.rootElement ?? "app",
      hotFile: config.hotFile ?? "hot",
      ...config.ssr ? { ssr: config.ssr } : {}
    };
    this.ssrEntry = config.ssr?.entry ?? null;
    this.ssrBundle = config.ssr?.bundle ?? "bootstrap/ssr/ssr.js";
  }
  async initialize() {
    await this.refreshHotFile();
  }
  async refreshHotFile() {
    const hotPath = this.hotFilePath();
    const file = Bun.file(hotPath);
    if (await file.exists()) {
      const url = (await file.text()).trim();
      this.hotFileCache = url || this.config.devServerUrl;
    } else {
      this.hotFileCache = false;
    }
  }
  isDev() {
    return typeof this.hotFileCache === "string";
  }
  async recheckDev() {
    await this.refreshHotFile();
    return this.isDev();
  }
  devServerUrl() {
    return typeof this.hotFileCache === "string" ? this.hotFileCache : this.config.devServerUrl;
  }
  async assets(entrypoints) {
    const entries = Array.isArray(entrypoints) ? entrypoints : [entrypoints];
    if (!this.isDev())
      await this.recheckDev();
    if (this.isDev()) {
      return this.devAssets(entries);
    }
    return this.prodAssets(entries);
  }
  devAssets(entries) {
    const url = this.devServerUrl();
    const tags = [];
    if (this.config.reactRefresh) {
      tags.push(this.reactRefreshTag());
    }
    tags.push(`<script type="module" src="${url}/@vite/client"></script>`);
    for (const entry of entries) {
      if (entry.endsWith(".css")) {
        tags.push(`<link rel="stylesheet" href="${url}/${entry}">`);
      } else {
        tags.push(`<script type="module" src="${url}/${entry}"></script>`);
      }
    }
    return tags.join(`
    `);
  }
  async prodAssets(entries) {
    const manifest = await this.loadManifest();
    const tags = [];
    const cssEmitted = new Set;
    const preloadedPaths = new Set;
    for (const entry of entries) {
      const chunk = manifest[entry];
      if (!chunk) {
        throw new ViteEntrypointNotFoundError(entry, this.manifestPath());
      }
      const allCss = this.collectCss(manifest, entry, new Set);
      for (const cssPath of allCss) {
        if (!cssEmitted.has(cssPath)) {
          cssEmitted.add(cssPath);
          tags.push(`<link rel="stylesheet" href="/${this.config.buildDir}/${cssPath}">`);
        }
      }
      const preloads = this.collectPreloads(manifest, entry, new Set);
      for (const preloadPath of preloads) {
        if (!preloadedPaths.has(preloadPath) && preloadPath !== chunk.file) {
          preloadedPaths.add(preloadPath);
          tags.push(`<link rel="modulepreload" href="/${this.config.buildDir}/${preloadPath}">`);
        }
      }
      if (entry.endsWith(".css")) {
        if (!cssEmitted.has(chunk.file)) {
          cssEmitted.add(chunk.file);
          tags.push(`<link rel="stylesheet" href="/${this.config.buildDir}/${chunk.file}">`);
        }
      } else {
        tags.push(`<script type="module" src="/${this.config.buildDir}/${chunk.file}"></script>`);
      }
    }
    return tags.join(`
    `);
  }
  collectCss(manifest, key, visited) {
    if (visited.has(key))
      return [];
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk)
      return [];
    const css = [...chunk.css ?? []];
    for (const imp of chunk.imports ?? []) {
      css.push(...this.collectCss(manifest, imp, visited));
    }
    return css;
  }
  collectPreloads(manifest, key, visited) {
    if (visited.has(key))
      return [];
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk)
      return [];
    const preloads = [];
    for (const imp of chunk.imports ?? []) {
      const importedChunk = manifest[imp];
      if (importedChunk) {
        preloads.push(importedChunk.file);
        preloads.push(...this.collectPreloads(manifest, imp, visited));
      }
    }
    return preloads;
  }
  async loadManifest() {
    if (this.manifestCache)
      return this.manifestCache;
    const path = this.manifestPath();
    const file = Bun.file(path);
    if (!await file.exists()) {
      if (await this.recheckDev()) {
        return {};
      }
      throw new ViteManifestNotFoundError(path);
    }
    this.manifestCache = await file.json();
    return this.manifestCache;
  }
  flushManifest() {
    this.manifestCache = null;
  }
  resolvePublicDir() {
    const pub = this.config.publicDir;
    if (pub.startsWith("/"))
      return pub;
    return this.basePath ? `${this.basePath}/${pub}` : pub;
  }
  manifestPath() {
    return `${this.resolvePublicDir()}/${this.config.buildDir}/${this.config.manifest}`;
  }
  hotFilePath() {
    return `${this.resolvePublicDir()}/${this.config.hotFile}`;
  }
  isSSR() {
    return this.ssrEntry !== null;
  }
  setBasePath(path) {
    this.basePath = path;
  }
  async render(request, options) {
    const url = request.path();
    const pageData = { _page: options.page, _url: url, ...options.data ?? {} };
    if (request.header("X-Mantiq") === "true") {
      return new Response(JSON.stringify(pageData), {
        headers: { "Content-Type": "application/json", "X-Mantiq": "true" }
      });
    }
    const html = await this.page({
      entry: options.entry,
      title: options.title ?? "",
      head: options.head ?? "",
      data: pageData,
      url,
      page: options.page
    });
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
  async loadSSRModule() {
    if (this.ssrModuleCache)
      return this.ssrModuleCache;
    if (!this.ssrEntry) {
      throw new ViteSSREntryError("(none)", "SSR is not configured. Set ssr.entry in your vite config.");
    }
    let mod;
    if (this.isDev()) {
      const entryPath = this.basePath ? `${this.basePath}/${this.ssrEntry}` : this.ssrEntry;
      mod = await import(entryPath);
    } else {
      const bundlePath = this.basePath ? `${this.basePath}/${this.ssrBundle}` : this.ssrBundle;
      const file = Bun.file(bundlePath);
      if (!await file.exists()) {
        throw new ViteSSRBundleNotFoundError(bundlePath);
      }
      mod = await import(bundlePath);
    }
    if (typeof mod.render !== "function") {
      throw new ViteSSREntryError(this.ssrEntry, "Module does not export a render() function.");
    }
    if (!this.isDev()) {
      this.ssrModuleCache = mod;
    }
    return mod;
  }
  async renderSSR(url, data) {
    const ssrModule = await this.loadSSRModule();
    return await ssrModule.render(url, data);
  }
  async page(options) {
    const {
      entry,
      title = "",
      data,
      rootElement = this.config.rootElement,
      head = "",
      url
    } = options;
    const assetTags = await this.assets(entry);
    const dataScript = data ? `
    <script>window.__MANTIQ_DATA__ = ${JSON.stringify(data)}</script>` : "";
    let ssrHtml = "";
    let ssrHead = "";
    if (this.isSSR() && url) {
      try {
        const result = await this.renderSSR(url, data);
        ssrHtml = result.html ?? "";
        ssrHead = result.head ?? "";
      } catch {
        ssrHtml = "";
        ssrHead = "";
      }
    }
    const headContent = [head, ssrHead].filter(Boolean).join(`
    `);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    ${headContent}
    ${assetTags}
</head>
<body>
    <div id="${escapeHtml(rootElement)}">${ssrHtml}</div>${dataScript}
</body>
</html>`;
  }
  reactRefreshTag() {
    const url = this.devServerUrl();
    return `<script type="module">
      import RefreshRuntime from '${url}/@react-refresh'
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>`;
  }
  setManifest(manifest) {
    this.manifestCache = manifest;
  }
  setDevMode(url) {
    this.hotFileCache = url;
  }
  setSSRModule(mod) {
    this.ssrModuleCache = mod;
  }
  getConfig() {
    return this.config;
  }
  getBasePath() {
    return this.basePath;
  }
}
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// src/ViteServiceProvider.ts
import { ServiceProvider, ConfigRepository, HttpKernel } from "@mantiq/core";

// src/middleware/ServeStaticFiles.ts
import path from "node:path";

class ServeStaticFiles {
  vite;
  publicDir = null;
  constructor(vite) {
    this.vite = vite;
  }
  setParameters(params) {
    if (params[0])
      this.publicDir = params[0];
  }
  getPublicDir() {
    if (this.publicDir)
      return this.publicDir;
    if (this.vite) {
      const publicDir = this.vite.getConfig().publicDir;
      const basePath = this.vite.getBasePath();
      if (basePath && !publicDir.startsWith("/")) {
        return `${basePath}/${publicDir}`;
      }
      return publicDir;
    }
    return "public";
  }
  async handle(request, next) {
    const method = request.method();
    if (method !== "GET" && method !== "HEAD") {
      return next();
    }
    const urlPath = request.path();
    if (urlPath === "/hot") {
      return next();
    }
    const publicDir = path.resolve(this.getPublicDir());
    const filePath = path.resolve(publicDir, "." + urlPath);
    if (!filePath.startsWith(publicDir + path.sep) && filePath !== publicDir) {
      return next();
    }
    const file = Bun.file(filePath);
    if (await file.exists()) {
      if (file.size === 0 && !urlPath.includes(".")) {
        return next();
      }
      return new Response(file, {
        headers: {
          "Content-Type": file.type,
          "Content-Length": String(file.size),
          "Cache-Control": "no-cache"
        }
      });
    }
    return next();
  }
}

// src/ViteServiceProvider.ts
var VITE = Symbol("Vite");

class ViteServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton(Vite, (c) => {
      let viteConfig = {};
      try {
        viteConfig = c.make(ConfigRepository).get("vite") ?? {};
      } catch {}
      return new Vite(viteConfig);
    });
    this.app.alias(Vite, VITE);
    this.app.bind(ServeStaticFiles, (c) => new ServeStaticFiles(c.make(Vite)));
  }
  async boot() {
    const vite = this.app.make(Vite);
    try {
      const config = this.app.make(ConfigRepository);
      const basePath = config.get("app.basePath");
      if (basePath)
        vite.setBasePath(basePath);
    } catch {
      if (process.env.APP_DEBUG === "true") {
        console.warn("[Mantiq] ViteServiceProvider: ConfigRepository not available, basePath not set");
      }
    }
    await vite.initialize();
    try {
      const kernel = this.app.make(HttpKernel);
      kernel.registerMiddleware("static", ServeStaticFiles);
      kernel.prependGlobalMiddleware("static");
    } catch {
      if (process.env.APP_DEBUG === "true") {
        console.warn("[Mantiq] ViteServiceProvider: HttpKernel not available, static middleware not registered");
      }
    }
  }
}
// src/helpers/vite.ts
import { Application } from "@mantiq/core";
function vite() {
  return Application.getInstance().make(Vite);
}
// src/plugins/mantiq.ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
async function mantiq() {
  const plugins = [];
  const cwd = process.cwd();
  try {
    const studioPkg = resolve(cwd, "node_modules", "@mantiq", "studio", "package.json");
    if (existsSync(studioPkg)) {
      const studioDir = resolve(cwd, "app", "Studio");
      if (existsSync(studioDir)) {
        const panelPath = await discoverPanelPath(studioDir);
        const { studioPlugin } = await import("@mantiq/studio/vite");
        const plugin = studioPlugin({ path: panelPath });
        plugins.push(plugin);
      }
    }
  } catch {}
  return plugins;
}
async function discoverPanelPath(studioDir) {
  try {
    const { Glob } = await import("bun");
    const glob = new Glob("**/*Panel.ts");
    for await (const file of glob.scan(studioDir)) {
      const content = await Bun.file(resolve(studioDir, file)).text();
      const match = content.match(/path\s*=\s*['"]([^'"]+)['"]/);
      if (match)
        return match[1];
    }
  } catch {}
  return "/admin";
}
export {
  vite,
  mantiq,
  escapeHtml,
  ViteServiceProvider,
  ViteSSREntryError,
  ViteSSRBundleNotFoundError,
  ViteManifestNotFoundError,
  ViteEntrypointNotFoundError,
  Vite,
  VITE,
  ServeStaticFiles
};
