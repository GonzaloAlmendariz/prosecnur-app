// Un contrato del frontend que escanea el árbol entero se rompe desde otro
// archivo: si no está entre los transversales de gate-front, ningún gate de
// área lo corre y su rojo sólo aparece en el CI o por casualidad (el A02 de
// TabSemanticsAudit, 2026-11-01). Este test exige que cada contrato que lee
// el árbol (`readdirSync`/`globSync`/`import.meta.glob`) esté en la lista.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const RAIZ = new URL("../../frontend/", import.meta.url).pathname;
const gate = readFileSync(new URL("../gate-front.mjs", import.meta.url), "utf8");

function contratos(dir) {
  return readdirSync(`${RAIZ}${dir}`).filter((f) => f.endsWith(".contract.test.ts")).map((f) => `${dir}/${f}`);
}

test("cada contrato que escanea el árbol corre en todos los gates de área", () => {
  const faltan = ["src/app", "src/components", "src/lib"]
    .flatMap(contratos)
    .filter((ruta) => /readdirSync|globSync|import\.meta\.glob/.test(readFileSync(`${RAIZ}${ruta}`, "utf8")))
    .filter((ruta) => !gate.includes(`"${ruta}"`));
  assert.deepEqual(faltan, [], "Súmalos a TRANSVERSALES en scripts/gate-front.mjs.");
});
