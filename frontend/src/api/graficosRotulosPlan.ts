// La forma de `plan.rotulos_cortos` de Gráficos (ADR 0141), sin red: la usan el store del plan y el cliente del
// ranking (graficosRotulos.ts). Opciones (rótulo completo → corto) y, en la clave reservada `preguntas`, `base$var` → corto.

/** La clave reservada de `plan.rotulos_cortos` que guarda los nombres cortos de pregunta. */
export const CLAVE_PREGUNTAS = "preguntas";

export type MapaRotulos = Readonly<Record<string, string>>;

/** `plan.rotulos_cortos`: opciones (rótulo completo → corto) y, en `preguntas`, `base$var` → corto. */
export type RotulosCortosPlan = Readonly<Record<string, string | MapaRotulos>>;

export const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** Un escalar de texto; jsonlite puede dejar un vector de uno como `[x]`. */
export function texto(x: unknown): string {
  const v = Array.isArray(x) && x.length === 1 ? x[0] : x;
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

/** Mapa de texto → texto sin vacíos. */
function mapaDeTextos(x: unknown): Record<string, string> {
  if (!isObj(x)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(x)) {
    const corto = texto(v);
    if (k.trim() && corto) out[k] = corto;
  }
  return out;
}

/** `plan.rotulos_cortos` limpio: opciones de texto y `preguntas` como mapa anidado (ausente si no hay ninguna). */
export function normalizarRotulosCortos(x: unknown): Record<string, string | MapaRotulos> {
  if (!isObj(x)) return {};
  const out: Record<string, string | MapaRotulos> = { ...opcionesDeRotulos(x as RotulosCortosPlan) };
  const preguntas = mapaDeTextos(x[CLAVE_PREGUNTAS]);
  if (Object.keys(preguntas).length) out[CLAVE_PREGUNTAS] = preguntas;
  return out;
}

/** El mapa de opciones (rótulo completo → corto), sin la clave reservada `preguntas`. */
export function opcionesDeRotulos(rc: RotulosCortosPlan | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rc ?? {})) {
    if (k === CLAVE_PREGUNTAS) continue;
    const corto = texto(v);
    if (k.trim() && corto) out[k] = corto;
  }
  return out;
}

/** El mapa de nombres cortos de pregunta (`base$var` → corto). */
export function preguntasDeRotulos(rc: RotulosCortosPlan | undefined): Record<string, string> {
  return mapaDeTextos(rc?.[CLAVE_PREGUNTAS]);
}

/** Une las dos partes en la forma de `plan.rotulos_cortos`. */
export function unirRotulos(opciones: MapaRotulos, preguntas: MapaRotulos): Record<string, string | MapaRotulos> {
  return normalizarRotulosCortos({ ...opciones, [CLAVE_PREGUNTAS]: preguntas });
}
