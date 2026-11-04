// El lado R de gateFrontTransversales (4 nov 2026). Una suite de testthat que lee TODOS los .R de
// `api/R` se rompe desde otro archivo: si no está entre los transversales de `scripts/gate-area.R`,
// ningún gate de área la corre y su rojo sólo aparece en el CI (así llevó `test-errors-registry.R`
// tres commits en rojo). Este test exige que cada suite así esté en TRANSVERSALES o, si lo que vigila
// es de un área que ya la corre, declarada en RECORREN_PERO_SON_DEL_AREA. Ninguna queda fuera sin que
// alguien lo decida.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR_TESTS = new URL("../../api/tests/testthat/", import.meta.url).pathname;
const gateArea = readFileSync(new URL("../gate-area.R", import.meta.url), "utf8");

/** `list.files(<dir>, pattern = "\\.R$")` o `"[.]R$"`: todos los .R, sin prefijo de dominio. */
// Admite un nivel de paréntesis dentro de la llamada: `list.files(test_path("..", "..", "R"), pattern = …)`
// es la forma más común, y un `[^)]*` se cortaba en el primer `)` y no la veía.
const LEE_TODOS_LOS_R = /list\.files\((?:[^()]|\([^()]*\))*?pattern\s*=\s*"(?:\\\\\.R\$|\[\.\]R\$)"/;

export function leeTodosLosR(fuente) {
  return LEE_TODOS_LOS_R.test(fuente);
}

/** Los nombres de un vector `NOMBRE <- c(...)` de gate-area.R. */
export function vector(texto, nombre) {
  const m = texto.match(new RegExp(`${nombre}\\s*<-\\s*c\\(([\\s\\S]*?)\\n\\)`));
  return m ? [...m[1].matchAll(/"(test-[^"]+\.R)"/g)].map((x) => x[1]) : [];
}

export function faltantes(suites, leer, texto) {
  const decididas = new Set([...vector(texto, "TRANSVERSALES"), ...vector(texto, "RECORREN_PERO_SON_DEL_AREA")]);
  return suites.filter((s) => leeTodosLosR(leer(s))).filter((s) => !decididas.has(s));
}

test("cada suite que lee todos los .R de api/R es transversal o está declarada del área", () => {
  const suites = readdirSync(DIR_TESTS).filter((f) => /^test-.*\.R$/.test(f));
  assert.ok(vector(gateArea, "TRANSVERSALES").includes("test-errors-registry.R"), "se leen los transversales");
  const faltan = faltantes(suites, (s) => readFileSync(`${DIR_TESTS}${s}`, "utf8"), gateArea);
  assert.deepEqual(faltan, [], "Súmalas a TRANSVERSALES o a RECORREN_PERO_SON_DEL_AREA en scripts/gate-area.R.");
});

test("el detector da rojo por una suite nueva que lee todos los .R y nadie decidió", () => {
  const fuentes = {
    "test-nuevo-contrato.R": 'archivos <- list.files(test_path("..", "..", "R"), pattern = "\\\\.R$", full.names = TRUE)',
    "test-corchete.R": 'fs <- list.files(dir_r, pattern = "[.]R$")',
    "test-de-dominio.R": 'fs <- list.files(dir_r, pattern = "^hojas_ruta.*[.]R$")',
    "test-ya-esta.R": 'list.files(dir_r, pattern = "\\\\.R$")',
    "test-del-area.R": 'list.files(dir_r, pattern = "\\\\.R$")',
  };
  const gateFalso = 'TRANSVERSALES <- c(\n  "test-ya-esta.R"\n)\nRECORREN_PERO_SON_DEL_AREA <- c(\n  "test-del-area.R"\n)\n';
  assert.deepEqual(faltantes(Object.keys(fuentes), (s) => fuentes[s], gateFalso), ["test-nuevo-contrato.R", "test-corchete.R"]);
});
