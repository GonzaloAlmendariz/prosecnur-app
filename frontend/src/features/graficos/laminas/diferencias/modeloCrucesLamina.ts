// Cruces, nombres de los cruces y rótulos cortos de los grupos escritos en la propia lámina (`cruces`, `rotulos` y
// `cortos` del payload de «Resumen de diferencias» y de «Hallazgos clave»). Son las mismas claves que la opción de las
// tarjetas (modeloTarjetas.ts), así que se editan con sus componentes. Sin React, para probarlo solo.
//
// La regla del motor (`.dif_cruces`, api/R/graficos_resumen_diferencias.R): sin `cruces`, los cruces son los que la
// lámina rotula (`names(rotulos)`); si tampoco hay, los de las tarjetas del plan y luego los del estudio. Por eso:
//   - sin `cruces` escritos se muestran los rotulados, y al tocar uno se escriben (cambiar un nombre no los cambia);
//   - quitar un cruce quita también su nombre, o volvería por `rotulos`.

import type { TarjetasDiferenciasMeta } from "../../slideMeta";
import { crucesDe, nombreLocal, type CambiosOpcion } from "./modeloTarjetas";

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function mapaTexto(v: unknown): Record<string, string> {
  if (!esObjeto(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) {
    const t = Array.isArray(x) ? x[0] : x;
    if (typeof t === "string" && t.trim() !== "") out[k] = t;
  }
  return out;
}

/** Los cruces que rigen: los escritos o, si no hay, los que la lámina rotula. */
export function crucesDeLamina(payload: Record<string, unknown>): string[] {
  const escritos = crucesDe({ cruces: payload.cruces as string[] | undefined });
  return escritos.length ? escritos : Object.keys(mapaTexto(payload.rotulos));
}

/** ¿Los cruces que se ven salen de los nombres y no de una lista escrita? */
export function crucesImplicitos(payload: Record<string, unknown>): boolean {
  return crucesDe({ cruces: payload.cruces as string[] | undefined }).length === 0 && crucesDeLamina(payload).length > 0;
}

/** La lámina vista como la opción de las tarjetas, para OpcionesTarjetas y CortosGrupos. */
export function tarjetasDeLamina(payload: Record<string, unknown>): TarjetasDiferenciasMeta {
  return { cruces: crucesDeLamina(payload), rotulos: mapaTexto(payload.rotulos), cortos: mapaTexto(payload.cortos) };
}

/** Los nombres que siguen teniendo su cruce (por la variable sin base). */
export function rotulosDeCruces(rotulos: Readonly<Record<string, string>>, cruces: readonly string[]): Record<string, string> {
  const locales = new Set(cruces.map(nombreLocal));
  return Object.fromEntries(Object.entries(rotulos).filter(([k]) => locales.has(k)));
}

/**
 * El parche del payload para un cambio de cruces, nombres o cortos. Un cambio de cruces o de nombres escribe los dos:
 * la lista de cruces explícita (o `null` si queda vacía) y sólo los nombres de esos cruces. Lo vacío va como `null` para
 * que mande lo del motor.
 */
export function parcheCrucesLamina(payload: Record<string, unknown>, cambios: CambiosOpcion): Record<string, unknown> {
  const parche: Record<string, unknown> = {};
  if ("cruces" in cambios || "rotulos" in cambios) {
    const cruces = cambios.cruces ?? crucesDeLamina(payload);
    const rotulos = rotulosDeCruces(cambios.rotulos ?? mapaTexto(payload.rotulos), cruces);
    parche.cruces = cruces.length ? [...cruces] : null;
    parche.rotulos = Object.keys(rotulos).length ? rotulos : null;
  }
  if ("cortos" in cambios) {
    const cortos = cambios.cortos ?? {};
    parche.cortos = Object.keys(cortos).length ? cortos : null;
  }
  return parche;
}
