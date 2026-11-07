// Saltos que apagan un test según DÓNDE corre, no por una causa del test:
//
// - `skip_on_cran()` lo apaga salvo que NOT_CRAN=true. El CI sí lo fija (lo exporta
//   `r-lib/actions/setup-r`, se ve como `NOT_CRAN: true` en el log del job backend-r),
//   pero `gate-area`, `testthat::test_file` y cualquier corrida local no: ahí un
//   skip_on_cran mudo deja el test fuera del gate que se corre al cerrar un cambio, y su
//   rojo aparece recién en el CI. El 4 nov 2026 el del deploy manual del tablero esperaba
//   un resultado que el código ya no daba y ningún gate local lo vio; cinco renders reales
//   con Quarto tampoco corrían en local, y en el CI se saltan por falta de Quarto.
// - `skip_on_ci()` y los skips condicionados a `Sys.getenv("CI")` (o GITHUB_ACTIONS)
//   lo apagan en el CI. `test-hojas-ruta-engine.R` apagaba así sus 65 tests y ningún
//   workflow fijaba la variable que los reactivaba (8699413d6 → 4 nov 2026).
//
// Regla: uno de esos saltos lleva, en el bloque de comentarios justo encima, una línea
// `# skip_on_cran: <por qué>` o `# skip_on_ci: <por qué>` que declara que se apaga a
// propósito. Lo normal es saltar por la causa real (`skip_if_not(<herramienta>)`, una
// env var de opt-out). Un `if (CI) fail(...)` no es un salto y no se exige nada.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../../api/tests/testthat/", import.meta.url).pathname;

