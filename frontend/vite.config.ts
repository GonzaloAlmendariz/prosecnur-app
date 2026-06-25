import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const basePath = process.env.VITE_BASE_PATH || "/";
const basePathWithLeadingSlash =
  basePath === "./" || /^(https?:)?\/\//.test(basePath) || basePath.startsWith("/")
    ? basePath
    : `/${basePath}`;
const normalizedBasePath = basePathWithLeadingSlash.endsWith("/")
  ? basePathWithLeadingSlash
  : `${basePathWithLeadingSlash}/`;
const lucideReactAlias = path.resolve(__dirname, "src/vendor/lucide-react.ts");
const isFastBuild =
  process.env.npm_lifecycle_event === "build:fast" ||
  process.env.VITE_PULSO_FAST_BUILD === "1";
const traceBuild = process.env.VITE_PULSO_TRACE_BUILD === "1";
const monitoreoPageSource = path.resolve(__dirname, "src/features/monitoreo/MonitoreoPage.tsx");
const monitoreoPageVirtual = "\0virtual:monitoreo-page";

const isPublicMode = process.env.VITE_PULSO_PUBLIC_MODE === "true";
const devPort = Number(process.env.VITE_DEV_PORT || "5173");
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ||
  `http://127.0.0.1:${process.env.PULSO_PORT || "8787"}`;

function manualChunks(id: string) {
  const normalized = id.split(path.sep).join("/");
  if (normalized.includes("/src/api/client.ts")) return "api-client";
  if (
    normalized.includes("/src/vendor/lucide-react.ts") ||
    normalized.includes("/node_modules/lucide-react/")
  ) {
    return "vendor-lucide";
  }
  if (normalized.includes("/src/lib/icons.ts") || normalized.includes("/src/lib/modules.ts")) return "app-core";
  if (normalized.includes("/node_modules/plotly.js-dist-min/")) return "vendor-plotly";
  if (normalized.includes("/node_modules/@tanstack/react-table/") || normalized.includes("/node_modules/@tanstack/react-virtual/")) {
    return "vendor-tables";
  }
  if (
    normalized.includes("/node_modules/@radix-ui/") ||
    normalized.includes("/node_modules/@floating-ui/") ||
    normalized.includes("/node_modules/motion/")
  ) {
    return "vendor-interactions";
  }
  if (normalized.includes("/node_modules/react/") || normalized.includes("/node_modules/react-dom/") || normalized.includes("/node_modules/react-router-dom/")) {
    return "vendor-react";
  }
  if (normalized.includes("/src/features/monitoreo/MonitoreoShell.")) return "monitoreo-shell";
  if (normalized.includes("/src/features/monitoreo/core/") || normalized.includes("/src/features/monitoreo/shell/")) return "monitoreo-core";
  if (
    normalized.includes("/src/features/monitoreo/profiles/territorial/") ||
    normalized.includes("/src/features/monitoreo/territorial/")
  ) {
    return "monitoreo-territorial";
  }
  if (normalized.includes("/src/features/monitoreo/profiles/acreditacion/")) return "monitoreo-acreditacion";
  if (normalized.includes("/src/features/monitoreo/profiles/aulas/")) return "monitoreo-aulas";
  if (normalized.endsWith("/src/features/hojasRuta/limaDistrictCoverage.json")) return "maps-geometria";
  return undefined;
}

// En modo público (deploy web a HF/Fly), inyectamos `noindex,nofollow`
// para que crawlers no listen el dashboard. Es la única defensa de
// privacidad-por-obscuridad (URL no compartida = no encontrada).
function injectPublicMetaTags(): Plugin {
  return {
    name: "pulso-public-meta",
    transformIndexHtml(html) {
      if (!isPublicMode) return html;
      return html.replace(
        "<meta charset=\"UTF-8\" />",
        '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex, nofollow" />\n    <meta name="referrer" content="no-referrer" />',
      );
    },
  };
}

function virtualMonitoreoPage(): Plugin {
  return {
    name: "pulso-virtual-monitoreo-page",
    enforce: "pre",
    async resolveId(source, importer) {
      if (source === "virtual:monitoreo-page") return monitoreoPageVirtual;
      if (importer === monitoreoPageVirtual && (source.startsWith("./") || source.startsWith("../"))) {
        return this.resolve(path.resolve(path.dirname(monitoreoPageSource), source), undefined, { skipSelf: true });
      }
      return null;
    },
    load(id) {
      if (id !== monitoreoPageVirtual) return null;
      this.addWatchFile(monitoreoPageSource);
      const source = fs.readFileSync(monitoreoPageSource, "utf8");
      const result = ts.transpileModule(source, {
        fileName: monitoreoPageSource,
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          esModuleInterop: true,
          sourceMap: false,
        },
        reportDiagnostics: false,
      });
      return {
        code: result.outputText,
        map: null,
      };
    },
  };
}

function traceBuildModules(): Plugin {
  let count = 0;
  return {
    name: "pulso-trace-build-modules",
    enforce: "pre",
    async transform(_code, id) {
      count += 1;
      const normalized = id.split(path.sep).join("/");
      if (normalized.includes("/src/features/monitoreo/MonitoreoPage.compiled.js")) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (traceBuild) {
        if (
          count % 50 === 0 ||
          normalized.includes("/src/features/monitoreo/") ||
          normalized.includes("/src/app/")
        ) {
          console.error(`[pulso-trace-build] ${count} ${normalized}`);
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    traceBuildModules(),
    virtualMonitoreoPage(),
    react({
      exclude: [/src\/features\/monitoreo\/MonitoreoPage\.tsx$/],
    }),
    injectPublicMetaTags(),
  ],
  base: normalizedBasePath,
  resolve: {
    alias: [
      {
        find: /^lucide-react$/,
        replacement: lucideReactAlias,
      },
    ],
  },
  build: {
    outDir: path.resolve(__dirname, "../api/inst/www"),
    emptyOutDir: true,
    minify: isFastBuild ? false : "esbuild",
    cssMinify: isFastBuild ? false : true,
    reportCompressedSize: !isFastBuild,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    port: devPort,
    strictPort: true,
    proxy: {
      "/api": apiProxyTarget,
    },
  },
});
