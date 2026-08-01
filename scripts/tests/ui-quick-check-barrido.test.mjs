// Barrido de superficies que solo existen tras un click.
//
// Se corre con `node --test scripts/tests/ui-quick-check-barrido.test.mjs`.
//
// Lo que hay que sostener aquí no es solo "abre y mide", sino que DEVUELVE la
// vista al estado en que estaba. El barrido recorre los disparadores en orden,
// así que una superficie que se queda abierta contamina la medición de todas
// las siguientes. Un menú se cierra con Escape; un acordeón lo ignora y hay que
// volver a pulsar su propio disparador.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { barrerPopovers } from "../ui-quick-check.mjs";

const requireFromFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = requireFromFrontend("@playwright/test");

const TEXTO_LARGO = "giehrhreioghrehgiorheoghriehgoierhiohgiohreoihgoreih";

// Tres disparadores con contratos distintos:
//  - menú declarado con aria-haspopup, cierra con Escape;
//  - acordeón declarado solo con aria-expanded, NO cierra con Escape;
//  - disparador que solo responde a mousedown (como la barra del editor
//    markdown), que un `el.click()` del DOM no llegaría a abrir.
const FIXTURE = `
<style>
  body { margin: 0; font: 13px system-ui; }
  .pop { position: absolute; width: 200px; background: #fff; border: 1px solid #ccc; }
  .fila { overflow: visible; white-space: nowrap; width: 180px; }
</style>

<button id="t-menu" aria-haspopup="menu" aria-expanded="false">Menú</button>
<div id="p-menu" role="menu" class="pop" hidden><button class="fila">corto</button></div>

<button id="t-acordeon" aria-expanded="false">Acordeón</button>
<div id="p-acordeon" role="listbox" class="pop" hidden><button class="fila">${TEXTO_LARGO}</button></div>

<button id="t-mousedown" aria-haspopup="menu" aria-expanded="false">Solo mousedown</button>
<div id="p-mousedown" role="menu" class="pop" hidden><button class="fila">corto</button></div>

<script>
  const abrir = (trigger, panel) => {
    const abierto = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!abierto));
    panel.hidden = abierto;
  };
  const tMenu = document.getElementById('t-menu');
  const pMenu = document.getElementById('p-menu');
  tMenu.addEventListener('click', () => abrir(tMenu, pMenu));
  // Un menú de verdad se cierra con Escape.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    tMenu.setAttribute('aria-expanded', 'false');
    pMenu.hidden = true;
  });

  const tAcordeon = document.getElementById('t-acordeon');
  const pAcordeon = document.getElementById('p-acordeon');
  tAcordeon.addEventListener('click', () => abrir(tAcordeon, pAcordeon));

  const tMouse = document.getElementById('t-mousedown');
  const pMouse = document.getElementById('p-mousedown');
  tMouse.addEventListener('mousedown', () => abrir(tMouse, pMouse));
</script>
`;

async function barrer() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(FIXTURE);
    const auditorias = await barrerPopovers(page, { timeoutMs: 5000 });
    const estadoFinal = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[aria-expanded]")).map((el) => ({
        id: el.id,
        expandido: el.getAttribute("aria-expanded"),
      })));
    return { auditorias, estadoFinal };
  } finally {
    await browser.close();
  }
}

test("abre todo disparador declarado, por aria-haspopup o por aria-expanded", async () => {
  const { auditorias } = await barrer();
  const abiertos = auditorias.filter((a) => a.estado === "abierto").map((a) => a.etiqueta);
  assert.deepEqual(abiertos.sort(), ["Acordeón", "Menú", "Solo mousedown"]);
});

test("registra de qué contrato salió cada disparador", async () => {
  const { auditorias } = await barrer();
  const porEtiqueta = Object.fromEntries(auditorias.map((a) => [a.etiqueta, a.declara]));
  assert.equal(porEtiqueta["Menú"], "haspopup");
  assert.equal(porEtiqueta["Acordeón"], "expanded");
});

test("devuelve cada disparador al estado en que estaba, aunque ignore Escape", async () => {
  const { estadoFinal } = await barrer();
  for (const control of estadoFinal) {
    assert.equal(control.expandido, "false", `#${control.id} quedó abierto tras el barrido`);
  }
});

test("mide el contenido de la superficie abierta y no el de la vista de fondo", async () => {
  const { auditorias } = await barrer();
  const acordeon = auditorias.find((a) => a.etiqueta === "Acordeón");
  // El texto largo vive solo dentro del acordeón: si el scope funciona, el
  // hallazgo aparece ahí y en ningún otro disparador.
  assert.ok(acordeon.issues.length > 0, "el desborde del acordeón no se detectó");
  const menu = auditorias.find((a) => a.etiqueta === "Menú");
  assert.equal(menu.issues.length, 0, "el menú no contiene el texto largo y no debería reportar nada");
});
