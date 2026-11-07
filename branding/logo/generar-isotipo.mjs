#!/usr/bin/env node
// Genera la suite del isotipo «Trenza, Cuerda abierta» (ADR 0132) desde su geometría única,
// frontend/src/app/marca/trenzaGeometria.ts (Node la carga sin compilar: TypeScript borrable).
//
//   node branding/logo/generar-isotipo.mjs            → SVG de branding/logo/ y de packaging/windows/brand/
//   node branding/logo/generar-isotipo.mjs --raster   → además icon.png, favicon.ico e icon.icns
//                                                       (requiere rsvg-convert, magick e iconutil)
//
// Los SVG de esta carpeta son GENERADOS: se cambia la geometría, no los archivos.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FUENTE, MODULOS, NAVY, NAVY_ALTO, RX, isotipo, trenza } from "./isotipo-svg.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../..");
const svg = (viewBox, defs, cuerpo, comentario) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n` +
  (comentario ? `  <!-- ${comentario} -->\n` : "") +
  `  <defs>${defs}</defs>\n  ${cuerpo}\n</svg>\n`;
const GENERADO = "Generado por branding/logo/generar-isotipo.mjs desde frontend/src/app/marca/trenzaGeometria.ts (ADR 0132). No editar a mano.";
const enCaja = (x, y, lado, contenido) => `<g transform="translate(${x} ${y}) scale(${lado / 100})">${contenido}</g>`;
const escribir = (rel, texto) => { const p = path.join(RAIZ, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, texto); console.log("  " + rel); };

/* ----------------------------------------------------------------- suite ------------------------------------------ */
const archivos = {};

{ const i = isotipo({ id: "pi" }); archivos["branding/logo/prosecnur-isotipo.svg"] = svg("0 0 100 100", i.defs, i.cuerpo, GENERADO); }
{ const i = isotipo({ id: "pig", gradiente: [NAVY_ALTO, NAVY] }); archivos["branding/logo/prosecnur-isotipo-gradiente.svg"] = svg("0 0 100 100", i.defs, i.cuerpo, GENERADO + " Sólo ícono de app e instalador."); }
{ const i = isotipo({ id: "pio", oscuro: true }); archivos["branding/logo/prosecnur-isotipo-oscuro.svg"] = svg("0 0 100 100", i.defs, i.cuerpo, GENERADO + " Para fondos oscuros."); }
{ const i = isotipo({ id: "pic", chica: true }); archivos["branding/logo/prosecnur-isotipo-chico.svg"] = svg("0 0 100 100", i.defs, i.cuerpo, GENERADO + " Variante de cinco hilos para 32 px o menos."); }
{
  const i = isotipo({ id: "app", gradiente: [NAVY_ALTO, NAVY] });
  archivos["branding/logo/prosecnur-appicon.svg"] = svg("0 0 512 512", i.defs, enCaja(45, 45, 422, i.cuerpo), GENERADO + " Retícula de ícono de macOS: la marca ocupa 422 de 512.");
}
{
  const i = isotipo({ id: "appc", gradiente: [NAVY_ALTO, NAVY], chica: true });
  archivos["branding/logo/prosecnur-appicon-chico.svg"] = svg("0 0 512 512", i.defs, enCaja(45, 45, 422, i.cuerpo), GENERADO + " Variante de cinco hilos para los tamaños de 16 y 32 px del .icns.");
}
for (const [slug, color] of MODULOS) {
  const i = isotipo({ id: `m-${slug}`, color });
  archivos[`branding/logo/modulos/prosecnur-isotipo-${slug}.svg`] = svg("0 0 100 100", i.defs, i.cuerpo, GENERADO + ` Color del módulo ${slug}: sólo para su pantalla de carga.`);
}

const palabra = (x, y, size, fill, extra = "") => `<text x="${x}" y="${y}" font-family="${FUENTE}" font-size="${size}" font-weight="800" letter-spacing="-0.02em" fill="${fill}"${extra}>Prosecnur</text>`;
const subline = (x, y, size, extra = "") => `<text x="${x}" y="${y}" font-family="${FUENTE}" font-size="${size}" font-weight="600" letter-spacing="0.14em" fill="#5f6b7a"${extra}>SUITE ANALÍTICA · PULSO PUCP</text>`;
{ const i = isotipo({ id: "lh" }); archivos["branding/logo/prosecnur-lockup-horizontal.svg"] = svg("0 0 356 80", i.defs, enCaja(8, 8, 64, i.cuerpo) + palabra(90, 54.5, 42, NAVY), GENERADO); }
{ const i = isotipo({ id: "lho", oscuro: true }); archivos["branding/logo/prosecnur-lockup-horizontal-oscuro.svg"] = svg("0 0 356 80", i.defs, enCaja(8, 8, 64, i.cuerpo) + palabra(90, 54.5, 42, "#ffffff"), GENERADO); }
{ const i = isotipo({ id: "lp" }); archivos["branding/logo/prosecnur-lockup-principal.svg"] = svg("0 0 356 80", i.defs, enCaja(8, 8, 64, i.cuerpo) + palabra(90, 47, 42, NAVY) + subline(90, 63, 10), GENERADO); }
{
  const i = isotipo({ id: "lv" });
  archivos["branding/logo/prosecnur-lockup-vertical.svg"] = svg("0 0 202 132", i.defs,
    enCaja(69, 8, 64, i.cuerpo) + palabra(101, 109, 30, NAVY, ' text-anchor="middle"') + subline(101, 124, 7.2, ' text-anchor="middle"'), GENERADO);
}
{
  const t = trenza({ id: "mn", tinta: "#FFFFFF", fondo: "#000000", mono: true });
  archivos["branding/logo/prosecnur-mono-negro.svg"] = svg("0 0 356 80", t.defs,
    enCaja(8, 8, 64, `<rect width="100" height="100" rx="${RX}" fill="#000000"/>${t.cuerpo}`) + palabra(90, 54.5, 42, "#000000"), GENERADO + " Impresión en una tinta.");
}
// calado: contenedor blanco con la trenza recortada (lo que hay detrás se ve a través de los hilos)
const calado = (id) => {
  const t = trenza({ id, tinta: "#000000", fondo: "#FFFFFF", mono: true });
  return { defs: t.defs, mascara: `<rect width="100" height="100" rx="${RX}" fill="#ffffff"/>${t.cuerpo}` };
};
{
  const c = calado("mb");
  const defs = c.defs + `<mask id="mb-calado" maskUnits="userSpaceOnUse" x="0" y="0" width="356" height="80">${enCaja(8, 8, 64, c.mascara)}</mask>`;
  archivos["branding/logo/prosecnur-mono-blanco.svg"] = svg("0 0 356 80", defs,
    `<rect x="8" y="8" width="64" height="64" rx="${(RX * 0.64).toFixed(2)}" fill="#ffffff" mask="url(#mb-calado)"/>` + palabra(90, 54.5, 42, "#ffffff"), GENERADO + " Calado para fondos fotográficos o navy.");
}

/* --------------------------------------------------------- instalador de Windows -------------------------------- */
{
  const i = isotipo({ id: "nsis-icon", gradiente: [NAVY_ALTO, NAVY] });
  archivos["packaging/windows/brand/icon.svg"] = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Isotipo de Prosecnur («Trenza», ADR 0132) a sangre, con el degradado de ícono de app.\n     ${GENERADO}\n     De este SVG se deriva prosecnur.ico (build-self-contained.sh). -->\n` + svg("0 0 100 100", i.defs, i.cuerpo).trimEnd() + "\n";
}
{
  const i = isotipo({ id: "nsis-icon-chico", gradiente: [NAVY_ALTO, NAVY], chica: true });
  archivos["packaging/windows/brand/icon-chico.svg"] = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Isotipo «Trenza» de cinco hilos para las capas de 16 y 32 px de prosecnur.ico (build-self-contained.sh).\n     ${GENERADO} -->\n` + svg("0 0 100 100", i.defs, i.cuerpo).trimEnd() + "\n";
}
{
  const i = isotipo({ id: "nsis-header" });
  archivos["packaging/windows/brand/header.svg"] = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Header del NSIS MUI (150x57). Lockup horizontal (branding/logo/prosecnur-lockup-horizontal.svg):
     isotipo «Trenza» de 40x40 centrado en vertical ((57-40)/2 = 8.5) + wordmark «Prosecnur» en Segoe UI 800.
     ${GENERADO} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 57" width="150" height="57">
  <defs>${i.defs}</defs>
  <rect width="150" height="57" fill="#ffffff"/>
  ${enCaja(8, 8.5, 40, i.cuerpo)}
  <text x="57" y="34" font-family="Segoe UI, system-ui, sans-serif" font-weight="800" font-size="16" letter-spacing="-0.4" fill="#002457">Prosecnur</text>
</svg>
`;
}
{
  const c = calado("nsis-wizard");
  archivos["packaging/windows/brand/wizard.svg"] = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Sidebar del NSIS MUI Welcome page (164x314). Fondo navy + isotipo «Trenza» en calado blanco
     (branding/logo/prosecnur-mono-blanco.svg): contenedor blanco con los hilos recortados, que dejan ver el fondo.
     Isotipo de 92x92 centrado en x = 82. ${GENERADO} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 164 314" width="164" height="314">
  <defs>
    <linearGradient id="nsis-wizard-fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#012558"/>
      <stop offset="100%" stop-color="#001a40"/>
    </linearGradient>
    ${c.defs}
    <mask id="nsis-wizard-calado" maskUnits="userSpaceOnUse" x="36" y="42" width="92" height="92">${enCaja(36, 42, 92, c.mascara)}</mask>
  </defs>
  <rect width="164" height="314" fill="url(#nsis-wizard-fondo)"/>
  <rect x="36" y="42" width="92" height="92" rx="${(RX * 0.92).toFixed(2)}" fill="#ffffff" mask="url(#nsis-wizard-calado)"/>
  <text x="82" y="180" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-weight="800" font-size="22" letter-spacing="-0.6" fill="#ffffff">Prosecnur</text>
  <text x="82" y="200" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-weight="400" font-size="9" letter-spacing="0.6" fill="#94a3b8">SUITE ANALITICA</text>
  <text x="82" y="298" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-weight="500" font-size="9" letter-spacing="0.5" fill="#cbd5e1" fill-opacity="0.75">PULSO PUCP</text>
</svg>
`;
}

/* ------------------------------------------------------------- hoja de contacto --------------------------------- */
{
  const fig = (archivo, ancho, alto, pie) => `<figure><img src="${archivo}" width="${ancho}" height="${alto}" alt=""><figcaption>${pie}</figcaption></figure>`;
  const claros = [
    fig("prosecnur-isotipo.svg", 128, 128, "prosecnur-isotipo.svg"),
    fig("prosecnur-isotipo-gradiente.svg", 128, 128, "prosecnur-isotipo-gradiente.svg"),
    fig("prosecnur-appicon.svg", 128, 128, "prosecnur-appicon.svg"),
    `<figure><div class="fila">${[64, 32, 16].map((s) => `<img src="prosecnur-isotipo${s <= 32 ? "-chico" : ""}.svg" width="${s}" height="${s}" alt="">`).join("")}</div><figcaption>64 · 32 · 16 px (chico desde 32)</figcaption></figure>`,
    fig("prosecnur-lockup-horizontal.svg", 356, 80, "prosecnur-lockup-horizontal.svg"),
    fig("prosecnur-lockup-principal.svg", 356, 80, "prosecnur-lockup-principal.svg"),
    fig("prosecnur-lockup-vertical.svg", 202, 132, "prosecnur-lockup-vertical.svg"),
    fig("prosecnur-mono-negro.svg", 356, 80, "prosecnur-mono-negro.svg"),
  ].join("\n    ");
  const oscuros = [
    fig("prosecnur-isotipo-oscuro.svg", 128, 128, "prosecnur-isotipo-oscuro.svg"),
    fig("prosecnur-lockup-horizontal-oscuro.svg", 356, 80, "prosecnur-lockup-horizontal-oscuro.svg"),
    fig("prosecnur-mono-blanco.svg", 356, 80, "prosecnur-mono-blanco.svg"),
  ].join("\n    ");
  const modulos = MODULOS.map(([slug]) => fig(`modulos/prosecnur-isotipo-${slug}.svg`, 96, 96, slug)).join("\n    ");
  archivos["branding/logo/preview.html"] = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prosecnur — suite del isotipo Trenza</title>
<!-- ${GENERADO} -->
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${FUENTE}; -webkit-font-smoothing: antialiased; }
  .band { padding: 56px 64px 64px; }
  .band--claro { background: #f3f5f9; color: #17212f; }
  .band--navy { background: #002457; color: #ffffff; }
  .band > h2 { font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.55; margin-bottom: 36px; }
  .grid { display: flex; flex-wrap: wrap; gap: 48px 64px; align-items: flex-end; }
  figure { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  figcaption { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; opacity: 0.55; }
  .fila { display: flex; gap: 20px; align-items: flex-end; }
</style>
</head>
<body>
<section class="band band--claro"><h2>Fondo claro · #f3f5f9</h2><div class="grid">
    ${claros}
</div></section>
<section class="band band--navy"><h2>Fondo navy · #002457</h2><div class="grid">
    ${oscuros}
</div></section>
<section class="band band--claro"><h2>Pantallas de carga · color de cada módulo</h2><div class="grid">
    ${modulos}
</div></section>
</body>
</html>
`;
}

