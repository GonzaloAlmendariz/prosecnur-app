// Detectores de lectura de ui-quick-check: rótulo partido, texto fuera de su
// tarjeta y cabecera que tapa la primera fila.
//
// Se corre con `node --test scripts/tests/ui-quick-check-lectura.test.mjs`.
//
// Los fixtures reproducen lo que Gonzalo vio el 2026-10-27 en el RMS ficticio:
// «En curso» una letra por línea, «RENDIMIE / NTO», la línea de la ronda que se
// sale de su tarjeta y la cabecera pegajosa sobre «Elena Simulada». Cada caso
// trae su gemelo sano, que no debe marcarse: un detector que grita por todo se
// deja de leer.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { medirLectura } from "../ui-quick-check-lectura.mjs";

const requireFromFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = requireFromFrontend("@playwright/test");

async function medir(html, viewport = { width: 900, height: 600 }) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport });
    await page.setContent(`<style>body{margin:0;font:13px/1.3 system-ui}</style>${html}`);
    return await medirLectura(page);
  } finally {
    await browser.close();
  }
}

const marcado = (lista, clase) => lista.some((item) => String(item.className || "").includes(clase));

test("rótulo partido: el chip aplastado a una letra por línea y la palabra cortada se marcan; el sano no", async () => {
  const { rotulosPartidos } = await medir(`
    <div style="display:grid;grid-template-columns:150px 8px">
      <span class="nombre">Pre visa humanitaria</span>
      <span class="chip-aplastado" style="overflow-wrap:anywhere">En curso</span>
    </div>
    <div style="width:64px"><span class="antetitulo-cortado" style="overflow-wrap:anywhere;font-weight:700">RENDIMIENTO</span></div>
    <div style="width:52px"><span class="unidad-cortada" style="overflow-wrap:anywhere">registros</span></div>
    <div style="width:300px"><span class="chip-sano">En curso</span></div>
    <div style="width:90px"><p class="parrafo-sano">Una frase de varias palabras que se parte entre palabras</p></div>
  `);
  assert.ok(marcado(rotulosPartidos, "chip-aplastado"), "«E n c u r s o» debió marcarse");
  assert.ok(marcado(rotulosPartidos, "antetitulo-cortado"), "«RENDIMIE / NTO» debió marcarse");
  assert.ok(marcado(rotulosPartidos, "unidad-cortada"), "«regist / ros» debió marcarse");
  assert.equal(marcado(rotulosPartidos, "chip-sano"), false);
  assert.equal(marcado(rotulosPartidos, "parrafo-sano"), false);
  const chip = rotulosPartidos.find((item) => item.className.includes("chip-aplastado"));
  assert.match(chip.motivo, /más líneas que palabras/);
});

test("texto fuera de su tarjeta: la línea que cruza el borde se marca; la que cabe o se recorta, no", async () => {
  const { textosFuera } = await medir(`
    <ul style="list-style:none;padding:0;width:260px">
      <li class="tarjeta-rota" style="border:1px solid #ccc;padding:8px">
        <small style="white-space:nowrap">9 casos · de 360 efectivas · 27/10/2026 · semilla 20261027</small>
      </li>
      <li class="tarjeta-sana" style="border:1px solid #ccc;padding:8px"><small>9 casos · de 360 efectivas</small></li>
      <li class="tarjeta-recorta" style="border:1px solid #ccc;padding:8px;overflow:hidden">
        <small style="white-space:nowrap">9 casos · de 360 efectivas · 27/10/2026 · semilla 20261027</small>
      </li>
    </ul>
  `);
  assert.ok(textosFuera.some((item) => item.contenedor.className.includes("tarjeta-rota")));
  assert.equal(textosFuera.some((item) => item.contenedor.className.includes("tarjeta-sana")), false);
  assert.equal(textosFuera.some((item) => item.contenedor.className.includes("tarjeta-recorta")), false);
});

test("cabecera tapa fila: tras desplazar, la tabla sin encaje deja una fila a medias; con encaje, no", async () => {
  const filas = Array.from({ length: 30 }, (_, i) => `<tr><td>Persona ${i}</td><td>Efectiva</td></tr>`).join("");
  const tabla = (clase, marco) => `
    <div class="${clase}-marco" style="height:200px;overflow:auto;${marco}">
      <table class="${clase}" style="border-collapse:collapse;width:400px">
        <thead><tr><th style="position:sticky;top:0;background:#fff;height:30px">Responsable</th><th style="position:sticky;top:0;background:#fff">Marca</th></tr></thead>
        <tbody>${filas.replace(/<tr>/g, '<tr style="height:30px;scroll-snap-align:start">')}</tbody>
      </table>
    </div>`;
  const { cabecerasQueTapan } = await medir(`
    ${tabla("tabla-sin-encaje", "")}
    ${tabla("tabla-con-encaje", "scroll-snap-type:y mandatory;scroll-padding-top:31px")}
  `);
  const sinEncaje = cabecerasQueTapan.find((item) => item.className.includes("tabla-sin-encaje"));
  assert.ok(sinEncaje, "la fila a medias bajo la cabecera debió marcarse");
  assert.equal(sinEncaje.momento, "tras desplazar fila y media");
  assert.equal(marcado(cabecerasQueTapan, "tabla-con-encaje"), false);
});

test("cabecera tapa fila: la cabecera pegajosa desplazada sobre la primera fila se marca; la normal no", async () => {
  const tabla = (clase, estiloTh) => `
    <div style="height:200px;overflow:auto">
      <table class="${clase}" style="border-collapse:collapse;width:400px">
        <thead><tr><th style="position:sticky;top:0;background:#fff;${estiloTh}">Responsable</th><th style="position:sticky;top:0;background:#fff;${estiloTh}">Marca</th></tr></thead>
        <tbody><tr><td>Elena Simulada</td><td>Efectiva</td></tr><tr><td>Fabio</td><td>Rechazo</td></tr></tbody>
      </table>
    </div>`;
  const { cabecerasQueTapan } = await medir(`
    ${tabla("tabla-tapada", "transform:translateY(14px)")}
    ${tabla("tabla-sana", "")}
    <div role="table" class="rejilla-tapada" style="height:120px;overflow:auto">
      <div role="row" style="position:sticky;top:0;background:#fff;height:30px;margin-bottom:-18px"><span role="columnheader">Cuota</span></div>
      <div role="row"><span role="cell">Pre visa</span></div>
    </div>
  `);
  assert.ok(marcado(cabecerasQueTapan, "tabla-tapada"));
  assert.ok(marcado(cabecerasQueTapan, "rejilla-tapada"));
  assert.equal(marcado(cabecerasQueTapan, "tabla-sana"), false);
});
