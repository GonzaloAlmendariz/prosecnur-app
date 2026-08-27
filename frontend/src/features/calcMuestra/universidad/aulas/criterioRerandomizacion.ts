/**
 * El criterio de aceptación de la rerandomización, construido desde el estudio.
 *
 * ADR 0082 (aceptado 2026-08-27): rerandomizar es aceptar o rechazar contra un
 * criterio fijado ANTES de sortear, y ese criterio es **dato, no código**, para
 * que el `.pulso` lo persista y el sustento pueda citarlo. El motor lo recibe
 * en `selector.rerandomizacion` y devuelve la tasa de aceptación con la corrida.
 *
 * Los tres ingredientes ya existen y no hacía falta pedirle nada al usuario:
 *
 * - la **cuota** de cada facultad, en `aulas_por_estrato[].cuota`;
 * - **τ**, en `aulas_por_estrato[].tau` (lo que rinde un elegible);
 * - el **reparto por sexo**, en `marco_prop_mujeres` de `sexo_por_facultad`,
 *   que es la proporción del MARCO y no la de la muestra: el criterio compara
 *   contra lo que el diseño pide, no contra lo que un sorteo produjo.
 *
 * Una facultad sin τ o sin proporción de mujeres **no entra** al criterio. Es
 * deliberado: incluirla con un τ inventado haría que el sorteo se aceptara o
 * rechazara por un número que nadie midió.
 */
import type {
  CalcMuestraAulasEstrato,
  CalcMuestraComponente,
  CalcMuestraSexoPorFacultad,
} from "../../../../api/client";
import { claveFacultad } from "../../dominio/rangosNivel";
import { safeNumber } from "../../sharedCore";

export type CriterioCelda = {
  faculty_key: string;
  facultad: string;
  cuota_f: number;
  cuota_m: number;
  tau: number;
};

export type CriterioRerandomizacion = {
  tipo: "cobertura_celdas";
  umbral: number;
  celdas: CriterioCelda[];
};

export type CriterioResumen = {
  criterio: CriterioRerandomizacion | null;
  /** Facultades que quedaron fuera y por qué. Sin esto, un criterio corto se
   *  lee como si cubriera todo. */
  omitidas: Array<{ facultad: string; motivo: "sin_tau" | "sin_reparto_sexo" | "sin_cuota" }>;
};

/** El umbral del ADR: toda celda alcanza su cuota. */
export const UMBRAL_COBERTURA_POR_DEFECTO = 1;

export function criterioRerandomizacionDesdeEstudio(
  componente: CalcMuestraComponente | null | undefined,
  sexoPorFacultad: CalcMuestraSexoPorFacultad | null | undefined,
  umbral: number = UMBRAL_COBERTURA_POR_DEFECTO,
): CriterioResumen {
  const filas = (componente?.resultado?.aulas_por_estrato ?? []) as CalcMuestraAulasEstrato[];
  const omitidas: CriterioResumen["omitidas"] = [];
  if (!filas.length) return { criterio: null, omitidas };

  const propPorClave = new Map<string, number>();
  for (const fila of sexoPorFacultad?.filas ?? []) {
    const prop = safeNumber(fila.marco_prop_mujeres, Number.NaN);
    const clave = fila.faculty_key || claveFacultad(fila.facultad);
    if (clave && Number.isFinite(prop) && prop >= 0 && prop <= 1) propPorClave.set(clave, prop);
  }

  const celdas: CriterioCelda[] = [];
  for (const fila of filas) {
    const facultad = String(fila.estrato ?? "");
    const clave = claveFacultad(facultad);
    if (!clave) continue;
    const cuota = safeNumber(fila.cuota, 0);
    if (!(cuota > 0)) { omitidas.push({ facultad, motivo: "sin_cuota" }); continue; }
    const tau = safeNumber((fila as { tau?: unknown }).tau, Number.NaN);
    if (!Number.isFinite(tau) || tau <= 0 || tau > 1) { omitidas.push({ facultad, motivo: "sin_tau" }); continue; }
    const prop = propPorClave.get(clave);
    if (prop == null) { omitidas.push({ facultad, motivo: "sin_reparto_sexo" }); continue; }
    celdas.push({
      faculty_key: clave,
      facultad,
      cuota_f: cuota * prop,
      cuota_m: cuota * (1 - prop),
      tau,
    });
  }

  // Un criterio sin celdas no es un criterio laxo: es la ausencia de criterio, y
  // el motor lo rechaza en vez de encender una rerandomización que no evalúa
  // nada. Se devuelve null para que la pantalla pueda decir por qué.
  if (!celdas.length) return { criterio: null, omitidas };
  return { criterio: { tipo: "cobertura_celdas", umbral, celdas }, omitidas };
}
