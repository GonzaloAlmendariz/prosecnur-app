// Detector de desbordes de ui-quick-check: qué cuenta como hallazgo.
//
// Se corre con `node --test scripts/tests/ui-quick-check-detector.test.mjs`.
//
// El caso que motivó estas pruebas: un recorte con elipsis mide igual que un
// desborde —`scrollWidth` es el del texto completo en los dos—, así que la
// medición sola no distingue una decisión de diseño de un defecto. Lo que las
// separa es si el usuario puede llegar al texto que falta.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { inspectDom } from "../ui-quick-check.mjs";

// Mismo mecanismo que el runner: Playwright vive en las dependencias del
// frontend, no en la raíz.
const requireFromFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = requireFromFrontend("@playwright/test");

const NOMBRE_LARGO = "giehrhreioghrehgiorheoghriehgoierhiohgiohreoihgoreih";

const FIXTURE = `
<style>
  body { margin: 0; font: 13px system-ui; }
  .caja { display: block; width: 200px; white-space: nowrap; margin: 12px; }
  .recorta { overflow: hidden; text-overflow: ellipsis; }
  .suelta { overflow: visible; }
</style>
<div id="superficie" role="menu">
  <button class="caja recorta marca-con-title" title="${NOMBRE_LARGO}">${NOMBRE_LARGO}</button>
  <button class="caja recorta marca-sin-title">${NOMBRE_LARGO}</button>
  <button class="caja suelta marca-desborda">${NOMBRE_LARGO}</button>
  <button class="caja recorta marca-title-parcial" title="otro nombre">${NOMBRE_LARGO}</button>
</div>
`;

async function medirFixture() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
    await page.setContent(FIXTURE);
    // Con `rootSelector` se mide solo el subárbol de la superficie, que es
    // exactamente el camino que usa el barrido de popovers.
    const { issues } = await inspectDom(page, {
      projectMode: false,
      geometryGroups: [],
      geometryTolerance: 2,
      requireGeometry: false,
      rootSelector: "#superficie",
    });
    return issues;
  } finally {
    await browser.close();
  }
}

const reportado = (issues, marca) => issues.some((issue) => String(issue.className).includes(marca));

test("un recorte con elipsis no es hallazgo si el texto completo queda alcanzable", async () => {
  const issues = await medirFixture();
  assert.equal(reportado(issues, "marca-con-title"), false);
});

test("un recorte mudo sí es hallazgo: el dato existe y no hay cómo leerlo", async () => {
  const issues = await medirFixture();
  assert.equal(reportado(issues, "marca-sin-title"), true);
});

test("un title que no contiene el texto recortado no lo vuelve alcanzable", async () => {
  const issues = await medirFixture();
  assert.equal(reportado(issues, "marca-title-parcial"), true);
});

test("el texto que se sale de su caja sigue siendo hallazgo", async () => {
  const issues = await medirFixture();
  assert.equal(reportado(issues, "marca-desborda"), true);
});
