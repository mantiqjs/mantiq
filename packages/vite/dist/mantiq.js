import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

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
  mantiq
};