console.log("Escribiendo la suite del isotipo:");
for (const [rel, texto] of Object.entries(archivos)) escribir(rel, texto);

/* ------------------------------------------------------------------ raster -------------------------------------- */
if (process.argv.includes("--raster")) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "prosecnur-isotipo-"));
  const rsvg = (src, w, out) => execFileSync("rsvg-convert", ["-w", String(w), "-h", String(w), path.join(RAIZ, src), "-o", out]);
  // ícono de Electron (Dock en desarrollo y respaldo): el appicon en 512
  rsvg("branding/logo/prosecnur-appicon.svg", 512, path.join(RAIZ, "desktop/assets/icon.png"));
  console.log("  desktop/assets/icon.png");
  // favicon: la variante de cinco hilos en 16 y 32, la completa desde 48
  const capas = [16, 32, 48, 64, 128, 256].map((s) => {
    const out = path.join(tmp, `fav-${s}.png`);
    rsvg(s <= 32 ? "branding/logo/prosecnur-isotipo-chico.svg" : "branding/logo/prosecnur-isotipo.svg", s, out);
    return out;
  });
  execFileSync("magick", [...capas, path.join(RAIZ, "frontend/public/favicon.ico")]);
  console.log("  frontend/public/favicon.ico");
  // .icns de macOS: mismo procedimiento que packaging/macos/build-dmg.sh
  const set = path.join(tmp, "icon.iconset");
  fs.mkdirSync(set);
  // 16 y 32 px salen de la variante de cinco hilos, como en packaging/macos/build-dmg.sh
  const fuente = (px) => (px <= 32 ? "branding/logo/prosecnur-appicon-chico.svg" : "branding/logo/prosecnur-appicon.svg");
  for (const s of [16, 32, 128, 256, 512]) {
    rsvg(fuente(s), s, path.join(set, `icon_${s}x${s}.png`));
    rsvg(fuente(s * 2), s * 2, path.join(set, `icon_${s}x${s}@2x.png`));
  }
  execFileSync("iconutil", ["-c", "icns", set, "-o", path.join(RAIZ, "packaging/macos/build-resources/icon.icns")]);
  console.log("  packaging/macos/build-resources/icon.icns");
  fs.rmSync(tmp, { recursive: true, force: true });
}
