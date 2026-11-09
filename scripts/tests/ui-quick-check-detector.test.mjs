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
const TITULO_LARGO = "Satisfacción con los servicios de bienestar universitario por facultad y por año de estudio";

const FIXTURE = `
<style>
  body { margin: 0; font: 13px system-ui; }
  .caja { display: block; width: 200px; white-space: nowrap; margin: 12px; }
  .recorta { overflow: hidden; text-overflow: ellipsis; }
  .suelta { overflow: visible; }
  .quieto { position: relative; box-sizing: border-box; width: 28px; height: 28px; padding: 0; border: 1px solid transparent; margin: 12px; }
  .quieto::before { content: ""; position: absolute; inset: -3px; }
  .bajo { display: block; height: 20px; width: 200px; margin: 12px; overflow: visible; }
  .clamp { display: -webkit-box; width: 120px; margin: 12px; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-size: 13px; line-height: 1.2; }
</style>
<div id="superficie" role="menu">
  <button class="caja recorta marca-con-title" title="${NOMBRE_LARGO}">${NOMBRE_LARGO}</button>
  <button class="caja recorta marca-sin-title">${NOMBRE_LARGO}</button>
  <button class="caja suelta marca-desborda">${NOMBRE_LARGO}</button>
  <button class="caja recorta marca-title-parcial" title="otro nombre">${NOMBRE_LARGO}</button>
  <button class="quieto marca-quieto" aria-label="Deshacer"><svg width="16" height="16"></svg></button>
  <button class="bajo marca-bajo">Una línea<br>otra línea<br>y una tercera que no cabe</button>
  <h3 class="clamp marca-clamp-con-title" title="${TITULO_LARGO}">${TITULO_LARGO}</h3>
  <h3 class="clamp marca-clamp-mudo">${TITULO_LARGO}</h3>
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

test("R11-12: el ::before del área de impacto de un botón quieto no es un desborde", async () => {
  const issues = await medirFixture();
  assert.equal(reportado(issues, "marca-quieto"), false);
});

test("R11-12: un texto que sí se sale de su caja en alto sigue siendo hallazgo", async () => {
  const issues = await medirFixture();
  assert.equal(reportado(issues, "marca-bajo"), true);
});

test("R12-12: un recorte deliberado a dos renglones (line-clamp) con title no es overflow-y", async () => {
  const issues = await medirFixture();
  assert.equal(reportado(issues, "marca-clamp-con-title"), false);
});

test("R12-12: un line-clamp mudo, sin title que exponga el texto entero, sí es hallazgo", async () => {
  const issues = await medirFixture();
  assert.equal(reportado(issues, "marca-clamp-mudo"), true);
});

test("el gate espera el render terminal de una lista virtualizada", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
    const virtualFixture = `
      <style>
        .virtual-owner { height: 100px; overflow-y: auto; }
        .virtual-canvas { position: relative; height: 1000px; }
        .virtual-row { position: absolute; height: 40px; }
      </style>
      <main data-audit-ready="virtualized">
        <section data-qa-geometry-group="virtualized" data-qa-geometry-contract="intrinsic">
          <article data-qa-geometry-member>
            <div class="virtual-owner">
              <div class="virtual-canvas"><strong class="virtual-row initial" style="top:0">Inicio</strong></div>
            </div>
          </article>
        </section>
      </main>
      <script>
        const owner = document.querySelector('.virtual-owner');
        const canvas = document.querySelector('.virtual-canvas');
        owner.addEventListener('scroll', () => {
          const atEnd = owner.scrollTop >= owner.scrollHeight - owner.clientHeight - 1;
          requestAnimationFrame(() => {
            if (atEnd) canvas.innerHTML = '<strong class="virtual-row terminal" style="top:960px">Final</strong>';
          });
        });
      </script>
    `;
    await page.route("http://virtual.test/", (route) => route.fulfill({
      contentType: "text/html",
      body: virtualFixture,
    }));
    await page.goto("http://virtual.test/");

    const result = await inspectDom(page, {
      projectMode: false,
      geometryGroups: [],
      geometryTolerance: 2,
      requireGeometry: true,
    });
    assert.deepEqual(result.geometryIssues, []);
    const scrollAudit = result.geometryAudits[0].members[0].overflowOwner.scrollAudit;
    assert.equal(scrollAudit.positions.end, scrollAudit.maxScroll);
    assert.equal(scrollAudit.lastContent.className, "virtual-row terminal");
    assert.equal(scrollAudit.lastContentReachable, true);
  } finally {
    await browser.close();
  }
});
