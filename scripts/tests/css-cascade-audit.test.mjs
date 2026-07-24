// Contrato del detector de empates de cascada.
//
// Un detector en el que no se confía es peor que ninguno: dirige refactors
// sobre datos falsos. Estos tests fijan su comportamiento con casos
// construidos a mano, donde la respuesta correcta se conoce de antemano.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { audit, specificity } = await import(path.join(ROOT, "scripts/css-cascade-audit.mjs"));

/** audit() es async: hay que esperarlo antes de borrar el directorio. */
async function withCss(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "css-cascade-"));
  try {
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("marca el empate: mismo selector y especificidad en dos archivos", async () => {
  const ties = await withCss({
    "a.css": ".x { background: red; }",
    "b.css": ".x { background: blue; }",
  }, (d) => audit({ src: d }));
  assert.equal(ties.length, 1);
  assert.equal(ties[0].selector, ".x");
  assert.deepEqual(ties[0].props, ["background"]);
  assert.equal(ties[0].sites.length, 2);
});

test("no marca cuando las especificidades difieren: el ganador es determinista", async () => {
  const ties = await withCss({
    "a.css": ".x.x { background: red; }",
    "b.css": ".x { background: blue; }",
  }, (d) => audit({ src: d }));
  assert.deepEqual(ties, []);
});

test("no marca cuando el contexto condicional difiere", async () => {
  const ties = await withCss({
    "a.css": "@media (max-width: 9px) { .x { background: red; } }",
    "b.css": ".x { background: blue; }",
  }, (d) => audit({ src: d }));
  assert.deepEqual(ties, []);
});

test("sí marca dentro del mismo @media", async () => {
  const ties = await withCss({
    "a.css": "@media (max-width: 9px) { .x { background: red; } }",
    "b.css": "@media (max-width: 9px) { .x { background: blue; } }",
  }, (d) => audit({ src: d }));
  assert.equal(ties.length, 1);
  assert.match(ties[0].cond, /max-width/);
});

test("no marca repeticiones dentro de un mismo archivo: ahí el orden se lee", async () => {
  const ties = await withCss({
    "a.css": ".x { background: red; } .x { background: blue; }",
  }, (d) => audit({ src: d }));
  assert.deepEqual(ties, []);
});

test("solo considera propiedades visuales en conflicto", async () => {
  const ties = await withCss({
    "a.css": ".x { z-index: 1; }",
    "b.css": ".x { z-index: 2; }",
  }, (d) => audit({ src: d }));
  assert.deepEqual(ties, []);
});

test("expande listas de selectores separadas por coma", async () => {
  const ties = await withCss({
    "a.css": ".x, .y { color: red; }",
    "b.css": ".y { color: blue; }",
  }, (d) => audit({ src: d }));
  assert.equal(ties.length, 1);
  assert.equal(ties[0].selector, ".y");
});

test("ignora custom properties: no pintan por sí solas", async () => {
  const ties = await withCss({
    "a.css": ".x { --tono: red; }",
    "b.css": ".x { --tono: blue; }",
  }, (d) => audit({ src: d }));
  assert.deepEqual(ties, []);
});

test("un archivo con sintaxis inválida no aborta la auditoría", async () => {
  const ties = await withCss({
    "roto.css": ".x { color: red",          // sin cerrar
    "a.css": ".y { background: red; }",
    "b.css": ".y { background: blue; }",
  }, (d) => audit({ src: d }));
  assert.equal(ties.length, 1, "las demás hojas se siguen auditando");
  assert.equal(ties[0].selector, ".y");
});

test("especificidad según el algoritmo de la cascada", () => {
  assert.deepEqual(specificity("#a"), [1, 0, 0]);
  assert.deepEqual(specificity(".a"), [0, 1, 0]);
  assert.deepEqual(specificity("div"), [0, 0, 1]);
  assert.deepEqual(specificity(".a .b"), [0, 2, 0]);
  assert.deepEqual(specificity("a[href]"), [0, 1, 1]);
  assert.deepEqual(specificity(".a::before"), [0, 1, 0], "los pseudo-elementos no suman clase");
  assert.deepEqual(specificity(":where(.a) .b"), [0, 1, 0], ":where() aporta cero");
  assert.deepEqual(specificity(".a:not(.b, .c.d)"), [0, 3, 0], ":not() toma la alternativa mayor");
});
