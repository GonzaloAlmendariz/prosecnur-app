// ponderacionBases.ts — cómo pondera cada base de la serie (contrato E4-E7, R2).
//
// El comparativo aplica la ponderación DECLARADA de cada base: «declarada» es
// que la config de Analítica de esa base trae `ponderacion.enabled`
// (`.armz_ponderar` en `api/R/analitica_armonizada.R`). Sin declaración y con
// una columna `peso`, el comparativo se detiene con `E_ARMONIZADA_PESO_NO_DECLARADO`.
//
// Límite de hoy: el backend sólo expone la config de la base ACTIVA
// (`GET /api/analitica/config`); no hay lectura de la config de otra base sin
// cambiar la base activa, que es una mutación de sesión. Por eso las demás
// bases quedan «sin leer» en vez de suponerse. Cuando exista una lectura por
// base, sólo cambia este módulo.
//
// No se reexporta desde el barrel `client.ts`.

import { apiAnaliticaConfigGet } from "./analitica";
import { booleano, registro, texto } from "./normalizarR";

export type PonderacionDeBase =
  | { tipo: "columna"; columna: string }
  | { tipo: "calibracion" }
  | { tipo: "sin_ponderar" }
  | { tipo: "sin_declarar" }
  /** La app no puede leerla desde aquí (no es la base activa). */
  | { tipo: "sin_leer" };

/**
 * Lo que declara la config de Analítica de una base, con la misma regla que el
 * motor del comparativo: sin `enabled`, no hay declaración.
 */
export function normalizarPonderacionDeConfig(config: unknown): PonderacionDeBase {
  const pond = registro(registro(config).ponderacion);
  const enabledCrudo = Array.isArray(pond.enabled) ? pond.enabled[0] : pond.enabled;
  if (enabledCrudo === undefined || enabledCrudo === null) return { tipo: "sin_declarar" };
  if (!booleano(enabledCrudo)) return { tipo: "sin_ponderar" };
  if (texto(pond.modo) === "columna") return { tipo: "columna", columna: texto(pond.peso_columna) };
  return { tipo: "calibracion" };
}

/** Ponderación declarada en la base activa de Analítica. */
export async function getPonderacionBaseActiva(): Promise<PonderacionDeBase> {
  const out = await apiAnaliticaConfigGet();
  return normalizarPonderacionDeConfig(registro(out).config);
}
