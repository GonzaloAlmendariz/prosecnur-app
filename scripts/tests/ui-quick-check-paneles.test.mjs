// L2: `--panel <id>` y el barrido geométrico dentro de los overlays abiertos.
//
// Se corre con `node --test scripts/tests/ui-quick-check-paneles.test.mjs`
// (nunca en paralelo con una captura: comparten máquina y puertos).
//
// Dos hallazgos de QA lo motivan:
// - H2 (QA de L1): el barrido `geometry-undeclared` solo miraba dentro de la
//   raíz `[data-audit-ready]`, y un diálogo en portal queda FUERA de ella. Un
//   verde dentro de un diálogo era verde por ausencia.
// - QA de L26: la firma de variante devolvía null para hijos sin clase, así
//   que una colección de `<li>` sin clase era invisible al barrido.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { estadoDePanelPedido, inspectDom, opcionesDeChromium, parsePanelId, searchConPanelQa } from "../ui-quick-check.mjs";

const requireFromFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = requireFromFrontend("@playwright/test");

test("--panel acepta ids ASCII del manifiesto y rechaza el resto", () => {
  assert.equal(parsePanelId("personalizar"), "personalizar");
  assert.equal(parsePanelId(" biblioteca-slides "), "biblioteca-slides");
  assert.throws(() => parsePanelId("Personalizar"), /Panel inválido/);
  assert.throws(() => parsePanelId("paletas de color"), /Panel inválido/);
  assert.throws(() => parsePanelId(""), /Panel inválido/);
});

test("abrir un panel por dirección preserva el resto de la query", () => {
  assert.equal(
    searchConPanelQa("?seccion=carga&pulso=%2Ftmp%2Fa.pulso", "reconciliacion"),
    "?seccion=carga&pulso=%2Ftmp%2Fa.pulso&panel=reconciliacion",
  );
  // Un panel por dirección: el nuevo reemplaza al anterior.
  assert.equal(searchConPanelQa("?panel=paletas&pestana=resumen", "personalizar"), "?panel=personalizar&pestana=resumen");
  assert.equal(searchConPanelQa("?panel=paletas&pestana=resumen", null), "?pestana=resumen");
  assert.equal(searchConPanelQa("", null), "");
});

test("un panel que la vista borra de la URL es «no-aplica», no un fallo ni una espera", () => {
  assert.equal(estadoDePanelPedido({ visible: true, panelEnUrl: "paletas", id: "paletas" }), "abierto");
  assert.equal(estadoDePanelPedido({ visible: false, panelEnUrl: null, id: "reconciliacion" }), "no-aplica");
  assert.equal(estadoDePanelPedido({ visible: false, panelEnUrl: "reconciliacion", id: "reconciliacion" }), "pendiente");
});

const FIXTURE = `
<style>
  body { margin: 0; font: 13px system-ui; }
  .card { display: block; border: 1px solid #999; padding: 8px; margin: 4px; }
  .dialogo { position: fixed; top: 20px; left: 420px; width: 320px; background: white; }
</style>
<main data-audit-ready="fixture">
  <section data-qa-geometry-group="vista" data-qa-geometry-contract="intrinsic">
    <article class="card" data-qa-geometry-member="">Uno</article>
    <article class="card" data-qa-geometry-member="">Dos</article>
  </section>
  <ul class="lista-sin-clase">
    <li><div class="card">Elemento A</div></li>
    <li><div class="card">Elemento B</div></li>
    <li><div class="card">Elemento C</div></li>
  </ul>
  <ul class="prosa">
    <li>Primera idea en texto corrido.</li>
    <li>Segunda idea en texto corrido.</li>
  </ul>
  <ul class="prosa-con-enfasis">
    <li><strong>Uno</strong> con énfasis inline.</li>
    <li><strong>Dos</strong> con énfasis inline.</li>
  </ul>
  <nav aria-label="Secciones"><ul>
    <li><div class="card">Inicio</div></li>
    <li><div class="card">Otra</div></li>
  </ul></nav>
</main>
<div class="dialogo" role="dialog" aria-modal="true" data-pulso-panel="sin-contrato">
  <div class="cuerpo-dialogo">
    <article class="card fila-dialogo">Fila 1</article>
    <article class="card fila-dialogo">Fila 2</article>
  </div>
</div>
<div class="dialogo pulso-overlay" style="top: 220px" role="dialog" aria-modal="true" data-pulso-panel="con-contrato">
  <div data-qa-geometry-group="pulso-dialog" data-qa-geometry-contract="intrinsic">
    <article class="card fila-declarada" data-qa-geometry-member="">Fila 1</article>
    <article class="card fila-declarada" data-qa-geometry-member="">Fila 2</article>
  </div>
</div>
`;

async function medir() {
  // Mismo lanzamiento que el runner: `PW_CHROMIUM` si existe (nube), el
  // Chromium de Playwright si no (CI).
  const browser = await chromium.launch(opcionesDeChromium());
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    // Origen http real: el inspector lee `localStorage`, que en about:blank
    // está vetado.
    await page.route("http://fixture.qa/**", (route) => route.fulfill({ contentType: "text/html", body: FIXTURE }));
    await page.goto("http://fixture.qa/");
    return await inspectDom(page, {
      projectMode: false,
      geometryGroups: [],
      geometryTolerance: 2,
      requireGeometry: true,
    });
  } finally {
    await browser.close();
  }
}

const sinContrato = (dom) => dom.geometryCoverageMisses.filter((miss) => miss.type === "geometry-undeclared");

test("H2: un diálogo en portal fuera de [data-audit-ready] también se barre", async () => {
  const dom = await medir();
  const enDialogo = sinContrato(dom).filter((miss) => miss.variant === "article.card.fila-dialogo");
  assert.equal(enDialogo.length, 1, JSON.stringify(sinContrato(dom).map((m) => m.variant)));
  assert.equal(enDialogo[0].enOverlay, true);
  assert.equal(enDialogo[0].count, 2);
});

test("H2: el diálogo con su grupo declarado no aporta geometry-undeclared", async () => {
  const dom = await medir();
  assert.equal(sinContrato(dom).some((miss) => miss.variant?.includes("fila-declarada")), false);
  const conContrato = dom.overlaysAbiertos.find((item) => item.panel === "con-contrato");
  assert.ok(conContrato, "el overlay declarado se enumera");
  assert.equal(conContrato.gruposDeclarados, 1);
  assert.equal(dom.overlaysAbiertos.length, 2);
});

test("L26: una colección de <li> sin clase se firma por tag y primer hijo", async () => {
  const dom = await medir();
  const lista = sinContrato(dom).filter((miss) => miss.variant === "li>div.card");
  assert.equal(lista.length, 1, JSON.stringify(sinContrato(dom).map((m) => m.variant)));
  assert.equal(lista[0].count, 3);
  assert.equal(lista[0].parent.className, "lista-sin-clase");
  assert.equal(lista[0].enOverlay, false);
});

test("L26: la prosa en lista y la navegación siguen sin hallazgo", async () => {
  const dom = await medir();
  const padres = sinContrato(dom).map((miss) => miss.parent?.className ?? "");
  assert.equal(padres.includes("prosa"), false);
  assert.equal(padres.includes("prosa-con-enfasis"), false);
  // El ul de la nav no tiene clase: se identifica por su variante.
  assert.equal(sinContrato(dom).filter((miss) => miss.variant === "li>div.card").length, 1);
});
