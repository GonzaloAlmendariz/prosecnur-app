// ponderacionBases.ts — cómo pondera cada base de la serie (contrato E4-E7, R2).
//
// El comparativo aplica la ponderación DECLARADA de cada base: «declarada» es
// que la config de Analítica de esa base trae `ponderacion.enabled`
// (`.armz_ponderar` en `api/R/analitica_armonizada.R`). Sin declaración y con
// una columna `peso`, el comparativo se detiene con `E_ARMONIZADA_PESO_NO_DECLARADO`.
//
// `GET /api/analitica/ponderacion/bases` da la declaración de TODAS las bases
// sin cambiar la activa. Una base que el backend no lista queda «sin leer»: no
// se supone.
//
// Cada base trae además `columnas_peso`: columnas numéricas cuyo nombre parece
// un peso (`ponderacion_bases.R`). Con eso «sin declarar» se parte en dos
// hechos distintos: sin columnas de peso, la base no tiene peso que declarar
// (equivale a «sin ponderar»); con alguna, falta declararla.
//
// No se reexporta desde el barrel `client.ts`.

import { apiAnaliticaConfigGet } from "./analitica";
import { apiFetch, handle, headers } from "./core";
import { booleano, registro, texto } from "./normalizarR";

export type PonderacionDeBase =
  | { tipo: "columna"; columna: string }
  | { tipo: "calibracion" }
  | { tipo: "sin_ponderar" }
  /**
   * No declara cómo pondera. `columnasPeso`: las columnas de peso que trae
   * (vacío = ninguna, la base sale sin ponderar sin que falte nada); `null` si
   * la lectura no lo dice (la config sola, o un backend anterior).
   */
  | { tipo: "sin_declarar"; columnasPeso: string[] | null }
  /** La app no puede leerla desde aquí (no es la base activa). */
  | { tipo: "sin_leer" };

/**
 * Lo que declara la config de Analítica de una base, con la misma regla que el
 * motor del comparativo: sin `enabled`, no hay declaración.
 */
export function normalizarPonderacionDeConfig(config: unknown): PonderacionDeBase {
  const pond = registro(registro(config).ponderacion);
  const enabledCrudo = Array.isArray(pond.enabled) ? pond.enabled[0] : pond.enabled;
  if (enabledCrudo === undefined || enabledCrudo === null) return { tipo: "sin_declarar", columnasPeso: null };
  if (!booleano(enabledCrudo)) return { tipo: "sin_ponderar" };
  if (texto(pond.modo) === "columna") return { tipo: "columna", columna: texto(pond.peso_columna) };
  return { tipo: "calibracion" };
}

/** Ponderación declarada en la base activa de Analítica. */
export async function getPonderacionBaseActiva(): Promise<PonderacionDeBase> {
  const out = await apiAnaliticaConfigGet();
  return normalizarPonderacionDeConfig(registro(out).config);
}

/** Declaración de cada base, por nombre. */
export type PonderacionPorBase = Record<string, PonderacionDeBase>;

/**
 * `columnas_peso` defensivo: arreglo (también de uno o cero), un escalar suelto
 * de R o `{}` (lista vacía). Ausente o nulo: `null`, no se sabe. Sin vacíos ni
 * repetidos.
 */
export function normalizarColumnasPeso(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  const crudas = Array.isArray(value) ? value : typeof value === "object" ? [] : [value];
  const out: string[] = [];
  for (const c of crudas) {
    const t = texto(c);
    if (t && t !== "NA" && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Una entrada de `/api/analitica/ponderacion/bases`, con la misma regla que el motor. */
export function normalizarPonderacionDeBase(x: unknown): PonderacionDeBase {
  const r = registro(x);
  const declarada = booleano(Array.isArray(r.declarada) ? r.declarada[0] : r.declarada);
  if (!declarada) return { tipo: "sin_declarar", columnasPeso: normalizarColumnasPeso(r.columnas_peso) };
  const enabled = Array.isArray(r.enabled) ? r.enabled[0] : r.enabled;
  if (!booleano(enabled)) return { tipo: "sin_ponderar" };
  if (texto(r.modo) === "columna") return { tipo: "columna", columna: texto(r.peso_columna) };
  return { tipo: "calibracion" };
}

export function normalizarPonderacionBases(payload: unknown): PonderacionPorBase {
  const bases = registro(registro(payload).bases);
  const out: PonderacionPorBase = {};
  for (const [base, v] of Object.entries(bases)) out[base] = normalizarPonderacionDeBase(v);
  return out;
}

/** Ponderación declarada de todas las bases del estudio. */
export async function getPonderacionBases(): Promise<PonderacionPorBase> {
  const raw = await handle<unknown>(
    await apiFetch("/api/analitica/ponderacion/bases", { headers: headers() }),
  );
  return normalizarPonderacionBases(raw);
}
