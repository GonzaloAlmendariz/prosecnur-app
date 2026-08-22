/**
 * Todo campo que el backend emite llega al front.
 *
 * `normalizeCollectionStatePayload` reconstruye el payload CAMPO POR CAMPO, así
 * que un campo nuevo del backend se pierde en silencio si nadie lo añade ahí. No
 * falla, no avisa: simplemente no está. Costó un diagnóstico entero el
 * 2026-08-22 con `source_vigente`, que llegaba correcto en el JSON y no aparecía
 * en pantalla teniendo el backend, el endpoint y el componente los tres bien.
 *
 * Este contrato cruza la frontera: lee la lista de campos del propio
 * `.collection_payload` en R y comprueba que el normalizador los nombra. Los
 * tests del componente no podían cazarlo —le pasan el payload a mano— ni los del
 * backend —miran el backend—; el defecto vivía justo entre los dos.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** Los campos que `.collection_payload` construye, leídos del fuente R. */
function camposDelBackend(): string[] {
  const r = leer("../../../api/R/collection_engine.R");
  const ini = r.indexOf(".collection_payload <- function");
  expect(ini, "no se encontró .collection_payload en el fuente R").toBeGreaterThan(0);
  const cuerpo = r.slice(ini, r.indexOf("\n}", ini));
  return [...cuerpo.matchAll(/^\s{4}([a-z_]+) = /gm)].map((m) => m[1]);
}

describe("la frontera entre el payload de R y el normalizador de TS", () => {
  it("el fuente R declara los campos que se esperan", () => {
    // Si esta lista se vacía, el contrato pasaría sin comprobar nada.
    const campos = camposDelBackend();
    expect(campos.length).toBeGreaterThanOrEqual(8);
    expect(campos).toContain("source_vigente");
    expect(campos).toContain("state");
  });

  it("el normalizador nombra todos los campos que el backend emite", () => {
    const ts = leer("./recopiladores.ts");
    const ini = ts.indexOf("export function normalizeCollectionStatePayload");
    const cuerpo = ts.slice(ini, ts.indexOf("\n}", ts.indexOf("return {", ini)));
    for (const campo of camposDelBackend()) {
      expect(cuerpo, `el normalizador no menciona «${campo}»: se perderá en silencio`)
        .toContain(campo);
    }
  });
});
