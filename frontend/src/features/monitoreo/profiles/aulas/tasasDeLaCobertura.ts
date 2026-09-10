import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { MINIMO_PARA_COMPARAR } from "./rendimientoPorFacultad";

/**
 * Las dos tasas que le faltaban al gráfico de cobertura: la que se les pedía y
 * la que están sacando.
 *
 * Gonzalo, 2026-09-10: «aquí sería bueno en este gráfico también integrarlo con
 * algo de efectividad y rendimiento, que son conceptos relacionados y que nos
 * servirían: el rendimiento esperado y el rendimiento observado hasta ahora».
 *
 * El panel repartía los cursos-horario aplicados en seis tramos de cumplimiento
 * y no decía con qué tasa se les pedía rendir ni con cuál están rindiendo. Las
 * dos salen del mismo sitio y con el mismo denominador —los ELEGIBLES—, que es
 * lo que las hace comparables:
 *
 * - **esperada** = lo que el diseño pedía recoger de esos cursos-horario, sobre
 *   sus elegibles. Es `expected_valid / eligible_n`, ponderada por tamaño y no
 *   promediando tasas: promediarlas le daría el mismo peso a un aula de 12 que
 *   a una de 80.
 * - **observada** = lo que de verdad se recogió, sobre los mismos elegibles.
 *
 * **Con menos de `MINIMO_PARA_COMPARAR` aplicados no hay tasa observada.** Dos
 * aulas no son una tasa, son dos anécdotas; es el mismo umbral declarado que usa
 * el ranking de rendimiento y el pronóstico por agenda.
 */

export type TasasDeLaCobertura = {
  /** Cursos-horario aplicados con elegibles declarados. */
  aulas: number;
  elegibles: number;
  esperadas: number;
  efectivas: number;
  /** 0-100, o `null` si no hay denominador. */
  esperada: number | null;
  /** 0-100, o `null` si no hay evidencia suficiente. */
  observada: number | null;
  /** Puntos de diferencia, `null` si falta alguna de las dos. */
  desvio: number | null;
};

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();
const APLICADO = new Set(["en_aplicacion", "cerrando"]);

export function tasasDeLaCobertura(
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
): TasasDeLaCobertura {
  let aulas = 0;
  let elegibles = 0;
  let esperadas = 0;
  let efectivas = 0;

  for (const f of filas ?? []) {
    // El MISMO universo que reparte el gráfico: sólo los aplicados. Meter los
    // pendientes hundiría la observada con aulas a las que no les toca.
    if (!APLICADO.has(texto((f as Record<string, unknown>).application_state))) continue;
    const n = numero(f.eligible_n);
    if (n <= 0) continue;
    aulas += 1;
    elegibles += n;
    esperadas += numero(f.expected_valid);
    efectivas += numero(f.respuestas_validas);
  }

  const pct = (v: number) => (elegibles > 0 ? Math.round((1000 * v) / elegibles) / 10 : null);
  const esperada = pct(esperadas);
  const observada = aulas >= MINIMO_PARA_COMPARAR ? pct(efectivas) : null;

  return {
    aulas,
    elegibles,
    esperadas,
    efectivas,
    esperada,
    observada,
    desvio: esperada != null && observada != null
      ? Math.round((observada - esperada) * 10) / 10
      : null,
  };
}
