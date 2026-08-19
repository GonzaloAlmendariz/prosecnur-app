import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * Qué está rindiendo cada facultad, en encuestas conseguidas.
 *
 * Sustituye al eje de «aula válida / no válida», que Gonzalo retiró como
 * criterio el 2026-08-18: «que una intervención sea válida o no válida es un
 * valor que en el Excel se agregó, pero técnicamente no es algo que nosotros
 * verifiquemos… no importa si cumple el 70 % de asistencia, porque si es un aula
 * con cien elegibles, no importa que sea el 50 o el 40 %, igual son bastantes
 * alumnos y hay que ir a aplicar».
 *
 * De ahí la regla que gobierna este módulo: **la unidad es la encuesta
 * conseguida, no el porcentaje contra un umbral**. Un aula grande a media
 * asistencia rinde más que una pequeña que «cumple», y ordenar por porcentaje
 * pondría primero a la que menos aporta.
 *
 * Las tres tasas contestan tres preguntas distintas y por eso no se resumen en
 * una sola:
 *
 * - **por aula** — cuánto deja cada visita. Es lo que decide a dónde mandar
 *   gente mañana.
 * - **de los asistentes** — cuántos de los que estaban en el aula aceptaron.
 *   Mide el trabajo del aplicador, no el tamaño del aula.
 * - **del potencial** — cuántos de los elegibles del curso se consiguieron. Mide
 *   cuánto queda por exprimir de esa facultad.
 */

export type RendimientoDeFacultad = {
  facultad: string;
  /** Aulas de esa facultad con parte de campo llenado. */
  aulas: number;
  efectivas: number;
  asistentes: number;
  elegibles: number;
  /** Efectivas por aula visitada. `null` si no hay aulas. */
  porAula: number | null;
  /** Efectivas sobre los que estaban en el aula, 0-100. `null` si no hay asistentes. */
  deLosAsistentes: number | null;
  /** Efectivas sobre los elegibles del curso, 0-100. `null` si no se conocen. */
  delPotencial: number | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param partes filas del parte de campo YA con su facultad —las que devuelve
 *   `parteDeCampo`—, para no repetir aquí la unión por `operational_code` y
 *   arriesgar que dos superficies discrepen en de qué facultad es un aula.
 * @param plan el plan, sólo para los elegibles de cada aula.
 */
export function rendimientoPorFacultad(
  partes: ReadonlyArray<MonitoreoRow>,
  plan: ReadonlyArray<MonitoreoRow> = [],
): RendimientoDeFacultad[] {
  const elegiblesPorCodigo = new Map<string, number>();
  for (const fila of plan) {
    const codigo = texto(fila.operational_code);
    const n = numero(fila.eligible_n);
    if (codigo && n > 0 && !elegiblesPorCodigo.has(codigo)) elegiblesPorCodigo.set(codigo, n);
  }

  const acumulado = new Map<string, RendimientoDeFacultad>();
  for (const fila of partes) {
    const facultad = texto(fila.faculty) || "Sin facultad";
    const efectivas = numero(fila.effective_surveys);
    const asistentes = numero(fila.observed_students);
    // Un parte sin efectivas NI asistentes no es un aula que rindió cero: es un
    // parte vacío. Contarlo hundiría la tasa de su facultad con un aula que
    // nadie visitó todavía.
    if (!efectivas && !asistentes) continue;
    let f = acumulado.get(facultad);
    if (!f) {
      f = {
        facultad, aulas: 0, efectivas: 0, asistentes: 0, elegibles: 0,
        porAula: null, deLosAsistentes: null, delPotencial: null,
      };
      acumulado.set(facultad, f);
    }
    f.aulas += 1;
    f.efectivas += efectivas;
    f.asistentes += asistentes;
    f.elegibles += elegiblesPorCodigo.get(texto(fila.operational_code)) ?? 0;
  }

  const salida = [...acumulado.values()].map((f) => ({
    ...f,
    porAula: f.aulas ? Math.round((10 * f.efectivas) / f.aulas) / 10 : null,
    deLosAsistentes: f.asistentes ? Math.round((1000 * f.efectivas) / f.asistentes) / 10 : null,
    delPotencial: f.elegibles ? Math.round((1000 * f.efectivas) / f.elegibles) / 10 : null,
  }));

  // Por lo que MÁS deja cada visita, que es la pregunta «qué nos está rindiendo
  // más». NO por porcentaje: ordenar por «% de los asistentes» pondría primero
  // a un aula diminuta donde respondieron los cuatro que había.
  return salida.sort((x, y) => (y.porAula ?? -1) - (x.porAula ?? -1)
    || y.efectivas - x.efectivas
    || x.facultad.localeCompare(y.facultad, "es"));
}