const sinComentario = (linea) => linea.replace(/#.*$/, "");
const LEE_CI = /Sys\.getenv\(\s*["'](CI|GITHUB_ACTIONS)["']/;
const SALTO = /\bskip(?:_if(?:_not)?)?\s*\(/;

/** El bloque contiguo de comentarios que queda justo encima de la línea `i`. */
function comentariosEncima(lineas, i) {
  const out = [];
  for (let k = i - 1; k >= 0 && /^\s*#/.test(lineas[k]); k--) out.push(lineas[k].trim());
  return out;
}

/** ¿La línea `i` está dentro de una llamada de salto abierta en una línea anterior? Da su inicio o -1. */
function inicioDelSaltoAbierto(lineas, i) {
  for (let k = i - 1; k >= Math.max(0, i - 6); k--) {
    const codigo = sinComentario(lineas[k]);
    if (!SALTO.test(codigo)) continue;
    let prof = 0;
    for (const l of lineas.slice(k, i).map(sinComentario)) for (const c of l) prof += c === "(" ? 1 : c === ")" ? -1 : 0;
    return prof > 0 ? k : -1;
  }
  return -1;
}

/** ¿La línea es un `if (cond)` que no hace nada más (su cuerpo es la línea siguiente)? */
function ifSinCuerpo(codigo) {
  const m = /\bif\s*\(/.exec(codigo);
  if (!m) return false;
  let prof = 0;
  for (let k = m.index + m[0].length - 1; k < codigo.length; k++) {
    prof += codigo[k] === "(" ? 1 : codigo[k] === ")" ? -1 : 0;
    if (prof === 0) return /^\s*\{?\s*$/.test(codigo.slice(k + 1));
  }
  return true;
}

/** Los saltos por entorno sin motivo declarado, como `archivo:línea (tipo)`. */
export function skipsSinMotivo(archivo, fuente) {
  const lineas = fuente.split("\n");
  const fallas = [];
  const exigir = (inicio, tipo) => {
    const declarado = comentariosEncima(lineas, inicio).some((c) => new RegExp(`^#\\s*${tipo}:\\s*\\S`).test(c));
    if (!declarado) fallas.push(`${archivo}:${inicio + 1} (${tipo})`);
  };
  const vistos = new Set();
  lineas.forEach((linea, i) => {
    const codigo = sinComentario(linea);
    if (/\bskip_on_cran\s*\(/.test(codigo)) exigir(i, "skip_on_cran");
    if (/\bskip_on_ci\s*\(/.test(codigo)) exigir(i, "skip_on_ci");
    if (!LEE_CI.test(codigo)) return;
    // Un salto condicionado al CI: en la misma línea, dentro de una llamada abierta
    // arriba, o como cuerpo de un `if (CI)` en la línea siguiente.
    let inicio = -1;
    if (SALTO.test(codigo)) inicio = i;
    else if ((inicio = inicioDelSaltoAbierto(lineas, i)) < 0 && ifSinCuerpo(codigo) && SALTO.test(sinComentario(lineas[i + 1] ?? ""))) inicio = i;
    if (inicio >= 0 && !vistos.has(inicio)) {
      vistos.add(inicio);
      exigir(inicio, "skip_on_ci");
    }
  });
  return fallas;
}

test("ningún salto por entorno de api/tests se apaga sin decir por qué", () => {
  const archivos = readdirSync(DIR).filter((f) => f.endsWith(".R"));
  assert.ok(archivos.length > 100, "el barrido lee la carpeta de tests");
  const fallas = archivos.flatMap((f) => skipsSinMotivo(f, readFileSync(`${DIR}${f}`, "utf8")));
  assert.deepEqual(fallas, [], "Salta por la causa real (skip_if_not), o declara `# skip_on_cran:`/`# skip_on_ci: <por qué>` encima.");
});

test("el detector da rojo por un skip_on_cran mudo y no por uno declarado ni por su mención", () => {
  assert.deepEqual(skipsSinMotivo("a.R", 'test_that("x", {\n  skip_on_cran()\n})'), ["a.R:2 (skip_on_cran)"]);
  assert.deepEqual(skipsSinMotivo("b.R", "  testthat::skip_on_cran()"), ["b.R:1 (skip_on_cran)"]);
  assert.deepEqual(skipsSinMotivo("c.R", "  # skip_on_cran: tarda 10 min y el gate de release lo corre\n  skip_on_cran()"), []);
  assert.deepEqual(skipsSinMotivo("d.R", "  # Sin skip_on_cran(): gate-area no fija NOT_CRAN"), []);
  assert.deepEqual(skipsSinMotivo("e.R", "  # skip_on_cran:\n  skip_on_cran()"), ["e.R:2 (skip_on_cran)"]);
});

test("el detector da rojo por un salto en CI mudo, en sus tres formas", () => {
  assert.deepEqual(skipsSinMotivo("f.R", "  skip_on_ci()"), ["f.R:1 (skip_on_ci)"]);
  assert.deepEqual(skipsSinMotivo("g.R", '  skip_if(identical(Sys.getenv("CI"), "true"), "pesado")'), ["g.R:1 (skip_on_ci)"]);
  // Varias líneas: el salto abre arriba y lee CI en la continuación (la forma de hojas-ruta-engine).
  assert.deepEqual(
    skipsSinMotivo("h.R", 'testthat::skip_if(\n  identical(Sys.getenv("CI"), "true") &&\n    !nzchar(Sys.getenv("X")),\n  "motivo"\n)'),
    ["h.R:1 (skip_on_ci)"],
  );
  assert.deepEqual(skipsSinMotivo("i.R", "  if (nzchar(Sys.getenv('GITHUB_ACTIONS')))\n    skip('en Actions no')"), ["i.R:1 (skip_on_ci)"]);
});

test("un salto en CI declarado pasa, y leer CI para fallar no es un salto", () => {
  assert.deepEqual(
    skipsSinMotivo("j.R", '  # skip_on_ci: ~95 s de integración; gate-area lo corre\n  # y una env var lo activa.\n  testthat::skip_if(\n    identical(Sys.getenv("CI"), "true"),\n    "x"\n  )'),
    [],
  );
  assert.deepEqual(skipsSinMotivo("k.R", '  if (nzchar(Sys.getenv("CI"))) {\n    testthat::fail("pdftoppm no esta en el CI")\n  }'), []);
  // La forma de test-xlsform-formulario-pdf: en CI falla, y en local salta por la causa real.
  assert.deepEqual(
    skipsSinMotivo("m.R", '    if (nzchar(Sys.getenv("CI"))) testthat::fail("pdftoppm no esta en el CI")\n    testthat::skip("pdftoppm no esta disponible")'),
    [],
  );
  assert.deepEqual(skipsSinMotivo("l.R", '  skip_if_not_installed("qpdf")\n  x <- Sys.getenv("CI")'), []);
});
