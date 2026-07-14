/**
 * Adaptador proyecto activo → datos del motor. Lee los estratos sincronizados
 * del estudio (unidad × sexo) y el marco de aulas construido por el motor R
 * (aulasState.frame) y los expone como datos de perfil. Ningún dato del motor
 * proviene de valores fijos: o viene de aquí, o del editor manual, o del
 * ejemplo marcado.
 */
import type { CalcMuestraAulasState, CalcMuestraEstudio } from "../../../api/client";
import { rowsFrom, safeNumber } from "../sharedCore";
import { frameAuditNumber } from "../universidad/shared/frame";
import { estratosDesdeFrame } from "../universidad/shared/study";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../universidad/shared/constants";
import {
  embudoAulaDesdeFrame,
  impactoOpcionalesDesdeFrame,
  type EmbudoPaso,
  type FacultadDatos,
  type ImpactoOpcionalAula,
  type RangoNivel,
} from "../dominio";

export type DatosProyecto = {
  unidades: FacultadDatos[];
  etiquetasSexo: [string, string];
  aulasTotales: number | null;
  marcoAulas: number | null;
  embudoAula: EmbudoPaso[] | null;
  /** Impacto medido de los opcionales (c7/c8) por id, del perfil del frame; null en frames viejos. */
  impactoOpcionales: Record<string, ImpactoOpcionalAula> | null;
  /** Mapa nivel-por-unidad del workspace config, re-indexado por slug de unidad; null si no hay config. */
  mapaNivel: Record<string, RangoNivel[]> | null;
};

const UNIDAD_KEYS = ["faculty", "facultad", "unidad_academica", "escuela", "unidad"];
const ELEGIBLES_KEYS = ["eligible_n", "elegibles", "students_n", "matriculados_poblacion", "enrolled_total", "total"];

function slug(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unidad";
}

function leerTexto(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = Array.isArray(row[key]) ? (row[key] as unknown[])[0] : row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function leerNumero(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Array.isArray(row[key]) ? (row[key] as unknown[])[0] : row[key];
    const num = safeNumber(value, Number.NaN);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

/** Mediana y media de elegibles por aula, por unidad, desde el marco construido. */
function estAulaPorUnidad(aulasState: CalcMuestraAulasState | null): Map<string, { mediana: number; media: number }> {
  const resultado = new Map<string, { mediana: number; media: number }>();
  const filas = rowsFrom<Record<string, unknown>>(aulasState?.frame?.aula_frame);
  if (!filas.length) return resultado;
  const porUnidad = new Map<string, number[]>();
  for (const fila of filas) {
    const unidad = leerTexto(fila, UNIDAD_KEYS);
    const elegibles = leerNumero(fila, ELEGIBLES_KEYS);
    if (!unidad || elegibles == null) continue;
    const valores = porUnidad.get(unidad) ?? [];
    valores.push(elegibles);
    porUnidad.set(unidad, valores);
  }
  for (const [unidad, valores] of porUnidad) {
    const orden = [...valores].sort((a, b) => a - b);
    const mitad = Math.floor(orden.length / 2);
    const mediana = orden.length % 2 === 0 ? (orden[mitad - 1] + orden[mitad]) / 2 : orden[mitad];
    const media = valores.reduce((acc, v) => acc + v, 0) / valores.length;
    resultado.set(slug(unidad), { mediana, media: Math.round(media * 10) / 10 });
  }
  return resultado;
}

/**
 * Datos del proyecto activo, o null si el estudio aún no tiene estratos con
 * población (en ese caso el motor opera en modo manual/ejemplo).
 */
export function datosDelProyecto(
  estudio: CalcMuestraEstudio,
  aulasState: CalcMuestraAulasState | null,
): DatosProyecto | null {
  const componentes = estudio.componentes;
  const comp =
    componentes.find((c) => c.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID) ??
    componentes.find((c) => c.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID) ??
    componentes[0];
  let estratos = (comp?.marco.estratos ?? []).filter((e) => safeNumber(e.N, 0) > 0);
  if (!estratos.length) {
    // Estudios sin estratos sincronizados: derivarlos del marco construido.
    const desdeFrame = estratosDesdeFrame(rowsFrom<Record<string, unknown>>(aulasState?.frame?.population));
    estratos = (desdeFrame?.estratos ?? []).filter((e) => safeNumber(e.N, 0) > 0);
  }
  if (!estratos.length) return null;

  const estAula = estAulaPorUnidad(aulasState);
  const etiquetasSexo: [string, string] = [
    estratos[0].sub_a_label?.trim() || "Segmento A",
    estratos[0].sub_b_label?.trim() || "Segmento B",
  ];

  const unidades: FacultadDatos[] = estratos.map((estrato) => {
    const nombre = estrato.label?.trim() || estrato.id;
    const id = slug(nombre);
    const N = safeNumber(estrato.N, 0);
    const segA = safeNumber(estrato.N_a, 0);
    const segB = safeNumber(estrato.N_b, 0) || Math.max(N - segA, 0);
    const aula = estAula.get(id) ?? null;
    return {
      id,
      nombre,
      N,
      mujeres: segA,
      hombres: segB,
      estAulaMediana: aula?.mediana ?? null,
      estAulaMedia: aula?.media ?? null,
      alcanzables: null,
      pExito: null,
    };
  });

  const frame = aulasState?.frame ?? null;
  const aulasTotales = frameAuditNumber(frame, "classroom_n") || null;
  const marcoAulas = frameAuditNumber(frame, "classroom_included_n") || aulasTotales;
  // Embudo real del perfil del frame (pasos medidos por el motor R); frames
  // viejos sin perfil caen al embudo mínimo de dos pasos derivado del audit.
  const embudoAula: EmbudoPaso[] | null =
    embudoAulaDesdeFrame(frame) ??
    (aulasTotales && marcoAulas
      ? [
          { id: "total", label: "Cursos-horario de la base", conteo: aulasTotales, porQue: "Cursos-horario únicos detectados en la base del proyecto." },
          { id: "marco", label: "Marco muestral", conteo: marcoAulas, porQue: "Cursos-horario que cumplen los criterios de inclusión configurados." },
        ]
      : null);

  return {
    unidades,
    etiquetasSexo,
    aulasTotales,
    marcoAulas,
    embudoAula,
    impactoOpcionales: impactoOpcionalesDesdeFrame(frame),
    mapaNivel: mapaNivelDesdeWorkspace(estudio),
  };
}

/**
 * Mapa nivel-por-unidad del workspace (config del proyecto), re-indexado por
 * slug para calzar con los ids de las unidades del perfil (slug del nombre).
 * La clave persistida es el NOMBRE de la unidad tal como aparece en la base.
 */
function mapaNivelDesdeWorkspace(estudio: CalcMuestraEstudio): Record<string, RangoNivel[]> | null {
  const config = estudio.workspace?.aulas_config?.nivel_por_unidad;
  if (!config) return null;
  const entradas = Object.entries(config).filter(([, rangos]) => Array.isArray(rangos) && rangos.length > 0);
  if (!entradas.length) return null;
  const mapa: Record<string, RangoNivel[]> = {};
  for (const [nombre, rangos] of entradas) {
    mapa[slug(nombre)] = rangos.map((r) => ({ min: safeNumber(r.min, 0), max: safeNumber(r.max, 0) }));
  }
  return mapa;
}
