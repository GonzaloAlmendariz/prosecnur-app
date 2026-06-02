import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const basePath = process.env.VITE_BASE_PATH || "/";
const basePathWithLeadingSlash =
  basePath === "./" || /^(https?:)?\/\//.test(basePath) || basePath.startsWith("/")
    ? basePath
    : `/${basePath}`;
const normalizedBasePath = basePathWithLeadingSlash.endsWith("/")
  ? basePathWithLeadingSlash
  : `${basePathWithLeadingSlash}/`;

const isPublicMode = process.env.VITE_PULSO_PUBLIC_MODE === "true";
const devPort = Number(process.env.VITE_DEV_PORT || "5173");
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ||
  `http://127.0.0.1:${process.env.PULSO_PORT || "8787"}`;

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

export default defineConfig({
  plugins: [react(), injectPublicMetaTags()],
  base: normalizedBasePath,
  build: {
    outDir: path.resolve(__dirname, "../api/inst/www"),
    emptyOutDir: true,
  },
  server: {
    port: devPort,
    proxy: {
      "/api": apiProxyTarget,
    },
  },
});
