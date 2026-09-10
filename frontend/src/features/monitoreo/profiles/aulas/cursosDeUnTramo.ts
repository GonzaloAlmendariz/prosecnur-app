import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { CLAVES_DE_COBERTURA } from "./coberturaPorAula";

/**
 * Los cursos-horario que caen en un tramo de cobertura, con su cadena entera.
 *
 * Gonzalo, 2026-09-10: «sería interesante que yo pudiera hacer clic en uno de
 * ellos —"se quedó a medias"— y que abajo se mostrara de forma profesional y
 * minimalista cuáles son esos CH, y que me muestren el rendimiento del aula, el
 * rendimiento esperado, la cantidad de elegibles esperados, la cantidad de
 * elegibles obtenidos, por cada CH o R que haga referencia».
 *
 * **El vocabulario, que él tuvo que corregirme**: los ELEGIBLES son los
 * matriculados que cumplen los criterios de inclusión y exclusión; de ellos se
 * espera VER unos cuantos —la asistencia— y de esos, que RESPONDAN unos cuantos
 * —la efectividad—. Su ejemplo: de 50 matriculados, 30 por asistencia, y de esos
 * 30, veinte que responden.
 *
 * Lo que cada fila puede enseñar hoy, con el dato del plan y del parte:
 *
 * | Columna | De dónde sale |
 * |---|---|
 * | Elegibles | `eligible_n` del plan |
 * | Esperadas | `expected_valid` = elegibles × la tasa del aula |
 * | Asistentes | `observed_students` del parte: quiénes estaban de verdad |
 * | Efectivas | `respuestas_validas` |
 *
 * **Lo que NO puede enseñar todavía y hay que decirlo**: «los que esperábamos
 * ver» como cifra propia. El plan guarda el PRODUCTO de la tasa y no sus dos
 * factores; el embudo del estudio de referencia sí los tiene y desde `7942e2df`
 * viaja al tablero, pero se escribe en el IMPORT, así que un proyecto importado
 * antes no lo trae hasta que se reimporte el sorteo.
 */

export type CursoDeTramo = {
  codigo: string;
  facultad: string;
  /** Matriculados que cumplen los criterios. */
  elegibles: number | null;
  /** Lo que el diseño esperaba recoger de este curso-horario. */
  esperadas: number | null;
  /** Los que de verdad estaban en el aula, según el parte. */
  asistentes: number | null;
  efectivas: number;
  /** `efectivas / esperadas`, 0-100. `null` sin meta declarada. */
  cumplimiento: number | null;
};

const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const opcional = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();

/** Los mismos cortes que reparte el gráfico, en el mismo orden. */
const CORTES: Record<string, [number, number]> = {
  nulo: [-1, 0],
  critico: [0, 0.5],
  insuficiente: [0.5, 0.75],
  parcial: [0.75, 0.9],
  satisfactorio: [0.9, 0.9999],
  pleno: [0.9999, Infinity],
};

/**
 * @param filas `course_status`, que viaja RECORTADO a 500 de las 1 392 del plan.
 *   Para este panel alcanza —los aplicados son 49 y el recorte pone titulares
 *   primero— pero la vista tiene que declararlo igual: un día el operativo puede
 *   crecer y el recorte empezar a morder.
 */
export function cursosDeUnTramo(
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  tramo: string,
): CursoDeTramo[] {
  const corte = CORTES[tramo];
  if (!corte || !CLAVES_DE_COBERTURA.includes(tramo)) return [];
  const [desde, hasta] = corte;

  const salida: CursoDeTramo[] = [];
  for (const fila of filas ?? []) {
    const esperadas = numero(fila.expected_valid);
    if (esperadas <= 0) continue;
    // El mismo criterio que el motor: sólo los APLICADOS entran al reparto.
    const estado = texto((fila as Record<string, unknown>).application_state);
    if (estado !== "en_aplicacion" && estado !== "cerrando") continue;
    const efectivas = numero(fila.respuestas_validas);
    const razon = efectivas / esperadas;
    // El cero va SIEMPRE al primer tramo aunque la razón sea 0: «sin respuestas»
    // no es «poquísimas», y es la distinción que decide si el aula se abrió.
    const cae = efectivas <= 0 ? tramo === "nulo" : razon > desde && razon <= hasta;
    if (!cae) continue;
    salida.push({
      codigo: texto(fila.operational_code) || texto(fila.classroom_id),
      facultad: texto(fila.faculty),
      elegibles: opcional(fila.eligible_n),
      esperadas,
      asistentes: opcional((fila as Record<string, unknown>).observed_students),
      efectivas,
      cumplimiento: Math.round(1000 * razon) / 10,
    });
  }
  // Del que más lejos se quedó al que menos: dentro de un tramo, lo que ordena
  // es cuánto falta, no el alfabeto.
  return salida.sort((a, b) => (a.cumplimiento ?? 0) - (b.cumplimiento ?? 0)
    || a.codigo.localeCompare(b.codigo, "es"));
}
