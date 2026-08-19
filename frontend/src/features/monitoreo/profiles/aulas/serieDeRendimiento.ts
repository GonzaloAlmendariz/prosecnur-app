import type { MonitoreoRow } from "../../../../api/monitoreo";
import { fechaDeAplicacion } from "./ritmoPorFacultad";
import { PESO_DEL_PRIOR } from "./rendimientoPorFacultad";

/**
 * El rendimiento de cada facultad, día a día, y el que cabe esperar.
 *
 * `ritmoPorFacultad` ya contaba las efectivas de cada facultad por día, pero eso
 * es PRODUCCIÓN, no rendimiento: una facultad que aplica seis aulas y saca 120
 * encuestas no rinde más que otra que aplica dos y saca 44. Lo que decide a
 * dónde mandar gente mañana es **cuánto deja cada visita**, y eso no estaba en
 * ninguna serie.
 *
 * ## El esperado, y por qué es bayesiano de verdad
 *
 * El rendimiento observado de UN día es casi siempre el promedio de una o dos
 * aulas: salta de 30 a 12 sin que la facultad haya cambiado en nada. Dibujar esa
 * línea sola invita a decidir sobre ruido.
 *
 * Al lado va el **esperado**, que es la media posterior de un modelo
 * Gamma-Poisson: a lo observado por la facultad hasta ese día se le suman
 * `PESO_DEL_PRIOR` aulas imaginarias con el rendimiento medio del estudio.
 *
 *     esperado = (efectivas + peso × media) / (aulas + peso)
 *
 * Es el mismo prior declarado que ya usa el ranking de `rendimientoPorFacultad`
 * —cinco aulas, elegido y no estimado—, aplicado ahora a lo que sirve: **cuánto
 * cabe esperar de la próxima aula de esa facultad**. Con una aula observada el
 * esperado está pegado a la media del estudio; con treinta, a lo suyo.
 *
 * **La media del estudio es la de ESE DÍA, no la final.** Usar el total del
 * corte metería información del futuro en los primeros días y haría que la línea
 * de ayer cambiara al llegar la de mañana.
 *
 * **No proyecta hacia adelante.** Esta serie termina en el último día con campo;
 * lo que venga después es pronóstico y tiene su propio contrato.
 */

export type DiaDeRendimiento = {
  fecha: string;
  /** Aulas de esa facultad con parte ese día. */
  aulas: number;
  efectivas: number;
  /** Lo observado ESE día. `null` si la facultad no visitó ninguna aula. */
  porAula: number | null;
  aulasAcumuladas: number;
  efectivasAcumuladas: number;
  /** Media posterior Gamma-Poisson con el prior del estudio a esa fecha. */
  esperado: number;
};

export type RendimientoDiarioDeFacultad = {
  facultad: string;
  dias: DiaDeRendimiento[];
  aulas: number;
  efectivas: number;
  /** El esperado del último día, que es el que vale para decidir mañana. */
  esperadoFinal: number;
  /** Lo observado en todo el corte, sin encoger. Se enseña al lado. */
  observadoFinal: number | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

const redondea = (n: number) => Math.round(n * 10) / 10;

/**
 * @param partes filas del parte YA unidas a su facultad (`parteDeCampo`), por la
 *   misma razón que en `rendimientoPorFacultad`: si cada superficie uniera por su
 *   cuenta podrían discrepar en de qué facultad es un aula.
 */
export function serieDeRendimiento(partes: ReadonlyArray<MonitoreoRow>): {
  facultades: RendimientoDiarioDeFacultad[];
  fechas: string[];
  /** La media del estudio al cierre del último día. Es el prior de la última barra. */
  mediaDelEstudio: number;
} {
  const fechas = new Set<string>();
  const porFacultad = new Map<string, Map<string, { aulas: number; efectivas: number }>>();
  const totalPorFecha = new Map<string, { aulas: number; efectivas: number }>();

  for (const fila of partes) {
    const fecha = fechaDeAplicacion(fila.applied_at ?? fila.applied_date);
    if (!fecha) continue;
    const facultad = texto(fila.faculty) || "Sin facultad";
    const efectivas = numero(fila.effective_surveys);
    fechas.add(fecha);
    if (!porFacultad.has(facultad)) porFacultad.set(facultad, new Map());
    const dias = porFacultad.get(facultad)!;
    const dia = dias.get(fecha) ?? { aulas: 0, efectivas: 0 };
    dia.aulas += 1;
    dia.efectivas += efectivas;
    dias.set(fecha, dia);
    const total = totalPorFecha.get(fecha) ?? { aulas: 0, efectivas: 0 };
    total.aulas += 1;
    total.efectivas += efectivas;
    totalPorFecha.set(fecha, total);
  }

  const orden = [...fechas].sort();

  // La media del estudio ACUMULADA hasta cada fecha: es el prior de ese día.
  const mediaHasta = new Map<string, number>();
  let aulasEstudio = 0;
  let efectivasEstudio = 0;
  for (const fecha of orden) {
    const t = totalPorFecha.get(fecha);
    if (t) {
      aulasEstudio += t.aulas;
      efectivasEstudio += t.efectivas;
    }
    mediaHasta.set(fecha, aulasEstudio ? efectivasEstudio / aulasEstudio : 0);
  }

  const facultades = [...porFacultad.entries()].map(([facultad, dias]) => {
    let aulasAcum = 0;
    let efectivasAcum = 0;
    const serie = orden.map((fecha) => {
      const dia = dias.get(fecha) ?? { aulas: 0, efectivas: 0 };
      aulasAcum += dia.aulas;
      efectivasAcum += dia.efectivas;
      const media = mediaHasta.get(fecha) ?? 0;
      return {
        fecha,
        aulas: dia.aulas,
        efectivas: dia.efectivas,
        porAula: dia.aulas ? redondea(dia.efectivas / dia.aulas) : null,
        aulasAcumuladas: aulasAcum,
        efectivasAcumuladas: efectivasAcum,
        esperado: redondea((efectivasAcum + PESO_DEL_PRIOR * media) / (aulasAcum + PESO_DEL_PRIOR)),
      } satisfies DiaDeRendimiento;
    });
    const ultimo = serie[serie.length - 1];
    return {
      facultad,
      dias: serie,
      aulas: aulasAcum,
      efectivas: efectivasAcum,
      esperadoFinal: ultimo?.esperado ?? 0,
      observadoFinal: aulasAcum ? redondea(efectivasAcum / aulasAcum) : null,
    } satisfies RendimientoDiarioDeFacultad;
  });

  // Por lo que decide: lo que cabe esperar de la próxima aula, de mayor a menor.
  facultades.sort((a, b) => b.esperadoFinal - a.esperadoFinal || a.facultad.localeCompare(b.facultad, "es"));

  return {
    facultades,
    fechas: orden,
    mediaDelEstudio: redondea(aulasEstudio ? efectivasEstudio / aulasEstudio : 0),
  };
}
