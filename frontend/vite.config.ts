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

const isPublicMode = process.env.VITE_PULSO_PUBLIC_MODE === "true";
const devPort = Number(process.env.VITE_DEV_PORT || process.env.PORT || "5173");
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ||
  `http://127.0.0.1:${process.env.PULSO_PORT || "8787"}`;

// Módulos de src/components y src/lib acoplados POR VALOR a src/api o a stores
// de features. NO pueden viajar en app-core: app-core es dependencia estática
// del entry (BootGate importa RecentProjectCard, modules y navegacion), así que
// meterlos ahí (a) reintroduciría api-client en el arranque estático — justo lo
// que la regla de bootClient elimina — y (b) cerraría el ciclo de chunks
// app-core ↔ api-client (api/analitica.ts y api/monitoreo.ts importan
// lib/repeatIdentity y lib/captureUrl por valor), la misma clase de TDZ que ya
// dejó la app en blanco dos veces. Quedan sin asignar: Rollup los coloca fuera
// de la ruta estática del entry, como hasta ahora.
const APP_CORE_VALUE_COUPLED_EXCLUDED = [
  "/src/components/ChromeBaseSelector.tsx", // apiEstudio* por valor + baseScopeModel
  "/src/components/JobProgress.tsx", // hooks/useJob → apiJobStatus por valor
  "/src/lib/SessionContext.tsx", // apiSession* por valor
  "/src/lib/useStoreResetOnSessionChange.ts", // stores de dashboard/graficos → api/client
];

function manualChunks(id: string) {
  const normalized = id.split(path.sep).join("/");
  // El helper de preload de Vite es un módulo virtual (`\0vite/preload-helper`)
  // compartido por TODOS los chunks con import() dinámico. Sin regla, Rollup lo
  // colocó dentro de monitoreo-core y el entry (que usa import() para AppSuite)
  // arrastraba monitoreo-core JS+CSS al arranque estático de index.html.
  if (normalized.includes("vite/preload-helper")) return "app-core";
  // bootClient.ts es autocontenido (cero imports) y es lo único de src/api que
  // BootGate necesita en el arranque; si cae en api-client arrastra todo
  // src/api (~34 KB gz) al entry. Debe evaluarse ANTES del patrón /src/api/.
  if (normalized.includes("/src/api/bootClient.ts")) return "app-core";
  if (normalized.includes("/src/api/")) return "api-client";
  if (
    normalized.includes("/src/vendor/lucide-react.ts") ||
    normalized.includes("/node_modules/lucide-react/")
  ) {
    return "vendor-lucide";
  }
  // Primitivas compartidas (src/components) y lib base viajan juntas en
  // app-core: repartidas por placement de Rollup terminaban dentro de
  // monitoreo-core y 29 chunks lo importaban de vuelta. Además `lib/navegacion/`
  // viaja con `modules.ts` a propósito: es su contrato, no una feature.
  // Repartido entre chunks de módulo, Rollup llegó a ejecutar `manifiesto.ts`
  // (que arma MANIFIESTO_NAVEGACION en top-level) antes de que `direccion.ts`
  // inicializara TABLA_RUTAS, y el TDZ dejaba la app en blanco sin montar React.
  if (normalized.includes("/src/components/") || normalized.includes("/src/lib/")) {
    if (APP_CORE_VALUE_COUPLED_EXCLUDED.some((suffix) => normalized.endsWith(suffix))) {
      return undefined;
    }
    return "app-core";
  }
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
  // `MonitoreoShell` NO se separa: son ~4 kB que el núcleo importa de vuelta,
  // así que el chunk propio no ahorraba nada y cerraba un segundo ciclo
  // (monitoreo-core ↔ monitoreo-shell) de la misma clase que dejó la app en
  // blanco. Cae en el catch-all de monitoreo y viaja con su núcleo.
  if (
    normalized.includes("/src/features/monitoreo/components/") ||
    normalized.includes("/src/features/monitoreo/core/") ||
    normalized.includes("/src/features/monitoreo/salidas/") ||
    normalized.includes("/src/features/monitoreo/shell/")
  ) return "monitoreo-core";
  if (
    normalized.includes("/src/features/monitoreo/profiles/territorial/") ||
    normalized.includes("/src/features/monitoreo/territorial/")
  ) {
    return "monitoreo-territorial";
  }
  if (normalized.includes("/src/features/monitoreo/profiles/telefonico/")) return "monitoreo-telefonico";
  if (normalized.includes("/src/features/monitoreo/profiles/acreditacion/")) return "monitoreo-acreditacion";
  if (normalized.includes("/src/features/monitoreo/profiles/aulas/")) return "monitoreo-aulas";
  // Todo lo demás de monitoreo (`corte/`, `profiles/` compartido) es núcleo, no
  // perfil. Sin esta regla Rollup lo repartía al chunk de UN perfil, y como el
  // núcleo lo importa quedaba un ciclo monitoreo-core ↔ monitoreo-acreditacion:
  // al cargar, el perfil leía MONITOREO_MODOS antes de que el núcleo lo
  // inicializara y la app entera se quedaba en blanco. La dirección tiene que
  // ser siempre perfil → núcleo.
  if (normalized.includes("/src/features/monitoreo/")) return "monitoreo-core";
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


function traceBuildModules(): Plugin {
  let count = 0;
  return {
    name: "pulso-trace-build-modules",
    enforce: "pre",
    async transform(_code, id) {
      count += 1;
      const normalized = id.split(path.sep).join("/");
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
    react(),
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
