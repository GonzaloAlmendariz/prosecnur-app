// `skip_on_cran()` apaga un test salvo que NOT_CRAN=true, y ni `gate-area` ni el CI
// (`testthat::test_dir` en quality.yml) lo fijan: el paquete no se publica en CRAN, así
// que un skip_on_cran es un test que no corre en ninguna parte. El 4 nov 2026 el del
// deploy manual del tablero llevaba así quién sabe cuánto, esperando un resultado que
// el código ya no daba, y cinco renders reales con Quarto tampoco corrían en local.
//
// Regla: un `skip_on_cran()` en api/tests lleva en la línea anterior un comentario
// `# skip_on_cran: <por qué>`, que declara que se apaga a propósito. Lo normal es
// saltar por la causa real (`skip_if_not(<herramienta>)`, una env var de opt-out).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../../api/tests/testthat/", import.meta.url).pathname;

/** Las llamadas a skip_on_cran sin motivo declarado, como `archivo:línea`. */
export function skipsSinMotivo(archivo, fuente) {
  const lineas = fuente.split("\n");
  const fallas = [];
  lineas.forEach((linea, i) => {
    const codigo = linea.replace(/#.*$/, "");
    if (!/\bskip_on_cran\s*\(/.test(codigo)) return;
    const previa = (lineas[i - 1] ?? "").trim();
    if (!/^#\s*skip_on_cran:\s*\S/.test(previa)) fallas.push(`${archivo}:${i + 1}`);
  });
  return fallas;
}

test("ningún skip_on_cran de api/tests se salta sin decir por qué", () => {
  const archivos = readdirSync(DIR).filter((f) => f.endsWith(".R"));
  assert.ok(archivos.length > 100, "el barrido lee la carpeta de tests");
  const fallas = archivos.flatMap((f) => skipsSinMotivo(f, readFileSync(`${DIR}${f}`, "utf8")));
  assert.deepEqual(fallas, [], "Salta por la causa real (skip_if_not), o declara `# skip_on_cran: <por qué>` en la línea anterior.");
});

test("el detector da rojo por un skip mudo y no por uno declarado ni por su mención", () => {
  assert.deepEqual(skipsSinMotivo("a.R", 'test_that("x", {\n  skip_on_cran()\n})'), ["a.R:2"]);
  assert.deepEqual(skipsSinMotivo("b.R", "  testthat::skip_on_cran()"), ["b.R:1"]);
  assert.deepEqual(skipsSinMotivo("c.R", "  # skip_on_cran: tarda 10 min y el gate de release lo corre\n  skip_on_cran()"), []);
  assert.deepEqual(skipsSinMotivo("d.R", "  # Sin skip_on_cran(): NOT_CRAN no se fija en CI"), []);
  assert.deepEqual(skipsSinMotivo("e.R", "  # skip_on_cran:\n  skip_on_cran()"), ["e.R:2"]);
});
