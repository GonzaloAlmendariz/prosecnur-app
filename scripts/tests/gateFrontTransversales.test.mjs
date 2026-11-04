// Un contrato del frontend que escanea el árbol entero se rompe desde otro
// archivo: si no está entre los transversales de gate-front, ningún gate de
// área lo corre y su rojo sólo aparece en el CI o por casualidad (el A02 de
// TabSemanticsAudit, 2026-11-01). Este test exige que cada contrato que lee
// el árbol esté en la lista.
//
// 4 nov 2026: dejó pasar `lib/navegacion/lectoresDeDireccion.contract.test.ts`, y un
// commit lo rompió sin que ningún gate lo viera. Tenía dos puntos ciegos:
// - miraba sólo el primer nivel de `src/app`, `src/components` y `src/lib`, y el
//   contrato vive en una subcarpeta (`lib/navegacion/`);
// - reconocía el recorrido por `readdirSync`/`globSync`/`import.meta.glob`, pero
//   varios contratos recorren el árbol con el helper compartido
//   `test/contractSourceScan` (`readSources`, `parseSourcesContaining`) y no
//   llaman a ninguno de esos tres.
// Ahora recorre las carpetas enteras y cuenta también el helper; la autoprueba de
// abajo demuestra que un contrato así, fuera de la lista, da rojo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const RAIZ = new URL("../../frontend/", import.meta.url).pathname;
const gate = readFileSync(new URL("../gate-front.mjs", import.meta.url), "utf8");

/** Lee el árbol: una llamada directa de fs o el helper compartido que la envuelve. */
// `cierreDeImports(`: el contrato recorre el cierre de imports desde una raíz (publicModeSinRouter) y se rompe
// desde cualquier archivo que esa raíz alcance, igual que un barrido del árbol.
const ESCANEA = /readdirSync|globSync|import\.meta\.glob|readSources\(|parseSourcesContaining\(|test\/contractSourceScan|cierreDeImports\(/;

export function escaneaElArbol(fuente) {
  return ESCANEA.test(fuente);
}

/** Los contratos que leen el árbol y no están entre los transversales del gate. */
export function faltantes(rutas, leer, textoDelGate) {
  return rutas.filter((ruta) => escaneaElArbol(leer(ruta))).filter((ruta) => !textoDelGate.includes(`"${ruta}"`));
}

function contratos(dir) {
  return readdirSync(`${RAIZ}${dir}`, { withFileTypes: true }).flatMap((e) => {
    const ruta = `${dir}/${e.name}`;
    if (e.isDirectory()) return e.name === "node_modules" || e.name === "__tests__" ? [] : contratos(ruta);
    return /\.contract\.test\.tsx?$/.test(e.name) ? [ruta] : [];
  });
}

test("cada contrato que escanea el árbol corre en todos los gates de área", () => {
  const rutas = ["src/app", "src/components", "src/lib"].flatMap(contratos);
  assert.ok(rutas.some((r) => r.startsWith("src/lib/navegacion/")), "el barrido entra en las subcarpetas");
  const faltan = faltantes(rutas, (r) => readFileSync(`${RAIZ}${r}`, "utf8"), gate);
  assert.deepEqual(faltan, [], "Súmalos a TRANSVERSALES en scripts/gate-front.mjs.");
});

test("el detector da rojo por un contrato nuevo que escanea el árbol y no está en la lista", () => {
  const fuentes = {
    "src/lib/navegacion/nuevo.contract.test.ts": 'import { parseSourcesContaining } from "../../test/contractSourceScan";',
    "src/app/directo.contract.test.ts": "const xs = fs.readdirSync(SRC);",
    "src/app/fijo.contract.test.ts": 'const css = readFileSync(path.join(appDir, "theme.css"), "utf8");',
    "src/app/yaEsta.contract.test.ts": "fs.readdirSync(SRC)",
    "src/app/cierre.contract.test.tsx": "const cierre = cierreDeImports([APP_PUBLICA]);",
  };
  const gateFalso = 'const TRANSVERSALES = ["src/app/yaEsta.contract.test.ts"];';
  assert.deepEqual(faltantes(Object.keys(fuentes), (r) => fuentes[r], gateFalso), [
    "src/lib/navegacion/nuevo.contract.test.ts",
    "src/app/directo.contract.test.ts",
    "src/app/cierre.contract.test.tsx",
  ]);
});
