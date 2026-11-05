// Identidad › Rótulos cortos (U3 del checklist de mandos del mazo, 2026-11-05). `plan.rotulos_cortos` es un mapa rótulo
// completo de una respuesta → rótulo corto; el job lo aplica igual a datos, instrumento, plan y paletas
// (api/R/graficos_inclusivo.R, `.rotulos_cortos_mapa`). Sólo reemplaza el rótulo ENTERO, así que la clave tiene que ser
// el rótulo tal como lo trae el formulario: por eso se elige de las respuestas del instrumento y no se teclea. Puro.

import type { ListaRespuestas } from "./modeloColoresRespuestas";

export type RotulosCortos = Readonly<Record<string, string>>;

/** Una respuesta del formulario, con las listas que la usan. */
export type OpcionInstrumento = { rotulo: string; listas: string[] };

/** Una fila de la lista: el rótulo completo, su corto y si el formulario todavía trae esa respuesta (C5). */
export type FilaRotuloCorto = { largo: string; corto: string; enFormulario: boolean | null; listas: string[] };

/** Las respuestas distintas del formulario, en su orden, con las listas en que aparecen. */
export function opcionesDelInstrumento(listas: readonly ListaRespuestas[]): OpcionInstrumento[] {
  const porRotulo = new Map<string, OpcionInstrumento>();
  for (const l of listas) {
    for (const c of l.choices) {
      const rotulo = typeof c.label === "string" ? c.label.trim() : "";
      if (!rotulo) continue;
      const o = porRotulo.get(rotulo) ?? { rotulo, listas: [] };
      if (!o.listas.includes(l.list_name)) o.listas.push(l.list_name);
      porRotulo.set(rotulo, o);
    }
  }
  return [...porRotulo.values()];
}

/** Las filas del mapa, en su orden. Sin las respuestas leídas todavía, `enFormulario` queda en `null`. */
export function filasRotulosCortos(mapa: RotulosCortos | undefined, opciones: readonly OpcionInstrumento[] | null): FilaRotuloCorto[] {
  const porRotulo = new Map((opciones ?? []).map((o) => [o.rotulo, o]));
  return Object.entries(mapa ?? {}).map(([largo, corto]) => {
    const o = porRotulo.get(largo.trim());
    return { largo, corto, enFormulario: opciones ? !!o : null, listas: o?.listas ?? [] };
  });
}

const plano = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * Las respuestas que se pueden acortar: las que coinciden con la búsqueda (sin tildes ni mayúsculas) y aún no tienen
 * corto. Sin búsqueda, las más largas primero: son las que no caben en una lámina.
 */
export function sugerencias(opciones: readonly OpcionInstrumento[], consulta: string, mapa: RotulosCortos | undefined, max = 8): OpcionInstrumento[] {
  const q = plano(consulta);
  const libres = opciones.filter((o) => !Object.hasOwn(mapa ?? {}, o.rotulo));
  const halladas = q ? libres.filter((o) => plano(o.rotulo).includes(q)) : [...libres].sort((a, b) => b.rotulo.length - a.rotulo.length);
  return halladas.slice(0, max);
}

/** Qué impide guardar un corto, o `null` si se puede. */
export function errorCorto(largo: string, corto: string): string | null {
  const c = corto.trim();
  if (!c) return "Escribe el rótulo corto.";
  if (c === largo.trim()) return "Es igual al rótulo completo.";
  return null;
}

/** El mapa con el corto de una respuesta (nuevo o cambiado). */
export function conRotuloCorto(mapa: RotulosCortos | undefined, largo: string, corto: string): Record<string, string> {
  return { ...(mapa ?? {}), [largo]: corto.trim() };
}

/** El mapa sin el corto de una respuesta. */
export function sinRotuloCorto(mapa: RotulosCortos | undefined, largo: string): Record<string, string> {
  return Object.fromEntries(Object.entries(mapa ?? {}).filter(([k]) => k !== largo));
}

/** Estado de la pieza en la columna de Identidad: cuántos rótulos cortos hay. */
export function cuantosRotulos(mapa: RotulosCortos | undefined): number {
  return Object.keys(mapa ?? {}).length;
}
