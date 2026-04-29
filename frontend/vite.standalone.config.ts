import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Build target standalone: todo en UN bundle único (sin code splitting).
// El bundle resultante se inlinea dentro del HTML que distribuimos al
// lector del dashboard exportado. Sin `inlineDynamicImports` los
// `lazy(() => import("..."))` quedarían rotos al cargar desde file://
// o un static host plano.
//
// Trade-off: el bundle pesa más (~7-10MB sin gzip vs 2MB+ chunks lazy
// del build principal) — pero es el costo de tener un único archivo
// distribuible. Solo aplica al .html exportado, no al dashboard que
// corre dentro de Electron.
//
// Output: `api/inst/standalone/` separado para no pisar el build
// normal de `api/inst/www/`.

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    // Forzar el modo standalone en runtime sin tener que detectar nada:
    // si este flag está, el cliente HTTP del bridge ya sabe que tiene
    // que ir al WebR runtime en vez de hacer fetch real.
    "import.meta.env.PULSO_STANDALONE_BUILD": JSON.stringify(true),
  },
  build: {
    outDir: path.resolve(__dirname, "../api/inst/standalone"),
    emptyOutDir: true,
    // Todo en un único chunk JS. Sin code splitting.
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
        entryFileNames: "standalone.js",
        chunkFileNames: "standalone-[hash].js",
        assetFileNames: "[name][extname]",
      },
    },
    // Sin chunk size warnings — sabemos que va a ser grande.
    chunkSizeWarningLimit: 20_000,
  },
});
