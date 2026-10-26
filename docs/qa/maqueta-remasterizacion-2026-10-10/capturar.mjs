// Captura cada maqueta a 1440x1000 y guarda la miniatura del «después» en maqueta/despues/.
// Uso: node docs/qa/maqueta-remasterizacion-2026-10-10/capturar.mjs [--only L03]   (requiere el server en :8933)
import { createRequire } from "node:module";
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
const require = createRequire(path.resolve("frontend/package.json"));
const { chromium } = require("@playwright/test");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const dir = "docs/qa/maqueta-remasterizacion-2026-10-10/maqueta";
mkdirSync(`${dir}/despues`, { recursive: true });
const pages = readdirSync(`${dir}/m`).filter((f) => f.endsWith(".html") && (!only || f.startsWith(only)));
// En la nube no hay headless_shell propio: PW_CHROMIUM=/opt/pw-browsers/chromium (nunca `playwright install`).
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(`${page.url()}: ${e.message}`));
for (const f of pages) {
  await page.goto(`http://localhost:8933/m/${f}?v=${Date.now()}`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: ".mq-bar, .mq-hoy-overlay { display: none !important }" });
  await page.screenshot({ path: `${dir}/despues/${f.replace(".html", ".png")}` });
  console.log("ok", f);
}
await browser.close();
if (errores.length) { console.log("ERRORES JS:\n" + errores.join("\n")); process.exit(1); }
