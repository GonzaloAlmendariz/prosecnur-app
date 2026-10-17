/**
 * La frontera de `GET /api/recopiladores/origen` (E1e), de los dos lados.
 *
 * `normalizeCollectionOrigen` reconstruye la respuesta campo por campo: si el
 * backend renombra una clave, el campo llega vacío y la pestaña dice «al día»
 * o «0 cambios» sin que nada falle. Es la familia de `source_vigente`, que
 * llegó correcto en el JSON y no apareció en pantalla (2026-08-22).
 *
 * Este contrato lee el fuente R y comprueba que cada clave que el normalizador
 * consume la escribe el backend, que los estados coinciden y que el 409 de la
 * fuente está registrado con el código que el diálogo reconoce.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ruta = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const leer = (rel: string) => readFileSync(ruta(rel), "utf8");

const ORIGEN_R = "../../../api/R/collection_origen.R";

/** Las claves que el normalizador lee, por nivel del JSON. */
const CLAVES = {
  raiz: [
    "schema", "nivel", "state_revision", "adapter", "fuente", "plan",
    "fingerprint_actual", "fingerprint_plan", "sorteo_vigente",
    "fuente_intermedia_desfasada", "estado", "stale", "solo_corrida",
    "resumen", "cambios", "truncado", "limite",
  ],
  fuente: ["modulo", "origen", "disponible", "run_id", "unidades"],
  plan: ["existe", "run_id", "unidades", "huella_registrada"],
  resumen: [
    "altas", "bajas", "campos", "roles", "unidades_con_cambios", "sin_cambio",
    "claves_repetidas", "afectadas", "entregado", "fichas", "unidades_con_ficha", "accesos",
  ],
  filas: ["clave", "unit_id", "codigo", "rol", "facultad", "curso", "campo", "antes", "despues", "sensible"],
} as const;

function sinComentarios(r: string): string {
  return r.replace(/#[^\n]*/g, "");
}

describe("la frontera entre /origen en R y normalizeCollectionOrigen", () => {
  it("el backend tiene su módulo de origen", () => {
    expect(existsSync(ruta(ORIGEN_R)), "falta api/R/collection_origen.R (E1e, writer backend)").toBe(true);
  });

  it("el normalizador lee cada clave del contrato", () => {
    const ts = leer("./recopiladores.ts");
    const ini = ts.indexOf("export function normalizeCollectionOrigen");
    expect(ini).toBeGreaterThan(0);
    const cuerpo = ts.slice(ini, ts.indexOf("\n}\n", ini));
    for (const clave of Object.values(CLAVES).flat()) {
      expect(cuerpo.includes(clave) || ts.includes(`value.${clave}`), `el normalizador no lee «${clave}»`).toBe(true);
    }
  });

  it("cada clave que el front lee la escribe el backend", () => {
    if (!existsSync(ruta(ORIGEN_R))) return expect.fail("falta api/R/collection_origen.R");
    const r = sinComentarios(leer(ORIGEN_R));
    for (const clave of Object.values(CLAVES).flat()) {
      // `clave = …` dentro de `list(…)`, o `x$clave <- …` cuando se añade aparte.
      expect(r, `el backend no escribe «${clave}»: llegaría vacío`)
        .toMatch(new RegExp(`\\b${clave}\\s*=(?!=)|\\$${clave}\\s*<-`));
    }
  });

  it("el schema y los cuatro estados son los mismos de los dos lados", () => {
    if (!existsSync(ruta(ORIGEN_R))) return expect.fail("falta api/R/collection_origen.R");
    const r = sinComentarios(leer(ORIGEN_R));
    expect(r).toContain('"collection_origen/v1"');
    for (const estado of ["al_dia", "cambio", "sin_plan", "sin_fuente"]) {
      expect(r, `el backend no emite el estado «${estado}»`).toContain(`"${estado}"`);
    }
  });

  it("el endpoint está montado y el 409 de la fuente registrado", () => {
    expect(leer("../../../api/R/router_recopiladores.R")).toMatch(/\/origen/);
    expect(leer("../../../api/R/errors_registry.R")).toContain("E_COLLECTION_ORIGEN_CAMBIO");
    expect(leer("../features/recopiladores/resembrado.ts")).toContain("E_COLLECTION_ORIGEN_CAMBIO");
  });
});
