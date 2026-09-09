import { etiquetaDeEstrato } from "./etiquetaDeEstrato";

/**
 * Cuánto se ha alejado la muestra que de verdad se aplica de la que se diseñó.
 *
 * El sorteo repartió los cursos-horario por estrato en unas proporciones. Cada
 * titular que se cae y cada reserva que entra en su lugar mueven esas
 * proporciones un poco. Este bloque mide cuánto se han movido: es la pregunta
 * de la pestaña «Estratos» —avance y brecha POR ESTRATO— y hasta el 2026-09-08
 * **ningún archivo del frontend lo leía**, aunque el motor lo calculaba en cada
 * refresco del estado.
 *
 * Es una lectura NUEVA, no otra forma de algo que ya se pinte. Todo lo demás en
 * Avance mide cuánto se lleva recogido; esto mide si lo recogido se parece a lo
 * que se pidió. Un estudio puede ir al 100 % de su cuota con la composición
 * torcida, y al revés.
 *
 * **De dónde sale cada número** (`.monitoreo_aulas_effective_representativity()`,
 * `api/R/monitoreo_aulas_representatividad.R:87`):
 *
 * - **Planificado** es la ola M1 del plan: los titulares del sorteo.
 * - **Efectivo** son los que siguen vivos —planificada, contactada, agendada, en
 *   campo, aplicada, parcial, cerrada— más las reservas que entraron a sustituir
 *   a alguien. Quedan fuera las reemplazadas, las canceladas y las sin acceso.
 * - Las proporciones se pesan por `eligible_n`, no por número de cursos-horario:
 *   perder un curso-horario de 15 alumnos no desplaza lo mismo que perder uno
 *   de 60.
 * - `abs_error` es la diferencia en PROPORCIÓN, de 0 a 1. En pantalla va en
 *   puntos porcentuales, que es como se habla de una desviación de composición.
 * - El `score` es 0-100 y castiga la desviación media contra un umbral de 5 pp:
 *   100 es composición idéntica, 0 es una desviación media de 5 pp o peor.
 *
 * El motor avisa por su cuenta cuando algún grupo se pasa de 10 pp; ese aviso se
 * respeta y NO se recalcula aquí — quien decide qué es una desviación grave es
 * el motor, no la pantalla.
 */

export type DesvioDeEstrato = {
  /** La clave cruda del motor, la que empareja. */
  clave: string;
  /** La clave en palabras: «Gestión y alta dirección · mayoría mujeres · 31-40 alumnos». */
  etiqueta: string;
  /** Proporción diseñada, 0 a 1. */
  disenada: number;
  /** Proporción efectiva, 0 a 1. */
  efectiva: number;
  /** Desviación en PUNTOS PORCENTUALES, con signo: positivo = sobra. */
  desvio: number;
  /** Su magnitud, para ordenar. */
  magnitud: number;
};

export type VistaDeRepresentatividad = {
  /** `null` cuando hay algo que enseñar; si no, la causa, ya redactada. */
  vacio: string | null;
  /** El score del diseño, 0-100, o `null` si el estudio no lo publicó. */
  disenado: number | null;
  /** El score de lo que se está aplicando, 0-100. */
  efectivo: number | null;
  /** Cuántos puntos de score se han perdido. Positivo = se perdió. */
  perdida: number | null;
  /** Desviación media, en puntos porcentuales. */
  desvioMedio: number | null;
  cursosHorarioDelSorteo: number | null;
  cursosHorarioEnPie: number | null;
  /** El aviso del motor, tal cual. Vacío si no avisó. */
  aviso: string;
  /** Los estratos que se movieron, de más a menos. */
  desvios: DesvioDeEstrato[];
  /** Cuántos estratos NO se movieron nada. Se declara, no se esconde. */
  sinMoverse: number;
};

function numeroONulo(valor: unknown): number | null {
  // `jsonlite` serializa un NULL dentro de una lista como `{}`, no como `null`:
  // el objeto vacío tiene que caer por el mismo camino que la ausencia.
  if (valor === null || valor === undefined || typeof valor === "object") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || typeof valor === "object") return "";
  return String(valor);
}

/** Redondeo a un decimal, para que 3.4499999 no se publique como 3.4499999. */
function pp(proporcion: number): number {
  return Math.round(proporcion * 1000) / 10;
}

export function representatividadEfectiva(
  bloque: Record<string, unknown> | null | undefined,
): VistaDeRepresentatividad {
  const vacia: VistaDeRepresentatividad = {
    vacio: "",
    disenado: null, efectivo: null, perdida: null, desvioMedio: null,
    cursosHorarioDelSorteo: null, cursosHorarioEnPie: null,
    aviso: "", desvios: [], sinMoverse: 0,
  };

  if (!bloque || typeof bloque !== "object") {
    return {
      ...vacia,
      vacio: "Este estudio todavía no publica su representatividad efectiva: hace falta el plan del sorteo con sus estratos.",
    };
  }

  const filas = Array.isArray(bloque.distribution) ? bloque.distribution : [];
  const aviso = texto(bloque.warning);
  const efectivo = numeroONulo(bloque.effective_score);

  // El motor tiene su propio vacío y lo dice en el `warning` —«Sin datos
  // suficientes para distancia efectiva»—. Se respeta ése en vez de inventar
  // uno nuevo: si la hoja y la pantalla redactan el mismo hueco por separado,
  // acaban diciendo cosas distintas del mismo hecho.
  if (!filas.length) {
    return {
      ...vacia,
      aviso,
      vacio: aviso
        || "Todavía no se puede medir la desviación: el plan no trae los estratos con los que compararla.",
    };
  }

  const desvios: DesvioDeEstrato[] = [];
  let sinMoverse = 0;
  for (const cruda of filas) {
    const fila = (cruda ?? {}) as Record<string, unknown>;
    const clave = texto(fila.categoria);
    if (!clave) continue;
    const disenada = numeroONulo(fila.planned_prop);
    const efectivaProp = numeroONulo(fila.effective_prop);
    if (disenada === null || efectivaProp === null) continue;
    const desvio = pp(efectivaProp - disenada);
    if (desvio === 0) {
      // Un estrato que no se movió no es una fila que leer, pero SÍ es una
      // cifra: sin ella, «tres estratos desviados» no dice si son tres de
      // cuatro o tres de setenta.
      sinMoverse += 1;
      continue;
    }
    desvios.push({
      clave,
      etiqueta: etiquetaDeEstrato(clave),
      disenada,
      efectiva: efectivaProp,
      desvio,
      magnitud: Math.abs(desvio),
    });
  }

  desvios.sort((a, b) => b.magnitud - a.magnitud || a.etiqueta.localeCompare(b.etiqueta, "es"));

  if (!desvios.length) {
    return {
      ...vacia,
      aviso,
      efectivo,
      sinMoverse,
      vacio: `La muestra que se está aplicando conserva la composición del sorteo: ninguno de los ${sinMoverse} estratos se ha movido.`,
    };
  }

  const desvioMedioBruto = numeroONulo(bloque.effective_distance);
  return {
    vacio: null,
    disenado: numeroONulo(bloque.planned_score),
    efectivo,
    perdida: numeroONulo(bloque.score_loss),
    desvioMedio: desvioMedioBruto === null ? null : pp(desvioMedioBruto),
    cursosHorarioDelSorteo: numeroONulo(bloque.planned_aulas),
    cursosHorarioEnPie: numeroONulo(bloque.effective_aulas),
    aviso,
    desvios,
    sinMoverse,
  };
}
