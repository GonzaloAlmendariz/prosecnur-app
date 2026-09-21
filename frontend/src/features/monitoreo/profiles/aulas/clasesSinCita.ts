import type { MonitoreoAulasClaseSinCita, MonitoreoAulasSinAgendar } from "../../../../api/monitoreo";

/**
 * A qué clase se puede entrar sin cita, lista para pintar al lado del día.
 *
 * Gonzalo, 2026-09-21: «el despliegue de las semanas [debe incluir] al lado una
 * tabla con los cursos-horario no agendados que se podrían ir a aplicar, pero
 * deben estar ordenados por fecha y por día (repetirse si toman más de un día)
 * […] sólo tendrían que tener bien clara la hora de inicio y fin de la clase y
 * el aula donde se dan». Y el mismo día, acotándolo: «ojo, son las titulares no
 * agendadas por agendar, no todas; o sea no reemplazos ni extras».
 *
 * El orden y el filtro los decide el motor, que es quien conoce el vocabulario
 * de estados del perfil. Aquí sólo se normaliza —defensivo, patrón
 * `normalizeGraficosShareInspect`— y se indexa por fecha, para que cada día del
 * despliegue encuentre su tabla sin recorrer la lista entera.
 */

export type ClaseSinCita = {
  codigo: string;
  curso: string;
  docente: string;
  /** Vacía cuando el catálogo trae varias aulas y no se sabe cuál toca ese día. */
  aula: string;
  aulas: string[];
  aulaIncierta: boolean;
  inicio: string;
  fin: string;
  modalidad: string;
  elegibles: number | null;
};

export type SinCitaVista = {
  porFecha: ReadonlyMap<string, ClaseSinCita[]>;
  total: number;
  sinHorario: Array<{ codigo: string; curso: string; motivo: string }>;
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function leerClase(raw: MonitoreoAulasClaseSinCita | null | undefined): ClaseSinCita | null {
  if (!raw || typeof raw !== "object") return null;
  const codigo = texto(raw.codigo);
  const inicio = texto(raw.inicio);
  const fin = texto(raw.fin);
  // Sin código ni horas no hay nada que ofrecer: una fila a medias en esta
  // tabla es un viaje a ciegas, no un dato incompleto.
  if (!codigo || !inicio || !fin) return null;
  const aulas = Array.isArray(raw.aulas) ? raw.aulas.map(texto).filter(Boolean) : [];
  const aula = texto(raw.aula);
  return {
    codigo,
    curso: texto(raw.curso),
    docente: texto(raw.docente),
    aula,
    aulas: aulas.length ? aulas : aula ? [aula] : [],
    // El motor lo declara; si no llegó, se deduce de que haya más de una y
    // ninguna elegida — nunca se elige una por defecto.
    aulaIncierta: raw.aula_incierta === true || (!aula && aulas.length > 1),
    inicio,
    fin,
    modalidad: texto(raw.modalidad),
    elegibles: numero(raw.elegibles),
  };
}

export function clasesSinCita(raw: MonitoreoAulasSinAgendar | null | undefined): SinCitaVista | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.dias)) return null;
  const porFecha = new Map<string, ClaseSinCita[]>();
  let total = 0;
  for (const dia of raw.dias) {
    const fecha = texto(dia?.fecha);
    if (!fecha || !Array.isArray(dia?.cursos)) continue;
    const cursos = dia.cursos.map(leerClase).filter((c): c is ClaseSinCita => c !== null);
    if (!cursos.length) continue;
    porFecha.set(fecha, cursos);
    total += cursos.length;
  }
  const sinHorario = (Array.isArray(raw.sin_horario) ? raw.sin_horario : [])
    .map((x) => ({ codigo: texto(x?.codigo), curso: texto(x?.curso), motivo: texto(x?.motivo) }))
    .filter((x) => x.codigo.length > 0);
  if (!porFecha.size && !sinHorario.length) return null;
  return { porFecha, total, sinHorario };
}

/** Cómo se nombra el aula de una clase, sin elegir por ella cuando hay dudas. */
export function aulaDeLaClase(c: ClaseSinCita): string {
  if (c.aula) return c.aula;
  if (c.aulas.length > 1) return c.aulas.join(" o ");
  return c.aulas[0] ?? "";
}
