import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * La efectividad del campo, día a día.
 *
 * Dictado de Gonzalo (2026-09-09) sobre la pestaña Efectividad: «a lo mejor la
 * efectividad era baja al principio pero ahora se está recuperando: patrones,
 * tendencias». No existía esa lectura —la pestaña listaba cada curso-horario
 * contra su margen, decenas de filas de las que no sale ninguna decisión— y
 * medida sobre el operativo el patrón salta a la vista:
 *
 *     07/09  16 aulas  327/604  54,1 %   ·  111 % de lo esperado
 *     08/09  21 aulas  425/725  58,6 %   ·  112 %
 *     09/09   7 aulas  160/180  88,9 %   ·  154 %
 *
 * **La τ del día es sobre ELEGIBLES, no sobre asistentes.** Sobre asistentes
 * mide el trabajo dentro del aula —cuántos de los que estaban respondieron— y
 * eso ya lo dice el ranking de Rendimiento. Sobre elegibles mide lo que decide
 * si el estudio cierra: de todos los que podían responder, cuántos lo hicieron.
 *
 * Y va con el NÚMERO DE AULAS de cada día pegado: el 88,9 % del tercer día sale
 * de siete visitas, y una tendencia leída sobre siete observaciones es una
 * hipótesis, no un hecho. Sin ese conteo al lado, el gráfico promete más de lo
 * que puede sostener.
 */
export type EfectividadDeUnDia = {
  /** ISO `YYYY-MM-DD`. */
  fecha: string;
  aulas: number;
  efectivas: number;
  elegibles: number;
  /** Lo que el diseño esperaba de esos mismos cursos-horario. */
  esperadas: number;
  /** Efectivas sobre elegibles, en puntos. `null` sin elegibles conocidos. */
  tau: number | null;
  /** Efectivas sobre lo esperado, en puntos. `null` sin esperadas. */
  delEsperado: number | null;
};

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** `2026-09-07 10:00` o `2026-09-07` → `2026-09-07`; cualquier otra cosa, "". */
function fechaDelParte(fila: MonitoreoRow): string {
  const bruto = texto(fila.applied_at) || texto(fila.applied_date);
  const iso = bruto.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
}

/**
 * Agrupa los partes por día de aplicación y cruza con el plan para saber
 * cuántos elegibles y cuántas esperadas había detrás.
 *
 * Un parte sin efectivas NI asistentes se salta: es un parte vacío, no un día
 * que rindió cero, y contarlo hundiría la tasa de su jornada. Misma regla que
 * `rendimientoPorFacultad`, y a propósito: dos criterios distintos para «este
 * parte cuenta» darían dos verdades sobre el mismo día.
 */
export function efectividadPorDia(
  partes: ReadonlyArray<MonitoreoRow>,
  plan: ReadonlyArray<MonitoreoRow> = [],
): EfectividadDeUnDia[] {
  const elegiblesPorCodigo = new Map<string, number>();
  const esperadasPorCodigo = new Map<string, number>();
  for (const fila of plan) {
    const codigo = texto(fila.operational_code);
    if (!codigo || elegiblesPorCodigo.has(codigo)) continue;
    elegiblesPorCodigo.set(codigo, numero(fila.eligible_n));
    esperadasPorCodigo.set(codigo, numero(fila.expected_valid));
  }

  const porDia = new Map<string, EfectividadDeUnDia>();
  for (const fila of partes) {
    const fecha = fechaDelParte(fila);
    if (!fecha) continue;
    const efectivas = numero(fila.effective_surveys);
    const asistentes = numero(fila.observed_students);
    if (!efectivas && !asistentes) continue;
    const codigo = texto(fila.operational_code);
    const dia = porDia.get(fecha) ?? {
      fecha, aulas: 0, efectivas: 0, elegibles: 0, esperadas: 0, tau: null, delEsperado: null,
    };
    dia.aulas += 1;
    dia.efectivas += efectivas;
    dia.elegibles += elegiblesPorCodigo.get(codigo) ?? 0;
    dia.esperadas += esperadasPorCodigo.get(codigo) ?? 0;
    porDia.set(fecha, dia);
  }

  // Cronológico: una tendencia se lee en el tiempo, no en un ranking. Ordenarla
  // por la tasa contestaría «qué día fue mejor», que es otra pregunta y no la
  // que este bloque existe para responder.
  return [...porDia.values()]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((d) => ({
      ...d,
      tau: d.elegibles > 0 ? Math.round((1000 * d.efectivas) / d.elegibles) / 10 : null,
      delEsperado: d.esperadas > 0 ? Math.round((1000 * d.efectivas) / d.esperadas) / 10 : null,
    }));
}

/**
 * La frase de cabecera: hacia dónde va la efectividad.
 *
 * Compara el PRIMER día con el ÚLTIMO y nada más. Una regresión sobre tres
 * puntos sería estadística de adorno, y decir «sube» o «baja» con la primera y
 * la última cifra a la vista deja que quien lee juzgue: es lo que la tabla de
 * debajo enseña día a día.
 *
 * Devuelve "" con menos de dos días con tasa: sin dos puntos no hay tendencia
 * que afirmar, y un vacío es mejor que una frase que suena a hallazgo.
 */
export function tendenciaDeEfectividad(dias: ReadonlyArray<EfectividadDeUnDia>): {
  sentido: "sube" | "baja" | "estable";
  desde: EfectividadDeUnDia;
  hasta: EfectividadDeUnDia;
} | null {
  const conTasa = dias.filter((d) => d.tau !== null);
  if (conTasa.length < 2) return null;
  const desde = conTasa[0];
  const hasta = conTasa[conTasa.length - 1];
  const delta = (hasta.tau ?? 0) - (desde.tau ?? 0);
  // Dos puntos porcentuales de banda muerta: por debajo de eso, llamarlo
  // «sube» sobre un puñado de aulas es leerle intención al ruido.
  const sentido = Math.abs(delta) < 2 ? "estable" : delta > 0 ? "sube" : "baja";
  return { sentido, desde, hasta };
}
